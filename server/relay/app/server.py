"""盲中继 WebSocket 服务端本体。

这个模块只做"接线"：把 registry.py 和 auth.py 接到真实的 websockets 连接上。
业务逻辑本身在那两个模块里，已经脱离网络单测过了；这里的测试是集成测试，
证明接线是对的，而不是重新测一遍逻辑。
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import websockets
from websockets.asyncio.server import ServerConnection

from app.auth import DeviceVerifier, generate_nonce
from app.device_registry import DeviceRegistry
from app.invite_registry import InviteRegistry
from app.membership import GroupMembership
from app.pubkey_auth import b64url_decode, verify_with_public_key
from app.registry import RoomRegistry

logger = logging.getLogger("secureinchat.relay")


class RelayServer:
    def __init__(
        self,
        verifier: DeviceVerifier,
        device_registry: DeviceRegistry | None = None,
        invite_registry: InviteRegistry | None = None,
        membership: GroupMembership | None = None,
    ):
        self._verifier = verifier
        # 传了 device_registry 才支持 register_device（首次见面注册公钥）帧；
        # 用 PlaceholderHmacVerifier 联调时不需要，传 None 即可。
        self._device_registry = device_registry
        # membership 传了就在 handle_connection 里真正校验；invite_registry 目前
        # 还没有对应的帧来消耗它（"用邀请码加群"是下一个切片），先接受这个依赖
        # 但暂不在连接流程里调用它，避免在没有帧驱动的情况下猜一个语义出来。
        self._invite_registry = invite_registry
        self._membership = membership
        self._registry: RoomRegistry[ServerConnection] = RoomRegistry()

    async def handle_connection(self, ws: ServerConnection) -> None:
        nonce = generate_nonce()
        await ws.send(json.dumps({"type": "auth_challenge", "nonce": nonce}))

        device_id: str | None = None
        group_id: str | None = None
        try:
            device_id, group_id, invite_code = await self._await_auth(ws, nonce)
            if device_id is None:
                return  # auth_failed already sent, connection will close

            if self._membership is not None and not self._membership.is_member(device_id, group_id):
                if not await self._try_join_via_invite(ws, device_id, group_id, invite_code):
                    return  # auth_failed already sent inside _try_join_via_invite

            await ws.send(json.dumps({"type": "auth_ok"}))
            self._registry.register(group_id, device_id, ws)
            await self._relay_loop(ws, device_id, group_id)
        except websockets.ConnectionClosed:
            pass
        finally:
            if device_id is not None and group_id is not None:
                self._registry.unregister(group_id, device_id)

    async def _try_join_via_invite(
        self, ws: ServerConnection, device_id: str, group_id: str, invite_code: str | None
    ) -> bool:
        """成员资格检查没过时的最后一次机会：带了邀请码就试着用它加群。
        返回 True 表示已经成功加群（调用方可以继续往下走）；返回 False 表示
        已经发送 auth_failed，调用方应该直接结束这次连接。
        """
        if invite_code is None or self._invite_registry is None:
            await ws.send(json.dumps({"type": "auth_failed", "reason": "not a member of this group"}))
            return False

        ok, reason = self._invite_registry.validate_and_consume(invite_code, group_id)
        if not ok:
            await ws.send(json.dumps({"type": "auth_failed", "reason": f"invalid invite: {reason}"}))
            return False

        # 只有邀请码真正校验通过、且确实是针对这个 groupId 的，才授予成员资格——
        # validate_and_consume 内部已经比对过 claimed_group_id，这里不用再查一遍。
        if self._membership is not None:
            self._membership.add(device_id, group_id)
        return True

    async def _await_auth(self, ws: ServerConnection, nonce: str) -> tuple[str | None, str | None, str | None]:
        raw = await ws.recv()
        try:
            frame: dict[str, Any] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "malformed frame"}))
            return None, None, None

        frame_type = frame.get("type")
        if frame_type == "register_device" and self._device_registry is not None:
            return await self._handle_register_device(ws, nonce, frame)

        if frame_type == "rotate_device_key" and self._device_registry is not None:
            return await self._handle_rotate_device_key(ws, nonce, frame)

        if frame_type != "auth_response":
            await ws.send(
                json.dumps(
                    {"type": "auth_failed", "reason": "expected auth_response, register_device, or rotate_device_key"}
                )
            )
            return None, None, None

        device_id = frame.get("deviceId")
        group_id = frame.get("groupId")
        proof = frame.get("proof")
        if not device_id or not group_id or not proof:
            await ws.send(json.dumps({"type": "auth_failed", "reason": "missing fields"}))
            return None, None, None

        if not self._verifier.verify(device_id, nonce, proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "invalid proof"}))
            return None, None, None

        # 注意：auth_ok 不在这里发——身份证明通过只是第一关，还要过 handle_connection
        # 里的成员资格校验（可能还要试邀请码）。两件事合并成一次 auth_ok，不要提前发送。
        return device_id, group_id, frame.get("inviteCode")

    async def _handle_register_device(
        self, ws: ServerConnection, nonce: str, frame: dict[str, Any]
    ) -> tuple[str | None, str | None, str | None]:
        """TOFU（Trust-On-First-Use）注册：deviceId 第一次出现时，客户端证明持有
        对应私钥，服务端登记公钥。deviceId 已注册过 → 一律拒绝，不允许用这个帧
        覆盖别人（或自己）已有的公钥——那是身份冒充漏洞，密钥轮换需要走另一个
        专门的、要求旧密钥签名的流程（未来切片），不能用 register_device 抄近路。
        """
        assert self._device_registry is not None  # 调用方已检查过

        device_id = frame.get("deviceId")
        group_id = frame.get("groupId")
        public_key_b64url = frame.get("publicKeyRawB64Url")
        proof = frame.get("proof")
        if not device_id or not group_id or not public_key_b64url or not proof:
            await ws.send(json.dumps({"type": "auth_failed", "reason": "missing fields"}))
            return None, None, None

        if self._device_registry.is_registered(device_id):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "device already registered"}))
            return None, None, None

        try:
            public_key_raw = b64url_decode(public_key_b64url)
        except Exception:  # noqa: BLE001 — 畸形公钥编码，一律当验证失败处理
            await ws.send(json.dumps({"type": "auth_failed", "reason": "malformed public key"}))
            return None, None, None

        if not verify_with_public_key(public_key_raw, nonce, proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "proof does not match offered public key"}))
            return None, None, None

        self._device_registry.register(device_id, public_key_raw)
        # auth_ok 同样延后到 handle_connection 里统一发（见上面 auth_response 分支的注释）
        return device_id, group_id, frame.get("inviteCode")

    async def _handle_rotate_device_key(
        self, ws: ServerConnection, nonce: str, frame: dict[str, Any]
    ) -> tuple[str | None, str | None, str | None]:
        """密钥轮换：要求同时证明"持有旧私钥"（你就是当前登记的这个设备）和
        "持有新私钥"（你不是随手指定了一个不属于自己的公钥）。任何一个证明缺失
        或验证失败都整体拒绝，注册表保持不变——不做部分更新。
        """
        assert self._device_registry is not None  # 调用方已检查过

        device_id = frame.get("deviceId")
        group_id = frame.get("groupId")
        new_public_key_b64url = frame.get("newPublicKeyRawB64Url")
        old_key_proof = frame.get("oldKeyProof")
        new_key_proof = frame.get("newKeyProof")
        if not device_id or not group_id or not new_public_key_b64url or not old_key_proof or not new_key_proof:
            await ws.send(json.dumps({"type": "auth_failed", "reason": "missing fields"}))
            return None, None, None

        current_public_key_raw = self._device_registry.lookup(device_id)
        if current_public_key_raw is None:
            await ws.send(
                json.dumps({"type": "auth_failed", "reason": "device not registered, use register_device"})
            )
            return None, None, None

        if not verify_with_public_key(current_public_key_raw, nonce, old_key_proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "invalid old key proof"}))
            return None, None, None

        try:
            new_public_key_raw = b64url_decode(new_public_key_b64url)
        except Exception:  # noqa: BLE001 — 畸形公钥编码，一律当验证失败处理
            await ws.send(json.dumps({"type": "auth_failed", "reason": "malformed new public key"}))
            return None, None, None

        if not verify_with_public_key(new_public_key_raw, nonce, new_key_proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "invalid new key proof"}))
            return None, None, None

        rotated = self._device_registry.rotate(device_id, new_public_key_raw)
        if not rotated:
            # 理论上不会走到这——上面已经确认过 lookup 不是 None——但防御性地处理，
            # 万一未来有并发场景导致设备在两次检查之间被移除。
            await ws.send(json.dumps({"type": "auth_failed", "reason": "device not registered, use register_device"}))
            return None, None, None

        # auth_ok 同样延后到 handle_connection 里统一发
        return device_id, group_id, frame.get("inviteCode")

    async def _relay_loop(self, ws: ServerConnection, device_id: str, group_id: str) -> None:
        async for raw in ws:
            try:
                frame: dict[str, Any] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue  # 静默丢弃畸形帧，不因为一条坏帧断开整个会话

            if frame.get("type") != "forward":
                continue

            # 盲中继红线：只取 ciphertextB64 字段本身转发，不解析、不检查里面是什么。
            ciphertext_b64 = frame.get("ciphertextB64")
            if ciphertext_b64 is None:
                continue

            outgoing = json.dumps(
                {"type": "forward", "fromDeviceId": device_id, "ciphertextB64": ciphertext_b64}
            )
            for peer in self._registry.members_excluding(group_id, device_id):
                try:
                    await peer.send(outgoing)
                except websockets.ConnectionClosed:
                    pass  # 对方连接已断，registry 会在它自己的 finally 里清理


async def run_server(
    verifier: DeviceVerifier,
    host: str = "127.0.0.1",
    port: int = 8765,
    device_registry: DeviceRegistry | None = None,
    invite_registry: InviteRegistry | None = None,
    membership: GroupMembership | None = None,
) -> None:
    relay = RelayServer(verifier, device_registry, invite_registry, membership)
    async with websockets.asyncio.server.serve(relay.handle_connection, host, port):
        await asyncio.Future()  # run forever

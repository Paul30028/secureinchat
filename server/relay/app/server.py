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
from app.pubkey_auth import b64url_decode, verify_with_public_key
from app.registry import RoomRegistry

logger = logging.getLogger("secureinchat.relay")


class RelayServer:
    def __init__(self, verifier: DeviceVerifier, device_registry: DeviceRegistry | None = None):
        self._verifier = verifier
        # 传了 device_registry 才支持 register_device（首次见面注册公钥）帧；
        # 用 PlaceholderHmacVerifier 联调时不需要，传 None 即可。
        self._device_registry = device_registry
        self._registry: RoomRegistry[ServerConnection] = RoomRegistry()

    async def handle_connection(self, ws: ServerConnection) -> None:
        nonce = generate_nonce()
        await ws.send(json.dumps({"type": "auth_challenge", "nonce": nonce}))

        device_id: str | None = None
        group_id: str | None = None
        try:
            device_id, group_id = await self._await_auth(ws, nonce)
            if device_id is None:
                return  # auth_failed already sent, connection will close

            self._registry.register(group_id, device_id, ws)
            await self._relay_loop(ws, device_id, group_id)
        except websockets.ConnectionClosed:
            pass
        finally:
            if device_id is not None and group_id is not None:
                self._registry.unregister(group_id, device_id)

    async def _await_auth(self, ws: ServerConnection, nonce: str) -> tuple[str | None, str | None]:
        raw = await ws.recv()
        try:
            frame: dict[str, Any] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "malformed frame"}))
            return None, None

        frame_type = frame.get("type")
        if frame_type == "register_device" and self._device_registry is not None:
            return await self._handle_register_device(ws, nonce, frame)

        if frame_type != "auth_response":
            await ws.send(
                json.dumps({"type": "auth_failed", "reason": "expected auth_response or register_device"})
            )
            return None, None

        device_id = frame.get("deviceId")
        group_id = frame.get("groupId")
        proof = frame.get("proof")
        if not device_id or not group_id or not proof:
            await ws.send(json.dumps({"type": "auth_failed", "reason": "missing fields"}))
            return None, None

        if not self._verifier.verify(device_id, nonce, proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "invalid proof"}))
            return None, None

        await ws.send(json.dumps({"type": "auth_ok"}))
        return device_id, group_id

    async def _handle_register_device(
        self, ws: ServerConnection, nonce: str, frame: dict[str, Any]
    ) -> tuple[str | None, str | None]:
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
            return None, None

        if self._device_registry.is_registered(device_id):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "device already registered"}))
            return None, None

        try:
            public_key_raw = b64url_decode(public_key_b64url)
        except Exception:  # noqa: BLE001 — 畸形公钥编码，一律当验证失败处理
            await ws.send(json.dumps({"type": "auth_failed", "reason": "malformed public key"}))
            return None, None

        if not verify_with_public_key(public_key_raw, nonce, proof):
            await ws.send(json.dumps({"type": "auth_failed", "reason": "proof does not match offered public key"}))
            return None, None

        self._device_registry.register(device_id, public_key_raw)
        await ws.send(json.dumps({"type": "auth_ok"}))
        return device_id, group_id

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
    verifier: DeviceVerifier, host: str = "127.0.0.1", port: int = 8765, device_registry: DeviceRegistry | None = None
) -> None:
    relay = RelayServer(verifier, device_registry)
    async with websockets.asyncio.server.serve(relay.handle_connection, host, port):
        await asyncio.Future()  # run forever

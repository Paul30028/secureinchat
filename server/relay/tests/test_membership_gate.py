import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.membership import GroupMembership
from app.server import RelayServer

TEST_SECRET = b"membership-gate-test-secret"


async def _authed_connect(uri: str, device_id: str, group_id: str, verifier: PlaceholderHmacVerifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    proof = verifier.expected_proof(device_id, nonce)
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    return ws, json.loads(await ws.recv())


async def test_non_member_is_rejected_even_with_valid_device_auth():
    """设备身份认证通过 ≠ 有权限进这个群——membership 检查是独立的一道关卡。"""
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    # alice 没有被加进 group-1
    relay = RelayServer(verifier, membership=membership)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    uri = f"ws://127.0.0.1:{port}"

    ws, resp = await _authed_connect(uri, "alice", "group-1", verifier)
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "not a member of this group"
    await ws.close()
    server.close()
    await server.wait_closed()


async def test_member_is_allowed_through():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    membership.add("alice", "group-1")
    relay = RelayServer(verifier, membership=membership)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    uri = f"ws://127.0.0.1:{port}"

    ws, resp = await _authed_connect(uri, "alice", "group-1", verifier)
    assert resp["type"] == "auth_ok"
    await ws.close()
    server.close()
    await server.wait_closed()


async def test_membership_is_per_group_not_global():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    membership.add("alice", "group-1")  # alice is only in group-1, not group-2
    relay = RelayServer(verifier, membership=membership)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    uri = f"ws://127.0.0.1:{port}"

    ws, resp = await _authed_connect(uri, "alice", "group-2", verifier)
    assert resp["type"] == "auth_failed"
    await ws.close()
    server.close()
    await server.wait_closed()


async def test_no_membership_registry_configured_means_no_gate_at_all():
    """向后兼容：不传 membership 时（比如现有的其它测试），完全不做这层校验，
    行为和这个切片之前一样——这是有意为之的默认值，不是遗漏。
    """
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)  # no membership passed
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    uri = f"ws://127.0.0.1:{port}"

    ws, resp = await _authed_connect(uri, "alice", "any-group-at-all", verifier)
    assert resp["type"] == "auth_ok"
    await ws.close()
    server.close()
    await server.wait_closed()

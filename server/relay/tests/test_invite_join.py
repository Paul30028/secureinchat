import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.invite_registry import InviteRegistry
from app.membership import GroupMembership
from app.server import RelayServer

TEST_SECRET = b"invite-join-test-secret"


async def _connect_with(uri: str, device_id: str, group_id: str, verifier, invite_code: str | None = None):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    proof = verifier.expected_proof(device_id, nonce)
    frame = {"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}
    if invite_code is not None:
        frame["inviteCode"] = invite_code
    await ws.send(json.dumps(frame))
    return ws, json.loads(await ws.recv())


async def _start_server(verifier, membership=None, invite_registry=None):
    relay = RelayServer(verifier, membership=membership, invite_registry=invite_registry)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    return server, f"ws://127.0.0.1:{port}"


async def test_non_member_with_valid_invite_joins_and_invite_is_consumed():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    invites = InviteRegistry()
    invites.register("CODE1", "group-1", remaining_uses=1)
    server, uri = await _start_server(verifier, membership, invites)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier, invite_code="CODE1")
    assert resp["type"] == "auth_ok"
    assert membership.is_member("alice", "group-1")

    await ws.close()
    server.close()
    await server.wait_closed()


async def test_wrong_group_invite_is_rejected_and_no_membership_granted():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    invites = InviteRegistry()
    invites.register("CODE1", "group-OTHER")  # invite is for a different group
    server, uri = await _start_server(verifier, membership, invites)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier, invite_code="CODE1")
    assert resp["type"] == "auth_failed"
    assert "invalid invite" in resp["reason"]
    assert not membership.is_member("alice", "group-1")

    await ws.close()
    server.close()
    await server.wait_closed()


async def test_non_member_without_invite_code_is_rejected_same_as_before():
    """回归：不带邀请码的非成员，行为要和这个切片之前完全一样。"""
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    invites = InviteRegistry()
    server, uri = await _start_server(verifier, membership, invites)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier)  # no invite_code
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "not a member of this group"

    await ws.close()
    server.close()
    await server.wait_closed()


async def test_existing_member_does_not_need_an_invite_code():
    """回归：已经是成员的设备，照常放行，不需要（也不会用到）邀请码。"""
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    membership.add("alice", "group-1")
    invites = InviteRegistry()
    server, uri = await _start_server(verifier, membership, invites)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier)  # no invite_code needed
    assert resp["type"] == "auth_ok"

    await ws.close()
    server.close()
    await server.wait_closed()


async def test_expired_invite_is_rejected():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    invites = InviteRegistry()
    invites.register("CODE1", "group-1", expires_at_ms=1)  # already expired (epoch=1ms)
    server, uri = await _start_server(verifier, membership, invites)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier, invite_code="CODE1")
    assert resp["type"] == "auth_failed"
    assert "expired" in resp["reason"]
    assert not membership.is_member("alice", "group-1")

    await ws.close()
    server.close()
    await server.wait_closed()


async def test_exhausted_invite_is_rejected():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    invites = InviteRegistry()
    invites.register("CODE1", "group-1", remaining_uses=1)
    server, uri = await _start_server(verifier, membership, invites)

    # First device uses it up.
    ws1, resp1 = await _connect_with(uri, "alice", "group-1", verifier, invite_code="CODE1")
    assert resp1["type"] == "auth_ok"
    await ws1.close()

    # Second device tries the same now-exhausted code.
    ws2, resp2 = await _connect_with(uri, "bob", "group-1", verifier, invite_code="CODE1")
    assert resp2["type"] == "auth_failed"
    assert "exhausted" in resp2["reason"]
    assert not membership.is_member("bob", "group-1")

    await ws2.close()
    server.close()
    await server.wait_closed()


async def test_invite_registry_not_configured_means_invite_code_is_ignored():
    """向后兼容：不配置 invite_registry 时，即使客户端带了 inviteCode 字段，
    也完全不生效——行为和没有这个功能之前一样。
    """
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    membership = GroupMembership()
    server, uri = await _start_server(verifier, membership, invite_registry=None)

    ws, resp = await _connect_with(uri, "alice", "group-1", verifier, invite_code="ANYTHING")
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "not a member of this group"

    await ws.close()
    server.close()
    await server.wait_closed()

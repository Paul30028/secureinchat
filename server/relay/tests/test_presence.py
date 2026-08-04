import asyncio
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"presence-test-secret"


@pytest.fixture
async def running_server():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", verifier
    server.close()
    await server.wait_closed()


async def _connect(uri, device_id, group_id, verifier):
    """连上并完成认证，返回 (ws, 收到的 presence 名单)"""
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    proof = verifier.expected_proof(device_id, challenge["nonce"])
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    assert json.loads(await ws.recv())["type"] == "auth_ok"
    presence = json.loads(await ws.recv())
    assert presence["type"] == "presence"
    return ws, presence["deviceIds"]


async def test_first_member_sees_an_empty_roster(running_server):
    uri, verifier = running_server
    alice, roster = await _connect(uri, "alice", "group-1", verifier)
    assert roster == []
    await alice.close()


async def test_second_member_sees_the_first_one_in_the_roster(running_server):
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    bob, roster = await _connect(uri, "bob", "group-1", verifier)

    assert roster == ["alice"]
    await alice.close()
    await bob.close()


async def test_a_new_member_does_not_appear_in_their_own_roster(running_server):
    """名单是在注册自己之前取的——否则新人会在自己的在线列表里看到自己"""
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    bob, roster = await _connect(uri, "bob", "group-1", verifier)

    assert "bob" not in roster
    await alice.close()
    await bob.close()


async def test_existing_members_are_told_when_someone_joins(running_server):
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    bob, _ = await _connect(uri, "bob", "group-1", verifier)

    event = json.loads(await asyncio.wait_for(alice.recv(), timeout=2))
    assert event == {"type": "peer_joined", "deviceId": "bob"}

    await alice.close()
    await bob.close()


async def test_existing_members_are_told_when_someone_leaves(running_server):
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    bob, _ = await _connect(uri, "bob", "group-1", verifier)
    await asyncio.wait_for(alice.recv(), timeout=2)  # bob 的 peer_joined

    await bob.close()

    event = json.loads(await asyncio.wait_for(alice.recv(), timeout=2))
    assert event == {"type": "peer_left", "deviceId": "bob"}

    await alice.close()


async def test_presence_does_not_leak_across_groups(running_server):
    """在别的群的人不该出现在你的在线名单里，也不该收到你的上下线事件"""
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    eve, eve_roster = await _connect(uri, "eve", "group-2", verifier)

    assert eve_roster == []  # alice 在别的群，不该出现

    bob, bob_roster = await _connect(uri, "bob", "group-1", verifier)
    assert bob_roster == ["alice"]  # 只有同群的

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(eve.recv(), timeout=0.3)  # eve 不该收到 group-1 的事件

    await alice.close()
    await bob.close()
    await eve.close()


async def test_roster_reflects_multiple_members(running_server):
    uri, verifier = running_server
    a, _ = await _connect(uri, "a", "group-1", verifier)
    b, _ = await _connect(uri, "b", "group-1", verifier)
    c, roster = await _connect(uri, "c", "group-1", verifier)

    assert sorted(roster) == ["a", "b"]

    await a.close()
    await b.close()
    await c.close()


async def test_presence_events_do_not_interfere_with_message_forwarding(running_server):
    uri, verifier = running_server
    alice, _ = await _connect(uri, "alice", "group-1", verifier)
    bob, _ = await _connect(uri, "bob", "group-1", verifier)
    await asyncio.wait_for(alice.recv(), timeout=2)  # 消化掉 peer_joined

    await alice.send(json.dumps({"type": "forward", "ciphertextB64": "still-works"}))
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["type"] == "forward"
    assert received["ciphertextB64"] == "still-works"

    await alice.close()
    await bob.close()

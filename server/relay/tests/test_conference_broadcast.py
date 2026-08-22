import asyncio
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"conference-test-secret"


@pytest.fixture
async def running_server():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", verifier
    server.close()
    await server.wait_closed()


async def _auth(uri, device_id, group_id, verifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    proof = verifier.expected_proof(device_id, challenge["nonce"])
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    assert json.loads(await ws.recv())["type"] == "auth_ok"
    assert json.loads(await ws.recv())["type"] == "presence"
    return ws


async def _drain_presence(ws, count):
    """消化掉 peer_joined 事件，免得干扰后面的断言"""
    for _ in range(count):
        await asyncio.wait_for(ws.recv(), timeout=2)


async def test_conference_invite_reaches_everyone_in_the_group(running_server):
    """会议邀请是"叫大家来"，发起时还不知道谁会来，所以广播而不是点对点"""
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    carol = await _auth(uri, "carol", "group-1", verifier)
    await _drain_presence(alice, 2)
    await _drain_presence(bob, 1)

    await alice.send(json.dumps({"type": "conference_invite", "conferenceId": "conf-1"}))

    for ws in (bob, carol):
        frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
        assert frame["type"] == "conference_invite"
        assert frame["conferenceId"] == "conf-1"
        assert frame["fromDeviceId"] == "alice"

    for ws in (alice, bob, carol):
        await ws.close()


async def test_the_initiator_does_not_receive_their_own_invite(running_server):
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    await _drain_presence(alice, 1)

    await alice.send(json.dumps({"type": "conference_invite", "conferenceId": "conf-1"}))
    await asyncio.wait_for(bob.recv(), timeout=2)

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(alice.recv(), timeout=0.4)

    await alice.close()
    await bob.close()


async def test_conference_invites_do_not_cross_groups(running_server):
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    outsider = await _auth(uri, "eve", "group-2", verifier)

    await alice.send(json.dumps({"type": "conference_invite", "conferenceId": "conf-1"}))

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(outsider.recv(), timeout=0.4)

    await alice.close()
    await outsider.close()


async def test_conference_end_is_broadcast_too(running_server):
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    await _drain_presence(alice, 1)

    await alice.send(json.dumps({"type": "conference_end", "conferenceId": "conf-1"}))
    frame = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert frame["type"] == "conference_end"

    await alice.close()
    await bob.close()


async def test_extra_fields_pass_through_untouched(running_server):
    """中继是盲的：除了加上发送者，不该改动任何字段"""
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    await _drain_presence(alice, 1)

    await alice.send(
        json.dumps({"type": "conference_invite", "conferenceId": "c", "opaque": "server-cannot-read-this"})
    )
    frame = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert frame["opaque"] == "server-cannot-read-this"

    await alice.close()
    await bob.close()

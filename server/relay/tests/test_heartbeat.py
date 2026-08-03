import asyncio
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"heartbeat-test-secret"


@pytest.fixture
async def running_server():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", verifier
    server.close()
    await server.wait_closed()


async def _auth(uri: str, device_id: str, group_id: str, verifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    proof = verifier.expected_proof(device_id, challenge["nonce"])
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    assert json.loads(await ws.recv())["type"] == "auth_ok"
    return ws


async def test_ping_gets_a_pong(running_server):
    uri, verifier = running_server
    ws = await _auth(uri, "alice", "group-1", verifier)

    await ws.send(json.dumps({"type": "ping"}))
    resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
    assert resp["type"] == "pong"

    await ws.close()


async def test_ping_timestamp_is_echoed_back_so_the_client_can_measure_rtt(running_server):
    uri, verifier = running_server
    ws = await _auth(uri, "alice", "group-1", verifier)

    await ws.send(json.dumps({"type": "ping", "timestamp": 1721910000000}))
    resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
    assert resp["type"] == "pong"
    assert resp["timestamp"] == 1721910000000

    await ws.close()


async def test_ping_without_timestamp_omits_it_rather_than_inventing_one(running_server):
    uri, verifier = running_server
    ws = await _auth(uri, "alice", "group-1", verifier)

    await ws.send(json.dumps({"type": "ping"}))
    resp = json.loads(await asyncio.wait_for(ws.recv(), timeout=2))
    assert "timestamp" not in resp

    await ws.close()


async def test_ping_is_not_broadcast_to_other_group_members(running_server):
    """心跳是点对点的连接维护，不该扇出给整个群——否则 N 个成员每 20 秒
    互相收到 N 条无用消息。"""
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)

    await alice.send(json.dumps({"type": "ping"}))
    await asyncio.wait_for(alice.recv(), timeout=2)  # alice gets her pong

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(bob.recv(), timeout=0.3)

    await alice.close()
    await bob.close()


async def test_connection_stays_usable_for_messages_after_pings(running_server):
    uri, verifier = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)

    for _ in range(3):
        await alice.send(json.dumps({"type": "ping"}))
        await asyncio.wait_for(alice.recv(), timeout=2)

    await alice.send(json.dumps({"type": "forward", "ciphertextB64": "still-working"}))
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["ciphertextB64"] == "still-working"

    await alice.close()
    await bob.close()

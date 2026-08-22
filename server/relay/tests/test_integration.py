import asyncio
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"integration-test-shared-secret"


async def _auth_and_get_connection(uri: str, device_id: str, group_id: str, verifier: PlaceholderHmacVerifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    assert challenge["type"] == "auth_challenge"
    nonce = challenge["nonce"]

    proof = verifier.expected_proof(device_id, nonce)
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    ack = json.loads(await ws.recv())
    assert ack["type"] == "auth_ok"
    # auth_ok 之后服务端会立刻下发一帧 presence（当前在线名单），先消化掉
    presence = json.loads(await ws.recv())
    assert presence["type"] == "presence"
    return ws


@pytest.fixture
async def running_server():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", verifier
    server.close()
    await server.wait_closed()


async def test_full_handshake_succeeds(running_server):
    uri, verifier = running_server
    ws = await _auth_and_get_connection(uri, "device-alice", "group-1", verifier)
    await ws.close()


async def test_wrong_proof_is_rejected_and_connection_closes(running_server):
    uri, _verifier = running_server
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    await ws.send(
        json.dumps({"type": "auth_response", "deviceId": "device-x", "groupId": "group-1", "proof": "wrong-proof"})
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"


async def test_ciphertext_is_forwarded_to_other_group_members_but_not_back_to_sender(running_server):
    uri, verifier = running_server
    alice = await _auth_and_get_connection(uri, "alice", "group-1", verifier)
    bob = await _auth_and_get_connection(uri, "bob", "group-1", verifier)
    # bob 上线会让 alice 收到一帧 peer_joined，先消化掉，
    # 否则下面"alice 不该收到自己消息的回声"会误判成收到了东西
    assert json.loads(await asyncio.wait_for(alice.recv(), timeout=2))["type"] == "peer_joined"

    opaque_bytes = "not-real-ciphertext-just-opaque-base64=="
    await alice.send(json.dumps({"type": "forward", "ciphertextB64": opaque_bytes}))

    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["type"] == "forward"
    assert received["fromDeviceId"] == "alice"
    assert received["ciphertextB64"] == opaque_bytes  # passed through byte-for-byte, untouched

    # alice should NOT receive her own message echoed back
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(alice.recv(), timeout=0.3)

    await alice.close()
    await bob.close()


async def test_member_outside_the_group_does_not_receive_the_message(running_server):
    uri, verifier = running_server
    alice = await _auth_and_get_connection(uri, "alice", "group-1", verifier)
    eve = await _auth_and_get_connection(uri, "eve", "group-2", verifier)  # different group

    await alice.send(json.dumps({"type": "forward", "ciphertextB64": "secret-for-group-1-only"}))

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(eve.recv(), timeout=0.3)

    await alice.close()
    await eve.close()


async def test_disconnected_member_is_removed_from_room(running_server):
    uri, verifier = running_server
    alice = await _auth_and_get_connection(uri, "alice", "group-1", verifier)
    bob = await _auth_and_get_connection(uri, "bob", "group-1", verifier)
    await bob.close()
    await asyncio.sleep(0.2)  # give the server a moment to process the close

    # Sending now should not raise even though bob is gone.
    await alice.send(json.dumps({"type": "forward", "ciphertextB64": "x"}))
    await alice.close()

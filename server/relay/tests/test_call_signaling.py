import asyncio
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"signaling-test-secret"


async def _auth_and_connect(uri: str, device_id: str, group_id: str, verifier: PlaceholderHmacVerifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    proof = verifier.expected_proof(device_id, challenge["nonce"])
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


async def test_call_invite_is_routed_to_the_target_with_sender_tagged(running_server):
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)
    bob = await _auth_and_connect(uri, "bob", "group-1", verifier)

    await alice.send(
        json.dumps({"type": "call_invite", "targetDeviceId": "bob", "callId": "call-1", "sdpOffer": "v=0..."})
    )
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["type"] == "call_invite"
    assert received["fromDeviceId"] == "alice"
    assert received["callId"] == "call-1"
    assert received["sdpOffer"] == "v=0..."

    await alice.close()
    await bob.close()


async def test_signaling_to_an_offline_target_returns_call_failed(running_server):
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)

    await alice.send(
        json.dumps({"type": "call_invite", "targetDeviceId": "bob-not-online", "callId": "call-2", "sdpOffer": "x"})
    )
    resp = json.loads(await asyncio.wait_for(alice.recv(), timeout=2))
    assert resp["type"] == "call_failed"
    assert resp["callId"] == "call-2"
    assert resp["reason"] == "target_offline"

    await alice.close()


async def test_signaling_across_groups_is_treated_as_offline_not_a_different_error(running_server):
    """目标设备在线，但在另一个群——不能拿信令当跨群探测/联系的工具，
    必须和"完全不在线"报同一个错误，不泄露额外信息。
    """
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)
    eve = await _auth_and_connect(uri, "eve", "group-2", verifier)  # different group, but online

    await alice.send(
        json.dumps({"type": "call_invite", "targetDeviceId": "eve", "callId": "call-3", "sdpOffer": "x"})
    )
    resp = json.loads(await asyncio.wait_for(alice.recv(), timeout=2))
    assert resp["type"] == "call_failed"
    assert resp["reason"] == "target_offline"  # same reason as truly-offline, not a different one

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(eve.recv(), timeout=0.3)  # eve must receive nothing at all

    await alice.close()
    await eve.close()


async def test_server_does_not_interpret_sdp_or_ice_content(running_server):
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)
    bob = await _auth_and_connect(uri, "bob", "group-1", verifier)

    garbage_sdp = "not real sdp !!! \x00\x01 binary-ish {{{"
    await alice.send(
        json.dumps({"type": "call_invite", "targetDeviceId": "bob", "callId": "call-4", "sdpOffer": garbage_sdp})
    )
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["sdpOffer"] == garbage_sdp  # passed through byte-for-byte, no validation/mangling

    await alice.close()
    await bob.close()


@pytest.mark.parametrize(
    "frame_type,extra_field",
    [
        ("call_invite", {"sdpOffer": "offer"}),
        ("call_ring", {}),
        ("call_answer", {"sdpAnswer": "answer"}),
        ("call_reject", {"reason": "declined"}),
        ("call_cancel", {}),
        ("call_hangup", {}),
        ("ice_candidate", {"candidate": "candidate:123"}),
    ],
)
async def test_all_signaling_frame_types_route_correctly(running_server, frame_type, extra_field):
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)
    bob = await _auth_and_connect(uri, "bob", "group-1", verifier)

    frame = {"type": frame_type, "targetDeviceId": "bob", "callId": "call-x", **extra_field}
    await alice.send(json.dumps(frame))
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["type"] == frame_type
    assert received["fromDeviceId"] == "alice"
    for key, value in extra_field.items():
        assert received[key] == value

    await alice.close()
    await bob.close()


async def test_malformed_signaling_frame_is_dropped_without_crashing(running_server):
    uri, verifier = running_server
    alice = await _auth_and_connect(uri, "alice", "group-1", verifier)
    bob = await _auth_and_connect(uri, "bob", "group-1", verifier)

    # Missing targetDeviceId and callId.
    await alice.send(json.dumps({"type": "call_invite", "sdpOffer": "x"}))

    # Connection should stay alive and usable afterwards — send a valid frame next.
    await alice.send(
        json.dumps({"type": "call_invite", "targetDeviceId": "bob", "callId": "call-5", "sdpOffer": "ok"})
    )
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["callId"] == "call-5"

    await alice.close()
    await bob.close()

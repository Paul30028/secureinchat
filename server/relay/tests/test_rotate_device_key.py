import json

import pytest
import websockets
import websockets.asyncio.server as ws_server
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.device_registry import DeviceRegistry
from app.pubkey_auth import PublicKeyDeviceVerifier
from app.server import RelayServer
from tests.test_register_device import LocalTestIdentity


@pytest.fixture
async def running_server():
    registry = DeviceRegistry()
    verifier = PublicKeyDeviceVerifier(registry)
    relay = RelayServer(verifier, registry)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", registry
    server.close()
    await server.wait_closed()


def _raw_public_key(identity: LocalTestIdentity) -> bytes:
    return identity._private_key.public_key().public_bytes(
        encoding=Encoding.X962, format=PublicFormat.UncompressedPoint
    )


async def _register(uri: str, device_id: str, group_id: str, identity: LocalTestIdentity) -> None:
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    await ws.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": device_id,
                "groupId": group_id,
                "publicKeyRawB64Url": identity.public_key_raw_b64url(),
                "proof": identity.sign_b64url(challenge["nonce"]),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_ok"
    await ws.close()


async def test_rotation_succeeds_with_valid_old_and_new_key_proofs(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    new_identity = LocalTestIdentity()
    await _register(uri, "device-1", "group-1", old_identity)

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    await ws.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "device-1",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": old_identity.sign_b64url(nonce),
                "newKeyProof": new_identity.sign_b64url(nonce),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_ok"
    assert registry.lookup("device-1") == _raw_public_key(new_identity)
    await ws.close()


async def test_old_key_no_longer_authenticates_after_rotation(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    new_identity = LocalTestIdentity()
    await _register(uri, "device-2", "group-1", old_identity)

    ws1 = await websockets.connect(uri)
    c1 = json.loads(await ws1.recv())
    await ws1.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "device-2",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": old_identity.sign_b64url(c1["nonce"]),
                "newKeyProof": new_identity.sign_b64url(c1["nonce"]),
            }
        )
    )
    assert json.loads(await ws1.recv())["type"] == "auth_ok"
    await ws1.close()

    ws2 = await websockets.connect(uri)
    c2 = json.loads(await ws2.recv())
    await ws2.send(
        json.dumps(
            {
                "type": "auth_response",
                "deviceId": "device-2",
                "groupId": "group-1",
                "proof": old_identity.sign_b64url(c2["nonce"]),
            }
        )
    )
    resp2 = json.loads(await ws2.recv())
    assert resp2["type"] == "auth_failed"
    await ws2.close()


async def test_new_key_authenticates_after_rotation(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    new_identity = LocalTestIdentity()
    await _register(uri, "device-3", "group-1", old_identity)

    ws1 = await websockets.connect(uri)
    c1 = json.loads(await ws1.recv())
    await ws1.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "device-3",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": old_identity.sign_b64url(c1["nonce"]),
                "newKeyProof": new_identity.sign_b64url(c1["nonce"]),
            }
        )
    )
    assert json.loads(await ws1.recv())["type"] == "auth_ok"
    await ws1.close()

    ws2 = await websockets.connect(uri)
    c2 = json.loads(await ws2.recv())
    await ws2.send(
        json.dumps(
            {
                "type": "auth_response",
                "deviceId": "device-3",
                "groupId": "group-1",
                "proof": new_identity.sign_b64url(c2["nonce"]),
            }
        )
    )
    resp2 = json.loads(await ws2.recv())
    assert resp2["type"] == "auth_ok"
    await ws2.close()


async def test_rotation_rejected_without_valid_old_key_proof(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    attacker = LocalTestIdentity()
    new_identity = LocalTestIdentity()
    await _register(uri, "device-4", "group-1", old_identity)
    original_key = registry.lookup("device-4")

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    await ws.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "device-4",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": attacker.sign_b64url(nonce),
                "newKeyProof": new_identity.sign_b64url(nonce),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "invalid old key proof"
    assert registry.lookup("device-4") == original_key
    await ws.close()


async def test_rotation_rejected_without_valid_new_key_proof(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    new_identity = LocalTestIdentity()
    someone_else = LocalTestIdentity()
    await _register(uri, "device-5", "group-1", old_identity)
    original_key = registry.lookup("device-5")

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    await ws.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "device-5",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": old_identity.sign_b64url(nonce),
                "newKeyProof": someone_else.sign_b64url(nonce),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "invalid new key proof"
    assert registry.lookup("device-5") == original_key
    await ws.close()


async def test_rotation_rejected_for_unregistered_device(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    new_identity = LocalTestIdentity()

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]
    await ws.send(
        json.dumps(
            {
                "type": "rotate_device_key",
                "deviceId": "never-registered",
                "groupId": "group-1",
                "newPublicKeyRawB64Url": new_identity.public_key_raw_b64url(),
                "oldKeyProof": old_identity.sign_b64url(nonce),
                "newKeyProof": new_identity.sign_b64url(nonce),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert resp["reason"] == "device not registered, use register_device"
    assert not registry.is_registered("never-registered")
    await ws.close()


async def test_malformed_rotate_frame_is_rejected_without_crashing(running_server):
    uri, registry = running_server
    old_identity = LocalTestIdentity()
    await _register(uri, "device-6", "group-1", old_identity)
    original_key = registry.lookup("device-6")

    ws = await websockets.connect(uri)
    await ws.recv()  # challenge
    await ws.send(json.dumps({"type": "rotate_device_key", "deviceId": "device-6"}))
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert registry.lookup("device-6") == original_key
    await ws.close()

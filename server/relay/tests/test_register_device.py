import asyncio
import base64
import json

import pytest
import websockets
import websockets.asyncio.server as ws_server
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.device_registry import DeviceRegistry
from app.pubkey_auth import PublicKeyDeviceVerifier
from app.server import RelayServer


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _der_to_p1363(der_sig: bytes) -> bytes:
    r, s = decode_dss_signature(der_sig)
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


class LocalTestIdentity:
    """测试用的本地"设备"：生成密钥对、能对 nonce 签名、能导出公钥——
    模拟真实 Android 设备会做的事，只是在 Python 里用 `cryptography` 而不是
    走 crypto-core，因为这里测的是服务端注册流程本身，不是重复测跨语言互操作
    （那个在 test_pubkey_auth.py 里已经用真实 TS fixture 测过了）。
    """

    def __init__(self):
        self._private_key = ec.generate_private_key(ec.SECP256R1())

    def public_key_raw_b64url(self) -> str:
        raw = self._private_key.public_key().public_bytes(
            encoding=Encoding.X962, format=PublicFormat.UncompressedPoint
        )
        return _b64url_encode(raw)

    def sign_b64url(self, message: str) -> str:
        der_sig = self._private_key.sign(message.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        return _b64url_encode(_der_to_p1363(der_sig))


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


async def test_first_registration_succeeds_and_connects(running_server):
    uri, registry = running_server
    identity = LocalTestIdentity()

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    nonce = challenge["nonce"]

    await ws.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": "device-new",
                "groupId": "group-1",
                "publicKeyRawB64Url": identity.public_key_raw_b64url(),
                "proof": identity.sign_b64url(nonce),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_ok"
    assert registry.is_registered("device-new")
    await ws.close()


async def test_registering_an_already_registered_device_id_is_rejected(running_server):
    """核心防御场景：不能有人拿别人已经注册过的 deviceId，塞一把新公钥进来
    冒充成那个设备——即使他们能对 nonce 正确签名（用自己的私钥），服务端也
    必须因为 deviceId 已被占用而拒绝，不能覆盖。
    """
    uri, registry = running_server
    original_owner = LocalTestIdentity()
    attacker = LocalTestIdentity()

    ws1 = await websockets.connect(uri)
    challenge1 = json.loads(await ws1.recv())
    await ws1.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": "device-victim",
                "groupId": "group-1",
                "publicKeyRawB64Url": original_owner.public_key_raw_b64url(),
                "proof": original_owner.sign_b64url(challenge1["nonce"]),
            }
        )
    )
    ok1 = json.loads(await ws1.recv())
    assert ok1["type"] == "auth_ok"
    original_key = registry.lookup("device-victim")

    ws2 = await websockets.connect(uri)
    challenge2 = json.loads(await ws2.recv())
    await ws2.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": "device-victim",
                "groupId": "group-1",
                "publicKeyRawB64Url": attacker.public_key_raw_b64url(),
                "proof": attacker.sign_b64url(challenge2["nonce"]),
            }
        )
    )
    resp2 = json.loads(await ws2.recv())
    assert resp2["type"] == "auth_failed"
    assert resp2["reason"] == "device already registered"
    assert registry.lookup("device-victim") == original_key

    await ws1.close()
    await ws2.close()


async def test_registration_requires_proof_of_possession_of_the_offered_key(running_server):
    uri, registry = running_server
    real_owner = LocalTestIdentity()
    someone_else = LocalTestIdentity()

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    await ws.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": "device-x",
                "groupId": "group-1",
                "publicKeyRawB64Url": real_owner.public_key_raw_b64url(),
                "proof": someone_else.sign_b64url(challenge["nonce"]),
            }
        )
    )
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert not registry.is_registered("device-x")
    await ws.close()


async def test_after_registration_can_reconnect_with_auth_response(running_server):
    uri, registry = running_server
    identity = LocalTestIdentity()

    ws1 = await websockets.connect(uri)
    c1 = json.loads(await ws1.recv())
    await ws1.send(
        json.dumps(
            {
                "type": "register_device",
                "deviceId": "device-returning",
                "groupId": "group-1",
                "publicKeyRawB64Url": identity.public_key_raw_b64url(),
                "proof": identity.sign_b64url(c1["nonce"]),
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
                "deviceId": "device-returning",
                "groupId": "group-1",
                "proof": identity.sign_b64url(c2["nonce"]),
            }
        )
    )
    resp2 = json.loads(await ws2.recv())
    assert resp2["type"] == "auth_ok"
    await ws2.close()


async def test_malformed_register_device_frame_is_rejected_without_crashing(running_server):
    uri, registry = running_server
    ws = await websockets.connect(uri)
    await ws.recv()  # challenge
    await ws.send(json.dumps({"type": "register_device", "deviceId": "device-y"}))  # missing fields
    resp = json.loads(await ws.recv())
    assert resp["type"] == "auth_failed"
    assert not registry.is_registered("device-y")
    await ws.close()

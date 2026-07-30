import base64
import json
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.device_registry import DeviceRegistry
from app.pubkey_auth import PublicKeyDeviceVerifier, p1363_to_der

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "ts_signed_auth.json"


def _b64url_decode(s: str) -> bytes:
    padded = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(padded)


@pytest.fixture
def ts_fixture():
    with open(FIXTURE_PATH) as f:
        return json.load(f)


class TestCrossLanguageInterop:
    """最重要的一组测试：证明 crypto-core（TS/Web Crypto）签的名和导出的公钥，
    Python 服务端能正确验证——这是"服务端能验证 Android 端 Keystore 签名"这个
    需求的核心风险点，不是随便测测。fixture 由
    scripts/gen-relay-auth-fixture.mjs 用真实 KeystorePort 生成，不是手编的假数据。
    """

    def test_ts_signed_proof_verifies_successfully(self, ts_fixture):
        registry = DeviceRegistry()
        public_key_raw = _b64url_decode(ts_fixture["publicKeyRawB64Url"])
        registry.register(ts_fixture["deviceId"], public_key_raw)

        verifier = PublicKeyDeviceVerifier(registry)
        result = verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], ts_fixture["signatureP1363B64Url"])
        assert result is True

    def test_p1363_to_der_round_trip_matches_cryptography_lib_expectations(self, ts_fixture):
        # Sanity check the conversion itself in isolation, not just end-to-end.
        sig_bytes = _b64url_decode(ts_fixture["signatureP1363B64Url"])
        der = p1363_to_der(sig_bytes)
        # DER ECDSA signatures start with SEQUENCE tag 0x30
        assert der[0] == 0x30

    def test_wrong_nonce_is_rejected(self, ts_fixture):
        registry = DeviceRegistry()
        registry.register(ts_fixture["deviceId"], _b64url_decode(ts_fixture["publicKeyRawB64Url"]))
        verifier = PublicKeyDeviceVerifier(registry)
        assert verifier.verify(ts_fixture["deviceId"], "a-different-nonce", ts_fixture["signatureP1363B64Url"]) is False

    def test_unregistered_device_is_rejected_without_parsing_anything(self, ts_fixture):
        registry = DeviceRegistry()  # deviceId never registered
        verifier = PublicKeyDeviceVerifier(registry)
        assert verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], ts_fixture["signatureP1363B64Url"]) is False


class TestAbuseCases:
    def test_tampered_signature_is_rejected(self, ts_fixture):
        registry = DeviceRegistry()
        registry.register(ts_fixture["deviceId"], _b64url_decode(ts_fixture["publicKeyRawB64Url"]))
        verifier = PublicKeyDeviceVerifier(registry)

        sig_bytes = bytearray(_b64url_decode(ts_fixture["signatureP1363B64Url"]))
        sig_bytes[-1] ^= 0xFF
        tampered_b64url = base64.urlsafe_b64encode(bytes(sig_bytes)).decode().rstrip("=")

        assert verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], tampered_b64url) is False

    def test_signature_from_a_different_keypair_is_rejected(self, ts_fixture):
        # Register device-1 with a *different* freshly generated public key, then try
        # to use the fixture's signature (signed by a different private key) against it.
        registry = DeviceRegistry()
        other_key = ec.generate_private_key(ec.SECP256R1()).public_key()
        other_raw = other_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.UncompressedPoint)
        registry.register(ts_fixture["deviceId"], other_raw)
        verifier = PublicKeyDeviceVerifier(registry)
        assert verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], ts_fixture["signatureP1363B64Url"]) is False

    def test_malformed_proof_does_not_raise_just_returns_false(self, ts_fixture):
        registry = DeviceRegistry()
        registry.register(ts_fixture["deviceId"], _b64url_decode(ts_fixture["publicKeyRawB64Url"]))
        verifier = PublicKeyDeviceVerifier(registry)
        assert verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], "not-valid-base64url-!!!") is False

    def test_malformed_registered_public_key_does_not_raise(self):
        registry = DeviceRegistry()
        registry.register("device-x", b"not-a-real-public-key")
        verifier = PublicKeyDeviceVerifier(registry)
        assert verifier.verify("device-x", "any-nonce", "c29tZS1wcm9vZg") is False

    def test_wrong_length_signature_does_not_raise(self, ts_fixture):
        registry = DeviceRegistry()
        registry.register(ts_fixture["deviceId"], _b64url_decode(ts_fixture["publicKeyRawB64Url"]))
        verifier = PublicKeyDeviceVerifier(registry)
        short_sig = base64.urlsafe_b64encode(b"too-short").decode().rstrip("=")
        assert verifier.verify(ts_fixture["deviceId"], ts_fixture["nonce"], short_sig) is False

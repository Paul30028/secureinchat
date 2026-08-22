"""基于 Android/Web Crypto Keystore 签名的真实设备验证。

替代 auth.py 里的 PlaceholderHmacVerifier（共享密钥方案）。这里验证的是客户端用
Keystore 私钥对 nonce 签的名，服务端只需要知道对应的公钥（公钥不是秘密）。

格式说明（这是跨语言签名验证最容易踩坑的地方，写清楚免得以后忘）：
- 公钥：Web Crypto `exportKey("raw", ...)` 导出的未压缩点格式，65 字节，
  第一字节固定 0x04，后面 32+32 字节是 X、Y 坐标。
- 签名：Web Crypto ECDSA sign 输出是 IEEE P1363 格式（r||s 各 32 字节，共 64 字节），
  不是 DER！`cryptography` 库的 verify() 要吃 DER，所以要先转换。
- proof 字段在线上协议里是这段 P1363 签名的 base64url 编码。
"""
from __future__ import annotations

import base64

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from app.device_registry import DeviceRegistry

P256_COORDINATE_BYTES = 32


def b64url_decode(s: str) -> bytes:
    padded = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(padded)


def p1363_to_der(signature_p1363: bytes) -> bytes:
    """把 Web Crypto 的 r||s 格式转成 cryptography 库要的 DER 格式。"""
    if len(signature_p1363) != 2 * P256_COORDINATE_BYTES:
        raise ValueError(f"P1363 签名长度应为 {2 * P256_COORDINATE_BYTES} 字节，实际为 {len(signature_p1363)}")
    r = int.from_bytes(signature_p1363[:P256_COORDINATE_BYTES], byteorder="big")
    s = int.from_bytes(signature_p1363[P256_COORDINATE_BYTES:], byteorder="big")
    return encode_dss_signature(r, s)


def verify_with_public_key(public_key_raw: bytes, nonce: str, proof: str) -> bool:
    """验证 nonce 的签名是否匹配给定的公钥——不查注册表，只做纯粹的密码学验证。
    供 PublicKeyDeviceVerifier（查注册表）和 register_device 的"自证持有私钥"
    两个场景复用，避免两处各写一遍格式转换逻辑。
    """
    try:
        public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), public_key_raw)
        signature_der = p1363_to_der(b64url_decode(proof))
    except Exception:  # noqa: BLE001 — 任何格式/解析错误都视为验证失败，不上抛给调用方
        return False

    try:
        public_key.verify(signature_der, nonce.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


class PublicKeyDeviceVerifier:
    """真正的设备身份验证：ECDSA P-256 + SHA-256，公钥来自 DeviceRegistry。"""

    def __init__(self, registry: DeviceRegistry):
        self._registry = registry

    def verify(self, device_id: str, nonce: str, proof: str) -> bool:
        public_key_raw = self._registry.lookup(device_id)
        if public_key_raw is None:
            return False  # 未注册的设备，直接拒绝，不尝试解析
        return verify_with_public_key(public_key_raw, nonce, proof)

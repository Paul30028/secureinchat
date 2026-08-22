"""认证握手：challenge 生成 + 可替换的验证接口。

⚠️ 这里的 PlaceholderHmacVerifier 只用共享密钥做 HMAC，仅供本地测试和集成测试用。
真实实现要验证 Android 端 Keystore 私钥签的证明，接口留在这里但真实实现属于
后续切片——不能把这个测试桩直接部署到生产。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
from typing import Protocol


def generate_nonce(num_bytes: int = 16) -> str:
    return base64.urlsafe_b64encode(os.urandom(num_bytes)).decode("ascii").rstrip("=")


class DeviceVerifier(Protocol):
    """校验"某个 deviceId 对某个 nonce 的证明是否有效"。真实实现在 Android 端用
    Keystore 私钥签名，服务端用对应公钥验证——服务端永远不持有私钥。"""

    def verify(self, device_id: str, nonce: str, proof: str) -> bool: ...


class PlaceholderHmacVerifier:
    """⚠️ 仅供测试。用一个共享密钥做 HMAC，不代表真实的设备身份验证方案。"""

    def __init__(self, shared_test_secret: bytes):
        self._secret = shared_test_secret

    def expected_proof(self, device_id: str, nonce: str) -> str:
        mac = hmac.new(self._secret, f"{device_id}:{nonce}".encode("utf-8"), hashlib.sha256)
        return base64.urlsafe_b64encode(mac.digest()).decode("ascii").rstrip("=")

    def verify(self, device_id: str, nonce: str, proof: str) -> bool:
        expected = self.expected_proof(device_id, nonce)
        # 用常数时间比较，避免时序侧信道泄露 proof 的正确前缀长度
        return hmac.compare_digest(expected, proof)

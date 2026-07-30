"""设备注册表：deviceId -> 公钥原始字节（未压缩点格式）。

公钥怎么进到这张表里（邀请环节的注册流程）不在本切片范围内——这里只提供
"已经知道公钥，怎么用它验证签名"这一段。真实的注册流程是后续切片。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DeviceRegistry:
    _public_keys: dict[str, bytes] = field(default_factory=dict)

    def register(self, device_id: str, public_key_raw: bytes) -> None:
        self._public_keys[device_id] = public_key_raw

    def lookup(self, device_id: str) -> bytes | None:
        return self._public_keys.get(device_id)

    def is_registered(self, device_id: str) -> bool:
        return device_id in self._public_keys

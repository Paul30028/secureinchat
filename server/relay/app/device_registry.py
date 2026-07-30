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

    def rotate(self, device_id: str, new_public_key_raw: bytes) -> bool:
        """换公钥——要求设备已经注册过。和 register() 的语义故意分开：
        register() 用于"从没见过这个 deviceId"，rotate() 用于"已经认识，换把钥匙"。
        谁来验证"调用者真的有权做这次轮换"不是这个类的职责（那是 pubkey_auth /
        server.py 的事），这里只负责"未注册时不允许 rotate"这一条数据层面的红线。
        返回 False 表示设备未注册，调用方应该按错误处理，不能静默创建。
        """
        if device_id not in self._public_keys:
            return False
        self._public_keys[device_id] = new_public_key_raw
        return True

    def lookup(self, device_id: str) -> bytes | None:
        return self._public_keys.get(device_id)

    def is_registered(self, device_id: str) -> bool:
        return device_id in self._public_keys

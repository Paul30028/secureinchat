"""成员关系：deviceId 通过邀请码成功加入过哪些 groupId。

跟 registry.py 的 RoomRegistry 是两件事：RoomRegistry 是"当前这一刻谁的连接
在线"（连接断开就没了），这里是"这个设备到底有没有资格加入这个群"（跨连接持久，
虽然目前实现还是纯内存——真正的持久化留给后续切片接数据库）。
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class GroupMembership:
    _memberships: dict[str, set[str]] = field(default_factory=dict)  # deviceId -> {groupId, ...}

    def add(self, device_id: str, group_id: str) -> None:
        self._memberships.setdefault(device_id, set()).add(group_id)

    def is_member(self, device_id: str, group_id: str) -> bool:
        return group_id in self._memberships.get(device_id, set())

    def remove(self, device_id: str, group_id: str) -> None:
        """成员被移除（第十三节管理员逻辑）。这个方法先留着给未来切片用，
        这次不接线到 server.py 里——移除逻辑还需要 epoch 轮换配合，属于更大的功能。
        """
        self._memberships.get(device_id, set()).discard(group_id)

"""房间注册表——盲中继的核心状态：纯内存、按 groupId 分房间、进程重启即清空。

这个模块故意不知道 WebSocket、JSON、认证是什么，只管"哪个 deviceId 的连接对象
属于哪个 groupId"，方便脱离真实网络做单元测试。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Generic, Hashable, TypeVar

ConnectionT = TypeVar("ConnectionT")


@dataclass
class RoomRegistry(Generic[ConnectionT]):
    """groupId -> {deviceId: connection}。不做持久化，不写盘。"""

    _rooms: dict[str, dict[str, ConnectionT]] = field(default_factory=dict)

    def register(self, group_id: str, device_id: str, connection: ConnectionT) -> None:
        room = self._rooms.setdefault(group_id, {})
        room[device_id] = connection

    def unregister(self, group_id: str, device_id: str) -> None:
        room = self._rooms.get(group_id)
        if room is None:
            return
        room.pop(device_id, None)
        if not room:
            # 房间空了就整体删掉，避免长期运行后累积大量空字典
            del self._rooms[group_id]

    def members_excluding(self, group_id: str, exclude_device_id: str) -> list[ConnectionT]:
        room = self._rooms.get(group_id, {})
        return [conn for device_id, conn in room.items() if device_id != exclude_device_id]

    def member_count(self, group_id: str) -> int:
        return len(self._rooms.get(group_id, {}))

    def room_count(self) -> int:
        """当前有多少个非空房间——供健康检查/诊断用，不暴露具体是哪些群。"""
        return len(self._rooms)

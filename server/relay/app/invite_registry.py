"""邀请码校验。邀请码怎么被管理员生成、分发（第十三节的邀请码管理）不在这个
切片范围内——这里只管"已经存在一个邀请码，怎么校验它、消耗它"。

字段设计对应 packages/protocol 里 SIC2 邀请串解析出来的 ParsedInvite：
epoch 这次先不用（epoch 是群密钥轮换用的，跟"能不能加群"是两件事），
但 groupId / expiresAtMs / remainingUses 三个字段的校验语义要和客户端一致。
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class InviteRecord:
    group_id: str
    expires_at_ms: int | None = None
    remaining_uses: int | None = None  # None 表示不限次数


@dataclass
class InviteRegistry:
    _invites: dict[str, InviteRecord] = field(default_factory=dict)

    def register(
        self, server_join_code: str, group_id: str, expires_at_ms: int | None = None, remaining_uses: int | None = None
    ) -> None:
        self._invites[server_join_code] = InviteRecord(group_id, expires_at_ms, remaining_uses)

    def validate_and_consume(
        self, server_join_code: str, claimed_group_id: str, now_ms: int | None = None
    ) -> tuple[bool, str]:
        """返回 (是否通过, 原因)。通过时会真的消耗一次使用次数——调用方应该只在
        真正要用这个邀请码完成加群时才调用，不要用来"预检查"，否则会白白消耗。
        """
        record = self._invites.get(server_join_code)
        if record is None:
            return False, "invite not found"

        if record.group_id != claimed_group_id:
            return False, "invite does not match group"

        effective_now = now_ms if now_ms is not None else int(time.time() * 1000)
        if record.expires_at_ms is not None and effective_now > record.expires_at_ms:
            return False, "invite expired"

        if record.remaining_uses is not None:
            if record.remaining_uses <= 0:
                return False, "invite exhausted"
            record.remaining_uses -= 1

        return True, "ok"

"""限流。

试用中继的地址一旦泄露，没有任何防护的话会被当免费带宽用掉。这里做两层：

1. **连接尝试限流**（按来源 IP）：防止有人不停重连暴力尝试认证。
2. **消息速率限流**（按已认证的设备）：防止单个设备刷屏或灌流量。

刻意不做的：
- 不封禁 IP。中国的移动网络大量用户共享出口 IP，封一个可能连坐一片人。
  超限只是拒绝这一次，等窗口过去自然恢复。
- 不做全局总量限制。那需要区分"很多人正常用"和"一个人在滥用"，
  按设备限流已经覆盖了后者。
"""
from __future__ import annotations

import time
from collections import deque


class SlidingWindowLimiter:
    """滑动窗口计数器。

    比固定窗口准确：固定窗口在边界上允许两倍的量（窗口末尾打满 + 下个窗口
    开头再打满），对限流来说那是个真实的漏洞。
    """

    def __init__(self, max_events: int, window_seconds: float) -> None:
        if max_events <= 0:
            raise ValueError("max_events 必须大于 0")
        if window_seconds <= 0:
            raise ValueError("window_seconds 必须大于 0")
        self._max_events = max_events
        self._window = window_seconds
        self._events: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float | None = None) -> bool:
        """记录一次事件并返回是否放行。超限时不记录——否则持续冲击会让
        窗口永远填满，正常流量恢复后也解不开。"""
        now = time.monotonic() if now is None else now
        bucket = self._events.setdefault(key, deque())

        cutoff = now - self._window
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= self._max_events:
            return False

        bucket.append(now)
        return True

    def forget(self, key: str) -> None:
        """连接断开时清掉，避免长期运行后 key 无限增长"""
        self._events.pop(key, None)

    def active_keys(self) -> int:
        return len(self._events)


# 认证之前，同一个来源 30 秒内最多 60 次连接尝试。
#
# 原来定的是 10 次，太紧了：一家人或一个办公室共用一个出口 IP，几个人同时
# 打开应用、或者一个人切了几次网络，就会互相把对方挤掉——限流打到正常用户
# 身上，比不限还糟。60 次仍然拦得住脚本级的暴力尝试（那种是每秒几十上百次），
# 但正常使用怎么折腾都碰不到。
CONNECTION_ATTEMPTS = 60
CONNECTION_WINDOW_SECONDS = 30.0

# 认证之后，单个设备每秒最多 30 条消息。
# 发一个大文件会连续发很多分片，所以不能设得太紧——一首诗歌几十上百片，
# 30/秒 意味着几秒钟发完，正常使用不会碰到。
MESSAGES_PER_DEVICE = 30
MESSAGE_WINDOW_SECONDS = 1.0


def make_connection_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(CONNECTION_ATTEMPTS, CONNECTION_WINDOW_SECONDS)


def make_message_limiter() -> SlidingWindowLimiter:
    return SlidingWindowLimiter(MESSAGES_PER_DEVICE, MESSAGE_WINDOW_SECONDS)

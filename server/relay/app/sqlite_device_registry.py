"""持久化的设备注册表。

为什么必须持久化：内存态的注册表在进程重启后是空的，也就是说 TOFU
（Trust-On-First-Use）保护每次重启都被重置一次。攻击者只要等一次重启，
就能抢先用别人的 deviceId 注册自己的公钥——那正是 TOFU 要防的事。
重连体验只是顺带，安全才是主要原因。

用 SQLite 单文件，不引入额外的服务：部署方式不变，仍然是
`python main.py` + systemd。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    public_key BLOB NOT NULL,
    registered_at REAL NOT NULL
);
"""


class SqliteDeviceRegistry:
    """和 DeviceRegistry 接口一致，可以直接替换。

    每次操作开一个连接：中继的注册/查询频率很低（只在握手时发生），
    换来的是不用考虑跨 asyncio 任务共享连接的线程安全问题。
    """

    def __init__(self, db_path: str | Path) -> None:
        self._path = str(db_path)
        parent = Path(self._path).parent
        if str(parent) not in ("", "."):
            parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        # 断电时不要留下半写的数据库
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def register(self, device_id: str, public_key_raw: bytes) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO devices (device_id, public_key, registered_at) "
                "VALUES (?, ?, strftime('%s','now'))",
                (device_id, public_key_raw),
            )

    def rotate(self, device_id: str, new_public_key_raw: bytes) -> bool:
        """未注册的设备不允许 rotate——和内存版一样，这是数据层的红线。
        静默创建会让"轮换"变成"抢注"的旁路。"""
        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE devices SET public_key = ? WHERE device_id = ?",
                (new_public_key_raw, device_id),
            )
            return cursor.rowcount > 0

    def lookup(self, device_id: str) -> bytes | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT public_key FROM devices WHERE device_id = ?", (device_id,)
            ).fetchone()
        return bytes(row[0]) if row else None

    def is_registered(self, device_id: str) -> bool:
        return self.lookup(device_id) is not None

    def count(self) -> int:
        with self._connect() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0])

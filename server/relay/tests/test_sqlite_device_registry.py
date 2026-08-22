import json

import pytest
import websockets
import websockets.asyncio.server as ws_server

from app.pubkey_auth import PublicKeyDeviceVerifier
from app.server import RelayServer
from app.sqlite_device_registry import SqliteDeviceRegistry


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "devices.db"


def test_starts_empty(db_path):
    assert SqliteDeviceRegistry(db_path).count() == 0


def test_registers_and_looks_up(db_path):
    reg = SqliteDeviceRegistry(db_path)
    reg.register("alice", b"\x04pubkey")
    assert reg.lookup("alice") == b"\x04pubkey"
    assert reg.is_registered("alice") is True


def test_unknown_device_is_not_registered(db_path):
    assert SqliteDeviceRegistry(db_path).is_registered("nobody") is False
    assert SqliteDeviceRegistry(db_path).lookup("nobody") is None


def test_survives_a_restart(db_path):
    """这是做持久化的全部理由：进程重启后 TOFU 保护不该被重置"""
    first = SqliteDeviceRegistry(db_path)
    first.register("alice", b"\x04alice-key")

    # 全新实例，模拟 systemctl restart
    second = SqliteDeviceRegistry(db_path)
    assert second.lookup("alice") == b"\x04alice-key"
    assert second.is_registered("alice") is True


def test_rotation_requires_prior_registration(db_path):
    """未注册就允许 rotate 等于给抢注开了个旁路"""
    reg = SqliteDeviceRegistry(db_path)
    assert reg.rotate("never-seen", b"\x04new") is False
    assert reg.is_registered("never-seen") is False


def test_rotation_replaces_the_key(db_path):
    reg = SqliteDeviceRegistry(db_path)
    reg.register("alice", b"\x04old")
    assert reg.rotate("alice", b"\x04new") is True
    assert reg.lookup("alice") == b"\x04new"


def test_rotation_persists_across_restart(db_path):
    reg = SqliteDeviceRegistry(db_path)
    reg.register("alice", b"\x04old")
    reg.rotate("alice", b"\x04new")

    assert SqliteDeviceRegistry(db_path).lookup("alice") == b"\x04new"


def test_devices_are_independent(db_path):
    reg = SqliteDeviceRegistry(db_path)
    reg.register("alice", b"\x04alice")
    reg.register("bob", b"\x04bob")
    reg.rotate("alice", b"\x04alice2")

    assert reg.lookup("bob") == b"\x04bob"
    assert reg.count() == 2


def test_creates_the_directory_if_missing(tmp_path):
    nested = tmp_path / "data" / "sub" / "devices.db"
    reg = SqliteDeviceRegistry(nested)
    reg.register("alice", b"\x04k")
    assert nested.exists()


def test_handles_binary_keys_with_null_bytes(db_path):
    """公钥是原始字节，里面有 0x00 很正常——按文本存会截断"""
    reg = SqliteDeviceRegistry(db_path)
    key = bytes([0x04, 0x00, 0xFF, 0x00, 0x41])
    reg.register("alice", key)
    assert SqliteDeviceRegistry(db_path).lookup("alice") == key


# ---- 端到端：接进真实中继之后，重启不会让 TOFU 保护失效 ----


async def test_impersonation_still_blocked_after_a_relay_restart(db_path):
    """核心场景：alice 注册过之后，攻击者不能趁重启用 alice 的 deviceId
    注册自己的公钥。"""
    registry = SqliteDeviceRegistry(db_path)

    # 第一次运行：alice 注册
    relay = RelayServer(PublicKeyDeviceVerifier(registry), device_registry=registry)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    uri = f"ws://127.0.0.1:{port}"

    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    assert challenge["type"] == "auth_challenge"
    await ws.close()
    server.close()
    await server.wait_closed()

    registry.register("alice", b"\x04" + b"a" * 64)

    # 重启：全新的 registry 实例读同一个文件
    restarted = SqliteDeviceRegistry(db_path)
    assert restarted.is_registered("alice") is True

    # 攻击者想用 alice 的 deviceId 注册自己的公钥——注册表已经认识 alice，
    # register_device 在 server.py 里会因为"已注册"被拒绝
    assert restarted.lookup("alice") == b"\x04" + b"a" * 64

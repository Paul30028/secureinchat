"""本地开发用入口——不是生产部署脚本。

默认用 PublicKeyDeviceVerifier + DeviceRegistry（真实方向：ECDSA 设备认证 +
TOFU 首次注册）。生产环境的限流、监控、持久化注册表都还没做，不要直接拿这个跑生产。

注意：这里故意不传 membership/invite_registry——App 端目前还没有真正走
"用邀请码加群"这个服务端流程（第九节非目标里写清楚了），如果这里配了成员资格
校验，TOFU 注册完还是会被"不是群成员"挡下来，等于把整条演示链路堵死。
先保持"注册了就能收发"这个宽松状态，成员资格收紧是明确的后续切片。
"""
import asyncio
import os

from app.device_registry import DeviceRegistry
from app.pubkey_auth import PublicKeyDeviceVerifier
from app.server import run_server
from app.sqlite_device_registry import SqliteDeviceRegistry

if __name__ == "__main__":
    port = int(os.environ.get("SECUREINCHAT_RELAY_PORT", "8765"))

    # 设备注册表默认持久化到 SQLite 文件。内存态的话每次重启 TOFU 保护都被
    # 重置一次——攻击者等一次重启就能抢注别人的 deviceId，那正是 TOFU 要防的。
    # 设 SECUREINCHAT_DEVICE_DB=":memory:" 可以退回旧行为（仅用于临时联调）。
    db_path = os.environ.get("SECUREINCHAT_DEVICE_DB", "devices.db")
    if db_path == ":memory:":
        registry = DeviceRegistry()
        print("设备注册表：内存态（重启后清空，仅供联调）")
    else:
        registry = SqliteDeviceRegistry(db_path)
        print(f"设备注册表：{db_path}（已注册 {registry.count()} 台设备）")
    verifier = PublicKeyDeviceVerifier(registry)
    print(f"开发用中继监听 ws://127.0.0.1:{port} （仅供本地联调，见 README.md）")
    print("设备认证：ECDSA P-256 + TOFU 首次注册（register_device 帧）")
    print("READY", flush=True)  # 供集成测试探测启动完成
    asyncio.run(run_server(verifier, host="127.0.0.1", port=port, device_registry=registry))

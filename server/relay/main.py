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

if __name__ == "__main__":
    port = int(os.environ.get("SECUREINCHAT_RELAY_PORT", "8765"))
    registry = DeviceRegistry()
    verifier = PublicKeyDeviceVerifier(registry)
    print(f"开发用中继监听 ws://127.0.0.1:{port} （仅供本地联调，见 README.md）")
    print("设备认证：ECDSA P-256 + TOFU 首次注册（register_device 帧）")
    print("READY", flush=True)  # 供集成测试探测启动完成
    asyncio.run(run_server(verifier, host="127.0.0.1", port=port, device_registry=registry))

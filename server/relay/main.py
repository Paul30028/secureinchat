"""本地开发用入口——不是生产部署脚本。

默认用 PublicKeyDeviceVerifier + DeviceRegistry（真实方向：ECDSA 设备认证 +
TOFU 首次注册）。生产环境的限流、监控、持久化注册表都还没做，不要直接拿这个跑生产。
"""
import asyncio

from app.device_registry import DeviceRegistry
from app.pubkey_auth import PublicKeyDeviceVerifier
from app.server import run_server

if __name__ == "__main__":
    registry = DeviceRegistry()
    verifier = PublicKeyDeviceVerifier(registry)
    print("开发用中继监听 ws://127.0.0.1:8765 （仅供本地联调，见 README.md）")
    print("设备认证：ECDSA P-256 + TOFU 首次注册（register_device 帧）")
    asyncio.run(run_server(verifier, host="127.0.0.1", port=8765, device_registry=registry))

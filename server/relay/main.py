"""本地开发用入口——不是生产部署脚本。

生产环境的密钥验证方案、限流、监控都还没做（见 docs/protocol/RELAY_CONTRACT_V0.md
"非目标"），不要直接拿这个跑生产。
"""
import asyncio
import os

from app.auth import PlaceholderHmacVerifier
from app.server import run_server

if __name__ == "__main__":
    secret = os.environ.get("SECUREINCHAT_DEV_SHARED_SECRET", "dev-only-insecure-secret").encode("utf-8")
    verifier = PlaceholderHmacVerifier(secret)
    print("开发用中继监听 ws://127.0.0.1:8765 （仅供本地联调，见 README.md）")
    asyncio.run(run_server(verifier, host="127.0.0.1", port=8765))

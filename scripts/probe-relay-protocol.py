#!/usr/bin/env python3
"""探测一个中继服务器说的是哪套协议。

用法：
    python3 scripts/probe-relay-protocol.py wss://ws.secureinchat.com

它只做只读探测：连上去，看服务器主动发的第一帧长什么样，然后立刻断开。
不发送任何认证、不注册设备、不发消息——对生产服务器是安全的。

依赖：pip install websockets
"""
import asyncio
import json
import sys

try:
    import websockets
except ImportError:
    print("需要先安装依赖：pip install websockets")
    sys.exit(1)


async def probe(url: str) -> int:
    print(f"正在连接 {url} ...")
    try:
        async with websockets.connect(url, open_timeout=10) as ws:
            print("✅ 连接建立成功")
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
            except asyncio.TimeoutError:
                print("❌ 连上了，但 10 秒内服务器没有主动发任何帧")
                print("   我们的中继会在连上后立即下发 auth_challenge，所以这不是我们的协议。")
                return 1

            print(f"\n服务器发来的第一帧：\n  {raw}\n")

            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                print("❌ 这一帧不是 JSON —— 不是我们的协议")
                return 1

            if frame.get("type") != "auth_challenge":
                print(f"❌ 第一帧类型是 {frame.get('type')!r}，我们的协议是 'auth_challenge'")
                return 1

            if "nonce" in frame:
                print("✅ 字段是 `nonce` —— 这就是我们的新协议，新 APK 可以直接连这个地址。")
                return 0

            if "challenge" in frame:
                print("❌ 字段是 `challenge`，不是 `nonce`。")
                print("   这是旧协议。新 APK 连上去会在握手时失败：")
                print("   客户端读 frame.nonce 得到 undefined，签名后发出的 auth_response")
                print("   旧服务端也不认识（它期待的是 resume_group）。")
                print("\n   解决办法：把新中继部署到另一个子域名（见 docs/deployment/DEPLOY_RELAY.md），")
                print("   生产的 ws.secureinchat.com 不用改动，旧 App 继续正常使用。")
                return 1

            print(f"❓ 是 auth_challenge，但既没有 nonce 也没有 challenge，字段有：{list(frame.keys())}")
            return 1

    except Exception as err:  # noqa: BLE001 — 探测脚本，任何失败都如实打印
        print(f"❌ 连接失败：{type(err).__name__}: {err}")
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(probe(sys.argv[1])))

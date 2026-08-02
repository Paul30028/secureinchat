/**
 * relay 地址。本地跑 `server/relay`（`python main.py`）默认监听 8765，
 * 这里默认指向那个。真要连你部署出去的那个（见
 * docs/deployment/DEPLOY_RELAY.md 里的 ws-next.secureinchat.com 之类），
 * 在构建时设置 VITE_RELAY_URL 环境变量覆盖。
 */
export const RELAY_URL: string =
  (import.meta.env.VITE_RELAY_URL as string | undefined) ?? "ws://localhost:8765";

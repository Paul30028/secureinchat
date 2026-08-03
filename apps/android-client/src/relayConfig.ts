import { buildIceServers, type IceConfiguration } from "@secureinchat/webrtc";

/**
 * relay 地址。本地跑 `server/relay`（`python main.py`）默认监听 8765，
 * 这里默认指向那个。真要连你部署出去的那个（见
 * docs/deployment/DEPLOY_RELAY.md），在构建时设置 VITE_RELAY_URL 覆盖。
 */
export const RELAY_URL: string =
  (import.meta.env.VITE_RELAY_URL as string | undefined) ?? "ws://localhost:8765";

/**
 * TURN 配置。**跨运营商通话（比如移动 ↔ 电信）必须配这个**——只有 STUN 时，
 * 双方都在运营商级 NAT 后面会打不通。构建时设置这三个环境变量：
 *
 *   VITE_TURN_URL=turns:turn.你的域名:5349
 *   VITE_TURN_USERNAME=xxx
 *   VITE_TURN_CREDENTIAL=xxx
 *
 * 没配的话通话依然可用，但只在网络条件好的时候能通；`hasTurn` 为 false 时
 * UI 会如实提示，不假装一定能接通。
 */
function readTurnConfig() {
  const url = import.meta.env.VITE_TURN_URL as string | undefined;
  const username = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
  if (!url || !username || !credential) return undefined;
  return { url, username, credential };
}

export const ICE_CONFIG: IceConfiguration = (() => {
  try {
    return buildIceServers({
      turn: readTurnConfig(),
      // VITE_FORCE_RELAY=1 时强制所有媒体走 TURN（不向对端暴露 IP，代价是延迟和带宽）
      forceRelay: import.meta.env.VITE_FORCE_RELAY === "1",
    });
  } catch (err) {
    // 配置有问题时不要让整个应用起不来——退回到只有 STUN 的配置，
    // 并在控制台说明原因。通话可能打不通，但至少聊天功能不受影响。
    // eslint-disable-next-line no-console
    console.error("TURN 配置无效，已退回仅 STUN 模式：", err);
    return buildIceServers();
  }
})();

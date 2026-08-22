/**
 * ICE 服务器配置。
 *
 * 为什么这件事很关键：只有 STUN 没有 TURN 时，两端如果都在运营商级 NAT
 * 后面（中国移动、电信的手机网络基本都是），P2P 直连大概率打不通——STUN 只能
 * 帮你发现自己的公网地址，打不通的时候没有兜底。TURN 是真正的媒体中继，
 * 由服务器转发音视频流，代价是带宽成本和延迟，但能保证连通。
 *
 * 旧仓库（secure-invite-chat）的 `iceServers: []` 是空的，注释写着"部署公网版本时
 * 在设置中配置 TURN"，但那个配置界面从未实现——所以旧版跨运营商通话不可能
 * 通过 TURN 中继工作。这里把它做成真正可配置的。
 */

export interface TurnConfig {
  /** 例如 turn:turn.example.com:3478 或 turns:turn.example.com:5349（TLS） */
  url: string;
  username: string;
  credential: string;
}

export interface BuildIceServersInput {
  /** 不传就用默认公共 STUN */
  stunUrls?: string[] | undefined;
  turn?: TurnConfig | undefined;
  /**
   * 强制只用中继候选（relay-only）。开启后不尝试 P2P，音视频一律走 TURN——
   * 好处是不向对端暴露自己的 IP，代价是全部流量走中继、延迟更高、带宽成本更大。
   * 没配 TURN 时开这个会导致通话必然失败，所以 buildIceServers 会拒绝这种组合。
   */
  forceRelay?: boolean | undefined;
}

export interface IceConfiguration {
  iceServers: RTCIceServer[];
  iceTransportPolicy: RTCIceTransportPolicy;
  /** 有没有真正的中继兜底——UI 可以据此提示"当前网络条件下可能无法接通" */
  hasTurn: boolean;
}

export const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302"];

export class IceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IceConfigError";
  }
}

export function buildIceServers(input: BuildIceServersInput = {}): IceConfiguration {
  const stunUrls = input.stunUrls?.length ? input.stunUrls : DEFAULT_STUN_URLS;
  const iceServers: RTCIceServer[] = [{ urls: stunUrls }];

  let hasTurn = false;
  if (input.turn) {
    const { url, username, credential } = input.turn;
    if (!url || !username || !credential) {
      throw new IceConfigError("TURN 配置不完整：url、username、credential 三项都必须提供");
    }
    if (!url.startsWith("turn:") && !url.startsWith("turns:")) {
      throw new IceConfigError(`TURN 地址必须以 turn: 或 turns: 开头，实际是：${url}`);
    }
    iceServers.push({ urls: url, username, credential });
    hasTurn = true;
  }

  if (input.forceRelay && !hasTurn) {
    // 明确报错而不是静默降级——强制中继却没有中继可用，通话必然失败，
    // 与其让用户在打不通时一头雾水，不如在配置阶段就拦下来。
    throw new IceConfigError("开启了 forceRelay（仅中继）但没有配置 TURN，通话将无法接通");
  }

  return {
    iceServers,
    iceTransportPolicy: input.forceRelay ? "relay" : "all",
    hasTurn,
  };
}

export type IceProbeResult =
  | { ok: true; sawRelayCandidate: boolean; candidateTypes: string[] }
  | { ok: false; error: string };

/**
 * 连接诊断：真的建一个 RTCPeerConnection 收集一轮 ICE 候选，看看能不能拿到
 * relay 类型的候选。拿不到就说明 TURN 没配对（地址错、凭证错、端口被墙），
 * 这时候跨运营商通话必定失败——与其等真打电话时才发现，不如提前测出来。
 */
export async function probeIceServers(
  config: IceConfiguration,
  timeoutMs = 5000
): Promise<IceProbeResult> {
  if (typeof RTCPeerConnection === "undefined") {
    return { ok: false, error: "当前环境不支持 WebRTC" };
  }

  let pc: RTCPeerConnection | null = null;
  try {
    pc = new RTCPeerConnection({
      iceServers: config.iceServers,
      iceTransportPolicy: config.iceTransportPolicy,
    });
    const candidateTypes = new Set<string>();

    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      pc!.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timer);
          resolve();
          return;
        }
        // candidate 字符串形如 "candidate:... typ srflx ..."，取 typ 后面那个词
        const match = /\btyp\s+(\w+)/.exec(event.candidate.candidate);
        if (match?.[1]) candidateTypes.add(match[1]);
      };
    });

    // 需要至少一个 transceiver 才会真正开始收集候选
    pc.addTransceiver("audio", { direction: "recvonly" });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await done;

    return {
      ok: true,
      sawRelayCandidate: candidateTypes.has("relay"),
      candidateTypes: [...candidateTypes],
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    pc?.close();
  }
}

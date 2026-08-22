/**
 * 通话状态机——刻意不依赖 RTCPeerConnection，纯逻辑，能完整单测。
 * 真正碰 WebRTC API 的部分在 callSession.ts 里，那部分在 jsdom 里测不了
 * （没有 WebRTC 实现），只能靠真机验证；把状态转换抽出来，至少保证
 * "什么时候该显示什么、什么操作在什么状态下合法"这部分是测过的。
 */

export type CallState =
  | "idle"
  /** 我方拨出，等对方响应 */
  | "outgoing"
  /** 对方已收到并振铃 */
  | "ringing-remote"
  /** 收到来电，等我方接听/拒绝 */
  | "incoming"
  /** 双方已同意，正在建立媒体连接 */
  | "connecting"
  /** 通话中 */
  | "connected"
  /** 已结束（对方挂断/拒接/取消/自己挂断/失败） */
  | "ended";

export type CallKind = "voice" | "video";

export type CallEvent =
  | { type: "start-outgoing" }
  | { type: "remote-ringing" }
  | { type: "receive-invite" }
  | { type: "accept" }
  | { type: "remote-accepted" }
  | { type: "media-connected" }
  | { type: "reject" }
  | { type: "cancel" }
  | { type: "hangup" }
  | { type: "remote-ended" }
  | { type: "failed" };

export interface CallStateInfo {
  state: CallState;
  /** 结束原因，仅在 state === "ended" 时有意义 */
  endReason?: "rejected" | "cancelled" | "hungup" | "remote-ended" | "failed";
}

const ACTIVE_STATES = new Set<CallState>(["outgoing", "ringing-remote", "incoming", "connecting", "connected"]);

export function isCallActive(state: CallState): boolean {
  return ACTIVE_STATES.has(state);
}

/**
 * 状态转换。不合法的转换返回原状态（而不是抛错）——信令可能乱序或重复到达
 * （比如对方重发了 hangup），把这些当异常处理会让通话更脆弱，忽略更合适。
 */
export function nextCallState(current: CallStateInfo, event: CallEvent): CallStateInfo {
  const { state } = current;

  // 结束类事件在任何"活跃"状态下都生效——挂断永远应该能挂掉
  if (event.type === "hangup" && isCallActive(state)) return { state: "ended", endReason: "hungup" };
  if (event.type === "failed" && isCallActive(state)) return { state: "ended", endReason: "failed" };
  if (event.type === "remote-ended" && isCallActive(state)) return { state: "ended", endReason: "remote-ended" };

  switch (state) {
    case "idle":
      if (event.type === "start-outgoing") return { state: "outgoing" };
      if (event.type === "receive-invite") return { state: "incoming" };
      return current;

    case "outgoing":
      if (event.type === "remote-ringing") return { state: "ringing-remote" };
      if (event.type === "remote-accepted") return { state: "connecting" };
      if (event.type === "reject") return { state: "ended", endReason: "rejected" };
      if (event.type === "cancel") return { state: "ended", endReason: "cancelled" };
      return current;

    case "ringing-remote":
      if (event.type === "remote-accepted") return { state: "connecting" };
      if (event.type === "reject") return { state: "ended", endReason: "rejected" };
      if (event.type === "cancel") return { state: "ended", endReason: "cancelled" };
      return current;

    case "incoming":
      if (event.type === "accept") return { state: "connecting" };
      if (event.type === "reject") return { state: "ended", endReason: "rejected" };
      // 对方在我接听前取消了
      if (event.type === "cancel") return { state: "ended", endReason: "cancelled" };
      return current;

    case "connecting":
      if (event.type === "media-connected") return { state: "connected" };
      return current;

    case "connected":
      return current;

    case "ended":
      // 已经结束就不再变化——除非重新发起一通新的（那会是一个新的 CallSession）
      return current;

    default:
      return current;
  }
}

/** 给 UI 用的中文状态文案 */
export function describeCallState(info: CallStateInfo, kind: CallKind): string {
  const label = kind === "video" ? "视频通话" : "语音通话";
  switch (info.state) {
    case "outgoing":
      return `正在呼叫...`;
    case "ringing-remote":
      return `对方响铃中...`;
    case "incoming":
      return `${label}来电`;
    case "connecting":
      return `正在连接...`;
    case "connected":
      return `${label}中`;
    case "ended":
      switch (info.endReason) {
        case "rejected":
          return "对方已拒接";
        case "cancelled":
          return "通话已取消";
        case "hungup":
          return "通话已结束";
        case "remote-ended":
          return "对方已挂断";
        case "failed":
          return "通话连接失败";
        default:
          return "通话已结束";
      }
    default:
      return "";
  }
}

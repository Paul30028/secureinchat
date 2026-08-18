import type { CallSignalingTransport } from "./callSession";

/**
 * 多人语音会议(mesh)。
 *
 * 每个参与者和其他每个参与者各建一条 WebRTC 连接。N 个人有 N×(N-1)/2 条连接,
 * 每台设备要同时编解码 N-1 路音频。
 *
 * 为什么是 mesh 而不是 SFU:SFU 要在服务器上解密媒体再转发,也就是服务器
 * 能听到整场会议。这个产品的立身之本是"服务器什么都看不到",mesh 保住了
 * 这一点——媒体只在参与者之间流动,连中继都只转发信令。
 *
 * 代价是人数上限。见 MAX_MESH_PARTICIPANTS 的说明。
 */

/**
 * mesh 语音的人数上限。
 *
 * 这个数字不是拍脑袋:8 个人时每台设备要维持 7 条连接、同时编码 7 路上行、
 * 解码 7 路下行。老一点的安卓手机在这个量级已经开始发烫和卡顿。
 * 再往上不是"慢一点",是会议直接不可用。
 *
 * 十几个人需要 SFU,那是另一套架构,也意味着放弃媒体的端到端加密。
 */
export const MAX_MESH_PARTICIPANTS = 8;

export type ParticipantState = "inviting" | "connecting" | "connected" | "left" | "failed";

export interface Participant {
  deviceId: string;
  displayName?: string | undefined;
  state: ParticipantState;
  /** 是否静音了自己(由对方广播) */
  muted: boolean;
}

export interface ConferenceState {
  conferenceId: string;
  /** 不含自己 */
  participants: Participant[];
  /** 自己是否静音 */
  selfMuted: boolean;
}

export function createConference(conferenceId: string): ConferenceState {
  return { conferenceId, participants: [], selfMuted: false };
}

export type JoinRejection = { ok: false; reason: string };
export type JoinAccepted = { ok: true; state: ConferenceState };

/**
 * 有人加入。超过上限就拒绝——**在加入时拒绝,而不是让会议慢慢垮掉**。
 * 一个明确的"人数已满"比十个人一起卡顿要好得多。
 */
export function addParticipant(
  state: ConferenceState,
  deviceId: string,
  displayName?: string | undefined
): JoinAccepted | JoinRejection {
  if (state.participants.some((p) => p.deviceId === deviceId && p.state !== "left")) {
    // 重复加入不是错误(重连会发生),当作已在会议中
    return { ok: true, state };
  }

  const active = state.participants.filter((p) => p.state !== "left" && p.state !== "failed");
  // +1 是自己
  if (active.length + 1 >= MAX_MESH_PARTICIPANTS) {
    return {
      ok: false,
      reason: `会议人数已满(最多 ${MAX_MESH_PARTICIPANTS} 人)`,
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      participants: [
        ...state.participants.filter((p) => p.deviceId !== deviceId),
        { deviceId, displayName, state: "inviting", muted: false },
      ],
    },
  };
}

export function updateParticipant(
  state: ConferenceState,
  deviceId: string,
  patch: Partial<Omit<Participant, "deviceId">>
): ConferenceState {
  return {
    ...state,
    participants: state.participants.map((p) => (p.deviceId === deviceId ? { ...p, ...patch } : p)),
  };
}

export function removeParticipant(state: ConferenceState, deviceId: string): ConferenceState {
  return updateParticipant(state, deviceId, { state: "left" });
}

/**
 * 会议里还在的人(含自己)。
 *
 * inviting 也要算进去:正在接通的人如果不计数,一堆人同时加入时人数上限
 * 就形同虚设——每个人检查时看到的都是"还没满",最后全部通过。
 */
export function activeCount(state: ConferenceState): number {
  return (
    state.participants.filter(
      (p) => p.state === "inviting" || p.state === "connecting" || p.state === "connected"
    ).length + 1
  );
}

/** 会议是不是该结束了——别人都走光了 */
export function isEmpty(state: ConferenceState): boolean {
  return state.participants.every((p) => p.state === "left" || p.state === "failed");
}

export function setSelfMuted(state: ConferenceState, muted: boolean): ConferenceState {
  return { ...state, selfMuted: muted };
}

/**
 * 谁该主动发起连接。
 *
 * 两边同时发 offer 会撞车(glare)。约定:deviceId 字典序小的一方发起。
 * 这个规则必须两边一致,所以不能用"先到先发"这种依赖时序的做法。
 */
export function shouldInitiateTo(myDeviceId: string, peerDeviceId: string): boolean {
  return myDeviceId < peerDeviceId;
}

export interface ConferenceTransport extends CallSignalingTransport {
  /** 会议邀请要发给群里所有人,而不是某一个 targetDeviceId */
  broadcastConferenceInvite?: (conferenceId: string) => Promise<void>;
}

/**
 * 群内语音会议的状态（从 App.tsx 拆出，K6）。
 *
 * 每个参与者一条 CallSession。信令回调是在 connectToGroup 里一次性注册的闭包，
 * 所以这里的函数只读 ref 和 setState，不依赖某一次渲染的值。
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  addParticipant,
  createConference,
  removeParticipant,
  setSelfMuted,
  shouldInitiateTo,
  updateParticipant,
  type CallKind,
  type CallSession,
  type ConferenceState,
} from "@secureinchat/webrtc";
import type { ConferenceFrame, KnownDevice, RelayClient } from "@secureinchat/chat-core";
import { randomUUID } from "@secureinchat/crypto-core";

type CallFactory = (callId: string, peer: string, kind: CallKind) => CallSession;

export function useConference(
  callFactoryRef: MutableRefObject<CallFactory | null>,
  myDeviceIdRef: MutableRefObject<string>
) {
  /** 当前会议。null = 不在会议中 */
  const [conference, setConference] = useState<ConferenceState | null>(null);
  const [conferenceElapsed, setConferenceElapsed] = useState(0);
  /** 会议里每个参与者一条 CallSession */
  const conferenceSessionsRef = useRef<Map<string, CallSession>>(new Map());

  useEffect(() => {
    if (!conference) {
      setConferenceElapsed(0);
      return;
    }
    const timer = setInterval(() => setConferenceElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [conference !== null]);

  /**
   * 和会议里某个人建立语音连接。
   *
   * 谁主动发 offer 由 shouldInitiateTo 决定（deviceId 字典序），两边必须一致，
   * 否则会同时发 offer 撞车。
   */
  function connectToConferencePeer(peerDeviceId: string, conferenceId: string) {
    const factory = callFactoryRef.current;
    if (!factory) return;

    const session = factory(`${conferenceId}:${peerDeviceId}`, peerDeviceId, "voice");
    conferenceSessionsRef.current.set(peerDeviceId, session);

    if (shouldInitiateTo(myDeviceIdRef.current, peerDeviceId)) {
      setConference((prev) => (prev ? updateParticipant(prev, peerDeviceId, { state: "connecting" }) : prev));
      void session.startOutgoing();
    }
    // 另一边会发 offer 过来，由 onSignaling 里的 call_invite 分支处理
  }

  /** 中继转来的会议帧 */
  function handleConferenceFrame(frame: ConferenceFrame, client: RelayClient, known: readonly KnownDevice[]) {
    if (frame.type === "conference_end") {
      setConference((prev) => (prev ? removeParticipant(prev, frame.fromDeviceId) : prev));
      conferenceSessionsRef.current.get(frame.fromDeviceId)?.hangup();
      conferenceSessionsRef.current.delete(frame.fromDeviceId);
      return;
    }

    // conference_invite：别人发起了会议，或者已在会议中的人告诉我他也在
    setConference((prev) => {
      const base = prev ?? createConference(frame.conferenceId);
      const displayName = known.find((d) => d.deviceId === frame.fromDeviceId)?.displayName;
      const result = addParticipant(base, frame.fromDeviceId, displayName);
      if (!result.ok) {
        // 满了：告诉对方一声，别让他一直等
        client.sendConferenceFrame("conference_end", frame.conferenceId);
        return prev;
      }
      return result.state;
    });

    // 已经在同一个会议里就去建连接
    connectToConferencePeer(frame.fromDeviceId, frame.conferenceId);
  }

  /** 发起会议：广播邀请，群里在线的人会收到 */
  function startConference(client: RelayClient) {
    const conferenceId = randomUUID();
    setConference(createConference(conferenceId));
    client.sendConferenceFrame("conference_invite", conferenceId);
  }

  /** 离开会议：断开所有连接 */
  function leaveConference() {
    for (const s of conferenceSessionsRef.current.values()) {
      void s.hangup();
    }
    conferenceSessionsRef.current.clear();
    setConference(null);
  }

  function toggleConferenceMute() {
    setConference((prev) => {
      if (!prev) return prev;
      const next = setSelfMuted(prev, !prev.selfMuted);
      for (const s of conferenceSessionsRef.current.values()) s.setMuted(next.selfMuted);
      return next;
    });
  }

  return { conference, conferenceElapsed, handleConferenceFrame, startConference, leaveConference, toggleConferenceMute };
}

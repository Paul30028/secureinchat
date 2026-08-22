import {
  isCallActive,
  nextCallState,
  type CallEvent,
  type CallKind,
  type CallStateInfo,
} from "./callState";

/**
 * WebRTC 通话会话——把 RTCPeerConnection 和信令收发接起来。
 *
 * ⚠️ 关于 TURN：默认只配了公共 STUN 服务器。STUN 只能解决"我的公网地址是什么"，
 * 在对称 NAT / 严格防火墙下双方仍然连不通，这时候需要 TURN 中转。你提供的中继
 * 文档里没有 TURN 服务器，所以：网络条件好时通话能通，网络条件差时会连接失败
 * 并如实显示"通话连接失败"——按原始需求第十二节的要求，不伪装成通话成功。
 * 配了 TURN 之后把它加进 iceServers 即可，代码不用改。
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export interface CallSignalingTransport {
  sendSignaling(
    type: "call_invite" | "call_ring" | "call_answer" | "call_reject" | "call_cancel" | "call_hangup" | "ice_candidate",
    targetDeviceId: string,
    callId: string,
    payload?: Record<string, unknown>
  ): Promise<void>;
}

export interface CallSessionOptions {
  callId: string;
  peerDeviceId: string;
  kind: CallKind;
  transport: CallSignalingTransport;
  iceServers?: RTCIceServer[];
  /** "relay" = 强制所有媒体走 TURN 中继（不向对端暴露 IP）。没有 TURN 时不要设成 relay。 */
  iceTransportPolicy?: RTCIceTransportPolicy;
  onStateChange: (info: CallStateInfo) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
}

export class CallSession {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private info: CallStateInfo = { state: "idle" };
  /** 远端 ICE candidate 可能早于 remoteDescription 到达，先缓冲 */
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(private readonly opts: CallSessionOptions) {}

  get state(): CallStateInfo {
    return this.info;
  }

  private apply(event: CallEvent): void {
    const next = nextCallState(this.info, event);
    if (next.state === this.info.state && next.endReason === this.info.endReason) return;
    this.info = next;
    this.opts.onStateChange(next);
    if (next.state === "ended") this.teardown();
  }

  private async ensurePeerConnection(): Promise<RTCPeerConnection> {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({
      iceServers: this.opts.iceServers ?? DEFAULT_ICE_SERVERS,
      ...(this.opts.iceTransportPolicy ? { iceTransportPolicy: this.opts.iceTransportPolicy } : {}),
    });

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      void this.opts.transport.sendSignaling("ice_candidate", this.opts.peerDeviceId, this.opts.callId, {
        candidate: e.candidate.toJSON(),
      });
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) this.opts.onRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") this.apply({ type: "media-connected" });
      // failed 是真的连不通（多半是没有 TURN，对称 NAT 穿不过去）——如实报错
      if (pc.connectionState === "failed") this.apply({ type: "failed" });
    };

    this.pc = pc;
    return pc;
  }

  private async ensureLocalMedia(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.opts.kind === "video",
    });
    this.localStream = stream;
    this.opts.onLocalStream(stream);
    const pc = await this.ensurePeerConnection();
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    return stream;
  }

  /** 主叫方：发起通话 */
  async startOutgoing(): Promise<void> {
    this.apply({ type: "start-outgoing" });
    try {
      await this.ensureLocalMedia();
      const pc = await this.ensurePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.opts.transport.sendSignaling("call_invite", this.opts.peerDeviceId, this.opts.callId, {
        sdp: offer.sdp,
        kind: this.opts.kind,
      });
    } catch {
      // 麦克风/摄像头权限被拒，或者创建 offer 失败
      this.apply({ type: "failed" });
    }
  }

  /** 被叫方：收到 call_invite 后进入来电状态，并回一个 ring 告诉对方"我这边响了" */
  async receiveInvite(remoteSdp: string): Promise<void> {
    this.apply({ type: "receive-invite" });
    try {
      const pc = await this.ensurePeerConnection();
      await pc.setRemoteDescription({ type: "offer", sdp: remoteSdp });
      await this.drainPendingCandidates();
      await this.opts.transport.sendSignaling("call_ring", this.opts.peerDeviceId, this.opts.callId);
    } catch {
      this.apply({ type: "failed" });
    }
  }

  /** 被叫方：接听 */
  async accept(): Promise<void> {
    this.apply({ type: "accept" });
    try {
      await this.ensureLocalMedia();
      const pc = await this.ensurePeerConnection();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.opts.transport.sendSignaling("call_answer", this.opts.peerDeviceId, this.opts.callId, {
        sdp: answer.sdp,
      });
    } catch {
      this.apply({ type: "failed" });
    }
  }

  /** 主叫方：收到对方的 answer */
  async receiveAnswer(remoteSdp: string): Promise<void> {
    this.apply({ type: "remote-accepted" });
    try {
      const pc = await this.ensurePeerConnection();
      await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
      await this.drainPendingCandidates();
    } catch {
      this.apply({ type: "failed" });
    }
  }

  remoteRinging(): void {
    this.apply({ type: "remote-ringing" });
  }

  async receiveIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.pc;
    if (!pc || !pc.remoteDescription) {
      // remoteDescription 还没设好，先存着——直接 addIceCandidate 会报错
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // 单条 candidate 加失败不致命，别因此中断整通电话
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    const pending = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of pending) {
      try {
        await this.pc?.addIceCandidate(candidate);
      } catch {
        // 同上，忽略单条失败
      }
    }
  }

  /** 被叫方：拒接 */
  async reject(): Promise<void> {
    await this.safeSend("call_reject");
    this.apply({ type: "reject" });
  }

  /** 主叫方：对方接听前取消 */
  async cancel(): Promise<void> {
    await this.safeSend("call_cancel");
    this.apply({ type: "cancel" });
  }

  /** 任一方：挂断 */
  async hangup(): Promise<void> {
    await this.safeSend("call_hangup");
    this.apply({ type: "hangup" });
  }

  /** 对方拒接/取消/挂断 */
  remoteEnded(reason: "rejected" | "cancelled" | "hungup"): void {
    if (reason === "rejected") this.apply({ type: "reject" });
    else if (reason === "cancelled") this.apply({ type: "cancel" });
    else this.apply({ type: "remote-ended" });
  }

  private async safeSend(
    type: "call_reject" | "call_cancel" | "call_hangup"
  ): Promise<void> {
    if (!isCallActive(this.info.state)) return;
    try {
      await this.opts.transport.sendSignaling(type, this.opts.peerDeviceId, this.opts.callId);
    } catch {
      // 连接可能已经断了——本地状态照样要结束，不能因为发不出信令就卡在通话中
    }
  }

  setMuted(muted: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  setCameraEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  private teardown(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.pc?.close();
    this.pc = null;
    this.pendingCandidates = [];
  }
}

/**
 * App 的导航状态和通话状态类型（从 App.tsx 拆出，K6）。
 */
import type { ParsedInvite } from "@secureinchat/protocol";
import type { InviteInfo } from "@secureinchat/ui";
import type { CallKind, CallSession, CallStateInfo } from "@secureinchat/webrtc";

export interface ActiveCall {
  session: CallSession;
  kind: CallKind;
  info: CallStateInfo;
  peerDeviceId: string;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

export type Screen =
  | { name: "join" }
  | { name: "createGroup" }
  | { name: "serverSettings" }
  | { name: "adminPublish" }
  | { name: "scanQr" }
  | { name: "adminRecovery" }
  | { name: "diagnostics" }
  | { name: "devices" }
  | { name: "editProfile" }
  | { name: "groupSettings"; groupId: string; from: "chat" | "list" }
  | { name: "groupInvite"; groupId: string; from: "chat" | "list" }
  | { name: "backup" }
  | {
      name: "invite";
      invite: InviteInfo;
      parsed?: ParsedInvite | undefined;
      isConfirming: boolean;
      errorMessage?: string | undefined;
    }
  // "messages" 和 "chat" 合成一个状态，view 只决定渲染哪个屏幕——消息数组
  // 活在这一个对象里，在两个视图之间切换不会因为组件卸载而丢失历史。
  | {
      name: "connected";
      /** 当前打开的群；null 表示在群列表页 */
      activeGroupId: string | null;
      view: "list" | "chat" | "search";
      deviceId: string;
      call?: ActiveCall | undefined;
    };

/** 回到群列表页。很多页面的「返回」都落在这里 */
export const LIST_SCREEN: Screen = { name: "connected", activeGroupId: null, view: "list", deviceId: "" };

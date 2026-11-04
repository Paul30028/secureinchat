/**
 * ui 包里组件自带的文字。默认中文；App 按当前语言调用 setUiStrings() 换掉（K6）。
 * 组件在渲染时读，所以 App 切换语言并重渲染后就会显示新文字。
 * 占位符写成 {name}。
 */
export const UI_STRINGS_ZH = {
  navAnnouncements: "公告",
  navMessages: "消息",
  navMe: "我的",
  navLabel: "主导航",
  statusSent: "已发送",
  statusDelivered: "已送达",
  statusRead: "已读",
  composerPlaceholder: "输入消息...",
  composerInput: "消息输入框",
  composerRecord: "录制语音",
  composerSend: "发送",
  copied: "已复制",
  copy: "复制",
  inviteExpired: "该邀请已过期或已被撤销，请联系邀请人获取新的邀请。",
  inviteRevoked: "该邀请已被撤销，请联系邀请人获取新的邀请。",
  inviteExhausted: "该邀请的可用次数已用尽，请联系邀请人获取新的邀请。",
  inviteMalformed: "邀请码格式不正确，请检查后重新输入。",
  inviteInvalidTitle: "邀请已失效",
  inviteMemberCount: "{count}人 · ",
  inviteKind: "邀请制加密群聊",
  inviteInviter: "邀请人：{name}",
  inviteValid: "邀请有效，可加入",
  inviteJoining: "正在加入...",
  inviteConfirm: "确认加入",
  shareQrLabel: "邀请二维码",
  shareQrFailed: "二维码生成失败，请用下方邀请码",
  shareQrGenerating: "正在生成二维码...",
  shareHint: "让对方扫码，或复制下面的邀请码发给他",
  shareCopyCode: "复制邀请码",
  shareWarning: "拿到这串邀请码的人就能加入并解密群消息，请只发给要邀请的人",
};

export type UiStrings = typeof UI_STRINGS_ZH;
export type UiStringKey = keyof UiStrings;

let current: UiStrings = { ...UI_STRINGS_ZH };

/** 换成某种语言的文字；缺的键保留中文 */
export function setUiStrings(strings: Partial<UiStrings>): void {
  current = { ...UI_STRINGS_ZH, ...strings };
}

export function uiText(key: UiStringKey, params?: Record<string, string | number>): string {
  const text = current[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : String(params[name])
  );
}

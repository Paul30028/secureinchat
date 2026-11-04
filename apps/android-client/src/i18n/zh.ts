import type { Messages } from "./index";

/**
 * 中文词条。这是基准语言：en.ts / es.ts 必须包含这里的所有键
 * （由 test/i18n.test.ts 保证）。
 */
export const messages: Messages = {
  "deviceSafety.back": "返回",
  "deviceSafety.backAria": "返回",

  "deviceSafety.home.title": "设备安全",
  "deviceSafety.home.intro":
    "手机被别人拿走、检查或扣留时，加密保护不了已经在手机里的东西。最安全的做法是让手机里本来就没有。",
  "deviceSafety.home.travelTitle": "空手过境",
  "deviceSafety.home.travelSubtitle":
    "过境或可能被检查前，把选中的群从这台手机上彻底删除",
  "deviceSafety.home.compromisedTitle": "这台手机曾离开过我",
  "deviceSafety.home.compromisedSubtitle":
    "被扣留、被拿走或被要求解锁过：清除全部数据，换设备重新入群",

  "deviceSafety.travel.title": "空手过境",
  "deviceSafety.travel.intro":
    "选中的群会从这台手机上彻底删除：聊天记录、群密钥、管理员身份都删掉，不留下「删过哪些群」的记录。",
  "deviceSafety.travel.outro":
    "之后想回到群里，请群里其他人给你一张新的邀请。以前的聊天记录不会回来。如果你导出过备份文件，它不归这个 App 管，请自己删掉。",
  "deviceSafety.travel.noGroups": "这台手机上没有群。",
  "deviceSafety.travel.selectLegend": "选择要删除的群",
  "deviceSafety.travel.adminTag": "（你是管理员）",
  "deviceSafety.travel.adminWarning":
    "你是「{groups}」的管理员。删除后，这台手机上的管理员身份也会删除。请先确认管理员恢复码保存在别处（不在这台手机里），否则以后就不能再在这个群里发公告。",
  "deviceSafety.travel.purgeButton": "删除选中的 {count} 个群",
  "deviceSafety.travel.purging": "正在删除…",
  "deviceSafety.travel.error": "删除没有完成，请再试一次",
  "deviceSafety.travel.doneTitle": "已删除 {count} 个群",
  "deviceSafety.travel.doneHint": "回来以后，请群里其他人给你一张新的邀请。",
  "deviceSafety.travel.doneButton": "完成",

  "deviceSafety.compromised.title": "这台手机曾离开过我",
  "deviceSafety.compromised.intro":
    "手机被扣留、被拿走，或者你被要求当面解锁过，别人可能已经复制了里面的数据，甚至装了监控软件。监控软件装上以后，在这台手机上做什么都不再可信。",
  "deviceSafety.compromised.stepsIntro": "建议这样做：",
  "deviceSafety.compromised.step1":
    "用一台干净的设备告诉群管理员：这台手机已失守，请把它移出群并换钥匙。",
  "deviceSafety.compromised.step2": "在下面清除这台手机上的全部数据。",
  "deviceSafety.compromised.step3":
    "尽量不要再用这台手机交流敏感内容；需要的话恢复出厂设置。",
  "deviceSafety.compromised.step4": "用干净的设备，请管理员发新邀请重新入群。",
  "deviceSafety.compromised.note":
    "清除会删掉所有群、聊天记录、群密钥、管理员身份和设备主密钥，无法恢复。管理员请确认恢复码保存在别处。",
  "deviceSafety.compromised.confirmLabel": "输入「{word}」确认",
  "deviceSafety.compromised.confirmWord": "清除",
  "deviceSafety.compromised.wipeButton": "清除这台手机上的全部数据",
  "deviceSafety.compromised.wiping": "正在清除…",
  "deviceSafety.compromised.error":
    "清除没有完成，请再试一次；如果仍然失败，请在系统设置里清除本应用的数据",
};

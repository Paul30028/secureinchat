import type { Messages } from "./index";

/**
 * 英文词条。必须与 zh.ts 键集合完全一致（测试保证）。
 * 语气：平实、准确，不夸大安全效果——"加密保护不了已经在手机里的东西"
 * 这类话直说，不要用 "military-grade""unhackable" 这样的营销词。
 */
export const messages: Messages = {
  "deviceSafety.back": "Back",
  "deviceSafety.backAria": "Back",

  "deviceSafety.home.title": "Device safety",
  "deviceSafety.home.intro":
    "When someone takes, searches, or holds your phone, encryption does not protect what is already on it. The safest choice is to not have it on the phone in the first place.",
  "deviceSafety.home.travelTitle": "Cross borders empty-handed",
  "deviceSafety.home.travelSubtitle":
    "Before a border check or a possible search, permanently delete the selected groups from this phone",
  "deviceSafety.home.compromisedTitle": "This phone was out of my hands",
  "deviceSafety.home.compromisedSubtitle":
    "If it was held, taken, or you were forced to unlock it: wipe all data and rejoin from another device",

  "deviceSafety.travel.title": "Cross borders empty-handed",
  "deviceSafety.travel.intro":
    "The selected groups will be permanently deleted from this phone: chat history, group keys, and admin roles are all erased. Nothing about which groups were deleted is kept.",
  "deviceSafety.travel.outro":
    "To rejoin later, ask someone in the group for a new invite. Past chat history will not come back. If you exported backup files, this app cannot manage them—delete them yourself.",
  "deviceSafety.travel.noGroups": "There are no groups on this phone.",
  "deviceSafety.travel.selectLegend": "Choose groups to delete",
  "deviceSafety.travel.adminTag": " (you are the admin)",
  "deviceSafety.travel.adminWarning":
    "You are the admin of {groups}. After deletion, your admin role is also removed from this phone. Make sure your admin recovery code is saved somewhere else (not on this phone); otherwise you will not be able to post announcements in this group.",
  "deviceSafety.travel.purgeButton": "Delete {count} selected groups",
  "deviceSafety.travel.purging": "Deleting…",
  "deviceSafety.travel.error": "Deletion did not complete. Please try again.",
  "deviceSafety.travel.doneTitle": "Deleted {count} groups",
  "deviceSafety.travel.doneHint": "When you are back, ask someone in the group for a new invite.",
  "deviceSafety.travel.doneButton": "Done",

  "deviceSafety.compromised.title": "This phone was out of my hands",
  "deviceSafety.compromised.intro":
    "If the phone was held, taken, or you were forced to unlock it in front of someone, they may have copied the data or installed spyware. Once spyware is installed, nothing done on this phone can be trusted.",
  "deviceSafety.compromised.stepsIntro": "Recommended steps:",
  "deviceSafety.compromised.step1":
    "From a clean device, tell the group admin that this phone is compromised. Ask them to remove it from the group and rotate the keys.",
  "deviceSafety.compromised.step2": "Wipe all data on this phone below.",
  "deviceSafety.compromised.step3":
    "Avoid using this phone for sensitive conversations. If needed, do a factory reset.",
  "deviceSafety.compromised.step4": "From a clean device, ask the admin to send you a new invite to rejoin.",
  "deviceSafety.compromised.note":
    "Wiping deletes all groups, chat history, group keys, admin roles, and the device master key. It cannot be undone. Admins: make sure your recovery code is saved somewhere else.",
  "deviceSafety.compromised.confirmLabel": "Type \"{word}\" to confirm",
  "deviceSafety.compromised.confirmWord": "WIPE",
  "deviceSafety.compromised.wipeButton": "Wipe all data on this phone",
  "deviceSafety.compromised.wiping": "Wiping…",
  "deviceSafety.compromised.error":
    "Wipe did not complete. Please try again; if it still fails, clear this app's data in the system settings.",
};

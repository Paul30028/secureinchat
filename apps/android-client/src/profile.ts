import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 个人资料（昵称）。
 *
 * 需求第七节：首次个人设置只能出现一次，以后加入其他群聊不得重复要求设置。
 * 所以昵称存在设备本地、和群无关——换群不用重设。
 *
 * 昵称不是秘密（群里所有人都会看到），所以直接存 IndexedDB，不走加密存储。
 */

const NICKNAME_KEY = "profile:nickname";

const backend = new IndexedDbStorageBackend();

export const NICKNAME_MAX_LENGTH = 20;

/** 第一人称称呼：自己看着没问题，别人看到的却是"我发的消息" */
const FIRST_PERSON_NAMES = new Set(["我", "本人", "自己", "me", "Me", "ME", "myself"]);

export type NicknameValidation = { ok: true } | { ok: false; reason: string };

export function validateNickname(raw: string): NicknameValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "昵称不能为空" };
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, reason: `昵称最多 ${NICKNAME_MAX_LENGTH} 个字` };
  }
  // "我""本人"这类第一人称在别人手机上会显示成消息的发送人，
  // 结果每个人看到的都是"我"，反而分不清是谁。
  if (FIRST_PERSON_NAMES.has(trimmed)) {
    return { ok: false, reason: "换一个别人能认出你的名字——群里其他人看到的就是这个" };
  }
  return { ok: true };
}

export async function loadNickname(): Promise<string | undefined> {
  try {
    const bytes = await backend.get(NICKNAME_KEY);
    return bytes ? new TextDecoder().decode(bytes) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveNickname(nickname: string): Promise<void> {
  await backend.set(NICKNAME_KEY, new TextEncoder().encode(nickname.trim()));
}

export async function clearNickname(): Promise<void> {
  await backend.delete(NICKNAME_KEY);
}

/**
 * 显示用的名字：优先昵称，没有就退回设备 ID 的短前缀。
 * 直接把完整 deviceId（device-<uuid>）显示在聊天气泡上太长也不可读。
 */
export function displayNameFor(nickname: string | undefined, deviceId: string): string {
  if (nickname?.trim()) return nickname.trim();
  const short = deviceId.replace(/^device-/, "").slice(0, 6);
  return `用户${short}`;
}

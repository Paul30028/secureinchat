/**
 * 群设置页的管理员入口和「重新生成邀请卡片」的状态（从 App.tsx 拆出，K6）。
 */
import { useEffect, useState } from "react";
import { buildInviteForGroup, loadJoinedGroups } from "@secureinchat/chat-core";
import { loadAdminKey } from "../adminKeys";
import { getDeviceStore } from "../deviceIdentity";
import { t } from "../i18n";

export type GroupInviteState =
  | { status: "loading" }
  | { status: "ready"; groupName: string; inviteCode: string }
  | { status: "error"; message: string };

/**
 * @param settingsGroupId 正在看群设置或邀请卡片的群；不在这两页时为 null
 * @param inviteGroupId 正在看邀请卡片的群；不在邀请卡片页时为 null
 */
export function useGroupInvite(settingsGroupId: string | null, inviteGroupId: string | null) {
  // 群设置页是否显示「邀请新成员」——只看这个群的管理员私钥，不用全局的
  // holdsAdminKey。那个是"有没有任意群的管理员权限"，拿到另一个群的管理员
  // 私钥也能通过，会让非管理员看到不该看到的入口。
  const [groupSettingsAdminAvailable, setGroupSettingsAdminAvailable] = useState(false);
  const [groupInviteState, setGroupInviteState] = useState<GroupInviteState>({ status: "loading" });


  useEffect(() => {
    if (!settingsGroupId) {
      setGroupSettingsAdminAvailable(false);
      return;
    }
    let cancelled = false;
    void loadAdminKey(settingsGroupId).then((key) => {
      if (!cancelled) setGroupSettingsAdminAvailable(Boolean(key));
    });
    return () => {
      cancelled = true;
    };
  }, [settingsGroupId]);

  // 重新生成邀请卡片：打开时读一次 JoinedGroup 里的密钥材料和 epoch，
  // 现算邀请串；找不到这个群就报错，不显示空卡片。
  useEffect(() => {
    if (!inviteGroupId) return;
    let cancelled = false;
    setGroupInviteState({ status: "loading" });
    void (async () => {
      try {
        const store = await getDeviceStore();
        const groups = await loadJoinedGroups(store);
        const group = groups.find((g) => g.groupId === inviteGroupId);
        if (!group) {
          if (!cancelled) {
            setGroupInviteState({
              status: "error",
              message: t("groupInvite.noKeyMaterial"),
            });
          }
          return;
        }
        const inviteCode = buildInviteForGroup({
          groupId: group.groupId,
          groupName: group.groupName,
          keyMaterialB64Url: group.keyMaterialB64Url,
          epoch: group.epoch,
          adminPublicKeyRawB64Url: group.adminPublicKeyRawB64Url,
        });
        if (!cancelled) {
          setGroupInviteState({ status: "ready", groupName: group.groupName, inviteCode });
        }
      } catch (err) {
        if (!cancelled) {
          setGroupInviteState({
            status: "error",
            message: err instanceof Error ? err.message : t("groupInvite.failed"),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteGroupId]);

  return { groupSettingsAdminAvailable, groupInviteState };
}

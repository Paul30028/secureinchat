import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";

/**
 * 设备安全（包 1）：空手过境（P1b）和「这台手机曾离开过我」（P1c）。
 *
 * 原则：真删，不藏。不做伪装界面、假密码这类东西——藏起来的数据被找到时，
 * 对用户的风险更大。删完不留任何「删过哪些群」的记录。
 */

export interface SafetyGroup {
  groupId: string;
  groupName: string;
  /** 本机持有这个群的管理员身份 */
  isAdmin: boolean;
}

export interface DeviceSafetyScreenProps {
  groups: SafetyGroup[];
  onBack: () => void;
  /** 删除选中的群在本机的全部数据，返回实际删掉的群数 */
  onPurgeGroups: (groupIds: string[]) => Promise<number>;
  /** 删除本机全部数据（含设备主密钥），之后 App 会重新启动 */
  onWipeAll: () => Promise<void>;
}

type Mode = "home" | "travel" | "travelDone" | "compromised";

const CONFIRM_WORD = "清除";

const p = { fontSize: 13, color: colors.textPrimary, lineHeight: 1.7, margin: 0 };
const note = { fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: 0 };
const warn = { fontSize: 12, color: "#A33", lineHeight: 1.7, margin: 0 };
const card = {
  minHeight: touchTarget.minDp,
  textAlign: "left" as const,
  background: "transparent",
  border: `0.5px solid ${colors.sageMint}`,
  borderRadius: 12,
  padding: "12px 14px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
};

export function DeviceSafetyScreen({ groups, onBack, onPurgeGroups, onWipeAll }: DeviceSafetyScreenProps) {
  const [mode, setMode] = useState<Mode>("home");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgedCount, setPurgedCount] = useState(0);
  const [confirmText, setConfirmText] = useState("");

  const selectedAdmin = groups.filter((g) => g.isAdmin && selected.includes(g.groupId));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function purge() {
    setBusy(true);
    setError(null);
    try {
      const n = await onPurgeGroups(selected);
      setPurgedCount(n);
      setSelected([]);
      setMode("travelDone");
    } catch {
      setError("删除没有完成，请再试一次");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    setError(null);
    try {
      await onWipeAll();
    } catch {
      setError("清除没有完成，请再试一次；如果仍然失败，请在系统设置里清除本应用的数据");
      setBusy(false);
    }
  }

  const back = () => (mode === "home" ? onBack() : (setMode("home"), setError(null), setConfirmText("")));

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={back}
        aria-label="返回"
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>

      {mode === "home" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>设备安全</h1>
          <p style={note}>
            手机被别人拿走、检查或扣留时，加密保护不了已经在手机里的东西。最安全的做法是让手机里本来就没有。
          </p>
          <button style={card} onClick={() => setMode("travel")}>
            <span style={{ fontSize: 14, color: colors.textPrimary }}>空手过境</span>
            <span style={{ fontSize: 11, color: "#9A9A94" }}>过境或可能被检查前，把选中的群从这台手机上彻底删除</span>
          </button>
          <button style={card} onClick={() => setMode("compromised")}>
            <span style={{ fontSize: 14, color: colors.textPrimary }}>这台手机曾离开过我</span>
            <span style={{ fontSize: 11, color: "#9A9A94" }}>被扣留、被拿走或被要求解锁过：清除全部数据，换设备重新入群</span>
          </button>
        </div>
      )}

      {mode === "travel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>空手过境</h1>
          <p style={p}>选中的群会从这台手机上彻底删除：聊天记录、群密钥、管理员身份都删掉，不留下「删过哪些群」的记录。</p>
          <p style={note}>
            之后想回到群里，请群里其他人给你一张新的邀请。以前的聊天记录不会回来。
            如果你导出过备份文件，它不归这个 App 管，请自己删掉。
          </p>
          {groups.length === 0 ? (
            <p style={note}>这台手机上没有群。</p>
          ) : (
            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend style={{ ...note, marginBottom: 8 }}>选择要删除的群</legend>
              {groups.map((g) => (
                <label
                  key={g.groupId}
                  style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(g.groupId)}
                    onChange={() => toggle(g.groupId)}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>
                    {g.groupName}
                    {g.isAdmin ? <span style={{ fontSize: 11, color: "#8A8A82" }}>（你是管理员）</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {selectedAdmin.length > 0 && (
            <p style={warn} role="alert">
              你是「{selectedAdmin.map((g) => g.groupName).join("、")}」的管理员。删除后，这台手机上的管理员身份也会删除。
              请先确认管理员恢复码保存在别处（不在这台手机里），否则以后就不能再在这个群里发公告。
            </p>
          )}
          {error && <p style={warn} role="alert">{error}</p>}
          <Button disabled={selected.length === 0 || busy} onClick={() => void purge()}>
            {busy ? "正在删除…" : `删除选中的 ${selected.length} 个群`}
          </Button>
        </div>
      )}

      {mode === "travelDone" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>已删除 {purgedCount} 个群</h1>
          <p style={note}>回来以后，请群里其他人给你一张新的邀请。</p>
          <Button onClick={onBack}>完成</Button>
        </div>
      )}

      {mode === "compromised" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>这台手机曾离开过我</h1>
          <p style={p}>
            手机被扣留、被拿走，或者你被要求当面解锁过，别人可能已经复制了里面的数据，甚至装了监控软件。
            监控软件装上以后，在这台手机上做什么都不再可信。
          </p>
          <p style={p}>建议这样做：</p>
          <ol style={{ ...p, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>用一台干净的设备告诉群管理员：这台手机已失守，请把它移出群并换钥匙。</li>
            <li>在下面清除这台手机上的全部数据。</li>
            <li>尽量不要再用这台手机交流敏感内容；需要的话恢复出厂设置。</li>
            <li>用干净的设备，请管理员发新邀请重新入群。</li>
          </ol>
          <p style={note}>
            清除会删掉所有群、聊天记录、群密钥、管理员身份和设备主密钥，无法恢复。管理员请确认恢复码保存在别处。
          </p>
          <label style={{ ...note, display: "flex", flexDirection: "column", gap: 6 }}>
            输入「{CONFIRM_WORD}」确认
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                minHeight: touchTarget.minDp,
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 14,
                padding: "0 16px",
                fontSize: 14,
                background: colors.ivory,
                color: colors.textPrimary,
              }}
            />
          </label>
          {error && <p style={warn} role="alert">{error}</p>}
          <Button disabled={confirmText.trim() !== CONFIRM_WORD || busy} onClick={() => void wipe()}>
            {busy ? "正在清除…" : "清除这台手机上的全部数据"}
          </Button>
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";

/** 备份密码最短长度。和 chat-core 的 MIN_BACKUP_PASSWORD_LENGTH 保持一致。 */
const MIN_BACKUP_PASSWORD_LENGTH = 10;

export interface RestorePreview {
  /** 将新添加的群（本机原来没有的） */
  groups: number;
  /** 将写入这些新群的消息条数 */
  messages: number;
  /** 备份里有、但本机已有而保持不动的群 */
  skipped?: number | undefined;
}

export interface BackupScreenProps {
  onBack: () => void;
  /** 导出：读存储、生成加密备份文本。密码太短或存储读取失败时抛错。 */
  onExport: (password: string) => Promise<string>;
  /** 解密备份文件，返回预览（不落盘）。解密失败时抛错。 */
  onPreviewRestore: (text: string, password: string) => Promise<RestorePreview>;
  /** 确认合并：使用最近一次 onPreviewRestore 的结果。 */
  onConfirmRestore: () => Promise<void>;
}

function formatDateForFilename(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放：某些浏览器在 click 后同步 revoke 会导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const inputStyle = {
  minHeight: touchTarget.minDp,
  width: "100%",
  boxSizing: "border-box" as const,
  border: `0.5px solid ${colors.sageMint}`,
  borderRadius: 14,
  padding: "0 16px",
  fontSize: 14,
  background: colors.ivory,
  color: colors.textPrimary,
  boxShadow: "none",
};

const errorStyle = {
  color: "#A33",
  fontSize: 12,
  margin: 0,
  lineHeight: 1.6,
};

const successStyle = {
  color: colors.deepInkGreen,
  fontSize: 12,
  margin: 0,
  lineHeight: 1.6,
};

type Mode = "export" | "restore";

/**
 * 加密备份与恢复。
 *
 * 备份里有群和聊天记录，用用户设的密码加密（PBKDF2 + AES-GCM）。
 * 不包含设备身份密钥（在系统 Keystore 里，不可导出）和管理员私钥
 * （走「管理员恢复码」这条路）。正在倒计时的阅后即焚消息也不备份——
 * 对方期望它到点消失。
 *
 * 导出：输两遍密码 → 生成加密文本 → 用 a[download] 触发浏览器下载。
 * 恢复：选文件 → 输密码 → 解密并预览（N 个群、M 条消息）→ 确认后合并。
 */
export function BackupScreen({ onBack, onExport, onPreviewRestore, onConfirmRestore }: BackupScreenProps) {
  const [mode, setMode] = useState<Mode>("export");

  // 导出状态
  const [exportPassword, setExportPassword] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // 恢复状态
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExportError(null);
    setExportDone(false);
    if (exportPassword.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setExportError(`备份密码至少 ${MIN_BACKUP_PASSWORD_LENGTH} 个字符`);
      return;
    }
    if (exportPassword !== exportConfirm) {
      setExportError("两次输入的密码不一致");
      return;
    }
    setExportBusy(true);
    try {
      const text = await onExport(exportPassword);
      const filename = `secureinchat-backup-${formatDateForFilename(new Date())}.json`;
      downloadText(filename, text);
      setExportDone(true);
      setExportPassword("");
      setExportConfirm("");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "生成备份失败，请重试");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleFileChosen(file: File) {
    setRestoreError(null);
    setPreview(null);
    setRestoreDone(false);
    try {
      const text = await readFileAsText(file);
      setRestoreText(text);
      setRestoreFileName(file.name);
    } catch {
      setRestoreError("读取文件失败");
      setRestoreText(null);
      setRestoreFileName("");
    }
  }

  async function handlePreview() {
    if (!restoreText) return;
    setRestoreError(null);
    setPreview(null);
    setRestoreDone(false);
    setRestoreBusy(true);
    try {
      const result = await onPreviewRestore(restoreText, restorePassword);
      setPreview(result);
    } catch (err) {
      // 解密失败统一提示，不区分「密码错」和「文件被改」
      setRestoreError(err instanceof Error ? err.message : "密码不对，或文件已损坏");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function handleConfirmRestore() {
    setRestoreError(null);
    setRestoreBusy(true);
    try {
      await onConfirmRestore();
      setRestoreDone(true);
      setPreview(null);
      setRestoreText(null);
      setRestorePassword("");
      setRestoreFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "恢复失败，请重试");
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={onBack}
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

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 8px" }}>备份与恢复</h1>
      <p style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: "0 0 20px" }}>
        备份里有你的群和聊天记录，用你设的密码加密。忘记密码就无法恢复。
        设备密钥和管理员私钥不在备份里——管理员请另外保存好管理员恢复码。
        正在倒计时的阅后即焚消息不会被备份。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Button
          variant={mode === "export" ? "primary" : "secondary"}
          onClick={() => setMode("export")}
          style={{ flex: 1 }}
        >
          导出备份
        </Button>
        <Button
          variant={mode === "restore" ? "primary" : "secondary"}
          onClick={() => setMode("restore")}
          style={{ flex: 1 }}
        >
          从备份恢复
        </Button>
      </div>

      {mode === "export" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, color: colors.textPrimary }}>设置备份密码</div>
          <input
            type="password"
            value={exportPassword}
            onChange={(e) => {
              setExportPassword(e.target.value);
              setExportError(null);
              setExportDone(false);
            }}
            aria-label="备份密码输入框"
            placeholder={`至少 ${MIN_BACKUP_PASSWORD_LENGTH} 个字符`}
            style={inputStyle}
          />
          <input
            type="password"
            value={exportConfirm}
            onChange={(e) => {
              setExportConfirm(e.target.value);
              setExportError(null);
              setExportDone(false);
            }}
            aria-label="再次输入备份密码"
            placeholder="再输一次"
            style={inputStyle}
          />
          {exportError ? (
            <p role="alert" style={errorStyle}>
              {exportError}
            </p>
          ) : null}
          {exportDone ? (
            <p role="status" style={successStyle}>
              备份已下载。请把文件放到安全的地方——密码忘了就打不开了。
            </p>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void handleExport()}
            disabled={exportBusy || exportPassword.length === 0 || exportConfirm.length === 0}
          >
            {exportBusy ? "生成中..." : "生成备份文件"}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, color: colors.textPrimary }}>选择备份文件</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileChosen(file);
            }}
            aria-label="选择备份文件"
            style={{
              minHeight: touchTarget.minDp,
              fontSize: 13,
              color: colors.textPrimary,
            }}
          />
          {restoreFileName ? (
            <p style={{ fontSize: 11, color: "#9A9A94", margin: 0 }}>已选择：{restoreFileName}</p>
          ) : null}

          <div style={{ fontSize: 14, color: colors.textPrimary, marginTop: 8 }}>输入备份密码</div>
          <input
            type="password"
            value={restorePassword}
            onChange={(e) => {
              setRestorePassword(e.target.value);
              setRestoreError(null);
              setPreview(null);
            }}
            aria-label="恢复密码输入框"
            placeholder="导出时设置的密码"
            style={inputStyle}
          />

          {restoreError ? (
            <p role="alert" style={errorStyle}>
              {restoreError}
            </p>
          ) : null}

          {preview ? (
            <div
              style={{
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "12px 14px",
                background: `${colors.sageMint}22`,
              }}
            >
              <p style={{ fontSize: 13, color: colors.textPrimary, margin: 0 }}>
                将恢复 {preview.groups} 个群、{preview.messages} 条消息。
              </p>
              {preview.skipped ? (
                <p style={{ fontSize: 12, color: colors.textPrimary, margin: "6px 0 0" }}>
                  另有 {preview.skipped} 个群本机已有，保持不变，不导入它们的旧记录。
                </p>
              ) : null}
              <p style={{ fontSize: 11, color: "#9A9A94", margin: "6px 0 0", lineHeight: 1.6 }}>
                只添加本机没有的群，不会改动已有的群和消息。恢复后会自动重连新添加的群。
              </p>
            </div>
          ) : null}

          {restoreDone ? (
            <p role="status" style={successStyle}>
              恢复完成。回到消息列表就能看到恢复的群。
            </p>
          ) : null}

          {!preview ? (
            <Button
              variant="primary"
              onClick={() => void handlePreview()}
              disabled={restoreBusy || !restoreText || restorePassword.length === 0}
            >
              {restoreBusy ? "解密中..." : "解密并预览"}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void handleConfirmRestore()} disabled={restoreBusy}>
              {restoreBusy ? "恢复中..." : "确认恢复"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * File.text() only exists from Chrome 76; older Android System WebViews (and jsdom) lack it.
 * FileReader works everywhere, so use it when text() is missing.
 */
function readFileAsText(file: File): Promise<string> {
  if (typeof (file as { text?: unknown }).text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}

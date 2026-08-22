import { useEffect, useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { validateRelayUrl, saveRelayUrl, loadSavedRelayUrl, clearSavedRelayUrl } from "../relayUrlSetting";

export interface ServerSettingsScreenProps {
  /** 构建时注入的默认地址，用户没自定义时用这个 */
  defaultUrl: string;
  onSaved: (url: string) => void;
  onBack: () => void;
}

/**
 * 服务器地址设置。之所以要有这一页：地址如果只能构建时注入，换一次中继就要
 * 重新打一次 APK，团队成员也没法自己填。
 */
export function ServerSettingsScreen({ defaultUrl, onSaved, onBack }: ServerSettingsScreenProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const isSecurePage = typeof location !== "undefined" && location.protocol === "https:";

  useEffect(() => {
    void loadSavedRelayUrl().then((saved) => setUrl(saved ?? defaultUrl));
  }, [defaultUrl]);

  async function handleSave() {
    const result = validateRelayUrl(url, isSecurePage);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    await saveRelayUrl(url);
    setSavedNotice(true);
    onSaved(url.trim());
  }

  async function handleReset() {
    await clearSavedRelayUrl();
    setUrl(defaultUrl);
    setError(null);
    setSavedNotice(false);
    onSaved(defaultUrl);
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, padding: 24 }}>
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

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 8px" }}>服务器设置</h1>
      <p style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: "0 0 16px" }}>
        填写你们团队的中继服务器地址。改完保存后，下次连接就会用新地址，不需要重新安装应用。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
            setSavedNotice(false);
          }}
          placeholder="wss://ws.example.com"
          aria-label="中继服务器地址输入框"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            minHeight: touchTarget.minDp,
            border: `0.5px solid ${error ? "#A33" : colors.sageMint}`,
            borderRadius: 14,
            padding: "0 16px",
            fontSize: 14,
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
            fontFamily: "monospace",
          }}
        />

        {error ? (
          <p role="alert" style={{ color: "#A33", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            {error}
          </p>
        ) : null}
        {savedNotice ? (
          <p role="status" style={{ color: colors.deepInkGreen, fontSize: 12, margin: 0 }}>
            已保存
          </p>
        ) : null}

        <Button variant="primary" onClick={handleSave}>
          保存
        </Button>
        <Button variant="secondary" onClick={handleReset}>
          恢复默认（{defaultUrl}）
        </Button>
      </div>

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 20 }}>
        提示：如果这个页面是通过 https:// 打开的，服务器地址必须用 wss://，
        浏览器会拦截不加密的 ws:// 连接。
      </p>
    </div>
  );
}

import { useState } from "react";
import { colors, touchTarget, Button, Avatar } from "@secureinchat/ui";
import { validatePin, tryUnlock, enableLock, MAX_ATTEMPTS } from "../appLock";

export interface LockScreenProps {
  mode: "unlock" | "setup";
  onUnlocked: () => void;
  /** 设置模式下取消返回 */
  onCancel?: (() => void) | undefined;
  /** 尝试次数用尽时调用——清空本机数据的决定由调用方做 */
  onAttemptsExhausted?: (() => void) | undefined;
}

const inputStyle = {
  minHeight: touchTarget.minDp,
  width: "100%",
  boxSizing: "border-box" as const,
  border: `0.5px solid ${colors.sageMint}`,
  borderRadius: 14,
  padding: "0 16px",
  fontSize: 20,
  letterSpacing: "0.3em",
  textAlign: "center" as const,
  background: colors.ivory,
  color: colors.textPrimary,
  boxShadow: "none",
};

/**
 * 应用锁界面。解锁和设置共用一套——两者的输入和校验几乎一样，
 * 分成两个组件只会重复代码。
 */
export function LockScreen({ mode, onUnlocked, onCancel, onAttemptsExhausted }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "setup") {
        const check = validatePin(pin);
        if (!check.ok) {
          setError(check.reason);
          return;
        }
        if (pin !== confirmPin) {
          setError("两次输入的密码不一致");
          return;
        }
        await enableLock(pin);
        onUnlocked();
        return;
      }

      const result = await tryUnlock(pin);
      if (result.ok) {
        onUnlocked();
        return;
      }
      setPin("");
      setAttemptsLeft(result.attemptsLeft);
      if (result.attemptsLeft === 0) {
        onAttemptsExhausted?.();
        setError("尝试次数已用尽");
      } else {
        setError(`密码不正确，还可以尝试 ${result.attemptsLeft} 次`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: colors.ivory,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
      }}
    >
      <Avatar name="secureinchat" size="large" />
      <div style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary }}>
        {mode === "setup" ? "设置应用密码" : "输入应用密码"}
      </div>
      {mode === "setup" ? (
        <p style={{ fontSize: 12, color: "#8A8A82", textAlign: "center", lineHeight: 1.7, margin: 0 }}>
          手机被别人拿到时，需要这个密码才能打开。
          <br />
          忘记密码只能清除数据重来，没有找回方式。
        </p>
      ) : null}

      <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(null);
          }}
          aria-label={mode === "setup" ? "设置密码输入框" : "应用密码输入框"}
          placeholder="••••"
          style={inputStyle}
        />
        {mode === "setup" ? (
          <input
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value);
              setError(null);
            }}
            aria-label="再次输入密码"
            placeholder="再输一次"
            style={inputStyle}
          />
        ) : null}

        {error ? (
          <p role="alert" style={{ color: "#A33", fontSize: 12, margin: 0, textAlign: "center" }}>
            {error}
          </p>
        ) : null}
        {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft <= 3 && !error ? (
          <p style={{ color: colors.wheatGold, fontSize: 12, margin: 0, textAlign: "center" }}>
            还可以尝试 {attemptsLeft} 次
          </p>
        ) : null}

        <Button variant="primary" onClick={() => void handleSubmit()} disabled={busy || pin.length === 0}>
          {mode === "setup" ? "启用" : "解锁"}
        </Button>

        {onCancel ? (
          <button
            onClick={onCancel}
            style={{
              minHeight: touchTarget.minDp,
              background: "transparent",
              border: "none",
              boxShadow: "none",
              color: "#8A8A82",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            取消
          </button>
        ) : null}
      </div>

      {mode === "unlock" ? (
        <p style={{ fontSize: 11, color: "#9A9A94", textAlign: "center", marginTop: 12 }}>
          连续输错 {MAX_ATTEMPTS} 次将清除本机数据
        </p>
      ) : null}
    </div>
  );
}

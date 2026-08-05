import { useState, type FormEvent, type KeyboardEvent } from "react";
import { colors, touchTarget } from "../tokens";
import { Button } from "./Button";

export interface ComposerProps {
  onSend: (text: string) => void;
  /**
   * 输入框为空时，发送按钮的位置改为显示录音按钮——同一个槽位按状态切换，
   * 而不是把两个按钮并排常驻。这是从 Signal 的 AnimatingToggle 借来的模式：
   * 任何时刻这个位置只有一个动作，而那个动作正好是你当下想做的。
   * 不传这个回调就退化成"永远是发送按钮"。
   */
  onStartVoice?: (() => void) | undefined;
  placeholder?: string;
  /** 受控可选：不传就用内部 state 自己管（未受控用法，方便简单场景） */
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

/**
 * 消息输入栏。第六节要求"输入法不得遮挡发送栏"——这是原生 Android 布局层面的约束
 * （用 adjustResize/imePadding），组件本身只负责视觉和交互，不在这里模拟。
 */
export function Composer({
  onSend,
  onStartVoice,
  placeholder = "输入消息...",
  value,
  onChange,
  disabled,
}: ComposerProps) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = value !== undefined;
  const text = isControlled ? value : internalValue;

  function setText(next: string) {
    if (onChange) onChange(next);
    if (!isControlled) setInternalValue(next);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  const isEmpty = text.trim().length === 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", boxShadow: "none" }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="消息输入框"
        style={{
          flex: 1,
          minHeight: touchTarget.minDp,
          border: `0.5px solid ${colors.sageMint}`,
          borderRadius: 20,
          padding: "0 16px",
          fontSize: 14,
          background: colors.ivory,
          color: colors.textPrimary,
          boxShadow: "none",
        }}
      />
      {isEmpty && onStartVoice ? (
        <Button
          type="button"
          variant="primary"
          onClick={onStartVoice}
          disabled={disabled}
          aria-label="录制语音"
          style={{ minWidth: touchTarget.minDp, padding: 0 }}
        >
          🎤
        </Button>
      ) : (
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || isEmpty}
          style={{ minWidth: touchTarget.minDp }}
        >
          发送
        </Button>
      )}
    </form>
  );
}

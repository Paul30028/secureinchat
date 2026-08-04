import { useState, type FormEvent, type KeyboardEvent } from "react";
import { colors, touchTarget } from "../tokens";
import { Button } from "./Button";

export interface ComposerProps {
  onSend: (text: string) => void;
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
export function Composer({ onSend, placeholder = "输入消息...", value, onChange, disabled }: ComposerProps) {
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
      <Button
        type="submit"
        variant="primary"
        disabled={disabled || text.trim().length === 0}
        style={{ minWidth: touchTarget.minDp }}
      >
        发送
      </Button>
    </form>
  );
}

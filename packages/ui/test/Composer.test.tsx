import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "../src/components/Composer";

describe("Composer", () => {
  it("calls onSend with the trimmed text and clears the input", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const input = screen.getByLabelText("消息输入框") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  收到，谢谢  " } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(onSend).toHaveBeenCalledWith("收到，谢谢");
    expect(input.value).toBe("");
  });

  it("does not call onSend for empty or whitespace-only input", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const sendButton = screen.getByRole("button", { name: "发送" });
    expect(sendButton).toBeDisabled();
    fireEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends on Enter key (without shift)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const input = screen.getByLabelText("消息输入框");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("does not send on Shift+Enter (allows multi-line intent)", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    const input = screen.getByLabelText("消息输入框");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("supports controlled usage via value/onChange", () => {
    const onChange = vi.fn();
    render(<Composer onSend={() => {}} value="preset" onChange={onChange} />);
    const input = screen.getByLabelText("消息输入框") as HTMLInputElement;
    expect(input.value).toBe("preset");
    fireEvent.change(input, { target: { value: "preset more" } });
    expect(onChange).toHaveBeenCalledWith("preset more");
  });

  it("shows the given placeholder", () => {
    render(<Composer onSend={() => {}} placeholder="说点什么..." />);
    expect(screen.getByPlaceholderText("说点什么...")).toBeInTheDocument();
  });

  it("disables input and send button when disabled prop is set", () => {
    render(<Composer onSend={() => {}} disabled value="x" onChange={() => {}} />);
    expect(screen.getByLabelText("消息输入框")).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });

  it("the send button meets the 48dp minimum touch target", () => {
    render(<Composer onSend={() => {}} value="x" onChange={() => {}} />);
    const btn = screen.getByRole("button", { name: "发送" });
    expect(btn.style.minWidth).toBe("48px");
  });
});

describe("Composer mic/send slot swap", () => {
  it("shows 录制语音 in the send slot while the input is empty", () => {
    render(<Composer onSend={() => {}} onStartVoice={() => {}} />);
    expect(screen.getByLabelText("录制语音")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发送" })).not.toBeInTheDocument();
  });

  it("swaps to 发送 as soon as something is typed", () => {
    render(<Composer onSend={() => {}} onStartVoice={() => {}} />);
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "你好" } });

    expect(screen.getByRole("button", { name: "发送" })).toBeInTheDocument();
    expect(screen.queryByLabelText("录制语音")).not.toBeInTheDocument();
  });

  it("swaps back to the mic when the text is cleared", () => {
    render(<Composer onSend={() => {}} onStartVoice={() => {}} />);
    const input = screen.getByLabelText("消息输入框");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.getByLabelText("录制语音")).toBeInTheDocument();
  });

  it("treats whitespace-only input as empty (still shows the mic)", () => {
    render(<Composer onSend={() => {}} onStartVoice={() => {}} />);
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "   " } });
    expect(screen.getByLabelText("录制语音")).toBeInTheDocument();
  });

  it("calls onStartVoice when the mic is tapped", () => {
    const onStartVoice = vi.fn();
    render(<Composer onSend={() => {}} onStartVoice={onStartVoice} />);
    fireEvent.click(screen.getByLabelText("录制语音"));
    expect(onStartVoice).toHaveBeenCalledTimes(1);
  });

  it("falls back to a permanently disabled 发送 button when no voice handler is given", () => {
    render(<Composer onSend={() => {}} />);
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
    expect(screen.queryByLabelText("录制语音")).not.toBeInTheDocument();
  });
});

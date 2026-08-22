import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatBubble } from "../src/components/ChatBubble";
import { colors } from "../src/tokens";

describe("ChatBubble", () => {
  it("renders message content and time", () => {
    render(
      <ChatBubble isOwn={false} timeLabel="08:35">
        早安，今天线上交流
      </ChatBubble>
    );
    expect(screen.getByText("早安，今天线上交流")).toBeInTheDocument();
    expect(screen.getByText("08:35")).toBeInTheDocument();
  });

  it("uses the deep ink green background for own messages", () => {
    render(
      <ChatBubble isOwn timeLabel="08:35">
        收到
      </ChatBubble>
    );
    const bubble = screen.getByText("收到");
    expect(bubble.style.background).toBe("rgb(72, 101, 73)"); // colors.deepInkGreen
  });

  it("uses the ivory background with a border for other people's messages", () => {
    render(
      <ChatBubble isOwn={false} timeLabel="08:35">
        收到
      </ChatBubble>
    );
    const bubble = screen.getByText("收到");
    expect(bubble.style.background).toBe("rgb(235, 236, 229)"); // colors.ivory
    expect(bubble.style.border).not.toBe("");
  });

  it("shows the sender name only for other people's messages when provided", () => {
    render(
      <ChatBubble isOwn={false} timeLabel="08:40" senderName="李阳">
        content
      </ChatBubble>
    );
    expect(screen.getByText("李阳")).toBeInTheDocument();
  });

  it("does not show a sender name for own messages even if passed", () => {
    render(
      <ChatBubble isOwn timeLabel="08:40" senderName="李阳">
        content
      </ChatBubble>
    );
    expect(screen.queryByText("李阳")).not.toBeInTheDocument();
  });

  it("shows status ticks only for own messages with a status", () => {
    const { container, rerender } = render(
      <ChatBubble isOwn timeLabel="08:40" status="sent">
        x
      </ChatBubble>
    );
    expect(container.querySelector("svg")).toBeInTheDocument();

    rerender(
      <ChatBubble isOwn={false} timeLabel="08:40">
        x
      </ChatBubble>
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("labels the status tick with the correct Chinese text for accessibility", () => {
    render(
      <ChatBubble isOwn timeLabel="08:40" status="read">
        x
      </ChatBubble>
    );
    expect(screen.getByTitle("已读")).toBeInTheDocument();
  });

  it("never applies a box-shadow to the bubble", () => {
    render(
      <ChatBubble isOwn timeLabel="08:40">
        x
      </ChatBubble>
    );
    expect(screen.getByText("x").style.boxShadow).toBe("none");
  });
});

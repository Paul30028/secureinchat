import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageListItem } from "../src/components/MessageListItem";

describe("MessageListItem", () => {
  it("renders name, preview text, and time", () => {
    render(<MessageListItem name="同心同行" previewText="早安，今天线上交流" timeLabel="09:30" />);
    expect(screen.getByText("同心同行")).toBeInTheDocument();
    expect(screen.getByText("早安，今天线上交流")).toBeInTheDocument();
    expect(screen.getByText("09:30")).toBeInTheDocument();
  });

  it("calls onClick when tapped (whole row is clickable)", () => {
    const onClick = vi.fn();
    render(<MessageListItem name="A" previewText="p" timeLabel="t" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the unread badge when unreadCount is set", () => {
    render(<MessageListItem name="A" previewText="p" timeLabel="t" unreadCount={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides the unread badge when unreadCount is zero or unset", () => {
    render(<MessageListItem name="A" previewText="p" timeLabel="t" unreadCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("caps the unread badge at 99+", () => {
    render(<MessageListItem name="A" previewText="p" timeLabel="t" unreadCount={150} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("meets the 48dp minimum touch target", () => {
    render(<MessageListItem name="A" previewText="p" timeLabel="t" />);
    expect(screen.getByRole("button").style.minHeight).toBe("48px");
  });

  it("never applies a box-shadow", () => {
    render(<MessageListItem name="A" previewText="p" timeLabel="t" unreadCount={3} />);
    expect(screen.getByRole("button").style.boxShadow).toBe("none");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomNav } from "../src/components/BottomNav";

describe("BottomNav", () => {
  it("renders exactly three tabs: 公告/消息/我的, no more, no less", () => {
    render(<BottomNav active="messages" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByText("公告")).toBeInTheDocument();
    expect(screen.getByText("消息")).toBeInTheDocument();
    expect(screen.getByText("我的")).toBeInTheDocument();
  });

  it("calls onChange with the tapped tab key", () => {
    const onChange = vi.fn();
    render(<BottomNav active="messages" onChange={onChange} />);
    fireEvent.click(screen.getByText("我的"));
    expect(onChange).toHaveBeenCalledWith("me");
  });

  it("marks the active tab via aria-selected", () => {
    render(<BottomNav active="announcements" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    const activeTab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    expect(activeTab).toBeDefined();
    expect(activeTab).toHaveTextContent("公告");
  });

  it("shows an unread badge only on the 消息 tab when unreadCount is set", () => {
    render(<BottomNav active="messages" onChange={() => {}} unreadCount={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("caps the unread badge display at 99+", () => {
    render(<BottomNav active="messages" onChange={() => {}} unreadCount={150} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("every tab meets the 48dp minimum touch target", () => {
    render(<BottomNav active="messages" onChange={() => {}} />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.style.minHeight).toBe("48px");
      expect(tab.style.minWidth).toBe("48px");
    }
  });
});

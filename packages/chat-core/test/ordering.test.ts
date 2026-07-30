import { describe, expect, it } from "vitest";
import { MessageOrderer, ReplayGuard } from "../src/ordering";

describe("ReplayGuard", () => {
  it("accepts a seq the first time and rejects it as a replay the second time", () => {
    const guard = new ReplayGuard();
    expect(guard.check("alice", 0, 1)).toBe("accepted");
    expect(guard.check("alice", 0, 1)).toBe("replay");
  });

  it("tracks each sender independently", () => {
    const guard = new ReplayGuard();
    expect(guard.check("alice", 0, 1)).toBe("accepted");
    expect(guard.check("bob", 0, 1)).toBe("accepted");
  });

  it("tracks each epoch independently (post-rotation seq 1 is not a replay of pre-rotation seq 1)", () => {
    const guard = new ReplayGuard();
    expect(guard.check("alice", 0, 1)).toBe("accepted");
    expect(guard.check("alice", 1, 1)).toBe("accepted");
  });

  it("accepts out-of-order seqs without falsely flagging replay", () => {
    const guard = new ReplayGuard();
    expect(guard.check("alice", 0, 5)).toBe("accepted");
    expect(guard.check("alice", 0, 3)).toBe("accepted");
    expect(guard.check("alice", 0, 4)).toBe("accepted");
    expect(guard.check("alice", 0, 5)).toBe("replay");
  });

  it("forgetEpoch clears state so memory does not grow forever across rotations", () => {
    const guard = new ReplayGuard();
    guard.check("alice", 0, 1);
    guard.forgetEpoch("alice", 0);
    // Same seq in the same (now-forgotten) epoch is accepted again — this is fine because
    // rotation means the sender can never actually reuse epoch 0 for new messages.
    expect(guard.check("alice", 0, 1)).toBe("accepted");
  });
});

describe("MessageOrderer", () => {
  it("delivers in-order messages immediately", () => {
    const orderer = new MessageOrderer<string>();
    const out1 = orderer.submit({ senderId: "alice", epoch: 0, seq: 0, payload: "a" });
    expect(out1.map((e) => e.payload)).toEqual(["a"]);
    const out2 = orderer.submit({ senderId: "alice", epoch: 0, seq: 1, payload: "b" });
    expect(out2.map((e) => e.payload)).toEqual(["b"]);
  });

  it("buffers out-of-order messages until the gap is filled, then delivers in order", () => {
    const orderer = new MessageOrderer<string>();
    const out1 = orderer.submit({ senderId: "alice", epoch: 0, seq: 2, payload: "c" });
    expect(out1).toEqual([]); // seq 0 and 1 haven't arrived yet

    const out2 = orderer.submit({ senderId: "alice", epoch: 0, seq: 1, payload: "b" });
    expect(out2).toEqual([]); // still waiting on seq 0

    const out3 = orderer.submit({ senderId: "alice", epoch: 0, seq: 0, payload: "a" });
    expect(out3.map((e) => e.payload)).toEqual(["a", "b", "c"]);
  });

  it("hasPendingGap reflects buffered-but-undeliverable state", () => {
    const orderer = new MessageOrderer<string>();
    orderer.submit({ senderId: "alice", epoch: 0, seq: 3, payload: "d" });
    expect(orderer.hasPendingGap("alice", 0)).toBe(true);
    orderer.submit({ senderId: "alice", epoch: 0, seq: 0, payload: "a" });
    orderer.submit({ senderId: "alice", epoch: 0, seq: 1, payload: "b" });
    orderer.submit({ senderId: "alice", epoch: 0, seq: 2, payload: "c" });
    expect(orderer.hasPendingGap("alice", 0)).toBe(false);
  });

  it("keeps separate ordering state per sender and per epoch", () => {
    const orderer = new MessageOrderer<string>();
    const out1 = orderer.submit({ senderId: "alice", epoch: 0, seq: 0, payload: "a0" });
    const out2 = orderer.submit({ senderId: "bob", epoch: 0, seq: 0, payload: "b0" });
    expect(out1.map((e) => e.payload)).toEqual(["a0"]);
    expect(out2.map((e) => e.payload)).toEqual(["b0"]);
  });
});

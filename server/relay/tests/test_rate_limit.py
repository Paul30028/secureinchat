import pytest

from app.rate_limit import (
    SlidingWindowLimiter,
    make_connection_limiter,
    make_message_limiter,
    CONNECTION_ATTEMPTS,
    MESSAGES_PER_DEVICE,
)


def test_allows_up_to_the_limit():
    limiter = SlidingWindowLimiter(3, 10.0)
    assert [limiter.allow("a", now=1.0) for _ in range(3)] == [True, True, True]


def test_blocks_past_the_limit():
    limiter = SlidingWindowLimiter(3, 10.0)
    for _ in range(3):
        limiter.allow("a", now=1.0)
    assert limiter.allow("a", now=1.0) is False


def test_recovers_once_the_window_passes():
    limiter = SlidingWindowLimiter(2, 10.0)
    limiter.allow("a", now=1.0)
    limiter.allow("a", now=2.0)
    assert limiter.allow("a", now=3.0) is False
    # 第一次的记录在 t=11.0 之后过期
    assert limiter.allow("a", now=11.5) is True


def test_blocked_attempts_do_not_extend_the_block():
    """超限时不记录事件——否则持续冲击会让窗口永远满着，
    正常流量恢复了也解不开。"""
    limiter = SlidingWindowLimiter(2, 10.0)
    limiter.allow("a", now=1.0)
    limiter.allow("a", now=1.0)
    for t in range(2, 10):
        limiter.allow("a", now=float(t))  # 全部被拒

    # 最初两次在 t=11 过期，此时应该立刻恢复
    assert limiter.allow("a", now=11.5) is True


def test_keys_are_independent():
    """一个设备刷屏不该影响别人"""
    limiter = SlidingWindowLimiter(1, 10.0)
    assert limiter.allow("alice", now=1.0) is True
    assert limiter.allow("alice", now=1.0) is False
    assert limiter.allow("bob", now=1.0) is True


def test_sliding_window_has_no_boundary_doubling():
    """固定窗口的经典漏洞：窗口末尾打满 + 下个窗口开头再打满 = 两倍的量。
    滑动窗口不该出现这种情况。"""
    limiter = SlidingWindowLimiter(5, 10.0)
    for _ in range(5):
        assert limiter.allow("a", now=9.9) is True
    # 固定窗口在 t=10 会重置计数；滑动窗口应该仍然拒绝
    assert limiter.allow("a", now=10.1) is False


def test_forget_releases_state():
    limiter = SlidingWindowLimiter(1, 10.0)
    limiter.allow("a", now=1.0)
    assert limiter.active_keys() == 1
    limiter.forget("a")
    assert limiter.active_keys() == 0


def test_rejects_nonsensical_configuration():
    with pytest.raises(ValueError):
        SlidingWindowLimiter(0, 10.0)
    with pytest.raises(ValueError):
        SlidingWindowLimiter(5, 0)


def test_connection_limiter_tolerates_normal_reconnect_backoff():
    """客户端重连退避是 3s → 5/10/20/30s，30 秒内最多几次，
    远达不到限制。"""
    limiter = make_connection_limiter()
    for t in [0.0, 3.0, 8.0, 18.0]:
        assert limiter.allow("1.2.3.4", now=t) is True


def test_connection_limiter_blocks_a_reconnect_storm():
    limiter = make_connection_limiter()
    results = [limiter.allow("1.2.3.4", now=0.0) for _ in range(CONNECTION_ATTEMPTS + 5)]
    assert results.count(True) == CONNECTION_ATTEMPTS
    assert results[-1] is False


def test_message_limiter_allows_a_burst_of_file_chunks():
    """发文件会连续发很多分片，限流不能把正常传输掐死"""
    limiter = make_message_limiter()
    allowed = sum(1 for _ in range(MESSAGES_PER_DEVICE) if limiter.allow("device-1", now=0.0))
    assert allowed == MESSAGES_PER_DEVICE


def test_message_limiter_blocks_a_flood():
    limiter = make_message_limiter()
    for _ in range(MESSAGES_PER_DEVICE):
        limiter.allow("device-1", now=0.0)
    assert limiter.allow("device-1", now=0.0) is False
    # 下一秒恢复
    assert limiter.allow("device-1", now=1.1) is True


# ---- 端到端：限流真的接进了连接流程 ----

import asyncio
import json

import websockets
import websockets.asyncio.server as ws_server

from app.auth import PlaceholderHmacVerifier
from app.server import RelayServer

TEST_SECRET = b"rate-limit-test-secret"


@pytest.fixture
async def running_server():
    verifier = PlaceholderHmacVerifier(TEST_SECRET)
    relay = RelayServer(verifier)
    server = await ws_server.serve(relay.handle_connection, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    yield f"ws://127.0.0.1:{port}", verifier, relay
    server.close()
    await server.wait_closed()


async def _auth(uri, device_id, group_id, verifier):
    ws = await websockets.connect(uri)
    challenge = json.loads(await ws.recv())
    assert challenge["type"] == "auth_challenge"
    proof = verifier.expected_proof(device_id, challenge["nonce"])
    await ws.send(json.dumps({"type": "auth_response", "deviceId": device_id, "groupId": group_id, "proof": proof}))
    assert json.loads(await ws.recv())["type"] == "auth_ok"
    presence = json.loads(await ws.recv())
    assert presence["type"] == "presence"
    return ws


async def test_normal_use_is_not_rate_limited(running_server):
    """正常连接和收发不该被限流碰到——限流碰到正常用户比不限还糟"""
    uri, verifier, _ = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    assert json.loads(await asyncio.wait_for(alice.recv(), timeout=2))["type"] == "peer_joined"

    await alice.send(json.dumps({"type": "forward", "ciphertextB64": "hello"}))
    received = json.loads(await asyncio.wait_for(bob.recv(), timeout=2))
    assert received["ciphertextB64"] == "hello"

    await alice.close()
    await bob.close()


async def test_a_message_flood_is_dropped_without_killing_the_connection(running_server):
    """超限的消息被丢弃，但连接保持——踢掉连接会让客户端重连，反而更吵"""
    uri, verifier, _ = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    await asyncio.wait_for(alice.recv(), timeout=2)  # peer_joined

    for i in range(MESSAGES_PER_DEVICE + 20):
        await alice.send(json.dumps({"type": "forward", "ciphertextB64": f"flood-{i}"}))

    received = 0
    try:
        while True:
            await asyncio.wait_for(bob.recv(), timeout=0.4)
            received += 1
    except asyncio.TimeoutError:
        pass

    assert received <= MESSAGES_PER_DEVICE
    assert received > 0  # 前面那些确实发出去了

    # 连接还活着
    await alice.send(json.dumps({"type": "ping"}))
    assert json.loads(await asyncio.wait_for(alice.recv(), timeout=2))["type"] == "pong"

    await alice.close()
    await bob.close()


async def test_heartbeat_is_never_rate_limited(running_server):
    """心跳被限掉的话，连接会被误判成死的"""
    uri, verifier, _ = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)

    for _ in range(MESSAGES_PER_DEVICE + 10):
        await alice.send(json.dumps({"type": "forward", "ciphertextB64": "x"}))

    await alice.send(json.dumps({"type": "ping"}))
    assert json.loads(await asyncio.wait_for(alice.recv(), timeout=2))["type"] == "pong"

    await alice.close()


async def test_one_device_flooding_does_not_affect_another(running_server):
    uri, verifier, _ = running_server
    alice = await _auth(uri, "alice", "group-1", verifier)
    bob = await _auth(uri, "bob", "group-1", verifier)
    await asyncio.wait_for(alice.recv(), timeout=2)

    for _ in range(MESSAGES_PER_DEVICE + 10):
        await alice.send(json.dumps({"type": "forward", "ciphertextB64": "flood"}))

    # bob 完全没被影响
    await bob.send(json.dumps({"type": "forward", "ciphertextB64": "bob-message"}))
    texts = []
    try:
        while True:
            frame = json.loads(await asyncio.wait_for(alice.recv(), timeout=0.5))
            if frame.get("type") == "forward":
                texts.append(frame["ciphertextB64"])
    except asyncio.TimeoutError:
        pass
    assert "bob-message" in texts

    await alice.close()
    await bob.close()

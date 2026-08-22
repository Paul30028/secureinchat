from app.invite_registry import InviteRegistry


def test_valid_invite_passes_and_is_consumed():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", remaining_uses=1)
    ok, reason = reg.validate_and_consume("CODE1", "group-1")
    assert ok is True
    assert reason == "ok"


def test_unknown_code_is_rejected():
    reg = InviteRegistry()
    ok, reason = reg.validate_and_consume("NOPE", "group-1")
    assert ok is False
    assert reason == "invite not found"


def test_code_for_a_different_group_is_rejected():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1")
    ok, reason = reg.validate_and_consume("CODE1", "group-2")
    assert ok is False
    assert reason == "invite does not match group"


def test_expired_invite_is_rejected():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", expires_at_ms=1000)
    ok, reason = reg.validate_and_consume("CODE1", "group-1", now_ms=2000)
    assert ok is False
    assert reason == "invite expired"


def test_invite_not_yet_expired_passes():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", expires_at_ms=2000)
    ok, reason = reg.validate_and_consume("CODE1", "group-1", now_ms=1000)
    assert ok is True


def test_limited_use_invite_is_exhausted_after_uses_run_out():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", remaining_uses=2)
    ok1, _ = reg.validate_and_consume("CODE1", "group-1")
    ok2, _ = reg.validate_and_consume("CODE1", "group-1")
    ok3, reason3 = reg.validate_and_consume("CODE1", "group-1")
    assert (ok1, ok2, ok3) == (True, True, False)
    assert reason3 == "invite exhausted"


def test_unlimited_use_invite_never_exhausts():
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", remaining_uses=None)
    for _ in range(100):
        ok, _ = reg.validate_and_consume("CODE1", "group-1")
        assert ok is True


def test_failed_validation_does_not_consume_a_use():
    """校验失败（比如群不匹配）不应该白白消耗掉这次使用次数。"""
    reg = InviteRegistry()
    reg.register("CODE1", "group-1", remaining_uses=1)
    ok_wrong_group, _ = reg.validate_and_consume("CODE1", "group-2")
    assert ok_wrong_group is False
    # The single use should still be available for the correct group.
    ok_correct, _ = reg.validate_and_consume("CODE1", "group-1")
    assert ok_correct is True

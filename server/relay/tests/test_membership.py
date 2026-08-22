from app.membership import GroupMembership


def test_add_and_is_member():
    m = GroupMembership()
    m.add("device-1", "group-1")
    assert m.is_member("device-1", "group-1") is True


def test_not_a_member_of_an_unrelated_group():
    m = GroupMembership()
    m.add("device-1", "group-1")
    assert m.is_member("device-1", "group-2") is False


def test_unknown_device_is_not_a_member_of_anything():
    m = GroupMembership()
    assert m.is_member("nobody", "group-1") is False


def test_device_can_belong_to_multiple_groups():
    m = GroupMembership()
    m.add("device-1", "group-1")
    m.add("device-1", "group-2")
    assert m.is_member("device-1", "group-1") is True
    assert m.is_member("device-1", "group-2") is True


def test_remove_revokes_membership():
    m = GroupMembership()
    m.add("device-1", "group-1")
    m.remove("device-1", "group-1")
    assert m.is_member("device-1", "group-1") is False


def test_remove_unknown_membership_is_a_noop():
    m = GroupMembership()
    m.remove("device-1", "group-1")  # must not raise
    assert m.is_member("device-1", "group-1") is False

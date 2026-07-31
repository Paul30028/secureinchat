from app.registry import RoomRegistry


def test_register_and_members_excluding():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice")
    reg.register("group-1", "bob", "conn-bob")

    others = reg.members_excluding("group-1", "alice")
    assert others == ["conn-bob"]


def test_unregister_removes_member():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice")
    reg.unregister("group-1", "alice")
    assert reg.member_count("group-1") == 0


def test_unregister_empty_room_is_removed_entirely():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice")
    reg.unregister("group-1", "alice")
    assert reg.room_count() == 0


def test_unregister_unknown_group_is_a_noop():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.unregister("does-not-exist", "alice")  # must not raise
    assert reg.room_count() == 0


def test_rooms_are_independent():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice-1")
    reg.register("group-2", "alice", "conn-alice-2")  # same device id, different group
    assert reg.member_count("group-1") == 1
    assert reg.member_count("group-2") == 1
    assert reg.members_excluding("group-1", "nonexistent") == ["conn-alice-1"]


def test_re_register_same_device_replaces_connection():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-old")
    reg.register("group-1", "alice", "conn-new")
    assert reg.member_count("group-1") == 1
    # bob should see alice's newest connection, not the stale one
    reg.register("group-1", "bob", "conn-bob")
    assert reg.members_excluding("group-1", "bob") == ["conn-new"]


def test_get_returns_the_exact_connection():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice")
    reg.register("group-1", "bob", "conn-bob")
    assert reg.get("group-1", "bob") == "conn-bob"


def test_get_returns_none_for_offline_or_wrong_group():
    reg: RoomRegistry[str] = RoomRegistry()
    reg.register("group-1", "alice", "conn-alice")
    assert reg.get("group-1", "nonexistent") is None
    assert reg.get("group-2", "alice") is None  # alice isn't in group-2

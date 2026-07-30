from app.device_registry import DeviceRegistry


def test_register_and_lookup():
    reg = DeviceRegistry()
    reg.register("device-1", b"fake-pubkey-bytes")
    assert reg.lookup("device-1") == b"fake-pubkey-bytes"


def test_lookup_unregistered_device_returns_none():
    reg = DeviceRegistry()
    assert reg.lookup("nope") is None


def test_is_registered():
    reg = DeviceRegistry()
    assert reg.is_registered("device-1") is False
    reg.register("device-1", b"key")
    assert reg.is_registered("device-1") is True


def test_re_register_replaces_the_key():
    reg = DeviceRegistry()
    reg.register("device-1", b"old-key")
    reg.register("device-1", b"new-key")
    assert reg.lookup("device-1") == b"new-key"


def test_rotate_succeeds_for_a_registered_device():
    reg = DeviceRegistry()
    reg.register("device-1", b"key-v1")
    result = reg.rotate("device-1", b"key-v2")
    assert result is True
    assert reg.lookup("device-1") == b"key-v2"


def test_rotate_fails_for_an_unregistered_device_and_does_not_create_it():
    reg = DeviceRegistry()
    result = reg.rotate("never-registered", b"some-key")
    assert result is False
    assert reg.is_registered("never-registered") is False

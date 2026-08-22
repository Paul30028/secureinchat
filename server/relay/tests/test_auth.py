from app.auth import PlaceholderHmacVerifier, generate_nonce


def test_generate_nonce_is_url_safe_and_reasonably_unique():
    nonces = {generate_nonce() for _ in range(1000)}
    assert len(nonces) == 1000  # no collisions in 1000 draws
    for n in nonces:
        assert all(c.isalnum() or c in "-_" for c in n)


def test_verifier_accepts_correct_proof():
    verifier = PlaceholderHmacVerifier(b"test-secret")
    nonce = "abc123"
    proof = verifier.expected_proof("device-1", nonce)
    assert verifier.verify("device-1", nonce, proof) is True


def test_verifier_rejects_wrong_device_id():
    verifier = PlaceholderHmacVerifier(b"test-secret")
    nonce = "abc123"
    proof = verifier.expected_proof("device-1", nonce)
    assert verifier.verify("device-2", nonce, proof) is False


def test_verifier_rejects_replayed_proof_for_different_nonce():
    verifier = PlaceholderHmacVerifier(b"test-secret")
    proof_for_nonce_a = verifier.expected_proof("device-1", "nonce-A")
    assert verifier.verify("device-1", "nonce-B", proof_for_nonce_a) is False


def test_verifier_rejects_tampered_proof():
    verifier = PlaceholderHmacVerifier(b"test-secret")
    nonce = "abc123"
    proof = verifier.expected_proof("device-1", nonce)
    tampered = proof[:-1] + ("A" if proof[-1] != "A" else "B")
    assert verifier.verify("device-1", nonce, tampered) is False


def test_verifier_with_wrong_secret_rejects_everything():
    verifier_a = PlaceholderHmacVerifier(b"secret-A")
    verifier_b = PlaceholderHmacVerifier(b"secret-B")
    nonce = "abc123"
    proof = verifier_a.expected_proof("device-1", nonce)
    assert verifier_b.verify("device-1", nonce, proof) is False

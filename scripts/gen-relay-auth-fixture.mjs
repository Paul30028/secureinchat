/**
 * 生成一份"用真实 crypto-core KeystorePort 签名+导出公钥"的 fixture，给 Python
 * 服务端的 PublicKeyDeviceVerifier 测试用——证明 TS 端 Web Crypto 签的名、导出的
 * 公钥，Python 端能验证通过。
 *
 * 全程只调用 KeystorePort 接口本身（generateDeviceKeyPair / sign / exportPublicKeyRaw），
 * 不绕过接口直接摸 CryptoKeyPair —— 这样才是真的在验证"接口对外的契约"，而不是
 * 验证某个内部实现细节。
 *
 * Web Crypto 的 ECDSA sign 输出是 IEEE P1363 格式（r||s，各 32 字节，共 64 字节），
 * 不是 DER。Python 的 cryptography 库默认吃 DER，Python 那边要做格式转换——
 * 这份 fixture 就是用来验证"转换对不对"的。
 *
 * 重新生成： node scripts/gen-relay-auth-fixture.mjs > server/relay/tests/fixtures/ts_signed_auth.json
 */
import { TestOnlyInMemoryKeystore } from "../packages/crypto-core/src/keystorePort.ts";

function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const ks = new TestOnlyInMemoryKeystore();
const deviceId = "device-alice-fixture";
const alias = await ks.generateDeviceKeyPair(deviceId);
const nonce = "fixture-nonce-abc123";

const signature = await ks.sign(alias, new TextEncoder().encode(nonce));
const rawPublicKey = await ks.exportPublicKeyRaw(alias);

const fixture = {
  deviceId,
  nonce,
  publicKeyRawB64Url: toBase64Url(rawPublicKey),
  signatureP1363B64Url: toBase64Url(signature),
  note: "signature is over UTF-8 bytes of `nonce`, produced by KeystorePort.sign (ECDSA P-256 + SHA-256, Web Crypto raw/P1363 format); public key via KeystorePort.exportPublicKeyRaw (uncompressed point)",
};

console.log(JSON.stringify(fixture, null, 2));

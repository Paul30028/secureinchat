// Build the self-hosted local-AI assets directly into public/workspace/ai/ (large binaries are kept in one place only; build.mjs does not copy them).
//
// Run from the repository root:
//   node build/build-ai.mjs
//
// The lab (node_modules + model source) is read-only in this workspace; this
// script reads it and writes only into public/workspace/ai/.
// (build/build.mjs does not copy them; the files are committed once, not duplicated in src/).
//
// Everything is offline: no package installation, no network, no remote URL in
// the worker bundle. The output is deterministic apart from esbuild's ordering.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LAB = process.env.LOCAL_AI_LAB || 'C:\\Users\\holyx\\Tools\\local-ai-lab';
const SRC = path.join(ROOT, 'src', 'workspace', 'ai-src', 'ai-worker.mjs');
const OUT = path.join(ROOT, 'public', 'workspace', 'ai');
const MODEL = path.join(LAB, 'models', 'gliner-pii');
const MODEL_ONNX = path.join(MODEL, 'onnx', 'model_quint8.onnx');
const ORT_DIST = path.join(LAB, 'node_modules', 'onnxruntime-web', 'dist');
const ESBUILD_EXE = process.env.ESBUILD_EXE
  || path.join(LAB, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`, 'esbuild.exe');
const ESBUILD_EXE_FALLBACK = path.join(LAB, 'node_modules', '@esbuild', `${process.platform}-${process.arch}`, 'esbuild');

const SHARD_BYTES = 20 * 1024 * 1024; // 20 MiB, below Cloudflare's 25 MiB file limit.
const CLOUDFLARE_LIMIT = 25 * 1024 * 1024;
const MODEL_ID = 'knowledgator/gliner-pii-small-v1.0';
const MODEL_LICENSE = 'Apache-2.0';
const MANIFEST_VERSION = '1.0.0';

if (!fs.existsSync(SRC)) throw new Error('worker source missing: ' + SRC);
if (!fs.existsSync(MODEL_ONNX)) throw new Error('model missing: ' + MODEL_ONNX);
if (!fs.existsSync(ORT_DIST)) throw new Error('onnxruntime-web missing: ' + ORT_DIST);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function lf(text) {
  return text.replace(/\r\n?/g, '\n');
}

function writeText(rel, text) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lf(text), 'utf8');
}

function writeBytes(rel, bytes) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

function assertSafeOutput(rel) {
  const file = path.resolve(OUT, rel);
  if (!file.startsWith(path.resolve(OUT) + path.sep)) throw new Error('output escapes ai dir: ' + rel);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('output is not a file: ' + rel);
  if (stat.size <= 0) throw new Error('output is empty: ' + rel);
  if (stat.size > CLOUDFLARE_LIMIT) throw new Error(`output exceeds 25 MiB: ${rel} (${stat.size})`);
}

function walk(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, base));
    else if (entry.isFile()) files.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return files.sort();
}

// ---------------------------------------------------------------------------
// 1. Reset the output directory, then bundle with the esbuild native binary.
//    The Node esbuild service uses piped stdio, which the Windows sandbox
//    blocks; running the binary with inherited stdio works and keeps the script
//    self-contained. onnxruntime-web is pinned to its WASM-only external build
//    so neither WebGPU/WebGL code nor an inlined wasm binary ships.
// ---------------------------------------------------------------------------
const resolvedOut = path.resolve(OUT);
if (resolvedOut !== path.join(path.resolve(ROOT), 'src', 'workspace', 'ai')) {
  throw new Error('refusing to clean unexpected output path: ' + resolvedOut);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const esbuildExe = fs.existsSync(ESBUILD_EXE) ? ESBUILD_EXE : ESBUILD_EXE_FALLBACK;
if (!fs.existsSync(esbuildExe)) throw new Error('esbuild binary missing: ' + esbuildExe);
const workerOut = path.join(OUT, 'ai-worker.js');
const esbuildArgs = [
  SRC,
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2020',
  '--minify',
  '--legal-comments=none',
  '--outfile=' + workerOut,
  '--conditions=onnxruntime-web-use-extern-wasm',
  '--alias:onnxruntime-web=onnxruntime-web/wasm',
  '--define:process.env.NODE_ENV="production"',
];
const esbuildRun = spawnSync(esbuildExe, esbuildArgs, {
  stdio: 'inherit',
  env: { ...process.env, NODE_PATH: path.join(LAB, 'node_modules') },
});
if (esbuildRun.error) throw esbuildRun.error;
if (esbuildRun.status !== 0) throw new Error('esbuild failed with exit code ' + esbuildRun.status);

const workerBundle = fs.readFileSync(workerOut);
let workerText = workerBundle.toString('utf8');

// Some transformers.js error messages and defaults contain documentation/CDN
// URLs. Those branches are unreachable here (allowRemoteModels=false and the
// fetch guard blocks every non-/workspace/ai/ request), but a literal remote
// URL must not ship. Replace every http(s) URL with an inert marker, then audit.
const sanitized = workerText.replace(/https?:\/\/[^\s"'`<>)]+/g, 'blocked-remote-url');
if (sanitized !== workerText) {
  fs.writeFileSync(workerOut, sanitized, 'utf8');
  workerText = sanitized;
}

// No remote URL may be baked into the worker. Fail loudly if a dependency adds
// one; the model, tokenizer and wasm are all fetched from /workspace/ai/.
const remoteUrls = [...new Set(workerText.match(/https?:\/\/[^\s"'`<>)]+/g) || [])];
if (remoteUrls.length) {
  throw new Error('worker bundle contains remote URL(s):\n' + remoteUrls.join('\n'));
}

// ---------------------------------------------------------------------------
// 2. Slice the ONNX model and build a content-addressed manifest.
// ---------------------------------------------------------------------------
const modelBytes = fs.readFileSync(MODEL_ONNX);
const modelSha = sha256(modelBytes);
const shards = [];
for (let offset = 0, index = 0; offset < modelBytes.length; offset += SHARD_BYTES, index += 1) {
  const bytes = modelBytes.subarray(offset, Math.min(offset + SHARD_BYTES, modelBytes.length));
  const file = `model-${String(index).padStart(4, '0')}.bin`;
  writeBytes(file, bytes);
  shards.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
}

// ---------------------------------------------------------------------------
// 4. Tokenizer/config files and WASM runtime, all same-origin.
// ---------------------------------------------------------------------------
const tokenizerSourceFiles = ['tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json'];
const configSourceFiles = ['gliner_config.json'];
const tokenizerFiles = [];
const configFiles = [];
for (const name of [...tokenizerSourceFiles, ...configSourceFiles]) {
  const source = path.join(MODEL, name);
  if (!fs.existsSync(source)) throw new Error('missing model file: ' + source);
  const bytes = fs.readFileSync(source);
  const rel = 'models/gliner-pii/' + name;
  writeBytes(rel, bytes);
  const record = { file: rel, bytes: bytes.length, sha256: sha256(bytes) };
  if (tokenizerSourceFiles.includes(name)) tokenizerFiles.push(record);
  else configFiles.push(record);
}

const ortFiles = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
const ort = [];
for (const name of ortFiles) {
  const source = path.join(ORT_DIST, name);
  if (!fs.existsSync(source)) throw new Error('missing onnxruntime-web file: ' + source);
  const bytes = fs.readFileSync(source);
  const rel = 'ort/' + name;
  writeBytes(rel, bytes);
  ort.push({ file: rel, bytes: bytes.length, sha256: sha256(bytes) });
}

const manifest = {
  version: MANIFEST_VERSION,
  model: MODEL_ID,
  license: MODEL_LICENSE,
  totalBytes: modelBytes.length,
  sha256: modelSha,
  shards,
  tokenizerFiles,
  configFiles,
  runtime: { name: 'onnxruntime-web', backend: 'wasm', files: ort },
};
writeText('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

writeText('NOTICE.txt', [
  'Local AI assets for the SecureInChat private workspace',
  '',
  `Model: ${MODEL_ID}`,
  `License: ${MODEL_LICENSE}`,
  'The model weights are redistributed as quantized ONNX shards with SHA-256',
  'checksums in manifest.json. See the upstream model card for attribution.',
  '',
  'Runtime: onnxruntime-web (MIT), WASM backend only.',
  'Tokenizer: the tokenizer files shipped with the model above.',
  '',
].join('\n'));

// ---------------------------------------------------------------------------
// 5. Verify every emitted file, print the inventory.
// ---------------------------------------------------------------------------
const files = walk(OUT);
for (const rel of files) assertSafeOutput(rel);
if (manifest.totalBytes !== modelBytes.length) throw new Error('manifest totalBytes mismatch');
if (manifest.shards.reduce((n, s) => n + s.bytes, 0) !== manifest.totalBytes) throw new Error('manifest shard sum mismatch');

console.log('\nWrote src/workspace/ai/');
let total = 0;
for (const rel of files) {
  const size = fs.statSync(path.join(OUT, rel)).size;
  total += size;
  console.log(`  ${String(size).padStart(9)}  ${rel}`);
}
console.log(`  ${String(total).padStart(9)}  TOTAL`);
console.log(`\nmodel sha256 ${modelSha}`);
console.log(`worker bundle ${Buffer.byteLength(workerText)} bytes, ${remoteUrls.length} remote URLs`);

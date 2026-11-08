// SecureInChat local AI worker (GLiNER-PII small v1.0, WASM only).
//
// Privacy invariants, enforced here rather than by convention:
//   - the only network API used is fetch(), and it is wrapped below so that it
//     can reach nothing except same-origin paths under /workspace/ai/;
//   - no user text is ever passed to fetch(), logged, or stored;
//   - every model shard, the whole model, and the tokenizer are verified with
//     SHA-256 before use.
//
// Protocol (anything else is rejected):
//   {type:'load'} -> {type:'progress',loaded,total}* -> {type:'ready',ms}
//   {type:'detect',id,text,labels,threshold} -> {type:'result',id,entities,ms}
//   {type:'clear-cache'} -> {type:'cache-cleared'}
// Errors: {type:'error',id?,code,message}

import { AutoTokenizer, env as hfEnv } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';

const AI_ROOT = '/workspace/ai/';
const MANIFEST_URL = AI_ROOT + 'manifest.json';
const MODEL_DIR = AI_ROOT + 'models/gliner-pii/';
const TOKENIZER_ID = 'gliner-pii';
const CACHE_NAME = 'secureinchat-ai-v1';
const MAX_TEXT_CHARS = 20000;
const MAX_LABELS = 64;
const MAX_LABEL_CHARS = 64;
const MAX_WORDS_PER_CHUNK = 256;
const MAX_CHARS_PER_CHUNK = 1500;
const DEFAULT_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// Network lockdown. Resolve every request against this worker's own URL, then
// require same origin and the literal /workspace/ai/ prefix after normalisation.
// ---------------------------------------------------------------------------
const WORKER_URL = new URL(self.location.href);
const rawFetch = globalThis.fetch.bind(globalThis);

function assertAiUrl(input) {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : input && input.url;
  if (typeof raw !== 'string') throw new Error('fetch target rejected');
  const url = new URL(raw, WORKER_URL.href);
  const path = url.pathname;
  if (url.origin !== WORKER_URL.origin) throw new Error('cross-origin fetch blocked');
  if (!path.startsWith(AI_ROOT)) throw new Error('fetch outside /workspace/ai/ blocked');
  if (path.includes('..')) throw new Error('path traversal blocked');
  return url.href;
}

function guardedFetch(input, init) {
  return rawFetch(assertAiUrl(input), init);
}
globalThis.fetch = guardedFetch;

// No network APIs besides fetch. These assignments make an accidental future
// addition fail loudly instead of silently opening a second channel.
for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource']) {
  try {
    Object.defineProperty(globalThis, name, {
      configurable: false,
      writable: false,
      value: class BlockedNetworkApi {
        constructor() {
          throw new Error(name + ' is disabled in the local AI worker');
        }
      },
    });
  } catch {
    // A non-configurable host property is already unavailable; nothing to do.
  }
}
try {
  Object.defineProperty(globalThis, 'importScripts', {
    configurable: false,
    writable: false,
    value: () => {
      throw new Error('importScripts is disabled in the local AI worker');
    },
  });
} catch {
  // ignore
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function post(message) {
  self.postMessage(message);
}

function fail(message, code = 'bad-request') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isHexSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeRelativeFile(name) {
  return typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name);
}

function concatInto(target, targetOffset, source) {
  if (targetOffset + source.byteLength > target.byteLength) {
    throw fail('model shards exceed manifest totalBytes', 'manifest-invalid');
  }
  target.set(source, targetOffset);
}

function countCodePoints(text) {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let session = null;
let tokenizer = null;
let loadedBytes = 0;
let loadPromise = null;
let loadMs = 0;

async function readCached(url) {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (!hit) return null;
    return new Uint8Array(await hit.arrayBuffer());
  } catch {
    return null;
  }
}

async function writeCached(url, bytes) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
  } catch {
    // Cache Storage can be disabled or full; loading still succeeds.
  }
}

async function fetchVerifiedShard(url, expectedBytes, expectedSha, progress) {
  let bytes = await readCached(url);
  let fromCache = bytes !== null;
  if (bytes === null) {
    const response = await guardedFetch(url);
    if (!response.ok) throw fail('shard request failed with HTTP ' + response.status, 'load-failed');
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  if (bytes.byteLength !== expectedBytes) {
    throw fail('shard size mismatch: ' + url, 'hash-mismatch');
  }
  const digest = await sha256Hex(bytes);
  if (digest !== expectedSha) {
    if (fromCache && typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(url);
      } catch {
        // ignore
      }
      return fetchVerifiedShard(url, expectedBytes, expectedSha, progress);
    }
    throw fail('shard SHA-256 mismatch: ' + url, 'hash-mismatch');
  }
  if (!fromCache) await writeCached(url, bytes);
  loadedBytes += bytes.byteLength;
  progress();
  return bytes;
}

function validateManifest(manifest) {
  if (!isPlainObject(manifest)) throw fail('manifest is not an object', 'manifest-invalid');
  if (typeof manifest.version !== 'string' || !manifest.version) throw fail('manifest.version missing', 'manifest-invalid');
  if (!Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes <= 0) throw fail('manifest.totalBytes invalid', 'manifest-invalid');
  if (!isHexSha256(manifest.sha256)) throw fail('manifest.sha256 invalid', 'manifest-invalid');
  if (!Array.isArray(manifest.shards) || manifest.shards.length === 0) throw fail('manifest.shards missing', 'manifest-invalid');
  for (const shard of manifest.shards) {
    if (!isPlainObject(shard) || !safeRelativeFile(shard.file) || !shard.file.endsWith('.bin')) {
      throw fail('manifest shard file invalid', 'manifest-invalid');
    }
    if (!Number.isSafeInteger(shard.bytes) || shard.bytes <= 0 || !isHexSha256(shard.sha256)) {
      throw fail('manifest shard metadata invalid', 'manifest-invalid');
    }
  }
  const sum = manifest.shards.reduce((n, s) => n + s.bytes, 0);
  if (sum !== manifest.totalBytes) throw fail('manifest shard sizes do not add up', 'manifest-invalid');
  return manifest;
}

async function loadModel() {
  const started = performance.now();
  loadedBytes = 0;

  const manifestResponse = await guardedFetch(MANIFEST_URL);
  if (!manifestResponse.ok) throw fail('manifest request failed with HTTP ' + manifestResponse.status, 'load-failed');
  const manifest = validateManifest(await manifestResponse.json());
  const total = manifest.totalBytes;

  const progress = () => post({ type: 'progress', loaded: loadedBytes, total });

  // Tokenizer first: it is small, and a missing tokenizer should fail before
  // downloading 80 MB of weights.
  hfEnv.allowRemoteModels = false;
  hfEnv.allowLocalModels = true;
  hfEnv.useBrowserCache = false;
  hfEnv.localModelPath = AI_ROOT + 'models/';
  tokenizer = await AutoTokenizer.from_pretrained(TOKENIZER_ID, { local_files_only: true });

  const modelBytes = new Uint8Array(total);
  let offset = 0;
  for (const shard of manifest.shards) {
    const bytes = await fetchVerifiedShard(AI_ROOT + shard.file, shard.bytes, shard.sha256, progress);
    concatInto(modelBytes, offset, bytes);
    offset += bytes.byteLength;
  }
  if (offset !== total) throw fail('assembled model size mismatch', 'hash-mismatch');

  const whole = await sha256Hex(modelBytes);
  if (whole !== manifest.sha256) throw fail('whole-model SHA-256 mismatch', 'hash-mismatch');

  ort.env.wasm.wasmPaths = AI_ROOT + 'ort/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  loadedBytes = total;
  progress();
  loadMs = performance.now() - started;
  return loadMs;
}

function ensureLoaded() {
  if (session && tokenizer) return Promise.resolve(loadMs);
  if (!loadPromise) {
    loadPromise = loadModel().catch((error) => {
      session = null;
      tokenizer = null;
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

// ---------------------------------------------------------------------------
// Tokenization and GLiNER token-level inference.
// The ONNX export returns logits shaped [batch, words, entities, 3]
// (start, end, inside). It is transposed to [3, batch, words, entities] for
// the decoder, matching the reference GLiNER implementation used in eval/.
// ---------------------------------------------------------------------------
const WORD_RE = /\p{Script=Han}|[\p{L}\p{N}_]+(?:[-_][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]/gu;

function splitWords(text) {
  const words = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(text)) !== null) {
    // A single 20k-character token (for example a pasted blob) would exceed the
    // model's position limit. Break it into model-sized pieces; offsets stay
    // exact because every piece carries its own character range.
    if (match[0].length <= MAX_CHARS_PER_CHUNK) {
      words.push({ word: match[0], start: match.index, end: WORD_RE.lastIndex });
    } else {
      for (let start = match.index; start < WORD_RE.lastIndex; start += MAX_CHARS_PER_CHUNK) {
        const end = Math.min(start + MAX_CHARS_PER_CHUNK, WORD_RE.lastIndex);
        words.push({ word: text.slice(start, end), start, end });
      }
    }
  }
  return words;
}

function buildBatch(words, labels) {
  const prompt = [];
  for (const label of labels) {
    prompt.push('<<ENT>>', label);
  }
  prompt.push('<<SEP>>');
  const promptLength = prompt.length;
  const allWords = prompt.concat(words.map((w) => w.word));

  const inputIds = [1];
  const attentionMask = [1];
  const wordsMask = [0];
  let wordId = 1;
  for (let i = 0; i < allWords.length; i += 1) {
    const tokenIds = tokenizer.encode(allWords[i]).slice(1, -1);
    for (let t = 0; t < tokenIds.length; t += 1) {
      attentionMask.push(1);
      inputIds.push(Number(tokenIds[t]));
      wordsMask.push(i >= promptLength && t === 0 ? wordId++ : 0);
    }
  }
  inputIds.push(tokenizer.sep_token_id);
  attentionMask.push(1);
  wordsMask.push(0);

  return {
    inputIds,
    attentionMask,
    wordsMask,
    textLengths: [words.length],
    promptLength,
  };
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function reorderLogits(tensor, batchSize, words, entities) {
  const dims = tensor.dims;
  const src = tensor.data;
  if (dims.length !== 4) throw fail('unexpected ONNX logits rank', 'inference-failed');

  if (dims[0] === 3 && dims[1] === batchSize && dims[2] === words && dims[3] === entities) {
    return src;
  }
  const out = new Float32Array(src.length);
  if (dims[0] === batchSize && dims[1] === words && dims[2] === entities && dims[3] === 3) {
    for (let b = 0; b < batchSize; b += 1)
      for (let w = 0; w < words; w += 1)
        for (let e = 0; e < entities; e += 1)
          for (let p = 0; p < 3; p += 1)
            out[((p * batchSize + b) * words + w) * entities + e] = src[((b * words + w) * entities + e) * 3 + p];
    return out;
  }
  if (dims[0] === batchSize && dims[1] === words && dims[2] === 3 && dims[3] === entities) {
    for (let b = 0; b < batchSize; b += 1)
      for (let w = 0; w < words; w += 1)
        for (let p = 0; p < 3; p += 1)
          for (let e = 0; e < entities; e += 1)
            out[((p * batchSize + b) * words + w) * entities + e] = src[((b * words + w) * 3 + p) * entities + e];
    return out;
  }
  throw fail('unexpected ONNX logits shape', 'inference-failed');
}

function decodeChunk(logits, batch, labels, words, text, textOffset, threshold) {
  const wordsCount = words.length;
  const entities = labels.length;
  const batchSize = 1;
  const data = reorderLogits(logits, batchSize, wordsCount, entities);

  const inside = new Float32Array(wordsCount * entities);
  const starts = [];
  const ends = [];
  for (let p = 0; p < 3; p += 1) {
    for (let w = 0; w < wordsCount; w += 1) {
      for (let e = 0; e < entities; e += 1) {
        const probability = sigmoid(data[((p * batchSize) * wordsCount + w) * entities + e]);
        if (p === 2) inside[w * entities + e] = probability;
        if (probability >= threshold) {
          if (p === 0) starts.push([w, e]);
          else if (p === 1) ends.push([w, e]);
        }
      }
    }
  }

  const candidates = [];
  for (const [startWord, startEntity] of starts) {
    for (const [endWord, endEntity] of ends) {
      if (endWord < startWord || startEntity !== endEntity) continue;
      let sum = 0;
      let valid = true;
      for (let w = startWord; w <= endWord; w += 1) {
        const score = inside[w * entities + startEntity];
        if (score < threshold) {
          valid = false;
          break;
        }
        sum += score;
      }
      if (!valid) continue;
      const start = textOffset + words[startWord].start;
      const end = textOffset + words[endWord].end;
      candidates.push({
        start,
        end,
        text: text.slice(words[startWord].start, words[endWord].end),
        label: labels[startEntity],
        score: sum / (endWord - startWord + 1),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const candidate of candidates) {
    let overlaps = false;
    for (const kept of selected) {
      if (candidate.start < kept.end && kept.start < candidate.end) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) selected.push(candidate);
  }
  selected.sort((a, b) => a.start - b.start);
  return selected;
}

async function detect(text, labels, threshold) {
  const allWords = splitWords(text);
  if (allWords.length === 0) return [];
  const entities = [];
  let index = 0;
  while (index < allWords.length) {
    let endIndex = index;
    let chars = 0;
    while (endIndex < allWords.length && endIndex - index < MAX_WORDS_PER_CHUNK) {
      const length = allWords[endIndex].end - allWords[endIndex].start;
      if (endIndex > index && chars + length > MAX_CHARS_PER_CHUNK) break;
      chars += length;
      endIndex += 1;
    }
    const chunkWords = allWords.slice(index, endIndex);
    const textOffset = chunkWords[0].start;
    const chunkEnd = endIndex < allWords.length ? allWords[endIndex].start : text.length;
    const chunkText = text.slice(textOffset, chunkEnd);
    const batch = buildBatch(chunkWords, labels);
    const feeds = {
      input_ids: new ort.Tensor('int64', batch.inputIds, [1, batch.inputIds.length]),
      attention_mask: new ort.Tensor('int64', batch.attentionMask, [1, batch.attentionMask.length]),
      words_mask: new ort.Tensor('int64', batch.wordsMask, [1, batch.wordsMask.length]),
      text_lengths: new ort.Tensor('int64', batch.textLengths, [1, 1]),
    };
    const output = await session.run(feeds);
    const logits = output.logits;
    if (!logits || !logits.data) throw fail('model returned no logits', 'inference-failed');
    entities.push(...decodeChunk(logits, batch, labels, chunkWords, chunkText, textOffset, threshold));
    index = endIndex;
  }
  return entities;
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------
async function handleLoad() {
  const started = performance.now();
  const alreadyLoaded = Boolean(session && tokenizer);
  await ensureLoaded();
  post({ type: 'ready', ms: alreadyLoaded ? 0 : Math.round((performance.now() - started) * 1000) / 1000 });
}

async function handleDetect(message) {
  if (!session || !tokenizer) throw fail('model is not loaded', 'not-loaded');
  if (!message || !('id' in message)) throw fail('detect.id is required', 'bad-message');
  if (typeof message.id !== 'string' && typeof message.id !== 'number') throw fail('detect.id must be a string or number', 'bad-message');
  if (typeof message.text !== 'string') throw fail('detect.text must be a string', 'bad-message');
  if (countCodePoints(message.text) > MAX_TEXT_CHARS) throw fail('text exceeds ' + MAX_TEXT_CHARS + ' characters', 'text-too-long');
  if (!Array.isArray(message.labels) || message.labels.length === 0) throw fail('detect.labels must be a non-empty array', 'bad-message');
  if (message.labels.length > MAX_LABELS) throw fail('too many labels', 'bad-message');
  const labels = [];
  for (const label of message.labels) {
    if (typeof label !== 'string' || !label || label.length > MAX_LABEL_CHARS || /[\u0000-\u001f\u007f]/.test(label)) {
      throw fail('invalid label', 'bad-message');
    }
    if (!labels.includes(label)) labels.push(label);
  }
  const threshold = message.threshold === undefined ? DEFAULT_THRESHOLD : message.threshold;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw fail('detect.threshold must be a number between 0 and 1', 'bad-message');
  }

  const started = performance.now();
  const entities = await detect(message.text, labels, threshold);
  post({
    type: 'result',
    id: message.id,
    entities,
    ms: Math.round((performance.now() - started) * 1000) / 1000,
  });
}

self.onmessage = async (event) => {
  const message = event.data;
  if (!isPlainObject(message) || typeof message.type !== 'string') {
    post({ type: 'error', code: 'bad-message', message: 'unsupported message' });
    return;
  }
  try {
    if (message.type === 'load') {
      await handleLoad();
      return;
    }
    if (message.type === 'detect') {
      await handleDetect(message);
      return;
    }
    if (message.type === 'clear-cache') {
      if (typeof caches !== 'undefined') await caches.delete(CACHE_NAME);
      post({ type: 'cache-cleared' });
      return;
    }
    post({ type: 'error', code: 'bad-message', message: 'unsupported message type' });
  } catch (error) {
    post({
      type: 'error',
      id: 'id' in message ? message.id : undefined,
      code: error && error.code ? error.code : 'worker-error',
      message: error instanceof Error ? error.message : 'worker error',
    });
  }
};

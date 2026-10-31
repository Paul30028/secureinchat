// Runs every fixture through metadata-remover's process_file (Node build of the WASM package) and writes
// the cleaned file plus its verification report. Usage: node tests/w1/run_clean.mjs PKGDIR INDIR OUTDIR
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const [pkgDir, inDir, outDir] = process.argv.slice(2);
const mr = createRequire(import.meta.url)(`${pkgDir}/metadata_remover.js`);
mkdirSync(outDir, { recursive: true });
const report = {};
for (const name of readdirSync(inDir).sort()) {
  const data = new Uint8Array(readFileSync(`${inDir}/${name}`));
  const t0 = performance.now();
  try {
    const before = mr.analyze_file(data);
    const res = mr.process_file(data);
    const ms = Math.round(performance.now() - t0);
    writeFileSync(`${outDir}/${name}`, Buffer.from(res.cleaned));
    report[name] = { ok: true, ms, type: before.file_type ?? before.fileType,
      found_before: (before.metadata?.metadata_found ?? before.metadata?.metadataFound ?? []).length,
      left_after: (res.verification?.metadata_found ?? res.verification?.metadataFound ?? []).length,
      bytes_in: data.length, bytes_out: res.cleaned.length };
  } catch (e) {
    report[name] = { ok: false, error: String(e?.message ?? e) };
  }
}
writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

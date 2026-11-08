/* Local PDF and Office metadata review for the private workspace.
   It reuses the WebAssembly engine that already powers /tools/file-metadata-remover/
   (public/tools/assets/mr/metadata_remover.js, MIT, metadata-remover by iAnonymous3000).
   No second parser and no rewrite of the engine logic: this file only adapts its
   analyze_file / process_file calls and adds the workspace's file limits and naming.
   Engine and wasm are same-origin files served by this site; the file itself never leaves
   the tab. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSFile = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMIT_BYTES = 200 * 1024 * 1024;
  var ENGINE_JS = '/tools/assets/mr/metadata_remover.js';
  var ENGINE_WASM = '/tools/assets/mr/metadata_remover_bg.wasm';

  var SUPPORTED = {
    pdf: { ext: 'pdf', label: 'PDF', mime: 'application/pdf' },
    docx: { ext: 'docx', label: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    xlsx: { ext: 'xlsx', label: 'XLSX', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    pptx: { ext: 'pptx', label: 'PPTX', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  };

  var MIME_TO_EXT = {};
  Object.keys(SUPPORTED).forEach(function (ext) { MIME_TO_EXT[SUPPORTED[ext].mime] = ext; });

  var enginePromise = null;

  function fail(error, message) {
    return { ok: false, error: error, message: message };
  }

  function clean(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(clean(name));
    return m ? m[1].toLowerCase() : '';
  }

  function mimeOf(file) {
    return clean(file && file.type).split(';')[0].trim().toLowerCase();
  }

  function formatBytes(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return '0 B';
    if (n < 1024) return Math.round(n) + ' B';
    var kb = n / 1024;
    if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
    var mb = kb / 1024;
    if (Math.abs(mb - Math.round(mb)) < 1e-9) return Math.round(mb) + ' MB';
    return mb.toFixed(1) + ' MB';
  }

  function outputName(ext) {
    return SUPPORTED[ext] ? 'file-cleaned.' + ext : '';
  }

  function outputMime(ext) {
    return SUPPORTED[ext] ? SUPPORTED[ext].mime : '';
  }

  // Cheap checks that do not read the file. The engine still has to confirm the real type
  // from the bytes, so a renamed file is not trusted by its extension.
  function inspect(file) {
    file = file || {};
    var size = Number(file.size);
    if (!isFinite(size) || size < 0) size = 0;
    if (size > LIMIT_BYTES) {
      return fail('too-large', 'That file is ' + formatBytes(size) + '. The limit is 200 MB. It was not processed.');
    }
    var ext = extOf(file.name);
    if (!SUPPORTED[ext]) ext = MIME_TO_EXT[mimeOf(file)] || '';
    if (!SUPPORTED[ext]) {
      return fail('unsupported', 'This page handles PDF, DOCX, XLSX and PPTX files. This file was not processed.');
    }
    return {
      ok: true,
      ext: ext,
      label: SUPPORTED[ext].label,
      mime: SUPPORTED[ext].mime,
      size: size,
      outputName: outputName(ext)
    };
  }

  function engine() {
    if (!enginePromise) {
      enginePromise = import(ENGINE_JS).then(function (mod) {
        return mod.default({ module_or_path: new URL(ENGINE_WASM, self.location.href) }).then(function () { return mod; });
      });
    }
    return enginePromise;
  }

  function itemsOf(metadata) {
    var list = metadata && metadata.metadata_found;
    return Array.isArray(list) ? list : [];
  }

  function groupsOf(items) {
    var groups = [], index = {};
    items.forEach(function (item) {
      item = item || {};
      var name = clean(item.category) || 'Other';
      var key = name.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(index, key)) {
        index[key] = groups.length;
        groups.push({ name: name, items: [] });
      }
      groups[index[key]].items.push(item);
    });
    return groups;
  }

  async function analyze(file, bytes) {
    var info = inspect(file);
    if (!info.ok) return info;
    var mod;
    try {
      mod = await engine();
    } catch (e) {
      return fail('no-engine', 'The local file engine could not load. Nothing was uploaded. Reload the page and try again.');
    }
    var type;
    try {
      type = mod.detect_file_type(bytes);
    } catch (e) {
      return fail('unreadable', 'The file engine could not read this file. It may be damaged. Nothing was uploaded.');
    }
    if (type === 'office-legacy') {
      return fail('legacy-office', 'Old Office files (.doc, .xls, .ppt) are not supported. Save the file as .docx, .xlsx or .pptx, then try again.');
    }
    if (!SUPPORTED[type]) {
      return fail('unsupported-type', 'The file engine does not recognise this as a PDF, DOCX, XLSX or PPTX file. Nothing was processed.');
    }
    if (type !== info.ext) {
      return fail('mismatch', 'The name says .' + info.ext + ', but the contents are ' + type.toUpperCase() + '. Nothing was processed.');
    }
    var result;
    try {
      result = mod.analyze_file(bytes);
    } catch (e) {
      return fail('unreadable', 'The file engine could not read this file. It may be damaged. Nothing was uploaded.');
    }
    var items = itemsOf(result && result.metadata);
    return {
      ok: true,
      ext: type,
      label: SUPPORTED[type].label,
      size: info.size,
      outputName: outputName(type),
      total: items.length,
      groups: groupsOf(items)
    };
  }

  async function cleanFile(bytes, ext) {
    var mod;
    try {
      mod = await engine();
    } catch (e) {
      return fail('no-engine', 'The local file engine could not load. Nothing was uploaded. Try again.');
    }
    var result;
    try {
      result = mod.process_file(bytes);
    } catch (e) {
      return fail('clean-failed', 'The file engine could not clean this file. Nothing was uploaded or downloaded.');
    }
    var cleaned = result && result.cleaned;
    if (!cleaned || typeof cleaned.length !== 'number' || !cleaned.length) {
      return fail('no-data', 'The file engine returned no cleaned copy. Nothing was uploaded or downloaded.');
    }
    var remaining = itemsOf(result.verification);
    return {
      ok: true,
      bytes: cleaned,
      outputName: outputName(ext),
      mime: outputMime(ext),
      remaining: remaining,
      remainingGroups: groupsOf(remaining)
    };
  }

  return {
    LIMIT_BYTES: LIMIT_BYTES,
    SUPPORTED: SUPPORTED,
    inspect: inspect,
    analyze: analyze,
    clean: cleanFile,
    groupsOf: groupsOf,
    outputName: outputName,
    outputMime: outputMime,
    formatBytes: formatBytes,
    engine: engine
  };
});

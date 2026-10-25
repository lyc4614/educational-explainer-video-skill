'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { selectRecords, renderGallery } = require('./lib/gallery.cjs');
const root = fs.realpathSync(__dirname);
const readJSON = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const positiveInteger = value => Number.isInteger(value) && value > 0;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function localFile(relative) {
  assert(nonempty(relative), 'empty path');
  assert(!relative.includes('\\') && !relative.includes('\0'), `nonportable path: ${relative}`);
  assert(!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(relative), `absolute path or URL: ${relative}`);
  assert(relative.split('/').every(part => part && part !== '.' && part !== '..'), `unsafe path: ${relative}`);
  const target = path.resolve(root, relative);
  assert(target.startsWith(root + path.sep), `path escapes library: ${relative}`);
  const real = fs.realpathSync(target);
  assert(real.startsWith(root + path.sep) && fs.statSync(real).isFile(), `file or symlink escapes library: ${relative}`);
  return real;
}

function checkCatalog(catalog, generation) {
  assert.equal(catalog.version, 2, 'catalog schema version');
  assert(nonempty(catalog.title) && /^\d{4}-\d{2}-\d{2}$/.test(catalog.updated));
  assert(Array.isArray(catalog.records) && catalog.records.length > 0);
  assert.equal(catalog.count, catalog.records.length);
  assert.equal(generation.version, 1);
  assert.equal(generation.records.length, catalog.records.length);
  const ids = new Set(), files = new Set();
  const generated = new Map(generation.records.map(record => [record.id, record]));
  assert.equal(generated.size, generation.records.length, 'duplicate generation IDs');
  for (const record of catalog.records) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id), `invalid id: ${record.id}`);
    assert(!ids.has(record.id) && !files.has(record.file), `duplicate id/file: ${record.id}`);
    ids.add(record.id); files.add(record.file);
    for (const key of ['title', 'prompt', 'uses', 'cautions', 'style', 'created', 'provenance']) assert(nonempty(record[key]), `${record.id}.${key}`);
    assert(Array.isArray(record.tags) && record.tags.length && record.tags.every(nonempty), `${record.id}.tags`);
    assert(['透明主体', '完整场景'].includes(record.type), `${record.id}.type`);
    assert(positiveInteger(record.width) && positiveInteger(record.height));
    assert(Number.isFinite(record.transparentFraction) && record.transparentFraction >= 0 && record.transparentFraction <= 1);
    if (record.type === '透明主体') assert(record.transparentFraction > 0.05, `${record.id} alpha metadata`);
    const bounds = record.bbox;
    assert(bounds && Number.isInteger(bounds.left) && bounds.left >= 0 && Number.isInteger(bounds.top) && bounds.top >= 0);
    assert(positiveInteger(bounds.width) && positiveInteger(bounds.height));
    assert(bounds.left + bounds.width <= record.width && bounds.top + bounds.height <= record.height);
    assert.equal(record.anchor.kind, 'visible-bounds-center');
    assert.equal(record.anchor.x, bounds.left + bounds.width / 2);
    assert.equal(record.anchor.y, bounds.top + bounds.height / 2);
    assert.equal(typeof record.textBaked, 'boolean');
    assert(/^[a-f\d]{64}$/.test(record.sha256));
    assert.equal(record.file, `assets/${record.id}.png`);
    const buffer = fs.readFileSync(localFile(record.file));
    assert.equal(sha256(buffer), record.sha256, `${record.id} SHA-256`);
    const history = generated.get(record.id);
    assert(history && history.prompt === record.prompt && history.finalFile === record.file && history.finalSha256 === record.sha256, `${record.id} generation record`);
    assert.deepEqual(history, record.generationHistory, `${record.id} inline generation history`);
    assert(Array.isArray(history.sourceRecords) && history.sourceRecords.length && history.sourceRecords.every(nonempty));
    assert(Array.isArray(history.editPrompts) && history.editPrompts.every(nonempty));
    if (history.editPrompts.length) assert(nonempty(history.originalGenerationPrompt) && nonempty(history.revisionReason));
    assert(!('sourcePath' in record) && !('inspectionReport' in record), `${record.id} private source pointer`);
  }
  assert.deepEqual(new Set(fs.readdirSync(path.join(root, 'assets'))), new Set([...files].map(file => path.basename(file))), 'unregistered or missing asset files');
  assert.equal(catalog.license, '../LICENSE', 'refer to the original repository license');
  assert(Array.isArray(catalog.previews), 'previews');
  for (const overview of catalog.previews) {
    assert(nonempty(overview.title) && /^[a-f\d]{64}$/.test(overview.sha256));
    assert.equal(sha256(fs.readFileSync(localFile(overview.file))), overview.sha256, `preview hash: ${overview.file}`);
  }
}

function checkGallery(catalog) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(html, renderGallery(catalog), 'gallery is stale; run node build.cjs');
  assert(!/\b(?:fetch\s*\(|XMLHttpRequest|import\s*\(|https?:\/\/)/i.test(html), 'gallery must have no network dependency');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const script = new vm.Script(scripts[0][1], { filename: 'offline-gallery.js' });
  const elements = Object.fromEntries(['q', 'kind', 'count', 'grid', 'background'].map(id => [id, { value: '', innerHTML: '', textContent: '', className: '', listeners: {}, addEventListener(event, callback) { this.listeners[event] = callback; } }]));
  script.runInNewContext({ document: { getElementById: id => elements[id] } }, { timeout: 5000 });
  const expected = (query, type) => selectRecords(catalog.records, query, type);
  const check = (query, type = '') => {
    elements.q.value = query; elements.kind.value = type; elements.q.listeners.input();
    const found = expected(query, type);
    assert.equal(elements.count.textContent, `${found.length} / ${catalog.records.length} 项`, `offline count: ${query}/${type}`);
    assert.equal((elements.grid.innerHTML.match(/<article class="card">/g) || []).length, found.length, `offline card count: ${query}/${type}`);
    for (const record of found) assert(elements.grid.innerHTML.includes(`src="${record.file}"`));
    return found;
  };
  assert.equal(check('').length, catalog.count);
  for (const type of ['透明主体', '完整场景']) assert.equal(check('', type).length, catalog.records.filter(record => record.type === type).length);
  for (const record of catalog.records) {
    assert(check(record.id).some(found => found.id === record.id), `id search: ${record.id}`);
    assert(check(record.title).some(found => found.id === record.id), `title search: ${record.id}`);
    for (const tag of record.tags) assert(check(tag, record.type).some(found => found.id === record.id), `tag search: ${record.id}/${tag}`);
  }
  assert.equal(check('never-match-7e3d54d8').length, 0);
  elements.background.value = 'light'; elements.background.listeners.change();
  assert.equal(elements.grid.className, 'grid light');
  return { typeFilters: 2, idSearches: catalog.count, titleSearches: catalog.count, tagSearches: catalog.records.reduce((sum, record) => sum + record.tags.length, 0) };
}

function checkPublicText() {
  let files = 0;
  const walk = directory => {
    for (const name of fs.readdirSync(directory)) {
      const target = path.join(directory, name);
      const stat = fs.lstatSync(target);
      assert(!stat.isSymbolicLink(), 'published library must not contain symlinks');
      if (stat.isDirectory()) { assert(name !== 'node_modules', 'do not publish node_modules'); walk(target); continue; }
      assert(!/\.zip$/i.test(name), 'do not publish archives inside this library');
      if (!/\.(?:json|md|html|cjs|txt)$/i.test(name)) continue;
      files++;
      const text = fs.readFileSync(target, 'utf8');
      const absoluteWindowsHome = new RegExp('[A-Z]:[\\\\/]+(?:Users|Documents and Settings)[\\\\/]+', 'i');
      const absoluteUnixHome = new RegExp('/(?:Users|home)/[^/\\s]+/', 'i');
      assert(!absoluteWindowsHome.test(text) && !absoluteUnixHome.test(text), `private home path: ${path.relative(root, target)}`);
      assert(!/\.codex[\\/]+generated_images/i.test(text), `private generation receipt: ${name}`);
    }
  };
  walk(root);
  return files;
}

async function checkPixels(catalog) {
  let sharp;
  try { sharp = require('sharp'); } catch { throw new Error('Optional pixel check requires sharp available through normal Node module resolution; no package is bundled. Run without --pixels for the built-in checks.'); }
  for (const record of catalog.records) {
    const { data, info } = await sharp(localFile(record.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    assert.equal(info.width, record.width); assert.equal(info.height, record.height);
    let zero = 0, left = info.width, top = info.height, right = -1, bottom = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha === 0) zero++;
      if (alpha >= 16) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    }
    assert.equal(zero / (info.width * info.height), record.transparentFraction, `${record.id} transparentFraction`);
    assert.deepEqual({ left, top, width: right - left + 1, height: bottom - top + 1 }, record.bbox, `${record.id} bounds`);
  }
  return catalog.count;
}

(async () => {
  assert(process.argv.slice(2).every(argument => argument === '--pixels'), 'Usage: node verify.cjs [--pixels]');
  const catalog = readJSON('catalog.json'), generation = readJSON('generation-records.json');
  checkCatalog(catalog, generation);
  const search = checkGallery(catalog), publicTextFiles = checkPublicText();
  const pixels = process.argv.includes('--pixels') ? await checkPixels(catalog) : 'not requested';
  console.log(JSON.stringify({ status: 'PASS', count: catalog.count, transparent: catalog.records.filter(record => record.type === '透明主体').length, scenes: catalog.records.filter(record => record.type === '完整场景').length, sha256Matched: catalog.count, search, publicTextFiles, optionalPixelChecks: pixels, scope: 'schema, local paths, hashes, embedded offline search; no automated content/fact verification' }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

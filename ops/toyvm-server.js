'use strict';

// Local ToyVM live sessions for the original-DOS corpus, mounted behind the
// same authenticated gateway as /emulator (the gateway proxies every
// authorized path, so the session cookie protects this route too; there is no
// token in any URL). It serves a closed namespace and never an arbitrary file:
//   /toyvm/                     the live page (ops/toyvm-live/)
//   /toyvm/runtime/<bundle>.js  ToyVM's committed browser bundles
//   /toyvm/api/title?id=ID      one title from test/toyvm-dos-corpus/manifest.json
//   /toyvm/files/ID/PATH        a payload file, only for a launchable title,
//                               only a path its files/<id>.json lists, only
//                               inside its gameDir, only if the size still matches
// A title is launchable when the static assessment found no blocker and its
// payload is present. That makes it TRYABLE, never verified: the page says so.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { validateMountPaths } = require('./toyvm-live/live');

const PREFIX = '/toyvm/';
const PAGES = {
  'index.html': ['ops/toyvm-live/index.html', 'text/html; charset=utf-8'],
  'live.js': ['ops/toyvm-live/live.js', 'text/javascript; charset=utf-8'],
  'live.css': ['ops/toyvm-live/live.css', 'text/css; charset=utf-8'],
  'runtime/toyvm-bundle.js': ['docs/dos-corpus/live/toyvm-bundle.js', 'text/javascript; charset=utf-8'],
  'runtime/toyvm-jit-bundle.js': ['docs/dos-corpus/live/toyvm-jit-bundle.js', 'text/javascript; charset=utf-8'],
};
const MANIFEST = 'test/toyvm-dos-corpus/manifest.json';
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

async function inside(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative)) return null;
  try {
    const base = await fsp.realpath(root), file = await fsp.realpath(path.resolve(base, relative));
    return file.startsWith(base + path.sep) && (await fsp.stat(file)).isFile() ? file : null;
  } catch { return null; }
}
async function readJson(root, relative) {
  const file = await inside(root, relative);
  if (!file) return null;
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return null; }
}
function validFiles(entry, files) {
  if (!Array.isArray(files) || !files.length || typeof entry?.program !== 'string') return false;
  try { validateMountPaths(files); validateMountPaths(files, 'guestPath'); } catch { return false; }
  for (const f of files) {
    if (typeof f.path !== 'string' || !f.path || /[\\\0]/.test(f.path) || f.path.split('/').some(p => !p || p === '.' || p === '..')
        || !Number.isSafeInteger(f.size) || f.size < 0 || !/^[a-f0-9]{64}$/.test(f.sha256 || '')) return false;
  }
  return files.some(f => (f.guestPath ?? f.path).toLowerCase() === entry.program.toLowerCase());
}
const launchable = (t) => t?.payload?.present === true && ['untested', 'reviewed-gameplay'].includes(t?.toyvm?.status) && !(t.toyvm.blockers || []).length;

// The title as the page needs it. Blocked titles come back too -- with their
// reasons -- so a stale link explains itself instead of failing blank.
async function titleView(root, id) {
  const manifest = await readJson(root, MANIFEST);
  const t = manifest?.titles?.find((x) => x?.id === id);
  if (!t) return null;
  const view = { id: t.id, title: t.title, entry: t.entry, entrySource: t.entrySource, launchable: launchable(t),
    status: t.toyvm?.status || 'unknown', verdict: t.toyvm?.verdict || '', blockers: t.toyvm?.blockers || [], cautions: t.toyvm?.cautions || [],
    facts: manifest.toyvmFacts || {}, payload: t.payload, load: t.load || null, files: [] };
  if (view.launchable) {
    const list = await readJson(root, `test/toyvm-dos-corpus/files/${t.id}.json`);
    // Only declared original-file overlays may change a mount name. Ordinary
    // resources retain their manifest path, even when basenames coincide.
    let mapped = list?.files;
    if (Array.isArray(mapped)) {
      const aliases = new Map();
      for (const item of t.requiredOriginalFiles || []) {
        if (!item || typeof item.path !== 'string' || typeof item.guestPath !== 'string'
          || aliases.has(item.path) || !mapped.some(f => f.path === item.path)) { mapped = null; break; }
        aliases.set(item.path, item.guestPath);
      }
      if (mapped) mapped = mapped.map(f => ({ ...f, guestPath: aliases.get(f.path) ?? f.path }));
    }
    if (!list || !Array.isArray(list.files)) { view.launchable = false; view.reason = 'The file list for this title is missing.'; }
    else if (!validFiles(t.entry, mapped)) { view.launchable = false; view.reason = 'Invalid file list or entry program.'; }
    else if (!(await Promise.all(list.files.map(async f => { const p = await inside(path.join(root, t.gameDir), f.path); return p && (await fsp.stat(p)).size === f.size; }))).every(Boolean)) {
      view.launchable = false; view.reason = 'Payload files are missing or changed on this machine.';
    }
    else view.files = mapped.map((f) => ({ path: f.path, guestPath: f.guestPath, size: f.size, sha256: f.sha256, load: f.load, url: PREFIX + 'files/' + t.id + '/' + f.path.split('/').map(encodeURIComponent).join('/') }));
  } else view.reason = !t.payload?.present ? 'The payload is not on this machine.' : 'The static assessment found blockers; no session is offered.';
  return view;
}

function createToyvmHandler(root) {
  return async function serve(req, res) {
    const raw = req.url.split('?')[0];
    if (raw !== '/toyvm' && !raw.startsWith(PREFIX)) return false;
    const fail = (status, message, headers = {}) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }); res.end(req.method === 'HEAD' ? undefined : message); return true; };
    if (!['GET', 'HEAD'].includes(req.method)) return fail(405, 'Read-only ToyVM route', { Allow: 'GET, HEAD' });
    if (raw === '/toyvm') { res.writeHead(308, { Location: PREFIX + (req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : '') }); res.end(); return true; }
    if (/%2f|%5c/i.test(raw)) return fail(403, 'Path not allowed');
    let relative;
    try { relative = decodeURIComponent(raw.slice(PREFIX.length)) || 'index.html'; } catch { return fail(400, 'Invalid path'); }
    if (relative.split('/').some((p) => !p || p === '.' || p === '..') || /[\\\0]/.test(relative)) return fail(403, 'Path not allowed');
    // 'unsafe-eval' only here, and only because ToyVM's committed browser bundle
    // wraps each source module with `new Function` (bundle-browser.js); scripts
    // themselves still load from this origin only.
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'" };

    if (relative === 'api/title') {
      const id = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
      if (!ID.test(id)) return fail(400, 'Invalid title id');
      const view = await titleView(root, id);
      if (!view) return fail(404, 'Unknown DOS corpus title');
      const body = JSON.stringify(view);
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body); return true;
    }
    if (relative.startsWith('files/')) {
      const [, id, ...rest] = relative.split('/'), rel = rest.join('/');
      if (!ID.test(id || '') || !rel) return fail(400, 'Invalid file path');
      const manifest = await readJson(root, MANIFEST), t = manifest?.titles?.find((x) => x?.id === id);
      if (!t) return fail(404, 'Unknown DOS corpus title');
      if (!launchable(t)) return fail(409, 'This title has no ToyVM session: ' + ((t.toyvm?.blockers || []).map((b) => b.id).join(', ') || 'payload absent'));
      const list = await readJson(root, `test/toyvm-dos-corpus/files/${id}.json`), entry = list?.files?.find((f) => f.path === rel);
      if (!entry) return fail(404, 'File is not in this title\'s manifest');
      const file = await inside(path.join(root, t.gameDir), rel);
      if (!file) return fail(404, 'Payload file is missing on this machine');
      const stat = await fsp.stat(file);
      if (stat.size !== entry.size) return fail(409, `Payload file changed since the manifest was generated (${stat.size} bytes, manifest ${entry.size}). Regenerate with tools/toyvm-dos-corpus.js.`);
      res.writeHead(200, { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size });
      if (req.method === 'HEAD') { res.end(); return true; }
      const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
      return true;
    }
    const page = PAGES[relative];
    if (!page) return fail(404, 'Not part of the ToyVM route');
    const file = await inside(root, page[0]);
    if (!file) return fail(404, `${page[0]} is missing`);
    const stat = await fsp.stat(file);
    res.writeHead(200, { ...headers, 'Content-Type': page[1], 'Content-Length': stat.size });
    if (req.method === 'HEAD') { res.end(); return true; }
    const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    return true;
  };
}

module.exports = { createToyvmHandler, titleView, launchable, validFiles, PREFIX };

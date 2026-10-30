'use strict';

// One HTTP response that carries many whole files: the eager part of an
// app's file list (lib/app-files.js) in one round trip instead of one per
// file. Servers that can (tools/dev-server.js, ops/emulator-server.js) answer
//
//   GET <page dir>/__bundle?f=<url>&f=<url>...
//
// where each f is the same page-relative URL the page would otherwise GET on
// its own, and is checked exactly as that GET would be. A static host has no
// such route; host.js then fetches file by file, as before.
//
// Body: "WAB1", u32 LE header length, the header (UTF-8 JSON array, one entry
// per requested name in request order: {f, size} for a file that follows, or
// {f, status} for one that does not -- 404, or 413 past the byte cap), then
// the files' bytes back to back in header order. host.js
// WineAssembly.parseFileBundle is the reader.
//
// Files are read into memory before the headers go out, so Content-Length is
// exact even if a file changes underneath.

const fsp = require('fs/promises');

const MAGIC = 'WAB1';
const MAX_FILES = 256;
const MAX_BYTES = 64 * 1024 * 1024;

function bundleNames(searchParams) {
  return searchParams.getAll('f').slice(0, MAX_FILES);
}

// resolve(name) -> absolute path of a servable regular file, or null.
async function readBundle(names, resolve) {
  const entries = [];
  const bodies = [];
  let bytes = 0;
  for (const f of names) {
    let file = null;
    try { file = await resolve(f); } catch (_) { file = null; }
    if (!file) { entries.push({ f, status: 404 }); continue; }
    let data;
    try { data = await fsp.readFile(file); } catch (_) { entries.push({ f, status: 404 }); continue; }
    if (bytes + data.length > MAX_BYTES) { entries.push({ f, status: 413 }); continue; }
    bytes += data.length;
    entries.push({ f, size: data.length });
    bodies.push(data);
  }
  const header = Buffer.from(JSON.stringify(entries), 'utf8');
  const prefix = Buffer.alloc(8);
  prefix.write(MAGIC, 0, 'latin1');
  prefix.writeUInt32LE(header.length, 4);
  return Buffer.concat([prefix, header, ...bodies]);
}

async function writeBundle(res, names, resolve, headers = {}) {
  const body = await readBundle(names, resolve);
  res.writeHead(200, {
    ...headers,
    'Content-Type': 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

module.exports = { MAGIC, MAX_FILES, MAX_BYTES, bundleNames, readBundle, writeBundle };

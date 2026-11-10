'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const DEFAULT_MIME_TYPES = Object.freeze({
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.cue': 'text/plain; charset=utf-8',
  '.dll': 'application/octet-stream',
  '.exe': 'application/octet-stream',
  '.fon': 'application/octet-stream',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.iso': 'application/octet-stream',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.ppm': 'image/x-portable-pixmap',
  '.rar': 'application/vnd.rar',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wat': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.x': 'application/octet-stream',
  '.zip': 'application/zip',
});

function insideRoot(root, candidate) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

function mimeType(file, overrides = {}) {
  const ext = path.extname(file).toLowerCase();
  return overrides[ext] || DEFAULT_MIME_TYPES[ext] || 'application/octet-stream';
}

async function resolveStaticPath(root, rawUrl, options = {}) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl || '/', 'http://127.0.0.1').pathname);
  } catch (_) {
    return { status: 400, message: 'bad url' };
  }
  if (pathname === '/') pathname = '/' + (options.index || 'index.html');
  if (options.rewritePath) pathname = options.rewritePath(pathname);
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    return { status: 400, message: 'bad path' };
  }

  const rootReal = fs.realpathSync(root);
  const candidate = path.resolve(rootReal, '.' + pathname);
  if (!insideRoot(rootReal, candidate)) return { status: 403, message: 'forbidden' };

  let real;
  let stat;
  try {
    real = await fs.promises.realpath(candidate);
    // Worktree fixtures can be linked to a shared corpus. Only a test's
    // explicit filesystem allowlist may extend the realpath boundary; URL
    // traversal must still resolve inside the served checkout above.
    const allowed = options.allowedRealRoots || [];
    if (!insideRoot(rootReal, real) && !allowed.some(base => insideRoot(fs.realpathSync(base), real)))
      return { status: 403, message: 'forbidden' };
    stat = await fs.promises.stat(real);
  } catch (error) {
    const missing = error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
    return { status: missing ? 404 : 500, message: missing ? 'not found' : 'read error' };
  }
  if (!stat.isFile()) return { status: 404, message: 'not found' };
  return { file: real, pathname, stat, status: 200 };
}

function createStaticHandler(options = {}) {
  if (!options.root) throw new TypeError('static server requires a root directory');
  const root = fs.realpathSync(options.root);
  return async function staticHandler(request, response) {
    try {
      // Dynamic routes (including instrumented Worker scripts) need the same
      // isolation policy as static files. Apply it before a handler can end
      // the response; otherwise an isolated page cannot start its Worker.
      if (options.crossOriginIsolated) {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }
      if (options.handleRequest) {
        const handled = await options.handleRequest(request, response);
        if (handled || response.writableEnded) return;
      }
      const resolved = await resolveStaticPath(root, request.url, options);
      if (resolved.status !== 200) {
        response.writeHead(resolved.status);
        response.end(resolved.message);
        return;
      }
      const headers = {
        'Content-Type': options.mimeType
          ? options.mimeType(resolved.file)
          : mimeType(resolved.file, options.mimeTypes),
        'Content-Length': resolved.stat.size,
      };
      if (options.cacheControl !== false) {
        headers['Cache-Control'] = options.cacheControl || 'no-store';
      }
      if (options.crossOriginIsolated) {
        headers['Cross-Origin-Opener-Policy'] = 'same-origin';
        headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      }
      headers['Accept-Ranges'] = 'bytes';
      Object.assign(headers, typeof options.headers === 'function'
        ? options.headers(request, resolved) : (options.headers || {}));
      // One `bytes=a-b` range, as tools/dev-server.js serves: the page reads a
      // registered CD image's data track through HttpRangeProvider, and a 200
      // there would pull a whole 450MB track in to read one sector.
      const size = resolved.stat.size;
      let range = null;
      const rangeHeader = request.headers.range;
      if (rangeHeader) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
        let start = m && m[1] !== '' ? Number(m[1]) : NaN;
        let end = m && m[2] !== '' ? Number(m[2]) : size - 1;
        if (m && m[1] === '' && m[2] !== '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
        if (!m || !(start >= 0) || start >= size || end < start) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' });
          response.end();
          return;
        }
        range = { start, end: Math.min(end, size - 1) };
        headers['Content-Length'] = range.end - range.start + 1;
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      }
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = fs.createReadStream(resolved.file, range || undefined);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      if (response.headersSent) response.destroy(error);
      else {
        response.writeHead(500);
        response.end('server error');
      }
    }
  };
}

function startStaticServer(options = {}) {
  const handler = createStaticHandler(options);
  const server = http.createServer((request, response) => {
    handler(request, response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port || 0, options.host || '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

module.exports = {
  DEFAULT_MIME_TYPES,
  closeServer,
  createStaticHandler,
  insideRoot,
  mimeType,
  resolveStaticPath,
  startStaticServer,
};

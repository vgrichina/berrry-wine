'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function containedModule(root, expectedHash) {
  const realRoot = fs.realpathSync(root);
  const file = fs.realpathSync(path.join(root, 'build/wine-assembly.wasm'));
  if (!file.startsWith(realRoot + path.sep)) throw Error('Canonical module is outside served root');
  if (sha256(fs.readFileSync(file)) !== expectedHash) throw Error('Canonical module pin mismatch');
  return file;
}

function verifyDelivery({url, status, bytes}, expectedHash) {
  const receipt = {url, status, bytes: bytes.length, sha256: sha256(bytes)};
  if (status !== 200) throw Error('Canonical delivery HTTP ' + status);
  if (receipt.sha256 !== expectedHash) throw Error('Canonical delivery hash mismatch');
  return receipt;
}

async function preflightDelivery(root, url, expectedHash) {
  containedModule(root, expectedHash);
  const response = await fetch(url, {redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000)});
  return verifyDelivery({url: response.url, status: response.status,
    bytes: Buffer.from(await response.arrayBuffer())}, expectedHash);
}

async function preflightAssets(root, origin, pins) {
  const realRoot = fs.realpathSync(root), receipts = [];
  for (const [relative, expectedHash] of Object.entries(pins)) {
    const file = fs.realpathSync(path.join(root, relative));
    if (!file.startsWith(realRoot + path.sep)) throw Error('Capture asset outside served root: ' + relative);
    if (sha256(fs.readFileSync(file)) !== expectedHash) throw Error('Capture asset pin mismatch: ' + relative);
    const url = new URL(relative.split(path.sep).map(encodeURIComponent).join('/'), origin + '/').href;
    const response = await fetch(url, {redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000)});
    receipts.push({path: relative, ...verifyDelivery({url: response.url, status: response.status,
      bytes: Buffer.from(await response.arrayBuffer())}, expectedHash)});
  }
  return receipts;
}

// Serialized into the page before any application code. Do not close over Node
// helpers. Hold the actual fetch response until its bytes have been verified;
// a failed module cannot reach host.js or silently become a source build.
function installPageDeliveryGuard(expectedHash) {
  const originalFetch = globalThis.fetch.bind(globalThis);
  const state = globalThis.__kkriegerDelivery = {status: 'pending'};
  globalThis.fetch = async function (input, options) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const module = /\/wine-assembly(?:\.[^/]+)?\.wasm$/.test(url.pathname);
    const source = /\.(?:wat|watx)$/.test(url.pathname);
    try {
      if (source) throw Error('WAT source compilation forbidden in canonical capture');
      if (!module) return await originalFetch(input, options);
      if (url.origin !== location.origin || url.pathname !== '/build/wine-assembly.wasm')
        throw Error('Unexpected canonical module URL: ' + url.href);
      const response = await originalFetch(input, options);
      if (response.status !== 200 || response.redirected) throw Error('Canonical browser delivery HTTP ' + response.status);
      const bytes = await response.clone().arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== expectedHash) throw Error('Canonical browser delivery hash mismatch');
      if (state.status === 'failed') throw Error(state.error);
      Object.assign(state, {status: 'verified', url: response.url, sha256: hash, bytes: bytes.byteLength});
      return response;
    } catch (error) {
      if (module || source) Object.assign(state, {status: 'failed', error: String(error)});
      throw error;
    }
  };
}

module.exports = {containedModule, verifyDelivery, preflightDelivery, preflightAssets, installPageDeliveryGuard};

'use strict';
// Run-only evidence helper. Commands and close use this queue. Other receipts
// use synchronous writes on the same Node event loop. No streams/external
// writers may write captured files. Downloads use published dirs only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

class EvidenceBoundary {
  constructor(sourceDir, snapshotsDir) {
    this.source = path.resolve(sourceDir);
    this.snapshots = path.resolve(snapshotsDir);
    if (this.snapshots === this.source || this.snapshots.startsWith(this.source + path.sep))
      throw Error('snapshots must be outside the active evidence tree');
    this.tail = Promise.resolve();
    this.closed = false;
  }
  run(operation) {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => {});
    return result;
  }
  append(name, bytes) {
    return this.run(() => {
      if (this.closed) throw Error('evidence stream closed');
      if (path.basename(name) !== name) throw Error('flat log name required');
      fs.appendFileSync(path.join(this.source, name), bytes);
    });
  }
  snapshot(id, drain = async () => {}) {
    return this.run(async () => {
      if (!/^[a-z0-9-]+$/.test(id)) throw Error('fresh snapshot id required');
      fs.mkdirSync(this.snapshots, {recursive: true});
      const target = path.join(this.snapshots, id), staging = target + '.partial';
      if (fs.existsSync(target) || fs.existsSync(staging)) throw Error('snapshot id reused');
      // Hold the producer/close queue across asynchronous ACK/input draining.
      await drain();
      // Deliberately synchronous: Node event callbacks cannot append console,
      // HTTP or command receipts between these reads and manifest publication.
      // There are no external writers or fs streams in this run-only driver.
      fs.mkdirSync(staging);
      const files = {};
      const walk = (dir, relative = '') => {
        for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
          // Commands is the externally uploaded request mailbox, not evidence.
          // Canonical executed requests are recorded in commands.jsonl.
          if (item.name === 'chrome-profile' || (item.isDirectory() && item.name === 'commands') || item.name.endsWith('.tmp')) continue;
          const name = path.join(relative, item.name), src = path.join(dir, item.name);
          if (item.isSymbolicLink()) throw Error('symlink in evidence: ' + name);
          if (item.isDirectory()) walk(src, name);
          else if (item.isFile()) {
            const bytes = fs.readFileSync(src), dest = path.join(staging, name);
            fs.mkdirSync(path.dirname(dest), {recursive: true});
            fs.writeFileSync(dest, bytes, {flag: 'wx', mode: 0o444});
            files[name] = {bytes: bytes.length, sha256: sha256(bytes)};
          } else throw Error('unsupported evidence entry: ' + name);
        }
      };
      walk(this.source);
      const manifest = {version: 1, id, closed: this.closed, excluded: ['commands/', 'chrome-profile/', '*.tmp'], files};
      fs.writeFileSync(path.join(staging, 'snapshot-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx', mode: 0o444});
      fs.renameSync(staging, target); // Only completed immutable trees are advertised.
      return {directory: target, manifest};
    });
  }
  close(operation = async () => {}) {
    return this.run(async () => {
      if (this.closed) return;
      this.closed = true;
      await operation();
    });
  }
}

function verify(directory, manifest) {
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = path.resolve(directory, name);
    if (!file.startsWith(path.resolve(directory) + path.sep)) throw Error('escaping manifest path');
    const bytes = fs.readFileSync(file);
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256)
      throw Error('SHA/length mismatch: ' + name);
  }
  return true;
}
module.exports = {EvidenceBoundary, verify, sha256};

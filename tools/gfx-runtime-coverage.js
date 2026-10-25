#!/usr/bin/env node
'use strict';

// Evidence integrity gate only. Never infer a corpus from the static API census.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const BACKENDS = ['software', 'webgl'];
const text = x => typeof x === 'string' && x.trim() === x && x.length > 0;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, expected) => object(x) && Object.keys(x).sort().join(',') === [...expected].sort().join(',');

function verify(manifest, evidence, artifactRoot) {
  if (!keys(manifest, ['version', 'apps']) || manifest.version !== 1 ||
      !Array.isArray(manifest.apps) || !manifest.apps.length) throw new Error('invalid manifest');
  const apps = new Map();
  for (const item of manifest.apps) {
    if (!keys(item, ['app', 'build']) || !text(item.app) || !text(item.build) || apps.has(item.app)) {
      throw new Error('invalid or duplicate manifest app');
    }
    apps.set(item.app, item.build);
  }
  if (!keys(evidence, ['version', 'records']) || evidence.version !== 1 || !Array.isArray(evidence.records)) {
    throw new Error('invalid evidence document');
  }
  const root = fs.realpathSync(artifactRoot);
  const rows = evidence.records.map((record, index) => {
    const reasons = [];
    const r = object(record) ? record : {};
    if (!keys(r, ['app', 'backend', 'build', 'kind', 'run', 'observation', 'artifact'])) reasons.push('invalid-record-schema');
    if (!text(r.app) || !apps.has(r.app)) reasons.push('unknown-app');
    if (!BACKENDS.includes(r.backend)) reasons.push('unknown-or-missing-backend');
    if (!text(r.build) || (apps.has(r.app) && apps.get(r.app) !== r.build)) reasons.push('build-mismatch');
    if (r.kind !== 'runtime') reasons.push('not-runtime-evidence');
    if (!text(r.run)) reasons.push('missing-run');
    if (!text(r.observation)) reasons.push('missing-runtime-observation');
    const a = object(r.artifact) ? r.artifact : {};
    let resolved;
    if (!keys(a, ['path', 'sha256']) || !text(a.path) || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)) {
      reasons.push('invalid-artifact-schema');
    } else {
      try {
        if (path.isAbsolute(a.path)) throw new Error('outside root');
        resolved = fs.realpathSync(path.resolve(root, a.path));
        const relative = path.relative(root, resolved);
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
          reasons.push('artifact-outside-root');
        } else {
          const fd = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
          try {
            if (!fs.fstatSync(fd).isFile()) reasons.push('artifact-not-file');
            else {
              const hash = crypto.createHash('sha256');
              const buffer = Buffer.alloc(64 * 1024);
              let n;
              while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, n));
              if (hash.digest('hex') !== a.sha256) reasons.push('artifact-sha256-mismatch');
            }
          } finally { fs.closeSync(fd); }
        }
      } catch { reasons.push('artifact-unavailable'); }
    }
    return { index, r, resolved, reasons };
  });
  // Reject every member of an ambiguous group; never choose a first winner.
  for (const [reason, identity] of [
    ['duplicate-app-backend', row => apps.has(row.r.app) && BACKENDS.includes(row.r.backend) ? JSON.stringify([row.r.app, row.r.backend]) : null],
    ['duplicate-run', row => text(row.r.run) ? row.r.run : null],
    ['reused-artifact', row => row.resolved || null],
    ['reused-artifact-digest', row => /^[a-f0-9]{64}$/.test(row.r.artifact?.sha256) ? row.r.artifact.sha256 : null],
  ]) {
    const groups = new Map();
    for (const row of rows) {
      const id = identity(row);
      if (id !== null) { if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row); }
    }
    for (const group of groups.values()) if (group.length > 1) for (const row of group) row.reasons.push(reason);
  }
  const rejected = rows.filter(row => row.reasons.length).map(row => ({
    record: row.index, app: text(row.r.app) ? row.r.app : null,
    backend: text(row.r.backend) ? row.r.backend : null, reasons: row.reasons.sort(),
  }));
  const results = [...apps.keys()].sort().map(app => ({
    app, build: apps.get(app), backends: BACKENDS.map(backend => {
      const matches = rows.filter(row => row.r.app === app && row.r.backend === backend);
      const accepted = matches.find(row => !row.reasons.length);
      return accepted ? { backend, status: 'accepted', record: accepted.index, run: accepted.r.run,
        artifact: accepted.r.artifact } : { backend, status: matches.length ? 'rejected' : 'missing' };
    }),
  }));
  return { version: 1, complete: rejected.length === 0 && results.every(app =>
    app.backends.every(backend => backend.status === 'accepted')), apps: results, rejected };
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node tools/gfx-runtime-coverage.js MANIFEST.json EVIDENCE.json ARTIFACT_ROOT');
    return 0;
  }
  try {
    if (args.length !== 3) throw new Error('expected MANIFEST.json EVIDENCE.json ARTIFACT_ROOT (see --help)');
    const result = verify(JSON.parse(fs.readFileSync(args[0], 'utf8')),
      JSON.parse(fs.readFileSync(args[1], 'utf8')), args[2]);
    console.log(JSON.stringify(result, null, 2));
    return result.complete ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ version: 1, complete: false, error: error.message }));
    return 2;
  }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { verify };

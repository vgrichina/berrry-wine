'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the real gate against an in-memory filesystem and Git index. No
// language fixture is written or invoked, and no second checkout is created.
const script = new vm.Script(fs.readFileSync(path.join(__dirname, 'check-no-python.js'), 'utf8'));
const root = '/gate-fixture';
const policyPath = path.join(root, 'tools/no-python-allowlist.json');
const language = ['py', 'thon'].join('');
const caller = '#!/bin/sh\n' + language + '3 legacy-task\n';
const legacy = { pyFiles: ['scratch/committed/task.py'], callers: ['scratch/committed/caller.sh'] };
function run({ tracked = [...legacy.pyFiles, ...legacy.callers], others = [], files = {}, nonFiles = [],
  index = { 'scratch/committed/caller.sh': caller }, allow = legacy, prune = false } = {}) {
  const errors = [], writes = [], indexReads = [];
  const missing = name => Object.assign(new Error('missing ' + name), { code: 'ENOENT' });
  let status = 0;
  const context = {
    __dirname: path.join(root, 'tools'), Buffer,
    console: { log() {}, error: value => errors.push(String(value)) },
    process: { argv: ['node', 'check-no-python.js', ...(prune ? ['--prune'] : [])],
      exit: code => { throw Object.assign(new Error('exit'), { exitStatus: code }); } },
    require(name) {
      if (name === 'node:path') return path;
      if (name === 'node:fs') return {
        existsSync: file => file === policyPath || Object.hasOwn(files, path.relative(root, file)),
        statSync(file) {
          const rel = path.relative(root, file);
          if (!Object.hasOwn(files, rel)) throw missing(rel);
          return { isFile: () => !nonFiles.includes(rel) };
        },
        readFileSync(file) {
          if (file === policyPath) return JSON.stringify(allow);
          const rel = path.relative(root, file);
          if (Object.hasOwn(files, rel)) return files[rel];
          throw missing(rel);
        },
        writeFileSync(file, text) { assert.equal(file, policyPath); writes.push(JSON.parse(text)); },
      };
      if (name === 'node:child_process') return {
        execFileSync(command, args) {
          assert.equal(command, 'git');
          if (args[0] === 'ls-files') return Buffer.from((args.includes('--cached') ? tracked : others).join('\0') + '\0');
          assert.equal(args[0], 'show');
          if (args[1] === '115c56ec7:tools/no-python-allowlist.json') return Buffer.from(JSON.stringify(legacy));
          const rel = args[1].slice(1); assert.ok(args[1].startsWith(':'));
          indexReads.push(rel);
          if (!Object.hasOwn(index, rel)) throw new Error('missing index blob: ' + rel);
          return Buffer.from(index[rel]);
        },
      };
      throw new Error('unexpected module: ' + name);
    },
  };
  try { script.runInNewContext(context); }
  catch (error) {
    status = error.exitStatus ?? 1;
    if (error.exitStatus === undefined) errors.push(error.message);
  }
  return { status, errors, writes, indexReads };
}

let result = run();
assert.equal(result.status, 0, 'missing tracked caller must be classified from its index blob');
assert.deepEqual(result.indexReads, ['scratch/committed/caller.sh']);
result = run({ prune: true });
assert.equal(result.status, 0);
assert.equal(result.writes.length, 0, 'a partial checkout must not prune committed legacy callers');
result = run({ tracked: [...legacy.pyFiles, ...legacy.callers, 'tools/new.py'] });
assert.equal(result.status, 1, 'new tracked language file is rejected even when absent locally');
assert.ok(result.errors.some(s => s.includes('NEW Python file')));
result = run({ others: ['tools/new.py'], files: { 'tools/new.py': '' } });
assert.equal(result.status, 1, 'untracked source is checked before commit');
result = run({ others: ['scratch/transient.py'], files: { 'scratch/transient.py': '' } });
assert.equal(result.status, 0, 'untracked scratch evidence remains outside the gate');
result = run({ others: ['tools/directory.py'], files: { 'tools/directory.py': '' },
  nonFiles: ['tools/directory.py'] });
assert.equal(result.status, 0, 'untracked non-files are excluded from the source gate');
result = run({ files: { 'scratch/committed/caller.sh': '#!/bin/sh\necho ported\n' }, prune: true });
assert.equal(result.status, 0);
assert.deepEqual(result.writes[0].callers, [], 'a real working-tree port takes precedence over the old index');
assert.equal(result.indexReads.length, 0);
result = run({ index: {} });
assert.equal(result.status, 1, 'missing index data must not silently pass the gate');
assert.ok(result.errors.some(s => s.includes('missing index blob')));
result = run({ others: ['tools/new.cjs'], files: { 'tools/new.cjs': 'child.spawnSync("' + language + '3", []);' } });
assert.equal(result.status, 1, 'new callers outside scratch are rejected');
assert.ok(result.errors.some(s => s.includes('NEW file(s) that run')));
console.log('PASS no-python gate: nine index/worktree/regular-file/ratchet regression cases');

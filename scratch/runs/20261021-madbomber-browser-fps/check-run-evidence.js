'use strict';

// Artifact references, not historical commands, source trees or working directories.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fields = ['screenshot', 'screenshots', 'diagrams', 'artifacts', 'gameplayScreenshots', 'evidence'];
const inside = (base, file) => file.startsWith(base + path.sep);

// Resolve existing ancestors too: missing leaves beneath an escaping symlink
// must fail containment rather than masquerade as ordinary missing evidence.
function physical(file, seen = new Set()) {
  if (seen.has(file)) throw new Error('Symlink cycle: ' + file);
  seen.add(file);
  try { return fs.realpathSync(file); } catch (e) {
    if (!['ENOENT', 'ENOTDIR'].includes(e.code)) throw e;
    try {
      if (fs.lstatSync(file).isSymbolicLink()) return physical(path.resolve(path.dirname(file), fs.readlinkSync(file)), seen);
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
    const parent = path.dirname(file);
    return parent === file ? file : path.join(physical(parent, seen), path.basename(file));
  }
}

function references(raw) {
  const refs = [];
  function visit(parent, key) {
    const value = parent[key];
    if (typeof value === 'string') {
      if (!/sha256|hash|description|label|kind|type/i.test(key)) refs.push({parent, key, value});
    } else if (value && typeof value === 'object') {
      for (const child of Object.keys(value)) visit(value, child);
    }
  }
  for (const field of fields) if (raw[field] !== undefined) visit(raw, field);
  for (const field of ['sourceManifest', 'dirtyPatch']) {
    if (raw.build?.[field]) visit(raw.build, field);
  }
  return refs;
}

// The fields ops/readers.js requires before it will list a run at all (see
// ops/README "Result format"). A record that fails them is dropped from the
// dashboard with only a source notice, so its candidate card shows no capture.
const OUTCOMES = ['passed', 'failed', 'timeout', 'harness-error', 'running', 'unknown'];
function schemaProblems(raw) {
  const problems = [];
  if (typeof raw.candidateId !== 'string') problems.push('candidateId must be a string');
  if (typeof raw.startedAt !== 'string' || Number.isNaN(Date.parse(raw.startedAt))) problems.push('startedAt must be an ISO time');
  if (!OUTCOMES.includes(raw.outcome)) problems.push(`outcome must be one of ${OUTCOMES.join('|')}`);
  if (raw.verification !== undefined && raw.verification !== 'reviewed' && raw.verification !== 'unreviewed') problems.push('verification must be reviewed|unreviewed');
  return problems;
}

function inspect(root) {
  root = path.resolve(root);
  const runs = path.join(root, 'scratch/runs'), records = [], errors = [], missing = [], invalid = [];
  if (!fs.existsSync(runs)) throw new Error('Run directory missing: ' + runs);
  for (const id of fs.readdirSync(runs).sort()) {
    const dir = path.join(runs, id), file = path.join(dir, 'result.json');
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const record = {id, dir, file, raw, refs: references(raw)};
    records.push(record);
    const problems = schemaProblems(raw);
    if (problems.length) invalid.push({run: id, problems});
    for (const ref of record.refs) {
      ref.target = path.resolve(dir, ref.value);
      try { ref.real = fs.realpathSync(ref.target); } catch (e) { ref.missing = e.code; }
      // Require portable relative paths and both lexical and physical containment.
      ref.outside = path.isAbsolute(ref.value) || !inside(dir, ref.target) ||
        !inside(dir, physical(ref.target)) || ref.value.startsWith('scratch/');
      if (ref.outside) errors.push({run: id, path: ref.value, reason: 'outside run directory'});
      else if (ref.missing) missing.push({run: id, path: ref.value, reason: ref.missing});
    }
  }
  return {records, errors, missing, invalid};
}

// Preserve original files and links. Copy only named files, verify bytes, then
// atomically publish rewritten metadata. Never recursively copy a work directory.
function localize(root) {
  root = path.resolve(root);
  const {records} = inspect(root), changes = [], missing = [];
  for (const record of records) {
    let changed = false;
    for (const ref of record.refs.filter(r => r.outside)) {
      const source = ref.value.startsWith('scratch/') ? path.resolve(root, ref.value) : ref.target;
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        missing.push({run: record.id, path: ref.value}); continue;
      }
      const bytes = fs.readFileSync(source), sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const disk = fs.statfsSync(record.dir);
      if (disk.bavail * disk.bsize - bytes.length < 2 * 1024 ** 3) throw new Error('Would cross 2 GiB free-space floor');
      const relative = 'evidence/' + sha256 + '-' + path.basename(source);
      const destination = path.join(record.dir, relative);
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      if (fs.existsSync(destination)) {
        if (fs.lstatSync(destination).isSymbolicLink() || !fs.readFileSync(destination).equals(bytes)) throw new Error('Destination conflict: ' + destination);
      } else fs.writeFileSync(destination, bytes, {flag: 'wx'});
      if (!fs.readFileSync(destination).equals(bytes)) throw new Error('Copy verification failed');
      ref.parent[ref.key] = relative;
      changes.push({run: record.id, from: ref.value, to: relative, sha256, bytes: bytes.length});
      changed = true;
    }
    if (changed) {
      const temp = record.file + '.localize-' + process.pid;
      fs.writeFileSync(temp, JSON.stringify(record.raw, null, 2) + '\n', {flag: 'wx'});
      fs.renameSync(temp, record.file);
    }
  }
  return {changes, missing};
}

if (require.main === module) {
  const args = process.argv.slice(2), apply = args.includes('--localize');
  const root = args.find(a => !a.startsWith('--')) || path.join(__dirname, '..');
  try {
    const migration = apply ? localize(root) : undefined;
    const result = inspect(root);
    console.log(JSON.stringify({runs: result.records.length, errors: result.errors, missing: result.missing,
      invalid: result.invalid, migration}, null, 2));
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = {references, inspect, localize, schemaProblems};

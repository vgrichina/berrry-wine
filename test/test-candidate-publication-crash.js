'use strict';

// Real subprocess death; only acquisition/extraction use bounded synthetic data.
// The source argument runs the identical oracle against the immutable baseline.
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const sourceFile = path.resolve(process.argv[2] || path.join(__dirname, '../tools/fetch-candidate-corpus.js'));
const payload = Buffer.from('synthetic pinned package');
const sha1 = crypto.createHash('sha1').update(payload).digest('hex');
const candidate = { id: 'sample', name: 'Local only', version: '1', packages: [
  { url: 'https://fixture.invalid/local', sha1, type: 'archive' },
], browser: { fileRoot: '.', exe: 'game.exe' } };

function snapshot(at) {
  if (!fs.existsSync(at)) return null;
  const out = {};
  function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const key = prefix + entry.name;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) out[key] = 'link:' + fs.readlinkSync(file);
      else if (entry.isDirectory()) walk(file, key + '/');
      else out[key] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
  }
  walk(at, '');
  return out;
}

async function child() {
  const root = process.env.PUBLICATION_FIXTURE;
  const mode = process.env.PUBLICATION_MODE;
  const dest = path.join(root, 'assets/sample');
  const realRequire = createRequire(path.join(__dirname, '../tools/fetch-candidate-corpus.js'));
  const facade = { ...fs,
    readFileSync(file, ...args) {
      if (file === path.join(path.dirname(sourceFile), '../test/candidate-corpus/manifest.json')) return JSON.stringify({ assetRoot: path.join(root, 'assets') });
      return fs.readFileSync(file, ...args);
    },
    renameSync(from, to) {
      const old = from === dest;
      const next = to === dest && path.basename(from) === 'fixture';
      if ((old && mode === 'before-old') || (next && mode === 'before-new')) process.kill(process.pid, 'SIGKILL');
      if (next && ['rollback', 'rollback-fail'].includes(mode)) throw Error('synthetic publication failure');
      if (to === dest && path.basename(from) === 'previous' && mode === 'rollback-fail') throw Error('synthetic rollback failure');
      fs.renameSync(from, to);
      if ((old && mode === 'after-old') || (next && mode === 'after-new')) process.kill(process.pid, 'SIGKILL');
    },
  };
  const transport = { get(url, options, callback) {
    if (mode.startsWith('recover')) throw Error('restart must reconcile before acquisition');
    const request = new EventEmitter();
    process.nextTick(() => {
      const response = Readable.from([payload]);
      response.statusCode = 200; response.headers = {};
      callback(response);
    });
    return request;
  } };
  const context = vm.createContext({ Buffer, URL, setTimeout, console,
    __dirname: path.dirname(sourceFile),
    process: { argv: ['node', sourceFile, ...(mode === 'recover-prepare' ? ['--prepare'] : mode === 'recover' ? [] : ['--force'])] },
    fetch() { throw Error('live fetch forbidden'); },
    require(name) {
      if (name === 'fs') return facade;
      if (name === 'http' || name === 'https') return transport;
      if (name === 'os') return { tmpdir: () => path.join(root, 'tmp') };
      if (name === 'child_process') return { spawnSync(command, args) {
        assert.equal(command, '7z');
        const output = args.find(arg => arg.startsWith('-o')).slice(2);
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'game.exe'), 'new verified executable');
        return { status: 0 };
      } };
      return realRequire(name);
    },
  });
  const source = fs.readFileSync(sourceFile, 'utf8').split('\n(async () => {')[0];
  vm.runInContext(source + '\nthis.run = fetchCandidate;', context, { filename: sourceFile });
  const result = await context.run(candidate);
  if (result.failed) process.exitCode = 1;
}

function invoke(root, mode) {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', __filename, sourceFile], {
    env: { ...process.env, PUBLICATION_FIXTURE: root, PUBLICATION_MODE: mode },
    encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', maxBuffer: 128 * 1024,
  });
  assert.ifError(result.error);
  return result;
}

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-publication-crash-'));
  const dest = path.join(root, 'assets/sample');
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(root, 'tmp'));
  fs.writeFileSync(path.join(dest, 'game.exe'), 'old usable executable');
  fs.writeFileSync(path.join(dest, 'user.sav'), Buffer.from([0, 255, 13, 10, 128]));
  fs.writeFileSync(path.join(dest, '.candidate-source.json'), '{"old":true}\n');
  const before = snapshot(dest);
  try { run(root, dest, before); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function main() {
  let passed = 0;
  for (const mode of ['after-old', 'before-old', 'before-new', 'after-new', 'rollback', 'rollback-fail', 'normal', 'prepare-restart', 'initial-before-new', 'initial-after-new']) {
    fixture((root, dest, before) => {
      if (mode.startsWith('initial-')) fs.rmSync(dest, { recursive: true });
      const first = invoke(root, mode === 'prepare-restart' ? 'after-old' : mode.replace('initial-', ''));
      if (!['rollback', 'rollback-fail', 'normal'].includes(mode)) assert.equal(first.signal, 'SIGKILL', first.stderr);
      else assert.equal(first.status, mode.startsWith('rollback') ? 1 : 0, first.stderr);
      if (['after-old', 'before-new', 'rollback-fail'].includes(mode)) {
        assert.equal(snapshot(dest), null, 'crash gap actually exercised');
        console.log('OBSERVED missing final before restart: ' + mode);
      }
      const restarted = invoke(root, mode === 'prepare-restart' ? 'recover-prepare' : 'recover');
      assert.equal(restarted.status, 0, mode + ': ' + restarted.stdout + restarted.stderr);
      if (['after-new', 'normal'].includes(mode) || mode.startsWith('initial-')) {
        assert.equal(fs.readFileSync(path.join(dest, 'game.exe'), 'utf8'), 'new verified executable');
        assert.equal(JSON.parse(fs.readFileSync(path.join(dest, '.candidate-source.json'))).packages[0].sha1, sha1);
      } else {
        const after = snapshot(dest);
        // KEEP may refresh browser metadata; all original bytes must survive.
        for (const [name, hash] of Object.entries(before)) assert.equal(after[name], hash, mode + ': ' + name);
      }
      assert.deepEqual(fs.readdirSync(path.join(root, 'assets')), ['sample']);
      assert.equal(invoke(root, 'recover').status, 0, 'idempotent restart');
      console.log('PASS crash/restart ' + mode); passed++;
    });
  }
  for (const mode of ['unverified', 'foreign-key', 'stale-inode', 'journal-symlink', 'stage-symlink', 'previous-symlink', 'stage-file-symlink', 'changed-save', 'ambiguous', 'unjournalled', 'changed-final', 'truncated-journal', 'foreign-entry', 'final-symlink']) {
    fixture((root, dest) => {
      const killed = invoke(root, mode === 'changed-final' ? 'after-new' : 'after-old');
      assert.equal(killed.signal, 'SIGKILL');
      const assets = path.join(root, 'assets');
      const stage = path.join(assets, fs.readdirSync(assets).find(name => name.startsWith('sample.replacement-')));
      const journal = path.join(stage, 'publication.json');
      assert.ok(fs.existsSync(journal), 'durable journal exists');
      if (mode === 'unverified') fs.writeFileSync(path.join(stage, 'fixture/game.exe'), 'tampered');
      if (mode === 'changed-save') fs.writeFileSync(path.join(stage, 'previous/user.sav'), 'new user save');
      if (mode === 'changed-final') fs.writeFileSync(path.join(dest, 'user.sav'), 'new save after publication');
      if (mode === 'final-symlink') fs.symlinkSync(path.join(stage, 'previous'), dest);
      if (mode === 'truncated-journal') fs.writeFileSync(journal, '{"schema":');
      if (mode === 'foreign-entry') fs.writeFileSync(path.join(stage, 'unexpected'), 'retain evidence');
      if (['foreign-key', 'stale-inode'].includes(mode)) {
        const record = JSON.parse(fs.readFileSync(journal));
        record[mode === 'foreign-key' ? 'key' : 'stage'] = 'foreign';
        fs.writeFileSync(journal, JSON.stringify(record));
      }
      if (mode === 'journal-symlink') { fs.renameSync(journal, path.join(root, 'journal')); fs.symlinkSync(path.join(root, 'journal'), journal); }
      if (mode === 'stage-symlink') { fs.renameSync(stage, path.join(root, 'foreign')); fs.symlinkSync(path.join(root, 'foreign'), stage); }
      if (mode === 'previous-symlink') { fs.renameSync(path.join(stage, 'previous'), path.join(root, 'foreign')); fs.symlinkSync(path.join(root, 'foreign'), path.join(stage, 'previous')); }
      if (mode === 'stage-file-symlink') { fs.unlinkSync(path.join(stage, 'fixture/game.exe')); fs.symlinkSync(path.join(stage, 'previous/user.sav'), path.join(stage, 'fixture/game.exe')); }
      if (mode === 'ambiguous') fs.mkdirSync(path.join(assets, 'sample.replacement-foreign'));
      if (mode === 'unjournalled') fs.unlinkSync(journal);
      const before = snapshot(root);
      const rejected = invoke(root, 'recover');
      assert.notEqual(rejected.status, 0, mode);
      assert.deepEqual(snapshot(root), before, 'rejection preserves originals/evidence: ' + mode);
      console.log('PASS reject/preserve ' + mode); passed++;
    });
  }
  console.log(JSON.stringify({ passed, sourceFile, sourceSHA256: crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex') }));
}

if (process.env.PUBLICATION_FIXTURE) child().catch(error => { console.error(error.stack); process.exitCode = 1; });
else main();

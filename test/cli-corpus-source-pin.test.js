#!/usr/bin/env node
'use strict';

// Pure CLI source-pin checks: no acquisition, compiler or guest process is allowed.
// --manifest supplies an authorized current fixture when testing an older source base.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');

const cliPath = path.join(__dirname, 'test-cli-candidate-corpus.js');
// Each probe uses the real process.exit, including usage's early exit. Only
// the manifest read is substituted; executable discovery uses real fixture files.
if (process.argv[2] === '--probe') {
  const manifestJSON = fs.readFileSync(0, 'utf8');
  const cliRequire = createRequire(cliPath);
  const deny = () => { throw new Error('FORBIDDEN compiler/guest invocation'); };
  process.argv = [process.execPath, cliPath, ...process.argv.slice(3)];
  vm.runInNewContext(fs.readFileSync(cliPath, 'utf8'), {
    __dirname, Buffer, Set, Map, process, console,
    require(name) {
      if (name === './compile-src') return { compileSrcWasm: deny };
      if (name === 'child_process') return { spawnSync: deny };
      if (name === 'fs') return {
        ...fs,
        readFileSync(filename, ...rest) {
          if (path.resolve(filename) === path.join(__dirname, 'candidate-corpus', 'manifest.json')) {
            return manifestJSON;
          }
          return fs.readFileSync(filename, ...rest);
        },
      };
      return cliRequire(name);
    },
  }, { filename: cliPath, timeout: 2000 });
} else {
  const manifestArg = process.argv.slice(2).find(arg => arg.startsWith('--manifest='));
  const manifestPath = manifestArg ? path.resolve(manifestArg.slice('--manifest='.length))
    : path.join(__dirname, 'candidate-corpus', 'manifest.json');
  const supplied = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-corpus-contract-'));
  const interactiveId = 'baldurs-gate-interactive-demo';
  const thpsId = 'thps2-demo';
  const thps = supplied.candidates.find(candidate => candidate.id === thpsId);
  assert(thps, 'authorized fixture includes THPS2');
  const executable = path.join(temporary, thps.fixture || thps.id, thps.executables[0]);
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  const pe = Buffer.alloc(90);
  pe.write('MZ');
  pe.writeUInt32LE(64, 0x3c);
  pe.write('PE\0\0', 64, 'binary');
  pe.writeUInt16LE(0x14c, 68);
  pe.writeUInt16LE(0x10b, 88);
  fs.writeFileSync(executable, pe);

  function fixture() {
    const manifest = JSON.parse(JSON.stringify(supplied));
    manifest.assetRoot = temporary;
    return manifest;
  }

  async function run(manifest, args) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=192', __filename, '--probe', ...args], {
      input: JSON.stringify(manifest), encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.strictEqual(result.signal, null);
    const output = `${result.stdout}${result.stderr}`;
    assert.doesNotMatch(output, /FORBIDDEN/, 'pure checks must never invoke compiler or guest');
    return { code: result.status, output };
  }

  async function main() {
    let passed = 0;
    async function check(name, body) {
      await body();
      passed++;
      console.log(`PASS ${name}`);
    }
    await check('selected THPS2 dry-run uses only the selected executable', async () => {
      const result = await run(fixture(), ['--id=thps2-demo', '--dry-run', '--strict']);
      assert.strictEqual(result.code, 0, result.output);
      assert.match(result.output, /LOCAL   thps2-demo:/);
      assert.match(result.output, /1 ready\/local, 0 blocked, 0 skipped, 0 harness failures/);
      assert.doesNotMatch(result.output, /(?:LOCAL|SKIP)\s+baldurs-gate/);
    });
    await check('list selection trims and deduplicates IDs without launching', async () => {
      const result = await run(fixture(), ['--id= thps2-demo,thps2-demo, ', '--list']);
      assert.strictEqual(result.code, 0, result.output);
      assert.match(result.output, /^LOCAL  thps2-demo\t/);
      assert.strictEqual(result.output.trim().split('\n').length, 1);
    });
    await check('unknown selected ID still exits with usage status 2', async () => {
      const result = await run(fixture(), ['--id=unknown-corpus-contract-id', '--dry-run']);
      assert.strictEqual(result.code, 2, result.output);
      assert.match(result.output, /unknown candidate IDs: unknown-corpus-contract-id/);
      assert.doesNotMatch(result.output, /candidate CLI corpus:/);
    });
    await check('multiple selected IDs retain missing-fixture skip semantics', async () => {
      const result = await run(fixture(), [`--id=${thpsId},${interactiveId}`, '--dry-run', '--strict']);
      assert.strictEqual(result.code, 0, result.output);
      assert.match(result.output, /SKIP    baldurs-gate-interactive-demo:/);
      assert.match(result.output, /1 ready\/local, 0 blocked, 1 skipped, 0 harness failures/);
    });
    const changes = [
      ['changed URL', c => { c.packages[0].url += '?changed=1'; }, /exact Archive.org artifact and SHA-1/],
      ['changed hash', c => { c.packages[0].sha1 = '0'.repeat(40); }, /exact Archive.org artifact and SHA-1/],
      ['old ISO URL and hash', c => {
        c.packages[0].url = 'https://archive.org/download/bg-demo/BG%20Demo.iso';
        c.packages[0].sha1 = '3796defce51a3e867aa216bc27f0be0689fdadf0';
      }, /exact Archive.org artifact and SHA-1/],
      ['additional package', c => { c.packages.push({ ...c.packages[0] }); }, /exact Archive.org artifact and SHA-1/],
      ['changed package type', c => { c.packages[0].type = 'iso'; }, /pinned Silver Edition ZIP/],
      ['changed fixture identity', c => { c.fixture = 'other-demo'; }, /isolated local fixture identity/],
      ['changed executable', c => { c.executables[0] = 'cd/BGDEMO.EXE'; }, /preserved CD executable/],
      ['changed data-track image', c => { c.postExtract[0].image = 'BG Demo.iso'; }],
      ['changed data-track type', c => { c.postExtract[0].type = 'extractIso'; }],
      ['changed data-track destination', c => { c.postExtract[0].into = 'other-cd'; }],
      ['changed cabinet', c => { c.postExtract[1].cab = 'cd/DATA2.CAB'; }],
      ['changed InstallShield group', c => { c.postExtract[1].group = 'MaximumData'; }],
      ['changed extraction destination', c => { c.postExtract[1].into = 'other-install'; }],
      ['changed preserved executable source', c => { c.postExtract[2].from = 'cd/OTHER.EXE'; }],
      ['changed preserved executable destination', c => { c.postExtract[2].into = 'installed-extracted/Other.exe'; }],
      ['reordered extraction', c => { [c.postExtract[0], c.postExtract[1]] = [c.postExtract[1], c.postExtract[0]]; }],
      ['local-only removed', c => { c.localOnly = false; }, /ignored local-only fixture/],
      ['companion tree narrowed', c => { c.cli.vfsInclude = ['*.exe']; }, /complete extracted companion-file tree/],
    ];
    for (const [name, mutate, diagnostic = /data-track, cabinet and executable identity/] of changes) {
      await check(`reject ${name} even when only THPS2 is selected`, async () => {
        const manifest = fixture();
        mutate(manifest.candidates.find(candidate => candidate.id === interactiveId));
        const result = await run(manifest, ['--id=thps2-demo', '--dry-run']);
        assert.strictEqual(result.code, 1, result.output);
        assert.match(result.output, /AssertionError/);
        assert.match(result.output, diagnostic);
        assert.doesNotMatch(result.output, /LOCAL   thps2-demo:/);
      });
    }
    console.log(`candidate corpus contract: ${passed} checks passed`);
  }

  main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
  });
}

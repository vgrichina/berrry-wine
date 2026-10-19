'use strict';
// Source/data inspection only: never instantiate WASM or start a guest.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = process.argv[2] || '/tmp/wa-recovery-20261014';
const shared = '/home/user/wine-assembly';
const rel = 'test/binaries/win98-games-a-d/DungeonSiege demo-D3D/extracted';
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedWasm = '7c1a12e8bc4b238e8caff2cc81adf85117dc630178cafc1f393a46ef60fc3b23';
const native = [
  ['mfc42.dll', 'dlls', 'ec63a85030c60716acdcf060abfaa95a6a3528631622fa60e7d17fbea2f751f9'],
  ['msvcrt.dll', 'dlls', '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1'],
  ['comctl32.dll', 'dlls', '28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'],
  ['ole32.dll', 'explorer98/dlls', 'bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d'],
];
(async () => {
  const blockers = [];
  const original = JSON.parse(fs.readFileSync(path.join(shared, rel, '.original-package.json')));
  assert.equal(original.files.length, 37);
  for (const f of original.files) {
    for (const base of [shared, root]) {
      const p = path.join(base, rel, f.path);
      assert.equal(hash(p), f.sha256, p);
      assert.equal(fs.statSync(p).size, f.bytes, p);
    }
  }
  const acceptancePath = path.join(shared, 'scratch/runs/20261019-dungeon-siege-authorized-acceptance-2');
  const acceptance = JSON.parse(fs.readFileSync(path.join(acceptancePath, 'acceptance.json')));
  assert.equal(acceptance.authorized, true);
  assert.equal(acceptance.acceptedInGuest, true);
  for (const item of [acceptance.before, acceptance.after, acceptance.terms]) {
    assert.equal(hash(path.join(acceptancePath, item.path)), item.sha256);
  }
  const fixtures = native.map(([name, dir, sha256]) => {
    const source = path.join(shared, 'test/binaries', dir, name);
    const target = path.join(root, 'test/binaries/dlls', name);
    assert.equal(hash(source), sha256, source);
    const ready = fs.existsSync(target) && hash(target) === sha256;
    if (!ready && name === 'ole32.dll') blockers.push('Missing or mismatched required native fixture: ' + target);
    return { name, source, target, sha256, bytes: fs.statSync(source).size, ready };
  });
  const { resolveDllGraph } = require(path.join(root, 'lib/process-boot'));
  const { detectRequiredDlls } = require(path.join(root, 'lib/dll-loader'));
  const exeDir = path.join(root, rel);
  const dirs = [path.join(exeDir, 'dlls'), exeDir, path.join(exeDir, '../Shared_DLLs'), path.join(exeDir, '../shared_dlls'), path.join(root, 'test/binaries/dlls')];
  const graph = await resolveDllGraph({
    exeBytes: fs.readFileSync(path.join(exeDir, 'DungeonSiegeDemo.exe')),
    seeds: ['BinkW32.dll', 'Mss32.dll'], detectRequiredDlls,
    onMissing: name => blockers.push('Missing real PE dependency: ' + name),
    loadSpec: name => {
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const found = fs.readdirSync(dir).find(n => n.toLowerCase() === name.toLowerCase());
        if (found) return { name, bytes: fs.readFileSync(path.join(dir, found)) };
      }
      return null;
    },
  });
  const wasmSha256 = hash(path.join(root, 'build/wine-assembly.wasm'));
  if (wasmSha256 !== expectedWasm) blockers.push('Module does not match validated candidate');
  const stat = fs.statfsSync(root), freeBytes = stat.bavail * stat.bsize;
  const admissionBytes = 2 * 1024 ** 3 + (128 + 64 + 512) * 1024 ** 2;
  if (freeBytes <= admissionBytes) blockers.push('Disk admission: free must exceed ' + admissionBytes);
  console.log(JSON.stringify({ at: new Date().toISOString(), root, sourceOnly: true,
    ready: blockers.length === 0, blockers, originalCount: 37,
    originalBytes: original.files.reduce((n, f) => n + f.bytes, 0),
    previousAcceptance: acceptance, fixtures,
    nativeGraph: graph.map(f => ({ name: f.name, bytes: f.bytes.length, sha256: crypto.createHash('sha256').update(f.bytes).digest('hex') })),
    wasmSha256, freeBytes, admissionBytes, hardFloorBytes: 2214592512,
  }, null, 2));
  process.exitCode = blockers.length ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });

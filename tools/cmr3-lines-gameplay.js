#!/usr/bin/env node
'use strict';
// One bounded original-game CLI run. Control is the existing loopback ctl API.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const checkout = '/home/user/cmr3-lines-gameplay';
const output = checkout + '/scratch/runs/20261015-cmr3-lines-gameplay';
const game = '/home/user/cmr3-fresh-recovery/assembly/game';
const native = '/home/user/cmr3-fresh-recovery/native-recovery/native';
const registration = '/home/user/cmr3-fresh-registration';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = args => cp.execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
const { inventory } = require(checkout + '/tools/cmr3-assemble-original');
const { verifyCommonDirectory } = require(checkout + '/tools/cmr3-register-native');
const expectedGame = require(checkout + '/docs/cmr3-original-inventory-20261015.json');
const expectedNative = require(checkout + '/docs/cmr3-historical-receipts-20261015.json').native;
const commit = '78a06540f49dec6a8061354b5b3baf08d27be55b';
const wasm = checkout + '/build/wine-assembly.wasm';
const registry = registration + '/09-MLANG.DLL.registry.json';
const profile = registration + '/registration/windows/wmsyspr9.prx';
function verify() {
  assert.equal(git(['rev-parse', 'HEAD']), commit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '');
  assert(fs.lstatSync(wasm).isFile());
  assert.equal(fs.statSync(wasm).size, 1803537);
  assert.equal(sha(wasm), '937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb');
  assert.equal(fs.statSync(registry).size, 182940);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(registry, 'utf8'))).length, 972);
  assert.equal(fs.statSync(profile).size, 316640);
  assert.equal(sha(registry), '7e59a8770cf1c8d180943539247f3bd3dd5990f3e2eb1be91971250d2e9c7a54');
  assert.equal(sha(profile), '95f1edbc3cb9aa70a374a61b43bd16818636b0190aa841504130bb718c39c2c7');
  assert.deepEqual(inventory(game), expectedGame);
  assert.equal(expectedGame.length, 302);
  assert.equal(expectedNative.length, 12);
  assert.deepEqual(inventory(native), [...expectedNative].sort((a,b) => a.path.localeCompare(b.path)));
  verifyCommonDirectory(checkout + '/test/binaries/dlls');
}
verify();
// The game may otherwise silently continue without any renderer/capture support.
const canvas = require(checkout + '/lib/canvas-compat').createCanvas(32, 32);
canvas.getContext('2d').fillRect(0, 0, 16, 16);
const proof = canvas.toBuffer('image/png');
assert.equal(require(checkout + '/node_modules/pngjs').PNG.sync.read(proof).width, 32);
assert.equal(typeof require(checkout + '/lib/renderer').Win98Renderer, 'function');
fs.mkdirSync(path.dirname(output), { recursive:true });
fs.mkdirSync(output);
fs.writeFileSync(output + '/renderer-preflight.png', proof);
const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const sources = git(['ls-files', '-z']).split('\0').filter(Boolean).map(p => ({ path:p, sha256:sha(path.join(checkout,p)) }));
save('sources-before.json', sources);
fs.copyFileSync(__filename, output + '/controller.js');
const identities = () => ({ at:new Date().toISOString(), commit,
  module:{bytes:fs.statSync(wasm).size, sha256:sha(wasm)},
  game:inventory(game), native:inventory(native),
  registry:{bytes:fs.statSync(registry).size, sha256:sha(registry), entries:972},
  profile:{bytes:fs.statSync(profile).size, sha256:sha(profile)} });
save('identities-before.json', identities());
const args = ['test/run.js', '--exe=' + game + '/Rally_3PC.exe', '--vfs-tree=' + game,
  '--vfs-tree=' + native, '--vfs-mount=' + profile + '=C:\\WINDOWS\\WMSysPr9.prx',
  '--dlls=' + [game + '/MathCPU.dll', native + '/msvcrt.dll', native + '/msdmo.dll', native + '/WMASF.DLL'].join(','),
  '--reg-import=' + registry, '--no-build', '--wasm=' + wasm, '--quiet-api', '--no-close', '--no-threads',
  '--d3d9-renderer=software', '--d3d9-programmable', '--batch-size=200000', '--max-batches=10000000',
  '--max-seconds=540', '--control=8137', '--png=' + output + '/final.png'];
save('launch.json', { startedAt:new Date().toISOString(), commit, moduleSha256:sha(wasm), args, cwd:checkout,
  node:process.version, platform:process.platform, arch:process.arch, outerMs:590000,
  renderer:'software D3D9 programmable', threads:'cooperative', audio:'unknown', logicalFps:null });
const fd = fs.openSync(output + '/output.log', 'wx');
const child = cp.spawn(process.execPath, args, { cwd:checkout, stdio:['ignore',fd,fd] });
save('child.json', { pid:child.pid });
const timer = setTimeout(() => child.kill('SIGKILL'), 590000);
child.once('exit', (code, signal) => {
  clearTimeout(timer); fs.closeSync(fd);
  save('terminal.json', { code, signal, finishedAt:new Date().toISOString() });
  try {
    verify();
    for (const row of sources) assert.equal(sha(path.join(checkout,row.path)), row.sha256, row.path);
    save('identities-after.json', identities());
    save('postflight.json', { at:new Date().toISOString(), identitiesUnchanged:true, childPid:child.pid,
      note:'Remote process inventory must additionally establish no surviving runtime.' });
  } catch(error) { save('postflight-failure.json', { error:error.stack }); process.exitCode=1; }
});

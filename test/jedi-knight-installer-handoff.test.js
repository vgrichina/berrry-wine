'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {plan, peIdentity, manifest} = require('../tools/jedi-knight-installer-handoff');
const crypto = require('node:crypto');
test('capture preserves original setup tree and bounded flags without running a guest', () => {
  const p = plan({root:'/repo', fixture:'/original', wasm:'/canonical.wasm', output:'/fresh'}, 'capture');
  for (const arg of ['--exe=/original/setup.exe', '--vfs-tree=/original', '--capture-launch=/fresh/capture', '--max-seconds=120', '--no-build']) assert(p.args.includes(arg));
  assert.equal(p.outerMs,150000);
});
test('replay preserves original quoted arguments/cwd and rejects changed receipt, bytes or non-PE child', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jedi-plan-'));
  try {
    fs.mkdirSync(path.join(dir, 'capture/windows/temp'), {recursive:true});
    fs.mkdirSync(path.join(dir, 'bootstrap'));
    const exe = path.join(dir, 'capture/windows/temp/_ins0432._mp');
    const b = Buffer.alloc(256); b.writeUInt16LE(0x5a4d); b.writeUInt32LE(64,60);
    b.writeUInt32LE(0x4550,64); b.writeUInt16LE(0x14c,68); b.writeUInt16LE(0x10b,88);
    fs.writeFileSync(exe,b);
    const receipt = {schemaVersion:1, guestExe:'c:\\windows\\temp\\_ins0432._mp', exe:'windows/temp/_ins0432._mp', args:'-f "C:\\Original Files\\setup.ins"  /x', directory:'C:\\Original Files'};
    const write = (file,data) => fs.writeFileSync(path.join(dir,file),JSON.stringify(data));
    write('capture/launch.json',receipt);
    write('bootstrap/terminal.json',{code:0}); write('bootstrap/postflight.json',{identitiesUnchanged:true}); write('bootstrap/registry.json',{});
    write('bootstrap/captured-child.json',{...receipt,identity:peIdentity(exe),captureManifest:manifest(path.join(dir,'capture')),registrySha256:crypto.createHash('sha256').update('{}').digest('hex')});
    const c = {root:'/repo',fixture:'/original',wasm:'/canonical.wasm',output:dir};
    const p = plan(c,'replay');
    assert(p.args.includes('--args='+receipt.args)); assert(p.args.includes('--cwd='+receipt.directory));
    assert(p.args.includes('--exe-guest-path='+receipt.guestExe));
    write('capture/launch.json',{...receipt,args:'changed'}); assert.throws(()=>plan(c,'replay'), /receipt changed/);
    write('capture/launch.json',{...receipt,exe:'../escape'}); assert.throws(()=>plan(c,'replay'));
    write('capture/launch.json',receipt);
    write('bootstrap/terminal.json',{code:1}); assert.throws(()=>plan(c,'replay')); write('bootstrap/terminal.json',{code:0});
    write('bootstrap/registry.json',{invented:true}); assert.throws(()=>plan(c,'replay'),/registry changed/); write('bootstrap/registry.json',{});
    b[200]=1; fs.writeFileSync(exe,b); assert.throws(()=>plan(c,'replay'),/tree or receipt changed/);
    b.writeUInt32LE(0x454e,64); fs.writeFileSync(exe,b); assert.throws(()=>peIdentity(exe),/not PE/);
    write('bootstrap/terminal.json',{code:1}); assert.throws(()=>plan(c,'replay'));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

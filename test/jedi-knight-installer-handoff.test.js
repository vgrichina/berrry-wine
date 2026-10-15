'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {plan, peIdentity, sealCapture} = require('../tools/jedi-knight-installer-handoff');
const {VirtualFS} = require('../lib/filesystem');
const {saveVfsToHost} = require('../lib/vfs-export');
test('capture preserves original setup tree and bounded flags without running a guest', () => {
  const p = plan({root:'/repo', fixture:'/original', wasm:'/canonical.wasm', output:'/fresh'}, 'capture');
  for (const arg of ['--exe=/original/setup.exe', '--vfs-tree=/original', '--capture-launch=/fresh/capture', '--max-seconds=120', '--no-build']) assert(p.args.includes(arg));
  assert.equal(p.outerMs,150000);
});
test('replay preserves original quoted arguments/cwd and rejects changed receipt, bytes or non-PE child', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jedi-plan-'));
  try {
    fs.mkdirSync(path.join(dir, 'bootstrap'));
    const b = Buffer.alloc(256); b.writeUInt16LE(0x5a4d); b.writeUInt32LE(64,60);
    b.writeUInt32LE(0x4550,64); b.writeUInt16LE(0x14c,68); b.writeUInt16LE(0x10b,88);
    const vfs = new VirtualFS();
    const guestExe = vfs._resolvePath('C:/WINDOWS/TEMP/_INS0432._MP');
    vfs.files.set(guestExe, {data:b, attrs:0x20});
    vfs.dirs.add(vfs._resolvePath('C:/Original Files'));
    assert(vfs.setCurrentDirectory('C:/Original Files'));
    const rows = saveVfsToHost({files:new Map(vfs.files), dirs:new Set(vfs.dirs)}, path.join(dir,'capture'));
    const exe = rows.find(row => row.guestPath === guestExe).outputPath;
    // Same metadata producers as run.js: VFS resolution, cwd and export row.
    const receipt = {schemaVersion:1, guestExe, exe:path.relative(path.join(dir,'capture'),exe).split(path.sep).join('/'), args:'-f "C:\\Original Files\\setup.ins"  /x', directory:vfs.getCurrentDirectory()};
    assert.equal([...receipt.guestExe].filter(c=>c.charCodeAt(0)===92).length,3);
    assert.equal([...receipt.directory].filter(c=>c.charCodeAt(0)===92).length,1);
    const write = (file,data) => fs.writeFileSync(path.join(dir,file),JSON.stringify(data));
    write('capture/launch.json',receipt);
    write('bootstrap/terminal.json',{code:0}); write('bootstrap/postflight.json',{identitiesUnchanged:true}); write('bootstrap/registry.json',{});
    const c = {root:'/repo',fixture:'/original',wasm:'/canonical.wasm',output:dir};
    const save = (file,data)=>write('bootstrap/'+file,data);
    sealCapture(c,save);
    const p = plan(c,'replay');
    assert(p.args.includes('--args='+receipt.args)); assert(p.args.includes('--cwd='+receipt.directory));
    assert(p.args.includes('--exe-guest-path='+receipt.guestExe));
    write('capture/launch.json',{...receipt,args:'changed'}); assert.throws(()=>plan(c,'replay'), /receipt changed/);
    write('capture/launch.json',{...receipt,exe:'../escape'}); assert.throws(()=>plan(c,'replay'));
    assert.throws(()=>sealCapture(c,save), /unexpected captured path/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'bootstrap/capture-failure.json'))).receipt.exe,'../escape');
    write('capture/launch.json',{...receipt,exe:'/outside/image.exe'});
    assert.throws(()=>sealCapture(c,save), /unexpected captured path/);
    write('capture/launch.json',receipt);
    write('bootstrap/terminal.json',{code:1}); assert.throws(()=>plan(c,'replay')); write('bootstrap/terminal.json',{code:0});
    write('bootstrap/registry.json',{invented:true}); assert.throws(()=>plan(c,'replay'),/registry changed/); write('bootstrap/registry.json',{});
    b[200]=1; fs.writeFileSync(exe,b); assert.throws(()=>plan(c,'replay'),/tree or receipt changed/);
    b.writeUInt32LE(0x454e,64); fs.writeFileSync(exe,b); assert.throws(()=>peIdentity(exe),/not PE/);
    write('bootstrap/terminal.json',{code:1}); assert.throws(()=>plan(c,'replay'));
    fs.unlinkSync(exe);
    fs.symlinkSync(path.join(dir,'missing-outside-image'),exe);
    assert.throws(()=>sealCapture(c,save),/capture contains symlink/);
    const failure = JSON.parse(fs.readFileSync(path.join(dir,'bootstrap/capture-failure.json')));
    assert.equal(failure.receipt.guestExe,guestExe);
    assert.match(failure.error,/capture contains symlink/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

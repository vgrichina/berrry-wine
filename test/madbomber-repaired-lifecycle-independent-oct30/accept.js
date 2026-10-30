#!/usr/bin/env node
'use strict';
// Run under the task supervisor with Node --max-old-space-size=192.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
assert.equal(process.cwd(), root);
assert(!process.env.MIDI_MUTATION && !process.env.MIDI_BASELINE_HOST && !process.env.MIDI_TEST_ROOT);
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const pins = JSON.parse(fs.readFileSync(path.join(__dirname,'pins.json'),'utf8'));
for (const [file,pin] of Object.entries(pins)) {
  const bytes=fs.readFileSync(path.join(root,file));
  assert.equal(bytes.length,pin.bytes,file+' byte count');
  assert.equal(sha(bytes),pin.sha256,file+' SHA256');
}
const fixture = read('test/test-midi-stream-lifecycle.js');
assert.equal(sha(fixture),'9f0cbf649709fb12589dba2e310e07e58138dd05b8e69ad2f75f31067f37a1e9');
const marker = "test('production callback ownership rejects invalid admission";
assert.equal(fixture.split(marker).length,2);
const prefix = fixture.slice(0,fixture.indexOf(marker)).replace(/^#![^\n]*\n/, '');
const request = Module.createRequire(path.join(root,'test/test-midi-stream-lifecycle.js'));
function load(overrides={}, text=prefix) {
  const module = {exports:{}};
  const controlledFS = {...fs, readFileSync(file,...args) {
    const key = path.relative(root,String(file));
    return Object.hasOwn(overrides,key) ? overrides[key] : fs.readFileSync(file,...args);
  }};
  new Function('require','module','__filename','__dirname',text+
    '\nmodule.exports={setup,fn,bodies,typedGlobals,wasmSource,moduleUnderTest,compiled};')(
      n=>n==='fs'?controlledFS:request(n), module,
      path.join(root,'test/test-midi-stream-lifecycle.js'),path.join(root,'test'));
  return module.exports;
}
// Independent top-level lexical scanner, including block comments and strings.
function functionForm(source,name) {
  const forms=[]; let start=-1, depth=0, block=0, string=false;
  for(let i=0;i<source.length;i++) {
    const c=source[i], next=source[i+1];
    if(block) {if(c==='('&&next===';'){block++;i++;}else if(c===';'&&next===')'){block--;i++;}continue;}
    if(string){if(c==='\\'){i++;}else if(c==='"')string=false;continue;}
    if(c===';'&&next===';'){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(c==='('&&next===';'){block++;i++;continue;}
    if(c==='"'){string=true;continue;}
    if(c==='('){if(depth===0)start=i;depth++;}
    if(c===')'&&--depth===0)forms.push(source.slice(start,i+1));
  }
  const found=forms.filter(f=>new RegExp('^\\(func \\$'+name+'(?=[\\s)])').test(f));
  assert.equal(found.length,1,'independent unique definition '+name);
  return found[0].replace(/;;[^\n]*/g,'');
}
const results=[];
function check(name,fn){fn();results.push(name);console.log('PASS '+name);}
const f=load();
check('byte-exact source extraction and only declared ownership relocation',()=>{
  const groups={
    'src/09a-handlers.wat':['mm_callback_begin','mm_callback_frame_at','mm_callback_frame','mm_callback_check','mm_callback_finish'],
    'src/04-cache.wat':['invocation_new_id','invocation_install','invocation_process_begin','invocation_validate','invocation_current','invocation_enter','invocation_leave']
  };
  for(const [file,names] of Object.entries(groups))for(const name of names){
    const original=functionForm(read(file),name);
    assert.equal(f.fn(file,name),original);
    const expected=file==='src/04-cache.wat'?original.replace(/\(region.addr \$CALLBACK_OWNERSHIP (\d+)\)/g,(_,n)=>'(i32.const '+(16384+Number(n))+')'):original;
    assert(f.bodies.includes(expected),name+' compiled exact body');
  }
  for(const g of ['invocation_epoch','invocation_root','mm_callback_owner'])
    assert.match(f.typedGlobals.get(g),/\(mut i64\) \(i64.const 0\)/);
  assert(!f.wasmSource.includes('(region.addr $CALLBACK_OWNERSHIP'));
  assert.equal(16384+16+16*528,24848);
  assert(24848<=32768 && 32768+16*2048<=65536);
});
check('canonical module identity and initializer private storage writes',()=>{
  assert.equal(sha(f.compiled.wasmBinary),'a6576cf8ad57624a27757874c0bfeead0e7c41978a4c2210259043f67eb3e0ec');
  const s=f.setup();
  assert.equal(s.dv.getBigUint64(16384,true),2n);
  assert.equal(s.dv.getBigUint64(16392,true),s.e.invocation_epoch.value);
  assert.equal(s.e.invocation_slot.value,16400);
  assert.equal(s.dv.getBigUint64(16400,true),s.e.invocation_root.value);
  assert.equal(s.dv.getBigUint64(16416,true),s.e.invocation_root.value);
  assert.equal(s.e.invocation_tid.value,1);
  const rootBefore=s.e.currentInvocation();s.e.beginProcess();
  assert(s.e.currentInvocation()>rootBefore,'real initializer allocates fresh identities');
});
check('stale shared epoch traps before callback memory mutation',()=>{
  const s=f.setup();s.dv.setBigUint64(16392,s.e.invocation_epoch.value+1n,true);
  const before=Buffer.from(s.dv.buffer);
  assert.throws(()=>s.e.fire_midi_out_callback_bound(77,1024,0x12345,9,0x3c9),WebAssembly.RuntimeError);
  assert.deepEqual(Buffer.from(s.dv.buffer),before);
  assert.equal(s.e.invocation_depth.value,0);
});
check('missing exact function rejects despite a similarly named definition',()=>{
  const file='src/04-cache.wat';
  const changed=read(file).replace('(func $invocation_leave ','(func $invocation_leave_decoy ');
  assert.notEqual(changed,read(file));
  assert.throws(()=>load({[file]:changed}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('exact function invocation_leave'));
});
check('missing typed i64 declaration fails before compilation',()=>{
  const file='src/09a-handlers.wat';
  const changed=read(file).replace('(global $mm_callback_owner ','(global $mm_callback_owner_decoy ');
  assert.throws(()=>load({[file]:changed}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('(global $mm_callback_owner '));
});
check('fixture initializer omission traps during setup before callback tests',()=>{
  assert.equal(prefix.split('  e.beginProcess();').length,2);
  const corrupt=load({},prefix.replace('  e.beginProcess();','  /* deliberately omitted initializer */'));
  assert.throws(()=>corrupt.setup(),WebAssembly.RuntimeError);
});
check('source-derived callback return control reaches intended behavior assertion',()=>{
  const file='src/04-cache.wat', source=read(file);
  const original=functionForm(source,'invocation_leave');
  const site='(global.set $invocation_depth (i32.sub (global.get $invocation_depth) (i32.const 1)))';
  assert.equal(original.split(site).length,2,'unique source-derived mutation');
  const changed=original.replace(site,'(global.set $invocation_depth (global.get $invocation_depth))');
  // Replace comment-stripped original by locating its production form boundaries.
  const at=source.indexOf('(func $invocation_leave');
  const after=source.indexOf('\n  (func ',at+1);
  const mutated=source.slice(0,at)+changed+source.slice(after);
  const negative=load({[file]:mutated}); // successful compile/instantiate required
  const s=negative.setup();s.open();
  assert.throws(()=>s.pump(),e=>e.code==='ERR_ASSERTION'&&
    e.message.includes('production callback return releases child'));
});
console.log(JSON.stringify({status:'PASS',controls:results.length,results,qualification:'isolated WAT/import fixture acceptance only'}));

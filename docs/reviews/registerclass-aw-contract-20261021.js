'use strict';
// Execute exact source slices, not a full emulator. Usage: node FILE REPO [mutation]
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto');
const repo = path.resolve(process.argv[2] || '.');
const mutation = process.argv[3] || '';
const {compile} = require(path.join(repo, 'tools/watx.js'));
const seals = {}, results = [];
function read(p) {
  const s = fs.readFileSync(path.join(repo,p),'utf8');
  seals[p] = crypto.createHash('sha256').update(s).digest('hex'); return s;
}
function fn(text,name) {
  const start = text.indexOf('(func $'+name+' '); assert(start >= 0,name);
  let depth = 0;
  for(let i=start;i<text.length;i++) {
    if(text.slice(i,i+2)===';;') { i=text.indexOf('\n',i); continue; }
    if(text[i]==='(') depth++;
    if(text[i]===')' && --depth===0) return text.slice(start,i+1);
  }
  throw Error(name);
}
const table=read('src/09c0-window-table.wat');
const ansi=read('src/09a-handlers2-runtime.wat'), wide=read('src/09a5c-handlers-wide.wat');
const helpers=['class_name_key','class_wide_name_key','builtin_class_atom','class_name_hash',
  'class_record_addr','class_table_register_data','class_table_register_encoded',
  'class_name_is_wide','class_find_slot','class_table_lookup','class_publication_name'];
const handlers=['RegisterClassA','RegisterClassExA','RegisterClassW','RegisterClassExW'];
const expose=(s,n)=>s.replace('(func $'+n, '(func $'+n+' (export "'+n+'")');
let body=helpers.map(n=>expose(fn(table,n),n)).join('\n')+'\n'+handlers.map(n=>
  expose(fn(n.endsWith('W')?wide:ansi,'handle_'+n),'handle_'+n)).join('\n');
const changes={
  'wide-flag': ['(local.get $wide))','(i32.const 0))'],
  'ansi-flag': ['(local.get $wide))','(i32.const 1))'],
  'wide-key': ['(call $class_wide_name_key (call $gl32','(call $g2w (call $gl32'],
  'copy-size': ['(i32.const 40)))','(i32.const 36)))'],
  'atom-collapse': ['(return (local.get $atom))','(return (i32.const 49153))'],
  'ex-offset': ['(call $g2w (i32.add (local.get $arg0) (i32.const 4)))','(call $g2w (local.get $arg0))'],
};
if(mutation) { assert(changes[mutation],'known mutation'); const [a,b]=changes[mutation]; assert(body.includes(a)); body=body.split(a).join(b); }
const signatures={g2w:[1,1],gl32:[1,1],memcpy:[3,0],zero_memory:[2,0],lock_wnd_acquire:[0,0],lock_wnd_release:[0,0]};
const wat=`(import "h" "memory" (memory 4 4 shared))
  ${Object.entries(signatures).map(([n,[p,r]])=>`(import "h" "${n}" (func $${n} ${p?'(param '+Array(p).fill('i32').join(' ')+')':''} ${r?'(result i32)':''}))`).join('\n')}
  (region.declare-fixed $CLASS_NAME_WIDE (base 8192) (size 64) (align 16))
  (global $CLASS_RECORDS i32 (i32.const 4096))
  (global $MAX_CLASSES i32 (i32.const 64))
  (global $CLASS_ATOM_BASE i32 (i32.const 49152))
  (global $SHARED_COUNTERS i32 (i32.const 9000))
  (global $TEXT_SCRATCH i32 (i32.const 65536))
  (global $reg_base i32 (i32.const 10000))
  (global $image_base i32 (i32.const 4194304))
  (global $exe_size_of_image i32 (i32.const 65536))
  ${['wndproc_addr','wndproc_addr2','wndclass_style','wndclass_bg_brush'].map(n=>`(global $${n} (mut i32) (i32.const 0)) (export "${n}" (global $${n}))`).join('\n')}
  ${body}`;
const compiled=compile(wat,new Map(),{standardWat:true,runtimeBuiltins:false});
assert(compiled.success,JSON.stringify(compiled.diagnostics));
const moduleBytes=compiled.wasmBinary, moduleObject=new WebAssembly.Module(moduleBytes);
function fixture() {
  const memory=new WebAssembly.Memory({initial:4,maximum:4,shared:true});
  const bytes=new Uint8Array(memory.buffer), d=new DataView(memory.buffer);
  let locked=false, acquisitions=0, cursor=131072;
  // Non-identity translation catches accidental guest/WASM pointer interchange.
  const g2w=p=>p<65536?240:p-0x400000+131072;
  const h={memory,g2w,gl32:p=>d.getUint32(g2w(p),true),
    lock_wnd_acquire(){assert(!locked);locked=true;acquisitions++;},
    lock_wnd_release(){assert(locked);locked=false;},
    memcpy(dst,src,n){assert(locked,'copy under writer lock');assert.equal(d.getUint32(dst-8,true),0,'hash hidden during copy');bytes.copyWithin(dst,src,src+n);},
    zero_memory(dst,n){assert(locked);bytes.fill(0,dst,dst+n);}};
  const e=new WebAssembly.Instance(moduleObject,{h}).exports;
  const allocate=n=>{const p=cursor;cursor+=(n+15)&~15;return p;};
  const guest=p=>p-131072+0x400000;
  function name(s,w){const p=allocate((s.length+1)*(w?2:1));for(let i=0;i<s.length;i++) w?d.setUint16(p+2*i,s.charCodeAt(i),true):bytes[p+i]=s.charCodeAt(i);return guest(p);}
  function register(api,text,proc=0x401234) {
    const w=api.endsWith('W'), ex=api.includes('Ex'), p=allocate(64), n=name(text,w), wc=p+(ex?4:0);
    const fields=[0x123,proc,4,8,0x400000,0x31,0x32,0x33,0x400800,n];
    fields.forEach((v,i)=>d.setUint32(wc+i*4,v,true));
    if(ex){d.setUint32(p,48,true);d.setUint32(p+44,0x99,true);}
    const before=bytes.slice(wc,wc+40), locks=acquisitions;
    d.setUint32(10016,0x74ff000,true);
    e['handle_'+api](guest(p),0,0,0,0,0);
    assert.equal(d.getUint32(10016,true),0x74ff008,'stdcall cleanup');
    assert.equal(acquisitions,locks+1,'one writer transaction');assert(!locked,'lock released');
    const atom=d.getUint32(10000,true), slot=e.class_find_slot(atom);
    if(atom) {
      assert(slot>=0,'returned atom resolves');
      assert.deepEqual(bytes.slice(4096+slot*48+8,4096+slot*48+48),before,'all ten WNDCLASS fields retained');
      assert.equal(e.class_name_is_wide(slot),+w,'registration owns encoding');
      assert.equal(e.class_table_lookup(atom),proc,'atom selects procedure');
      const query=name(text,!w), key=w?e.class_name_key(query):e.class_wide_name_key(query);
      assert.equal(e.class_find_slot(key),slot,'opposite encoding name lookup');
      const pub=e.class_publication_name(atom);let s='';for(let i=pub;bytes[i];i++) s+=String.fromCharCode(bytes[i]);
      assert.equal(s,text,'publication decodes retained registration name');
    }
    assert.deepEqual(bytes.slice(wc,wc+40),before,'caller WNDCLASS untouched');
    return {atom,slot,n};
  }
  return {e,register,bytes,d};
}
for(const api of handlers) {
  const f=fixture(), a=f.register(api,'MixedCase'), b=f.register(api,'Second',0x405678);
  assert.notEqual(a.atom,b.atom,'distinct classes have distinct atoms');
  assert.equal(f.e.wndproc_addr.value,0x401234);assert.equal(f.e.wndproc_addr2.value,0x405678);
  assert.equal(f.e.wndclass_style.value,0x123);assert.equal(f.e.wndclass_bg_brush.value,0x33);
  f.register(api,'DLL',0x600000);assert.equal(f.e.wndproc_addr.value,0x401234);
  results.push(api+': fields/encoding/name+atom lookup/publication/ESP/primary+secondary');
  const empty=fixture();empty.register(api,'DLLFirst',0x600000);assert.equal(empty.e.wndproc_addr.value,0);
  empty.register(api,'EXESecond');assert.equal(empty.e.wndproc_addr.value,0x401234);
  results.push(api+': DLL-first exclusion');
  // All registration spellings can replace a class; the atom is stable and
  // the new spelling owns the encoding, including wide->ANSI->wide changes.
  for(const replacement of handlers) {
    const r=f.register(replacement,'MixedCase',0x403456);assert.equal(r.atom,a.atom);assert.equal(r.slot,a.slot);
    assert.equal(f.e.class_table_lookup(b.atom),0x405678,'other slot unchanged');
    results.push(api+' -> '+replacement+': replacement');
  }
  const full=fixture();for(let i=0;i<64;i++) assert(full.register(api,'Class'+i).atom);
  const before=full.bytes.slice(4096,8256);assert.equal(full.register(api,'Overflow').atom,0);
  assert.deepEqual(full.bytes.slice(4096,8256),before,'full table leaves records and encoding unchanged');
  results.push(api+': full table and lock release');
}
console.log(JSON.stringify({status:'PASS_SOURCE_SLICES',mutation,groups:results.length,results,seals,
  module:{bytes:moduleBytes.length,sha256:crypto.createHash('sha256').update(moduleBytes).digest('hex')},
  limits:'Real four handlers and class registration/lookup/publication helpers. Mock guest translation/copy and instrumented single-thread writer lock. No full VM, actual contention, PE, browser or gameplay.'},null,2));

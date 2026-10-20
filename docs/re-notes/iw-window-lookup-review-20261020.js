'use strict';
// Run from an object-complete repository: node this-file.js [repository] [output.json]
// No full VM, guest executable, browser, worker or external runtime is started.
const fs = require('fs'), cp = require('child_process'), vm = require('vm');
const assert = require('assert/strict'), crypto = require('crypto');
const repo = process.argv[2] || process.cwd();
const MAIN = 'a54049d11955307d06309e146e85c1aca3196657';
const PREP = '9ef79f697f5145a11e719f11f2f304c3757e7847';
const CONNECT = '692c9c43cde04b584fcae5ec247937512d3b53c6';
const TEST = 'c27e6776b73b68b10660416e736d8ab7ad5264d9';
const git = args => cp.execFileSync('git', args, {cwd:repo, encoding:'utf8', maxBuffer:8*1024**2}).trimEnd();
const read = (rev, path) => git(['show', `${rev}:${path}`]);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const results = [], binaries = [];
function eq(label, actual, expected) {
  assert.equal(actual, expected, label);
  results.push({label, actual, expected});
}
function rejected(label, f) {
  assert.throws(f, assert.AssertionError);
  results.push({label, rejected:true});
}
// Read the admitted compiler directly from Git; no compiler/source materialization.
const compiler = vm.createContext({console:{log(){},warn(){},error(){}},
  TextEncoder, TextDecoder, Float32Array, Float64Array, Uint8Array, ArrayBuffer,
  Map, Set, RegExp, Array, Object, String, Number, Math, Promise, Date,
  setTimeout, clearTimeout, setImmediate, parseInt, parseFloat, isNaN});
for (const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])
  vm.runInContext(read(MAIN, 'tools/watx-src/'+f), compiler, {filename:f});
function func(text, name) {
  const start = text.indexOf('(func $'+name+' ');
  assert(start >= 0, name);
  let depth=0, quoted=false, escaped=false;
  for (let i=start;i<text.length;i++) {
    const c=text[i];
    if (!quoted && c===';' && text[i+1]===';') {i=text.indexOf('\n',i);continue;}
    if (c==='"' && !escaped) quoted=!quoted;
    if (!quoted) {
      if(c==='(')depth++;
      if(c===')' && --depth===0)return text.slice(start,i+1);
    }
    escaped=c==='\\' && !escaped;
  }
  throw Error('Unterminated '+name);
}
const userPath='src/09a-handlers1-user.wat', hostPath='lib/host-window.js';
const source=read(MAIN,userPath), retained=read(CONNECT,userPath);
const names=['find_window_matches','find_window_z_first','find_window_z_next',
  'find_window_core','handle_FindWindowA','handle_FindWindowExA'];
const mappings = {};
const ancestry=Object.fromEntries([PREP,CONNECT,TEST].map(r=>{
  const result=cp.spawnSync('git',['merge-base','--is-ancestor',r,MAIN],{cwd:repo});
  assert([0,1].includes(result.status));
  return [r,result.status===0];
}));
for (const p of [hostPath,userPath,'src/01-header.wat','lib/host-import-sigs.generated.json',
    'test/test-find-window.js','test/test-host-window-related.js']) {
  mappings[p]=Object.fromEntries([MAIN,PREP,CONNECT,TEST].map(r=>[r,git(['rev-parse',r+':'+p])]));
}
eq('main has no desktop host query', /find_window:/.test(read(MAIN,hostPath)), false);
eq('main has no desktop import', /"find_window"/.test(read(MAIN,'src/01-header.wat')), false);
eq('main has no RPC signature', /"find_window"/.test(read(MAIN,'lib/host-import-sigs.generated.json')), false);
eq('main local core has no desktop call', /host_find_window/.test(func(source,'find_window_core')), false);
eq('main regression lacks foreign-instance test', /test_find_publish|rpcLookup/.test(read(MAIN,'test/test-find-window.js')), false);
eq('retained test contains independent-instance and RPC cases', /test_find_publish/.test(read(TEST,'test/test-find-window.js')) && /rpcLookup/.test(read(TEST,'test/test-find-window.js')), true);
const common=names.filter(n=>n!=='find_window_core').map(n=>func(source,n));
for (const n of names.filter(n=>n!=='find_window_core'))
  eq('unchanged extracted function '+n,func(source,n),func(retained,n));
function makeHost(rev, renderer, memory, mutate) {
  const context={module:{exports:{}},process:{env:{}},console};
  let text=read(rev,hostPath);
  if(mutate==='class')text=text.replace("if (className !== null && String(w.className || '').toLowerCase() !== className) continue;","");
  if(mutate==='title')text=text.replace("if (title !== null && _windowTextOf(w.hwnd).toLowerCase() !== title) continue;","");
  vm.runInNewContext(text,context);
  const u8=new Uint8Array(memory.buffer), dv=new DataView(memory.buffer);
  const str=(p,wide=false)=>{let s='';for(let n=0;n<4096;n++){const c=wide?dv.getUint16(p,true):u8[p];if(!c)return s;s+=String.fromCharCode(c);p+=wide?2:1;}throw Error('unterminated');};
  const ctx={renderer};
  return {host:context.module.exports.createWindowHost(ctx,{readStr:p=>str(p),readStrW:p=>str(p,true)}).imports,ctx,str};
}
function fixture(version='main',mutation) {
  const memory=new WebAssembly.Memory({initial:4}), dv=new DataView(memory.buffer);
  const renderer={windows:{},scheduleRepaint(){}};
  const h=makeHost(version==='main'?MAIN:CONNECT,renderer,memory,mutation), table=[], classes=new Map();
  let next=65536;
  const put=(s,wide=false)=>{const p=next;next+=(s.length+1)*(wide?2:1)+8;for(let i=0;i<s.length;i++)wide?dv.setUint16(p+2*i,s.charCodeAt(i),true):dv.setUint8(p+i,s.charCodeAt(i));return p;};
  const row=hwnd=>table.find(w=>w.hwnd===hwnd);
  const key=(p,wide=false)=>p<65536?p:(classes.get(h.str(p,wide).toLowerCase())??-2);
  const host={
    g2w:p=>p, class_name_key:p=>key(p), class_wide_name_key:p=>key(p,true),
    class_find_slot:k=>[...classes.values()].includes(k)?k:-1,
    class_record_addr:k=>4096+k*64,
    wnd_get_class_slot:w=>row(w)?.slot??-1,
    title_table_get_ptr:w=>row(w)?.titlePtr??0,
    wide_ascii_eq:(a,b)=>+(h.str(a,true).toLowerCase()===h.str(b).toLowerCase()),
    guest_ansi_eq_wasm_ci:(a,b)=>+(h.str(a).toLowerCase()===h.str(b).toLowerCase()),
    wnd_slot_hwnd:i=>table[i]?.hwnd??0,
    wnd_get_parent:w=>row(w)?.parent??0,
    wnd_z_get:w=>row(w)?.z??0,
    wnd_table_find:w=>table.findIndex(t=>t.hwnd===w),
    host_find_window:(...args)=>h.host.find_window(...args),
  };
  const arities={g2w:1,class_name_key:1,class_wide_name_key:1,class_find_slot:1,class_record_addr:1,
    wnd_get_class_slot:1,title_table_get_ptr:1,wide_ascii_eq:2,guest_ansi_eq_wasm_ci:2,
    wnd_slot_hwnd:1,wnd_get_parent:1,wnd_z_get:1,wnd_table_find:1,host_find_window:5};
  let core=func(version==='main'?source:retained,'find_window_core');
  if(mutation==='matches')core=core.replace(/\(call \$find_window_matches[\s\S]*?\(local.get \$wide\)\)/,'(i32.const 1)');
  if(mutation==='after')core=core.replace('(if (local.get $after)','(if (i32.const 0)');
  const wat=`
    (import "h" "memory" (memory 4))
    ${Object.entries(arities).map(([n,c])=>`(import "h" "${n}" (func $${n} (param ${Array(c).fill('i32').join(' ')}) (result i32)))`).join('\n')}
    (global $reg_base i32 (i32.const 0))
    (global $MAX_WINDOWS i32 (i32.const 32))
    ${common.join('\n').replace('(func $handle_FindWindowA ', '(func $handle_FindWindowA (export "a") ').replace('(func $handle_FindWindowExA ', '(func $handle_FindWindowExA (export "ex") ')} ${core}
    ${func(read(MAIN,'src/09a5b-handlers-window-late.wat'),'handle_FindWindowW').replace('(func $handle_FindWindowW ', '(func $handle_FindWindowW (export "w") ')}
    `;
  const built=compiler.compile(wat,new Map(),{standardWat:true,runtimeBuiltins:false});
  assert(built.success,JSON.stringify(built.diagnostics));
  const bytes=built.wasmBinary;
  assert(bytes,'compiler output wasm');
  binaries.push({version,mutation:mutation||null,sha256:hash(bytes),bytes:bytes.length});
  const instance=new WebAssembly.Instance(new WebAssembly.Module(bytes),{h:{...host,memory}});
  function call(api,...args){dv.setInt32(16,8192,true);instance.exports[api](...args.concat(Array(6-args.length).fill(0)));return dv.getUint32(0,true);}
  function add(hwnd,name,title,parent=0,z=1,publish=true) {
    if(!classes.has(name.toLowerCase()))classes.set(name.toLowerCase(),classes.size+1);
    const slot=classes.get(name.toLowerCase()), namePtr=put(name),titlePtr=put(title);
    dv.setUint32(4096+slot*64+44,namePtr,true);
    table.push({hwnd,parent,z,slot,titlePtr});
    if(publish)renderer.windows[hwnd]={hwnd,className:name,title,isChild:!!parent,parentHwnd:parent,zOrder:z};
    return slot;
  }
  function remove(hwnd) {const i=table.findIndex(w=>w.hwnd===hwnd);if(i>=0)table.splice(i,1);h.host.destroy_window(hwnd);}
  return {memory,dv,renderer,h,table,put,call,add,remove};
}
for(const version of ['main','retained']) {
  const f=fixture(version), {put,call}=f;
  const atom=f.add(101,'Local','First',0,10);
  f.add(102,'Local','Second',0,20);f.add(103,'Other','First',0,30);
  f.add(201,'Pane','Child',101,40);f.add(202,'Pane','Deep',201,50);
  for(const [api,wide]of [['a',false],['w',true]]) {
    const text=s=>put(s,wide);
    eq(version+' '+api+' both local filters',call(api,text('lOcAl'),text('fIrSt')),101);
    eq(version+' '+api+' class only',call(api,text('Local'),0),102);
    eq(version+' '+api+' title only',call(api,0,text('First')),103);
    eq(version+' '+api+' unknown class',call(api,text('Missing'),0),0);
    eq(version+' '+api+' unknown title',call(api,0,text('Missing')),0);
    eq(version+' '+api+' crossed filters',call(api,text('Other'),text('Second')),0);
    eq(version+' '+api+' class atom',call(api,atom,text('First')),101);
    eq(version+' '+api+' excludes child',call(api,text('Pane'),0),0);
    eq(version+' '+api+' stdcall stack',f.dv.getUint32(16,true),8204);
  }
  eq(version+' direct child',call('ex',101,0,put('Pane'),put('Child')),201);
  eq(version+' excludes descendant',call('ex',101,0,put('Pane'),put('Deep')),0);
  eq(version+' next matching sibling',call('ex',0,102,put('Local'),0),101);
  eq(version+' stale after',call('ex',0,999,0,0),0);
  eq(version+' wrong-parent after',call('ex',101,102,0,0),0);
  eq(version+' Ex stdcall stack',f.dv.getUint32(16,true),8212);
  f.remove(101);
  eq(version+' destroyed local matching filters',call('a',put('Local'),put('First')),0);
  eq(version+' destroyed local after',call('ex',0,101,0,0),0);
  f.renderer.windows[701]={hwnd:701,className:'Foreign',title:'Remote',isChild:false,zOrder:100};
  f.renderer.windows[702]={hwnd:702,className:'Button',title:'Go',isChild:true,parentHwnd:701,zOrder:101};
  for(const [api,wide]of [['a',false],['w',true]]) {
    eq(version+' '+api+' foreign filters',call(api,put('foreign',wide),put('REMOTE',wide)),version==='main'?0:701);
    eq(version+' '+api+' foreign wrong class',call(api,put('wrong',wide),put('Remote',wide)),0);
    eq(version+' '+api+' foreign wrong title',call(api,put('Foreign',wide),put('wrong',wide)),0);
  }
  eq(version+' foreign child atom',call('ex',701,0,0x80,0),version==='main'?0:702);
  f.h.host.destroy_window(701);
  eq(version+' destroyed foreign',call('a',put('Foreign'),put('Remote')),0);
  eq(version+' destroyed foreign child',call('ex',701,0,0,0),0);
  if(version==='main') {
    f.renderer.windows[703]={hwnd:703,className:'Foreign',title:'Live',zOrder:200};
    rejected('current-main rejects foreign acceptance oracle',()=>assert.equal(call('a',put('Foreign'),put('Live')),703));
  }
}
// Controlled table/desktop disagreement reveals retained fallback ambiguity.
const stale=fixture('retained');
stale.add(501,'Stale','Gone');
stale.h.host.destroy_window(501); // owner table intentionally not cleaned
eq('retained host confirms absence',stale.h.host.find_window(0,0,stale.put('Stale'),0,0),0);
eq('retained API resurrects stale local row after host miss',stale.call('a',stale.put('Stale'),0),501);
rejected('retained stale absence acceptance oracle rejects',()=>assert.equal(stale.call('a',stale.put('Stale'),0),0));
stale.table.length=0;
eq('coherent local cleanup removes stale result',stale.call('a',stale.put('Stale'),0),0);
// Independent caller memories share the actual host query and renderer dictionary.
const a=fixture('retained'), b=fixture('retained');
b.renderer.windows=a.renderer.windows;
b.add(801,'Local','Other memory',0,200);
a.add(802,'Local','Caller memory',0,100);
eq('distinct memory buffers',a.memory.buffer===b.memory.buffer,false);
eq('foreign registered atom name with wide title',a.call('w',1,a.put('Other memory',true)),801);
b.remove(801);
eq('owner host destruction visible in caller',a.call('a',a.put('Local'),a.put('Other memory')),0);
// No desktop is the intended local-table fallback.
const noDesktop=fixture('retained');noDesktop.add(901,'Solo','Only');
noDesktop.h.ctx.renderer=null;
eq('host absent sentinel',noDesktop.h.host.find_window(0,0,0,0,0),-1);
eq('API local fallback without desktop',noDesktop.call('a',noDesktop.put('Solo'),0),901);
const empty=fixture('retained');
eq('empty desktop returns zero',empty.call('a',0,0),0);
empty.add(911,'Blank','');
eq('empty title is a filter',empty.call('a',0,empty.put('')),911);
eq('nonempty title does not match empty',empty.call('a',0,empty.put('x')),0);
eq('desktop alias child search',empty.call('ex',0x10000,0,empty.put('Blank'),0),911);
const prep=makeHost(PREP,empty.renderer,empty.memory);
eq('preparation host ANSI class and title',prep.host.find_window(0,0,empty.put('blank'),empty.put(''),0),911);
eq('preparation host wide class and title',prep.host.find_window(0,0,empty.put('blank',true),empty.put('',true),1),911);
prep.host.destroy_window(911);
eq('preparation host destroyed window absent',prep.host.find_window(0,0,0,0,0),0);
// Actual-source negative controls must be rejected by independently selected expectations.
for(const mutation of ['matches','after','class','title']) {
  const f=fixture(mutation==='class'||mutation==='title'?'retained':'main',mutation);
  f.add(101,'Wanted','Correct',0,10);f.add(102,'Wrong','Wrong',0,20);
  if(mutation==='matches')rejected('negative bypass local match',()=>assert.equal(f.call('a',f.put('Missing'),0),0));
  if(mutation==='after')rejected('negative ignore stale after',()=>assert.equal(f.call('ex',0,999,0,0),0));
  if(mutation==='class')rejected('negative remove host class filter',()=>assert.equal(f.call('a',f.put('Missing'),0),0));
  if(mutation==='title')rejected('negative remove host title filter',()=>assert.equal(f.call('a',0,f.put('Missing')),0));
}
const output={base:MAIN,retained:{PREP,CONNECT,TEST},ancestry,mappings,binaries,
  checks:results.length,results,
  limits:'Actual extracted WAT API/core/match/z-order functions and complete actual host module. Controlled table/class/string-helper imports; fixture renderer dictionary. No full VM, real creation/destruction chain, worker RPC, CLI IPC, browser or game run. Destruction disagreement is injected, not shown reachable through a complete DestroyWindow call.'};
if(process.argv[3]) {
  const s=fs.statfsSync(repo),free=s.bavail*s.bsize;
  assert(free>=2269118464,`capacity failure ${free} < 2269118464`);
  fs.writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n');
}
console.log(JSON.stringify({checks:results.length,binaries:binaries.map(b=>({...b})),limits:output.limits},null,2));

'use strict';
// Independent offline acceptance controls. No canonical compiler/COM/heap run.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../../..');
const Input=require(path.join(ROOT,'test/support/positiont-com-module'));
const Fixture=require(path.join(ROOT,'test/test-d3d9-positiont-com-qualification'));
const Stream=require(path.join(ROOT,'lib/d3d-command-stream'));
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const fixture=read('test/test-d3d9-positiont-com-qualification.js');
const out=process.env.REVIEW_TMP;
assert(out,'REVIEW_TMP must name task-owned temporary directory');
fs.mkdirSync(out,{recursive:true});
function loadJS(file,requireOverride) {
  const module={exports:{}};
  const req=require('module').createRequire(path.join(ROOT,file));
  vm.runInNewContext(read(file),{module,exports:module.exports,__dirname:path.dirname(path.join(ROOT,file)),
    require:id=>requireOverride(id,req),process,console,Buffer,WebAssembly,Uint8Array,Map}, {filename:file});
  return module.exports;
}
function u(n){const b=[];do{let v=n&127;n>>>=7;b.push(v|(n?128:0));}while(n);return b;}
const str=s=>[...u(Buffer.byteLength(s)),...Buffer.from(s)];
const section=(id,b)=>[id,...u(b.length),...b];
// Small authentic Wasm shell: function exports and host.memory import only.
// Never instantiated and never claimed as a native qualification module.
function shell(names=Input.requiredExports) {
  return Buffer.from([0,97,115,109,1,0,0,0,
    ...section(1,[1,0x60,0,0]),
    ...section(2,[1,...str('host'),...str('memory'),2,0,1]),
    ...section(3,[1,0]),
    ...section(7,[...u(names.length),...names.flatMap(n=>[...str(n),0,0])]),
    ...section(10,[1,2,0,0x0b])]);
}
function files(bytes) {
  const m=path.join(out,'SHELL-ONLY.wasm'),p=path.join(out,'SHELL-ONLY.json');
  fs.writeFileSync(m,bytes);fs.writeFileSync(p,JSON.stringify(Input.provenance(bytes)));
  return [m,p];
}
async function loader() {
  const b=shell(),[m,p]=files(b),good=Input.loadPrebuilt(m,p);
  assert(good.module instanceof WebAssembly.Module);
  const modified=Buffer.concat([b,Buffer.from([0,2,1,120])]); // valid custom section
  assert(WebAssembly.validate(modified));fs.writeFileSync(m,modified);
  assert.throws(()=>Input.loadPrebuilt(m,p),/provenance mismatch: moduleSha256/);
  const missing=shell(Input.requiredExports.filter(n=>n!=='q_Declaration_Release'));
  const mp=files(missing);
  assert.throws(()=>Input.loadPrebuilt(...mp),/missing diagnostic\/native export: q_Declaration_Release/);
  files(b);
  const first='lib/d3d-shader-ir.js',target=path.join(ROOT,first),ordinary=fs.readFileSync;
  let altered=0;
  try {
    fs.readFileSync=function(f,...args){if(f===target){altered++;return Buffer.concat([ordinary.call(this,f),Buffer.from('\n// changed candidate\n')]);}return ordinary.call(this,f,...args);};
    assert.throws(()=>Input.loadPrebuilt(m,p),/candidate source mismatch: lib\/d3d-shader-ir.js/);
  }finally{fs.readFileSync=ordinary;}
  assert.strictEqual(altered,1);
  console.log(JSON.stringify({control:'loader',bytes:b.length,sha256:Input.sha256(b),
    changedActualModule:'REJECT',missingSpecificExport:'REJECT',changedCandidateBlob:'REJECT',instantiations:0}));
}
async function buildContract() {
  const bytes=shell();let compiled=0,seen;
  const closure={source:'(module (include "13-exports.wat"))',vfs:new Map([
    ['13-exports.wat','; exports'],['src/13-exports.wat','; exports'],['./13-exports.wat','; exports'],['other.wat','; unchanged']])};
  const adapter=loadJS('test/compile-src.js',(id,req)=>id==='../tools/watx-closure.js'?{
    watxSourceClosure:()=>closure,compileClosure:(c,o)=>{seen=o;assert.strictEqual(c,closure);return {success:true,wasmBinary:bytes};}
  }:req(id));
  const builder=loadJS('test/support/positiont-com-module.js',(id,req)=>id==='../compile-src'?{
    compileSrcWasm:(f,o)=>{compiled++;return adapter.compileSrcWasm(f,o);}
  }:req(id));
  const m=path.join(out,'CONTRACT-SHELL.wasm'),p=path.join(out,'CONTRACT-SHELL.json');
  for(const f of [m,p])fs.rmSync(f,{force:true});
  builder.buildDiagnostic(m,p);assert.strictEqual(compiled,1);assert.strictEqual(seen.tailCalls,true);
  for(const key of ['13-exports.wat','src/13-exports.wat','./13-exports.wat'])
    assert.strictEqual(closure.vfs.get(key),'; exports\n'+Input.extraWat);
  assert.strictEqual(closure.vfs.get('other.wat'),'; unchanged');
  assert.throws(()=>builder.buildDiagnostic(m,p),/refuse to overwrite/);
  const canonical=loadJS('tools/watx-closure.js',(id,req)=>id===path.join(ROOT,'tools/watx.js')?{
    compile:(s,vfs,o)=>{assert.strictEqual(vfs,closure.vfs);assert.strictEqual(o.mode,'production');assert.strictEqual(o.standardWat,true);
      assert.strictEqual(o.runtimeBuiltins,false);assert.strictEqual(o.strictDeclarations,true);
      assert.strictEqual(o.tailCalls,true);assert(!('regionShake' in o));return {success:true};}
  }:req(id));
  canonical.compileClosure(closure,{tailCalls:true});
  console.log('PASS authentic builder -> compile-src transform/options -> watx-closure options; compiler STAND-IN, no source compilation');
}
async function helper() {
  let compiles=0;
  const empty=Buffer.from([0,97,115,109,1,0,0,0]);
  const h=loadJS('test/render-helper.js',(id,req)=>{
    if(id==='./compile-src')return {compileSrcWasm:(f,o)=>{compiles++;assert.strictEqual(o.tailCalls,false);
      assert.strictEqual(f('13-exports.wat','before'),'before\n(func)\n');assert.strictEqual(f('other','other'),'other');return empty;}};
    if(id==='../lib/canvas-compat')return {createCanvas:()=>({})};
    if(id==='../lib/host-imports')return {createHostImports:()=>({host:{}})};
    if(id==='../lib/renderer')return {Win98Renderer:class {}};
    if(id==='../lib/font-substitutions')return {};
    return req(id);
  });
  const memory=new WebAssembly.Memory({initial:1,maximum:1,shared:true});
  for(let i=0;i<2;i++){const r=await h.bootRenderHarness({fonts:'none',memory,extraWat:'(func)',tailCalls:false});
    assert(r.instance instanceof WebAssembly.Instance);assert(r.module instanceof WebAssembly.Module);assert.strictEqual(r.memory,memory);}
  assert.strictEqual(compiles,1,'ordinary helper preserves compilation cache');
  console.log('PASS ordinary render-helper byte-module result shape, extraWat, tailCalls and cache; empty module/host stand-ins/64KiB ONLY');
}
async function sourceContract() {
  const native=fs.readdirSync(path.join(ROOT,'src')).filter(f=>f.endsWith('.wat')).map(f=>read('src/'+f)).join('\n');
  for(const n of Input.requiredExports.filter(n=>!n.startsWith('q_')))
    assert(native.includes(`(export "${n}")`),`required native export absent: ${n}`);
  const handlers=read('src/09ad-handlers-d3d9.wat')+read('src/09ae-d3d9-resources.wat');
  const calls=[...Input.extraWat.matchAll(/\(call \$(handle_[^\s()]+)/g)].map(m=>m[1]);
  assert.strictEqual(calls.length,25);
  for(const target of calls)assert(handlers.includes(`(func $${target} (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)`));
  for(let i=0;i<9;i++)assert.strictEqual(Input.extraWat.split(`(call $gs32 (i32.const ${0x07000004+i*4}) (local.get $a${i}))`).length-1,25);
  for(const f of [...read('src/main.watx').matchAll(/\(include "([^"]+)"\)/g)].map(m=>m[1]))
    assert(fs.existsSync(path.join(ROOT,'src',f)),`missing canonical include ${f}`);
  const alloc=read('src/10-helpers.wat'),start=alloc.indexOf('(func $heap_alloc (');
  assert(start>0);assert(alloc.slice(start,start+700).includes('(i32.gt_u (local.get $size) (i32.const 0x7FFFFFF0))'));
  const {classifyTest}=require(path.join(ROOT,'tools/test-tiers'));
  assert.strictEqual(classifyTest('test/test-d3d9-positiont-com-qualification.js'),'e2e');
  assert.strictEqual(classifyTest('test/test-d3d9-positiont-com-qualification-guard.js'),'unit');
  console.log('PASS source contract: all required native exports exist; 25 handler signatures / nine stdcall slots match; include files present; oversized-rejection branch and tiers verified; SOURCE ONLY');
}
async function reuse() {
  const block=fixture.slice(fixture.indexOf('  const live=[]'),fixture.indexOf('  // Queue an authentic'));
  assert(block.includes('production allocator must actually reuse freed address'));
  for(const returnsOriginal of [true,false]) {
    const memory={buffer:new ArrayBuffer(2*1024*1024)},sizes=[32,16420,16420,800,800,288];
    const guests=sizes.map((_,i)=>4096+i*32768),extents=new Map();let calls=0;
    const traces=guests.slice(0,5).map((guest,i)=>({kind:'bundle-storage',guest,size:sizes[i]}));
    traces.push({kind:'descriptor',guest:guests[5],requested:288});
    const recovered={nativeFixed:{vertex:{nativeBytes:Uint8Array.of(1,2)},pixel:{nativeBytes:Uint8Array.of(3,4)}}};
    const context={assert,Set,Uint8Array,ModuleInput:Input,memory,traces,recovered,wa:p=>p,e:{
      guest_alloc(n){const p=returnsOriginal?guests[calls]:400000+calls*2048;calls++;
        extents.set(p,n);return p;}}};
    const run=()=>vm.runInNewContext(block+'\nresult={reused:[...reused],reuseBytes};',context);
    if(returnsOriginal){run();assert.strictEqual(context.result.reused.length,6);
      for(const [p,n] of extents){const bytes=new Uint8Array(memory.buffer);assert.strictEqual(bytes[p-1],0);
        assert.strictEqual(bytes[p+n],0);assert(bytes.subarray(p,p+n).every(v=>v===0xa5));}}
    else {assert.throws(run,/production allocator must actually reuse freed address/);assert.strictEqual(calls,64);}
  }
  console.log('PASS EXACT fixture reuse block: six original-address observations mandatory; nonreuse fails at 64; poison inside returned extents; HOST ALLOCATOR MODEL ONLY');
}
async function queue(control) {
  const block=fixture.slice(fixture.indexOf('  let release;const gate='),fixture.indexOf('  for(const p of live)'));
  const good=Fixture.expectedFrame(),nativeBytes=()=>Uint8Array.of(1,2,3,4);
  const recovered={vertices:Uint8Array.of(5,6,7,8),nativeFixed:{vertex:{nativeBytes:nativeBytes()},pixel:{nativeBytes:nativeBytes()}}};
  let pixels=good.slice(),executions=0;
  const backend={execute(c){executions++;
    try{assert.deepStrictEqual(Array.from(c.payload.vertices),[5,6,7,8]);
      for(const s of ['vertex','pixel'])assert.deepStrictEqual(Array.from(c.payload.nativeFixed[s].nativeBytes),[1,2,3,4]);
      pixels=good.slice();return {value:1,complete:true};
    }catch(error){return {value:{error},complete:true};}}};
  const context={assert,console,Promise,control,backend,recovered,...Stream,
    clear:()=>{pixels=Fixture.expectedFrame(false);},frame:()=>pixels,frameOracle:Fixture.frameOracle};
  // Same realm as the real queue: it deliberately refuses foreign host objects.
  const run=()=>Function(...Object.keys(context),'return (async()=>{'+block+'})()')(...Object.values(context));
  if(control){await assert.rejects(run(),/queue bytes survive caller mutation and real heap reuse: complete BGRA\/depth oracle/);}
  else await run();
  assert.strictEqual(executions,1,'deferred draw really executes after gate');
  console.log(`PASS EXACT fixture queue block ${control||'baseline'}: executed=1, expected ${control?'pixel rejection':'success'}; real CommandQueue / HOST PIXEL EXECUTOR ONLY`);
}
async function main(){
  await loader();await buildContract();await helper();await sourceContract();await reuse();
  await queue();await queue('alias-queued-bytes');await queue('corrupt-queued-ir');
  console.log('PASS independent offline controls; full COM/real heap/native module NOT EXECUTED; no compiler called');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

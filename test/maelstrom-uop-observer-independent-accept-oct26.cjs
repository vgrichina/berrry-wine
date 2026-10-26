'use strict';
// Independent bounded challenges. Reuse the pinned test's fixture factory only;
// its supplied assertions run separately, unchanged. No full compiler or guest.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto'),Module=require('node:module');
const hook=require('../tools/maelstrom-native-errno-latch.cjs');
const adapter=require('../tools/maelstrom-original-errno-adapter.cjs');
const {func,parse}=require('./maelstrom-select-hook-model.cjs');
const {compile}=require(process.env.MNE_WATX||'/home/user/wine-assembly/tools/watx.js');
const fixturePath=path.join(__dirname,'maelstrom-uop-native-observer.test.cjs');
const fixtureSource=fs.readFileSync(fixturePath,'utf8');
assert.equal(createHash('sha256').update(fixtureSource).digest('hex'),'9f30bf39c9f841195bda049e5e0f06d683bf20ac1cf06b073ef65a31d0e8c914');
const cut=fixtureSource.indexOf("\ntest('unchanged observed completion scalars");assert(cut>0);
const fixtureModule=new Module(fixturePath,module);fixtureModule.filename=fixturePath;fixtureModule.paths=module.paths;
fixtureModule._compile(fixtureSource.slice(0,cut)+'\nmodule.exports={fixture,sources,binaries,out,options,anchor};',fixturePath);
const {fixture,sources,binaries,out,options,anchor}=fixtureModule.exports;
const cpath='src/07e-uop-compiler.wat',base=0x522000,entry=base+0xc430,ret=base+0xc438;
const serialize=n=>Array.isArray(n)?'('+n.map(serialize).join(' ')+')':n;
let assertions=0,groups=0;
function test(name,f){f();groups++;console.log('PASS independent '+name);}
function eq(a,b,label){assert.deepEqual(a,b,label);assertions++;}
function rejects(f,pattern){assert.throws(f,pattern);assertions++;}
test('compiler source drift and read-once snapshots including option side effects',()=>{
 for(const mutation of [s=>s+'\n',s=>s.replace('(func $uc_unsup','(func $uc_unsup_changed'),s=>s.replace('(local.get $addr)','(i32.const 0)')])
  rejects(()=>hook.transform({...sources,[cpath]:mutation(sources[cpath])},options),/source pin/);
 let reads=0;const varying={...sources};Object.defineProperty(varying,cpath,{get(){return ++reads===1?sources[cpath]:sources[cpath]+'\n';}});
 eq(hook.transform(varying,options),out);eq(reads,1);
 const mutable={...sources};let optReads=0;
 const changing={...options,get crtLoadedBase(){optReads++;mutable[cpath]+='\n';return base;}};
 eq(hook.transform(mutable,changing),out);eq(optReads,1);eq(mutable[cpath],sources[cpath]+'\n');
});
test('disabled transform has zero source, compiler, binary and option access',()=>{
 const poison=new Proxy({}, {get(){throw Error('source read');},ownKeys(){throw Error('source enumerate');}});
 for(const enabled of [false,0,null,undefined,'true',1]){
  const opt=new Proxy({enabled},{get(t,p){eq(p,'enabled');return t[p];}});eq(hook.transform(poison,opt),poison);
 }
});
function boundaryModule(output){
 const ast=func(output[cpath],'uc_decode'),stop=ast.findIndex(n=>Array.isArray(n)&&n[0]==='local.set'&&n[1]==='$O0');assert(stop>0);
 const body=serialize(['func','$boundary',['export','"boundary"'],...ast.slice(2,stop)]);
 const source='(memory 1 1) (export "memory" (memory 0))\n'+serialize(func(output[cpath],'uc_unsup'))+'\n'+body;
 const b=compile(source,new Map(),{mode:'production'}).wasmBinary;assert(b.length<4096);
 return new WebAssembly.Instance(new WebAssembly.Module(b),{}).exports;
}
test('compiler prefix declines precisely two addresses including relocated CRT control',()=>{
 for(const crtLoadedBase of [base,0x600000]){
  const output=hook.transform(sources,{...options,crtLoadedBase}),e=boundaryModule(output),dv=new DataView(e.memory.buffer);
  const targets=[anchor.successor-2,crtLoadedBase+0xc438];
  for(const center of targets)for(let delta=-128;delta<=128;delta++){
   const a=center+delta;new Uint8Array(e.memory.buffer,256,256).fill(0xa5);e.boundary(a,256);
   eq(dv.getUint32(256,true),a);const excluded=targets.includes(a);
   eq(dv.getUint32(264,true),0);eq(dv.getUint32(308,true),excluded?1:0);eq(dv.getUint32(260,true),excluded?a+1:0);
  }
  // Cold and repeated calls use the same exclusion; no observer state needed.
  for(let i=0;i<3;i++){e.boundary(targets[0],256);eq(dv.getUint32(308,true),1);}
 }
});
test('transform modifies exactly allowed fragments and never disables UOP',()=>{
 const allowed=new Set(['src/05-alu.wat','src/06b-core-handlers.wat','src/07d-uop-engine.wat',cpath,'src/09b-dispatch.wat','src/09d-winsock.wat']);
 eq(Object.keys(out).filter(p=>out[p]!==sources[p]).sort(),[...allowed].sort());
 const assignments=s=>[...s.matchAll(/\(global\.set \$uop_enabled\s+[^\n]+/g)].map(m=>m[0]);
 eq(assignments(out['src/07d-uop-engine.wat']),assignments(sources['src/07d-uop-engine.wat']));
 eq(out[cpath].replace(/\n    \(if \(i32.or \(i32.eq \(local.get \$addr\)[\s\S]+?\(then \(call \$uc_unsup \(local.get \$R\)\) \(return\)\)\)/,''),sources[cpath]);
 for(const p of allowed)if(p!=='src/07d-uop-engine.wat')eq(assignments(out[p]),assignments(sources[p]));
});
test('post-construction option and source mutation cannot retarget generated observer',()=>{
 const opt={...options,binaries:{...binaries}},src={...sources},generated=hook.transform(src,opt),saved=JSON.stringify(generated);
 opt.enabled=false;opt.uopNativeBoundaries=false;opt.crtLoadedBase=0x600000;src[cpath]+='\n';opt.binaries.crt=Buffer.alloc(2);
 eq(JSON.stringify(generated),saved);const e=boundaryModule(generated),dv=new DataView(e.memory.buffer);
 e.boundary(ret,256);eq(dv.getUint32(308,true),1);e.boundary(0x60c438,256);eq(dv.getUint32(308,true),0);
 const f=fixture();f.complete();f.native(12345);eq(f.e.mne_errno(),12345);eq(f.get('uop_enabled'),1);
});
test('wrong original binaries and explicit CRT bases reject',()=>{
 for(const key of ['exe','net','crt']){const b=Buffer.from(binaries[key]);b[b.length-1]^=1;rejects(()=>hook.transform(sources,{...options,binaries:{...binaries,[key]:b}}),/binary pin/);}
 for(const crtLoadedBase of [undefined,0,0x522001,-1,0x80000000,NaN,base+0.5])rejects(()=>hook.transform(sources,{...options,crtLoadedBase}),/explicit future native CRT loaded base/);
});
test('loaded-image verifier binds CRT, relocated module anchors, image base and IAT',()=>{
 const buffer=new ArrayBuffer(4*1024*1024),bytes=new Uint8Array(buffer),dv=new DataView(buffer),at=a=>a-0x400000+0x12000;
 const checkBytes=[];function put(a,hex){const b=Buffer.from(hex,'hex');bytes.set(b,at(a));checkBytes.push([at(a),b.length]);}
 put(entry,'e82274ffff83c008c3');
 for(const [a,hex] of Object.entries(hook.NET_ANCHORS))put(0x7a2000+Number(a)-0x10000000,Number(a)===0x100012f2?'8b3d10407a00':hex);
 put(0x40e125,'e8c253000083c40885c0756e');dv.setUint32(at(0x7a4010),entry,true);
 const e={get_image_base:()=>0x400000},bases={msvcrt:{loadAddr:base},sdl_net:{loadAddr:0x7a2000}};
 eq(adapter.verifyLoaded(e,buffer,bases).authenticLoadedAnchors,true);
 for(const [offset,length] of checkBytes)for(let i=0;i<length;i++){
  bytes[offset+i]^=1;rejects(()=>adapter.verifyLoaded(e,buffer,bases),/incompatible authentic loaded bytes/);bytes[offset+i]^=1;
 }
 for(const key of ['msvcrt','sdl_net'])rejects(()=>adapter.verifyLoaded(e,buffer,{...bases,[key]:{loadAddr:bases[key].loadAddr+0x1000}}),/incompatible original loaded bases/);
 rejects(()=>adapter.verifyLoaded({get_image_base:()=>0x400001},buffer,bases),/incompatible image base/);
 dv.setUint32(at(0x7a4010),entry+1,true);rejects(()=>adapter.verifyLoaded(e,buffer,bases),/original errno IAT mismatch/);
});
test('stale owner snapshots and wrong native register or return frame close',()=>{
 const mutants={token:8,phase:2,completions:2,active:1,fault:1,capped:1,pre:1,post:1,ret:1,result:1,thread:2,regs:2000};
 for(const [name,value] of Object.entries(mutants))for(const stage of ['call','return']){
  const f=fixture();f.complete();f.set('eip',anchor.selectRet+2);
  if(stage==='return')f.e.fixture_mne_call(anchor.successor,entry,7);
  f.set('msc_'+name,value);
  if(stage==='call')f.e.fixture_mne_call(anchor.successor,entry,7);
  else{f.set('eip',anchor.successor);f.e.fixture_mne_return(ret);}
  eq(f.e.mne_status(),5,name+':'+stage);eq(f.e.mne_errno(),0);
 }
 for(const mutate of [f=>f.reg(7,entry+1),f=>f.reg(4,f.post+4),f=>f.reg(5,4),f=>f.set('eip',anchor.successor+1)]){
  const f=fixture();f.complete();f.e.fixture_mne_call(anchor.successor,entry,7);f.set('eip',anchor.successor);mutate(f);f.e.fixture_mne_return(ret);eq(f.e.mne_status(),5);
 }
});
test('actual threaded CALL transfer rejects wrong native target without repairing it',()=>{
 const f=fixture();f.complete();f.reg(7,entry+4);f.set('word',7);f.set('eip',anchor.selectRet+2);f.e.th_call_r(anchor.successor);
 eq(f.e.mne_status(),5);eq(f.get('eip'),entry+4);eq(f.reg(4),f.post-4);eq(f.word(f.post-4),anchor.successor);
});
test('foreign owner is inert then owned native execution captures actual independent values',()=>{
 for(const key of ['current_thread_id','reg_base']){
  const f=fixture();f.complete();const v=f.get(key);f.set(key,v+4);const before=f.scalar();f.e.fixture_mne_call(anchor.successor,entry,7);eq(f.scalar(),before);f.set(key,v);
  f.native(0x12345678);eq(f.e.mne_status(),4);eq(f.e.mne_errno(),0x12345678);eq(f.e.mne_caller(),f.caller);eq(f.get('uop_enabled'),1);
 }
});
test('disable-enable at every live stage is terminal and never a successful fallback',()=>{
 for(const stage of ['start','completion','native']){
  const f=fixture();if(stage!=='start')f.complete();if(stage==='native')f.e.fixture_mne_call(anchor.successor,entry,7);
  f.e.set_uop(0);eq(f.e.mne_status(),5);f.e.set_uop(1);const before=f.scalar();
  f.e.fixture_mne_complete();f.e.fixture_mne_call(anchor.successor,entry,7);f.e.fixture_mne_return(ret);eq(f.scalar(),before);eq(f.get('uop_enabled'),1);eq(f.e.mne_errno(),0);
 }
});
test('pre-CMP capture reads live memory once then remains immutable after corruption',()=>{
 const f=fixture();f.complete();f.native(0x10203040);eq(f.e.mne_status(),4);const before=f.scalar();
 f.put(f.errnoPtr,0xdeadbeef);f.put(f.post+0x124,0);f.reg(0,0);f.reg(4,0);f.reg(7,0);f.set('msc_token',99);
 f.e.fixture_mne_return(ret);f.e.fixture_mne_complete();f.e.mne_start();eq(f.scalar(),before);
 eq(before.errno,0x10203040);eq(before.caller,f.caller);eq(before.pc,anchor.successor);
});
test('arbitrary live caller/errno/argument words are read at genuine threaded RET',()=>{
 for(const value of [0,1,0x87654321,0xffffffff]){
  const f=fixture();f.complete();f.set('eip',anchor.selectRet+2);f.set('word',7);f.e.th_call_r(anchor.successor);
  eq(f.e.mne_status(),3);f.reg(0,f.errnoPtr);f.put(f.errnoPtr,value);
  f.put(f.post+0x124,value);f.put(f.post+0x128,value^0x12345678);f.put(f.post+0x12c,value^0x76543210);
  f.set('eip',ret);f.e.th_ret(0);
  eq(f.e.mne_status(),4);eq(f.e.mne_errno()>>>0,value);eq(f.e.mne_caller()>>>0,value);
  eq(f.e.mne_socketSet()>>>0,(value^0x12345678)>>>0);eq(f.e.mne_timeout()>>>0,(value^0x76543210)>>>0);
  eq(f.get('eip'),anchor.successor);eq(f.get('uop_enabled'),1);
 }
});
console.log(JSON.stringify({pass:true,groups,assertions,candidate:'145e66c80606c1ab4f854cef0cfcff2f5d6364ac',scope:'bounded compiler-prefix and native _getptd fixture only; authentic game and full compiler unqualified'}));

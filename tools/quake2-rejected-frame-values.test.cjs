'use strict';
// Authored OFFLINE controls. Execute the serialized reader and the complete
// generated 1205 health consumer with inert startup/I/O; never launch Chrome.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),passive=require('./quake2-passive-attack.cjs');
const {fixture,setMotion}=require('./quake2-passive-attack.test.cjs');
const composition=require('./quake2-native-driver-composition.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const offset=va=>va-0x400000+0x12000;
const oldCommit='8b4a4ae7d845952b91a069046907d02d4fe076a2';
const oldSource=cp.execFileSync('git',['show',oldCommit+':tools/quake2-passive-attack.cjs'],{cwd:root,encoding:'utf8'});
assert.equal(hash(oldSource),'d5db47532b7e9b59076788778f79af0d3e1f54b07e042e15ca729ee9907a540f','actual1205 pinned reader');
const oldModule={exports:{}};
vm.runInNewContext(oldSource,{module:oldModule,require,__dirname});
const healthPath=root+'/scratch/runs/20261109-quake2-observed-autoattach-native-1205/health-preload.cjs';
assert.equal(hash(fs.readFileSync(healthPath)),'6a2c9ca3ee868c5a4bcddef2cf84e202b6915f090bb11e98282a7efd60f3046a');
// Install exactly the retained 1205 composition wrapper, without its launcher.
const argv=process.argv[1];process.argv[1]=root+'/'+composition.consumerPath;
require(healthPath);process.argv[1]=argv;
const generated=composition.compose();
function publish(f,n,h=100){
 setMotion(f,{frameNumber:n});f.view.setInt16(offset(0xa9ce98)+0xaa,h,true);
 new Uint8Array(f.memory.buffer,offset(0xa9cf8c+(n&15)*240),240).set(new Uint8Array(f.memory.buffer,offset(0xa9ce98),240));
}
function reader(f,fn,expected){
 const trace=[];
 const sampled=()=>{
  const v=new DataView(f.wine.memory.buffer),at=offset(0xa9ce98);
  if(v.byteLength<at+240)return null;
  const number=v.getUint32(at+4,true),slot=0xa9cf8c+(number&15)*240;
  return {motion:{state:v.getUint32(offset(0xa86a60),true),slot,
   current:Array.from(new Uint8Array(v.buffer,at,240)),published:Array.from(new Uint8Array(v.buffer,offset(slot),240))},
   damage:Array.from(new Uint8Array(v.buffer,offset(0xa9cf8c),3840))};
 };
 const before=sampled();
 // Trace reads of the owning shared buffer, including every byte consumed by
 // the existing Array.from typed-array snapshots. Copied-buffer decoding is
 // intentionally excluded. Trace is a test harness only, never production.
 vm.runInContext(`
  globalThis.__trace=[];
  globalThis.DataView=class extends DataView {
   getUint8(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u8',...a]);return super.getUint8(...a);}
   getUint32(...a){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['u32',...a]);return super.getUint32(...a);}
  };
  globalThis.Uint8Array=class extends Uint8Array {
   *[Symbol.iterator](){for(let i=0;i<this.length;i++){if(this.buffer instanceof SharedArrayBuffer)__trace.push(['byte',this.byteOffset+i]);yield this[i];}}
  };`,f.context);
 const peek=f.renderer.peekKeyDownState;
 f.renderer.peekKeyDownState=key=>{trace.push(['physical',key]);f.context.__trace.push(['physical',key]);return peek(key);};
 const row=vm.runInContext('('+fn.toString()+')('+JSON.stringify(f.identity)+','+JSON.stringify(passive.signatures())+','+JSON.stringify(expected??null)+')',f.context);
 f.renderer.peekKeyDownState=peek;
 return {row:JSON.parse(JSON.stringify(row)),trace:JSON.parse(JSON.stringify(f.context.__trace)),physical:trace,before,after:sampled()};
}
function consumer(){
 const saved=[],logs=[],timers=[],processStub={env:{QUAKE2_NATIVE_RUN:'/offline-only',BROWSER_DEADLINE:String(Date.now()+60000)},once:()=>{}};
 const fakeFS={...fs,readFileSync:(p,...args)=>p==='/offline-only/runtime-pins.json'?JSON.stringify({files:generated.references}):fs.readFileSync(p,...args),
  mkdirSync:()=>{},existsSync:()=>false,rmSync:()=>{}};
 const fakeRequire=name=>{
  if(name==='node:fs')return fakeFS;
  if(name==='node:child_process')return {spawn:()=>{throw Error('OFFLINE: forbidden spawn');}};
  if(name.endsWith('/tools/quake2-native-transport.cjs'))return {publish:(p,r)=>saved.push({path:p,row:JSON.parse(JSON.stringify(r))}),closed:()=>{}};
  if(name.endsWith('/tools/native-command-log.cjs'))return {createLogs:()=>({append:(p,r)=>logs.push({path:p,row:JSON.parse(r)}),close:()=>{}})};
  if(name==='./bound-input.cjs')return require(root+'/'+path.dirname(composition.consumerPath)+'/bound-input.cjs');
  return require(name);
 };
 const start=generated.source.indexOf('(async()=>{\n checkTerminal();\n server=');assert(start>0,'unique startup seam');
 assert.equal(generated.source.indexOf('(async()=>{\n checkTerminal();\n server=',start+1),-1);
 const source=generated.source.slice(0,start)+`globalThis.control={retainHealth,passiveHealthTick,observeTerminal,
  setup(c){chain=c;latest={identity:{}};},setClosing(){closing=true;},
  failure(){return terminalFailure;},closing(){return closing;}};`;
 const context=vm.createContext({require:fakeRequire,process:processStub,__dirname:root+'/'+path.dirname(composition.consumerPath),
  console:{log:()=>{},error:()=>{}},Buffer,AbortController,setTimeout:(f,ms)=>{timers.push(ms);return timers.length;},clearTimeout:()=>{},clearInterval:()=>{}});
 new vm.Script(source).runInContext(context);
 return {control:context.control,saved,logs,timers};
}
const scenarios=[
 ['normal',()=>{},null],
 ['damage98',f=>publish(f,264,98),null],
 ['death0',f=>publish(f,264,0),null],
 ['signedDeath-1',f=>publish(f,264,-1),null],
 ['currentRingMismatch',f=>f.view.setInt16(offset(0xa9ce98)+0x34,42,true),'motionPublishedMatches'],
 ['betweenReadChange',f=>{let once=false;f.renderer.peekKeyDownState=()=>{if(!once){once=true;publish(f,264);}return 0;};},'motionEqual'],
 ['inactive',f=>f.put(0xa86a60,3),'motionActive'],
 ['malformedTime',f=>{f.put(0xa9cea0,1);f.put(0xa9cf8c+(263&15)*240+8,1);},'motionTimeMatches'],
 ['malformedValid',f=>{f.put(0xa9ce98,0);f.put(0xa9cf8c+(263&15)*240,0);},'motionValid'],
 ['malformedPmType',f=>{f.put(0xa9cec8,256);f.put(0xa9cf8c+(263&15)*240+0x30,256);},'motionPmTypeUpperBound'],
 ['ringBetweenReadChange',f=>{let once=false;f.renderer.peekKeyDownState=()=>{if(!once){once=true;f.view.setUint8(offset(0xa9cf8c)+0xaa,1);}return 0;};},'damageRingEqual'],
 ['malformedFeedback',f=>{for(const va of [0xa9ce98,0xa9cf8c+(263&15)*240])f.view.setFloat32(offset(va)+0x90,NaN,true);},'damageCurrentDecoded'],
 ['ownerRebind',f=>{f.link.worker={};},'ownerIdentityChanged',true],
 ['memoryRebind',f=>{f.link.memory={buffer:f.memory.buffer};},'sharedMemoryUnavailable',true],
 ['ownerBetweenRead',f=>{f.renderer.peekKeyDownState=()=>{f.link.worker={};return 0;};},'ownerOrMemoryChangedDuringRead',true],
 ['memoryBetweenRead',f=>{f.renderer.peekKeyDownState=()=>{f.link.memory={buffer:f.memory.buffer};return 0;};},'ownerOrMemoryChangedDuringRead',true],
 ['unreadable',f=>{const memory=new WebAssembly.Memory({initial:32,maximum:32,shared:true});for(const p of passive.signatures())new Uint8Array(memory.buffer,offset(p.va),p.bytes.length).set(p.bytes);f.wine.memory=memory;f.link.memory=memory;},'attackBoundsRejected',true],
 ['expectedMemoryRebind',()=>{},'memoryIdentityChanged',true,'other-memory'],
];
async function main(){
 const out=process.env.Q2_REJECTED_FRAME_TEST_OUTPUT;assert(out,'fresh Q2_REJECTED_FRAME_TEST_OUTPUT required');fs.mkdirSync(out,{recursive:false});
 const results=[];
 for(const [name,mutate,predicate,rejectValue=false,expected] of scenarios){
  const pair=[];
  for(const fn of [oldModule.exports.readPage,passive.readPage]){
   const f=fixture();publish(f,263);const h=consumer();h.control.retainHealth({attackInput:f.read()},'capture-after');
   mutate(f);const got=reader(f,fn,expected);let failure;
   try{h.control.retainHealth({attackInput:got.row},'during-action');}catch(e){failure=String(e);}
   pair.push({...got,failure,logs:h.logs,saved:h.saved});
   if(failure){
    let reads=0;h.control.setup({progress:async()=>{reads++;throw Error('post-terminal read');}});
    await h.control.passiveHealthTick();assert.equal(reads,0);assert(h.control.failure());
   }
  }
  const [old,now]=pair;
  assert.deepEqual(now.trace,old.trace,name+' exact owning-memory read order/count');
  assert.deepEqual(now.physical,old.physical,name+' physical order/count');
  const strip=r=>{r=structuredClone(r);delete r.rejectedFrame;delete r.at;return r;};
  assert.deepEqual(strip(now.row),strip(old.row),name+' unchanged acceptance/result');
  assert.equal(now.failure,old.failure,name+' unchanged terminal');
  if(predicate){
   assert.throws(()=>assert(old.row.rejectedFrame),'old missing values FAIL');
   assert.equal(now.row.rejectedFrame.predicates[predicate],rejectValue,name+' exact rejecting predicate');
   assert.deepEqual(now.logs.at(-1).row.attackInput.rejectedFrame,now.row.rejectedFrame,'existing generated health sink retains raw values');
   const d=now.row.rejectedFrame;
   if(d.motionFirst){
    assert.deepEqual(d.motionFirst,now.before.motion,'exact already-read first state/slot/current/published');
    assert.deepEqual(d.motionSecond,now.after.motion,'exact already-read second state/slot/current/published');
    assert.deepEqual(d.damageFirst,now.before.damage,'exact first ring bytes');assert.deepEqual(d.damageSecond,now.after.damage,'exact second ring bytes');
   }
   assert.match(now.failure,/passive health\/motion UNKNOWN/);
  }else if(name==='normal'){assert.equal(now.row.rejectedFrame,undefined);assert.equal(now.failure,undefined);}
  else {assert.match(now.failure,/first passive HP loss\/death/);assert.equal(now.row.damageFeedback.current.health,{damage98:98,death0:0,'signedDeath-1':-1}[name]);}
  results.push({name,oldMissingValues:predicate?'FAIL':'not rejected',newDiagnostic:predicate?'PASS':'not rejected',memoryReadCount:now.trace.length,
   readOrderSHA256:hash(JSON.stringify(now.trace)),physicalReads:now.physical.length,predicate:predicate??null,terminal:now.failure??null,rejectedFrame:now.row.rejectedFrame});
 }
 // Closing alone must also suppress the actual generated passive ticker.
 const h=consumer();let reads=0;h.control.setup({progress:async()=>{reads++;return {};}});h.control.setClosing();await h.control.passiveHealthTick();assert.equal(reads,0);
 const input=require('./quake2-native-input.cjs');
 for(const upFailure of [false,true]){
  const f=fixture();publish(f,263);const h=consumer();h.control.retainHealth({attackInput:f.read()},'capture-after');f.put(0xa86a60,3);
  const events=[];let caught,first,samples=0;
  try{await input.hold({keys:['ArrowRight'],holdMs:50,session:'authored',send:async(m,p)=>{events.push(p.type);if(upFailure&&p.type==='keyUp')throw Error('later UP failure');},
   sample:async()=>{samples++;return {attackInput:f.read()};},checkSample:r=>{try{h.control.retainHealth(r,'during-action');}catch(e){first=e;throw e;}},saveSample:()=>{throw Error('later sink failure');}});}catch(e){caught=e;}
  assert.equal(caught,first);assert.equal(caught,h.control.failure());assert.equal(samples,1);assert.deepEqual(events,['keyDown','keyUp']);
  assert.equal(caught.holdReceipt.physicalRelease,upFailure?'UNKNOWN':'ACK');
  assert(h.logs.at(-1).row.attackInput.rejectedFrame);
 }
 const result={passed:true,oldCommit,oldReaderSHA256:hash(oldSource),generatedHealthConsumerSHA256:hash(generated.source),
  completeGeneratedConsumerWithInertStartup:true,nativeExperiment:false,terminalTickerReads:0,independentUPStickyFirstFailure:true,controls:results};
 fs.writeFileSync(path.join(out,'controls.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('PASS '+results.length+' actual serialized old/new controls; exact shared read order/count; full generated1205 health sink; terminal ticker zero reads; independent UP/sticky first failure');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createReadiness,scope,POLICY,qualifiedLoader}=require('../tools/warcraft3-current-controller.cjs');
const observed=(seq,id=2)=>({running:true,stopped:false,guest:true,currentDisplay:true,publication:seq,
 ports:[{id:1,api:'gl',backend:'software'},{id,api:'gl-gps',backend:'software'}],
 gps:{endpoint:id,backend:'software',presents:seq,writeSeq:seq,workerEpoch:1,device:true,error:''},windows:[{hwnd:65537}]});
test('endpoint 1 without presentation stays pending; two completed advancing transport observations bind',()=>{
 const r=createReadiness();assert.equal(r.observe({...observed(0),gps:null}),false);assert.equal(r.observe(observed(1)),false);
 assert.equal(r.observe(observed(2)),true);assert.throws(()=>r.observe(observed(3,3)),/bound producer/);
});
test('incomplete/nonowner/error software producers cannot bind',()=>{
 for(const mutate of [v=>v.guest=false,v=>v.currentDisplay=false,v=>v.gps.device=false,v=>v.gps.error='failed',v=>v.windows=[],v=>v.gps.presents=0,v=>v.gps.writeSeq=0]){
  const r=createReadiness(),v=observed(1);mutate(v);assert.equal(r.observe(v),false);assert.equal(r.bound,null);
 }
});
test('first UNKNOWN closes with no later ordinary calls',async()=>{
 let closed=0,effects=0;const s=scope({close:()=>closed++,floor:()=>POLICY.floor+1,deadline:Date.now()+1000});
 await assert.rejects(s.request(()=>{effects++;throw Error('native RPC failure');}));
 await assert.rejects(s.request(()=>effects++),/permanently closed/);assert.equal(effects,1);assert.equal(closed,1);
});
test('actual floor closes before request and cannot reopen',async()=>{
 let free=POLICY.floor,called=0;const s=scope({close:()=>{},floor:()=>free,deadline:Date.now()+1000});
 await assert.rejects(s.request(()=>called++),/floor/);free+=1e9;
 await assert.rejects(s.request(()=>called++),/permanently/);assert.equal(called,0);
});
test('exact 7bca qualified stack refuses right mouse before dispatch',()=>{
 const q=qualifiedLoader().load('tools/quake2-native-consumption-input.cjs');
 const edge={kind:'mouse',code:2,button:2,x:400,y:300,ms:120,nonce:'right',name:'action-1',mode:'game'};
 assert.throws(()=>q.exactEdge(edge),/unsupported exact edge/);
 q.exactEdge({...edge,code:1,button:0});
});
test('page diagnostic envelope awaits genuine completion and preserves asynchronous refusal',async()=>{
 const vm=require('node:vm'),{nativeReadExpression}=require('../tools/warcraft3-current-controller.cjs');
 let sample=1,closed=false,calls=0;
 const context=vm.createContext({runningApps:[{wine:{renderer:{_immutablePublicationSequence:19,_currentDisplayRecord:{}}}}],
  __mouse:{diagnostics:()=>({sample,closed}),async prepare(){calls++;await Promise.resolve();sample++;
    if(closed)throw Error('permanently closed');return {prepared:{state:'PREPARED'}};},
    async fail(){await Promise.resolve();closed=true;throw Error('genuine UNKNOWN');}}});
 const read=expr=>vm.runInContext(nativeReadExpression(expr),context);
 const ok=await read('__mouse.prepare()');assert.equal(ok.value.prepared.state,'PREPARED');
 assert.equal(ok.diagnostics.sample,2);assert.equal(ok.publication.sequence,19);
 const bad=await read('__mouse.fail()');assert.match(bad.error,/genuine UNKNOWN/);assert.equal(bad.value,undefined);
 assert.equal(bad.diagnostics.closed,true);assert.equal(calls,1);
 const rejected=await read('Promise.reject(Error("late native rejection"))');assert.match(rejected.error,/late native rejection/);
 const absent=await vm.runInNewContext(nativeReadExpression('0'));assert.equal(absent.value,0);assert.equal(absent.publication.sequence,null);
});
function xwdFixture(order=0){
 const b=Buffer.alloc(104+3*16),words={0:104,4:7,8:2,12:24,16:3,20:3,28:order,44:32,48:16,56:0xff0000,60:0xff00,64:0xff,76:0};
 for(const [k,v] of Object.entries(words))b.writeUInt32BE(v,+k);
 for(let y=0;y<3;y++)for(let x=0;x<3;x++)b[order?'writeUInt32BE':'writeUInt32LE']((x*71<<16)|(y*73<<8)|(x+y)*37,104+y*16+x*4);
 return b;
}
test('whole native XWD observation preserves every pixel without a PNG decode round trip',()=>{
 const C=require('../tools/warcraft3-current-controller.cjs'),{PNG}=require('pngjs');
 const old=require('../tools/browser-transients.cjs');
 for(const order of [0,1]){
  const raw=xwdFixture(order),codec=C.createCaptureCodec();
  const before=PNG.sync.read(old.encodeXwd(raw).png),encoded=codec.encodeXwd(raw),actual=codec.read(encoded.png);
  assert.equal(actual.width,before.width);assert.equal(actual.height,before.height);assert.deepEqual(actual.data,before.data);
  assert.deepEqual(PNG.sync.read(encoded.png).data,before.data);
  assert.throws(()=>codec.read(encoded.png),/original XWD/);
  assert.throws(()=>codec.read(Buffer.from(encoded.png)),/original XWD/);
  // The next frame must come from its own new native bytes, never cached PNG.
  const replaced=xwdFixture(order);replaced[104+(order?1:2)]^=255;
  assert.notDeepEqual(codec.read(codec.encodeXwd(replaced).png).data,actual.data);
 }
});
test('native observation refuses malformed or unsupported XWD instead of repainting or guessing pixels',()=>{
 const C=require('../tools/warcraft3-current-controller.cjs');
 for(const [field,value] of [[0,99],[4,6],[8,1],[16,0],[20,999],[28,2],[44,24],[48,4],[56,255],[60,1],[64,256],[76,999]]){
  const raw=xwdFixture();raw.writeUInt32BE(value,field);assert.throws(()=>C.createCaptureCodec().encodeXwd(raw),undefined,String(field));
 }
 assert.throws(()=>C.createCaptureCodec().encodeXwd(Buffer.alloc(99)),/short XWD/);
});
test('actual authority socket fence uses original native pixels; old PNG decode dependency fails and corrected path passes',async()=>{
 const C=require('../tools/warcraft3-current-controller.cjs'),cp=require('node:child_process'),{PNG}=require('pngjs');
 const before=require('../lib/browser-reviewed-frame-equivalence.cjs'),exec=cp.execFileSync,read=PNG.sync.read;
 const raw=xwdFixture(),identity={target:'t',owner:'o',generation:[1,0],viewport:'3x3',focus:1,modal:0,capture:0,module:'m',realm:1};
 const options={env:{DISPLAY:':fixture',XAUTHORITY:'fixture'},checkpoint(){},context:async()=>identity,evidenceSink:e=>{
  assert.equal(e.fresh.width,3);assert.equal(e.fresh.height,3);assert.equal(e.accepted,true);return true;}};
 let nativeReads=0;
 cp.execFileSync=(cmd)=>{if(cmd==='xdotool')return '1';assert.equal(cmd,'xwd');nativeReads++;return Buffer.from(raw);};
 PNG.sync.read=()=>{throw Error('redundant PNG decode invoked');};
 try{
  await assert.rejects(before.createNativeManualContext(options).captureReview('old'),/redundant PNG decode/);
  const phases=[],authority=C.loadCaptureAuthority(v=>phases.push(v)).createNativeManualContext(options);
  const source=await authority.captureReview('new'),image={sha256:source.sha256,completedAt:source.at};
  const intent={nonce:'once',name:'action-1',kind:'mouse',button:0,code:1,x:1,y:1,ms:90,mode:'menu',
   review:'authored native-observation fixture',imageSHA256:source.sha256,reviewedAt:Date.now()};
  const handle=await authority.prove(source.name,intent,image);await authority.beforeDown(handle,intent,image);
  let published=0;authority.fence(handle,intent,image,()=>published++);assert.equal(published,1);
  assert.equal(nativeReads,5);assert.equal(phases.filter(v=>v.phase==='capture-original-rgba').length,4);
  authority.consume(handle);assert.throws(()=>authority.fence(handle,intent,image,()=>published++),/used/);
  assert.equal(published,1);authority.close();
 }finally{cp.execFileSync=exec;PNG.sync.read=read;}
});

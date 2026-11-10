'use strict';
// Execute the authenticated existing bridge harness and the current generated
// command body. External browser/guest execution is controlled, never claimed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),current=require('./q3-current-module.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs'),observer=require('../lib/q3-input-observer.js');
const helper=require('./q3-menu-pointer-control.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const filename=path.join(__dirname,'q3-menu-pointer-control.test.cjs');
const original=fs.readFileSync(filename,'utf8');
assert.equal(hash(original),'2adec94e7cd716204eacbe66509c907541e9aa2e3b1042dcb3003794713b88e2');
let harness=original.slice(0,original.indexOf('(async()=>{'));
assert(harness.includes('function page('));
// Replace the retired CPU-source pinset with the current explicit published
// closure. Keep retained-command/media verification and all input code intact.
const pinStart=harness.indexOf("const pins=json(prior+'/runtime-pins.json.gz');"),pinEnd=harness.indexOf('function retained(name)');
assert(pinStart>0&&pinEnd>pinStart);
harness=harness.slice(0,pinStart)+harness.slice(pinEnd);
harness=harness.replace('const source=composition.compose().source;',"const source=require('./q3-current-foreign-closure-v1.cjs').composition('"+route.version+"').compose().source;");
current.validate({checkpointObserverVersion:current.checkpointObserverVersion,foreignClosureVersion:route.version});
const seam='return {r,scope,canvas,document,words,index,events,send,evaluate,host,worker};';
assert.equal(harness.split(seam).length,2);
harness=harness.replace(seam,'return {r,scope,canvas,document,words,index,events,send,evaluate,host,worker,listeners,memory};');
const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
m._compile(harness+'\nmodule.exports={page,body};',filename);
assert.equal(observer.install(),null);
const plain=route.composition(route.version).compose().source;
assert.equal(current.composeInputObservation(plain),plain,'default inert generated caller');
process.env.Q3_BOUND_INPUT_OBSERVATION='1';
const generated=helper.integrate(route.composition(route.version).compose().source);
delete process.env.Q3_BOUND_INPUT_OBSERVATION;
new vm.Script(Module.wrap(generated));
assert(generated.includes('inputObservationPageSource()'));
const image={label:'startup',sha256:'a'.repeat(64),identity:{process:'original',module:'authenticated-by-existing-chain'}};
const reports=[];
async function control(mode,key=false,publication=null) {
 const p=m.exports.page(mode==='locked'),dom=new Map(),rows=[],saved={};
 p.scope.Node=class Node {};
 p.scope.runningApps[0].relativeMouse=mode!=='absolute';
 const doc={...p.document,addEventListener:(type,f)=>dom.set(type,f),removeEventListener:(type,f)=>{if(dom.get(type)===f)dom.delete(type);}};
 let alive=true,clock=0;
 const timer=[];
 const o=observer.install({enabled:true,canvas:p.canvas,renderer:p.r,document:doc,memory:p.memory,diBase:p.index*4,
   relative:()=>p.scope.runningApps[0].relativeMouse,owner:()=>alive,emit:row=>rows.push(row),now:()=>clock,
   interval:fn=>{timer.push(fn);return 1;},clear(){},limit:256,durationMs:1000});
 p.scope.__q3BoundInput=o;
 const before=Buffer.from(p.memory.buffer).subarray(p.index*4,p.index*4+288).toString('hex');
 o.image(image);o.snapshot();assert.equal(Buffer.from(p.memory.buffer).subarray(p.index*4,p.index*4+288).toString('hex'),before);
 assert.throws(()=>o.begin({id:'bad',label:'bad',previous:{sha256:'bad',identity:{}}}),/binding/);
 assert.throws(()=>o.begin({id:'stale',label:'bad',previous:{...image,sha256:'c'.repeat(64)}}),/prior image mismatch/);
 assert.throws(()=>o.image({...image,identity:{process:'replaced'}}),/owner mismatch/);
 let publishedReview={...image,review:'controlled offline review'};
 if(publication){
  let requested;
  const transport={publish:(file,value)=>{assert.equal(file,publication.output+'/startup-review.json');publishedReview=value;},
   request:async(out,id,value,timeout)=>{assert.equal(out,publication.output);assert.equal(timeout,55000);requested=value;return {status:0};}};
  const ctx={require:name=>name==='node:fs'?{readFileSync:()=>JSON.stringify(image)}:transport,console:{log(){}},process:{}};
  vm.runInNewContext(publication.source,ctx);await Promise.resolve();
  assert.equal(typeof publishedReview.review,'string');assert.equal(publishedReview.review,publication.value.review);
  assert.deepEqual(JSON.parse(JSON.stringify(requested)),publication.value.command);
 }
 const command=publication?publication.value.command:key?{id:'key',action:'key',key:'Enter',holdMs:50,waitMs:0,reviewRef:'startup',label:'after'}:
   {id:'mouse',action:'click',point:[.9,.86],holdMs:150,waitMs:0,reviewRef:'startup',label:'after',...(mode==='locked'?{relativeCounts:[198,2]}:{})};
 let mark=0,captures=0,admissions=0;
 const delivered=[],nativeKeys=[];
 const drain=()=>{let event;while((event=p.r.takeInput()))delivered.push({...event});};
 const send=async(method,params,session)=>{
  if(method==='Input.dispatchKeyEvent') {
   nativeKeys.push(params.type);const type=params.type==='keyDown'?'keydown':'keyup';
   const e={type,key:params.key,code:params.code,keyCode:params.windowsVirtualKeyCode,
    isTrusted:true,repeat:false,target:p.canvas,preventDefault(){},stopPropagation(){}};
   dom.get(type)?.(e);p.listeners.get(type)(e);return {};
  }
  const type={mouseMoved:'mousemove',mousePressed:'mousedown',mouseReleased:'mouseup'}[params.type];
  dom.get(type)?.({type,isTrusted:true,clientX:params.x,clientY:params.y,button:0,buttons:params.buttons,movementX:0,movementY:0});
  return p.send(method,params,session);
 };
 const context={assert,root,deadline:Date.now()+60000,latest:image,out:'/controlled',pageSession:'page',
   process:{env:{}},checkTerminal(){},observeTerminal:e=>{throw e;},
   fs:{readFileSync:f=>f.endsWith('-review.json')?JSON.stringify(publishedReview):'image'},sha:()=>image.sha256,
   save:(n,v)=>saved[n]=v,log(){},send,evaluate:p.evaluate,wait:async()=>{},trace:{span:(_,f)=>f()},
   bound:require('./q3-input-delivery.cjs'),chain:{admit:async(_,f)=>{admissions++;return f({live:{identity:image.identity}});},
     progress:async()=>{drain();return {physical:[{key:13,state:p.r.peekKeyDownState(13)}]};}},
   capture:async()=>{captures++;drain();o.image({...image,label:command.label,sha256:'b'.repeat(64)});},
   require:n=>['./native-mouse.cjs','./ordinary-keys.cjs'].includes(n)?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/'+n.slice(2)):require(n)};
 await m.exports.body(generated,context)(command,()=>mark++);
 assert.equal(mark,1);assert.equal(captures,1);assert(admissions>0);assert(saved['input-'+command.id+'-observer-begin.json'].active);
 assert(rows.every(r=>!r.binding||r.binding.id===command.id));
 assert(rows.some(r=>r.kind==='command-begin'&&r.binding.previous.sha256===image.sha256));
 assert.throws(()=>o.image({...image,label:'unrequested'}),/command mismatch/);
 assert(rows.some(r=>r.kind==='image-bound'&&r.capture.sha256==='b'.repeat(64)));
 assert.equal(rows.find(r=>r.kind==='observer-arm').state.mode,mode);
 if(key) {
  assert.deepEqual(nativeKeys,['keyDown','keyUp']);
  assert(delivered.some(e=>e.msg===0x100&&e.wParam===13));
  assert(delivered.some(e=>e.msg===0x101&&e.wParam===13));
  assert(rows.some(r=>r.kind==='host-dequeue'&&r.event.msg===0x100));
  assert(rows.some(r=>r.kind==='host-dequeue'&&r.event.msg===0x101));
  assert.equal(p.r.peekKeyDownState(13),0);
 } else if(mode==='locked')assert.deepEqual([p.words[p.index],p.words[p.index+1]],[198,2]);
 else if(mode==='pending-relative'){
  assert.deepEqual([p.words[p.index],p.words[p.index+1]],[0,0]);
  assert(!rows.some(r=>r.kind==='renderer-entry'&&r.method==='handleMouseMove'),'pending capture suppresses absolute move');
 }
 else assert.deepEqual([p.r._mouseX,p.r._mouseY],[576,447]);
 // Independently simulate the existing guest FIFO consumer, never the observer.
 const tail=p.words[p.index+3]>>>0;p.words[p.index+2]=tail;timer[0]();
 if(tail)assert(rows.some(r=>r.kind==='guest-fifo-drain'&&r.payloads===null));
 alive=false;timer[0]();assert.equal(o.snapshot().active,false);
 assert.throws(()=>o.begin({id:'later',label:'later',previous:image}),/inactive/);
 assert.equal(Object.hasOwn(p.r,'takeInput'),false,'restore original prototype method');
 reports.push({mode,key,rows:rows.length,delivered:delivered.map(e=>({msg:e.msg,wParam:e.wParam})),nativeKeys,
  guestDecision:'UNKNOWN; no toy keyboard or authored menu-success proof'});
}
(async()=>{
 if(process.env.Q3_OFFLINE_PUBLICATION){
  const publication=JSON.parse(fs.readFileSync(process.env.Q3_OFFLINE_PUBLICATION));
  assert.equal(publication.realSessionRequest,true);assert.equal(publication.value.command.holdMs,150);
  assert.equal(publication.value.command.waitMs,1000);
  await control('pending-relative',true,publication);
 }
 await control('absolute');await control('pending-relative');await control('locked');await control('pending-relative',true);
 // Execute the exact pre-navigation script emitted by the generated consumer.
 const p=m.exports.page(false),intervals=[],consoleRows=[];
 p.document.removeEventListener=()=>{};
 const app=p.scope.runningApps[0];Object.assign(app.wine,{memory:p.memory,guestWorker:{link:{module:{},worker:{}}}});
 Object.assign(p.scope,{performance,RegionMap:require('../lib/region-map.generated'),setInterval:f=>{intervals.push(f);return intervals.length;},
   clearInterval(){},addEventListener(){},console:{debug:(...a)=>consoleRows.push(a)}});
 vm.runInContext(current.inputObservationPageSource(),p.scope);
 assert.equal(p.scope.__q3BoundInput,undefined);intervals[0]();
 assert(p.scope.__q3BoundInput,'actual pre-navigation arm: '+JSON.stringify(consoleRows));
 assert(p.scope.__q3BoundInput.snapshot().active,'actual pre-navigation arm');
 assert(consoleRows.some(v=>v[0]==='Q3_BOUND_INPUT'&&JSON.parse(v[1]).kind==='observer-arm'));
 const captureStart=generated.indexOf('async function captureImpl('),captureEnd=generated.indexOf('\nasync function capture(',captureStart);
 assert(captureStart>0&&captureEnd>captureStart);
 const saves={},ctx={assert,fs:{existsSync:()=>false,writeFileSync(){}},out:'/controlled',checkTerminal(){},
   trace:{span:(_,f)=>f()},state:async()=>({}),save:(n,v)=>saves[n]=v,latest:null,
   chain:{capture:async()=>({png:Buffer.from('controlled'),capture:image})},evaluate:p.evaluate,console:{log(){}}};
 vm.createContext(ctx);vm.runInContext(generated.slice(captureStart,captureEnd)+';globalThis.run=captureImpl',ctx);
 await ctx.run(image.label);assert(saves['startup-observer.json'].active);
 // Binding refusal happens before markDispatch/native input in the exact body.
 p.scope.__q3BoundInput.stop('test-owner-cancel');
 let marked=0,sent=0;
 const refuse={...ctx,root,deadline:Date.now()+60000,latest:image,process:{env:{}},
   fs:{readFileSync:()=>JSON.stringify({...image,review:'controlled review'})},sha:()=>image.sha256,
   chain:{admit:async(_,f)=>f({live:{identity:image.identity}})},send:async()=>sent++,
   require:n=>n==='./ordinary-keys.cjs'?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/ordinary-keys.cjs'):require(n)};
 await assert.rejects(m.exports.body(generated,refuse)({id:'no',action:'key',key:'Enter',holdMs:50,waitMs:0,reviewRef:image.label,label:'after'},()=>marked++),/inactive/);
 assert.equal(marked,0);assert.equal(sent,0);
 // The retained publication caller takes review TEXT and constructs the
 // capture-bound object itself. The live malformed nested object must remain
 // a refusal before observer binding, markDispatch or any native CDP input.
 const malformed={...refuse,fs:{readFileSync:()=>JSON.stringify({...image,review:{...image,review:'nested object is invalid'}})}};
 await assert.rejects(m.exports.body(generated,malformed)({id:'bad-review',action:'key',key:'Enter',holdMs:150,waitMs:1000,reviewRef:image.label,label:'after'},()=>marked++),/trim is not a function/);
 assert.equal(marked,0);assert.equal(sent,0);
 // Real generated caller refuses missing/inactive observer before mark or input.
 process.env.Q3_BOUND_INPUT_OBSERVATION='1';
 assert.throws(()=>current.composeInputObservation('invalid'),/seam/);
 delete process.env.Q3_BOUND_INPUT_OBSERVATION;
})().catch(e=>{console.error(e);process.exitCode=1;}).then(()=>{
 if(!process.exitCode){console.log(JSON.stringify({passed:true,reports}));}
});

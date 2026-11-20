'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGroup,validate,createTaskGuard}=require('../tools/gltron-manual-native-gesture.cjs');
const cp=require('node:child_process'),{once}=require('node:events');
test('actual compiled release child old empty success versus explicit body READY and independent UP',async()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
 const {WebSocketServer}=require('../ops/node_modules/ws');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gltron-release-api-'));
 const server=new WebSocketServer({host:'127.0.0.1',port:0}),events=[];
 await once(server,'listening');
 server.on('connection',socket=>socket.on('message',data=>{
  const v=JSON.parse(data);events.push(v);
  socket.send(JSON.stringify({id:v.id,...(v.sessionId?{sessionId:v.sessionId}:{}),result:v.method==='Target.attachToTarget'?{sessionId:'release-page'}:{}}));
 }));
 const controller=path.resolve(__dirname,'../tools/gltron-browser-controller.cjs');
 const helper=path.resolve(__dirname,'../tools/gltron-release-entrypoint.cjs');
 const token=fs.readFileSync('/proc/'+process.pid+'/stat','utf8').split(') ').at(-1).split(' ')[19];
 const reports=[];
 try{
  for(const fixed of [false,true]){
   const out=path.join(dir,fixed?'fixed':'old');fs.mkdirSync(out);
   const file=out+'/config.json';
   fs.writeFileSync(file,JSON.stringify({pid:process.pid,startToken:token,url:'ws://127.0.0.1:'+server.address().port,targetId:'exact-page',keys:['Space'],name:'preflight'}));
   // Compile the actual module with its original filename, preserving imports
   // while reproducing the library wrapper's require.main mismatch.
   const source=`const fs=require('node:fs'),Module=require('node:module');const filename=${JSON.stringify(controller)};const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(require('node:path').dirname(filename));m._compile(fs.readFileSync(filename,'utf8'),filename);module.exports=m.exports;`;
   const entry=out+'/release.cjs';fs.writeFileSync(entry,source+(fixed?`require(${JSON.stringify(helper)}).runLocalRelease(process.argv[2],process.argv[3],()=>m.exports.release).catch(e=>{console.error(e);process.exitCode=1;});`:''));
   const start=events.length,child=cp.spawn(process.execPath,[entry,out,file],{stdio:['pipe','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',b=>{
    stdout+=b;if(fixed&&stdout.includes('\n')&&!child.stdin.writableEnded){const ready=JSON.parse(stdout.trim());assert(ready.armed);child.stdin.end(JSON.stringify({at:ready.at+80})+'\n');}
   });child.stderr.on('data',b=>stderr+=b);
   const hard=setTimeout(()=>child.kill('SIGKILL'),5000);
   const [code,signal]=await once(child,'close');clearTimeout(hard);
   assert.equal(code,0,stderr);assert.equal(signal,null);assert(child.stdout.readableEnded&&child.stderr.readableEnded);
   if(fixed){
    assert(JSON.parse(stdout.trim()).armed,'actual body READY');
    const up=JSON.parse(fs.readFileSync(out+'/preflight-up.json'));assert(up.independent&&up.state==='ACK');
    assert.deepEqual(events.slice(start).map(v=>v.method),['Target.attachToTarget','Input.dispatchKeyEvent','Target.detachFromTarget']);
    assert.deepEqual(events[start+1].params,{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});assert.equal(events[start+1].sessionId,'release-page');
   }else{assert.equal(stdout,'');assert.equal(events.length,start);assert(!fs.existsSync(out+'/preflight-up.json'));}
   reports.push({fixed,code,signal,stdout,stderr,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,requests:events.slice(start)});
  }
  console.log('actual-release-child-preflight '+JSON.stringify(reports));
 }finally{
  for(const client of server.clients)client.terminate();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});
 }
});
function fixture(fault,options={}){
 const completedAt=Date.now(),image={completedAt,sha256:'a'.repeat(64)};
 const choice={startingPause:true,chosenAt:completedAt,review:'Authored paused fixture; explicitly resume, left, right, pause',steps:[]};
 choice.steps=['Space','ArrowLeft','ArrowRight','Space'].map((key,i)=>({key,domCode:key,code:{Space:32,ArrowLeft:37,ArrowRight:39}[key],kind:'key',ms:50,delayMs:0,mode:'game',nonce:'n'+i,name:'action-'+i,imageSHA256:image.sha256,reviewedAt:choice.chosenAt,review:choice.review}));
 const arms=[],downs=[],finishes=[],cancels=[],calls=[],proofs=new Map();let closed=0;
 const releases=choice.steps.map((step,i)=>({alive:true,async arm(){arms.push(i);const at=Date.now();return {at,fallback:at+1750,releaseDue:at+1500};},due(){},cancel(){cancels.push(i);},async finish(){finishes.push(i);if(fault==='release'&&i===1)throw Error('authored UP failure');return {ok:true};}}));
 const group=createGroup({equivalence:options.equivalence,releases,fence:async()=>{},close:()=>closed++,
  page:async(method,arg)=>{calls.push(method);if(method==='prepare'||method==='prepareEquivalent'){proofs.set(arg.nonce,arg);return {prepared:{state:'PREPARED'}};}
    const step=proofs.get(arg),i=choice.steps.findIndex(s=>s.nonce===arg);
    if(i===1&&fault==='focus')throw Error('native focused owner changed');
    if(i===1&&fault==='mixed')return {state:'CANCELLED',reason:'native failure'};
    return {nonce:arg,state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',nativeMessage:{consumption:'owner-user-return',token:i+1,msg:0x100,wParam:step.code}};},
  dispatch:async (step,publish)=>{assert.equal(arms.length,4,'all UPs prearmed before any DOWN');
    if(options.equivalence){options.equivalence.fence(options.equivalence.handles[choice.steps.findIndex(s=>s.nonce===step.nonce)],step,image);publish();}
    downs.push(step.code);return {};}});
 return {group,choice,image,releases,arms,downs,finishes,cancels,calls,get closed(){return closed;}};
}
test('short explicit group preserves choice and four separate native receipts',async()=>{
 const f=fixture();const promise=f.group.gesture(f.choice,f.image);f.choice.steps[1].key='ArrowRight';
 const result=await promise;assert.equal(result.choice.steps[1].key,'ArrowLeft');assert.equal(result.results.length,4);
 assert.deepEqual(f.downs,[32,37,39,32]);assert.deepEqual(f.finishes,[0,1,2,3]);assert.equal(f.closed,0);
 await assert.rejects(f.group.gesture(result.choice,f.image),/never replayed/);
});
// Exercise the complete group -> strict controller -> final socket callback.
// These authored transport controls do not claim native USER qualification.
for(const fault of [null,'delayed-capture','release-race','fallback','cancel','wrong-target','mixed-ACK'])test('strict final socket ordering '+(fault??'publication-relative UP'),async()=>{
 const {createStrictController}=require('../tools/gltron-manual-native-gesture.cjs');
 const f=fixture(),intent=f.choice.steps[0],image=f.image,events=[];
 let ctl,armReceipt,alive=true,downs=0,cancelled=0,consumed=0,closed=0;
 const a={capability:'native-whole-frame-equivalence-v1',validate(){},
   async beforeDown(){events.push('pre-capture');},consume(){consumed++;}};
 const release={get alive(){return alive;},async arm(){const at=Date.now();return armReceipt={at,fallback:at+1750,releaseDue:at+1500};},
   due(nonce,at){events.push('due');assert.equal(nonce,intent.nonce);assert(at>=Date.now()+intent.ms-2);},
   cancel(){cancelled++;},async finish(){events.push('UP');return {ok:true};}};
 ctl=createStrictController({equivalence:a,release,close(){closed++;},page:async method=>{
   if(method==='prepareEquivalent'){events.push('prepare');if(['wrong-target','mixed-ACK'].includes(fault))throw Error(fault);return {prepared:{state:'PREPARED'}};}
   return {nonce:intent.nonce,state:'CONSUMED',consumed:true,receiptBoundary:'owner-worker-native-user-return',nativeMessage:{consumption:'owner-user-return',token:1,msg:0x100,wParam:intent.code}};
 },dispatch:async(edge,publish)=>{
   events.push('socket-capture');
   if(fault==='delayed-capture'){const until=Date.now()+510;while(Date.now()<until){};}
   if(fault==='release-race')alive=false;
   if(fault==='fallback'){armReceipt.at=Date.now()-1800;armReceipt.fallback=armReceipt.at+1750;armReceipt.releaseDue=armReceipt.at+1500;}
   if(fault==='cancel')ctl.close('cancel during final capture');
   // The actual transport calls this after complete capture and synchronous
   // retention, immediately before the socket send, with no intervening await.
   publish();events.push('DOWN');downs++;return {};
 }});
 if(fault){await assert.rejects(ctl.gesture(intent,image,{}));assert.equal(downs,0);assert.equal(cancelled,1);assert.equal(closed,1);}
 else{await ctl.gesture(intent,image,{});assert.equal(downs,1);assert.deepEqual(events,['pre-capture','prepare','socket-capture','due','DOWN','UP']);}
 assert.equal(consumed,1);
});
// Real OS child termination controls. The endpoint above is still a mock;
// these establish cancellation/cleanup custody, never native USER consumption.
for(const mode of ['before-down','during-prepare','during-status'])test('actual task guard termination '+mode,async()=>{
 const f=fixture(),guardChild=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','pipe','pipe']});
 await once(guardChild,'spawn');
 const joined=once(guardChild,'close');guardChild.stdout.resume();guardChild.stderr.resume();
 const guard=createTaskGuard({child:guardChild,close:r=>f.group.close(r)});
 const ups=[],children=[];
 for(const [i,p] of f.releases.entries()){
   const original=p.arm;
   p.arm=async(...args)=>{
     const receipt=await original(...args);
     const child=cp.spawn(process.execPath,['-e','setTimeout(()=>console.log("UP"),100)'],{stdio:['ignore','pipe','pipe']});
     let output='';child.stdout.on('data',b=>output+=b);child.stderr.resume();
     const done=new Promise(resolve=>child.once('close',(code,signal)=>{assert.equal(code,0);assert.equal(signal,null);assert.equal(output.trim(),'UP');assert(child.stdout.readableEnded&&child.stderr.readableEnded);ups.push(i);resolve();}));
     children.push(done);p.finish=async()=>{f.finishes.push(i);await done;return {ok:true};};return receipt;
   };
 }
 let requests=0,after=0,downs=0,killed=false;
 async function kill(){killed=true;guardChild.kill('SIGTERM');await once(guardChild,'exit');assert(guard.terminal);}
 const releases=f.releases;
 const group=createGroup({releases,fence:async()=>guard.check(),close:()=>{},
   page:async method=>{guard.issue(()=>{requests++;if(killed)after++;});
     if((mode==='during-prepare'&&method==='prepare')||(mode==='during-status'&&method==='status')){await kill();group.close('actual task guard exited');}
     return method==='prepare'?{prepared:{state:'PREPARED'}}:{state:'PENDING'};
   },dispatch:()=>guard.issue(()=>{downs++;return {};})});
 // Both the group and transport share the same terminal authority.
 guardChild.once('exit',()=>group.close('actual task guard exit'));
 try{
   if(mode==='before-down')await kill();
   await assert.rejects(group.gesture(f.choice,f.image));
   assert.equal(after,0);assert.equal(downs,mode==='during-status'?1:0);
   const issued=requests;
   for(let i=0;i<32;i++)assert.throws(()=>guard.issue(()=>requests++),/CANCELLED/);
   await assert.rejects(group.gesture(f.choice,f.image));assert.equal(requests,issued);
   await Promise.all(children);assert.equal(ups.length,children.length);
   assert.equal(children.length,mode==='before-down'?0:4);
   await joined;
 }finally{if(guardChild.exitCode===null&&guardChild.signalCode===null)guardChild.kill('SIGKILL');await joined;}
});
test('actual spawn error permanently refuses ordinary transport',async()=>{
 const child=cp.spawn('/nonexistent-gltron-task-guard',[],{stdio:'pipe'}),joined=once(child,'close').catch(()=>{});
 let closed=0,requests=0;
 const guard=createTaskGuard({child,close:()=>closed++});
 await new Promise(resolve=>child.once('error',resolve));
 assert(guard.terminal);assert.equal(closed,1);
 assert.throws(()=>guard.issue(()=>requests++),/CANCELLED/);assert.equal(requests,0);await joined;
});
for(const fault of ['focus','mixed','release'])test(fault+' retains partial ACKs and joins every prearmed release',async()=>{
 const f=fixture(fault);await assert.rejects(f.group.gesture(f.choice,f.image),error=>{
   assert(error instanceof AggregateError);assert.equal(error.partial.results.length,1);
   assert.equal(error.partial.results[0].proof.nonce,'n0');return true;
 });
 assert.equal(f.closed,1);assert.deepEqual(f.downs,[32,37]);assert.deepEqual(f.finishes,[0,1,2,3]);assert.deepEqual(f.cancels,[2,3]);
 const n=f.calls.length;await assert.rejects(f.group.gesture(f.choice,f.image));assert.equal(f.calls.length,n,'zero calls after closure');
});
test('unreviewed, wrong key, stale and non-short choices never arm',async()=>{
 for(const mutate of [f=>f.choice.chosenAt--,f=>f.choice.steps[1].code=65,f=>f.choice.steps[1].ms=151,
   f=>f.image.completedAt-=5001,f=>f.choice.startingPause=false]){
   const f=fixture();mutate(f);await assert.rejects(f.group.gesture(f.choice,f.image));assert.equal(f.arms.length,0);
 }
 const f=fixture();assert.doesNotThrow(()=>validate(f.choice,f.image));
});
// These are controller delegation controls, not native capture/USER evidence.
function authority(){
 const handles=Array.from({length:4},()=>Object.freeze({})),used=new Set(),events=[];
 return {handles,used,events,capability:'native-whole-frame-equivalence-v1',
  validate(p,intent,image){assert(handles.includes(p)&&!used.has(p),'forged/used private proof');assert.equal(intent.imageSHA256,image.sha256);events.push('validate');},
  async beforeDown(p){assert(!used.has(p));events.push('beforeDown');},
  fence(p){assert(!used.has(p));events.push('socket');},
  consume(p){assert(!used.has(p));used.add(p);events.push('consume');}};
}
test('explicit private proofs delegate every edge to qualified controller and final fence',async()=>{
 const a=authority(),f=fixture(null,{equivalence:a});f.image.completedAt-=6000;
 assert.throws(()=>validate(f.choice,f.image),/expired/,'unchanged direct five second path');
 const result=await f.group.gesture(f.choice,f.image,a.handles);
 assert.equal(result.results.length,4);assert.equal(a.used.size,4);
 assert.equal(f.calls.filter(m=>m==='prepareEquivalent').length,4);assert(!f.calls.includes('prepare'));
 assert.deepEqual(a.events.filter(e=>e!=='validate'),Array(4).fill(['beforeDown','socket','consume']).flat());
 assert.equal(result.initialFrame.completedAt,f.image.completedAt,'original source time preserved');
 assert.equal(result.choice.chosenAt,f.choice.chosenAt,'original personal review preserved');
});
test('opt-in alone never bypasses direct review; copied proofs close before any arm',async()=>{
 for(const variant of ['missing','copied','duplicate','short']){
  const a=authority(),f=fixture(null,{equivalence:a});f.image.completedAt-=6000;
  let proofs=variant==='missing'?undefined:variant==='copied'?a.handles.map(p=>({...p})):
   variant==='duplicate'?Array(4).fill(a.handles[0]):a.handles.slice(1);
  await assert.rejects(f.group.gesture(f.choice,f.image,proofs));assert.equal(f.arms.length,0);assert.equal(f.downs.length,0);
  if(variant!=='missing'){assert(f.group.terminal);assert.equal(f.closed,1);}
 }
});
test('changed whole frame at final fence issues zero DOWN and joins all prearmed UPs',async()=>{
 const a=authority();a.fence=()=>{throw Error('whole-frame RGBA differs');};
 const f=fixture(null,{equivalence:a});await assert.rejects(f.group.gesture(f.choice,f.image,a.handles));
 assert.equal(f.downs.length,0);assert.deepEqual(f.finishes,[0,1,2,3]);assert.deepEqual(f.cancels,[0,1,2,3]);
 assert(f.group.terminal);const n=f.calls.length;await assert.rejects(f.group.gesture(f.choice,f.image,a.handles));assert.equal(f.calls.length,n);
});

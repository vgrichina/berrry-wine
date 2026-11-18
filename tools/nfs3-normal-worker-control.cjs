'use strict';
// NFS preparation profile: retain the published observer's boundaries, cadence,
// capacity and field set. This installs no debug hook or additional guest poll.
const {createObserver,install,fields}=require('./nfs3-consumer-scheduling-observer.cjs');
function bootstrap(){
  return `;(function(){const fields=${JSON.stringify(fields)};${createObserver.toString()}\n${install.toString()}\nconst o=createObserver({game:true,translate:(...a)=>globalThis.memUtils.g2w(...a)});install(o);globalThis.nfs3SchedulingReport=()=>o.report();})();\n`;
}
function validateReport(report){
  const assert=require('node:assert/strict');
  assert.equal(report.debugStrategyChanged,false);assert.equal(report.extraGuestPolls,0);
  assert.equal(report.guestWrites,0);assert.equal(report.intervalMs,100);
  assert.equal(report.capacity,4096);assert.deepEqual(report.errors,[]);
  assert(report.hosts.length>0&&report.count>0);assert(report.rows.length<=4096);
  for(const row of report.rows){
    assert(['run-enter','run-exit','get_ticks','gpu_stream_kick'].includes(row.phase));
    assert.deepEqual(row.fields.map(pair=>pair[0]),fields);
    assert(row.fields.every(pair=>Number.isInteger(pair[1])&&pair[1]>=0&&pair[1]<=0xffffffff));
  }
  return {samples:report.count,retained:report.rows.length,samplingMs:report.observerMs,
    costExcludes:'wrapper, aggregation, scheduling and report serialization',
    timingConclusion:'sequential shared-host times do not isolate observer cost',
    nativePredicateBranchMeasured:false};
}
async function guardedKey({page,browser,out,key,code,review,holdMs=250}){
  const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
  assert(['ArrowUp','ArrowLeft','ArrowRight','Escape','Enter'].includes(key));
  assert.equal(code,({ArrowUp:38,ArrowLeft:37,ArrowRight:39,Escape:27,Enter:13})[key]);
  assert(Number.isInteger(holdMs)&&holdMs>=100&&holdMs<=500);
  assert(review&&Date.now()-review.at>=0&&Date.now()-review.at<15000&&/^[a-f0-9]{64}$/.test(review.sha256)&&review.text?.trim());
  const nonce=crypto.randomUUID(),pid=browser.process().pid;
  const token=()=>{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8');return s.slice(s.lastIndexOf(')')+2).split(' ')[19];};
  const config={url:browser.wsEndpoint(),target:page.target()._targetId,pid,startToken:token(),key,code,holdMs,file:out+'/'+nonce+'-release.json'};
  const session=await page.createCDPSession();
  const within=async(p,ms)=>{let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('UNKNOWN bounded browser operation')),Math.max(1,ms));})]);}finally{clearTimeout(t);}};
  const child=cp.fork(__filename,['release'],{silent:true});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const wait=new Promise(resolve=>child.once('close',(code,signal)=>resolve({pid:child.pid,code,signal,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr})));
  let result,error,prepared,downAt,confirmationEnd;
  try{
    const armed=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('UNKNOWN independent UP prearm')),1000);child.once('message',m=>{clearTimeout(t);m.armed?resolve(m):reject(Error('UNKNOWN UP prearm'));});child.once('error',reject);});
    child.send(config);const arm=await armed;assert(Date.now()<arm.deadline-50);
    assert.equal(token(),config.startToken);
    confirmationEnd=Date.now()+500;
    prepared=await within(page.evaluate(({nonce,code,review})=>{if(runningApps.length!==1)throw Error('one actual owner required');const w=runningApps[0].wine,g=w._browserNativeInput;if(!globalThis.__nfsBinding)globalThis.__nfsBinding=g.bind();return g.prepare({owner:__nfsBinding.owner,nonce,code,reviewed:true,reviewedAt:review.at,imageSHA256:review.sha256,mode:'game'});},{nonce,code,review}),Math.min(500,arm.deadline-Date.now()-30));
    assert.equal(prepared.state,'PREPARED');assert(Date.now()<arm.deadline-30);
    assert(Date.now()<arm.deadline-30,'prearmed UP deadline before DOWN');downAt=Date.now();
    await within(session.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code}),confirmationEnd-Date.now());
    while(Date.now()<confirmationEnd){result=await within(page.evaluate(n=>runningApps[0].wine._browserNativeInput.status(n),nonce),confirmationEnd-Date.now());
      if(result.state==='CONSUMED')break;if(['CANCELLED','UNKNOWN'].includes(result.state))throw Error('UNKNOWN native DOWN '+JSON.stringify(result));
      await new Promise(resolve=>setTimeout(resolve,5));}
    assert(result?.state==='CONSUMED'&&Date.now()<confirmationEnd,'UNKNOWN native DOWN confirmation');
  }catch(e){error=e;}
  // No dependent browser request follows an UNKNOWN; only this already armed
  // child may issue its single physical UP on the exact original target.
  finally{if(child.connected)child.send({abort:!!error});const released=await wait;
    fs.writeFileSync(out+'/'+nonce+'-operation.json',JSON.stringify({nonce,key,code,review,prepared,downAt,result,error:error?String(error):null,releaseWait:released},null,2));
    if(released.code!==0||!released.stdoutEOF||!released.stderrEOF)error||=Error('UNKNOWN independent UP');}
  if(error)throw error;return result;
}
async function releaseMain(){
 const fs=require('node:fs'),assert=require('node:assert/strict');let armed=false,done=false,timer,config,ws,id=0,session;const pending=new Map();
 const check=()=>{const s=fs.readFileSync('/proc/'+config.pid+'/stat','utf8');assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],config.startToken);};
 const send=(method,params={},sid=session)=>new Promise((resolve,reject)=>{const n=++id,t=setTimeout(()=>{pending.delete(n);reject(Error('UNKNOWN '+method));},1000);pending.set(n,{resolve,reject,t});ws.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});
 async function up(reason){if(done)return;done=true;clearTimeout(timer);const receipt={pid:process.pid,reason,deadline:config.deadline,submittedAt:Date.now(),independent:true};
  try{check();await send('Input.dispatchKeyEvent',{type:'keyUp',key:config.key,code:config.key,windowsVirtualKeyCode:config.code});receipt.ackAt=Date.now();}catch(e){receipt.error=String(e);process.exitCode=1;}
  fs.writeFileSync(config.file,JSON.stringify(receipt,null,2));ws?.close();if(process.connected)process.disconnect();}
 process.on('disconnect',()=>{if(armed)up('controller-loss');});
 process.once('message',async c=>{try{config=c;check();ws=new WebSocket(c.url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.onmessage=m=>{const v=JSON.parse(m.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.t);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}};
   session=(await send('Target.attachToTarget',{targetId:c.target,flatten:true},null)).sessionId;check();config.deadline=Date.now()+c.holdMs;armed=true;timer=setTimeout(()=>up('prearmed-deadline'),c.holdMs);process.send({armed:true,deadline:config.deadline});process.on('message',m=>{if(m.abort)up('failure-cleanup');});
  }catch(e){process.exitCode=1;if(config?.file)fs.writeFileSync(config.file,JSON.stringify({error:String(e),prearm:true}));ws?.close();if(process.connected)process.disconnect();}});
}
module.exports={bootstrap,validateReport,guardedKey};
if(require.main===module&&process.argv[2]==='release')releaseMain();

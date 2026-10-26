 'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const base=path.resolve(__dirname,'..'), evidence=path.join(base,'docs/reviews/civ2-capture-reserve-independent-accept-oct26');
const pins=JSON.parse(fs.readFileSync(path.join(evidence,'pins.json'))), candidate=pins.candidate;
const source=process.env.CIV2_SOURCE || path.join(base,'input');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const name of ['civ2-serial-controller.js','civ2-capture-plan.js'])assert.equal(sha(fs.readFileSync(path.join(source,name))),pins.pins['tools/'+name].sha256);
const {createController,launchController}=require(path.join(source,'civ2-serial-controller.js'));
const {KNOWN_ROUTE}=require(path.join(source,'civ2-capture-plan.js'));
const outputs=path.join(base,'test-output');fs.mkdirSync(outputs,{recursive:true});
let sequence=0;
function config(count=22){
 const outputDir=fs.mkdtempSync(path.join(outputs,'case-'+(++sequence)+'-'));
 return {outputDir,referenceDir:outputDir,sessionId:'independent-'+sequence,plan:{allocationId:'one-task-not-runtime-permission',totalCaptures:count,perImageBytes:128,totalCaptureBytes:count*128,retainedBytes:count*128,width:2,height:2,setupMs:2000,acceptanceMs:2000,cleanupMs:2000,totalMs:6000,cutoff:Date.now()+7000,ackTimeoutMs:250}};
}
const image={width:2,height:2,data:Buffer.alloc(16,7)};
function transport(cfg,reply){
 let count=0,seen=[],stopped=false;
 const timer=setInterval(()=>{
  const file=path.join(cfg.outputDir,'control-in.jsonl');if(!fs.existsSync(file))return;
  const lines=fs.readFileSync(file,'utf8').trim().split('\n');
  while(count<lines.length){const req=JSON.parse(lines[count++]);seen.push(req);reply(req,ack);}
 },1);
 function ack(req,extra={}){
  const value=req.action==='snapshot'?{frozen:{frozen:true,credits:0}}:req.action==='step'?{ran:req.n,frozen:true}:{};
  fs.appendFileSync(path.join(cfg.outputDir,'guest.log'),'[ctl] '+JSON.stringify({id:req.id,ok:true,value,...extra})+'\n');
 }
 return {seen,stop(){if(!stopped)clearInterval(timer);stopped=true;}};
}
const mode=process.argv[2]||'guard';
const results=[];
async function check(name,fn){
 const result=await fn();results.push({name,passed:true,result});
 const record={candidate,productionPins:pins.pins,testSHA256:sha(fs.readFileSync(__filename)),completed:results,remaining:'subsequent independent groups; real production UI and normal quit remain unverified',guestExecuted:false};
 const file=path.join(evidence,'checkpoint-'+mode+'.json');fs.writeFileSync(file+'.tmp',JSON.stringify(record,null,2)+'\n');fs.renameSync(file+'.tmp',file);
 console.log('PASS '+name);
}
(async()=>{
 if(mode==='guard')await check('unchanged20image_real_launch_start_input_guard',async()=>{
  const cfg=config(20);let launches=0,requests=0;
  await assert.rejects(launchController(cfg,{launch:async()=>{launches++;},request:async()=>{requests++;}}),/minimum 22 captures/);
  const c=createController(cfg,{request:async()=>{requests++;}});
  assert.throws(()=>c.start(),/minimum 22 captures/);
  await assert.rejects(c.input('click:1:1'),/inactive\/stopped/);
  assert.equal(launches,0);assert.equal(requests,0);assert(!fs.existsSync(path.join(cfg.outputDir,'control-in.jsonl')));
  assert.equal(KNOWN_ROUTE.length,22);assert.equal(22*2*1024**2,46137344);
  return {launches,requests,minimum:22,imagePlanningBytes:46137344,notRuntimeAdmission:true};
 });
 if(mode==='stream'){
  await check('actual_appendstream_exact_ACK_and_failed_capture_no_replay',async()=>{
   const cfg=config(),c=createController(cfg,{decode:()=>image});c.start();let png=0;
   const t=transport(cfg,(req,ack)=>{
    fs.appendFileSync(path.join(cfg.outputDir,'guest.log'),'[ctl] '+JSON.stringify({id:'unrelated-'+req.id,ok:true,value:{ran:999,frozen:true}})+'\n');
    if(req.action==='png'){png++;fs.writeFileSync(req.path,Buffer.alloc(17));ack(req,{ok:false});}else ack(req);
   });
   try{await assert.rejects(c.capture('language'),/failed\/stale ACK/);const s=c.snapshot();assert.equal(s.attempts,1);assert.equal(s.successes,0);assert.equal(s.chargedBytes,17);assert.equal(s.retainedBytes,17);const n=t.seen.length;
    await assert.rejects(c.capture('language'),/inactive\/stopped/);await assert.rejects(c.step(2),/inactive\/busy/);assert.equal(t.seen.length,n);assert.equal(png,1);
    const fresh=createController({...cfg,sessionId:'different-session'});assert.throws(()=>fresh.start(),/existing task ledger/);
    return {actualRequests:t.seen,ledger:JSON.parse(fs.readFileSync(path.join(cfg.outputDir,'capture-plan.json')))};
   }finally{t.stop();}
  });
  await check('actual_appendstream_duplicate_ACK_rejects_before_png',async()=>{
   const cfg=config(),c=createController(cfg);c.start();const t=transport(cfg,(req,ack)=>{ack(req);ack(req);});
   try{await assert.rejects(c.capture('language'),/duplicate ACK/);assert.equal(t.seen.length,1);assert.equal(c.snapshot().attempts,1);assert.equal(c.snapshot().chargedBytes,128);assert.equal(c.snapshot().uncertainRetainedCaptures,1);return {requests:t.seen,chargedOnce:128};}finally{t.stop();}
  });
  await check('actual_appendstream_step_completion_frozen_zero_stale_image',async()=>{
   for(const failure of ['partial','credits','stale']){
    const cfg=config(),c=createController(cfg,{decode:()=>image});c.start();
    const t=transport(cfg,(req,ack)=>{
     if(req.action==='png')fs.writeFileSync(req.path,Buffer.alloc(17));
     if(req.action==='step')return ack(req,{value:{ran:failure==='partial'?req.n-1:req.n,frozen:true}});
     if(failure==='credits'&&req.action==='snapshot'&&t.seen.some(x=>x.action==='step'))return ack(req,{value:{frozen:{frozen:true,credits:1}}});
     ack(req);
    });
    try{
     const im=await c.capture('language');fs.writeFileSync(path.join(cfg.referenceDir,'reference.png'),Buffer.alloc(17));c.match('reference',im,[[0,0,2,2]]);
     if(failure==='partial')await assert.rejects(c.step(4),/step incomplete/);
     else if(failure==='credits')await assert.rejects(c.step(4),/not frozen zero/);
     else {await c.step(4);assert.throws(()=>c.match('reference',im,[[0,0,2,2]]),/current presented pixels/);}
     await assert.rejects(c.input('click:1:1'));assert(!t.seen.some(x=>x.cmd));
    }finally{t.stop();}
   }
   return {partialStepRejected:true,nonzeroCreditsRejected:true,stalePixelsRejected:true,noInputs:true};
  });
 }
 if(mode==='atomicity')await check('two_controller_start_same_allocation_must_have_one_launcher',async()=>{
  const cfg=config();
  let first=true,secondError,launches=0,secondPromise,one,two;const original=fs.writeFileSync;
  // Deterministic legal process schedule: A pauses just before ledger temp write;
  // B performs its entire start using the actual fs adapter; then A resumes.
  // No check, planner, persistence or filesystem result is removed/faked.
  fs.writeFileSync=function(file,...args){
   if(first&&file===path.join(cfg.outputDir,'capture-plan.json.tmp')){
    first=false;secondPromise=launchController({...cfg,sessionId:'second-session'},{launch:async()=>{launches++;}}).then(c=>{two=c;},e=>{secondError=e.message;});
   }
   return original.call(this,file,...args);
  };
  try{one=await launchController(cfg,{launch:async()=>{launches++;}});}finally{fs.writeFileSync=original;}
  await secondPromise;
  const observation={launches,secondError:secondError||null,firstStarted:one.plan.started,secondStarted:two?.plan.started,ledger:JSON.parse(fs.readFileSync(path.join(cfg.outputDir,'capture-plan.json'))),schedule:'A existence checks; pause before A temp write; B complete actual start and launch; A write+rename and launch'};
  fs.writeFileSync(path.join(evidence,'atomicity-observation.json'),JSON.stringify(observation,null,2)+'\n');
  assert.equal(launches,1,'one task ledger must atomically prevent second controller/launcher ownership');return observation;
 });
})().catch(e=>{fs.writeFileSync(path.join(evidence,'failure-'+mode+'.json'),JSON.stringify({candidate,testSHA256:sha(fs.readFileSync(__filename)),error:e.stack,completed:results,remaining:'STOP source adoption; coordinator repair and fresh affected acceptance; production UI/normal quit unverified'},null,2)+'\n');console.error(e.stack);process.exitCode=1;});

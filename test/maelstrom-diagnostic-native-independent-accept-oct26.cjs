#!/usr/bin/env node
'use strict';
// Offline evidence verifier. Never imports/executes the production fixture or Wasm.
const A = require('node:assert/strict');
const fs = require('node:fs'), z = require('node:zlib'), path = require('node:path');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function saveAtomic(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2));fs.renameSync(file+'.tmp',file);}
const CANDIDATE = '44e344fdb26daab9a07210656597902ba27cb5f7';
const FIXTURE = 'ddb0d889541d32dddd881b168d6a69a85610050c1d56679765cec1c1531c65e2';
const MODULES = {tail:'aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1',compat:'85eaf35e803a55b18992ac6a717ba0fe937e92aa65e71d40f675a5ccec6fa3ab'};
const SCENARIOS = ['errno0','errno4','errno37','wrong-select-return','wrong-native-target','wrong-return-pc','wrong-ebp','unsafe-errno','return-without-call','block-mode','stale-start','foreign-thread','foreign-regbank','postframe','unsafe-caller','uop-mode','code16-mode','nested-call','foreign-thread-ret','foreign-regbank-ret'];
const FIELDS = 'status event token thread regs pre post selectRet parks result nativeEntry callBlock sourceBlock pc esp eax ebp errno caller socketSet timeout rejectReason rejectModes rejectExpectedRet rejectObservedRet rejectPhase rejectCompletions rejectFault rejectActive rejectCapped'.split(' ');
const HEAD=0x7a3362, BASE=0x522000, REGS=0x523c000, ESP=0x7412000;
const LABELS=['select-completion','owned-call','native-errno-call-getptd','nested-getptd-ret','native-errno-ret'];
const START_MODES=['block-mode','uop-mode','code16-mode','stale-start'];
function eq(actual,expected,why){A.deepEqual(actual,expected,why);}
function expectedCapture(s){
  const d=Object.fromEntries(FIELDS.map(k=>[k,0]));
  if(START_MODES.includes(s)){d.status=5;return d;}
  if(s==='wrong-select-return')return {...d,status:5,rejectReason:4,rejectExpectedRet:HEAD,rejectObservedRet:HEAD+64,rejectPhase:3,rejectCompletions:1};
  const pre=s==='unsafe-caller'?0x83edecd:ESP;
  Object.assign(d,{status:2,event:1,token:1,thread:1,regs:REGS,pre,post:pre+24,selectRet:HEAD,result:1});
  if(['foreign-thread','foreign-regbank'].includes(s))return d;
  if(['wrong-native-target','wrong-return-pc','wrong-ebp','return-without-call'].includes(s))return {...d,status:5};
  Object.assign(d,{status:3,event:2,nativeEntry:BASE+0xc430,callBlock:HEAD});
  if(['foreign-thread-ret','foreign-regbank-ret'].includes(s))return d;
  if(['unsafe-errno','unsafe-caller','postframe','nested-call'].includes(s))return {...d,status:5};
  return {...d,status:4,event:3,sourceBlock:BASE+0xc435,pc:HEAD+4,esp:pre+24,eax:0x451008,ebp:1,errno:Number(s.slice(5)),caller:0x40e12a,socketSet:0x4103000,timeout:1000};
}
function expectedSpans(s){
  const spans=[];
  for(const enabled of [false,true]){
    const pc=HEAD+(enabled?0:0x1000),cb=BASE+(enabled?0:0x20000),fd=enabled?0x4a4000:0x494000;
    const sp=enabled?(s==='unsafe-caller'?0x83edecd:ESP):0x7402000,td=enabled?0x451008:0x441008;
    for(const [kind,a,n] of [['head',pc,16],['native-entry',cb+0xc430,9],['synthetic-thread-provider',cb+0x3857,6],['fdset',fd,32],['timeval',fd+64,8],['stack',sp-16,s==='unsafe-caller'?64:512],['errno',td-8,16]])spans.push({enabled,kind,a,n});
  }
  return spans;
}
// x86 derivation: select stdcall pops six words. MOV EBP,EAX; CALL EDI
// pushes head+4. E8 rel32 pushes CRT+0xc435, provider MOV/RET returns td.
// ADD EAX,8; C3 returns head+4, before CMP. Stack origin in records is ESP-32.
function expectedSuccessStates(errno){
  return LABELS.map((label,i)=>{
    const stack=Array(128).fill(0);Object.assign(stack,{4:'head+0',6:'fd+0',9:'tv+0',83:0x40e12a,84:0x4103000,85:1000});
    if(i>=1)stack[9]='head+4';if(i>=2)stack[8]='crt+50229';
    return {label,registers:{eax:[1,1,1,'td+0','td+8'][i],ecx:17,edx:34,ebx:51,esp:['stack+56','stack+52','stack+48','stack+52','stack+56'][i],ebp:i?1:0x123456,esi:68,edi:'crt+50224',eip:['head+0','crt+50224','crt+14423','crt+50229','head+4'][i]},flags:i===4?{op:1,a:'td+0',b:8,res:'td+8',sign_shift:31}:{op:8,a:1,b:0,res:0x1234,sign_shift:31},budget:0,blocks:1,halt:1,yieldReason:0,yieldFlag:0,counts:[i?1:0,0],apiDelta:i?0:1,hosts:[],memory:{stack,fd:[1,0x53000000,0,0,0,0,0,0],tv:[0,0],td:[0x12345678,0,errno,0]}};
  });
}
function labels(s){
  if(START_MODES.includes(s))return [];
  if(s==='wrong-select-return')return LABELS.slice(0,1);
  if(s==='return-without-call')return ['select-completion','unowned-return'];
  if(['foreign-thread','foreign-regbank'].includes(s))return ['select-completion','foreign-owner-call'];
  if(['wrong-native-target','wrong-return-pc','wrong-ebp'].includes(s))return LABELS.slice(0,2);
  if(s==='nested-call')return [...LABELS.slice(0,2),'second-owner-indirect-call'];
  if(['foreign-thread-ret','foreign-regbank-ret'].includes(s))return [...LABELS.slice(0,4),'foreign-owner-outer-ret'];
  return LABELS;
}
function verifyProcess(p,s,backend,api){
  A(p,'missing process receipt');eq(p.exit,0,'process exit');eq(p.reason,null,'process reason');eq(p.reaped,true,'reaped');eq(p.subreaper,true,'subreaper');eq(p.remainingGroup,[],'surviving group');
  A(Number.isInteger(p.pid)&&p.pid>0);A(p.elapsed>=0&&p.elapsed<=60);
  eq(p.wallSeconds,60);eq(p.cpuSeconds,90);eq(p.fileMax,24*1024*1024);eq(p.aggregateLogMax,131072);eq(p.termThenKillSeconds,5);
  A(p.streamBytes.stdout+p.streamBytes.stderr<=131072);eq(p.retained,p.streamBytes.stdout+p.streamBytes.stderr);eq(p.streamBytes.stderr,0);
  const a=p.argv;A(Array.isArray(a));A(a.some(x=>x.endsWith('/test/maelstrom-diagnostic-canonical-native.cjs')));eq(a.at(-1),backend==='compat'?'--compat':s);eq(a.includes('--compat'),backend==='compat');A(a.includes(s));A(a.includes('--max-old-space-size=512'));
  if(api){eq(api.exitCode,0);eq(api.success,true);eq(api.signal,null);for(const k of ['timedOut','oomKilled','launcherFailed','stdoutTruncated','stderrTruncated'])eq(api[k],false,k);eq(api.stderr,'');A(api.commandId&&api.finishedAt);}
}
function verifyRecord(record){
  const {result:r,checkpoint:c,process:p,api,case:id}=record;
  A(r&&c);const backend=id.endsWith('-compat')?'compat':'tail',s=id.slice(0,-backend.length-1);A(SCENARIOS.includes(s));
  eq(r.scenario,s,'scenario identity');eq(r.compat,backend==='compat','backend identity');eq(c.case,id);eq(c.candidate,CANDIDATE);eq(c.fixtureSHA256,FIXTURE);
  eq(r.moduleSHA256,MODULES[backend],'module identity');eq(c.moduleSHA256,MODULES[backend]);eq(r.status,'PASS');eq(c.result,'PASS');
  verifyProcess(p,s,backend,api);
  eq(record.attempt.argv,p.argv,'attempt/process command binding');
  eq(record.stdout,{status:'PASS',scenario:s,errno:r.errno,capture:r.capture,equivalent:r.equivalent,instances:1},'process output/result binding');
  eq(r.nativeInstances,1);eq(r.arenaMiB,512);eq(r.heapMiB,512);eq(r.preflight.moduleSHA256,MODULES[backend]);eq(r.preflight.scenario,s);eq(r.preflight.nativeInstances,0);eq(r.preflight.actualMountArgv,[]);eq(r.preflight.intendedFiles,[]);
  eq(r.preflight.spans,expectedSpans(s),'initialized span identity');
  const success=s.startsWith('errno'),errno=success?Number(s.slice(5)):null;
  eq(r.errno,errno,'errno scenario');eq(r.equivalent,success);eq(c.equivalent,success);
  eq(r.capture,expectedCapture(s),'derived terminal capture');eq(c.capture,r.capture);
  eq(r.on.starting,[0,0]);eq(r.off.starting,[0,0]);eq(r.on.states.map(x=>x.label),labels(s));eq(r.off.states.map(x=>x.label),LABELS);
  // For success, derive complete initialized memory, registers, flags and execution
  // receipts independently; a matching corruption in both lanes still fails.
  if(success){eq(r.on,{states:expectedSuccessStates(errno),starting:[0,0]},'derived ON state');eq(r.off,r.on,'OFF/ON equivalence');}
  if(r.on.states.length){
    const last=r.on.states.at(-1),regs=last.registers;
    if(s==='wrong-native-target'){eq(regs.edi,BASE+0x20000+0xc430);eq(regs.eip,regs.edi);}
    if(s==='wrong-return-pc')eq(last.memory.stack[9],'head+5','actual altered return PC');
    if(s==='wrong-ebp')eq(regs.ebp,0,'actual altered EBP');
    if(s==='unsafe-errno')eq(regs.eax,0,'u32 wrap on unsafe errno address');
    if(s==='postframe'){eq(regs.esp,'stack+60');eq(last.memory.stack[10],'head+4');}
    if(s==='nested-call'){eq(regs.esp,'stack+48');eq(last.memory.stack.slice(8,10),['head+4','head+4']);}
    if(s==='return-without-call'){eq(regs.eip,'head+4');eq(regs.eax,'td+8');eq(last.memory.stack[8],0);}
    if(s==='wrong-select-return')eq(regs.eip,HEAD+64);
    if(['foreign-thread','foreign-regbank'].includes(s)){eq(regs.eip,'crt+50224');eq(regs.esp,'stack+52');}
    if(['foreign-thread-ret','foreign-regbank-ret'].includes(s)){eq(regs.eip,'head+4');eq(regs.esp,'stack+56');eq(regs.eax,'td+8');}
  }
  for(const lane of [r.off,r.on])for(const st of lane.states){eq(st.budget,0);eq(st.blocks,1);eq(st.halt,1);eq(st.yieldReason,0);eq(st.yieldFlag,0);eq(st.counts[1],0,'pre-CMP');eq(st.hosts,[]);eq(st.apiDelta,st.label==='select-completion'?1:0);eq(st.memory.td,[0x12345678,0,success?errno:4,0]);eq(st.memory.fd,[1,0x53000000,0,0,0,0,0,0]);eq(st.memory.tv,[0,0]);}
  const on=r.snapshots.filter(x=>x.enabled),off=r.snapshots.filter(x=>!x.enabled);
  eq(on.map(x=>x.label),labels(s));eq(off.map(x=>x.label),LABELS);A(off.every(x=>x.diag===null&&x.select===null),'disabled snapshots');
  if(on.length){
    eq(on.at(-1).diag,r.capture,'terminal snapshot');
    const sel={started:1,phase:3,token:1,entries:1,parks:0,completions:1,fault:0,capped:0,active:0,api:934,thunk:0x75040f8,thread:1,regs:REGS,pre:s==='unsafe-caller'?0x83edecd:ESP,ret:HEAD+(s==='wrong-select-return'?64:0),post:(s==='unsafe-caller'?0x83edecd:ESP)+24,result:1};
    eq(r.select,sel,'select completion identity/phase');for(const x of on){eq(x.scenario,s);eq(x.select,sel);}
    if(success){
      eq(on.map(x=>[x.diag.status,x.diag.event]),[[2,1],[3,2],[3,2],[3,2],[4,3]],'CALL/RET ownership progression');
      eq(on.map(x=>[x.eip,x.esp]),[[HEAD,ESP+24],[BASE+0xc430,ESP+20],[BASE+0x3857,ESP+16],[BASE+0xc435,ESP+20],[HEAD+4,ESP+24]]);
    }
    if(['foreign-thread','foreign-regbank'].includes(s))eq(on.at(-1).diag,on[0].diag,'foreign CALL inert');
    if(['foreign-thread-ret','foreign-regbank-ret'].includes(s))eq(on.at(-1).diag,on.at(-2).diag,'foreign RET inert');
  }else eq(r.select.phase,0);
  return {case:id,backend,errno,equivalent:success,status:r.capture.status,event:r.capture.event,rejectionReason:r.capture.rejectReason,process:p.pid};
}
function loadRecords(donor,prior){
  const buf=fs.readFileSync(path.join(donor,'remote-evidence.json.gz'));
  eq(sha(buf),'04b7578565363fbffb454832158a57f11f570a6ccbf3b556ff4cde49c3163dba','bundle identity');
  const bundle=JSON.parse(z.gunzipSync(buf));
  const get=n=>{const b=Buffer.from(bundle[n],'base64');return n.endsWith('.gz')?z.gunzipSync(b):b;};
  const json=n=>JSON.parse(get(n));const records=[];
  for(const s of SCENARIOS)for(const backend of ['tail','compat']){
    const id=s+'-'+backend;
    if(id==='errno4-tail'){
      const r=JSON.parse(fs.readFileSync(path.join(prior,'native-result-'+id+'.json')));
      const p=JSON.parse(fs.readFileSync(path.join(prior,'native-1792988851542169373.json')));
      const attempt=JSON.parse(fs.readFileSync(path.join(prior,'native-errno4-tail-attempt.json')));
      const stdout=JSON.parse(fs.readFileSync(path.join(prior,'native-1792988851542169373.stdout')));
      records.push({case:id,result:r,process:p,attempt,stdout,checkpoint:{case:id,candidate:CANDIDATE,fixtureSHA256:FIXTURE,moduleSHA256:MODULES.tail,result:'PASS',capture:r.capture,equivalent:r.equivalent},reused:true});continue;
    }
    const api=JSON.parse(fs.readFileSync(path.join(donor,'api-native-'+id+'.json')));
    const label=JSON.parse(api.stdout.trim().split('\n').at(-1)).label;
    eq(JSON.parse(api.stdout.trim().split('\n').at(-1)).exit,0);
    const c=json('checkpoint-'+id+'.json');
    for(const e of c.evidence){const raw=get(e.path);eq(sha(raw),e.rawSHA256,'checkpoint raw payload');eq(raw.length,e.rawBytes);}
    records.push({case:id,result:json('native-result-'+id+'.json.gz'),checkpoint:c,process:json(label+'.json'),attempt:json('native-'+id+'-attempt.json'),stdout:json(label+'.stdout'),api});
  }
  return records;
}
function mutants(records){
  const positive=records.find(r=>r.case==='errno0-tail'),reject=records.find(r=>r.case==='wrong-select-return-compat');
  const cases=[
    ['module',positive,r=>r.result.moduleSHA256='0'.repeat(64)],
    ['backend',positive,r=>r.result.compat=true],
    ['errno',positive,r=>r.result.capture.errno=37],
    ['return',positive,r=>r.result.capture.pc+=4],
    ['phase',positive,r=>r.result.select.phase=2],
    ['status',positive,r=>r.result.capture.status=5],
    ['missing-process',positive,r=>delete r.process],
    ['failed-process',positive,r=>r.process.exit=1],
    ['not-reaped',positive,r=>r.process.reaped=false],
    ['surviving-process',positive,r=>r.process.remainingGroup=[123]],
    ['wrong-process-case',positive,r=>r.process.argv[r.process.argv.length-1]='errno37'],
    ['failed-api',positive,r=>r.api.success=false],
    ['ON-initialized-span',positive,r=>r.result.on.states[0].memory.stack[10]=1],
    ['OFF-initialized-span',positive,r=>r.result.off.states[0].memory.td[2]=37],
    ['paired-corrupt-span',positive,r=>{r.result.on.states[0].memory.stack[10]=1;r.result.off.states[0].memory.stack[10]=1;}],
    ['preflight-span',positive,r=>r.result.preflight.spans[0].a++],
    ['lazy-flags',positive,r=>r.result.on.states[4].flags.b=4],
    ['CMP-executed',positive,r=>r.result.on.states[4].counts[1]=1],
    ['nested-RET-captured',positive,r=>r.result.snapshots.filter(x=>x.enabled)[3].diag.status=4],
    ['rejection-reason',reject,r=>r.result.capture.rejectReason=1],
    ['rejection-return',reject,r=>r.result.capture.rejectObservedRet=HEAD],
    ['rejection-phase',reject,r=>r.result.capture.rejectPhase=2],
    ['process-output-forgery',positive,r=>r.stdout.capture.errno=37],
    ['process-attempt-mismatch',positive,r=>r.attempt.argv[r.attempt.argv.length-1]='errno37'],
    ['wrong-control-return',records.find(r=>r.case==='wrong-return-pc-tail'),r=>r.result.on.states.at(-1).memory.stack[9]='head+4'],
  ];
  return cases.map(([name,base,edit])=>{const r=structuredClone(base);edit(r);let error;try{verifyRecord(r);}catch(e){error=e.message;}A(error,'mutant escaped: '+name);return {name,rejected:true,error:error.split('\n')[0]};});
}
if(require.main===module){
  const [donor,prior,out]=process.argv.slice(2);A(donor&&prior&&out,'donor ops, prior ops, output directory required');
  const records=loadRecords(donor,prior),accepted=[];
  for(const r of records){try{accepted.push(verifyRecord(r));}catch(e){
    // Preserve unchanged input, independently computed expectations and failure.
    saveAtomic(path.join(out,'first-failure.json'),{decision:'REJECT',case:r.case,error:e.message,expectedCapture:expectedCapture(r.result.scenario),actual:r});throw e;
  }}
  saveAtomic(path.join(out,'checkpoint-records.json'),{candidate:CANDIDATE,fixtureSHA256:FIXTURE,verifierSHA256:sha(fs.readFileSync(__filename)),modules:MODULES,accepted,remaining:['adversarial record mutants','readiness decision/publication']});
  const killed=mutants(records);
  const result={candidate:CANDIDATE,fixtureSHA256:FIXTURE,verifierSHA256:sha(fs.readFileSync(__filename)),accepted,mutants:killed,valid:accepted.length,rejectedMutants:killed.length,nativeInstantiations:0};
  saveAtomic(path.join(out,'independent-tests.json'),result);
  console.log(JSON.stringify({valid:accepted.length,rejectedMutants:killed.length,nativeInstantiations:0}));
}
module.exports={verifyRecord,expectedCapture,expectedSuccessStates,expectedSpans,loadRecords,mutants};

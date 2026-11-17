'use strict';
// Ordinary authored child dialogs, replaced by their guest message loop.
// The Age page has the original native radio/default Next/Cancel shape.
const fs=require('node:fs'),assert=require('node:assert/strict');
function fixture(){
 const b=require('./test-halflife2-multipage-workflow.cjs').fixture({childPages:true,transitionDelayMs:150}),raw=r=>r-0x1000+0x200;
 for(const[r,t]of [[0x27a0,'Authored Agreement'],[0x2580,'Age Verification'],[0x2700,'Choose Destination']]){b.fill(0,raw(r),raw(r+48));b.write(t+'\0',raw(r));}
 let a=raw(0x1500),start=a;
 const w=n=>{b.writeUInt16LE(n,a);a+=2;},d=n=>{b.writeUInt32LE(n>>>0,a);a+=4;},s=t=>{for(const c of t)w(c.charCodeAt(0));w(0);};
 d(0x50000400);d(0);w(5);w(30);w(30);w(240);w(160);w(0);w(0);s('Authored Agreement');
 for(const [id,x,y,cx,cy,style,cls,text]of [
  [100,15,10,210,30,0x50000000,0x82,'To use this authored service you must be age 13 or older.'],
  [3,60,60,170,14,0x50030009,0x80,'I am 13 years of age or older.'],
  [4,60,85,170,14,0x50000009,0x80,'I am under 13 years of age.'],
  [1,100,135,60,15,0x50010001,0x80,'Next >'],
  [2,170,135,60,15,0x50010000,0x80,'Cancel']]){
  a=(a+3)&~3;d(style);d(0);for(const n of [x,y,cx,cy,id,0xffff,cls])w(n);s(text);w(0);
 }
 assert(a<raw(0x1800));b.writeUInt32LE(a-start,raw(0x12a4));return b;
}
module.exports={fixture};
function verify(dir,late=false){
 const path=require('node:path'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json')));
 const bound=read('input-owner'),start=read('agreement-next-intent'),down=read('agreement-next-down');
 assert(read('startup-ready').ready&&down.receipt.consumed);
 assert(down.at<start.confirmationDeadline&&read('agreement-next-up').at<start.physicalUpDeadline);
 const before=read('agreement').snapshot,age=read('age').snapshot;
 assert(age.windows.some(w=>w.title==='Age Verification'));
 assert.notEqual(before.mainHwnd,age.mainHwnd);
 assert.equal(new Set(age.windows.filter(w=>w.controlClass===1).map(w=>w.processId+':'+w.threadId)).size,1);
 assert(age.windows.filter(w=>w.controlClass===1).length===4);
 const name=late?'age-late':'age-cancel',intent=read(name+'-intent'),receipt=read(name+'-down').receipt,up=read(name+'-up');
 assert.equal(intent.owner.owner,bound.owner);
 assert(up.physicalUpACK&&up.at<intent.physicalUpDeadline);
 assert(read(name+'-release-wait').actualWait&&read(name+'-release-wait').stdoutEOF&&read(name+'-release-wait').stderrEOF);
 const wait=read('native-wait');assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF);
 const ledger=fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(ledger.filter(r=>r.action==='guarded-bind').length,1);
 if(late){
  assert.equal(receipt.state,'CANCELLED');assert.equal(receipt.reason,'immutable deadline expired');
  assert.equal(receipt.consumed,false);assert.equal(receipt.handlerApplied,false);
  const unknown=read('PERMANENT-UNKNOWN');assert(unknown.noLaterRequests&&wait.hostCleanup);
  assert(ledger.every(r=>r.at<=unknown.at));
 }else{
  assert(receipt.consumed&&receipt.receiptBoundary==='native-button-dispatch-return');
  assert(read(name+'-down').at<intent.confirmationDeadline);
  assert.equal(receipt.nativeMessage.generation,age.windows.find(w=>w.hwnd==='0x'+receipt.nativeMessage.hwnd.toString(16)).generation);
  assert(read(name+'-completion').elapsedMs<3000);
  assert.equal(read(name+'-observation').outcome,'process-exited');
  assert.equal(read('native-exit').exitCode,0);assert.equal(wait.hostCleanup,false);
  assert(!fs.existsSync(path.join(dir,'PERMANENT-UNKNOWN.json')));
 }
 if(fs.existsSync(path.join(dir,'input-latency.json'))){
  const trace=read('input-latency');assert.equal(trace.dropped,0);assert(trace.passive&&BigInt(trace.selfNs)>0n);
  const events=trace.rows.filter(r=>r.nonce===intent.nonce);
  if(late)assert(!events.some(r=>r.phase==='queue-enqueue'||r.phase==='queue-dequeue'));
  else if(read('reviewed-owner-runner').passiveInputQueueTrace){
   const enqueue=events.find(r=>r.phase==='queue-enqueue'),dequeue=events.find(r=>r.phase==='queue-dequeue');
   assert(enqueue&&dequeue&&BigInt(enqueue.monoNs)<=BigInt(dequeue.monoNs));
   assert.equal(dequeue.state,'QUEUED');
  }
 }
 console.log('PASS actual authored Age '+(late?'expired refusal, independent release, terminal UNKNOWN and cleanup':'Cancel native return, independent release and normal ExitProcess/wait settlement'));
}
module.exports.verify=verify;
async function observerUnit(file){
 const guardModule=require('../lib/cli-guarded-input'),original=guardModule.createGuardedInput;
 const tracer=require('../tools/halflife2-input-latency-trace.cjs').install(file);
 let now=100,effects=0,releases=0;
 const refs={queue:[]},guard=guardModule.createGuardedInput({snapshot:()=>({healthy:true,refs}),
  cleanup:()=>{releases++;},now:()=>now,monotonic:()=>now,diagnostic:null});
 const owner=guard.bind();
 const prepare=nonce=>guard.prepare({...owner,nonce,reviewed:true,deadline:500},{action:'mousedown'});
 const t=prepare('success');const promise=guard.wait(t);
 const receipt=guard.consume(t,()=>{effects++;});
 assert.equal(receipt.consumed,true);assert.equal((await promise).consumed,true);
 assert.equal(guard.release(owner.owner).released,true);assert.equal(releases,1);
 assert.throws(()=>prepare('success'),/nonce already used/);
 const late=prepare('late');now=501;assert.equal(guard.consume(late,()=>{effects++;}).consumed,false);
 assert.equal(guard.status('late').reason,'immutable deadline expired');assert.equal(effects,1);
 guard.close();tracer.flush();tracer.restore();assert.equal(guardModule.createGuardedInput,original);
 const r=JSON.parse(fs.readFileSync(file));assert.equal(r.dropped,0);assert(r.passive&&BigInt(r.selfNs)>0n);
 assert(r.rows.some(r=>r.phase==='guard-consume-enter'&&r.nonce==='late'&&r.state==='QUEUED'));
 assert(r.rows.some(r=>r.phase==='guard-consume-return'&&r.nonce==='late'&&r.state==='CANCELLED'));
 console.log('PASS passive wrapper forwards success, thrown refusal, true expiry, cleanup and restores factory; clocks remain native guard authority');
 const cp=require('node:child_process');
 const check=cp.spawnSync('python3',['-B','-c',`import importlib.util,subprocess
s=importlib.util.spec_from_file_location('h','tools/halflife2-restored-native.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
b=subprocess.check_output(['git','show',h.COMPONENT+':test/run.js']);r=h.input_latency_runner(b)
lines=r.splitlines(True);clean=b''.join(l for l in lines if b"globalThis[Symbol.for('wine.hl2.inputLatency')]" not in l)
assert clean==b
assert r.count(b"?.('queue-enqueue'")==r.count(b"?.('queue-dequeue'")==1
try:h.input_latency_runner(r)
except AssertionError:pass
else:raise AssertionError('duplicated instrumentation accepted')
print('PASS sealed queue instrumentation adds only two observations and refuses duplicate/different anchors')
`],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);process.stdout.write(check.stdout);
}
if(require.main===module){
 if(process.argv[2]==='--observer-unit')observerUnit(process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
 else if(process.argv[2]==='--verify')verify(process.argv[3],process.argv.includes('--late'));
 else fs.writeFileSync(process.argv[2],fixture(),{flag:'wx'});
}

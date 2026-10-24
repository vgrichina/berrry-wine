'use strict';
// Offline source checks and accepted source evaluator only. No Wasm compilation,
// instantiation, original guest, scheduler execution or production source changes.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),path=require('path');
const H=path.resolve(__dirname,'..'),root='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const hook=require(H+'/repo/tools/maelstrom-select-completion-hook.cjs');
const {Model,func,walk}=require(H+'/repo/test/maelstrom-select-hook-model.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(fs.readFileSync(H+'/repo/tools/maelstrom-select-completion-hook.cjs')),'b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930');
const modulePath='/tmp/maelstrom-select-hook-recovered-canonical-native-oct24/ops/select-hook.wasm';
const binary=fs.readFileSync(modulePath);assert.equal(binary.length,1880716);assert.equal(sha(binary),'ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7');
const input=Object.fromEntries(Object.keys(hook.PINS).map(p=>[p,fs.readFileSync(root+'/'+p,'utf8')]));
const transformed=hook.transform(input,{enabled:true})['src/09d-winsock.wat'];
function terminal(ready=1){const m=new Model(transformed,ready,100);m.arm();m.select();return m;}
const controls=[];
function reject(name,f){assert.equal(f().kind,'rejected');controls.push(name);}
{
 const m=terminal(),s=hook.snapshot(m.exports);
 reject('forged completion copy',()=>hook.createOracle(m,m.exports).accept(m,{...s}));
 reject('wrong owner instance',()=>hook.createOracle(m,m.exports).accept({},s));
 const n=terminal();reject('wrong exports instance',()=>hook.createOracle(m,m.exports).accept(m,hook.snapshot(n.exports)));
}
{
 const m=terminal(0);assert.equal(m.mem.get(100),0x53000001,'park leaves stale EAX');
 const s=hook.snapshot(m.exports),o=hook.createOracle(m,m.exports),accepted=o.accept(m,s);
 assert.equal(accepted.kind,'park');assert.equal(s.result,0);assert.equal(s.completions,0);
 reject('park cannot be forged into stale-EAX completion',()=>hook.createOracle(m,m.exports).accept(m,{...s,phase:3,completions:1,parks:0,post:s.pre+24,result:m.mem.get(100)}));
}
const m=terminal(),s=hook.snapshot(m.exports),accepted=hook.createOracle(m,m.exports).accept(m,s);
assert.equal(accepted.kind,'completion');assert.equal(s.result,1);assert.equal(m.mem.get(100),1);
assert.deepEqual([m.g.$yield_reason,m.g.$yield_flag,m.g.$steps],[0,0,9],'actual transformed handler adds no completion fence');
const end=func(transformed,'msc_end');
const writes=walk(end,n=>n[0]==='global.set').map(n=>n[1]);assert(writes.every(n=>n.startsWith('$msc_')));
const calls=walk(end,n=>n[0]==='call').map(n=>n[1]);assert(calls.every(n=>n==='$msc_fail'));
const select=func(transformed,'handle_select');
const nodes=select.filter(n=>Array.isArray(n));
assert.equal(nodes.at(-2)[0],'i32.store');assert.equal(nodes.at(-1)[0],'call');assert.equal(nodes.at(-1)[1],'$msc_end');
const run=input['src/13-exports.wat'];assert(!run.includes('$msc_'),'run has no diagnostic halt check');
assert(run.includes('(br $main)))'));assert(run.includes('(global.set $eip (call $gl32 (local.get $prev_esp))))'));
const runnerPath='/tmp/maelstrom-head-yield-observer-oct24/ops/run.js',runner=fs.readFileSync(runnerPath,'utf8');
assert.equal(sha(runner),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
assert.equal(runner.split('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);').length,2);
const excerpts=[];
function excerpt(p,first,last){const b=fs.readFileSync(p),text=b.toString().split(/(?<=\n)/).slice(first-1,last).join('');assert(Buffer.byteLength(text)<=8192);excerpts.push({path:p,fileSHA256:sha(b),first,last,bytes:Buffer.byteLength(text),sha256:sha(text),text});}
excerpt(H+'/repo/tools/maelstrom-select-completion-hook.cjs',77,105);
excerpt(H+'/repo/tools/maelstrom-select-completion-hook.cjs',134,145);
excerpt(root+'/src/13-exports.wat',149,168);
excerpt(root+'/src/13-exports.wat',315,335);
excerpt(runnerPath,10356,10366);
excerpt('/tmp/maelstrom-select-hook-recovered-canonical-native-oct24/repo/test/maelstrom-select-hook-native.cjs',117,135);
const result={status:'TEMPORAL_GATE_BLOCKED_BEFORE_GUEST',sourceChecksPass:true,controls,modelOnly:true,modelCompletion:{capture:s,accepted,yieldReason:m.g.$yield_reason,yieldFlag:m.g.$yield_flag,steps:m.g.$steps},diagnosticWrites:writes,diagnosticCalls:calls,module:{path:modulePath,bytes:binary.length,sha256:sha(binary)},actualGuestInstances:0,actualGuestRuns:0,actualObservations:[],earliestMissingMilestone:'Guaranteed host capture after completion result storage and before any later guest execution',binding:'createOracle(actualInstance, actualInstance.exports) and snapshot(actualInstance.exports) can bind an actual instance at the host boundary; temporal requirement cannot be guaranteed with unchanged run(1000).',blocker:'msc_end stores diagnostic result/counters but leaves yield_reason=0, yield_flag=0 and steps unchanged. The thunk dispatcher restores the return EIP and branches back to the run loop. A snapshot immediately after synchronous run returns can follow further guest blocks inside the same call. No immutable-module completion fence or host callback is present.',limitations:['No claim that a particular original invocation actually executed later instructions: original guest was never started.','Accepted native run(1) result is reused; no native rerun. It does not qualify unchanged run(1000) capture timing.','No original select arrival, park, completion, fdset/timeval, route/thread/ESP/return observation exists.','No gameplay acceptance or execution defect is inferred.'],excerpts};
fs.writeFileSync(H+'/ops/preflight.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,sourceChecksPass:true,rejectingControls:controls.length,guestInstances:0}));

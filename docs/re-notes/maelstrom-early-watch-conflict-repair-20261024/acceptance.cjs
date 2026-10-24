'use strict';
// Candidate-bound independent regression: actual transformed watch/init/arm/run.
// Controlled exports only; no guest, native module, build, browser, or box.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const assert = require('assert/strict'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(process.argv[2]);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const adapterPath = path.join(root, 'tools/maelstrom-breakpoint-boundary-audit.cjs');
assert.equal(hash(fs.readFileSync(adapterPath)), '06a54af6c2150589b1848c1a5223682b793ead57c34258142bf83acaa6961c80');
const adapter = require(adapterPath);
const dir = path.join(root, 'docs/re-notes/maelstrom-breakpoint-boundary-audit-20261024');
const source = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'historical-runner.js.gz'))).toString();
const wat = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'historical-13-exports.wat.gz'))).toString();
assert.equal(hash(source), adapter.RUNNER_SHA256); assert.equal(hash(wat), adapter.EXPORTS_SHA256);
assert.equal(adapter.transform(source), source, 'disabled transformation byte-identical');
const transformed = adapter.transform(source, {enabled:true, exportsSource:wat});
new vm.Script(transformed);
const span = (s,a,b) => {
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length);
  assert(i>=0 && j>i && s.indexOf(a,i+a.length)===-1, 'unique exact fragment start');
  return s.slice(i,j);
};
const watchWAT=span(wat,'      ;; Watchpoint: break when watched','      ;; EIP breakpoint.');
const bpWAT=span(wat,'      ;; EIP breakpoint.','      ;; EIP hit counters');
for (const text of [watchWAT,bpWAT]) assert(text.includes('(global.set $last_run_halt (i32.const 5))'));
const fragmentSeals = {};
function execute(options={}, text=transformed, enabled=true) {
  const fragments={
    watch:span(text,'  let watchActive = false;','\n  // Arm shadow call-stack'),
    init:enabled?span(text,'  const maelstromBoundaryAudit = ',adapter.anchors.init):'',
    arm:span(text,enabled?'    maelstromBoundaryAudit.beforeArm(':adapter.anchors.arm,'    // --trace-esp: arm range once'),
    run:span(text,'      if (!mainExecutionSuspended())','    } catch (e) {'),
    finish:enabled?'maelstromBoundaryAudit.finish();':''
  };
  if(text===transformed) for(const [k,v] of Object.entries(fragments)) fragmentSeals[k]=hash(v);
  const calls=[], rows=[], snapshotReads=[], watchReads=[]; let bp=0;
  const exports={set_bp:a=>{calls.push(['set_bp',a]);bp=a;}, get_bp_addr:()=>bp,
    set_watchpoint_size:n=>calls.push(['set_watchpoint_size',n]),
    set_watchpoint:a=>calls.push(['set_watchpoint',a]),get_watch_val:()=>0,
    run:n=>{assert.equal(n,1000);calls.push(['run',n]);},
    get_eip:()=>options.nonTarget?0x7a3300:0x7a3366,
    get_last_run_halt:()=>options.wrongHalt?8:5,
    get_eax:()=>0x100,get_esp:()=>0x200,
    guest_read8:a=>{snapshotReads.push(a);return 0;}};
  const ctx={Buffer, instance:{exports},watchAddr:options.watchAddr||0,watchSize:4,watchPrevVal:0,
    WATCH_JS_ONLY:!!options.jsOnly,WATCH_START_BATCH:options.deferred?50000:0,
    readGuestSized:a=>{watchReads.push(a);return 0;},
    process:{stderr:{write:line=>rows.push(JSON.parse(line.slice('[MAELSTROM-BOUNDARY] '.length)))}},
    countAddrs:[],traceAtAddrs:[0x7a3366],traceAtAddr:0x7a3366,TRACE_AT_START_BATCH:36163,TRACE_AT_LIMIT:1,
    getArg:()=> 'eax:4,esp+0x124:12',BATCH_SIZE:1000,breakAddrs:[],batch:36163,
    threadManager:null,mainExecutionSuspended:()=>false};
  let error=null;
  try { vm.runInNewContext(Object.values(fragments).join('\n'),ctx,{timeout:1000}); }
  catch(e) { error=String(e.message); }
  return {options,error,calls,rows,snapshotReads,watchReads};
}
function conflictOracle(r) {
  assert.match(r.error||'',/^MAELSTROM_BOUNDARY_AUDIT: watchpoint configuration conflicts/);
  assert.equal(r.calls.filter(x=>x[0]==='run').length,0,'conflict BEFORE main.run');
  assert.equal(r.calls.filter(x=>x[0]==='set_bp').length,0,'conflict BEFORE breakpoint arming');
  assert.equal(r.snapshotReads.length,0,'conflict BEFORE diagnostic memory reads');
  assert.equal(r.watchReads.length,0,'conflict BEFORE JS-only watch memory read');
  assert.equal(r.rows.length,0,'no halt label or causal claim');
  assert(!r.calls.some(x=>x[0]==='set_watchpoint'&&x[1]===0),'never silently disable watch');
}
const positive=execute(), wrongHalt=execute({wrongHalt:true});
assert.equal(positive.error,null);assert.equal(positive.snapshotReads.length,16);
assert.equal(positive.rows.at(-1).status,'target-observed');
assert.equal(wrongHalt.error,null);assert.equal(wrongHalt.snapshotReads.length,0);
assert.equal(wrongHalt.rows.at(-1).status,'unresolved');
const options=[{watchAddr:0x1000},{watchAddr:0x1000,nonTarget:true},
  {watchAddr:0x1000,deferred:true},{watchAddr:0x1000,jsOnly:true},
  {watchAddr:0x1000,deferred:true,jsOnly:true}];
const conflicts=options.map(o=>execute(o));
const disabled=execute({watchAddr:0x1000,jsOnly:true},source,false);
assert.equal(disabled.error,null);assert.deepEqual(disabled.watchReads,[0x1000]);
assert.equal(disabled.calls.filter(x=>x[0]==='run').length,1);assert.equal(disabled.rows.length,0);
const guard="if (config.watchAddr) fail('watchpoint configuration conflicts with halt-5 EIP-breakpoint attribution');";
assert.equal(transformed.split(guard).length,2);
const reverted=execute({watchAddr:0x1000},transformed.replace(guard,''));
assert.throws(()=>conflictOracle(reverted),'actual reverting mutation must fail acceptance');
assert.equal(reverted.snapshotReads.length,16);assert.equal(reverted.rows.at(-1).status,'target-observed');
const verdicts=conflicts.map(r=>{try{conflictOracle(r);return {pass:true};}catch(e){return {pass:false,assertion:e.message};}});
console.log(JSON.stringify({candidate:'9fcd3188383b18756232580026840522a454358b',
  guestInstantiated:false,adapterSHA256:hash(fs.readFileSync(adapterPath)),runnerSHA256:hash(source),exportsSHA256:hash(wat),
  fragmentSeals,positive,wrongHalt,conflicts,verdicts,disabled,revertingMutationRejected:true,reverted},null,2));
if (!process.argv.includes('--observe')) conflicts.forEach(conflictOracle);

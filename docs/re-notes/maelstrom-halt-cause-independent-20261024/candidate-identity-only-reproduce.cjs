'use strict';
// Execute actual transformed historical runner fragments; no WAT/native execution.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const assert = require('assert/strict'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(process.argv[2]);
const dir = path.join(root, 'docs/re-notes/maelstrom-breakpoint-boundary-audit-20261024');
const adapter = require(path.join(root, 'tools/maelstrom-breakpoint-boundary-audit.cjs'));
const source = zlib.gunzipSync(fs.readFileSync(path.join(dir,'historical-runner.js.gz'))).toString();
const wat = zlib.gunzipSync(fs.readFileSync(path.join(dir,'historical-13-exports.wat.gz'))).toString();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(source), adapter.RUNNER_SHA256); assert.equal(hash(wat), adapter.EXPORTS_SHA256);
assert.equal(hash(fs.readFileSync(path.join(root,'tools/maelstrom-breakpoint-boundary-audit.cjs'))),'d0f2ccd205be29c38598137f0c894486dc694f9de91b855852721b85f998b606');
const transformed = adapter.transform(source,{enabled:true,exportsSource:wat});
const span=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length); assert(i>=0&&j>i); return s.slice(i,j);};
const fragment={
 watch:span(transformed,'  let watchActive = false;', '\n  // Arm shadow call-stack'),
 init:span(transformed,'  const maelstromBoundaryAudit = ', adapter.anchors.init),
 arm:span(transformed,'    maelstromBoundaryAudit.beforeArm(', '    // --trace-esp: arm range once'),
 run:span(transformed,'      if (!mainExecutionSuspended())', '    } catch (e) {'),
 finish:'maelstromBoundaryAudit.finish();'
};
// Source-proven collision: watchpoint is checked before EIP bp; both write 5.
const watchWAT=wat.slice(wat.indexOf('      ;; Watchpoint: break when watched'),wat.indexOf('      ;; EIP breakpoint.'));
const bpWAT=wat.slice(wat.indexOf('      ;; EIP breakpoint.'),wat.indexOf('      ;; EIP hit counters'));
assert(watchWAT.includes('(global.set $last_run_halt (i32.const 5))'));
assert(bpWAT.includes('(global.set $last_run_halt (i32.const 5))'));
function execute(mode){
 const rows=[],reads=[],calls=[]; let bp=0,watch=0;
 const e={set_bp:a=>{bp=a;calls.push(['set_bp',a]);},get_bp_addr:()=>bp,
  set_watchpoint_size:n=>calls.push(['set_watchpoint_size',n]),set_watchpoint:a=>{watch=a;calls.push(['set_watchpoint',a]);},get_watch_val:()=>0,
  // Controlled exports model the two distinct source-proven halt causes.
  run:n=>{assert.equal(n,1000);calls.push(['run',n]); if(mode==='watchpoint')assert.equal(watch,0x1000);},
  get_eip:()=>mode==='non-target-watchpoint'?0x7a3300:0x7a3366,
  get_last_run_halt:()=>mode==='wrong-halt'?8:5,
  get_eax:()=>0x100,get_esp:()=>0x200,guest_read8:a=>{reads.push(a);return 0;}};
 const ctx={Buffer,instance:{exports:e},watchAddr:mode.includes('watchpoint')?0x1000:0,watchSize:4,watchPrevVal:0,WATCH_JS_ONLY:false,WATCH_START_BATCH:0,
  process:{stderr:{write:line=>rows.push(JSON.parse(line.slice('[MAELSTROM-BOUNDARY] '.length)))}},
  countAddrs:[],traceAtAddrs:[0x7a3366],traceAtAddr:0x7a3366,TRACE_AT_START_BATCH:36163,TRACE_AT_LIMIT:1,
  getArg:()=> 'eax:4,esp+0x124:12',BATCH_SIZE:1000,breakAddrs:[],batch:36163,threadManager:null,mainExecutionSuspended:()=>false};
 vm.runInNewContext(Object.values(fragment).join('\n'),ctx,{timeout:1000});
 return {mode,actualModeledHaltCause:mode.includes('watchpoint')?'watchpoint-before-EIP-breakpoint':mode,rows,readCount:reads.length,calls};
}
const positive=execute('breakpoint'),wrong=execute('wrong-halt'),watch=execute('watchpoint'),nonTarget=execute('non-target-watchpoint');
assert.equal(positive.readCount,16);assert.equal(positive.rows.at(-1).status,'target-observed');
assert.equal(wrong.readCount,0);assert.equal(wrong.rows.at(-1).status,'unresolved');
assert.equal(nonTarget.readCount,0);assert.equal(nonTarget.rows[1].haltDecoded,'eip-breakpoint');
// Assert observed defect so this unchanged reproducer remains useful.
assert.equal(watch.readCount,16);assert.equal(watch.rows.find(r=>r.kind==='target').haltDecoded,'eip-breakpoint');
assert.equal(watch.rows.at(-1).status,'target-observed');
console.log(JSON.stringify({reproduced:true,guestInstantiated:false,adapterSHA256:hash(fs.readFileSync(path.join(root,'tools/maelstrom-breakpoint-boundary-audit.cjs'))),runnerSHA256:hash(source),exportsSHA256:hash(wat),fragmentSHA256:Object.fromEntries(Object.entries(fragment).map(([k,v])=>[k,hash(v)])),watchWATSHA256:hash(watchWAT),bpWATSHA256:hash(bpWAT),positiveControl:positive,wrongHaltControl:wrong,watchpointCollision:watch,nonTargetWatchpoint:nonTarget},null,2));
if(process.argv.includes('--acceptance-oracle')) {
 assert.notEqual(watch.rows.find(r=>r.kind==='target')?.haltDecoded,'eip-breakpoint','watchpoint halt must not be positively classified as an EIP-breakpoint halt');
}

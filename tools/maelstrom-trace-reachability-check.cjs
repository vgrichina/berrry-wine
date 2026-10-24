'use strict';
// Offline only: runs isolated runner expressions against mocks, never guest code.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const dir = process.argv[2] || path.resolve(__dirname, '../docs/re-notes/maelstrom-errno-trace-reachability-20261024');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const seals = JSON.parse(read('seals.json'));
for (const [name, expected] of Object.entries(seals)) assert.equal(sha(fs.readFileSync(path.join(dir, name))), expected, name);
const supplemental = JSON.parse(read('supplemental-seals.json'));
for (const [name, expected] of Object.entries(supplemental)) assert.equal(sha(fs.readFileSync(path.join(dir, name))), expected, name);
const excerpts = JSON.parse(read('semantics-excerpts.json'));
const src = Object.fromEntries(excerpts.map(x => [x.id, x.text]));
assert(excerpts.reduce((n,x) => n+Buffer.byteLength(x.text),0) <= 8192);
assert.equal(0x7a2000 + (0x10001366 - 0x10000000), 0x7a3366);
assert.match(read('native-0.txt'), /10001364:.*ff d7.*call\s+\*%edi\n10001366:.*83 38 04.*cmpl/);
assert.match(src.decoder, /i32.const 119/);
assert.match(src.decoder, /local.set \$done \(i32.const 1\)\) \(br \$decode\)/);
assert.match(src.callRegister, /global.set \$eip \(local.get \$target\)/);
assert.match(src.ret, /global.set \$eip \(call \$gl32/);
assert.match(src.ret, /return_call \$branch_end/);
assert.match(src.chainGuard, /i32.eq \(global.get \$eip\) \(global.get \$bp_addr\)/);
assert.match(src.setBreakpoint, /global.set \$bp_addr \(local.get \$addr\)/);
assert.match(src.setBreakpoint, /call \$dbg_recompute/);
assert.match(src.breakpoint, /global.set \$last_run_halt \(i32.const 5\)/);
const arm = src.arm.slice(src.arm.indexOf('    if (traceAtAddr'));
function armCalls(batch, {breaks=[], exported=true}={}) {
  const calls=[];
  const context={batch, traceAtAddr:0x7a3366, breakAddrs:breaks, TRACE_AT_START_BATCH:36163,
    instance:{exports:exported?{set_bp:a=>calls.push(['main',a])}:{}},
    threadManager:{threads:new Map([[1,{instance:{exports:{set_bp:a=>calls.push(['T1',a])}}}]])}};
  vm.runInNewContext(arm,context,{timeout:1000}); return calls;
}
assert.deepEqual(armCalls(36162),[]);
assert.deepEqual(armCalls(36163),[['main',0x7a3366],['T1',0x7a3366]]);
assert.deepEqual(armCalls(36164),[]);
assert.deepEqual(armCalls(36163,{breaks:[0x7a3362]}),[]);
assert.deepEqual(armCalls(36163,{exported:false}),[]);
// Execute the exact logging eligibility expression, independently of mocked arming.
const expression=src.logGate.match(/const shouldLog =\s*([\s\S]*?);/)[1];
function logs(batch,hits,limit=1) {return vm.runInNewContext(expression,{batch,traceAtHits:hits,TRACE_AT_START_BATCH:36163,TRACE_AT_LIMIT:limit},{timeout:1000});}
assert.equal(logs(36162,0),false); assert.equal(logs(36163,0),true);
assert.equal(logs(41999,0),true); assert.equal(logs(36164,1),false);
const command=JSON.parse(read('guest-command.json')), output=read('guest-output.log');
assert(command.argv.includes('--trace-at=0x7a3366'));
assert(command.argv.includes('--trace-at-start-batch=36163'));
assert(command.argv.includes('--trace-at-limit=1'));
assert(command.argv.includes('--trace-at-mem=eax:4,esp+0x124:12'));
assert(!command.argv.some(x=>x.startsWith('--break=') || x.startsWith('--batch-size=')));
assert.match(src.batchDefault, /getArg\('batch-size', '1000'\)/);
assert.equal((output.match(/\[TRACE-AT #/g)||[]).length,0);
const obs=output.split('\n').filter(s=>s.startsWith('[SELECT-OBS] ')).map(s=>JSON.parse(s.slice(13)));
assert.equal(obs.length,4); assert.equal(obs[0].batch,36165);
assert.equal(obs.at(-1).counts[1],972); assert.equal(obs[0].counts[1],0);
assert(obs.every(x=>x.batch>36163 && x.eip===0x75040f8));
const terminal=JSON.parse(read('guest-terminal.json'));
assert.equal(terminal.remainingGroup,false); assert.equal(terminal.returncode,0);
console.log(JSON.stringify({pass:true,offline:true,guestInstantiated:false,sourceSeals:Object.keys(seals).length,recoverySeals:Object.keys(supplemental).length,
  requestedPC:'007a3366',translation:'PASS',callReturnBlockBoundary:'PASS',mockArmAndLogControls:9,
  batchSize:1000,traceRecords:0,postArmSelectReturnCounter:972,
  actualRuntimeReachability:'UNPROVEN',causeOfZeroRecords:'UNKNOWN',errno:null,caller:null,
  qualification:'Mock/source checks are not runtime acceptance; counters do not identify CheckSockets calls.'},null,2));

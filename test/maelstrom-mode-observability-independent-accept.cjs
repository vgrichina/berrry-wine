'use strict';
// Scoped independent acceptance delta. Reuse the exact prior fixture builder,
// not its completed test groups. This is minimal generated Wasm only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const sha = b => createHash('sha256').update(b).digest('hex');
const file = path.join(__dirname, 'maelstrom-mode-switch-observability.test.cjs');
const prior = fs.readFileSync(file, 'utf8');
assert.equal(sha(prior), 'f2f81adddd14639d7a35154fde3c174200e38a8fdafc3d201246ee875fe24c01');
const marker = '// Earliest production boundary first:';
assert.equal(prior.split(marker).length, 2);
const sandbox = {require:createRequire(file), process, console, Buffer,
  WebAssembly, __dirname, module:{exports:{}}};
vm.runInNewContext(prior.slice(0, prior.indexOf(marker)) +
  '\nmodule.exports={build,instance,put,native,diagnostic,mode,hook,setUop,productionStorage,createAdapter,decodeRejection,fixture};',
  sandbox, {filename:file});
const f = sandbox.module.exports;
const plain = x => JSON.parse(JSON.stringify(x));
const checks = [];
function contextOracle(e, from, raw, status) {
  assert.equal(e.mne_status(), 5);
  assert.equal(e.mne_rejectReason(), 15);
  assert.equal(e.mne_event(), status-1);
  assert.deepEqual(plain(f.mode(e)), {rejectRequestedMode:Number(raw!==0),
    rejectLatchedMode:from, rejectPC:0xf1234567, rejectThread:7,
    rejectRegs:0x100, rejectStatus:status});
  // This extra relation distinguishes hook-before from hook-after assignment.
  assert.equal((e.mne_rejectModes() >>> 2) & 1, from,
    'rejectModes must contain the pre-assignment UOP mode');
  assert.equal(e.g_uop_enabled.value, Number(raw!==0));
}
function prepare(module, from, status=1) {
  const e=f.instance(module).exports;f.put(e,'uop_enabled',from);e.mne_start();
  if(status!==1){f.put(e,'mne_status',status);f.put(e,'mne_event',status-1);}
  return e;
}
// Reused unchanged earliest off->on boundary result is in acceptance-checkpoint.
// First new execution challenges the actual shared seam with raw INT_MIN.
const e=prepare(f.fixture,0);e.set_uop(-2147483648);contextOracle(e,0,-2147483648,1);
checks.push('raw INT_MIN normalization and six boundary fields before setter assignment');
const call='(call $mne_uop_switch (i32.ne (local.get $on) (i32.const 0)))';
const assignment='(global.set $uop_enabled (i32.ne (local.get $on) (i32.const 0)))';
assert(f.setUop.indexOf(call)<f.setUop.indexOf(assignment));
const moved=f.hook.once(f.setUop,call,'').replace(assignment,assignment+' '+call);
const late=f.build(f.productionStorage,moved);
const lateE=prepare(late,0);lateE.set_uop(-2147483648);
assert.throws(()=>contextOracle(lateE,0,-2147483648,1),/pre-assignment UOP mode/);
checks.push('executable hook-after-assignment mutant rejected by distinguishing pre-assignment oracle');
// Missing legacy createAdapter challenge: remove all six additive exports.
const legacy=f.instance(), old={...legacy.exports}, rows=[];
for(const k of f.hook.MODE_SWITCH_DIAGNOSTIC_FIELDS)delete old['mne_'+k];
const adapter=f.createAdapter({exports:old},{persist:r=>rows.push(r),readLive:()=>({})});
adapter.start();legacy.exports.set_uop(1);
assert.throws(()=>adapter.observe(0),/native latch status rejection/);
assert.equal(rows.at(-1).historicalNativeRejection.modeSwitch,undefined);
checks.push('actual legacy adapter without any six additive exports persists reason15');
const n=plain(f.native(e)), d=plain(f.diagnostic(e)), s=plain(f.mode(e));
const good=plain(f.decodeRejection(n,d,s));
assert.equal(good.modeSwitch.latchedMode,0);assert.equal(good.modeBits,0);
const invalid={...d,rejectModes:d.rejectModes ^ 4};
let accepted=null, error=null;
try {accepted=plain(f.decodeRejection(n,invalid,s));}catch(ex){error=ex.message;}
// Counterexample reproduction itself must remain distinguishing and executable.
// Same contradictory bit pattern is produced by the moved-hook mutant above.
assert.equal(lateE.mne_rejectModes(), invalid.rejectModes);
assert.equal(error,null,'candidate behavior changed; reassess rejection');
assert.equal(accepted.modeBits,4);assert.equal(accepted.modeSwitch.latchedMode,0);
const result={schema:'maelstrom-independent-acceptance-delta/v1',
  candidate:'ecedf27af96855328756e94ce4172ea9ae522ae0',
  accepted:false, checks, compiledModules:2, boundarySHA256:sha(f.setUop),
  priorFixture:{textSHA256:f.fixture.textSHA256,wasmSHA256:f.fixture.wasmSHA256},
  counterexample:{requirement:'reject inconsistent mode-switch diagnostics',
    native:n,diagnostic:invalid,modeSwitch:s,actual:accepted,expected:'throw invalid native mode-switch diagnostic',
    explanation:'rejectModes UOP bit says pre-assignment mode 1 while rejectLatchedMode says 0; both are accepted'},
  guestExecuted:false,fullTransformQualified:false,originalCausalInstruction:'UNKNOWN'};
console.log(JSON.stringify(result,null,2));
process.exitCode=1; // Semantic acceptance rejection; not a resource/access denial.

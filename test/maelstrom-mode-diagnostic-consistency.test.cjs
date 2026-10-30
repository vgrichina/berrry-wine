'use strict';
// Focused decoder regression. The old independently rejected reproducer remains
// unchanged in the task evidence; its acceptance oracle must not become a pass.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const decoderPath = require.resolve('../tools/maelstrom-original-errno-adapter.cjs');
const repair = '          ((d.rejectModes >>> 2) & 1) !== s.rejectLatchedMode || ';
let adapter = require(decoderPath);
if (process.argv.includes('--remove-repair')) {
  const original = fs.readFileSync(decoderPath, 'utf8');
  assert.equal(original.split(repair).length, 2, 'remove exactly the consistency repair');
  const sandbox = {require:createRequire(decoderPath), module:{exports:{}}};
  vm.runInNewContext(original.replace(repair, ''), sandbox, {filename:decoderPath});
  adapter = sandbox.module.exports;
}
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const native = Object.fromEntries(hook.FIELDS.map(k => [k, k === 'status' ? 5 : 0]));
const diagnostic = Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k => [k, 0]));
Object.assign(diagnostic, {rejectReason:15, rejectModes:4, rejectExpectedRet:8008546});
const modeSwitch = {rejectRequestedMode:1, rejectLatchedMode:0, rejectPC:0xf1234567,
  rejectThread:7, rejectRegs:0x100, rejectStatus:1};
// Exact unchanged counterexample is first; removal must fail at this assertion.
assert.throws(() => adapter.decodeRejection(native, diagnostic, modeSwitch),
  /invalid native mode-switch diagnostic: guard context/,
  'reject contradictory UOP bit when latched mode is OFF');
assert.throws(() => adapter.decodeRejection(native, {...diagnostic,rejectModes:0},
  {...modeSwitch,rejectRequestedMode:0,rejectLatchedMode:1}),
  /invalid native mode-switch diagnostic: guard context/,
  'reject contradictory UOP bit when latched mode is ON');

// Reuse only the pinned fixture definitions, not completed historical groups.
const file = path.join(__dirname, 'maelstrom-mode-switch-observability.test.cjs');
const prior = fs.readFileSync(file, 'utf8');
assert.equal(createHash('sha256').update(prior).digest('hex'),
  'f2f81adddd14639d7a35154fde3c174200e38a8fdafc3d201246ee875fe24c01');
const marker = '// Earliest production boundary first:';
assert.equal(prior.split(marker).length, 2);
const sandbox = {require:createRequire(file), process, console, Buffer,
  WebAssembly, __dirname, module:{exports:{}}};
vm.runInNewContext(prior.slice(0, prior.indexOf(marker)) +
  '\nmodule.exports={instance,put,native,diagnostic,mode,fixture};',
  sandbox, {filename:file});
const f = sandbox.module.exports;
const plain = x => JSON.parse(JSON.stringify(x));
let valid = 0, contradictions = 0;
for (const from of [0,1]) for (const status of [1,2,3]) {
  const e = f.instance().exports;
  f.put(e,'uop_enabled',from); e.mne_start();
  if (status !== 1) {f.put(e,'mne_status',status); f.put(e,'mne_event',status-1);}
  e.set_uop(1-from);
  const n = plain(f.native(e)), d = plain(f.diagnostic(e)), s = plain(f.mode(e));
  const good = adapter.decodeRejection(n,d,s);
  assert.equal(good.modeSwitch.latchedMode,from);
  assert.equal(good.modeSwitch.requestedMode,1-from);
  assert.equal(good.modeSwitch.statusBeforeRejection,status);
  assert.equal((good.modeBits >>> 2) & 1,from);
  valid++;
  // Other diagnostic bits must not be mistaken for the UOP bit.
  for (const other of [0,1,2,3]) {
    assert.equal(adapter.decodeRejection(n,{...d,rejectModes:(from << 2)|other},s)
      .modeSwitch.latchedMode,from);
    assert.throws(() => adapter.decodeRejection(n,
      {...d,rejectModes:((1-from) << 2)|other},s),
      /invalid native mode-switch diagnostic: guard context/);
    contradictions++;
  }
  // Default/null legacy decoder remains additive when all six fields are absent.
  assert.equal(adapter.decodeRejection(n,d).modeSwitch,undefined);
  assert.equal(adapter.decodeRejection(n,d,null).modeSwitch,undefined);
}
for (const from of [0,1]) for (const legacy of [false,true]) {
  const instance = f.instance(), e = instance.exports, rows = [];
  f.put(e,'uop_enabled',from);
  const exports = {...e};
  if (legacy) for (const k of hook.MODE_SWITCH_DIAGNOSTIC_FIELDS) delete exports['mne_'+k];
  const owned = adapter.createAdapter({exports},{persist:r=>rows.push(r),readLive:()=>({})});
  owned.start(); e.set_uop(1-from);
  assert.throws(() => owned.observe(0), /native latch status rejection/);
  assert.equal(rows.at(-1).kind,'rejected');
  if (legacy) assert.equal(rows.at(-1).historicalNativeRejection.modeSwitch,undefined);
  else assert.equal(rows.at(-1).historicalNativeRejection.modeSwitch.latchedMode,from);
}
console.log(JSON.stringify({passed:true,validSwitches:valid,contradictions,
  exactCounterexamples:2,adapterCases:4,compiledModules:1,
  fixture:{textSHA256:f.fixture.textSHA256,wasmSHA256:f.fixture.wasmSHA256},
  fullTransformQualified:false,guestExecuted:false,originalCausalInstruction:'UNKNOWN'}));

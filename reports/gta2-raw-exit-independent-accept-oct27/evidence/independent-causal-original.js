'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');
const crypto = require('crypto');
const root = '/tmp/gta2-raw-exit-independent-accept-oct27/repo';
const fixturePath = root + '/test/test-api-exit-observer.js';
const fixture = fs.readFileSync(fixturePath, 'utf8');
const end = fixture.indexOf('console.log(JSON.stringify({ sourcePath,');
assert(end > 0 && fixture.indexOf('console.log(JSON.stringify({ sourcePath,', end + 1) < 0);
const prefix = fixture.slice(0, end);
const mod = new Module(fixturePath, module);
mod.filename = fixturePath; mod.paths = Module._nodeModulePaths(path.dirname(fixturePath));
mod._compile(prefix + '\nmodule.exports = {host,wiring,known,spans,sourcePath};', fixturePath);
const {host,wiring,known,spans,sourcePath} = mod.exports;
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
console.log(JSON.stringify({fixtureSHA256:hash(fixture),prefixSHA256:hash(prefix),sourcePath,
  runnerSHA256:hash(fs.readFileSync(sourcePath)),spans:spans.map(({bytes,...s})=>s),guest:'explicit stub registers/memory only'}));
const returns = f => f.logs.filter(l=>/^\s*=>/.test(l));
function causal(runner=wiring, value=0x887600ff|0, diagnostics=[123]) {
  const f=host({},runner); f.enter(known.name,true);
  const before=Buffer.from(f.memory.buffer);
  for(const x of diagnostics) {f.h.log_i32(x); assert.equal(returns(f).length,0,'diagnostic is not final result');}
  f.state.eax=value; f.h.log_api_exit();
  const atExit=[...f.logs]; f.state.eax=17;
  const expected=`  => 0x${(value>>>0).toString(16).padStart(8,'0')} (raw EAX; ${known.name})`;
  console.log(JSON.stringify({case:'causal-untyped-672',value,diagnostics,atExit,reads:f.reads}));
  assert.deepEqual(returns(f),[expected],'one authoritative raw EAX with correct identity');
  assert(f.logs[0].startsWith('[API #672] '+known.name+'('));
  assert.equal(f.reads.eax,1); assert.deepEqual(Buffer.from(f.memory.buffer),before);
  f.h.log_api_exit(); assert.deepEqual(f.logs,atExit); assert.equal(f.reads.eax,1);
  return f;
}
causal(); // First independent checkpoint; unchanged oracle also run against original base.
if(process.argv.includes('--causal-only')) process.exit(0);
for(const n of [0,7,0x887600ff,0x887600ff|0,0xffffffff,-1]) {
  causal(wiring,n,[0,123,-1,0xc0de02a0|0,0xcade5000|0,0x111,1,0x100,2,3,4]);
}
console.log('PASS marker-shaped/multiple diagnostics and numeric boundaries');
// Real callbacks have no invocation token: retain current CLI last-entry semantics,
// challenge interleaving with a new, unknown, or filtered entry rather than invent IDs.
for(const espDelta of [false,true]) {
  const f=host({filter:new Set([known.name,'IndependentUnknown']),espDelta});
  f.enter(known.name); f.h.log_i32(5); f.enter('Filtered');
  const reads=f.reads.eax; f.state.eax=-1;f.h.log_api_exit();
  assert.equal(returns(f).length,0); assert.equal(f.reads.eax,reads);
  f.enter('IndependentUnknown');f.h.log_i32(6);f.state.eax=0;f.h.log_api_exit();
  assert.equal(returns(f).length,1);assert(returns(f)[0].includes('IndependentUnknown'));
  assert(f.logs.some(l=>l.startsWith('[API #674] IndependentUnknown')));
}
console.log('PASS new/filtered/unknown last-entry and API sequence semantics');
for(const trace of [false,true]) for(const quiet of [false,true]) for(const paused of [false,true]) {
  const f=host({trace,quiet,paused});
  const off=quiet&&(!trace||paused);
  assert.equal(f.apiLogOff,off);
  if(off) { // Actual WAT dispatch suppresses all callbacks with api_log_on=0.
    assert.deepEqual(f.reads,{eax:0,esp:0,image:0,translate:0});assert.equal(f.logs.length,0);
  } else {
    f.enter(known.name);f.h.log_i32(7);f.state.eax=0;f.h.log_api_exit();
    assert.equal(returns(f).length,trace?1:0); assert.equal(f.reads.eax,trace?1:0);
    if(!trace) assert.deepEqual(f.reads,{eax:0,esp:0,image:0,translate:0});
  }
}
console.log('PASS quiet/paused callback suppression uses existing CLI/WAT log gate');
// Independent omitted-guard controls. These do not change checked-in candidate.
function rejects(name,from,to,oracle) {
  assert.equal(wiring.split(from).length,2);
  const mutated=wiring.replace(from,to);let rejected=false;
  try {oracle(mutated);} catch(e) {if(!(e instanceof assert.AssertionError))throw e;rejected=true;}
  assert(rejected,'oracle rejects '+name);console.log('REJECTED '+name+' sha256='+hash(mutated));
}
rejects('omit exit correlation reset','      lastApiName = null;\n      lastApiEntry = null;\n      lastApiArgs = null;\n      lastApiTraced = false;',
  '      // omitted final correlation reset',r=>causal(r));
rejects('omit traced return guard','if (TRACE_API && lastApiTraced) {\n        const dv',
  'if (TRACE_API) {\n        const dv',r=>{
    const f=host({filter:new Set([known.name]),espDelta:true},r);
    f.enter('Filtered');f.state.eax=-1;f.h.log_api_exit();assert.equal(returns(f).length,0);
  });
console.log('PASS independent affected boundaries; no compiler/game/runtime invoked');

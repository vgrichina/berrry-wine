'use strict';
// Check the shipped title caller composes startup before reviewed gameplay.
// Usage: node tools/lbreakout-first-menu-workflow.test.cjs RUN_DIR
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const helper = require('./lbreakout-case-inspection.cjs');
const ROOT = path.resolve(__dirname, '..');
const runDir = () => { assert(process.argv[2], 'run directory required'); return path.resolve(process.argv[2]); };

test('deadline retains last observation without later protocol', () => {
  const source = fs.readFileSync(path.join(runDir(), 'browser-corrected.cjs'), 'utf8');
  const start = source.indexOf('async function completion(a)');
  assert(start >= 0, 'completion(a) missing');
  const end = source.indexOf('async function bindReady()', start);
  assert(end >= 0, 'bindReady() missing');
  const control = String.raw`
const assert=require('node:assert/strict'),vm=require('node:vm');
let clock=0,reads=0,receipt;
const owner={instance:'original'},observation={token:'startup-startup',expected:0,binding:{generation:1},active:true,phase:'sdl-display-return',lastPC:0x6108fa};
const scope={assert,Date:{now:()=>clock},deadline:2000,terminal:false,
 workers:new Map([['owner',{closed:false}]]),bound:{WORKER_READ:'owner'},
 evaluate:async s=>{assert(!scope.terminal);reads++;return s==='owner'?owner:observation;},
 wait:async()=>{clock=2000;},save:(name,value)=>{receipt={name,value};},fail:()=>{scope.terminal=true;}};
vm.createContext(scope);
vm.runInContext(SOURCE+';globalThis.finish=completion;',scope);
(async()=>{
const arm={session:'owner',owner,token:observation.token,expected:0,binding:observation.binding,deadline:2000};
await assert.rejects(scope.finish(arm),/guest completion deadline/);
assert.equal(receipt.name,'completion-failure-startup-startup.json');
assert.equal(receipt.value.lastObservation,observation);
assert.equal(receipt.value.lastObservation.phase,'sdl-display-return');
assert.equal(reads,2);
await assert.rejects(scope.finish(arm),/terminal/);assert.equal(reads,2);
assert.equal(receipt.value.lastObservation,observation,'terminal reuse preserves first failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
  cp.execFileSync(process.execPath, ['-e', 'const SOURCE=' + JSON.stringify(source.slice(start, end)) + ';' + control], {stdio: 'inherit'});
});

test('actual generated caller', () => {
  const actual = fs.readFileSync(path.join(runDir(), 'browser-corrected.cjs'), 'utf8');
  let base = fs.readFileSync(path.join(ROOT, 'scratch/runs/20261110-lbreakout-bound-owner-gameplay-0045/browser-corrected.cjs'), 'utf8');
  base = helper.pauseWorkflowSource(base).split("await wait(3000);await capture('startup');").join(
    "await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({presented:true}))))');await capture('startup');");
  assert.equal(actual, helper.startupWorkflowSource(base));
  // Python str.index: a missing needle is an error, never -1.
  const index = (needle, from) => { const i = actual.indexOf(needle, from); assert(i >= 0, needle); return i; };
  const arm = index("phase:'startup',expected:0");
  assert(arm < index('await completion(a);', arm));
  assert(arm < index("await capture('startup')"));
  assert(actual.includes("c.completion==='level-start'"));
  assert(actual.includes('assertPaddleCompletion(c)'));
  assert(actual.includes('pauseConfirmed'));
  assert.throws(() => helper.startupWorkflowSource(actual));
});

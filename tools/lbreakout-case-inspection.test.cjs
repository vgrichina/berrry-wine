'use strict';
// Execute the generated inspection with live and terminal case files.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const helper = require('./lbreakout-case-inspection.cjs');
const node = process.execPath;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lb-inspect-'));
const runNode = (source, opts = {}) => cp.execFileSync(node, ['-e', source], {timeout: 3000, encoding: 'utf8', ...opts});

const TEMPLATE = [
  "async function armObservation(){const s=await owningWorker();return evaluate('globalThis.__lbArm()',s);}",
  "if(c.observe){save('observer-arm-'+c.id+'.json',await armObservation());}",
  "     const k=require('./input.cjs').key('p'),{text,...release}=k;",
  "save:r=>save('input-'+c.id+'-'+phase+'.json',r)});",
  "   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});",
].join('\n');
const branch = () => helper.pauseCompletionSource(TEMPLATE).split('let completionArm;')[1].split('     const a=await armObservation')[0];

test('unobserved paddle pulses refuse before any effect', () => {
  runNode("const assert=require('node:assert/strict');\n" + helper.paddleKeyAdmissionSource() + `
let effects=0;
function execute(c){assertPaddleCompletion(c);effects++;}
for(const key of ['ArrowLeft','ArrowRight']){
 for(const observe of [false,true]){
  assert.throws(()=>execute({action:'key',key,observe}),/guest-completion observer/);
  assert.equal(effects,0);
 }
}
for(const key of ['ArrowLeft','ArrowRight','Space']){
 assert.throws(()=>execute({action:'play',key}),/guest-completion observer/);
 assert.equal(effects,0);
}
for(const key of ['p','Space','Enter','ArrowDown','ArrowUp'])execute({action:'key',key});
execute({action:'capture'});execute({action:'quit'});assert.equal(effects,7);
for(const key of ['ArrowLeft','ArrowRight']){
 const c={id:'paddle',action:'key',key,observe:true,completion:'paddle',reviewRef:'ready',holdMs:100};
 execute(c);
 for(const bad of [{observe:false},{holdMs:0},{holdMs:301},{reviewRef:null},{id:null}])
  assert.throws(()=>execute({...c,...bad}),/guest-completion observer/);
}
assert.throws(()=>execute({action:'key',key:'Space',completion:'paddle'}),/one original direction/);
`);
});

test('pause template drift is an offline error', () => {
  assert.throws(() => helper.pauseWorkflowSource('unrecognized caller'), /unsupported bound browser/);
  assert.throws(() => helper.pauseCompletionSource('unrecognized caller'), /unsupported completion template/);
});

test('generated completion preload parses', () => {
  cp.execFileSync(node, ['--check', '-'], {input: helper.pauseCompletionPreloadSource(), timeout: 3000});
});

test('every ordinary Enter arms menu before input', () => {
  runNode(`const assert=require('node:assert/strict');
let arms=0;
async function armObservation(c){arms++;return c;}
async function run(c){let completionArm;
` + branch() + `
return completionArm;}
(async()=>{
 const c={id:'local-menu',action:'key',key:'Enter',reviewRef:'reviewed-main',holdMs:80};
 for(const observe of [undefined,false,true]){
  const a=await run({...c,observe});assert.equal(a.phase,'menu');assert.equal(a.expected,13);
 }
 assert.equal(arms,3);
 for(const bad of [{id:null},{reviewRef:null},{holdMs:0},{holdMs:301}])await assert.rejects(run({...c,...bad}),/menu Enter command binding/);
 assert.equal(arms,3,'invalid Enter never arms or reaches input');
 const a=await run({...c,completion:'level-start'});assert.equal(a.phase,'level-start');assert.equal(a.expected,8);
})().catch(e=>{console.error(e);process.exitCode=1});
`);
});

test('generated preload preserves native unarmed execution', () => {
  runNode(`const assert=require('node:assert/strict');
let calls=0;const nativeRun=n=>{calls++;return n+7;};
const native={exports:{run:nativeRun,get_last_run_blocks:()=>3,get_last_run_halt:()=>1}};
const WebAssembly={instantiate:async()=>({instance:native,module:'same module'})};
` + helper.pauseCompletionPreloadSource() + `
(async()=>{
 const imports={host:{memory:{buffer:new ArrayBuffer(16)}}};
 const r=await WebAssembly.instantiate('same bytes',imports);
 assert.equal(r.module,'same module');assert.equal(r.instance.exports.run,nativeRun);
 assert.equal(r.instance.exports.run(11),18);assert.equal(calls,1);
 assert.equal(globalThis.__lbNative.instance,r.instance);
 assert.equal(globalThis.__lbObserver,undefined);
 assert.equal(r.instance.exports.set_trace_eip_range,undefined);
})().catch(e=>{console.error(e);process.exitCode=1});
`);
});

test('completion keeps module transfer outside presentation budget', () => {
  // Exercise the emitted functions, including arm-time full validation.
  const emitted = helper.pauseCompletionSource(TEMPLATE).split('\nlet completionArm;')[0];
  runNode(`const assert=require('node:assert/strict');
const owner={instance:'immutable',endpointIdentity:'endpoint'},binding={exe:123};
const bound={WORKER_READ:'identity'},workers=new Map([['owner',{closed:false}]]);
let terminal=false,full=0,presented=false;const deadline=Date.now()+2000;
async function owningWorker(){assert.equal(++full,1,'redundant full-module service');return 'owner';}
async function evaluate(s){
 if(s==='identity')return owner;
 if(s.startsWith('globalThis.__lbArm('))return {armed:true,token:'test-pause',deadline,binding};
 if(s==='globalThis.__lbObserver.snapshot()')return {token:'test-pause',expected:20,binding,active:false,reason:'complete'};
 assert(s.startsWith('new Promise('));presented=true;return {presented:true};
}
function save(){}function fail(e){terminal=true;}async function wait(){}
` + emitted + `
(async()=>{const a=await armObservation({id:'test',phase:'pause',expected:20});
 await completion(a);assert.equal(full,1);assert(presented);assert(!terminal);
 workers.get('owner').closed=true;presented=false;
 await assert.rejects(completion(a),/owner closed/);assert(terminal);assert(!presented);
})().catch(e=>{console.error(e);process.exitCode=1});
`);
});

test('observer selects bound owner among secondary threads', () => {
  runNode(`const assert=require('node:assert/strict');
const workers=new Map([['owner',{targetId:'main',url:'guest-worker.js'}],
 ['secondary-1',{targetId:'thread-1',url:'guest-worker.js'}],
 ['secondary-2',{targetId:'thread-2',url:'guest-worker.js'}]]);
const chain={readLive:async()=>({worker:{sessionId:'owner'},identity:{workerTarget:'main'}})};
` + helper.owningWorkerSource() + `
(async()=>{
 assert.equal(await owningWorker(),'owner');
 workers.get('owner').closed=true;
 await assert.rejects(owningWorker(),/live bound/);
 workers.get('owner').closed=false;workers.get('owner').targetId='foreign';
 await assert.rejects(owningWorker(),/bound owning Worker target/);
 workers.delete('owner');await assert.rejects(owningWorker(),/live bound/);
})().catch(e=>{console.error(e);process.exitCode=1});
`);
});

test('separate resume requires reviewed pause before arming', () => {
  runNode(`const assert=require('node:assert/strict');
let arms=0;const latest={label:'visible-pause'};
async function armObservation(c){arms++;return c;}
async function run(c){let completionArm;
` + branch() + `
return completionArm;}
(async()=>{
 const c={action:'key',key:'p',expected:8};
 await assert.rejects(run(c),/reviewed visible pause/);assert.equal(arms,0);
 await assert.rejects(run({...c,pauseConfirmed:'foreign'}));assert.equal(arms,0);
 await assert.rejects(run({...c,expected:9}));assert.equal(arms,0);
 const resume=await run({...c,pauseConfirmed:'visible-pause'});
 assert.equal(resume.expected,8);assert.equal(arms,1);
 const pause=await run({action:'key',key:'p'});
 assert.equal(pause.expected,20);assert.equal(arms,2);
})().catch(e=>{console.error(e);process.exitCode=1});
`);
});

test('case-specific generated consumer', () => {
  for (const kase of ['fixture', 'original']) {
    const root = tempRoot();
    try {
      const run = path.join(root, 'run'), out = path.join(run, kase);
      fs.mkdirSync(out, {recursive: true});
      fs.writeFileSync(path.join(out, 'latest.json'), '{"label":"startup"}');
      const other = kase === 'fixture' ? 'original' : 'fixture';
      fs.writeFileSync(path.join(run, other + '.log'), 'foreign case');
      const inspect = () => JSON.parse(runNode(helper.inspectionSource(root, 'run', kase)));
      const live = inspect();
      assert.equal(live.logAvailable, false, kase);
      assert.equal(live.output, null);
      assert.deepEqual(live.terminal, {});
      assert.equal(live.latest.label, 'startup');
      fs.writeFileSync(path.join(run, kase + '.log'), 'own case');
      assert.equal(inspect().output, 'own case');
      fs.unlinkSync(path.join(run, kase + '.log'));
      fs.writeFileSync(path.join(out, 'first-browser-failure.json'), '{"error":"stop"}');
      const wait = kase === 'fixture' ? 'fixture-launcher' : 'launcher';
      fs.writeFileSync(path.join(run, wait + '-wait.json'), '{"actualWait":true}');
      const terminal = inspect();
      assert.equal(terminal.logAvailable, false);
      assert.equal(terminal.terminal['first-browser-failure.json'].error, 'stop');
      assert.equal(terminal.terminal.launcherWait.actualWait, true);
    } finally { fs.rmSync(root, {recursive: true, force: true}); }
  }
});

test('foreign case refused before generation', () => {
  assert.throws(() => helper.inspectionSource('/unused', 'run', '../other'));
});

test('real close, delayed wait and separate EOF before original', async () => {
  const root = tempRoot(), run = path.join(root, 'run');
  fs.mkdirSync(path.join(run, 'fixture'), {recursive: true});
  // The real child receives close, then takes time to exit. A pipe inheritor
  // keeps stderr open even after the direct child exits.
  const child = `const fs=require('node:fs'),cp=require('node:child_process');
const sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
while(!fs.existsSync('run/close-request'))sleep(10);
fs.writeFileSync('run/fixture/cleanup.json','{"closed":true}');
sleep(150);
cp.spawn(process.execPath,['-e','setTimeout(()=>{},300)'],{stdio:['ignore','ignore','inherit'],detached:true}).unref();
`;
  const parent = cp.spawn(node, ['-e', helper.launcherSource(root, 'run', 'fixture', [node, '-e', child])], {stdio: 'inherit'});
  const parentExit = new Promise(resolve => parent.once('exit', resolve));
  const has = n => fs.existsSync(path.join(run, n)), json = n => JSON.parse(fs.readFileSync(path.join(run, n), 'utf8'));
  try {
    const close = [node, '-e', "require('node:fs').writeFileSync('run/close-request','')"];
    fs.writeFileSync(path.join(run, 'lifecycle.json'), '{"browserDeadline":1794271910767}');
    const original = "const assert=require('node:assert');assert.equal(process.env.BROWSER_DEADLINE,'1794271910767');assert.equal(process.env.CASE_TAG,'original');require('node:fs').writeFileSync('run/original-created','')";
    const source = helper.originalWorkflowSource(root, 'run', [node, '-e', original], close, 3);
    const gate = cp.spawn(node, ['-e', source], {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    gate.stdout.on('data', b => out += b); gate.stderr.on('data', b => err += b);
    const gateDone = new Promise(resolve => gate.once('close', resolve));
    const due = Date.now() + 3000;
    while (!has('fixture-launcher-wait.json')) {
      assert(!has('original-created'));
      assert(Date.now() < due, 'fixture wait unpublished');
      await sleep(10);
    }
    assert(!has('fixture-launcher-stderr-eof.json'), 'stderr EOF waits for the pipe inheritor');
    assert(!has('original-created'));
    const code = await Promise.race([gateDone, sleep(4000).then(() => 'timeout')]);
    assert.equal(code, 0, err);
    assert.equal(JSON.parse(out).separateEOF, true);
    await Promise.race([parentExit, sleep(3000)]);
    for (let i = 0; i < 100 && !has('original-created'); i++) await sleep(10);
    assert(has('original-created'));
    for (let i = 0; i < 100 && !(has('launcher-stderr-eof.json') && has('launcher-wait.json')); i++) await sleep(10);
    assert.equal(json('launcher-wait.json').code, 0);
    const wait = json('fixture-launcher-wait.json');
    for (const stream of ['stdout', 'stderr']) {
      const eof = json('fixture-launcher-' + stream + '-eof.json');
      assert.equal(eof.pid, wait.pid);
      assert.equal(eof.eof, true);
    }
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) { parent.kill(); await parentExit; }
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('full generated gate negatives never create original', () => {
  const negatives = ['cleanup-missing', 'wait-missing', 'wait-false', 'wait-failed',
    'stdout-missing', 'stderr-missing', 'eof-false', 'eof-foreign-pid',
    'cleanup-failed', 'browser-failure', 'transport-failure'];
  for (const negative of negatives) {
    const root = tempRoot(), run = path.join(root, 'run');
    try {
      fs.mkdirSync(path.join(run, 'fixture'), {recursive: true});
      const put = (name, value) => fs.writeFileSync(path.join(run, name), JSON.stringify(value));
      put('fixture/cleanup.json', {closed: true});
      put('fixture-launcher-wait.json', {pid: 123, actualWait: true, code: 0});
      for (const stream of ['stdout', 'stderr']) put('fixture-launcher-' + stream + '-eof.json', {pid: 123, eof: true, stream});
      const missing = {'cleanup-missing': 'fixture/cleanup.json', 'wait-missing': 'fixture-launcher-wait.json',
        'stdout-missing': 'fixture-launcher-stdout-eof.json', 'stderr-missing': 'fixture-launcher-stderr-eof.json'};
      if (negative in missing) fs.unlinkSync(path.join(run, missing[negative]));
      if (negative === 'wait-false') put('fixture-launcher-wait.json', {actualWait: false, code: 0});
      if (negative === 'wait-failed') put('fixture-launcher-wait.json', {actualWait: true, code: 7});
      if (negative === 'eof-false') put('fixture-launcher-stderr-eof.json', {pid: 123, eof: false, stream: 'stderr'});
      if (negative === 'eof-foreign-pid') put('fixture-launcher-stderr-eof.json', {pid: 456, eof: true, stream: 'stderr'});
      if (negative === 'cleanup-failed') put('fixture/cleanup.json', {closed: false});
      if (negative === 'browser-failure') put('fixture/first-browser-failure.json', {error: 'dead'});
      if (negative === 'transport-failure') put('fixture/first-failure.json', {error: 'refused'});
      const source = helper.originalWorkflowSource(root, 'run',
        [node, '-e', "require('node:fs').writeFileSync('run/original-created','')"], null, 0.1);
      const p = cp.spawnSync(node, ['-e', source], {encoding: 'utf8', timeout: 3000});
      assert.notEqual(p.status, 0, negative);
      assert(!fs.existsSync(path.join(run, 'original-created')), negative);
      assert(!fs.existsSync(path.join(run, 'original-parent.json')), negative);
    } finally { fs.rmSync(root, {recursive: true, force: true}); }
  }
});

test('original generated parent reports actual wait and EOF', () => {
  const root = tempRoot(), run = path.join(root, 'run');
  try {
    fs.mkdirSync(run);
    const source = helper.launcherSource(root, 'run', 'original',
      [node, '-e', "console.log('out');console.error('err')"]);
    cp.execFileSync(node, ['-e', source], {timeout: 3000, stdio: 'inherit'});
    assert.equal(fs.readFileSync(path.join(run, 'original.log'), 'utf8'), 'out\n');
    assert.equal(fs.readFileSync(path.join(run, 'original-stderr.log'), 'utf8'), 'err\n');
    assert.equal(JSON.parse(fs.readFileSync(path.join(run, 'launcher-wait.json'), 'utf8')).code, 0);
    for (const stream of ['stdout', 'stderr'])
      assert.equal(JSON.parse(fs.readFileSync(path.join(run, 'launcher-' + stream + '-eof.json'), 'utf8')).eof, true);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

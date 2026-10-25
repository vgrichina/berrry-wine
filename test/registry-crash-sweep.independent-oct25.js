'use strict';
// Independent semantic acceptance: evaluates the exact candidate, replacing only
// registry and child_process. Never executes test/run.js or a real sweep.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../tools/registry-crash-sweep.js'), 'utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), '7caa4f2c4e27f3dbca25355a5d61dbb262cd95721b8ce1ecfa81ca3667f99807');
const config = { budget: 300, batchSize: 20000, seconds: 90, timeout: 150 };
// Matches the literal Stats output assembled at base test/run.js:11520-11521.
const stats = '\nStats: 42 API calls, 300 batches in 1.234s (243 batches/s)\n';
const header = c => `[sweep] config=${JSON.stringify(c)}\n`;
const complete = (body = stats, exit = '0', c = config) => header(c) + body + `\n[sweep] exit=${exit}\n`;
async function run({logs = {}, ids = ['a'], baseline, options = {}, limit = 0, output = stats, error = null, stderr = ''} = {}) {
  const dir = fs.mkdtempSync(path.join(__dirname, '.independent-crash-'));
  let launches = [];
  try {
    const out = path.join(dir, 'out'); fs.mkdirSync(out);
    const base = path.join(dir, 'baseline.json');
    fs.writeFileSync(base, JSON.stringify(baseline ?? {results: ids.map(id => ({id, runs: {off300: {crash: false}}}))}));
    for (const [id, log] of Object.entries(logs)) fs.writeFileSync(path.join(out, `${id}.log`), log);
    const process = {argv: ['node', 'sweep', `--out=${out}`, `--baseline=${base}`, `--apps=${ids.join(',')}`, `--limit=${limit}`, ...Object.entries(options).map(([k,v]) => `--${k}=${v}`)], stdout: {write() {}}, exit(c) {throw Error(`exit ${c}`);}};
    await vm.runInNewContext(source, {__dirname: path.join(__dirname, '../tools'), process, console: {log() {}, error(e) {throw e;}}, require(name) {
      if (name === '../lib/apps') return {APPS: Object.fromEntries(ids.map(id => [id, {}]))};
      if (name === 'child_process') return {execFile(cmd, args, opts, cb) {
        assert.equal(cmd, 'timeout'); assert.equal(args[2], 'test/run.js');
        launches.push(args); cb(error, output, stderr);
      }};
      return require(name);
    }}, {timeout: 1000});
    assert.equal(process.exitCode, undefined);
    return {...JSON.parse(fs.readFileSync(path.join(out, 'result.json'))), launches, table: fs.readFileSync(path.join(out, 'table.md'), 'utf8')};
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const baselineCrash = {results: [{id: 'a', runs: {off300: {crash: true}}}]};
test('genuine Stats formatting and completed zero exit produce PASS/OK', async () => {
  const r = await run({logs: {a: complete()}}); assert.equal(r.status, 'PASS'); assert.equal(r.results[0].status, 'OK'); assert.equal(r.results[0].reached, 300); assert.equal(r.launches.length, 0);
});
test('genuine Stats formatting against exact crash baseline is FIXED', async () => {
  const r = await run({logs: {a: complete()}, baseline: baselineCrash}); assert.equal(r.status, 'PASS'); assert.equal(r.results[0].status, 'FIXED');
});
for (const [name, tail] of [
  ['absent', ''], ['truncated prefix', '[swee'], ['truncated key', '[sweep] ex'], ['truncated value', '[sweep] exit='],
  ['missing LF', '[sweep] exit=0'], ['text code', '[sweep] exit=zero\n'], ['decimal code', '[sweep] exit=0.0\n'],
  ['unsafe integer', '[sweep] exit=9007199254740992\n'], ['suffix', '[sweep] exit=0 extra\n'],
  ['old record followed by partial attempt', '[sweep] exit=0\npartial'], ['CRLF record', '[sweep] exit=0\r\n'],
]) test(`completion ${name} remains incomplete and reruns`, async () => {
  const log = header(config) + stats + tail;
  const r = await run({logs: {a: log}, baseline: baselineCrash});
  assert.equal(r.status, 'INCONCLUSIVE'); assert.equal(r.results[0].status, 'INCOMPLETE'); assert.equal(r.results[0].completed, false);
  const retry = await run({logs: {a: log}, limit: 1}); assert.equal(retry.launches.length, 1); assert.equal(retry.status, 'PASS');
});
for (const [field, value, option] of [['budget',301,'budget'],['batchSize',20001,'batch-size'],['seconds',91,'seconds'],['timeout',151,'timeout']]) {
  test(`resume ${field} mismatch reruns with requested settings`, async () => {
    const r = await run({logs:{a:complete()}, options:{[option]:value}, limit:1}); assert.equal(r.launches.length,1);
    const args = r.launches[0]; assert.ok(args.includes(field === 'timeout' ? String(value) : `--${({budget:'max-batches',batchSize:'batch-size',seconds:'max-seconds'})[field]}=${value}`));
  });
  test(`mismatched saved ${field} cannot claim success when launch deferred`, async () => {
    const r = await run({logs:{a:complete(stats,'0',{...config,[field]:value})}}); assert.equal(r.status,'INCONCLUSIVE'); assert.equal(r.results[0].status,'INCOMPLETE');
  });
}
test('legacy complete marker without settings is retried', async () => assert.equal((await run({logs:{a:stats+'[sweep] exit=0\n'},limit:1})).launches.length,1));
for (const [name, err, status, code] of [
  ['numeric runner error',{code:2},'RUNNER ERROR',2], ['timeout',{code:124},'TIMEOUT',124],
  ['timeout kill',{code:137},'TIMEOUT',137], ['signal',{code:null,signal:'SIGTERM'},'RUNNER ERROR',-1],
  ['buffer error',{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'},'RUNNER ERROR',-1],
  ['spawn error',{code:'ENOENT'},'RUNNER ERROR',-1],
]) test(`${name} with progress never becomes FIXED`, async () => {
  const r = await run({limit:1,error:err,baseline:baselineCrash}); assert.equal(r.results[0].code,code); assert.equal(r.results[0].status,status); assert.equal(r.status,'INCONCLUSIVE');
});
test('completed nonzero record is reused as failure', async () => {
  const r = await run({logs:{a:complete(stats,'2')},limit:1,baseline:baselineCrash}); assert.equal(r.launches.length,0); assert.equal(r.results[0].status,'RUNNER ERROR'); assert.equal(r.status,'INCONCLUSIVE');
});
test('stderr crash overrides zero exit and fails aggregate', async () => {
  const r = await run({limit:1,stderr:'RuntimeError: unreachable\n'}); assert.equal(r.results[0].status,'NEW CRASH'); assert.equal(r.status,'FAIL');
});
test('crashing previous baseline remains STILL CRASH', async () => {
  const r = await run({logs:{a:complete('UNIMPLEMENTED API Foo\n','1')},baseline:baselineCrash}); assert.equal(r.results[0].status,'STILL CRASH'); assert.equal(r.status,'FAIL');
});
for (const [name, baseline] of [
  ['absent row',{results:[]}], ['wrong arm',{results:[{id:'a',runs:{off299:{crash:true}}}]}],
  ['wrong executor',{results:[{id:'a',runs:{on300:{crash:true}}}]}], ['untyped verdict',{results:[{id:'a',runs:{off300:{crash:'false'}}}]}],
]) test(`unknown baseline ${name} keeps aggregate inconclusive`,async()=>{
  const r=await run({logs:{a:complete()},baseline}); assert.equal(r.results[0].baselineStatus,'UNKNOWN'); assert.notEqual(r.results[0].status,'FIXED'); assert.equal(r.status,'INCONCLUSIVE');
});
test('exact off budget wins over different-budget crashing baseline',async()=>{
  const r=await run({logs:{a:complete()},baseline:{results:[{id:'a',runs:{off300:{crash:false},off400:{crash:true}}}]}}); assert.equal(r.status,'PASS'); assert.equal(r.results[0].status,'OK');
});
test('zero exit without Stats/progress is INCONCLUSIVE',async()=>{ const r=await run({logs:{a:complete('startup\n')}});assert.equal(r.results[0].status,'INCONCLUSIVE');assert.equal(r.status,'INCONCLUSIVE'); });
test('aggregate pending work prevents PASS',async()=>{const r=await run({ids:['a','b'],logs:{a:complete()}});assert.equal(r.pending,1);assert.equal(r.status,'INCONCLUSIVE');assert.match(r.table,/Summary: \*\*INCONCLUSIVE\*\*/);});
test('aggregate incomplete log prevents PASS despite successful sibling',async()=>{const r=await run({ids:['a','b'],logs:{a:complete(),b:header(config)+stats}});assert.equal(r.pending,0);assert.equal(r.status,'INCONCLUSIVE');});
test('aggregate crash beats pending work',async()=>{const r=await run({ids:['a','b'],logs:{a:complete('CRASH\n','1')}});assert.equal(r.pending,1);assert.equal(r.status,'FAIL');});
(async()=>{let failed=0;for(const [name,fn] of tests){try{await fn();console.log(`PASS ${name}`);}catch(e){failed++;console.log(`FAIL ${name}: ${e.stack}`);}}console.log(`${tests.length-failed}/${tests.length} passed`);process.exitCode=failed?1:0;})();

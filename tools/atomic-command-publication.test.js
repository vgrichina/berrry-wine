'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { publishJSON, readJSON } = require('./atomic-command-publication');
const helper = require.resolve('./atomic-command-publication');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function until(predicate) {
  const end = Date.now() + 10000;
  while (!predicate()) {
    assert(Date.now() < end, 'child checkpoint timeout');
    await sleep(5);
  }
}
function child(source, args) {
  const p = spawn(process.execPath, ['-e', source, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  p.stderr.on('data', b => { stderr += b; });
  const done = new Promise((resolve, reject) => {
    p.once('error', reject);
    p.once('exit', code => resolve({ code, stderr }));
  });
  return { p, done };
}
const pausedWriter = `
const fs=require('node:fs'),[helper,file,marker,release,mode]=process.argv.slice(1);
const open=fs.openSync;
fs.openSync=function(p,...args){
 const fd=open.call(this,p,...args);
 if(mode==='legacy'?p===file:String(p).endsWith('.tmp')){
  fs.writeFileSync(marker,'opened');
  const end=Date.now()+10000;
  while(!fs.existsSync(release)){if(Date.now()>end)throw Error('release timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}
 }
 return fd;
};
const value={reviewRef:'fresh',steps:['wait:1200','shot:response.png']};
if(mode==='legacy')fs.writeFileSync(file,Buffer.from(JSON.stringify(value)),{flag:'wx'});
else require(helper).publishJSON(file,value);
`;

for (const mode of ['legacy', 'atomic']) test(mode + ' paused publication captures the actual read boundary', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-publication-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '0.json'), marker = path.join(dir, 'opened'), release = path.join(dir, 'release');
  const writer = child(pausedWriter, [helper, file, marker, release, mode]);
  t.after(() => writer.p.kill());
  await until(() => fs.existsSync(marker));
  if (mode === 'legacy') {
    assert.equal(fs.readFileSync(file).length, 0);
    assert.throws(() => readJSON(file), SyntaxError);
    const captured = readJSON(file + '.read-failure.json');
    assert.equal(captured.length, 0);
    assert.equal(captured.base64, '');
    assert.match(captured.error, /Unexpected end/);
  } else {
    assert.equal(fs.existsSync(file), false, 'incomplete temporary cannot be admitted');
    assert.equal(fs.readdirSync(dir).filter(n => n.endsWith('.tmp')).length, 1);
  }
  fs.writeFileSync(release, 'release');
  assert.deepEqual(await writer.done, { code: 0, stderr: '' });
  assert.deepEqual(readJSON(file), { reviewRef: 'fresh', steps: ['wait:1200', 'shot:response.png'] });
  assert.equal(fs.readdirSync(dir).some(n => n.endsWith('.tmp')), false);
});

test('concurrent publishers expose exactly one complete immutable observation', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-publication-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '0.json');
  const writers = Array.from({ length: 8 }, (_, i) => child(`
    const [helper,file,id]=process.argv.slice(1);
    try { require(helper).publishJSON(file,{id,steps:['wait:1200','shot:response.png'],payload:'x'.repeat(262144)}); }
    catch(e) { if(e.code==='EEXIST')process.exitCode=2; else throw e; }
  `, [helper, file, String(i)]));
  t.after(() => writers.forEach(w => w.p.kill()));
  await until(() => fs.existsSync(file));
  const observed = readJSON(file), bytes = fs.readFileSync(file);
  assert.equal(observed.payload.length, 262144);
  assert.deepEqual(observed.steps, ['wait:1200', 'shot:response.png']);
  const exits = await Promise.all(writers.map(w => w.done));
  assert.equal(exits.filter(e => e.code === 0).length, 1);
  assert.equal(exits.filter(e => e.code === 2).length, 7);
  assert(exits.every(e => e.stderr === ''));
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.deepEqual(fs.readdirSync(dir), ['0.json']);
});

test('malformed final records fail closed with exact bytes; duplicate publication never overwrites', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-publication-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [i, raw] of [Buffer.alloc(0), Buffer.from('{"steps":['), Buffer.from([0xff, 0x7b])].entries()) {
    const file = path.join(dir, i + '.json');
    fs.writeFileSync(file, raw);
    assert.throws(() => readJSON(file), SyntaxError);
    const failure = readJSON(file + '.read-failure.json');
    assert.deepEqual(Buffer.from(failure.base64, 'base64'), raw);
    assert.equal(failure.length, raw.length);
    assert.throws(() => publishJSON(file, { quit: true }), { code: 'EEXIST' });
    assert.deepEqual(fs.readFileSync(file), raw);
  }
});

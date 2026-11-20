'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {create} = require('../tools/revolt-release-standby.cjs');

async function fixture(t, behavior = '') {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-standby-'));
  const script = out + '/child.cjs';
  fs.writeFileSync(script, `const fs=require('fs'),[out,file]=process.argv.slice(2);
    fs.writeFileSync(file+'.prepared',JSON.stringify({pid:process.pid,at:Date.now(),importsReady:true,armed:false}));
    ${behavior}
    const timer=setInterval(()=>{if(fs.existsSync(file)){clearInterval(timer);const cfg=JSON.parse(fs.readFileSync(file));
    process.stdout.write(JSON.stringify({armed:true,name:cfg.name})+'\\n');
    fs.writeFileSync(out+'/'+cfg.name+'-up.json',JSON.stringify({keys:cfg.keys}));}},5);`);
  let failure = null;
  const lifecycle = create({out, script, check: () => {if (failure) throw failure;},
    save: (n, v) => fs.writeFileSync(out + '/' + n, JSON.stringify(v))});
  t.after(async () => {await lifecycle.close(); fs.rmSync(out, {recursive:true, force:true});});
  return {out, lifecycle, fail: e => { failure = e; }};
}
test('two captures and repeated preparation reuse the same unconsumed unarmed child', async t => {
  const {out, lifecycle} = await fixture(t);
  const first = await lifecycle.prepare();
  assert.equal(await lifecycle.prepare(), first);
  assert.equal(await lifecycle.prepare(), first);
  assert(!fs.existsSync(first.file)); assert.equal(first.stdout, '');
  await lifecycle.close();
  const wait = JSON.parse(fs.readFileSync(out + '/' + first.name + '-unused-release-wait.json'));
  assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF); assert.equal(wait.stdout, '');
  await assert.rejects(lifecycle.prepare(), /closed/);
});
test('a consumed child receives only the fresh operation config; next gesture gets another child', async t => {
  const {lifecycle} = await fixture(t);
  const first = await lifecycle.prepare();
  const taken = lifecycle.consume('actual-1'); assert.equal(taken, first);
  fs.writeFileSync(taken.file, JSON.stringify({name:'actual-1', keys:['ArrowUp']}));
  taken.child.stdin.end(); const wait = await taken.joined;
  assert.equal(wait.code, 0); assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
  assert.match(wait.stdout, /actual-1/);
  const second = await lifecycle.prepare(); assert.notEqual(second.child.pid, first.child.pid);
  assert.throws(() => lifecycle.consume('actual-1'), /fresh release operation/);
  assert(!fs.existsSync(second.file));
});
for (const reason of ['stale owner', 'replaced owner', 'UNKNOWN transport']) {
  test(reason + ' refuses consumption and preparation, retirement sends no config/input', async t => {
    const {lifecycle, fail} = await fixture(t);
    const p = await lifecycle.prepare(); fail(Error(reason));
    assert.throws(() => lifecycle.consume('fresh-op'), new RegExp(reason));
    await assert.rejects(lifecycle.prepare(), new RegExp(reason));
    await lifecycle.close(); const wait = await p.joined;
    assert(!fs.existsSync(p.file)); assert.equal(wait.stdout, '');
    assert(wait.actualWait && wait.stdoutEOF && wait.stderrEOF);
  });
}
test('unexpected prearm output fails closed and the unused child is joined', async t => {
  const {lifecycle} = await fixture(t, "process.stdout.write('unexpected');");
  await assert.rejects(lifecycle.prepare(), /unarmed standby has no output/);
  await lifecycle.close();
});

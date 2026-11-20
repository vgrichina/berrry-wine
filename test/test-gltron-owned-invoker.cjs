'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const own = require('../tools/gltron-owned-invoker.cjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [mode, out, testCase] = process.argv.slice(2);
if (mode === '--self-term') {
  process.kill(process.pid, 'SIGTERM');
} else if (mode === '--custodian') {
  own.custodize({out, command: [process.execPath, __filename, '--self-term'],
    closeScope: async () => {}}).then(code => { process.exitCode = code; });
} else if (mode === '--runtime') {
  process.on('SIGTERM', () => { console.log('forwarded TERM'); process.exitCode = 143; clearTimeout(t); });
  process.on('SIGINT', () => { console.log('forwarded INT'); process.exitCode = 130; clearTimeout(t); });
  const t = setTimeout(() => { console.log('completed'); }, 600);
  fs.writeFileSync(out + '/ready', 'ready');
} else if (mode === '--monitor') {
  const t = setInterval(() => { if (fs.existsSync(out + '/finish')) clearInterval(t); }, 5);
  setTimeout(() => clearInterval(t), 2000).unref();
} else if (mode === '--invoker') {
  own.invoke({out, command: [process.execPath, __filename, '--runtime', out],
    watchdog: [process.execPath, __filename, '--monitor', out],
    deadline: Date.now() + (testCase === 'timeout' ? 200 : 2500), cleanupDeadline: Date.now() + 3500,
    closeScope: async reason => fs.writeFileSync(out + '/closed', reason),
    finishWatchdog: async () => fs.writeFileSync(out + '/finish', ''), required: [out + '/ready']})
    .then(r => { process.exitCode = r.code; }, e => { console.error(e); process.exitCode = 1; });
} else {
  (async () => {
    const root = path.resolve(mode); fs.mkdirSync(root, {recursive: true});
    const results = [];
    for (const testCase of ['normal', 'SIGTERM', 'SIGINT', 'timeout']) {
      const dir = root + '/' + testCase; fs.mkdirSync(dir);
      const p = own.child([process.execPath, __filename, '--invoker', dir, testCase], {out: dir, name: 'parent'});
      const bound = setTimeout(() => p.signal('SIGKILL'), 5000);
      while (!fs.existsSync(dir + '/ready')) { assert.equal(p.p.exitCode, null); await sleep(5); }
      if (testCase.startsWith('SIG')) p.signal(testCase);
      const wait = await p.joined; clearTimeout(bound);
      const expected = {normal: 0, SIGTERM: 143, SIGINT: 130, timeout: 124}[testCase];
      assert.equal(own.status(wait), expected);
      const receipt = JSON.parse(fs.readFileSync(dir + '/invoker-wait.json'));
      for (const row of [wait, receipt.wait, receipt.monitorWait]) assert(row.actualWait && row.stdoutEOF && row.stderrEOF);
      if (expected) assert(fs.existsSync(dir + '/closed'));
      results.push({testCase, expected, code: own.status(wait), waitsAndEOF: true});
    }
    assert.throws(() => own.requireSuccess({code: null, signal: 'SIGTERM', stdoutEOF: true, stderrEOF: true}));
    assert.throws(() => own.requireSuccess({code: 0, signal: null, stdoutEOF: true, stderrEOF: true}, [root + '/absent']));
    const dir = root + '/custodian-signal'; fs.mkdirSync(dir);
    const p = own.child([process.execPath, __filename, '--custodian', dir], {out: dir, name: 'parent'});
    const wait = await p.joined, child = JSON.parse(fs.readFileSync(dir + '/actual-child-wait.json'));
    assert.equal(child.signal, 'SIGTERM'); assert.equal(child.code || 0, 0, 'retained old mapping falsely succeeded');
    assert.equal(own.status(wait), 143, 'new custodian must preserve failed child signal');
    assert(wait.stdoutEOF && wait.stderrEOF && child.stdoutEOF && child.stderrEOF);
    results.push({testCase: 'custodian child TERM', oldMapping: 0, newStatus: 143, waitsAndEOF: true});
    fs.writeFileSync(root + '/results.json', JSON.stringify(results));
    console.log('PASS actual normal/TERM/INT/deadline waits and EOF; failed status/missing required output throws');
  })().catch(e => { console.error(e); process.exitCode = 1; });
}

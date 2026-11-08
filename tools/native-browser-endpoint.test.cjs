'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {waitForBrowserEndpoint} = require('./native-browser-endpoint.cjs');

async function fixture(t, script) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'wine-browser-endpoint-'));
  const browser = spawn(process.execPath, ['-e', script, profile], {stdio: 'ignore'});
  const exited = once(browser, 'exit');
  t.after(async () => {
    if (browser.exitCode === null && browser.signalCode === null) browser.kill();
    await exited;
    await fs.rm(profile, {recursive: true, force: true});
  });
  return {profile, browser};
}

test('late and partially published endpoint is awaited without restarting the child', async t => {
  const f = await fixture(t, `const fs=require('fs'),p=process.argv[1]+'/DevToolsActivePort';
    setTimeout(()=>fs.writeFileSync(p,'9222\\n'),200);
    setTimeout(()=>fs.writeFileSync(p,'9222\\n/devtools/browser/late-native-child\\n'),300);
    setInterval(()=>{},1000);`);
  // Reproduce the predecessor assumption: an endpoint is absent after its
  // startup allowance, although the same child later publishes a valid one.
  await new Promise(r => setTimeout(r, 50));
  await assert.rejects(fs.readFile(path.join(f.profile, 'DevToolsActivePort')), {code: 'ENOENT'});
  const pid = f.browser.pid;
  assert.deepEqual(await waitForBrowserEndpoint({...f, deadline: Date.now() + 3000, pollMs: 10}),
    {debugPort: 9222, browserPath: '/devtools/browser/late-native-child'});
  assert.equal(f.browser.pid, pid);
  assert.equal(f.browser.exitCode, null);
});

test('child exit refuses promptly instead of waiting out startup allowance', async t => {
  const f = await fixture(t, 'process.exit(17)');
  await assert.rejects(waitForBrowserEndpoint({...f, deadline: Date.now() + 3000, pollMs: 10}),
    /Chrome exited before DevTools readiness: code=17/);
});

test('malformed endpoint cannot pass and caller deadline caps a longer startup allowance', async t => {
  const f = await fixture(t, 'setInterval(()=>{},1000)');
  await fs.writeFile(path.join(f.profile, 'DevToolsActivePort'), '99999\n/devtools/browser/wrong\n');
  const start = Date.now();
  await assert.rejects(waitForBrowserEndpoint({...f, deadline: start + 100, startupTimeoutMs: 10000, pollMs: 10}),
    /readiness timed out.*immutable deadline/);
  assert(Date.now() - start < 1000);
});

test('expired deadline refuses even if a valid endpoint is already present', async t => {
  const f = await fixture(t, 'setInterval(()=>{},1000)');
  await fs.writeFile(path.join(f.profile, 'DevToolsActivePort'), '9222\n/devtools/browser/already-present\n');
  await assert.rejects(waitForBrowserEndpoint({...f, deadline: Date.now() - 1}), /expired browser startup deadline/);
});

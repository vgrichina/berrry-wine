#!/usr/bin/env node
'use strict';
// Apply the narrow repair to exact retained MW3 controller inputs.
//
// Writes five repaired inputs, or seven integrated ordinary-0500 inputs, into an owned run.
// The source run remains untouched. Pin the resulting files with the other runtime
// inputs before use; this tool neither provisions nor starts an original/box.
//
// Usage: node tools/mw3-retention-repair.js SOURCE DEST
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');

function replace_once(text, old, replacement) {
  assert(text.split(old).length - 1 === 1, 'exact MW3 controller anchor missing or ambiguous');
  return text.replace(old, () => replacement);
}

const createExclusive = (file, text) => fs.writeFileSync(file, text, {flag: 'wx'});

function repair(source, dest) {
  source = path.resolve(source); dest = path.resolve(dest);
  const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  assert(source !== dest && isDir(dest));
  const read = name => fs.readFileSync(path.join(source, name), 'utf8');
  let browser = read('browser.cjs');
  // The ordinary 0500 inputs already include the retention/readiness repair.
  // Regenerate their pre-instantiation observer by default, rather than
  // leaving a stale serialized function in the next original's prefix.
  if (browser.includes("require('./dispatch-observer.cjs')") && browser.includes('mw3-preclick-readiness.cjs')) {
    const names = ['browser.cjs', 'dispatch-observer.cjs', 'worker-prefix.js',
      'throttle.cjs', 'owner-start.py', 'collect.py', 'recover-watch.py'];
    assert(names.every(name => !fs.existsSync(path.join(dest, name))), 'prepared input exists');
    const tool = path.join(__dirname, 'mw3-readiness-install.cjs');
    execFileSync(process.execPath, [tool, source, dest], {stdio: 'inherit'});
    for (const name of names.slice(4)) createExclusive(path.join(dest, name), read(name));
    // Final preparation owns lifecycle distinctions and fresh HTTP metadata.
    if (fs.existsSync(path.join(source, 'pin.py')))
      createExclusive(path.join(dest, 'pin.py'), read('pin.py').split(path.basename(source)).join(path.basename(dest)));
    require('./mw3-prelaunch-recovery.js').install(dest);
    return;
  }
  const old = "await wait(300);require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs').validate(await menuObserver.read());";
  const replacement = "await require(root+'/tools/mw3-preclick-readiness.cjs').ready({observer:menuObserver,validate:require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs').validate,deadline:commandWorkEnd,wait,save,label:c.label,checkIdentity:async()=>bound.same(receipt.live.identity,(await chain.readLive()).identity)});";
  browser = replace_once(browser, old, replacement);
  browser = browser.split("require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs')").join("require('./dispatch-observer.cjs')");
  let observer = read('dispatch-observer.cjs');
  observer = replace_once(observer, "read:async()=>normalize(await ev('__mw3ReadObserver.snapshot()'))", "read:async()=>{const v=normalize(await ev('__mw3ReadObserver.snapshot()'));save('dispatch-last-snapshot.json',v);const live=await ev(bound.WORKER_READ);assert.equal(live.instance,identity.workerInstance);assert.equal(live.endpointIdentity,identity.endpoint);return v;}");
  // Menu readiness must precede every native event, including cursor motion.
  browser = replace_once(browser, "if(!c.guestPoint)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},pageSession);", "down=async()=>{if(!c.guestPoint)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},pageSession);return send('Input.dispatchMouseEvent',{type:'mousePressed',...base},pageSession);};");
  // Preserve the cursor-motion behavior for ordinary clicks too.
  browser = replace_once(browser, "down=()=>send('Input.dispatchMouseEvent',{type:'mousePressed',...base},pageSession);", '// down is constructed above; no native event before readiness');

  let owner = read('owner-start.py');
  owner = owner.split("(R/'owner-").join("(d/'owner-");
  owner = replace_once(owner, 'sys.exit(p.returncode)', `# Publish last, after communicate has performed the actual wait and both EOFs.
import hashlib
names=['owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json','terminal-manifest.json']
rows=[]
for name in names:
 b=(d/name).read_bytes();rows.append(dict(path=name,size=len(b),sha256=hashlib.sha256(b).hexdigest()))
with (d/'owner-terminal-manifest.json').open('x') as f:json.dump(dict(rows=rows,actualOuterFinalization=True),f)
sys.exit(p.returncode)`);
  let collect = read('collect.py');
  collect = replace_once(collect, 'if final:\n', "if final and self.exists('owner-terminal-manifest.json'):\n");
  collect = replace_once(collect, 'self.validate_waits()', `outer_raw=self.get('owner-terminal-manifest.json');outer=json.loads(outer_raw)
     assert outer['actualOuterFinalization'] is True
     assert {r['path'] for r in outer['rows']}=={'owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json','terminal-manifest.json'},'outer receipt set'
     self.batch(outer['rows'])
     assert self.get('owner-terminal-manifest.json')==outer_raw,'outer manifest changed'
     self.recover(dict(path='owner-terminal-manifest.json',size=len(outer_raw),sha256=digest(outer_raw)))
     self.validate_waits()`);
  collect = replace_once(collect, 'node=value(required[0]);chrome=value(required[1])', `node=value(required[0]);chrome=value(required[1])
  for name in ['owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json']:
   assert name in self.verified,'outer actual wait/stream missing: '+name
  owner=value('owner-actual-wait.json')
  assert owner['status']==(node['status'] & 255),'outer/inner exit status mismatch'`);
  collect = replace_once(collect, 'for v in [node,chrome]:', 'for v in [node,chrome,owner]:');
  // recover-watch already roots Collector at runtime and gates finish-request
  // on its passed result. Its exact source now includes the outer barrier.
  for (const [name, text] of [['browser.cjs', browser], ['dispatch-observer.cjs', observer], ['owner-start.py', owner],
    ['collect.py', collect], ['recover-watch.py', read('recover-watch.py')]])
    createExclusive(path.join(dest, name), text);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args.some(a => a.startsWith('-'))) {
    console.error('usage: mw3-retention-repair.js SOURCE DEST');
    process.exit(2);
  }
  repair(args[0], args[1]);
}
module.exports = {repair, replace_once};

'use strict';
// Prepare explicit pre-Chrome custody without weakening started/unknown recovery.
// Text installer over the retained (Python) owner/collect/recover-watch/pin
// inputs of an owned MW3 run; it never runs them.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function child_deadline(allocation, now) {
  assert(Number.isFinite(allocation) && Number.isFinite(now));
  const deadline = Math.min(allocation - 600, now + 1740);
  assert(deadline - now > 120, 'insufficient live allocation for child and recovery');
  return deadline;
}

// Serialized into the prepared owner-start.py (formerly inspect.getsource of
// the Python original): nested retention fixtures and arbitrary owned
// destinations must not infer repository location from directory depth.
const CHILD_DEADLINE_PY = `def child_deadline(allocation, now):
    assert math.isfinite(allocation) and math.isfinite(now)
    deadline = min(allocation - 600, now + 1740)
    assert deadline - now > 120, 'insufficient live allocation for child and recovery'
    return deadline
`;

function once(text, old, replacement) {
  assert(text.split(old).length - 1 === 1, 'exact prelaunch anchor required: ' + old);
  return text.replace(old, () => replacement);
}

function index(text, needle, from = 0) {
  const at = text.indexOf(needle, from);
  if (at < 0) throw new Error('substring not found: ' + needle);
  return at;
}

function install(dest) {
  const read = name => fs.readFileSync(path.join(dest, name), 'utf8');
  const write = (name, text) => fs.writeFileSync(path.join(dest, name), text);
  let browser = read('browser.cjs');
  browser = once(browser, ' browser=cp.spawn(', " save('chrome-spawn-attempt.json',{at:Date.now(),attempted:true});\n browser=cp.spawn(");
  browser = once(browser, ').catch(async e=>{observation.fail(e);', ").catch(async e=>{if(!browser&&!fs.existsSync(out+'/chrome-spawn-attempt.json'))save('chrome-not-started.json',{started:false,spawnAttempted:false,phase:'before-chrome-spawn',nodePid:process.pid,error:String(e)});observation.fail(e);");
  write('browser.cjs', browser);
  let owner = read('owner-start.py');
  let count = 0;
  owner = owner.replace(/deadline=(?:float\(os.environ\['MW3_DEADLINE'\]\)-360|min\(float\(os.environ\['MW3_DEADLINE'\]\)-600,time.time\(\)\+1740\))/g, () => {
    count++;
    return "from mw3_prelaunch_recovery import child_deadline\ndeadline=child_deadline(float(os.environ['MW3_DEADLINE']),time.time())";
  });
  assert(count === 1, 'ordinary owner child deadline anchor');
  owner = owner.split('from mw3_prelaunch_recovery import child_deadline').join('import math\n' + CHILD_DEADLINE_PY);
  write('owner-start.py', owner);
  let collect = read('collect.py');
  const start = index(collect, '  required=', index(collect, ' def validate_waits(self):'));
  const end = index(collect, '\n def run(', start);
  collect = collect.slice(0, start) + `  def value(n):return json.loads((self.dest/self.verified[n]['local']).read_bytes())
  common=['node-actual-wait.json','node-stdout.log','node-stderr.log','owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json']
  missing=[n for n in common if n not in self.verified]
  assert not missing,'actual waits/logs missing: '+repr(missing)
  node=value('node-actual-wait.json');owner=value('owner-actual-wait.json')
  assert owner['status']==(node['status'] & 255),'outer/inner exit status mismatch'
  for v in [node,owner]:assert v['actualParentWait'] is True and v['separateEOF']==dict(stdout=True,stderr=True),'actual parent wait/separate EOF required'
  assert node['readersJoined'] and not node['readerErrors'],'Node readers incomplete'
  marker='case-webgl/chrome-not-started.json'
  if marker in self.verified:
   proof=value(marker)
   assert proof['started'] is False and proof['spawnAttempted'] is False and proof['phase']=='before-chrome-spawn'
   assert proof['nodePid']==node['pid'] and node['status']!=0,'real failed Node owner required'
   forbidden=['case-webgl/'+n for n in ['chrome-spawn-attempt.json','process.json','chrome.stdout','chrome.stderr','chrome-parent-wait.json','chrome-exit.json','endpoint.json','launch.json']]
   assert not any(n in self.verified for n in forbidden),'contradictory Chrome evidence'
   self.recoverablePreChrome=True
   return
  required=['case-webgl/chrome-parent-wait.json','case-webgl/chrome.stdout','case-webgl/chrome.stderr']
  missing=[n for n in required if n not in self.verified]
  assert not missing,'actual waits/logs missing: '+repr(missing)
  chrome=value(required[0])
  assert chrome['actualParentWait'] is True and chrome['separateEOF']==dict(stdout=True,stderr=True),'actual parent wait/separate EOF required'
` + collect.slice(end);
  collect = once(collect, 'result=dict(passed=True,completedAt=', "result=dict(passed=True,recoverablePreChrome=getattr(self,'recoverablePreChrome',False),completedAt=");
  write('collect.py', collect);
  let watch = read('recover-watch.py');
  watch = once(watch, "if result['passed']:\n", "if result.get('recoverablePreChrome'):\n c.save('recoverable-prechrome.json',dict(at=time.time(),result=result,allocationDeadline=due,noStop=True,noReplay=True))\nelif result['passed']:\n");
  write('recover-watch.py', watch);
  if (fs.existsSync(path.join(dest, 'pin.py'))) {
    let pin = read('pin.py');
    if (!pin.includes("n=='tools/mw3-key-action-review.cjs'")) {
      pin = once(pin, "  if spec=='./':continue", "  if spec=='./':continue\n  if n=='tools/mw3-key-action-review.cjs' and spec=='../20261110-mw3-complete-fixture-closure-combat-2135/target.cjs':continue # installer literal; prepared browser resolves dependency");
    }
    pin = once(pin, 'edges=[];missing=[];', "paths.update(['tools/mw3-preparation.cjs','tools/mw3-prelaunch-recovery.js','tools/mw3-native-key-witness.test.cjs','tools/mw3-readiness-install.test.cjs','tools/mw3-key-action-review.test.cjs'])\nedges=[];missing=[];");
    pin = once(pin, "(R/'source-commit.txt').write_text(head+'\\n')", "(R/'source-commit.txt').write_text(head+'\\n')\nsubprocess.run(['node',str(ROOT/'tools/mw3-preparation.cjs'),str(R/'runtime-pins.json'),str(ROOT)],check=True)");
    write('pin.py', pin);
  }
}

module.exports = {child_deadline, install, once, CHILD_DEADLINE_PY};

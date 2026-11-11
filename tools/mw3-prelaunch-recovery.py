"""Prepare explicit pre-Chrome custody without weakening started/unknown recovery."""
import math

def child_deadline(allocation, now):
    assert math.isfinite(allocation) and math.isfinite(now)
    deadline = min(allocation - 600, now + 1740)
    assert deadline - now > 120, 'insufficient live allocation for child and recovery'
    return deadline

def once(text, old, new):
    assert text.count(old) == 1, 'exact prelaunch anchor required: '+old
    return text.replace(old, new)

def install(dest):
    browser = (dest/'browser.cjs').read_text()
    browser = once(browser, " browser=cp.spawn(", " save('chrome-spawn-attempt.json',{at:Date.now(),attempted:true});\n browser=cp.spawn(")
    browser = once(browser, ").catch(async e=>{observation.fail(e);", ").catch(async e=>{if(!browser&&!fs.existsSync(out+'/chrome-spawn-attempt.json'))save('chrome-not-started.json',{started:false,spawnAttempted:false,phase:'before-chrome-spawn',nodePid:process.pid,error:String(e)});observation.fail(e);")
    (dest/'browser.cjs').write_text(browser)
    owner = (dest/'owner-start.py').read_text()
    import re
    owner, count = re.subn(r'deadline=(?:float\(os.environ\[\'MW3_DEADLINE\'\]\)-360|min\(float\(os.environ\[\'MW3_DEADLINE\'\]\)-600,time.time\(\)\+1740\))',
        "from mw3_prelaunch_recovery import child_deadline\ndeadline=child_deadline(float(os.environ['MW3_DEADLINE']),time.time())", owner)
    assert count == 1, 'ordinary owner child deadline anchor'
    owner = "import sys\nfrom pathlib import Path\nsys.path.insert(0,str(Path(__file__).resolve().parents[3]/'tools'))\n" + owner
    # Importable adapter uses the same tracked implementation under its filename.
    owner = owner.replace('from mw3_prelaunch_recovery import child_deadline',
        "import runpy\nchild_deadline=runpy.run_path(str(R.parents[2]/'tools/mw3-prelaunch-recovery.py'))['child_deadline']")
    (dest/'owner-start.py').write_text(owner)
    collect = (dest/'collect.py').read_text()
    start = collect.index('  required=', collect.index(' def validate_waits(self):'))
    end = collect.index('\n def run(', start)
    collect = collect[:start] + '''  def value(n):return json.loads((self.dest/self.verified[n]['local']).read_bytes())
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
''' + collect[end:]
    collect = once(collect, 'result=dict(passed=True,completedAt=', "result=dict(passed=True,recoverablePreChrome=getattr(self,'recoverablePreChrome',False),completedAt=")
    (dest/'collect.py').write_text(collect)
    watch = (dest/'recover-watch.py').read_text()
    watch = once(watch, "if result['passed']:\n", "if result.get('recoverablePreChrome'):\n c.save('recoverable-prechrome.json',dict(at=time.time(),result=result,allocationDeadline=due,noStop=True,noReplay=True))\nelif result['passed']:\n")
    (dest/'recover-watch.py').write_text(watch)
    if (dest/'pin.py').exists():
        pin = (dest/'pin.py').read_text()
        if "n=='tools/mw3-key-action-review.cjs'" not in pin:
            pin = once(pin, "  if spec=='./':continue", "  if spec=='./':continue\n  if n=='tools/mw3-key-action-review.cjs' and spec=='../20261110-mw3-complete-fixture-closure-combat-2135/target.cjs':continue # installer literal; prepared browser resolves dependency")
        pin = once(pin, 'edges=[];missing=[];', "paths.update(['tools/mw3-preparation.cjs','tools/mw3-prelaunch-recovery.py','tools/mw3-native-key-witness.test.cjs','tools/mw3-readiness-install.test.cjs','tools/mw3-key-action-review.test.cjs'])\nedges=[];missing=[];")
        pin = once(pin, "(R/'source-commit.txt').write_text(head+'\\n')", "(R/'source-commit.txt').write_text(head+'\\n')\nsubprocess.run(['node',str(ROOT/'tools/mw3-preparation.cjs'),str(R/'runtime-pins.json'),str(ROOT)],check=True)")
        (dest/'pin.py').write_text(pin)

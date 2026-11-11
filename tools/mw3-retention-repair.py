"""Apply the narrow repair to exact retained MW3 controller inputs.

Writes five repaired inputs, or seven integrated ordinary-0500 inputs, into an owned run.
The source run remains untouched. Pin the resulting files with the other runtime
inputs before use; this tool neither provisions nor starts an original/box.
"""
from pathlib import Path
import argparse
import subprocess


def replace_once(text, old, new):
    assert text.count(old) == 1, 'exact MW3 controller anchor missing or ambiguous'
    return text.replace(old, new)


def repair(source, dest):
    source, dest = Path(source).resolve(), Path(dest).resolve()
    assert source != dest and dest.is_dir()
    browser = (source / 'browser.cjs').read_text()
    # The ordinary 0500 inputs already include the retention/readiness repair.
    # Regenerate their pre-instantiation observer by default, rather than
    # leaving a stale serialized function in the next original's prefix.
    if "require('./dispatch-observer.cjs')" in browser and 'mw3-preclick-readiness.cjs' in browser:
        names = ['browser.cjs', 'dispatch-observer.cjs', 'worker-prefix.js',
                 'throttle.cjs', 'owner-start.py', 'collect.py', 'recover-watch.py']
        assert all(not (dest / name).exists() for name in names), 'prepared input exists'
        tool = Path(__file__).with_name('mw3-readiness-install.cjs')
        subprocess.run(['node', str(tool), str(source), str(dest)], check=True)
        for name in names[4:]:
            with (dest/name).open('x') as f:
                f.write((source/name).read_text())
        return
    old = "await wait(300);require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs').validate(await menuObserver.read());"
    new = "await require(root+'/tools/mw3-preclick-readiness.cjs').ready({observer:menuObserver,validate:require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs').validate,deadline:commandWorkEnd,wait,save,label:c.label,checkIdentity:async()=>bound.same(receipt.live.identity,(await chain.readLive()).identity)});"
    browser = replace_once(browser, old, new)
    browser = browser.replace("require('../20261110-mw3-complete-fixture-closure-combat-2135/dispatch-observer.cjs')", "require('./dispatch-observer.cjs')")
    observer = (source/'dispatch-observer.cjs').read_text()
    observer = replace_once(observer, "read:async()=>normalize(await ev('__mw3ReadObserver.snapshot()'))", "read:async()=>{const v=normalize(await ev('__mw3ReadObserver.snapshot()'));save('dispatch-last-snapshot.json',v);const live=await ev(bound.WORKER_READ);assert.equal(live.instance,identity.workerInstance);assert.equal(live.endpointIdentity,identity.endpoint);return v;}")
    # Menu readiness must precede every native event, including cursor motion.
    browser = replace_once(browser, "if(!c.guestPoint)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},pageSession);", "down=async()=>{if(!c.guestPoint)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y},pageSession);return send('Input.dispatchMouseEvent',{type:'mousePressed',...base},pageSession);};")
    # Preserve the cursor-motion behavior for ordinary clicks too.
    browser = replace_once(browser, "down=()=>send('Input.dispatchMouseEvent',{type:'mousePressed',...base},pageSession);", "// down is constructed above; no native event before readiness")

    owner = (source / 'owner-start.py').read_text()
    owner = owner.replace("(R/'owner-", "(d/'owner-")
    owner = replace_once(owner, 'sys.exit(p.returncode)', """# Publish last, after communicate has performed the actual wait and both EOFs.
import hashlib
names=['owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json','terminal-manifest.json']
rows=[]
for name in names:
 b=(d/name).read_bytes();rows.append(dict(path=name,size=len(b),sha256=hashlib.sha256(b).hexdigest()))
with (d/'owner-terminal-manifest.json').open('x') as f:json.dump(dict(rows=rows,actualOuterFinalization=True),f)
sys.exit(p.returncode)""")
    collect = (source / 'collect.py').read_text()
    collect = replace_once(collect, "if final:\n", "if final and self.exists('owner-terminal-manifest.json'):\n")
    collect = replace_once(collect, 'self.validate_waits()', """outer_raw=self.get('owner-terminal-manifest.json');outer=json.loads(outer_raw)
     assert outer['actualOuterFinalization'] is True
     assert {r['path'] for r in outer['rows']}=={'owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json','terminal-manifest.json'},'outer receipt set'
     self.batch(outer['rows'])
     assert self.get('owner-terminal-manifest.json')==outer_raw,'outer manifest changed'
     self.recover(dict(path='owner-terminal-manifest.json',size=len(outer_raw),sha256=digest(outer_raw)))
     self.validate_waits()""")
    collect = replace_once(collect, "node=value(required[0]);chrome=value(required[1])", """node=value(required[0]);chrome=value(required[1])
  for name in ['owner-stdout.raw','owner-stderr.raw','owner-actual-wait.json']:
   assert name in self.verified,'outer actual wait/stream missing: '+name
  owner=value('owner-actual-wait.json')
  assert owner['status']==(node['status'] & 255),'outer/inner exit status mismatch'""")
    collect = replace_once(collect, 'for v in [node,chrome]:', 'for v in [node,chrome,owner]:')
    # recover-watch already roots Collector at runtime and gates finish-request
    # on its passed result. Its exact source now includes the outer barrier.
    for name, text in [('browser.cjs', browser), ('dispatch-observer.cjs', observer), ('owner-start.py', owner),
                       ('collect.py', collect), ('recover-watch.py', (source/'recover-watch.py').read_text())]:
        with (dest/name).open('x') as f:
            f.write(text)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source', type=Path)
    p.add_argument('dest', type=Path)
    a = p.parse_args()
    repair(a.source, a.dest)

import run as c,json,hashlib,pathlib,tarfile
paths=['tools/airstrike-menu-controller.py','tools/airstrike-observation-bridge.py','test/test-airstrike-console-obscuration.py']
rows={p:hashlib.sha256((c.R/p).read_bytes()).hexdigest() for p in paths}
c.dump('candidate-source-pins.json',rows)
# Preserve reconstructable first regression incident source with its observed hash.
b=(c.H/'superseded-minimize-airstrike-menu-controller.py').read_text().replace("completion_snapshot = completion.get('snapshot', {})", "snapshot = completion.get('snapshot', {})").replace("completion_snapshot.get(","snapshot.get(")
assert hashlib.sha256(b.encode()).hexdigest()=='3ed04e089f18dac76ff822d5899f1e610cffe677cfbb713c5425002b033f5b78'
(c.H/'failed-controller-shadowed-snapshot.py').write_text(b)
# Baseline receipts reused by identity, never run donor wrappers.
external={}
for p in [pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo/docs/reviews/airstrike-accepted-frozen-dispatch-main-integrate-oct27/receipt.json'),pathlib.Path('/tmp/airstrike-frozen-dispatch-independent-accept-oct27/ops/reused-regressions.json'),pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/result.json')]:
 external[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
c.dump('reused-baseline.json',dict(externalPins=external,historicalCounts=dict(totalDispatchAndControllerAndBridge=25,bridgeSubset=12),interpretation='Unchanged runner protocol/test closure receipts reused as baseline; changed controller/bridge behavior qualified by new focused tests, not claimed same-hash historic source acceptance.'))
with tarfile.open('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar') as t:
 names=[x.name for x in t.getmembers() if 'renderer' in x.name]
 print('runner archive renderer paths',names)
print('Candidate source pins and historical receipts recorded.')
import ast,difflib
D=pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo')
changes=[]
for p in paths[:2]:
 changes.extend(difflib.unified_diff((D/p).read_text().splitlines(True),(c.R/p).read_text().splitlines(True),fromfile='accepted/'+p,tofile='candidate/'+p))
(c.H/'source-review.diff').write_text(''.join(changes))
old=(D/paths[0]).read_text();new=(c.R/paths[0]).read_text()
assert old[old.index('        # Only a positively observed Quit'):]==new[new.index('        # Only a positively observed Quit'):]
# Preserve exact existing transport/ACK/cleanup implementations.
def methods(text):
 tree=ast.parse(text);cl=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Bridge')
 return {n.name:ast.dump(n,include_attributes=False) for n in cl.body if isinstance(n,ast.FunctionDef)}
a,z=methods((D/paths[1]).read_text()),methods((c.R/paths[1]).read_text())
for name in ['write','ack','request','request_ack','finish_terminal','group','run','pump','check','capture','focus']:assert a[name]==z[name],name
with tarfile.open('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar') as t:
 for name in ['lib/renderer-input.js','lib/renderer.js']:
  data=t.extractfile(name).read();(c.H/('production-'+pathlib.Path(name).name)).write_bytes(data)
  print(name,hashlib.sha256(data).hexdigest())
c.dump('control-preservation-pass.json',dict(unchangedTerminalValidation=True,unchangedBridgeMethods=['write','ack','request','request_ack','finish_terminal','group','run','pump','check','capture','focus'],newTests=10,sourcePins=rows))
print('Review diff retained, terminal/ownership/ACK/cleanup AST identities PASS.')

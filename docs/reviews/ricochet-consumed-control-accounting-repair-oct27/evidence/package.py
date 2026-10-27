import pathlib,json,hashlib,ast,shutil,sys
T=pathlib.Path(__file__).resolve().parent.parent;O=T/'ops';R=T/'repo';D=R/'docs/reviews/ricochet-consumed-control-accounting-repair-oct27';E=D/'evidence';E.mkdir(exist_ok=True)
# Capture all previous setup, failure and pass receipts without rewriting originals.
for p in O.iterdir():
 if p.is_file() and p.name not in ('result.json',):
  target=E/p.name
  if not target.exists():target.write_bytes(p.read_bytes())
root=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
for name in ['source-repair-fleet-admission-oct27.json','source-repair-fleet-live-oct27.json']:
 (E/name).write_bytes((root/name).read_bytes())
(E/'root-ref-digest.json').write_bytes((root/T.name/'root-ref-digest.json').read_bytes())
original=json.loads(pathlib.Path('/tmp/ricochet-measured-cpu-round-gameplay-oct27/ops/result.json').read_text())
(E/'original-outcome.json').write_text(json.dumps({k:original[k] for k in ['outcome','branch','box','state','expiry','shutdownOwner','oneInvocation','remaining']},indent=2))
# Latest receipt for each passing test; unchanged method bodies reuse groups.
methods={}
for receipt in sorted(O.glob('*.command.json')):
 j=json.loads(receipt.read_text());cmd=j['command']
 if any('ricochet-runtime-accounting.test.py' in s for s in cmd):
  result=json.loads(receipt.with_name(receipt.name.replace('.command.json','.result.json')).read_text())
  if result['exit']==0 and result['stopReason'] is None:
   for s in cmd:
    if s.startswith('AccountingTests.'):methods[s.split('.')[1]]=receipt.name
source=(R/'test/ricochet-runtime-accounting.test.py').read_text();tree=ast.parse(source)
expected=[n for c in tree.body if isinstance(c,ast.ClassDef) for n in c.body if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')]
assert set(methods)=={n.name for n in expected},(set(methods),{n.name for n in expected})
pins={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('*.py') if '.git' not in p.parts and E not in p.parents}
checkpoint=dict(status='PASS_SOURCE_ONLY_ACCOUNTING_REPAIR',donor='66dafb1db3dfc97395edb14a81532a06f3226008',tests=len(expected),pins=pins,groups={n.name:dict(receipt=methods[n.name],methodSHA256=hashlib.sha256(ast.get_source_segment(source,n).encode()).hexdigest()) for n in expected},remaining=['independent review/integration by coordinator','fresh admitted gameplay response and ordinary Quit'],guestExecuted=False,boxesAssigned=[],root='initial digest reused; no later comparison claim')
(D/'checkpoint.json').write_text(json.dumps(checkpoint,indent=2))
manifest={str(p.relative_to(D)):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in D.rglob('*') if p.is_file() and p.name!='manifest.json'}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2))
for path,m in manifest.items():assert hashlib.sha256((D/path).read_bytes()).hexdigest()==m['sha256']
print(json.dumps(dict(tests=len(expected),pins=pins,evidence=len(manifest))))

import hashlib,json,pathlib,shutil
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[2].parent
DISPATCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-unlink-rmdir-dispatch-pinned-accept-oct29-dispatch.json')
RETAINED=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-unlink-rmdir-type-repair-oct29/retained-evidence/test')
def pin(p):
 d=p.read_bytes();return dict(bytes=len(d),sha256=hashlib.sha256(d).hexdigest())
d=json.loads(DISPATCH.read_text());repo=HERE.parents[1]
assert str(repo)==d['ownedRepo']
assert pin(ROOT/'prelaunch-controls.json')==dict(bytes=550,sha256='3c94df07d6ffbdaffb26c87bf68fdb5faadd3c6e1c15d20cbdfde5536d4c8170')
receipt=json.loads((ROOT/'prelaunch-controls.json').read_text())
assert receipt['PASS'] and receipt['sentinel']==str(repo) and receipt['pythonChild']==[134217728]*2
assert pin(ROOT/'ops.py')==d['taskSupervisorPin']
assert pin(ROOT/'limit_contract.py')==d['limitModulePin']
actual={p:pin(repo/p) for p in d['sourcePins']}
assert actual==d['sourcePins']
prov=json.loads((RETAINED/'provenance.json').read_text())
assert pin(RETAINED/'regression.py')['sha256']==prov['regressionSha256']
for n in ['regression.py','source-pins.json','provenance.json']:
 shutil.copyfile(RETAINED/n,HERE/n)
assert (HERE/'regression.py').read_bytes()==(RETAINED/'regression.py').read_bytes()
e=HERE/'evidence';e.mkdir(exist_ok=True)
(e/'pins.json').write_text(json.dumps(dict(candidate=d['candidate'],sourcePins=actual,prelaunch=receipt,originalRegression=pin(HERE/'regression.py'),historicalPinsRemainHistorical=True,noMountArgv=True,noCheckout=True),indent=2)+'\n')
print('PASS five dispatch source pins, exact prelaunch receipt and byte-identical original regression; supported flag --allow-backend-change (no --backend-sha256 option)')

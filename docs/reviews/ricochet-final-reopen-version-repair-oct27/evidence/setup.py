import pathlib,hashlib,json,shutil,os
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo';D=pathlib.Path('/tmp/ricochet-final-inventory-writer-contract-repair-oct27/repo');A=pathlib.Path('/tmp/ricochet-final-writer-independent-accept-oct27/repo/docs/reviews/ricochet-final-writer-independent-accept-oct27')
paths=['tools/ricochet/runtime-accounting.py','test/ricochet-runtime-accounting.test.py','test/ricochet-consumed-independent.test.py','test/ricochet-final-inventory-independent.test.py','docs/reviews/ricochet-consumed-control-accounting-repair-oct27/integrate.py','docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27/integrate.py','docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/remote-supervisor.py','docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/trusted-supervisor.py']
pins={}
for p in paths:
 b=(D/p).read_bytes();q=R/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b);pins[p]=hashlib.sha256(b).hexdigest()
assert (R/paths[0]).read_bytes()==(O/'source-pin.stdout').read_bytes()
assert pins[paths[0]]=='580a0fa000c2784f3bbfdb91ad100a6c91c1b1a558729b27756727d183f558de'
shutil.copyfile(A/'evidence/final-reopen-mutation.py',O/'final-reopen-mutation.py')
shutil.copyfile(A/'checkpoint.json',O/'original-rejection-checkpoint.json');shutil.copyfile(A/'manifest.json',O/'original-rejection-manifest.json')
(O/'input-pins.json').write_text(json.dumps(pins,indent=2));print(json.dumps(pins))

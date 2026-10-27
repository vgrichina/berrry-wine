import pathlib, shutil, hashlib, json
H=pathlib.Path(__file__).parent; R=H.parent/'repo'
D=pathlib.Path('/tmp/enigma-retained-review-budget-publication-oct27')
A=pathlib.Path('/tmp/enigma-review-budget-independent-accept-oct27')
assert hashlib.sha256((A/'ops/receipt-manifest.json').read_bytes()).hexdigest()=='8c666785875098d791a21bef0709a884440fb9e6db7d85d8768f203bf8d80d55'
pins=json.loads((D/'ops/receipt-manifest.json').read_text())['sourcePins']
for p,h in pins.items():
 assert hashlib.sha256((D/'repo'/p).read_bytes()).hexdigest()==h,p
for name in ['tools','test/fixtures/enigma-controller']:
 dst=R/name; dst.mkdir(parents=True,exist_ok=True)
 for p in (D/'repo'/name).glob('*.py'): shutil.copy2(p,dst/p.name)
for name in ['independent-transfer.py','independent-review.py','original-reproducer.py']:
 p=A/'repo/test/fixtures/enigma-controller'/name
 if p.exists(): shutil.copy2(p,R/'test/fixtures/enigma-controller'/name)
shutil.copy2(A/'ops/original-reproducer.py',H/'original-reproducer.py')
(H/'input-pins.json').write_text(json.dumps({str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('*.py')},indent=2))
(H/'configuration.json').write_text(json.dumps(dict(candidate='8ff456e70baa82386e4e51c22f7174409746d326',mount='N/A offline production Python main/HTTP; no guest filename-bearing mount argv',trustedSSH='launcher exact configuration in run.py',rootReceipt='/home/user/wine-assembly/scratch/usage-watch/enigma-frame-accounting-corrected-admission-oct27/root-ref-digest.json',initialDisplayIncident='Initial policy output exceeded8192B; retained tool transcript; bounded subsequent displays')))
print('Pinned production closure copied; canonical rejection verified; no donor writes')

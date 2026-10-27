import pathlib,shutil,hashlib,json
H=pathlib.Path(__file__).parent;R=H.parent/'repo';D=pathlib.Path('/tmp/enigma-frame-accounting-corrected-admission-oct27');A=pathlib.Path('/tmp/enigma-review-budget-independent-accept-oct27/repo')
p=D/'ops/receipt-manifest.json'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='dbb7158a194b94a5860d8efcc19f27f0ce409ee5fd66b374ccb48356bae604fa'
m=json.loads(p.read_text())
for name,h in m['sourcePins'].items():
 s=D/'repo'/name;assert hashlib.sha256(s.read_bytes()).hexdigest()==h,name
for name in ['tools','test/fixtures/enigma-controller']:
 dst=R/name;dst.mkdir(parents=True,exist_ok=True)
 for s in (D/'repo'/name).glob('*.py'):shutil.copy2(s,dst/s.name)
s=A/'test/fixtures/enigma-controller/independent-transfer.py'
shutil.copy2(s,R/'test/fixtures/enigma-controller/independent-transfer.py')
shutil.copy2(p,H/'producer-receipt.json')
(H/'input-pins.json').write_text(json.dumps({str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('*.py')},indent=2))
(H/'configuration.json').write_text(json.dumps(dict(candidate='37bad5b6a919a62b4e385b72219c2bb2b01a223b',mount='N/A: offline Python main, no guest mount argv',rootReceipt='/home/user/wine-assembly/scratch/usage-watch/enigma-full-frame-independent-accept-oct27/root-ref-digest.json',incidents=['Initial combined displays exceeded8192B; original transcript retained'],priorGroups='11 production controls + 4 related groups reused only on unchanged pins')))
print('Exact canonical receipt/source pins and unchanged original oracle verified; copied Python closure only')

import pathlib, shutil, hashlib, json
H=pathlib.Path(__file__).parent; R=H.parent/'repo'
D=pathlib.Path('/tmp/enigma-retained-review-budget-publication-oct27')
pins=json.loads((D/'ops/receipt-manifest.json').read_text())['sourcePins']
for p,h in pins.items():
 assert hashlib.sha256((D/'repo'/p).read_bytes()).hexdigest()==h,p
for name in ['tools','test/fixtures/enigma-controller']:
 src=D/'repo'/name; dst=R/name; dst.mkdir(parents=True,exist_ok=True)
 for p in src.glob('*.py'):
  shutil.copy2(p,dst/p.name)
p=D/'ops/original-reproducer.py'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='6665d61da745a7c33546b15b73f5311ccda51b6f978d6905f1e455ab06fea461'
shutil.copy2(p,R/'test/fixtures/enigma-controller/original-reproducer.py')
shutil.copy2(p,H/'original-reproducer.py')
pins.update({str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('*.py')})
(H/'verified-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
(H/'configuration.json').write_text(json.dumps(dict(mount='N/A offline HTTP fixture only; no guest mount argv',ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',candidate='8ff456e70baa82386e4e51c22f7174409746d326',canonicalManifestSHA256=hashlib.sha256((D/'ops/receipt-manifest.json').read_bytes()).hexdigest()),indent=2)+'\n')
print('source/fixture/reproducer pins verified; unchanged copied fixture closure')

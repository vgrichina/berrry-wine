import pathlib,hashlib,json,os,difflib
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);R=O.parent/'repo';P=R/'docs/reviews/ricochet-final-reopen-version-repair-oct27';D=pathlib.Path('/tmp/ricochet-final-inventory-writer-contract-repair-oct27/repo')
manifest=json.loads((P/'manifest.json').read_text())
for name,pin in manifest.items():
 b=(P/name).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],name
checkpoint=json.loads((P/'checkpoint.json').read_text());changes=[];diff=[]
for name,pin in checkpoint['sourceAndTestPins'].items():
 p=R/name;b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==pin['sha256'],name
 if not (D/name).exists() or b!=(D/name).read_bytes():
  changes.append(name);before=(D/name).read_text().splitlines(True) if (D/name).exists() else []
  diff+=difflib.unified_diff(before,b.decode().splitlines(True),fromfile='candidate/'+name,tofile='repair/'+name)
assert set(changes)=={'tools/ricochet/runtime-accounting.py','test/ricochet-final-reopen-version.test.py','docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27/integrate.py'},changes
(O/'review.diff').write_text(''.join(diff));(O/'review.json').write_text(json.dumps(dict(status='PASS',payloads=len(manifest),pins=len(checkpoint['sourceAndTestPins']),changedExactPaths=changes,scope='orphan sparse report, not mergeable whole'),indent=2))
# Supplement safe digest identities for earlier v1 receipts without rerunning tests.
supplement={}
for p in O.glob('*.command.json'):
 j=json.loads(p.read_text());supplement[p.name]={'argvSHA256':hashlib.sha256(json.dumps(j['argv']).encode()).hexdigest(),'safeEnvironmentSHA256':hashlib.sha256(json.dumps(j['environment'],sort_keys=True).encode()).hexdigest(),'receiptSHA256':hashlib.sha256(p.read_bytes()).hexdigest()}
(O/'command-identity-supplement.json').write_text(json.dumps(supplement,indent=2));print(json.dumps(dict(status='PASS',payloads=len(manifest),changed=changes)))

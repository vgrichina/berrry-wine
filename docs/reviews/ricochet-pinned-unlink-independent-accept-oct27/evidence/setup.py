import pathlib,json,hashlib,difflib,shutil
O=pathlib.Path('/tmp/ricochet-pinned-unlink-independent-accept-oct27/ops');R=O.parent/'repo';D=pathlib.Path('/tmp/ricochet-pinned-unlinked-version-repair-oct27');m=json.loads((D/'ops/receipt-manifest.json').read_text());pins={}
for p,pin in m['sourceTestPins'].items():
 f=D/'repo'/p;b=f.read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'];t=R/p;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(b);pins[p]=pin
src=R/'tools/ricochet/runtime-accounting.py';assert len(src.read_bytes())==14705
original=pathlib.Path('/tmp/ricochet-reopen-independent-integrate-oct27/ops/independent-boundary.py').read_bytes();assert hashlib.sha256(original).hexdigest()=='7662740500f056178a7b8c993c7d75bba9401535ae564ce73581b6c65710620f'
(O/'original-independent-boundary.py').write_bytes(original)
new=original.replace(b'6f260e812cdfa6c1695a73cf11fd7f9516c690e7f4c111737276bd7b6359d732',m['source']['sha256'].encode());(O/'independent-boundary.py').write_bytes(new)
(O/'adaptation.diff').write_text(''.join(difflib.unified_diff(original.decode().splitlines(True),new.decode().splitlines(True),fromfile='immutable-original',tofile='candidate-source-pin-only')))
(O/'input-pins.json').write_text(json.dumps(dict(candidate='03b1c12fb6edd1ca88ff51658fea811f26c740ec',sourceTestPins=pins,donorManifestSHA256=hashlib.sha256((D/'ops/receipt-manifest.json').read_bytes()).hexdigest(),source=str(src),originalScriptSHA256=hashlib.sha256(original).hexdigest(),adaptedScriptSHA256=hashlib.sha256(new).hexdigest(),pathRetarget='RICOCHET_ACCEPT_OPS owned env before import; TMPDIR owned fixtures',reuse=m['reusedReceipts'],rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/ricochet-pinned-unlink-independent-accept-oct27/root-ref-digest.json',mountValidation='No mounts or runtime in source/Python-only task; not applicable',ssh='Exact prescribed driver GIT_SSH_COMMAND before every child'),indent=2))
shutil.copyfile(D/'ops/receipt-manifest.json',O/'donor-receipt-manifest.json');shutil.copyfile(D/'ops/input-pins.json',O/'donor-input-pins.json')
print('Pinned actual 14705-byte candidate and 8 current source/test paths; immutable 12-path dependency closure referenced, no payload reaudit; reproducer adapted source hash only.')

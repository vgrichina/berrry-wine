"""Verify this task's sealed acquisition-blocker evidence offline."""
import pathlib,hashlib,tarfile,io,json
r=pathlib.Path(__file__).parent;b=(r/'evidence.tgz').read_bytes()
assert len(b)==299823
assert hashlib.sha256(b).hexdigest()=='994e37183e275bb7222546a9f3d2af3a962f55f814be98db50fe4fb5c5bb4bf2'
with tarfile.open(fileobj=io.BytesIO(b),mode='r:gz') as t:
 files={m.name:t.extractfile(m).read() for m in t.getmembers() if m.isfile()}
seals=json.loads(files['SHA256SUMS.json'])
for f in seals:
 data=files[f['path']];assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256']
o=json.loads(files['outcome.json']);i=json.loads(files['source-identity.json'])
assert len(i['files'])==o['sourceFilesVerified']==7403
assert o['sourceCommit']=='fe49a84e745015ecdbe752e028235924ef4324dc'
assert o['moduleSha256']=='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
assert o['availableRecoveryMappings']+len(o['missingOriginalMappings'])==o['recoveryMappings']==361
assert len(o['missingOriginalMappings'])==174 and o['predecessorSealsVerified']==87
assert o['ordinaryLaunchProbesUsed']==0 and o['predicate'] is None and not o['localizedDefectProven']
assert not o['sourceChanges'] and not o['installationRepeated'] and not o['installedRestoreCompleted']
assert b'Connection timed out after 120001 milliseconds' in files['jedi-download.log']
assert b'error: 500' in files['jedi-download-direct.log']
assert b'Timeout was reached' in files['jedi-download-mirror.log']
assert b'DirectX 5.0 drivers are required' in files['predecessor/launch2/output.log']
assert b'Build complete: build/wine-assembly.wasm (1878508 bytes)' in files['jedi-build.log']
print(json.dumps(dict(pass_=True,seals=len(seals),sourceFiles=7403,availableMappings=187,missingOriginalMappings=174,launchProbes=0,predicate=None)))

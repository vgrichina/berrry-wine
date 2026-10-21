import pathlib,hashlib,json,subprocess,datetime,tarfile
r=pathlib.Path('/home/user/jedi-predicate');s=pathlib.Path('/home/user/jedi-source');e=r/'predecessor'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((r/'predecessor.tgz').read_bytes())=='fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb'
seals=json.loads((e/'SHA256SUMS.json').read_text())
for row in seals:
 b=(e/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
identity=json.loads((r/'source-identity.json').read_text())
for row in identity['files']:
 b=(s/row['path']).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==row['gitBlob']
assert sha((s/'build/wine-assembly.wasm').read_bytes())==identity['moduleSha256']=='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
assert subprocess.check_output(['git','status','--porcelain'],cwd=s,text=True)==''
assert not (r/'jedidemo.exe').exists()
trees=json.loads((e/'recovery-trees.json').read_text())['trees'];missing=[];available=0
for tree,rows in trees.items():
 for row in rows:
  rec=row['recovery']
  if rec['kind']=='original':missing.append(dict(tree=tree,path=row['path'],original=rec['path'],sha256=row['sha256']))
  else:
   p=(s if rec['kind']=='source' else e/'recovery-payload')/rec['path'];assert sha(p.read_bytes())==row['sha256'];available+=1
out=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),outcome='blocked',blocker='Hash-pinned original package unavailable: archive connection timeouts and preserved mirror HTTP 500; no local original files found.',sourceCommit=identity['sourceCommit'],sourceFilesVerified=len(identity['files']),moduleSha256=identity['moduleSha256'],canonicalBuild='PASS, redundant rebuild before discovery of ignored matching preserved module',predecessorSealsVerified=len(seals),recoveryMappings=sum(map(len,trees.values())),availableRecoveryMappings=available,missingOriginalMappings=missing,ordinaryLaunchProbesUsed=0,installationRepeated=False,installedRestoreCompleted=False,predicate=None,apiExpectedVsActual=None,localizedDefectProven=False,sourceChanges=False,normalLaunchResult='Not retested; accepted predecessor Play reaches DirectX5 requirement dialog.',box='bx_wbedea9e',expiry='2026-10-21T18:01:57.547Z',shutdownOwner='coordinator',leaveRunning=True)
(r/'outcome.json').write_text(json.dumps(out,indent=2))
paths=['outcome.json','source-identity.json','recover-layout.py','restore.py','original-inventory.json','predecessor/launch2/output.log','predecessor/launch2/launch.json','predecessor/launch2/play-input.json']
for p in pathlib.Path('/home/user').glob('jedi-*.log'):
 (r/p.name).write_bytes(p.read_bytes());paths.append(p.name)
for name in ['mirror-page.html','mirror-resolved.html']:
 if (r/name).exists():paths.append(name)
seal=[dict(path=p,bytes=(r/p).stat().st_size,sha256=sha((r/p).read_bytes())) for p in paths]
(r/'SHA256SUMS.json').write_text(json.dumps(seal,indent=2))
with tarfile.open(r/'evidence.tgz','w:gz') as t:
 for p in paths+['SHA256SUMS.json']:t.add(r/p,arcname=p)
print(json.dumps({k:v for k,v in out.items() if k!='missingOriginalMappings'},indent=2))
print('missing original mappings',len(missing),'archive', (r/'evidence.tgz').stat().st_size,sha((r/'evidence.tgz').read_bytes()))

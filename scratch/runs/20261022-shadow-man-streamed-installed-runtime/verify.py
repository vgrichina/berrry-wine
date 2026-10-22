"""Offline evidence verifier. No transport, guest, source compile or ownership fix."""
import pathlib,json,hashlib,subprocess,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
BASE='58e90870a40a541a4083cae5e987ca8de31889e6';PREFIX='/home/user/shadow-man-streamed-installed-runtime-oct22/immutable/restored/'
def read(n):return json.loads((E/n).read_text())
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def verify():
 t=read('transfer-complete.json');assert t['passAll'] and t['files']==2083 and t['bytes']==186399681 and t['archiveBytes']==190771200
 rows=[json.loads(x) for x in (E/'transfer-files.jsonl').read_text().splitlines()];assert len(rows)==2083 and sum(x['bytes'] for x in rows)==186399681
 mapping={x['path'].removeprefix(PREFIX):x for x in rows};assert len(mapping)==2083
 a=read('accepted-installed-payload.json');assert a['files']==1959 and len(a['mapping'])==1959 and a['originalPayloadBytes']==100354053
 for x in a['mapping']:
  r=mapping['parent-vfs/'+x['installed']['path']];assert r['bytes']==x['original']['size'] and r['sha256']==x['original']['sha256']
 registry=read('registry-transfer.json');h=sha(E/'accepted-parent-registry.json');assert registry['bytes']==17088 and registry['sha256']==h==mapping['parent-registry.json']['sha256']=='d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3'
 g=json.loads(read('hash-gate-api.json')['stdout']);assert g['passAll'] and g['originalFilesMatched']==1959 and g['runtimePaths']==158 and g['codecFiles']==23
 assert g['moduleBytes']==1879387 and g['moduleSHA256']=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
 f=read('mutable-prepare-api.json');assert f['exitCode']==1 and 'PermissionError: [Errno 13]' in f['stderr'] and '/mutable/vfs' in f['stderr'] and 'copytree' in f['stderr']
 hand=json.loads(read('handback-api.json')['stdout']);assert hand['guestAttempts']==0 and hand['ownedGuestProcessGroups']==[] and hand['mutableEntries']==[] and hand['tmpfsUsed']==0
 assert hand['mutableUid']==0 and hand['workerUid']==1000 and hand['mutableMode']=='0o755' and hand['immutableReadOnly']
 assert read('box-state.json')['state']=='idle' and read('box-state.json')['health']=='ok' and read('box-state.json')['stop'] is None
 assert read('guard-fixture-result.json')['rejectingControls']==5 and read('forwarding-fixture-result.json')['assertions']==10 and read('dependency-preflight.json')['png']['roundTrip']
 old=pathlib.Path('/home/user/wine-assembly-shadow-man-installed-game-bounded-launch-oct22/scratch/runs/20261022-shadow-man-installed-game-bounded-launch/watchdog.py');assert sha(old)==sha(E/'watchdog.py')
 for x in read('protected-before.json'):
  p=pathlib.Path(x['path']);assert (sha(p) if p.is_file() else None)==x['sha256'],str(p)
 env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
 original=subprocess.check_output(['git','ls-tree','-r',BASE],cwd=W,env=env).decode().splitlines()
 index=subprocess.check_output(['git','ls-files','--stage'],cwd=W,env=env).decode().splitlines()
 tree={p:m.split()[:2] for line in original for m,p in [line.split('\t',1)]}
 # ls-tree has mode/type/oid, index mode/oid/stage.
 tree={p:[m.split()[0],m.split()[2]] for line in original for m,p in [line.split('\t',1)]}
 idx={p:m.split()[:2] for line in index for m,p in [line.split('\t',1)]}
 for p,v in tree.items():assert idx[p]==v,p
 runtime=read('runtime-manifest.json');assert len(runtime)==158
 for x in runtime:assert tree[x['path']]==[x['mode'],x['blob']]
 assert {x['path'] for x in runtime if x['blob']!=x['oldBlob']}=={'lib/dll-registry.js','lib/process-boot.js','lib/storage.js'}
 pins=read('codec-pins.json')['files'];assert len(pins)==23
 local=W/'runtime'
 for x in runtime:
  p=local/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
 for x in pins:
  p=local/x['path'].removeprefix('runner/');assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
 a=read('allocation-final.json');own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);donors=sum(int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['reusedWholeDonors'])
 total=own+donors+a['rootSourcesAndObjects']+a['otherReadObjectsToolsAllowance']+a['streamWorkingAllowance']+a['reserve']+a['publicationAllowance']
 assert total<67108864 and shutil.disk_usage(W).free>=2982150144
 assert hand['immutableAllocated']<2147483648 and hand['fixedAllocated']+16777216<100663296 and hand['tmpfsCap']==939524096 and hand['freeBytes']>=2147483648
 assert g['allocation']['projectedTmpfs']==885211136<939524096 and 100663296+939524096+33554432==1073741824
 return dict(passAll=True,verdict='BLOCKED_MUTABLE_CLONE_PERMISSION',basePathsPreserved=len(tree),originalPayloadFilesVerified=1959,restoredFiles=2083,registrySHA256=h,moduleSHA256=g['moduleSHA256'],guestAttempts=0,preguestGate='INCOMPLETE; stopped before remote fixtures/command plan',protectedMetadata='UNCHANGED',ownAllocated=own,wholeLocalConservative=total,cap=67108864,hostFree=shutil.disk_usage(W).free)
if __name__=='__main__':
 r=verify();(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))

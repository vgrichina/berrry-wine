import pathlib, subprocess, json, hashlib, shutil, os, time, difflib
B=pathlib.Path('/tmp/browser-key-reentrant-retained-accept-oct26'); O=B/'ops'; R=B/'repo'
OLD=pathlib.Path('/tmp/browser-key-reentrant-independent-accept-oct26')
D=pathlib.Path('/tmp/browser-key-reentrant-focus-ownership-repair-oct26/repo')
C=pathlib.Path('/tmp/keyboard-focus-renderer-interoperability-oct26/repo')
T=pathlib.Path('/tmp/renderer-side-polling-merged-branch-oct26/repo')
SHA='be746ec811b98365c378609ca936502783bb106d'
BRANCH='task/browser-key-reentrant-retained-accept-oct26'
E=R/'docs/reviews/browser-key-reentrant-retained-accept-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def h(b): return hashlib.sha256(b).hexdigest()
def write(p,v):
 p.parent.mkdir(parents=True,exist_ok=True)
 temp=p.with_suffix(p.suffix+'.tmp');temp.write_text(json.dumps(v,indent=2)+'\n');temp.replace(p)
def git(repo,*args): return subprocess.check_output(['git','-C',str(repo),*args],stderr=subprocess.PIPE)
def admission(phase):
 v=json.loads((O/'resource-precheckout.json').read_text())
 v.update(at=time.time(),phase=phase,memAvailable=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024,freeDisk=shutil.disk_usage(B).free)
 # Standing launcher/session logs and positive WAL growth counted once. Future
 # allowance remains conservative; no negative shared WAL credit is taken.
 launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/browser-key-reentrant-retained-accept-oct26')
 own=int(subprocess.check_output(['du','-sb',str(B)]).split()[0])
 launched=int(subprocess.check_output(['du','-sb',str(launcher)]).split()[0])
 wals={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 walbytes=sum(wals.values())
 initial=O/'wal-initial.json'
 if not initial.exists(): write(initial,dict(bytes=walbytes))
 # No launch-time all-WAL baseline was supplied. Conservatively charge all
 # current WAL bytes once, which bounds positive task growth without credits.
 positive=walbytes
 v.update(taskOwnedBytes=own,launcherSessionBytes=launched,positiveSharedWALConservativeChargeOnce=positive,sharedWALFiles=wals,futureBytes=12582912,reserve=8388608,walAccounting='entire current shared WAL charged once; no initial-baseline or negative-growth credit')
 v['measuredProjected']=own+launched+positive+12582912+8388608
 v['passGate']=v['memAvailable']-553648128>=805306368 and v['freeDisk']-58720256>=2982150144 and v['measuredProjected']<=67108864
 write(O/('resource-'+phase+'.json'),v);assert v['passGate'],v
 return v
if __name__=='__main__':
 admission('validated-precheckout')
 cp=json.loads((OLD/'ops/checkpoint.json').read_text())
 assert cp['candidate']==SHA
 for pin in cp['pins']:
  p=pathlib.Path(pin['donor'])/pin['path'];data=p.read_bytes()
  assert h(data)==pin['sha256'] and len(data)==pin['bytes']
  assert git(pin['donor'],'show',pin['revision']+':'+pin['path'])==data
  assert git(pin['donor'],'rev-parse',pin['revision']+':'+pin['path']).decode().strip()==pin['blob']
 assert h((OLD/'repo/lib/browser-input.js').read_bytes())==cp['pins'][0]['sha256']
 oldE=OLD/'repo/docs/reviews/browser-key-reentrant-independent-oct26'
 fixtures={
  'unchanged7': OLD/'repo/test/browser-key-focus-independent-oct26.test.cjs',
  'new-independent7':OLD/'repo/test/browser-key-reentrant-independent-oct26.test.cjs',
  'crosslayer-unmodified':C/'test/keyboard-focus-renderer-interoperability-oct26.test.cjs'}
 for group in cp['groups']:
  fixture=fixtures.get(group['label'],OLD/'repo/test/keyboard-focus-renderer-repaired-pin-oct26.test.cjs')
  assert h(fixture.read_bytes())==group['fixtureSHA256']
  assert h((oldE/group['log']).read_bytes())==group['logSHA256']
  assert h((oldE/(group['label']+'.stderr')).read_bytes())==group['stderrSHA256']
  assert group['accepted']
 assert len(cp['groups'])==10
 original=(C/'test/keyboard-focus-renderer-interoperability-oct26.test.cjs').read_bytes()
 repin=(OLD/'repo/test/keyboard-focus-renderer-repaired-pin-oct26.test.cjs').read_bytes()
 assert original.count(b'9732e516772572e3a8e7ce972cdb73477efa6e965ba299654a632c9979b42b05')==1
 assert original.replace(b'9732e516772572e3a8e7ce972cdb73477efa6e965ba299654a632c9979b42b05',cp['pins'][0]['sha256'].encode())==repin
 # Revalidate retained 119+legacy receipt manifest, no test reruns.
 rr=json.loads((oldE/'renderer-receipt-verified.json').read_text())
 mf=pathlib.Path(rr['manifest']); assert h(mf.read_bytes())==rr['manifestSHA256']
 write(O/'retained-validation.json',dict(checkpointSHA256=h((OLD/'ops/checkpoint.json').read_bytes()),candidate=SHA,pins=cp['pins'],groupsValidated=len(cp['groups']),pinOnlyDiff=True,rendererReceipt=rr,remaining=['semantic review','publication'],retainedWorkerDecision='not adopted; worker ended before final; final decision belongs to this task'))
 subprocess.run(['git','init','-q',str(R)],check=True)
 alternates=[str(D/'.git/objects')]+(D/'.git/objects/info/alternates').read_text().splitlines()
 (R/'.git/objects/info/alternates').write_text('\n'.join(dict.fromkeys(alternates))+'\n')
 git(R,'config','user.name','Wine acceptance worker');git(R,'config','user.email','codex@wine-assembly.local')
 git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 git(R,'config','core.sparseCheckout','true')
 (R/'.git/info/sparse-checkout').write_text('/lib/browser-input.js\n')
 git(R,'checkout','-b',BRANCH,SHA)
 E.mkdir(parents=True)
 for name in ['browser-key-focus-independent-oct26.test.cjs','browser-key-reentrant-independent-oct26.test.cjs','keyboard-focus-renderer-repaired-pin-oct26.test.cjs']:
  p=R/'test'/name;p.parent.mkdir(exist_ok=True);shutil.copy2(OLD/'repo/test'/name,p)
 # Exact published upstream fixture is retained as provenance, not repurposed.
 shutil.copy2(C/'test/keyboard-focus-renderer-interoperability-oct26.test.cjs',E/'crosslayer-original.test.cjs')
 for p in oldE.iterdir():
  if p.is_file() and p.name!='DECISION.md':shutil.copy2(p,E/p.name)
 write(E/'retained-checkpoint.json',cp)
 write(E/'checkpoint.json',dict(candidate=SHA,pins=cp['pins'],groups=cp['groups'],reuse='All retained group and source/test/log hashes validated; no repeated groups',remaining=['semantic review','publication','current-main integration/regression','real browser/guest qualification']))
 shutil.copy2('/home/user/wine-assembly/scratch/usage-watch/browser-key-reentrant-retained-accept-oct26/root-ref-digest.json',E/'root-ref-initial.json')
 for p in O.glob('*.json'):shutil.copy2(p,E/p.name)
 patch=''.join(difflib.unified_diff(original.decode().splitlines(True),repin.decode().splitlines(True),fromfile='published-cd3ce6e-fixture',tofile='repaired-browser-pin-fixture'))
 (E/'crosslayer-pin-only.patch').write_text(patch)
 print(json.dumps(dict(repo=str(R),validatedGroups=len(cp['groups']),remaining='semantic review and publication')))

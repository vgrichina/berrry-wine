"""Evidence-only checks. Never launches guests, workers, network or Git."""
import pathlib,json,hashlib,sys,copy
E=pathlib.Path(__file__).resolve().parent
def sha(b):return hashlib.sha256(b).hexdigest()
def load(n):return json.loads((E/n).read_text())
def verify(override=None):
 override=override or {}
 def data(n):return override[n] if n in override else (E/n).read_bytes()
 def j(n):return json.loads(data(n))
 original=data('observer.original.cjs');guarded=data('observer.guarded.cjs')
 expected=original.replace(b"'use strict';\n",b"'use strict';\nif (require('worker_threads').isMainThread) {\n",1)+b'}\n'
 assert guarded==expected,'guard-only amendment'
 hashes=j('observer-hashes.json');assert sha(original)==hashes['original'] and sha(guarded)==hashes['guarded']
 pinned=original.replace(b"ROOT='/home/user/shadow-man-tools-ready-oct22/runtime',OUT='/home/user/shadow-man-bounded-runtime/attempt'",b"ROOT='/home/user/shadow-man-original-oct22/runtime',OUT='/home/user/shadow-man-child-transport-sized-oct22'")
 assert sha(pinned)=='539c9fd0d23b6c539818ee9c612d33b010708af74c91f896a9f9f68988b2769d'
 active=guarded.replace(b"OUT='/home/user/shadow-man-bounded-runtime/attempt'",b"OUT='/home/user/shadow-man-bounded-runtime/shadow-man-worker-preload-retest-oct22'")
 assert data('observer.cjs')==active
 original_run=json.loads(j('offline-original-api.json')['stdout'])
 assert 'actual-worker-error' in original_run['stdout'] and 'EEXIST' in original_run['stdout'] and 'ETIMEDOUT' in original_run['stdout']
 neg=j('offline-negative-guard-removed.json');assert 'EEXIST' in neg['stdout'] and 'ETIMEDOUT' in neg['stdout']
 assert 'actual-authority-requests-pass' not in neg['stdout']
 for n in ['guarded-authority','guarded-fork']:
  r=j('offline-'+n+'.json');assert r['exitCode']==0 and not r['stderr']
  assert 'actual-authority-requests-pass' in r['stdout'] and 'actual-worker-error' not in r['stdout']
 assert 'real-fork-child-preload-png-pass' in j('offline-guarded-fork.json')['stdout']
 preservation=j('preservation.json');assert preservation['allFileHashesEqual'] and preservation['verifiedOldTmpfsOnlyRemoved']
 assert preservation['files']==len(preservation['allFiles'])==93
 assert preservation['parentVfsFiles']==80 and preservation['parentVfsBytes']==75603833
 assert preservation['crossDeviceTransientProjected']<2147483648
 pre=j('preflight.json');assert pre['passAll'] and len(pre['seals'])==243
 assert pre['fixedAllocatedBytes']+pre['quotaBytes']+pre['reserveBytes']==253308928<268435456
 assert pre['quotaBytes']==150994944 and pre['fixedAllocatedBytes']<=100663296
 fixture=json.loads(pre['fixture']['stdout']);assert all('/shadow-man-worker-preload-retest-oct22/tmp' in fixture[k] for k in ['TMP','TEMP','tmpdir','directory','endpoint'])
 rows=lambda n:[json.loads(line) for line in data(n).splitlines()]
 parent=rows('raw/parent-47137.jsonl');child=rows('raw/child-47145.jsonl')
 assert sum(r['kind']=='fork' for r in parent)==1
 assert sum(r['kind']=='module-instance' for r in parent)==1
 assert len(child)==1 and child[0]['kind']=='preload-identity' and child[0]['pid']==47145
 assert child[0]['exe']['sha256']=='a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083'
 assert '--real-ticks' in child[0]['argv'] and '--spawned-child' in child[0]['argv']
 returns=[r['eax'] for r in parent if r['kind']=='return' and r['name']=='WinExec'];assert returns==[33,0]
 assert all(r['pid']==47137 for r in parent)
 assert not any(r.get('name')=='ExitProcess' for r in parent+child)
 log=data('raw/output.log');assert len(log)==71448 and b'Authority deadline exceeded' not in log
 first=[line for line in log.splitlines() if line.startswith(b'[spawn]') and b'failed:' in line][0]
 assert first==b'[spawn] ShellExecute "C:\\_ISDEL.EXE" failed: ENOSPC: no space left on device, write'
 assert b'child state merged: 0 file(s) written, 81 deleted, 0 registry/INI key(s)' in log
 exit=j('exit.json');assert exit['parentPid']==47137 and exit['parentOsExitCode']==1 and exit['elapsedSeconds']<60
 assert exit['firstExactFailure']['line'].encode()==first and exit['firstExactFailure']['observedSeconds']<1
 assert exit['reason']=='quota-enospc' and not exit['remainingLiveProcesses'] and exit['postSealCount']==243
 assert {r['pid'] for r in exit['processes']}=={47137,47145}
 for r in exit['processes']:
  assert all('/shadow-man-worker-preload-retest-oct22/tmp' in v for v in r['environment'].values())
 inventory=j('runtime-inventory.json')['manifest']
 for row in inventory:
  if '/' not in row['path'] and (E/'raw'/row['path']).is_file():
   b=data('raw/'+row['path']);assert len(b)==row['size'] and sha(b)==row['sha256'],row['path']
 png=j('raw/parent-47137-summary.json')['screenshot'];assert sha(data('raw/'+png['name']))==png['sha256']
 cleanup=j('cleanup.json');assert cleanup['clean'] and cleanup['pinsPreserved'] and not cleanup['remainingOwnedLiveProcesses']
 assert cleanup['recoveryAllocated']<2147483648 and cleanup['hostFree']>2982150144
 assert cleanup['oldBackupParentVfsFiles']==80 and cleanup['oldBackupParentVfsBytes']==75603833
 box=j('box-final.json')['sandbox'];assert box['id']=='bx_495585da' and box['stop'] is None and box['health']=='ok' and box['state']=='idle'
 assert j('protected-before.json')==j('protected-after.json')
 for row in j('evidence-seals.json'):
  b=data(row['path']);assert len(b)==row['size'] and sha(b)==row['sha256'],row['path']
 return True
verify();print('PASS original Worker exception; guard-only amendment; real authority/fork/PNG; unchanged cap/pins; one guest ENOSPC; cleanup/lifecycle; artifact hashes')
if '--self-test' in sys.argv:
 controls=[('removed guard',{'observer.guarded.cjs':(E/'observer.original.cjs').read_bytes()}),('truncated raw',{'raw/output.log':(E/'raw/output.log').read_bytes()[:-1]}),('forged child load',{'raw/child-47145.jsonl':(E/'raw/child-47145.jsonl').read_bytes()+b'{"pid":47145,"kind":"module-instance"}\n'})]
 for name,override in controls:
  try:verify(override)
  except AssertionError:print('PASS rejecting control:',name)
  else:raise AssertionError('accepted '+name)

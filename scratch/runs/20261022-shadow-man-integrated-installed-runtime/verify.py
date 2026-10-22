"""Offline receipt consistency; never recovers, compiles, instantiates or launches."""
import pathlib,json,hashlib,subprocess,os
E=pathlib.Path(__file__).resolve().parent
def read(n):return json.loads((E/n).read_text())
def verify():
 p=read('preflight.json');r=read('selective-recovery-result.json')
 assert r['exit']==-25 and not r['stdout']
 assert p['partialLayer']['bytes']==16777216
 assert 'SIGXFSZ' in (E/'selective-recovery-file-operations.log').read_text()
 assert not (E/'selective-recovery').exists()
 plan=read('selective-recovery-plan.json');cmd=plan['command']
 assert cmd.count('--path')==1
 assert cmd[cmd.index('--path')+1]=='/home/user/shadow-man-dsetup-canonical-qualification-oct22/build/wine-assembly.wasm'
 assert p['resume']['attempts']==p['resume']['apiExecAttempts']==p['guest']['attempts']==0
 assert not p['expectedModule']['actualRecovered']
 tree=read('snapshot-tree.json');assert not tree['truncated']
 matches=[x for x in tree['entries'] if x['path']==p['expectedModule']['snapshotPath']]
 assert len(matches)==1 and matches[0]['size']==1879387
 assert tree['snapshotId']==p['expectedModule']['snapshot']
 build=read('accepted-canonical-result.json')
 assert build['exit']==0 and build['moduleSHA256']==p['expectedModule']['sha256']
 assert build['head']==p['canonicalProduction'] and build['moduleBytes']==1879387
 closure=read('planned-source-closure.json');assert len(closure)==158
 assert {x['path'] for x in closure if x['blob']!=x['oldBlob']}=={'lib/dll-registry.js','lib/process-boot.js','lib/storage.js'}
 assert all(x['mode'] in ['100644','100755'] and len(x['blob'])==40 for x in closure)
 a=read('allocation-audit.json');assert a['conservativePeakPlusReserveAndPublication']<a['cap'] and a['hostFree']>a['hostFloor']
 # Preserve the complete published base index; only own evidence may differ.
 env=dict(os.environ,GIT_NO_LAZY_FETCH='1');base='58e90870a40a541a4083cae5e987ca8de31889e6';B=E.parents[2]
 old=subprocess.check_output(['git','ls-tree','-r',base],cwd=B,env=env).decode().splitlines()
 index=subprocess.check_output(['git','ls-files','--stage'],cwd=B,env=env).decode().splitlines()
 mapping={line.split('\t',1)[1]:line.split('\t',1)[0].split()[:2] for line in index}
 for line in old:
  meta,path=line.split('\t',1);mode,kind,blob=meta.split();assert mapping[path]==[mode,blob],path
 return dict(passAll=True,scope='Offline recovery failure receipt consistency only; runtime qualification NOT RUN',basePathsPreserved=len(old),guestAttempts=0)
if __name__=='__main__':
 result=verify();(E/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

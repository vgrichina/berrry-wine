import pathlib,json,subprocess,hashlib,os,shutil
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2];os.environ['GIT_NO_LAZY_FETCH']='1'
def j(n):return json.loads((E/n).read_text())
def git(*a):return subprocess.check_output(['git','-C',str(W),*a])
def du(p):return int(subprocess.check_output(['du','-s','-B1',str(p)]).split()[0])
base={}
for row in git('ls-tree','-rz','58e90870a40a541a4083cae5e987ca8de31889e6').split(b'\0'):
 if row:
  meta,path=row.split(b'\t',1);mode,typ,sha=meta.split();base[path]=(mode,sha)
index={}
for row in git('ls-files','--stage','-z').split(b'\0'):
 if row:
  meta,path=row.split(b'\t',1);mode,sha,stage=meta.split();index[path]=(mode,sha)
assert len(base)==8279 and all(index[p]==v for p,v in base.items())
assert j('offline-fixture.json')['passAll']
s=j('fixed-session-result.json');assert s['guestSessionAttempts']==1 and s['boundPassed'] and s['firstFailure'] is None and not s['remaining']
assert s['endpointSeconds']<=10 and s['launcherCaptureSeconds']-s['endpointSeconds']<=10
assert j('fixed-ordinary-dispatch.json')['args']==['cmd','dlg-cmd:1024'] and j('fixed-ordinary-dispatch.json')['exit']==0
assert j('fixed-response-recorded.json')['elapsed']<=15
state=json.loads(j('fixed-configuration-response-state.json')['stdout']);assert any(w['visible'] and w['title']=='ShadowMan Configuration' for w in state['windows'])
assert not j('final-current-integrity.json')['nodeProcesses'] and j('final-current-integrity.json')['immutableReadOnly']
assert j('final-current-integrity.json')['registryCloneSHA256']==j('preguest.py-result.json')['registrySHA256']
consumed=[json.loads(x) for x in (E/'fixed-module-consumption.jsonl').read_text().splitlines()];assert any(x.get('event')=='canonical-input-consumed' and x['sha256']==j('preguest.py-result.json')['moduleSHA256'] for x in consumed)
for n in ['launcher-before.png','output-config-after.png']:assert (E/n).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
assert (E/'launcher-before.png').read_bytes()==(E/'output-launcher-before.png').read_bytes()
box=j('box-running-checkpoint.json')['sandbox'];assert box['id']=='bx_vufrds5w' and box['state']=='idle' and box['stop'] is None
a=j('admission.json');actualOwn=du(W);total=a['donor']+a['recipeDonor']+a['rootReadsToolsAllowance']+actualOwn+a['reserve'];assert total<=a['cap'] and shutil.disk_usage(W).free>=a['hostFloor']
out=dict(passAll=True,basePathsPreserved=len(base),guestAttempts=1,ordinaryActions=1,livePngCommands=2,wholeLocalAllocatedIncludingReserve=total,actualOwn=actualOwn,cap=a['cap'],hostFree=shutil.disk_usage(W).free,hostFloor=a['hostFloor'],boxRunning=True,osExit=s['parentOsExit'],guestExit=None)
(E/'verification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))

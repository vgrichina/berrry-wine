import pathlib,json,hashlib,subprocess,shutil,os
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
def read(n):return json.loads((E/n).read_text())
def digest(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
f=read('offline-plan-fixture.json');old=read('prior-failed-offline-plan-fixture.json');assert f['passAll'] and f['stagingAuthorized'] and f['donorIdentityPass'] and len(f['rejected'])==9 and not f['mismatches'];assert old['passAll'] is False and old['donorIdentityPass'] is False and len(old['mismatches'])==3
p=read('staging-plan.json');assert len(p)==224 and digest(E/'staging-plan.json')==read('helper-review.json')['planSHA256'];s=read('stage-receipts.json');assert len(s)==224 and {x['path']:(x['bytes'],x['sha256']) for x in s}=={x['target']:(x['bytes'],x['sha256']) for x in p}
for n in ['full-hash-api.json','single-clone-api.json','preguest-api.json','watchdog-fixture-api.json']:assert read(n)['exitCode']==0
fail=read('settings-capture-fixture-api.json');assert fail['exitCode']==1 and not fail['timedOut'];inner=json.loads(fail['stdout']);assert inner['exit']==1 and 'unsafe diagnostic guest path' in inner['stderr']
h=read('handback.json');assert h['allOriginalHashesVerified'] and h['acceptedDestinationReceiptUnchanged'] and h['cloneCount']==1 and h['cloneUnchanged'] and h['stageEntriesVerified']==224 and h['guestAttempts']==h['gameLaunches']==0 and h['immutableReadOnly'];assert not h['ownedGroups'] and not h['ownedNodeProcesses'];assert h['boxState']=='RUNNING (API idle)' and h['stop'] is None
assert read('confirmed-original-hashes.json')==read('destination-original-hashes.json');assert not (E/'session1-preflight.json').exists() and not (E/'session1-launch-api.json').exists()
base={l.split('\t')[1]:l.split('\t')[0] for l in (E/'base-index.txt').read_text().splitlines()};env=dict(os.environ,GIT_NO_LAZY_FETCH='1');current={l.split('\t')[1]:l.split('\t')[0] for l in subprocess.check_output(['git','ls-files','--stage'],cwd=W,env=env,text=True).splitlines()};assert all(current.get(k)==v for k,v in base.items())
a=read('admission.json');own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0]);total=a['selectedAllocated']+own+a['toolsAndGitAllowance']+a['reserve'];free=shutil.disk_usage(W).free;assert total<=a['cap'] and free>=a['hostFloor']
seals=[dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=digest(p)) for p in sorted(E.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p.name not in ['verification.json','publication.json']]
r=dict(passAll=True,historicalFailurePreserved=True,newPlanGatePass=True,stageEntries=224,negativeCases=9,firstBlocker='settings observer actual fixture rejects normal guest path',guestSessions=0,basePathsPreserved=len(base),allocation=dict(selected=a['selectedAllocated'],own=own,tools=a['toolsAndGitAllowance'],reserve=a['reserve'],total=total,cap=a['cap'],hostFree=free,hostFloor=a['hostFloor']),evidence=seals)
(E/'verification.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='evidence'}))

import pathlib,json,hashlib,shutil,struct,time
import run as c
H,R=c.H,c.R;D=R/'docs/reviews/airstrike-accepted-dispatch-quit-oct27';D.mkdir(parents=True,exist_ok=True)
def copy(p,target):target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
for p in (H/'retained').rglob('*'):
 if p.is_file():copy(p,D/'retained'/p.relative_to(H/'retained'))
for p in H.iterdir():
 if p.is_file() and (p.suffix in ('.json','.py','.cjs','.stdout','.stderr') or p.name.endswith('.supervisor-output')) and p.name not in ('accounting.json','result.json'):
  copy(p,D/'ops'/p.name)
for p in (H/'api').iterdir():
 if p.name.endswith(('.stdout','.stderr')):copy(p,D/'api'/p.name)
 elif p.name.endswith('.command.json'):
  v=json.loads(p.read_text());cmd=v.pop('argv');v.update(executable=cmd[0],argvRetainedExternal=str(p),argumentBytes=sum(len(x) for x in cmd));(D/'api'/p.name).write_text(json.dumps(v,indent=2))
for n in ('root-ref-digest.json',):copy(c.ROOT/'scratch/usage-watch/airstrike-accepted-dispatch-quit-oct27'/n,D/n)
copy(c.ROOT/'scratch/usage-watch/airstrike-accepted-dispatch-quit-oct27-admission.json',D/'admission.json')
external={}
for p in (pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/ops/result.json'),pathlib.Path('/tmp/airstrike-accepted-frozen-dispatch-main-integrate-oct27/repo/docs/reviews/airstrike-accepted-frozen-dispatch-main-integrate-oct27/receipt.json'),c.ROOT/'CLAUDE.md',c.ROOT/'scratch/usage-watch/coordinator-policy.md'):
 external[str(p)]=hashlib.sha256(p.read_bytes()).hexdigest()
e=json.loads((H/'retained/game-evidence/events.json').read_text());dispatch=[x['command'] for x in e if x.get('kind')=='dispatch'];keys=[x for x in dispatch if 'cmd' in x]
assert keys==[],keys
result=json.loads((H/'retained/game-evidence/result.json').read_text());terminal=json.loads((H/'retained/game-evidence/terminal.json').read_text());supervision=json.loads((H/'retained/guest-supervision.json').read_text())
assert result['status']=='refused' and result['cleanup']['complete'] and result['cleanup']['signals']==['SIGTERM']
assert terminal['guestExitCode'] is None and not terminal['hostExitObserved']
assert supervision['exit']==0 and supervision['stopReason'] is None and supervision['cleanupComplete']
png=H/'retained/9b55685e506a4124abd456510ebaf254.png';b=png.read_bytes();assert hashlib.sha256(b).hexdigest()=='a0d213dfefdda68876792c1819711dd3c470dfece91b0d9280f6462ce01aee61';assert struct.unpack('>II',b[16:24])==(800,600)
box=json.loads((H/'box-closeout.stdout').read_text());ledger=json.loads((H/'api-ledger.json').read_text());assert not ledger['pending'] and ledger['charged']<=8388608
cfg=R/'.git/config';s=cfg.read_text();s+='\n[gc]\n auto = 0\n[maintenance]\n auto = false\n';cfg.write_text(s)
assert c.gate() is None
account=json.loads((H/'accounting.json').read_text());c.dump('accounting-at-publication.json',account);copy(H/'accounting-at-publication.json',D/'accounting-at-publication.json')
q=dict(status='BLOCKED_ACTUAL_STARTUP_OBSCURED_NO_QUIT',objectiveMet=False,actualGuestInvocations=1,detachedPreGuestGuards=1,keyDispatches=0,firstConcreteBlocker='Human-inspected actual frame shows Console over Airstrike startup Press any key to start. Unobscured gameplay/menu rows0..6 not established; factual observation rejected.',inspectedFrame='retained/9b55685e506a4124abd456510ebaf254.png',inspectedSHA256=hashlib.sha256(b).hexdigest(),frameBytes=len(b),dimensions=[800,600],ordinaryQuit=False,cleanup=result['cleanup'],guestSupervision=supervision,box=box,api=ledger,accounting=account,reusedIndependentExecutions=19,reusedCandidateRegressions=25,acceptedMain='c220ffccd69932bb2e5f05189f4845581de0d723',historicalRunner='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',runnerSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',moduleSHA256='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686',controllerSHA256=result['controllerSHA256'],bridgeSHA256='3d2cc3e3fb01c099b07260a3130a88dbb957519ec3fe43d4a13de0d78a1296ee',notCurrentMainEmulator=True,sourceChanges=False,reportOnlyOrphan=True,neverMergeWholeTree=True,mainOwnership=False,publicDeploy=False,workerSpawns=0,rootAndDonorsReadOnly=True,initialRootDigestReused=True,externalPins=external,recipesExternal=str(H),incidents=['Exploratory tool displays exceeded8192B; original session retained; no retrospective compliance claim.','Initial setup URL whitespace parser failed; separate stdout/stderr retained; same-task fix.','Two staging transfers shared transfer.pack and overlapped; raw decompression failures and exact command-body files retained. Distinct packs corrected only failed groups.','Startup assertion incorrectly required comma filename despite exact manifest having none; original source/stdout/stderr/supervision retained, corrected enumeration passed.','First detached launcher failed pre-guest tuple/list config equality. Traceback and original source retained; no game evidence or guest stdout existed and launcher PID absent. JSON-normalized comparison corrected wrapper; identical Node receipt reused.','Actual first frame was visually obscured and startup-only. Rejected with no input; SIGTERM cleanup is NOT ordinary Quit.'],stoppingCondition='One bounded actual game attempt stopped at first factual observation blocker; no replay, source repair, replacement task or box shutdown. Publication only.')
(D/'result.json').write_text(json.dumps(q,indent=2)+'\n');c.dump('result.json',q)
manifest={str(p.relative_to(D)):hashlib.sha256(p.read_bytes()).hexdigest() for p in D.rglob('*') if p.is_file() and p.name!='manifest.json'}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for rel,digest in manifest.items():assert hashlib.sha256((D/rel).read_bytes()).hexdigest()==digest
c.dump('report-validation.json',dict(pass_=True,payloads=len(manifest),keys=keys,frameBytes=len(b),peakRSS=supervision['peakRSS'],cpuSeconds=supervision['cpuSeconds'],wallSeconds=supervision['wallSeconds'],apiCharged=ledger['charged'],gitReportOnly=True));print('report integrity PASS',len(manifest),'payloads; no keys; ordinary Quit false')

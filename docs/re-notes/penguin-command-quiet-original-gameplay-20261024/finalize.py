import pathlib,json,os,sys,hashlib,ast,subprocess,time,signal
H=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24');E=H/'repo/docs/re-notes/penguin-command-quiet-original-gameplay-20261024';P=pathlib.Path('/tmp/penguin-retained-codec-oct24')
for name in ['setup.py','collect.py','finalize.py']:
 b=(H/name).read_bytes();(E/name).write_bytes(b);ast.parse(b)
for name in ['initial-status.json','launch.json','remote-final.json']:(E/name).write_bytes((H/name).read_bytes())
j=json.load(open(H/'box-state.json'))['sandbox'];(E/'box-state.json').write_text(json.dumps({k:j.get(k) for k in ['id','state','health','createdAt','ttlSeconds','archiveAfter','updatedAt']},indent=2))
checks=[]
for x in json.load(open(E/'collection-seals.json')):
 b=(E/x['path']).read_bytes();assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'];checks.append(x['path'])
m=json.load(open(E/'retained-payload-manifest.json'));assert len(m)==287 and sum(x['bytes'] for x in m)==15719953
c=json.load(open(E/'run/command.json'));a=c['argv'];assert '--quiet-blocks' in a and '--no-build' in a and '--memory-mb=512' in a and '--max-batches=200000' in a
assert c['memAvailable']>=2684354560
terms=json.load(open(E/'run/terminal.json'));assert terms['returncode']==0 and not terms['remainingGroup'] and terms['reason']=='natural'
events=json.load(open(E/'run/input-events.json'));assert len(events)==2 and [x['command']['action'] for x in events]==['snapshot','png']
log=(E/'run/output.log').read_text();assert '200000 batches in 7.739s' in log and 'id":"startup-capture"' in log and len(log.encode())<524288
assert (E/'run/startup.png').read_bytes()==(E/'run/exit.png').read_bytes()
# real watcher cleanup, retain receipt
pid=int((H/'watcher.pid').read_text());os.kill(pid,signal.SIGTERM)
for _ in range(20):
 if not pathlib.Path('/proc/'+str(pid)).exists():break
 time.sleep(.05)
state=pathlib.Path('/proc/'+str(pid)+'/stat');s=state.read_text().split()[2] if state.exists() else 'absent';assert s in ['absent','Z']
(E/'cleanup.json').write_text(json.dumps({'watcherPid':pid,'watcherState':s,'guest':terms,'remoteNodes':json.load(open(H/'remote-final.json'))['nodes'],'boxShutdownOwner':'coordinator','boxOperation':'left running; no stop/delete/resume'},indent=2))
# measured retained+new both hosts, all old charges retained, conservative future
size=lambda p:sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else 0
prior=json.load(open(P/'admission.json'));sql=sum(max(0,p.stat().st_size-prior['sqliteBaseline'].get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file())
sessionids=['01a16baa-fa55-71b1-9d83-e453b9fe312e',os.environ['CODEX_SESSION_ID']];sp=[p for p in pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*.jsonl') if any(i in p.name for i in sessionids)]
r=json.load(open(H/'remote-final.json'));charges={'priorLocal':size(P),'newLocalIncludingPrivateGit':size(H),'priorRemote':r['priorBytes'],'newRemote':r['newBytes'],'remoteApiLogs':sum(r['apiLogs'].values()),'priorExternalLauncher':size(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-command-retained-codec-gameplay-oct24')),'currentExternalLauncher':size(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-command-quiet-original-gameplay-oct24')),'bothSessions':sum(p.stat().st_size for p in sp),'positiveSQLite':sql,'futureLocalGitReportEvidence':2*1024**2,'futureSessionEventsSQLite':10*1024**2,'transportPeak':1024**2,'reserve':8*1024**2}
total=sum(charges.values());free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize;assert total<=67108864 and min(free-total,r['free']-total)>=2982150144
(E/'resource-final.json').write_text(json.dumps({'at':time.time(),'charges':charges,'projected':total,'cap':67108864,'localFree':free,'remoteFree':r['free'],'localAfter':free-total,'remoteAfter':r['free']-total,'sessionPaths':[str(p) for p in sp],'maxNewFile':max(p.stat().st_size for p in H.rglob('*') if p.is_file()),'captureAccounting':'prior900000 + continuation conservative100000 =1000000/1048576; preserved prior oversized instruction receipt charges; bounded compressed collection responses; no reset','pass':True},indent=2))
(E/'validation.json').write_text(json.dumps({'sealsVerified':len(checks),'manifestFiles':len(m),'manifestBytes':sum(x['bytes'] for x in m),'actualStartupControls':2,'ordinaryInputsDelivered':0,'screenshotsVisuallyReviewed':['run/startup.png','run/exit.png'],'screenshotsIdentical':True,'quietOutputBytes':len(log.encode()),'guestLimitReached':'200000 batches','supervisorSyntax':'AST PASS','cleanup':'PASS'},indent=2))
seals=[]
for p in sorted(E.rglob('*')):
 if p.is_file() and p.name not in ['final-seals.json','results.json']:
  b=p.read_bytes();seals.append({'path':str(p.relative_to(E)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(E/'final-seals.json').write_text(json.dumps(seals,indent=2))
# Investigation only: no candidateId assigned to a different application.
j={'runId':'penguin-command-quiet-original-gameplay-20261024','candidateId':None,'startedAt':'2026-10-24T02:24:05.250Z','outcome':'blocked','verification':'reviewed','route':'historical native rasterCanvas CLI','checkpoint':'main-menu','summary':'Original menu visually verified. 200000-batch ceiling ended run before ordinary input; gameplay unverified. No observed guest fault.','screenshots':['run/startup.png','run/exit.png'],'moduleSha256':'8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686','sourceCommit':'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a','command':'run/command.json','terminal':'run/terminal.json','ordinaryInputsDelivered':0,'box':'bx_9nngcsvf','coordinatorShutdownCheckpoint':'2026-10-24T02:37:00Z','expiresAt':'2026-10-24T02:47:54.557Z'}
(E/'results.json.tmp').write_text(json.dumps(j,indent=2));(E/'results.json.tmp').rename(E/'results.json');print(json.dumps({'seals':len(seals),'projection':total,'privateBytes':size(H),'boxState':j['box']}))

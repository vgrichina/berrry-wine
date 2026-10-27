gate('package')
D=H/'repo/docs/reviews'/H.name;D.mkdir(parents=True,exist_ok=True)
outcome=json.loads((O/'launch-controller-outcome.json').read_text());supervisor=json.loads((O/'launch-supervisor-outcome.json').read_text());assert not outcome['clicked'] and not outcome['pending']
requests=[json.loads(s) for s in (O/'remote-evidence/launch/controller/requests.jsonl').read_text().splitlines()]
steps=[];quits=[];inputs=[]
for i,r in enumerate(requests):
 cmd=r['request']
 if cmd.get('action')=='step':
  ack=json.loads(r['originalResponse'])['value'];n=cmd['n'];assert 1<=n<=256 and ack['ran']==n and ack['steps']==n
  following=requests[i+1];snap=json.loads(following['originalResponse'])['value'];assert following['request']=={'action':'snapshot'} and snap['batch']==ack['batch'] and snap['frozen']['credits']==0
  steps.append(dict(n=n,batch=ack['batch']))
 if cmd.get('action')=='quit':quits.append(r)
 if 'cmd' in cmd:inputs.append(r)
assert not inputs
reviews=[json.loads((O/('review-'+str(i)+'.json')).read_text()) for i in (1,2)]
receipt=dict(status='REVIEWED_MENU_REACHED_STARTGAME_BLOCKED_CUMULATIVE_REVIEW',at=time.time(),box=BOX,boxState='RUNNING_API_EXEC_OBSERVED',leaveRunning=True,shutdownOwner='coordinator',guestCutoff='2026-10-27T10:55:00Z',handback='2026-10-27T10:57:00Z',shutdown='2026-10-27T11:00:00Z',expiry='2026-10-27T11:06:11Z',source='0a61c1bc254e3e455607e01d2e29d7f97c2806ef',runnerSHA256='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e',moduleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',emulatorQualification='retained canonical module plus exact pinned production runner and accepted controllers; not a whole current-main emulator',guestInvocations=1,reviewedLoading=True,reviewedMenu=True,menuFrame=reviews[1],startGame=False,gameplay=False,ordinaryGuestQuit=False,quitCommands=len(quits),supervisorCleanupReason=supervisor['reason'],guestChildReturncode=supervisor['childReturncode'],ownedAbsent=json.loads((O/'owned-terminal.json').read_text())['ownedAbsent'],controller=outcome,stepRequests=len(steps),allStepACKAndFrozenZero=True,largestStep=max(s['n'] for s in steps),totalRequestedBatches=sum(s['n'] for s in steps),apiCaptureBytes=sum(p.stat().st_size for p in (O/'responses').iterdir()),apiCap=8388608,actualFrameFetchSeconds=[json.loads((O/('frame-'+str(i)+'.png.receipt.json')).read_text())['elapsed'] for i in (1,2)],remainingGate='A fresh coordinator-assigned invocation needs a measured review/transport plan that fits cumulative review time before correlated Start Game; this worker makes no source repair or replay.',incidents=['Initial policy displays exceeded8192B/operation; transcript retained, subsequent bounded displays.','A300B installed Boat binary preview accidentally emitted binary bytes, retained transcript.','First Git init wrapper omitted the label argument: Git rejected unknown -b before repo creation; exact stdout/stderr and exit129 retained. Corrected argument configuration succeeded, no access/resource denial.','Initial local trusted-supervisor operations inherited merged stdout/stderr capture; later owned stream-wrapper creates distinct files from process creation. No retrospective separate-stream compliance claim for earlier local operations. Guest production startup and command always had distinct streams from creation.','First full-frame fetch took14.54seconds; cumulative28second review allowance expired before second reviewed menu decision could be accepted. Decision delivered after terminal; no click was accepted.','Supervisor cleanup reports control-listener-identity-changed and childSIGTERM; never ordinary Quit.'],reusedChecks='root integrated-main closeout:2production/ownership passes,44affected10independent9mutation checks; not rerun',publicationScope='report-only orphan task branch; never merge entire report tree')
save('acceptance.json',receipt)
selected=['acceptance.json','profile.json','closure-local.json','runtime-manifest.json','parser-identity.json','comma-inventory.json','readiness-remote.json','startup-check.json','capture-readiness.json','launch-config.json','guest-invocation.json','launch-api.json','frame-1.json','frame-2.json','frame-1.png','frame-2.png','frame-1.png.receipt.json','frame-2.png.receipt.json','review-1.json','review-2.json','review-1-delivered.json','review-2-delivered.json','launch-controller-outcome.json','launch-supervisor-outcome.json','launch-terminal.json','launch-node-startup.json','collection.json','owned-terminal.json','terminal-evidence.tar.gz','control.py','stream-wrapper.py','runtime.py','prepare.py','ready.py','startup.py','collect.py','package.py','remote-launch.py','init.json','init.stdout','init.stderr','git-init.execution.json','git-init.log','admission-preguest.json','admission-readiness.json','admission-collect.json']
for n in selected:
 p=O/n
 if p.exists():shutil.copyfile(p,D/n)
# Preserve all causal local/API bytes and exact command recipes in one bounded archive.
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for p in sorted(O.rglob('*')):
  if p.is_file() and 'remote-evidence' not in p.parts and p.name not in ('board-watch.log','terminal-evidence.tar.gz') and p.suffix!='.png':t.add(p,arcname=str(p.relative_to(O)))
assert len(buf.getvalue())<16777216;(D/'causal-diagnostics.tar.gz').write_bytes(buf.getvalue())
(D/'README.md').write_text('Enigma Loading to reviewed Main Menu, one bounded invocation\n\nAccepted integrated controller/runner closure and retained canonical module reached the actual main menu at batch78593. The first full frame at batch49665 showed Loading. Both images were visually inspected. Full requested-step acknowledgments and following matching frozen snapshots with zero credits passed for every step.\n\nStart Game was not dispatched. The controller exhausted its original cumulative28second review allowance during serial full-frame transfer/review; its late external menu approval was not consumed. No gameplay or ordinary Quit claim. The controller sent harness quit, while the supervisor recorded listener identity change, SIGTERM child completion and no owned survivors. No replay, source repair, main integration or deployment.\n\nSee acceptance.json, frame-1.png, frame-2.png, terminal-evidence.tar.gz and causal-diagnostics.tar.gz. The report branch is orphan/sparse and must not be merged as a whole tree. Box bx_pa3bb5zc remains running for coordinator handback, expiry2026-10-27T11:06:11Z.\n')
manifest=[]
for p in sorted(D.iterdir()):
 if p.is_file():manifest.append(dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for r in manifest:
 b=(D/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256']
save('package-validation.json',dict(at=time.time(),allPayloadHashes=True,files=len(manifest),allStepACKAndFrozenZero=True,steps=len(steps),inputs=len(inputs),quitCommands=len(quits)))
save('result.json',receipt)
print(json.dumps(dict(status=receipt['status'],steps=len(steps),inputs=len(inputs),files=len(manifest))))

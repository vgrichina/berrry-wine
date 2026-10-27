from work import *
gate('prepublication')
E=O/'remote';L=E/'launch';D=H/'repo/docs/reviews'/TAG
rows=[json.loads(l) for l in (L/'controller/requests.jsonl').read_text().splitlines()]
for a,b in zip(rows,rows[1:]):assert a['ended']<=b['at']
steps=[]
for i,r in enumerate(rows):
 if r['request'].get('action')=='step':
  n=r['request']['n'];v=json.loads(r['originalResponse'])['value'];s=rows[i+1];sv=json.loads(s['originalResponse'])['value'];assert 1<=n<=256 and v==dict(batch=r['startingBatch']+n,ran=n,steps=n,frozen=True)
  assert s['request']==dict(action='snapshot') and sv['batch']==v['batch'] and sv['frozen']['frozen'] is True and sv['frozen']['credits']==0 and sv['frozen']['recording'] is False
  steps.append(r)
assert steps[0]['request']==dict(action='step',n=1) and len(steps)==270 and sum(r['request']['n'] for r in steps)==68865
assert not any('cmd' in r['request'] for r in rows)
assert rows[-1]['request']==dict(action='quit') and json.loads(rows[-1]['originalResponse'])['value']==dict(quitting=True)
startup=json.loads((L/'node-startup.json').read_text());ns=json.loads(startup['output']);assert startup['exit']==0 and ns['version']=='v24.22.1' and ns['execArgv'][0]=='--max-old-space-size=2048'
for name in ['Max data size','Max address space']:assert 'unlimited' in next(l for l in ns['limits'].splitlines() if l.startswith(name))
out=json.loads((L/'supervisor-outcome.json').read_text());assert not out['failed'] and out['remainingOwnedLive']==[] and out['childReturncode']==0 and out['delegated']
assert out['peakTreeRSS']<=3221225472 and out['cpuSeconds']<=90 and out['outputBytes']<=2097152
names=['node-startup-stdout.log','node-startup-stderr.log','output.log','stderr.log'];assert sum((L/n).stat().st_size for n in names)==out['outputBytes']
frame=json.loads((L/'controller/menu-candidate.png.json').read_text());assert sha((L/'controller/menu-candidate.png').read_bytes())==frame['sha256']
pngs=list(L.rglob('*.png'));assert len(pngs)==1 and all(p.stat().st_size<=2097152 for p in pngs)
menuSnapshot=json.loads(rows[-3]['originalResponse'])['value'];assert menuSnapshot['batch']==68865 and menuSnapshot['windows'][0]['title']=='Enigma - Main Menu'
initial=dict(requests=rows[:3],firstStepACK=json.loads(rows[1]['originalResponse'])['value'],followingSnapshot=json.loads(rows[2]['originalResponse'])['value'])
save('paired-ACK-frozen-zero.json',initial)
timing=dict(captureEnded=rows[-2]['ended'],reviewDeadline=rows[-2]['ended']+25,cleanupRequestAt=rows[-1]['at'],retrievalFirstResponseAt=1793074780.584719,retrievalLastPNGResponseAt=1793074795.939070,captureReadbackExecution=json.loads((O/'collect-menu-execution.json').read_text()),cause='Worker prepared readback plumbing after launch, then began PNG retrieval ~13.36 seconds after capture; 16.13-second collection exceeded remaining review window. No decision file was delivered; no input dispatched. Not a game or controller fault.',remainingGuestAllowanceNotRenewed=True)
save('review-latency.json',timing)
inspection=dict(at=time.time(),tool='view_image',image='evidence/launch/controller/menu-candidate.png',sha256=frame['sha256'],width=640,height=480,reviewed=True,visual='Actual Enigma main menu: Start Game, Level Pack, Options, Credits, Quit; background logo and stone-ball art. No gameplay field shown.',safeStartGameVisible=True,reviewWasAfterControllerExit=True,actionDispatched=False)
save('image-review.json',inspection)
verification=dict(at=time.time(),PASS=True,steps=len(steps),acknowledgedBatches=68865,serialPairs=True,allStepsAtMost256=True,allFollowingSnapshotsFrozenZero=True,noInput=True,captures=1,startupVersion=ns['version'],DATAandAS='unlimited',stdoutStderrDistinctFromCreation=True,aggregateOutputBytes=out['outputBytes'],supervisorExit=0,ownedProcessAbsence=True,testsReplayed=False,builds=0)
save('verification.json',verification)
for p in E.rglob('*'):
 if p.is_file():
  q=D/'evidence'/p.relative_to(E);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
for n in ['paired-ACK-frozen-zero.json','review-latency.json','image-review.json','verification.json','owned-cleanup.json','api-terminal-status.json','remote-inventory-summary.json','remote-preguest-admission.json','api-launch.json','api-history.jsonl','accounting-prepublication.json','watcher.json']:
 shutil.copyfile(O/n,D/n)
for n in ['work.py','stage.py','prepare.py','check.py','collect.py','launch.py','cleanup.py','finalize.py']:
 q=D/'recipes'/n;q.parent.mkdir(exist_ok=True);shutil.copyfile(O/n,q)
checkpoint=dict(at=time.time(),phase='COMPLETE_MILESTONE_HANDOFF_NO_REPLAY',source='425755ee5ee9be0734c7aca187521100f5487674',supervisorMain='b160b5403e69f28e92e218849cc8165c67776bd2',guestInvocations=1,restarts=0,actualProductionInitialization=True,firstN1Gate=True,menuReviewed=True,StartGame=False,gameplay=False,ordinaryQuit=False,controllerStatus=out['status'],ownedProcessesAbsent=True,box='bx_nmvbu5c7',boxState='RUNNING via final API exec',shutdownOwner='coordinator',expiry='2026-10-27T05:12:05Z',remainingGate='Separate authorization would be required for another fresh guest. Prepare and time bounded frame readback before launch; same-run reviewed Start Game, gameplay and actual guest Quit remain open.',runtimeAllowanceConsumed=True)
save('checkpoint.json',checkpoint);shutil.copyfile(O/'checkpoint.json',D/'checkpoint.json')
(D/'REPORT.md').write_text('''# Enigma original supervisor production qualification

The exact accepted supervisor launched the original production Node runner, passed startup and the real serial step/frozen-zero contract, and reached an inspected main menu. The single authorized guest is terminal. No production source was edited, no builds or accepted regression groups were rerun, and main/root refs were untouched. This evidence-only branch has an independent root commit and must not be merged as production code.

Production source: `425755ee5ee9be0734c7aca187521100f5487674`; accepted supervisor integration: `b160b5403e69f28e92e218849cc8165c67776bd2`. The complete 2,663-row source/fixture map (37,486,692 bytes), file modes, canonical parser, 2,460 mounted files and eight DLL arguments were verified on the assigned Boat. There were no comma-bearing filenames in this closure. The retained tailcall module SHA-256 is `af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b`; this does not qualify the current-main emulator. One skipped zero-byte staging file was corrected before launch; the original failure remains in the evidence.

Node v24.22.1 used `--max-old-space-size=2048`, with unlimited inherited DATA/AS. The original supervisor performed its startup check with the identical executable, heap flag, sanitized environment and child limits before launching the guest. Both stdout and stderr were distinct from creation. The command and immutable hashes are in `launch-config.json` and `evidence/startup-environment.json`; source/module/EXE/environment/config pins, startup output, all request/response originals and terminal diagnostics are retained. The original CLI was `/usr/bin/python3 tools/enigma-supervised-gameplay.py --launch-config /tmp/enigma-separated-stream-runtime-oct27/ops/launch-config.json` from the remote runner directory; this records the spent invocation and is not authorization to repeat it.

The first step acknowledged `{batch:1, ran:1, steps:1, frozen:true}`. Its immediately following snapshot was batch 1, frozen true, credits zero and recording false. All 270 step requests were serial, at most 256 batches, and followed by matching frozen-zero snapshots; 68,865 batches were acknowledged. Initializers ran in the actual production runner before delegation. The final pre-capture snapshot had focus/main HWND `0x10001`, title `Enigma - Main Menu`, quit false, and frozen zero credits.

The 640×480 PNG was inspected with `view_image`: it shows Enigma's actual main menu with Start Game, Level Pack, Options, Credits and Quit. Its 389,913 bytes hash to `8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`. This is menu evidence, not gameplay.

**Worker orchestration failure:** frame-readback plumbing was completed after launch, contrary to the requested prelaunch readiness. Retrieval began about 13.36 seconds after capture and the bounded collection took 16.13 seconds; the controller's fixed 25-second review window had expired before inspection. No decision file or click was sent. The unchanged controller correctly returned `NO_REVIEWED_ACTION_NO_INPUT`; no attach, replay, restart, or renewed allowance was attempted. This is not an Enigma or supervisor failure. A future separately authorized attempt needs completed, measured capture-readback plumbing before launch and a review schedule that covers transfer plus inspection.

The supervisor/API exited 0. Peak sampled tree RSS was 372,101,120 bytes, aggregate CPU 21.6 seconds, stream output 6,744 bytes. One capture was used. Supervisor and both Node identities were verified absent through procfs; the detached API status is terminal. The controller's HTTP quit stopped the harness; it is cleanup evidence only. Start Game, gameplay and an ordinary in-game Quit are **not qualified**. Native/browser/WebGL/dedicated guest-worker routes were not tested. The fixture is absent from the candidate corpus manifest, so this remains an investigation report rather than an unrelated dashboard attachment.

Assigned bx_nmvbu5c7 remains RUNNING at final API probe. Expiry is 05:12:05 UTC, guest cutoff 04:40, handback 04:43, coordinator shutdown 04:45 on 2026-10-27. The coordinator retains shutdown ownership; no box lifecycle action was taken. Full receipts and hashes are in `manifest.json`, `verification.json`, `owned-cleanup.json` and `checkpoint.json`.
''')
manifest=[]
for p in sorted(D.rglob('*')):
 if p.is_file() and p.name not in ['manifest.json','result.json']:manifest.append(dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(D/'manifest.json').write_text(json.dumps(dict(at=time.time(),files=manifest),indent=2)+'\n')
save('result.json',dict(**checkpoint,verification=verification,manifestSHA256=sha((D/'manifest.json').read_bytes()),menuFrame='evidence/launch/controller/menu-candidate.png',summary='Original supervisor Node startup, production initializers, ACK/frozen-zero and presented main menu qualified; worker readback latency missed review deadline; no gameplay input or ordinary guest Quit.',resource=json.loads((O/'accounting-prepublication.json').read_text())))
shutil.copyfile(O/'result.json',D/'result.json')
print('verified and packaged',len(manifest),'files',sum(x['bytes'] for x in manifest))

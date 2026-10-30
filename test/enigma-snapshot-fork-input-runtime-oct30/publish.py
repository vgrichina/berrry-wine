"""Publish only the bounded task report with Git tree objects; never expand an index."""
import supervisor as s
import json,pathlib,time,ast,hashlib,subprocess,signal,os
C=s.C;R=s.R;branch='test/'+C.name;base='8cf96b58a9fe68b46fbc1b861f940b7d2fb97a47'
close=json.loads((C/'closeout.json').read_text());assert close['verifiedStopped'] and close['postRunSnapshotCompleted']
assert close['sandbox']['id']=='bx_6j9h42np' and close['sandbox']['snapshotVerifiedAt']>'2026-10-30T09:17:24.282Z'
allocation=s.admission('publication')
for p in ['supervisor.py','runtime.py','guest.py','verify-remote.py','publish.py']:ast.parse((C/p).read_text())
assert s.git('rev-parse','HEAD')['stdout'].strip()==base
index=s.REPO/'.git/index'
assert not index.exists() or index.stat().st_size<12*s.M
manifest=json.loads((C/'capture-manifest.json').read_text());selected=json.loads((C/'selected-captures.json').read_text())
assert selected['total']==456474 and selected['total']-selected['ceiling']==56474
assert len({x['sha256'] for x in manifest if x['path'].endswith('.png')})==1
assert not (C/'final.png').exists() and not (C/'runtime-evidence.json').exists()
runtime=json.loads(json.loads((C/'runtime-operation.json').read_text())['stdout']);assert runtime==dict(exit=0,stdout='',stderr='')
rec=dict(task=C.name,status='BLOCKED_EVIDENCE_RETRIEVAL',objectiveAchieved=False,at=time.time(),bornHEAD=base,app='original Enigma 1.01',sourceRevision='425755ee5ee9be0734c7aca187521100f5487674',moduleBytes=1880854,moduleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',currentMainRuntimeValidated=False,forkCount=1,forkParent='bx_jvne7b63',newBoat='bx_6j9h42np',oldBoatsMutated=False,guestInvocations=1,guestControllerExit=runtime['exit'],guestInvocation=json.loads((C/'guest-invocation.json').read_text()),schedule=json.loads((C/'schedule.json').read_text()),remoteManifestVerified=True,remoteVerification=json.loads((C/'remote-verification.json').read_text()),observer=json.loads((C/'observer.json').read_text()),requestedInput=dict(route='original production CLI control',sequence=['mousemove:343:213','mousedown:343:213','mouseup:343:213'],plan=str(C/'guest.py'),acknowledgements='retained on stopped snapshot in capture/runtime-evidence.json; not retrieved or inspected'),queueEnqueueObserved=None,hostCheckInputReturnObserved=None,returnedMSGObserved=None,wndprocObserved=None,SDLConsumptionObserved=None,newPNGGenerated=True,newPNGInspected=False,newRenderReviewed=False,gameplayAccepted=False,selectedEvidence=selected,captureManifest=manifest,blocker=dict(reason='selected unique final.png plus runtime-evidence.json exceeds400000-byte selection ceiling',selectedBytes=456474,ceiling=400000,excess=56474,firstFailure=json.loads((C/'failure.json').read_text()),transferredSelectedBytes=0),lifecycle=close,allocation=allocation,validation=dict(helperSyntax=True,ownedCWDRejectingControls='prelaunch.json',mountArgv='prelaunch.json',immutableInputs='pin-check.json',fileVsCaptureLimits='prelaunch.json',observerInstalled=True,NodeStartup='guest controller asserts v24.22.1 startup before Popen; actual limits receipt remains uninspected on snapshot',manifestPrintBeforeAssert=True,watchdogReaped=json.loads((C/'watchdog-reaped.json').read_text())),rawEvidenceRoot=str(C),retainedRemoteEvidence='/home/user/enigma-original/capture',gaps=['No selected PNG or runtime-evidence.json transferred because selection arithmetic rejected before any transfer.', 'No personal image inspection; no returned MSG/wndproc/SDL or gameplay acceptance claim.', 'Controller exited0 and remote files exist; individual control acknowledgements/startup limits/log contents were not retrieved.', 'Identical before/after/final PNG hashes are observed metadata, not proof of input consumption or gameplay.', 'Full historical files were verified, not current main or a rebuilt module.'],publicationMethod='exact tree/blob objects with original parent; no full index rewrite; no main write',messageboardPublication='coordinator-owned: standing board14114689 exceeds12582912 FSIZE; messageboard-note.txt supplied',policy=dict(localAllocation=64*s.M,reserve=8*s.M,newGrowth=3*s.M,CPU=[60,60],generatedFSIZE=12*s.M,capture=524288,aggregateCapture=4*s.M,selectedEvidence=400000,pythonDATA=128*s.M,gitDATA=256*s.M,guestGroupRSS=2*1073741824,remoteAllocation=256*s.M,RAMAdmission=False))
s.save('completion-receipt.json',rec)
(C/'README.txt').write_text('One new finite-TTL supported fork bx_6j9h42np of retained bx_jvne7b63. Full archive and2663-file manifest verified in place. One original-game DOWN/UP controller ran and exited0. Evidence selection failed before transfer: final.png389913 + runtime-evidence.json66561 =456474 >400000. No local PNG inspection or queue/MSG/wndproc/SDL/gameplay claim. Identical before/after/final image hashes retained as metadata only. New Boat stopped and post-run snapshot completed/verified2026-10-30T09:18:12.548Z. No old Boat resume, SSH runtime, retransfer, extraction, rebuild or main mutation. Raw captures and exact guest acknowledgements retained in new stopped snapshot; no further runtime authorized by this report.\n')
# Read and watch shared coordination without attempting an oversized append.
s.run(['tail','-n','8','/home/user/wine-assembly/messageboard.txt'],cwd=C)
with (C/'board-watch.stdout').open('xb') as a,(C/'board-watch.stderr').open('xb') as b:
 watcher=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=b,start_new_session=True,preexec_fn=lambda:s.limits('native'))
try:
 names=['completion-receipt.json','README.txt','supervisor.py','runtime.py','guest.py','verify-remote.py','publish.py','prelaunch.json','pin-check.json','remote-verification.json','observer.json','guest-invocation.json','runtime-operation.json','capture-manifest.json','selected-captures.json','failure.json','closeout.json','schedule.json','watchdog.json','watchdog-reaped.json','allocation-publication.json']
 entries=[]
 for n in names:
  data=(C/n).read_bytes();sha=s.git('hash-object','-w','--stdin',mutate=True,input=data)['stdout'].strip();entries.append('100644 blob '+sha+'\t'+n+'\0')
 report=s.git('mktree','-z',mutate=True,input=''.join(entries).encode())['stdout'].strip()
 def update_tree(rev,name,new):
  raw=s.git('ls-tree','-z',rev)['stdout'];rows=[x for x in raw.split('\0') if x and x.split('\t',1)[1]!=name]
  rows.append('040000 tree '+new+'\t'+name)
  return s.git('mktree','-z',mutate=True,input=('\0'.join(rows)+'\0').encode())['stdout'].strip()
 test=update_tree(base+':test',C.name,report);tree=update_tree(base,'test',test)
 sha=s.git('commit-tree',tree,'-p',base,'-m','test: record Enigma fork input run and evidence budget blocker',mutate=True)['stdout'].strip()
 s.git('diff','--check',base,sha)
 paths=s.git('diff','--name-only',base,sha)['stdout'].splitlines();assert len(paths)==len(names) and all(p.startswith('test/'+C.name+'/') for p in paths)
 s.git('update-ref','refs/heads/'+branch,sha,'0'*40,mutate=True)
 s.admission('before-push')
 s.git('push','git@github.com:vgrichina/wine-assembly.git',sha+':refs/heads/'+branch,mutate=True,wall=90)
 remote=s.git('ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/'+branch)['stdout'].split()[0];assert remote==sha
 pub=dict(commit=sha,remoteSHA=remote,remoteBranch=branch,remoteVerified=True,parent=base,reportFiles=paths,at=time.time())
 s.save('publication.json',pub);rec.update(pub);rec['finalAllocation']=s.admission('final');s.save('completion-receipt.json',rec)
 (C/'messageboard-note.txt').write_text('Enigma snapshot fork input RELEASE/BLOCKED: commit '+sha+' remote refs/heads/'+branch+' exact SHA verified. New bx_6j9h42np fork created09:17:24Z; original DOWN/UP controller exited0. Archive and2663-file digest pass; historical module af202eea only. Selected final PNG389913+runtime report66561=456474 >400000; zero selected bytes retrieved; no image inspection or queue/MSG/wndproc/SDL/gameplay acceptance. New Boat stopped with completed post-run snapshot verified09:18:12.548Z; watchdog reaped. Old Boats untouched. Canonical receipt '+str(C/'completion-receipt.json')+'. Board append coordinator-owned (standing board exceeds FSIZE); no main write.\n')
 print(json.dumps(pub))
finally:
 os.killpg(watcher.pid,signal.SIGTERM);watcher.wait(timeout=3)

"""Publish bounded failure evidence and parent ancestry without an index or main write."""
import supervisor as s
import ast,json,pathlib,time,subprocess,signal,os
C=s.C;base='7e6c93e5afded4727a85b366aa51fb0e4044dcd6';branch='test/'+C.name
close=json.loads((C/'closeout.json').read_text());assert close['verifiedStopped'] and close['postRunSnapshotCompleted'] and close['sandbox']['id']=='bx_jtdgbp9t'
assert close['sandbox']['snapshotVerifiedAt']>close['sandbox']['createdAt']
for n in ['supervisor.py','recover.py','watchdog-as-launched.py','publish.py']:ast.parse((C/n).read_text())
assert s.git('rev-parse','HEAD')['stdout'].strip()==base
for flag,want in [('--show-toplevel',str(s.REPO)),('--absolute-git-dir',str(s.REPO/'.git'))]:assert s.git('rev-parse',flag)['stdout'].strip()==want
assert not (s.REPO/'.git/index').exists()
allocation=s.admission('before-publication')
rec=dict(task=C.name,status='BLOCKED_PREMATURE_WATCHDOG_STOP',objectiveAchieved=False,at=time.time(),sourceRevision='425755ee5ee9be0734c7aca187521100f5487674',app='original Enigma 1.01',moduleBytes=1880854,moduleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',originalRuntimeUTC='2026-10-30T09:17:29Z',currentMainRuntimeValidated=False,parentCommit=base,parentOriginallyUnbacked=True,commitref='refs/heads/'+branch,forkCount=1,forkParent='bx_6j9h42np',newBoat=s.box(),schedule=json.loads((C/'schedule.json').read_text()),lifecycle=close,allocation=allocation,originalRawVerification=json.loads((C/'original-keys.json').read_text()),originalRawDownloaded=False,selection=json.loads((C/'selection-preflight.json').read_text()),selectedFilesDownloaded=[],selectedBytesDownloaded=0,PNGPersonallyInspected=False,diagnosticSummaryCreated=False,controllerAcknowledgementsObserved=False,queueEnqueueObserved=None,hostCheckInputReturnObserved=None,returnedMSGObserved=None,wndprocObserved=None,SDLConsumptionObserved=None,CPUObserved=None,gameplayAccepted=False,inputBoundary='Only command request presence in original events indices6(mousemove),8(mousedown),13(mouseup) observed; ack dictionaries have ok/value keys, values uninspected. No queue/host-return/MSG/wndproc/SDL boundary established.',failure=json.loads((C/'first-failure.json').read_text()),cause='Watchdog loaded parent-liveness cleanup before supervisor was corrected; controller exited after key inspection, triggering stop before subsequent retrieval. Changing file later did not change running watchdog.',watchdogCorrection='Retained as-launched source and failed stage. Supervisor now waits to finite shutdown deadline across bounded controller stages; no rerun performed.',oldBoatsMutated=False,guestInvocationsThisTask=0,assetsTransferred=False,nextRepairTarget=None,gaps=['Single PNG and bounded summary were not retrieved; no personal image inspection.','Identical historical PNG hashes do not show input consumption.','No guest renderer/input code defect can be inferred from uninspected trace.','No resume, second fork, denial retry, guest replay, build, main write or Telegram.'],retainedRemoteEvidence='/home/user/enigma-original/capture on bx_jtdgbp9t completed snapshot; original stopped bx_6j9h42np untouched',publicationMethod='exact Git blobs/trees; parent ancestry pushed with task outcome; exact remote SHA required for backup',messageboard='coordinator append via messageboard-note.txt; shared root edits prohibited',policy=dict(localCap=64*s.M,workGrowth=8*s.M,publicationReserve=8*s.M,hostFloor=1610612736,RAMAdmission=False,CPU=[60,60],generatedFSIZE=12*s.M,capture=524288,aggregateCapture=4*s.M,request=16384,selectedCeiling=400000,pythonDATA=128*s.M,gitDATA=256*s.M))
s.save('completion-receipt.json',rec)
(C/'README.txt').write_text('Incomplete retained Enigma capture recovery. New fork bx_jtdgbp9t verified original report66561 bytes SHA10c942183341bdfaf795fc4059e876f2879b9c303b3d531a740e0662c284b18d and inspected keys only. Watchdog parent-liveness cleanup stopped Boat when key-stage controller exited. Subsequent exec returned machine_not_running409; no retry/resume/second Boat. No PNG/diagnostic-summary retrieval, personal image inspection, input-consumption or gameplay claim. Boat stopped09:28:51.742Z; completed snapshot09:28:51.693Z. Original stopped Boats preserved. Parent7e6c93e5 ancestry is included in publication. Failed controller/as-launched watchdog retained; corrected supervisor syntax checked only.\n')
s.run(['tail','-n','3','/home/user/wine-assembly/messageboard.txt'],cwd=C)
with (C/'board-watch.stdout').open('xb') as a,(C/'board-watch.stderr').open('xb') as b:
 watcher=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=b,start_new_session=True,preexec_fn=lambda:s.limits('native'))
try:
 names=['README.txt','completion-receipt.json','supervisor.py','watchdog-as-launched.py','recover.py','publish.py','preflight.json','original-keys.json','first-failure.json','closeout.json','schedule.json','allocation-before-publication.json']
 entries=[]
 for n in names:
  h=s.git('hash-object','-w','--stdin',input=(C/n).read_bytes())['stdout'].strip();entries.append('100644 blob '+h+'\t'+n)
 report=s.git('mktree','-z',input=('\0'.join(entries)+'\0').encode())['stdout'].strip()
 def update(rev,name,obj):
  rows=[r for r in s.git('ls-tree','-z',rev)['stdout'].split('\0') if r and r.split('\t',1)[1]!=name];rows.append('040000 tree '+obj+'\t'+name)
  return s.git('mktree','-z',input=('\0'.join(rows)+'\0').encode())['stdout'].strip()
 tree=update(base,'test',update(base+':test',C.name,report))
 sha=s.git('commit-tree',tree,'-p',base,'-m','test: preserve Enigma capture recovery failure and unbacked parent')['stdout'].strip()
 s.git('diff','--check',base,sha)
 paths=s.git('diff','--name-only',base,sha)['stdout'].splitlines();assert len(paths)==len(names) and all(p.startswith('test/'+C.name+'/') for p in paths)
 s.git('update-ref','refs/heads/'+branch,sha,'0'*40)
 s.save('local-commit.json',dict(commit=sha,branch=branch,parent=base,remoteVerified=False))
 s.admission('before-push')
 s.git('push','origin',sha+':refs/heads/'+branch,wall=90)
 actual=s.git('ls-remote','origin','refs/heads/'+branch)['stdout'].split()[0];assert actual==sha
 s.git('merge-base','--is-ancestor',base,actual)
 pub=dict(commit=sha,branch=branch,remoteSHA=actual,remoteVerified=True,parent=base,parentAncestryBackedUp=True,at=time.time())
 s.save('publication.json',pub);rec.update(pub);s.save('completion-receipt.json',rec)
 (C/'messageboard-note.txt').write_text('Enigma retained-capture recovery BLOCKED/RELEASE. Commit '+sha+' remote '+branch+' exact SHA verified; parent7e6c93e5 ancestry now remotely backed up. New bx_jtdgbp9t stopped09:28:51.742Z completed snapshot09:28:51.693Z. Full raw report length/SHA and JSON keys verified on fork, no PNG/summary retrieved. Premature parent-liveness watchdog cleanup caused subsequent machine_not_running409; no retry/resume/new Boat. Input boundary remains command requests only; no input consumption/gameplay/current-main qualification. Receipt '+str(C/'completion-receipt.json')+'. No shared root edits; coordinator append required.\n')
 print(json.dumps(pub))
finally:
 os.killpg(watcher.pid,signal.SIGTERM);watcher.wait(timeout=3)

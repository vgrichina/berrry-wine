import supervisor as s,ast,json,time,subprocess,os,signal
s.ENV.update(GIT_AUTHOR_NAME='Wine Ops',GIT_AUTHOR_EMAIL='wine-ops@localhost',GIT_COMMITTER_NAME='Wine Ops',GIT_COMMITTER_EMAIL='wine-ops@localhost')
C=s.C;base='999e81c8f97ae5668989d96c3ad4c72ab77a8405';branch='test/'+C.name
close=json.loads((C/'closeout.json').read_text());assert close['verifiedStopped'] and close['postRunSnapshotCompleted']
for n in ['supervisor.py','prepare.py','retrieve.py','finish-retrieval.py','publish.py']:ast.parse((C/n).read_text())
assert s.git('rev-parse','HEAD')['stdout'].strip()==base
assert not (s.REPO/'.git/index').exists()
allocation=s.admission('publication')
summary=json.loads((C/'diagnostic-summary.json').read_text())
rec=dict(task=C.name,status='RECOVERED_AND_INSPECTED',objectiveAchieved=True,at=time.time(),session=allocation['session'],sourceRevision='425755ee5ee9be0734c7aca187521100f5487674',app='original Enigma 1.01',moduleBytes=1880854,moduleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',originalRuntimeUTC=summary['fields']['utc'],originalRuntimeEndUTC=summary['fields']['utcEnd'],currentMainRuntimeValidated=False,parentCommit=base,parentOriginallyUnbacked=True,parentAlreadyRemotelyBackedBeforeThisTask=True,originalRuntimeParent='7e6c93e5afded4727a85b366aa51fb0e4044dcd6',commitref='refs/heads/'+branch,commitIdentity='containing commit; exact SHA and remote verification in adjacent publication.json',forkCount=1,forkParent='bx_jtdgbp9t',newBoat=s.box(),schedule=json.loads((C/'schedule.json').read_text()),lifecycle=close,allocation=allocation,selection=json.loads((C/'retrieval-verification.json').read_text()),originalRawDownloaded=False,originalRawPreserved='capture/runtime-evidence.json in new completed stopped snapshot; original bytes66561 SHA10c942183341bdfaf795fc4059e876f2879b9c303b3d531a740e0662c284b18d verified remotely',PNGPersonallyInspected=True,imageObservation='640x480 image titled Enigma - Main Menu; logo and Start Game, Level Pack, Options, Credits, Quit visible. Remains Main Menu. Start Game at requested screen point343,213. Before/after/final identical pinned hashes show no visual change, not successful consumption.',controllerAcknowledgements='events6,8,13 each ok=true queued=true; move/down batch83011, up batch83158',inputBoundary='Observed mouse-down host dequeue from renderer msg513 wParam1 lParam11141440 (client320,170), host.check_input packed66049; diagnostic invocation-owned PeekMessageA then GetMessageA report result1 MSG513; DispatchMessageA entry MSG513 observed. Historical completion instrumentation scope says canonical build/runtime qualification still required; capabilities successfulReturnMSG=false. No qualified current-main result.',mouseupBoundary='event17 final poll batch83361 rendererDepth1 rendererHead WM_LBUTTONUP514; trace saturation at traceSelected165 records127/max128 means absence after saturation is not evidence.',wndprocObserved=None,SDLConsumptionObserved=None,CPUObserved=None,gameplayAccepted=False,guestInvocationsThisTask=0,assetsTransferred=False,oldBoatsMutated=False,nextRepairTarget='Bounded diagnostic qualification from observed mouse-down DispatchMessageA entry through actual wndproc and SDL consumer, with a fresh budget/window covering mouse-up. Current trace does not identify a renderer/input implementation defect.',gaps=['Wndproc/SDL consumption unknown.','Mouse-up host dequeue/returned MSG unknown after saturated bounded stream.','CPU time unknown in inspected extract; wall elapsed is not CPU.','Historical module only; no current-main qualification or gameplay acceptance.'],controls=json.loads((C/'preflight.json').read_text()),publicationMethod='exact Git blobs/trees; no full index or checkout; trusted configured SSH Git; parent ancestry included and exact remote SHA required',messageboard='Coordinator append delegated messageboard-note.txt; shared root untouched')
s.save('completion-receipt.json',rec)
(C/'README.txt').write_text('Original Enigma retained-input recovery completed, no guest replay. One PNG389913 + exact bounded diagnostic extract7392 =397305 bytes. Personal inspection: Main Menu remains visible. DOWN reaches host dequeue/check_input, historical MSG completion and DispatchMessageA entry; wndproc/SDL consumption unknown, UP remains renderer head in final poll, boundary trace saturated. Completion scope remains unqualified historical module, not current main. New Boat '+s.box()+' stopped with completed verified post-recovery snapshot. See completion-receipt and selected exact trace indices. Parent999e81c8 and7e6c93e5 already remotely backed before this task; containing task commit retains ancestry.\n')
s.run(['tail','-n','3','/home/user/wine-assembly/messageboard.txt'],cwd=C)
with (C/'board-watch.stdout').open('ab') as a,(C/'board-watch.stderr').open('ab') as b:
 watcher=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],cwd=s.cwd_check(C),env=s.ENV,stdout=a,stderr=b,start_new_session=True,preexec_fn=lambda:s.limits('native'))
try:
 names=['README.txt','completion-receipt.json','supervisor.py','prepare.py','retrieve.py','finish-retrieval.py','publish.py','preflight.json','selection-preflight.json','selected-manifest.json','retrieval-verification.json','closeout.json','schedule.json','allocation-publication.json','final.png','diagnostic-summary.json']
 entries=[]
 for n in names:
  h=s.git('hash-object','-w','--stdin',input=(C/n).read_bytes())['stdout'].strip();entries.append('100644 blob '+h+'\t'+n)
 report=s.git('mktree','-z',input=('\0'.join(entries)+'\0').encode())['stdout'].strip()
 def update(rev,name,obj):
  rows=[r for r in s.git('ls-tree','-z',rev)['stdout'].split('\0') if r and r.split('\t',1)[1]!=name];rows.append('040000 tree '+obj+'\t'+name)
  return s.git('mktree','-z',input=('\0'.join(rows)+'\0').encode())['stdout'].strip()
 tree=update(base,'test',update(base+':test',C.name,report))
 sha=s.git('commit-tree',tree,'-p',base,'-m','test: recover and inspect original Enigma retained input capture')['stdout'].strip()
 s.git('diff','--check',base,sha)
 paths=s.git('diff','--name-only',base,sha)['stdout'].splitlines();assert len(paths)==len(names) and all(p.startswith('test/'+C.name+'/') for p in paths)
 s.git('update-ref','refs/heads/'+branch,sha,'0'*40,mutate=True)
 s.save('local-commit.json',dict(commit=sha,branch=branch,parent=base,remoteVerified=False))
 s.admission('before-push')
 s.git('push','origin',sha+':refs/heads/'+branch,wall=90)
 actual=s.git('ls-remote','origin','refs/heads/'+branch)['stdout'].split()[0];assert actual==sha
 s.git('merge-base','--is-ancestor',rec['originalRuntimeParent'],actual)
 pub=dict(commit=sha,branch=branch,remoteSHA=actual,remoteVerified=True,parent=base,parentAncestryBackedUp=True,at=time.time());s.save('publication.json',pub)
 rec.update(pub);s.save('completion-receipt.json',rec)
 (C/'messageboard-note.txt').write_text('Enigma retained-capture recovery COMPLETE/RELEASE. Commit '+sha+' remote '+branch+' exact SHA verified; ancestry999e81c8/7e6c93e5 remotely backed. One personally inspected PNG +7392-byte exact bounded extract397305 total; historical DOWN host dequeue/check_input/diagnostic MSG completion/DispatchMessageA entry observed; wndproc/SDL and UP consumption unknown (saturation; UP final renderer head). Main Menu unchanged, no gameplay/current-main claim. Boat '+s.box()+' stopped09:41:50.946Z completed verified snapshot09:41:50.893Z. ZERO guest invocations, old Boats untouched. Receipt '+str(C/'completion-receipt.json')+'. Coordinator append this note; no shared root edits.\n')
 print(json.dumps(pub))
finally:
 os.killpg(watcher.pid,signal.SIGTERM);watcher.wait(timeout=3)

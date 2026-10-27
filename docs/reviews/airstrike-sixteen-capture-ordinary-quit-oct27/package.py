import pathlib,sys,json,shutil,hashlib,os,time
import run as c
H,R=c.H,c.R;ROOT=c.ROOT
assert c.gate() is None
D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
g=R/'.git';assert g.is_dir()
(g/'objects/info/alternates').write_text(str(D/'.git/objects')+'\n'+(D/'.git/objects/info/alternates').read_text())
(g/'config').write_text('''[core]
 repositoryformatversion = 0
 bare = false
 sparseCheckout = true
[user]
 name = Wine Ops Worker
 email = wine-ops@local
[gc]
 auto = 0
[maintenance]
 auto = false
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
''')
branch='task/airstrike-sixteen-capture-ordinary-quit-oct27'
(g/'HEAD').write_text('ref: refs/heads/'+branch+'\n')
ref=g/'refs/heads'/branch;ref.parent.mkdir(parents=True,exist_ok=True);ref.write_text('ebecde207d027cb5067b132f79160a69d031e039\n')
dest=R/'docs/reviews/airstrike-sixteen-capture-ordinary-quit-oct27';dest.mkdir(parents=True,exist_ok=True)
(g/'info/sparse-checkout').write_text('/docs/reviews/airstrike-sixteen-capture-ordinary-quit-oct27/\n')
q=json.loads((H/'dispatch-boundary-result.json').read_text());boundary=json.loads((H/'boundary-result.json').read_text())
result=dict(status=q['status'],actualGuestStarts=0,sourceEdits=False,main=False,publicDeployment=False,captureAllocation=dict(count=16,perCaptureBytes=2097152,localBytes=134217728,remoteBytes=268435456,apiCaptureBytes=8388608),fixture16=boundary['result'],dispatch=q,box=dict(id='bx_fk6x4peu',state='RUNNING at coordinator dispatch; API exec succeeded 09:15:56Z',expiry='2026-10-27T09:42:43Z',guestCutoff='2026-10-27T09:30:00Z',handback='2026-10-27T09:32:00Z',shutdown='2026-10-27T09:35:00Z',owner='coordinator',untouched=True),cleanup=dict(guestProcessStarted=False,remoteStageFiles=0,noBoxShutdown=True),rootRefs='launcher digest reused; no later comparison claimed; root read-only',restrictions='single bounded gpt-6.1-sol medium worker 200k total compaction; no workers, main ownership, source edits, deployment, runtime SSH/resume, retries of denial, compile, full checkout/repack; strict supplied Git SSH; Git DATA512MiB child-only/RSS256MiB pool2+flock; Python RSS128MiB pool1 CPU90 wall120 file24MiB output2MiB display8192B cumulative1MiB; local128MiB20/16/52/40; remote256MiB; guest one invocation2GiB physical heap512 CPU90 wall120 unused',remaining=q['remaining'])
c.dump('result.json',result);c.dump('checkpoint.json',dict(at=time.time(),result=result,admission=json.loads((H/'accounting.json').read_text()),passedSuitesReused=True,fullGuestStagingNotPerformed=True))
(dest/'.gitattributes').write_text('*.stdout -diff\n*.stderr -diff\n')
(dest/'README.md').write_text('''# Airstrike ordinary Quit remains open

The amended sixteen-capture resource preflight passes using the unchanged accepted production Controller and Observation Bridge and their deterministic fake runner. All sixteen captures are fixture bytes. The predecessor eight-capture rejection remains historical and was not consumed retroactively.

A new prerequisite boundary rejects before scarce guest execution: the exact historical production runner queues keydown while frozen and ACKs `{queued:true,batch:12}` without an input execution log. Its actual `parseInputEntries` and `handleControlCommand` functions were extracted byte-for-byte from runner SHA4d7b9587 at revision b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a. The unchanged accepted Controller rejects that exact ACK as uncertain dispatch. The unchanged accepted Bridge contains no step or thaw orchestration. A non-frozen diagnostic returns a pending Promise, confirming the distinct execution path. This is a narrow source-extraction protocol fixture, not full runner/guest initialization acceptance.

The assigned contract requires serial ACK/frozen-zero and prohibits source changes. We did not invent a live/frozen adapter, synthesize executed ACKs, silently run live, or spend the sole guest attempt on the known rejected boundary. No guest started, input was delivered, PNG was captured from a game, or remote runtime was staged. Ordinary focus, menu rows0..6, Enter on Quit, guest Exit0 and clean runner exit remain unqualified. Coordinator resolution is required for the runner/bridge frozen-input protocol.

All preceding accepted suites, build, codec/font/ABI receipts and historical sustained-play receipts are reused without repetition; no current-main emulator claim. Assigned box bx_fk6x4peu API probe succeeded with ample RAM/disk; it remains coordinator owned, running as assigned, with shutdown09:35 before expiry09:42:43 UTC. This worker performs no stop/resume. Setup incidents include an initial oversized policy display, a transient sixth-client admission rejection and an owned nested-accounting temp-file race; they remain recorded and do not acquire retrospective compliance. The temp file now uses process-specific names.

Evidence-only task branch publication; no source, main, or public deployment.
''')
for p in H.iterdir():
 if p.is_file() and p.name not in ('board-watch.log',) and not p.name.endswith('.tmp'):
  shutil.copyfile(p,dest/p.name)
shutil.copytree(pathlib.Path(boundary['evidence']).parent,dest/'fixture16',dirs_exist_ok=True)
for name,p in [('predecessor-result.json',pathlib.Path('/tmp/airstrike-cleanup-ordinary-quit-oct27/ops/result.json')),('predecessor-boundary-result.json',pathlib.Path('/tmp/airstrike-cleanup-ordinary-quit-oct27/ops/boundary-result.json')),('capture-amendment.json',ROOT/'scratch/usage-watch/airstrike-cleanup-capture-allocation-amendment-oct27.json'),('runtime.json',ROOT/'scratch/usage-watch/airstrike-sixteen-capture-ordinary-quit-oct27.task.runtime.json'),('root-ref-initial.json',ROOT/'scratch/usage-watch/airstrike-sixteen-capture-ordinary-quit-oct27/root-ref-digest.json')]:shutil.copyfile(p,dest/name)
manifest=[dict(path=str(p.relative_to(dest)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(dest.rglob('*')) if p.is_file() and p.name!='manifest.json']
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for x in manifest:assert hashlib.sha256((dest/x['path']).read_bytes()).hexdigest()==x['sha256']
print('Packaged and verified',len(manifest),'payload hashes; no guest; protocol blocker retained')

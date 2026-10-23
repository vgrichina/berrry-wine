import sys,os,json,pathlib,hashlib,shutil,signal,subprocess,time
import guard
B=guard.B; R=B/'repo'; NAME='d3d-memory-recovered-native-qualification-20261023'
D=R/'docs/re-notes'/NAME; BRANCH='task/d3d-memory-recovered-native-qualification-oct23'
def git(*args,env=None): return guard.run(['git','-C',str(R),*args],phase='python',env=env)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
guard.sample()
assert git('branch','--show-current').strip()==BRANCH
assert not git('diff','5406777ecbcef9cf9b03b40d592d722bb0086de0','--','src','lib')
assert not git('diff','--','test')
assert git('rev-parse','HEAD').strip()=='c036485baff35327c860c82b4cce74afe6431de2'
# Resume the required board watcher only if the retained watcher has exited.
watchpid=int((B/'board-watch.pid').read_text())
try: os.kill(watchpid,0)
except ProcessLookupError:
 with (B/'board-watch.log').open('ab') as log:
  p=subprocess.Popen(['tail','-n','0','-f',str(guard.ROOT/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True)
  watchpid=p.pid;(B/'board-watch.pid').write_text(str(watchpid))
phases=[x for x in map(json.loads,(B/'execution.jsonl').read_text().splitlines()) if x['phase'] in ['prepare','native']]
assert len(phases)==4 and all(x['exit']==0 and not x['failure'] for x in phases)
assert '26 cases' in phases[1]['output'] and 'PASS 2 cases' in phases[3]['output']
alive=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit(): continue
 try:
  args=(p/'cmdline').read_bytes().split(b'\0')
  if args and pathlib.Path(os.fsdecode(args[0])).name=='node' and any(b'test-d3d-software-compaction.js'==a.split(b'/')[-1] or b'test-d3d-software-ctx-arena-reuse.js'==a.split(b'/')[-1] for a in args[1:]):alive.append(int(p.name))
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
assert not alive,alive
guard.write(B/'recovered-cleanup.json',{'nativeChildrenSurviving':alive,'modulesRetained':True,'moduleBytes':sum((B/(n+'.wasm')).stat().st_size for n in ['compaction','ctx-arena-reuse']),'boxes':{'id':None,'state':'not assigned; prior boxes stopped','expiry':None,'lifecycleOwner':'coordinator'},'terminationPolicy':'guard TERM process group; on failure wait 5s then KILL; no failures/timeouts or surviving suite Node processes'})
guard.write(B/'recovered-phases.json',{'cwd':str(R),'session':os.environ['WINE_TASK_SESSION_ID'],'wrapperEnv':{k:os.environ[k] for k in ['WINE_TASK_SESSION_ID','WINE_TASK_OUTPUT_DIR']},'phases':phases,'environmentRecipe':'native.py removes NODE_OPTIONS and both artifact variables; preparation sets only WINE_RENDER_ARTIFACT_PREPARE to suite-specific absolute module, consume sets only WINE_RENDER_ARTIFACT to same module; no compilation fallback; fixed 512MiB guest/no Workers','limits':{'prepare':{'heapMiB':2048,'cpuWallSeconds':900,'MemAvailable':2684354560},'native':{'heapMiB':512,'cpuWallSeconds':150,'MemAvailable':1610612736},'cheap':{'heapMiB':256,'cpuWallSeconds':60,'MemAvailable':805306368}}})
guard.sample();D.mkdir(parents=True,exist_ok=True)
files=['recovered-first-admission.json','recovered-source-binding.json','recovered-artifact-controls.json','recovered-cleanup.json','recovered-phases.json','compaction-prepared.json','compaction-native.json','ctx-arena-reuse-prepared.json','ctx-arena-reuse-native.json','compiler-identity.json','guard.py','native.py','recovered-publish.py','admission.json']
for n in files:shutil.copyfile(B/n,D/n)
for n in ['d3d-memory-watch-oct23.json','d3d-recovered-dispatch-admission-oct23.json']:shutil.copyfile(guard.ROOT/'scratch/usage-watch'/n,D/n)
guard.write(D/'accounting-before-publication.json',guard.sample())
modules=[]
for n in ['compaction','ctx-arena-reuse']:
 j=json.loads((B/(n+'-prepared.json')).read_text());modules.append(f"| {n} | {j['bytes']} | `{j['sha256']}` | `{j['manifestSha256']}` | `{j['manifest']['extraWat']['sha256']}` |")
text='''# Recovered D3D native qualification, 2026-10-23

PASS: real native compaction (26 cases) and unchanged whole-large-arena reuse (2 cases), with separately prepared diagnostic modules and separate consume-only Node processes. All four phases exited 0. No production source changes, assertion changes, packages, downloads, boxes, shared integration or main merge.

Source is production main `5406777ecbcef9cf9b03b40d592d722bb0086de0` with only accepted unmerged fixture `09dc88de08907d362eef2ac5dbbaad0080147358` compaction test delta. Retained parent task commit `c036485baff35327c860c82b4cce74afe6431de2` includes predecessor documentation. Current 205-file, 23,707,757-byte source inventory hashes all matched before reuse, along with installed tool hashes and all 23 pinned pngjs files (63,864 bytes). Existing exact-revision selected source-gate receipts are reused, not replayed. Full inventory and previous gate outputs remain in adjacent `d3d-scoped-native-qualification-20261023/`; new hash binding is attached. Compiler full path/blob/SHA, helper, adapter, loader and compiler stages are retained in `compiler-identity.json`; each module manifest additionally seals all helper/compiler/module sources and its exact extraWat.

Compaction baseline checks clipping pixels, retained capacity/index relocation, point sidecars, wire edges, allocator-visible clipping-tail reuse, equivalent constrained streaming pixels and samples. Negative controls inject rejection at the third native create: streaming pixels equal an independently rendered successful batch prefix (which differs from cleared pixels), with unchanged public sample counters, baseline accounting and empty live/pending context sets; retained mode first proves non-streaming selection and then requires unchanged pixels/samples, baseline accounting and empty context sets. Final destroy returns device accounting to zero. Arena tests prove large blocks remain whole, reuse the same context through three draws, render distinct colours and reproduce pixels after reuse. Separate cheap controls accept each exact module and reject both cross-suite extraWat substitutions and missing artifacts. Prior 32-byte capture rejection/sentinel control remains accepted predecessor evidence.

| Suite | Module bytes | Module SHA-256 | Manifest SHA-256 | extraWat SHA-256 (UTF-16LE) |
|---|---:|---|---|---|
'''+ '\n'.join(modules)+'''

Engine: installed Node 24.18.1, V8 13.6.233.17-node.50; executable path and full-file SHA are bound in the predecessor source inventory, checked again here. No Workers; fixed 512MiB guest. Exact argv, cwd, exit, memory measurement, duration, bounded output and artifact environment recipe are in `recovered-phases.json`. Preparation heap 2048MiB/CPU and wall 900s/MemAvailable minimum 2,684,354,560; consume heap 512MiB/150s/minimum 1,610,612,736. Preparation emits PREPARATION ONLY and exits before guest allocation/assertions; the subsequent native phases supply the actual acceptance evidence. Modules are different and never substituted.

One prior memory attempt was denied before launching the compiler: 2,594,131,968 < 2,684,354,560 bytes. No unchanged retry. Changed prerequisite: three passing coordinator recovery samples at 21:24:35/21:24:55/21:25:15 UTC and fresh dispatch admission. This continuation's initial admission measured 3,978,940,416 available and projected 65,999,216 <= 67,108,864 NEW bytes, host-after 4,479,430,585 >= 2,982,150,144. Each subsequent command used retained guard enforcement, unchanged cumulative accounting and both session identities. Two prepare and two consume attempts succeeded; no genuine assertion or resource failures in this continuation.

Allocation remains 64MiB with 8MiB reserve and 16MiB future growth allowance, 24MiB per-file maximum, cumulative capture maximum 524,288 bytes including predecessor and direct inspection allowance. Installed Node/read-only inputs are standing bytes. SQLite/WAL/SHM positive growth and external/session highwaters are charged without shrink credit; no database manipulation. Current and publication accounting are attached/retained. Modules remain task-owned (3,759,563 bytes total); no byte release was necessary. No surviving suite Node processes; guard process-group TERM/5s/KILL failure cleanup remains in force and was not needed for successful children. Watcher is stopped after publication.

Recovery: retain `/tmp/d3d-scoped-native-qualification-oct23` and checkout, including both `.wasm` files, their `.wasm.json` manifests, inventory, wrappers and accounting history. To reproduce, use the exact retained inventory and compiler identities, set WINE_TASK_SESSION_ID to the new actual session and WINE_TASK_OUTPUT_DIR to its charged output directory, and obtain fresh consolidated and per-command admission before invoking `python3 native.py compaction` then `python3 native.py ctx-arena-reuse`. Each wrapper prepares its own module then consumes it. Do not reset accounting/baseline, copy tool installations, substitute generic modules or reuse stale source receipts after relevant source changes. Module/manifest hashes above and the attached preparation receipts allow retained-byte verification without recompilation.

Qualification is limited to these native diagnostic render modules. No full shipping/canonical build, SpiderMonkey, browser/gameplay or deployment claim. Fixture remains unmerged. Shadow Man 128MiB approval hold and original runtime403 unchanged. Box ID/expiry N/A; no box assigned, prior boxes stopped, lifecycle ownership stays with coordinator. No workers spawned and no production-slot refill.
'''
(R/'docs/re-notes'/(NAME+'.md')).write_text(text)
git('diff','--check');git('add','--sparse','--','docs/re-notes/'+NAME+'.md','docs/re-notes/'+NAME)
assert all(x.startswith('docs/re-notes/'+NAME) for x in git('diff','--cached','--name-only').splitlines())
git('diff','--cached','--check');git('commit','-m','docs: qualify recovered D3D native compaction and arena reuse')
head=git('rev-parse','HEAD').strip()
env=os.environ.copy();env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o ConnectTimeout=15'
git('push','origin','HEAD:refs/heads/'+BRANCH,env=env)
remote=git('ls-remote','--heads','origin','refs/heads/'+BRANCH,env=env).split()[0];assert remote==head
guard.write(B/'recovered-publication.json',{'commit':head,'branch':BRANCH,'remoteSha':remote,'verified':True,'strictSSH':True,'sample':guard.sample()})
try:os.kill(watchpid,signal.SIGTERM)
except ProcessLookupError:pass
print(json.dumps({'commit':head,'branch':BRANCH,'verifiedRemoteSha':remote,'sample':{k:v for k,v in guard.sample().items() if k in ['measuredNew','captureBytes','cumulativeGrowth','privateHighwater','hostFree','externalHighwater']}}))

from work import *
# Sole runtime is complete; serialize Git, never run Node/browser again.
test=json.loads((O/'test-result.json').read_text());receipt=json.loads((O/'test-receipt.json').read_text())
assert test['wasmSha256']==A['moduleExpectedSHA256'] and test['results']==[]
assert receipt['stopReason']=='aggregate RSS limit' and receipt['cleanupComplete']
snapshot=supervisor.snapshot()
remaining=[k for k in receipt['owned'] if k[0] in snapshot and snapshot[k[0]]['start']==k[1]]
assert not remaining,remaining
plan=json.loads((ROOT/'scratch/usage-watch/gl-palette-current-webgl-closure-plan-oct26.json').read_text())
for row in plan['files']:assert sha(S/row['path'])==row['sha256']
for p,h in A['acceptedProductionPins'].items():assert sha(R/p)==h
save('checkpoint.json',dict(status='BLOCKED: physical RSS cap exceeded at browser startup',candidate=A['candidate'],tree='ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce',sourceVerifiedAfter=149,productionPinsVerifiedAfter=5,compiledModuleSHA256=test['wasmSha256'],oracleSHA256=A['acceptedProductionPins']['test/test-d3dim-palette-gpu-web.js'],oracleExtraWatSHA256=test['extraWatSha256'],runtimeInvocations=1,WebGL1Observations=0,WebGL2Observations=0,expectedObservationsEach=42,renderer=None,backend=None,fallbacks=None,errors=[test['error']],supervisor=receipt,remainingOwned=remaining,remainingGate='Coordinator-authorized resource plan or separate suitable box; fresh admission and explicit new bounded invocation required. No retry authorized in this completed task.',gameplayInference=False,boxes=[],boxState=None,boxExpiry=None,lifecycle='No box assigned; coordinator ownership unchanged',oldIncidentsPreserved=True,unchangedAcceptedGroupsReused='1e19d8c01e5d7e40f1e8ad60df5079ee9d9d4d4e; detached/adopted/RSS controls not rerun'))
# Fresh publication-specific ownership/resource receipt, not another runtime attempt.
clients=[]
for p in P('/proc').iterdir():
 try:
  if os.readlink(p/'exe').removesuffix(' (deleted)').endswith('/codex'):
   clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096))
 except (OSError,ValueError):pass
mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
growth=sum(max(0,320*M-r['rss']) for r in clients);required=max(3489660928,(768+512+128)*M+growth)
save('publication-admission.json',dict(memAvailable=mem,required=required,clients=clients,remainingGrowth=growth,ownRuntimeReservation=0,physicalGit=512*M,GitDATA='512MiB Git child only',ledger=ledger(),passAdmission=mem>=required and check() is None))
assert mem>=required and check() is None
T=R/'docs/re-notes'/H.name;T.mkdir(parents=True)
readme=f'''# Published GL browser qualification: resource blocker

The single authorized invocation of the unchanged published fixture at `{A['candidate']}` (tree `ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce`) stopped at browser setup under the accepted supervisor because measured simultaneous aggregate RSS reached **1,083,064,320 bytes**, exceeding the **1,073,741,824-byte** physical subtree cap. Exit 1; CPU conservatively charged 19.494622 seconds; wall 6.495674 seconds. All 12 owned process identities, including detached/adopted descendants, were cleaned. No retry occurred.

The necessary single compilation passed the exact required module SHA-256 `{test['wasmSha256']}` with unchanged palette exports. The 149-file source closure and five accepted production files were rehashed before and after execution. The source is the retained verified unchanged subset of original main `754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2`, represented by subset commit `0d65e6daf568a2b0104fcaea75801e9fcac6d1ae`; the fixture and launch controls are exact published main. Two unchanged browser-oracle/export helper files were selectively recovered via the pinned published tree. No full checkout, source modification or unrelated compile/test occurred. The compiler/module/oracle pins remain reusable; module bytes are not retained by this fixture.

**WebGL1: zero of 42 expected observations. WebGL2: zero of 42 expected observations.** Browser version, actual renderer/backend and fallback/error statistics are unknown: Chrome startup did not complete. The launch request contains SwiftShader flags, which do not prove an actual backend or hardware acceleration. No framebuffer acceptance or application gameplay is claimed. Prior nonconformant wrapper-based 42-observation reports are preserved and are not acceptance for this task.

Exact Chrome `/opt/google/chrome/chrome` was validated as an executable ELF with SHA-256 `22e4d5ef0c637a87b59a9baad42625aba3284dc03d4a5908748e253556318c97`; the BetterChromium shell/timezone wrapper was never invoked. The unchanged oracle listens only on 127.0.0.1, and Puppeteer retains its default background-network suppression. No external access attempt, denied-network retry, wrapper/SSH/key/trust/permission modification or service change was made. No network-traffic capture was taken; this is not a claim of independently observed packet isolation.

The unchanged accepted supervisor was imported and its `supervise` API called with the task's 1024 MiB RSS, 90 CPU-second, 120 wall-second and 2 MiB captured-output bounds, plus a task-specific 192 MiB accounting callback; its canonical pathname was in the supervisor parent argv, satisfying the published parent-marker check. The unchanged standalone supervisor CLI defaults (1792 MiB RSS / 64 MiB disk) were not used. Independent control acceptance `1e19d8c01e5d7e40f1e8ad60df5079ee9d9d4d4e` and unchanged challenge groups were reused, not rerun. Physical RSS is the maximum of sampled simultaneous subtree-plus-supervisor RSS and waited process/descendant high water; it is a lower bound, and independent maxima are never summed. CPU conservatively accounts observed own/waited high waters and may double-charge waited work.

Node v24.18.1 startup succeeded with the exact executable, `--max-old-space-size=512`, environment and supervisor limits used for runtime. Inherited DATA/AS were unlimited; CPU90 and file24 MiB were recorded. The heap flag is not a total-process RSS cap (reported V8 heap limit 738197504 bytes). Git DATA512 MiB applies only to Git subprocesses, serialized after runtime. No Node/ancestor DATA limit was added.

Immediate runtime admission passed with MemAvailable 4,128,710,656 bytes against 3,489,660,928 required, actual client remaining growth counted once, and completed CivII reservations zero. Complete retained inputs/evidence, local Git, client/session/events, positive WAL once, prospective local/remote publication/profile/output growth and 8 MiB reserve fit the 192 MiB allocation; projected host free remained above 2,982,150,144 bytes. Standing Chrome/Puppeteer were read-only excluded. See individual receipts for measured charges.

Remaining gate: a coordinator-authorized resource plan or suitable separate box, fresh physical admission, and a newly authorized bounded browser invocation. This task stops with the blocker and changes no main/public deployment. No test box was assigned; box/state/expiry are N/A and coordinator lifecycle ownership is unchanged. Owned runtime children are gone; retained source/cache/evidence remain for recovery.
'''
(T/'README.md').write_text(readme)
# Compact durable evidence; retain originals and helpers in owned ops as well.
files=['admission.json','immediate-runtime-admission.json','pinned-inputs.json','launch-configuration.json','fixture-overlay.json','node-startup.json','node-startup-receipt.json','runtime-configuration.json','test-result.json','test-receipt.json','test.log','checkpoint.json','publication-admission.json','admit.py','work.py','prepare.py','execute.py','publish.py']
for name in files:shutil.copyfile(O/name,T/name)
shutil.copyfile(ROOT/('scratch/usage-watch/'+H.name+'/root-ref-digest.json'),T/'root-ref-digest.json')
# Preserve exact fixture sources as already tracked production files; only add evidence.
git('config','user.name','Wine Ops');git('config','user.email','wine-ops@local')
git('add','--sparse','--',str(T.relative_to(R)))
git('diff','--cached','--check')
manifest={str(p.relative_to(T)):dict(bytes=p.stat().st_size,sha256=sha(p)) for p in T.iterdir() if p.is_file()}
(T/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');git('add','--sparse','--',str((T/'manifest.json').relative_to(R)))
git('commit','-m','Record published GL browser RSS qualification blocker')
commit=git('rev-parse','HEAD').decode().strip();branch='task/'+H.name
git('push','origin','HEAD:refs/heads/'+branch)
remote=git('ls-remote','origin','refs/heads/'+branch).decode().split()[0];assert remote==commit
assert not git('status','--porcelain').strip()
save('publication.json',dict(commit=commit,branch=branch,remote=remote,exactRemoteVerified=True,SSH=SSH,evidencePath=str(T),mainPublished=False,ledger=ledger(),runtimeClean=True))
print(json.dumps(json.loads((O/'publication.json').read_text())))

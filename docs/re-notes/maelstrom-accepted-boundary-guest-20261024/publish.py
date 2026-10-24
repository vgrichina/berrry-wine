from work import *
R=H/'repo';name='maelstrom-accepted-boundary-guest-20261024';E=R/'docs/re-notes'/name;E.mkdir(parents=True,exist_ok=True)
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def git(*args):
 p=subprocess.run(['git','-C',str(R),*args],capture_output=True,text=True,env=env,timeout=60)
 with (H/'git-publication.jsonl').open('a') as f:f.write(json.dumps(dict(argv=list(args),returncode=p.returncode,stdout=p.stdout,stderr=p.stderr))+'\n')
 assert p.returncode==0,(args,p.stderr);return p.stdout.strip()
j=json.load(open(H/'analysis.json'));box=json.load(open(H/'box-handoff-api.json'))['sandbox'];assert box['state']=='idle' and box['health']=='ok' and box['stop'] is None
handoff=dict(box=box['id'],apiState=box['state'],running=True,health=box['health'],expiry=box['archiveAfter'],shutdownOwner='coordinator',shutdownCheckpoint='2026-10-24T12:33:00Z',guestProcessGroup=21459,remainingOwnedGroup=False,workerStopSnapshotResumeCreate=False)
save('box-handback.json',handoff)
# All historical receipts remain in place. New capture has its own allowance.
hist=[json.loads(x) for x in (H/'api-history.jsonl').read_text().splitlines()];resp=sum(x['responseBytes'] for x in hist)
prior=json.load(open(H/'historical-capture-accounting.json'))
extra=dict(apiResponses=resp,modelAndLocalReadsConservative=650000,collectedBytes=sum(p.stat().st_size for p in (H/'collected').rglob('*') if p.is_file()))
capture=dict(priorCharged=744811,priorReceipt=prior,extraCharges=extra,extraTotal=sum(extra.values()),extraCap=2097152,fullAPIRequestBytes=sum(x['requestBytes'] for x in hist),outputBytes=6353,outputGuard=131072,auditRecords=3,auditRecordCap=4,auditByteCap=8192,snapshotBytes=0,perReadCodeCap=8192,perReadInstructionsCap=65536,historyNotReset=True)
assert capture['extraTotal']<=capture['extraCap'];save('capture-final.json',capture)
save('resource-accounting-correction.json',dict(reason='Existing reused interim accounting reported closure logical bytes. Initial admission already charged allocated bytes. Correct owner ledger now charges allocated closure and 1.8MB helpers and preserves positive SQLite highwater.',initialAdmissionUnchanged=True,priorReceiptsPreserved=True,correctedReceipt='resource-corrected-postguest.json'))
files=['admission.json','measurement.json','trusted-config.json','manifest.json','intended-originals.json','precheckout-parser.json','startup-gate.json','final-gates-api.json','guest-supervisor-api.json','remote-admission.json','remote-rehash.json','transfer-receipts.json','api-history.jsonl','cleanup-api.json','analysis.json','box-handback.json','box-handoff-api.json','capture-final.json','historical-capture-accounting.json','resource-preguest.json','resource-postguest.json','resource-corrected-postguest.json','resource-accounting-correction.json','setup.py','stage.py','work.py','launch.py','collect.py','supervise.py','preflight.py','capture.cjs','validate-tree.cjs','guest-args.json','sqlite-baseline.json']
for n in files:shutil.copyfile(H/n,E/n)
for p in (H/'collected').rglob('*'):
 if p.is_file():
  out=E/'collected'/p.relative_to(H/'collected');out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,out)
seals=[]
report='''# Maelstrom accepted boundary: one original guest, 2026-10-24

The independently accepted exact transformer ran against the unchanged full historical runner and original 48-file Maelstrom closure. Actual breakpoint arming and post-run boundaries are now observed. Target reachability remains **unresolved**; no native errno, caller or causal conclusion is supported.

At batch **36163**, the existing real `set_bp(0x7a3366)` call read back `0x7a3366`. `test_arena_get(11)` returned **1**. BATCH_SIZE remained **1000**. The first actual main.run return at batch **36163** reported EIP **0x00679753**, raw halt **3**, breakpoint readback unchanged and select-return counter slot 1 **0**. The summary observed **5837** main.run returns. Its last boundary was batch **41999**, EIP **0x075040f8**, raw halt **4**, readback `0x7a3366`, guard **1**, counter **972**. There were **zero target records**. No halt-5 target was observed; the audit read **zero of the conditional 16 snapshot bytes**. Errno and caller are unknown; historical zero-record cause remains UNKNOWN. Three audit records fit the unchanged four-record/8192-byte bound. The normal runner's existing reads/traces are separate from conditional audit snapshot reads.

Exactly one guest ran on `bx_qsz5ra8d`, ordinary UID 1000, Node v24.22.1. Fresh guest MemAvailable was **7217848320** bytes. Fixed 512 MiB linear memory, Node heap 512 MiB, CPU 90s, wall 60s and actual 131072-byte output guard were retained. The guest completed all **42000** batches and **617354** API calls naturally: exit **0**, supervisor elapsed **9.273716312s**, output **6353 bytes**. The supervisor waited/reaped; remaining process group was false and post-run cleanup found no task Node processes. No denial, trap or output stop occurred. Raw argv, environment qualifications, PGID, terminal and cleanup are retained in the adjacent evidence directory.

Runtime recipe: `python3 /tmp/maelstrom-accepted-boundary-guest-oct24/supervise.py guest` from launch.py. `collected/guest/command.json` contains the complete actual Node argv. The accepted transformer was applied using `node --max-old-space-size=256 boundary-audit.cjs --enable runner/test/run.js 13-exports.wat runner/test/run-boundary.js`; the output is adjacent to the unchanged original runner. Transformed SHA-256 **6d542cd2c11b24b76bcb1f845a695dce726f7038602f9e8c0b4f172ed5df1ad4** (690739 bytes). Transformer **06a54af6c2150589b1848c1a5223682b793ead57c34258142bf83acaa6961c80**; historical runner **4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809** at d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e; exports **739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86**. Historical module **8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686**, source b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a, ABI 291/layout 9a3bc9149d58209c. No build or fallback compilation.

All 247 staged closure entries were rehashed (17027463 logical bytes); the 48 original files total 2794170 bytes. Exact EXE/SDL/SDL_net identities and every intended filename, including commas, are retained in manifest.json. The canonical parser enumerated a supported vfs-tree mount, with no individual comma-bearing mounts. The actual retained startup-divergence effective_sizes function confirmed startup BATCH_SIZE 1000. Single trace PC `0x7a3366`, start 36163, limit 1, memory `eax:4,esp+0x124:12`, original P input, 200ms clock, 42000 batches and six counters remain unchanged. No watch option was enabled or deferred. No traced run-return assignment or scheduling/render/input repair was introduced. Exact accepted offline suites are reused from 7d8c315c; no repeated acceptance suite is claimed. Real providers, all 28 font files and pinned pngjs 7.0.0 passed the same-task preflight. The original input schedule produced its three bounded PNGs; these are retained without new visual/gameplay acceptance claims.

Initial combined admission projected **52734926/67108864** bytes, including local/remote staging, checkout/Git, transfers, complete external launcher/session/history, positive SQLite/future growth and 8 MiB reserve. Standing tools and old donors are separately identified. Corrected postguest peak was **49934848** bytes; projected local free **3015949824** exceeded the **2982150144** floor. The reused interim logical-closure accounting is preserved and explicitly corrected to allocated bytes in the owner ledger; initial admission already charged allocated closure. Prior capture charges/qualification deficiencies are retained, and this task uses a separate additional 2 MiB capture budget. Per-file 24 MiB maximum is maintained. See final resource/capture receipts for publication growth.

Box handback: API state **idle**, health **ok**, still running and not stopped by this worker; expiry **2026-10-24T12:38:44.745Z**. Coordinator owns shutdown at 12:33 UTC. Owned guest group is gone. No second guest, networking workaround, production/gameplay fix, acquisition, deployment, main merge or worker launch. The boundary instrumentation's real arming/first/last observations are established; the named genuine target snapshot remains absent.
'''
(R/'docs/re-notes'/f'{name}.md').write_text(report)
git('config','user.name','Wine Ops Codex');git('config','user.email','codex@local')
git('diff','--check');account('prepublication')
shutil.copyfile(H/'resource-prepublication.json',E/'resource-prepublication.json')
seals=[dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file() and p.name!='evidence-seals.json']
(E/'evidence-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
git('add','--sparse','-f',f'docs/re-notes/{name}.md',f'docs/re-notes/{name}')
# Keep the executed historical supervisor byte exact, including its one existing
# trailing space. Check all other paths normally, then check the retained raw
# supervisor with only the blank-at-EOL warning disabled for that command.
git('diff','--cached','--check','--','.',':!docs/re-notes/'+name+'/supervise.py')
git('-c','core.whitespace=-blank-at-eol','diff','--cached','--check','--','docs/re-notes/'+name+'/supervise.py')
staged=git('diff','--cached','--stat');save('staged-review.json',dict(stat=staged,onlyEvidence=True))
git('commit','-m','Record one Maelstrom guest with accepted breakpoint boundary audit')
commit=git('rev-parse','HEAD');branch='task/maelstrom-accepted-boundary-guest-oct24'
# Inspect actual committed blobs, including all ignored original-input PNGs.
for row in seals:
 b=subprocess.check_output(['git','-C',str(R),'show',commit+':docs/re-notes/'+name+'/'+row['path']]);assert len(b)==row['bytes'] and sha(b)==row['sha256']
git('push','origin','HEAD:refs/heads/'+branch)
remoteSHA=git('ls-remote','origin','refs/heads/'+branch).split()[0];assert remoteSHA==commit
save('publication.json',dict(commit=commit,branch=branch,remoteSHA=remoteSHA,ssh=ssh,trueGitBlobsVerified=len(seals),noMainMerge=True))
print(json.dumps(dict(commit=commit,branch=branch,remoteSHA=remoteSHA,blobs=len(seals))))

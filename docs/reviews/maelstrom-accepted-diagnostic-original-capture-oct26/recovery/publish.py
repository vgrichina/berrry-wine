import pathlib,json,os,subprocess,shutil,time
from common import *
R=H/'repo';E=R/'docs/reviews'/H.name;E.mkdir(parents=True,exist_ok=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';env=dict(os.environ,GIT_SSH_COMMAND=SSH);BR='task/'+H.name
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],env=env,stderr=subprocess.STDOUT).decode().strip()
rr=json.loads(json.load(open(O/'cleanup-api.json'))['stdout']);account('prepublication',rr['allocated'])
assert json.load(open(O/'root-ref-final.json'))['sha256']==json.load(open('/home/user/wine-assembly/scratch/usage-watch/'+H.name+'/root-ref-digest.json'))['sha256']
files=['pins.json','configuration.json','checkout.json','schedule.json','mount-precheckout.json','adapter-controls.json','remote-full-readback.json','inherited-limit-check-api.json','negative-control-api.json','output-control-api.json','mount-actual-api.json','fresh-preguest-api.json','resource-initial.json','resource-preguest.json','resource-postguest.json','resource-prepublication.json','api-transfer-probe.json','one-guest-launch.json','guest-supervisor-api.json','collected-manifest.json','checkpoint-guest.json','analysis.json','checkpoint-reviewed.json','cleanup-api.json','incidents.json','root-ref-final.json','api-history.jsonl','transfer-receipts.json','local-lock.json','local-lock-release.json']
for n in files:shutil.copyfile(O/n,E/n)
shutil.copytree(O/'collected',E/'collected',dirs_exist_ok=True)
P=E/'recovery';P.mkdir(exist_ok=True)
for p in list(O.glob('*.py'))+list(O.glob('*.cjs'))+[H/'manifest.json',H/'guest-args.json',H/'supervise.py',H/'validate-tree.cjs']:
 if p.name=='supervise.py':
  source=p.read_text();(P/'executed-supervisor.json').write_text(json.dumps(dict(sha256=sha(p.read_bytes()),source=source,recipeNormalization='Only trailing whitespace removed in adjacent supervise.py; exact executed text preserved here.'),indent=2)+'\n')
  (P/p.name).write_text('\n'.join(line.rstrip() for line in source.splitlines())+'\n')
 else:shutil.copyfile(p,P/p.name)
(E/'README.md').write_text('''# Authentic original Maelstrom diagnostic capture — 2026-10-26

**FIRST REJECTION CAPTURED: reason 3 (`uop`), mode bits 4, batch 36170.**
One authentic original guest used unchanged candidate
`44e344fdb26daab9a07210656597902ba27cb5f7` (source tree
`ec7ee531e723627fd8387c0786abf35521d9fc77`) and the retained canonical tail
module SHA-256 `aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1`.
No build, synthetic native execution, source repair or second guest occurred.

The native latch rejected at status 5/event 0. Its immutable diagnostic scalars
and adapter record agree: reason 3, modeBits 4 (`uop_enabled`), expected and
observed return `0x7a3362`, phase 3, completions 1, fault/active/capped all 0.
The select record has token 7, entries 7, parks 6, result 0, thread 1.
This is an authentic completion observation, separate from prior controlled
fixtures. The source's ordered checks test code16, block-exec, then uop before
checking return/phase/completion predicates. No mode flags were changed.

**Errno before CMP and caller remain UNKNOWN.** Their native fields were never
acquired: zero-filled rejected capture fields must not be reported as observed
errno 0 or caller 0. The result establishes this first unsupported-mode guard,
not a production defect, original `_getptd` result, gameplay or visible play.
The independently accepted 40 synthetic native records and 25 adversarial
evidence controls at `797e8a6d9b400608d634ed41ae0602574e7bc035` are reused,
not rerun. Its supplemental callback fixture remains UNQUALIFIED.

Authentic loader validation PASSED before capture start. CRT loaded at
`0x522000`, SDL_net at `0x7a2000`; `_errno` bytes at `0x52e430` are
`e82274ffff83c008c3`, relocated SDL_net bytes at `0x7a32f2` are
`8b3d10407a00`, and IAT `0x7a4010` contains `0x52e430`.
All required loaded anchors, raw exported fields, module bases and live host
registers are retained before validation and at first latch rejection.
This run does not establish a CRT loader mapping failure.

The original input schedule, batch size 1000, max 42000 batches, 200ms ticks,
60 seconds, 512MiB heap and arena were preserved. The canonical parser and
actual staged argv enumerated and hashed all 48 original tree-mounted files,
including comma-bearing names. All 250 staged manifest files passed API hash
readback. Host-only adapter controls verified errno/caller persistence through
a simulated first failure, with no Wasm or fabricated guest CRT memory.

`collected/guest/native.jsonl` is the adapter record;
`collected/guest/native.jsonl.raw.jsonl` contains raw scalars and anchors;
`collected/guest/output.log`, `command.json` and `terminal.json` bind execution.
Offline `recovery/review.py` checks raw/decoded/anchor/process/hash agreement.
Supervisor inherited-limit, TERM/KILL/reap and output-cap controls passed.
The one guest exited 1 naturally after 5.17 seconds, all owned processes reaped,
remaining group false. Evidence is not a gameplay acceptance claim.

Recovery recipes and immutable file identities are retained under `recovery/`.
They refer to standing read-only donors for original inputs and dependencies;
the binary is deliberately not committed. Restore it only from the pinned
retained canonical artifact and verify its SHA-256. Historical schedules and
box IDs are not launch authorization. A new runtime attempt requires a new
coordinator assignment; these recipes must not automatically retry this result.

Resource receipts include both hosts, checkout/Git, evidence/publication,
session/launcher, positive SQLite/WAL growth, conservative API request/response
event charges, future growth and 8MiB reserve inside 64MiB. Mandatory memory,
disk, file/output/capture and lifecycle gates passed. Bootstrap excerpt excess
and routine missing-path corrections are disclosed in `incidents.json`.

No main integration; root tracked/index/refs and all donors remained read-only.
Root streaming ref digests match. Task branch publication is separately verified
by the final external `ops/result.json`. Box `bx_7qwjxps7` remains RUNNING;
coordinator owns shutdown 05:50 UTC, expiry 2026-10-26T06:06:24.385Z.
''')
manifest=[]
for p in sorted(E.rglob('*')):
 if p.is_file() and p.name!='evidence-manifest.json':manifest.append(dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(E/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');save('evidence-manifest.json',manifest)
git('add','--sparse',str(E.relative_to(R)));changes=git('diff','--cached','--name-only').splitlines();assert all(x.startswith('docs/reviews/'+H.name+'/') for x in changes)
git('diff','--cached','--check');account('precommit',rr['allocated'])
git('commit','-m','Record authentic Maelstrom uop diagnostic rejection and raw anchors')
commit=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}');assert git('status','--porcelain')==''
save('checkpoint-committed.json',dict(commit=commit,branch=BR,tree=tree,files=len(changes),reviewed=True))
remoteMain=git('ls-remote','origin','refs/heads/main').split()[0]
git('push','origin','HEAD:refs/heads/'+BR)
actual=git('ls-remote','origin','refs/heads/'+BR).split()[0];assert actual==commit
for x in manifest:
 b=subprocess.check_output(['git','-C',str(R),'show',commit+':'+str(E.relative_to(R))+'/'+x['path']]);assert sha(b)==x['sha256'] and len(b)==x['bytes']
j=dict(commit=commit,branch=BR,remoteBranch='refs/heads/'+BR,actualRemoteSHA=actual,verified=True,tree=tree,testedSourceTree='ec7ee531e723627fd8387c0786abf35521d9fc77',remoteMain=remoteMain,strictSSH=SSH,changedPaths=changes,manifestPayloads=len(manifest),clean=True,noMainIntegration=True)
save('publication.json',j);print(json.dumps(dict(commit=commit,remote=actual,manifestPayloads=len(manifest),verified=True)))

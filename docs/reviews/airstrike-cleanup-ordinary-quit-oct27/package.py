import pathlib,json,shutil,hashlib
from run import H,R,ROOT,dump
D=pathlib.Path('/tmp/airstrike-complete-controller-main-integration-oct27/repo')
g=R/'.git'
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
branch='task/airstrike-cleanup-ordinary-quit-oct27'
(g/'HEAD').write_text('ref: refs/heads/'+branch+'\n')
p=g/'refs/heads'/branch;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('ebecde207d027cb5067b132f79160a69d031e039\n')
dest=R/'docs/reviews/airstrike-cleanup-ordinary-quit-oct27';dest.mkdir(parents=True,exist_ok=True)
(g/'info/sparse-checkout').write_text('/docs/reviews/airstrike-cleanup-ordinary-quit-oct27/\n')
q=json.loads((H/'boundary-result.json').read_text())
(dest/'README.md').write_text('''# Ordinary Quit remains unqualified

The pinned accepted Controller + Observation Bridge cannot traverse gameplay,
Esc and all seven menu rows within the assigned maximum eight PNG captures.
Each observation calls `capture`, and each ensuing keydown calls `capture`
again to verify current pixels and focus. Eight required states therefore need
16 captures. Starting already at menu row0 would still need14, and would omit
the assigned gameplay/Esc evidence.

One new bounded resource-contract fixture used the unchanged pinned bridge and
accepted deterministic fake runner. It admitted eight PNG requests, refused
the ninth before dispatch, and stopped before Enter. Distinct fixture stdout
and stderr, correlated serial commands, original result, pins and cleanup are
retained here. These are FAKE fixture image bytes, never actual game evidence.
No accepted offline suite was rerun. No guest invocation, transfer, Node,
browser, compile, source change, main integration or deployment was performed.

The actual ordinary Quit acceptance remains OPEN: factual focus/menu row0..6
frames, Enter only after Quit row6, guest `[Exit] code=0`, clean runner exit and
absence of host kill/timeout/WM_CLOSE. The coordinator must reconcile the
capture allowance with the unchanged accepted bridge before another assignment.
This task does not change any limit or bridge behavior.

Box bx_fk6x4peu was untouched by this worker and left RUNNING as assigned;
fresh state was not queried after the preflight blocker. Coordinator lifecycle
ownership remains: cutoff09:15, handback09:20, snapshot-stop09:25 UTC,
expiry2026-10-27T09:42:43Z. The original runtime/module, font/codec/ABI and115s
sustained-play/37ACK-group receipts remain historical reused inputs; this is
not current-main emulator or gameplay qualification.
''')
for name in ('boundary.py','boundary-result.json','boundary.json','boundary.stdout','boundary.stderr','run.py','accounting.json'):
 shutil.copyfile(H/name,dest/name)
fixture=pathlib.Path(q['evidence']).parent
shutil.copytree(fixture,dest/'fixture',dirs_exist_ok=True)
for name,src in [('runtime.json',ROOT/'scratch/usage-watch/airstrike-cleanup-ordinary-quit-oct27.task.runtime.json'),('root-ref-initial.json',ROOT/'scratch/usage-watch/airstrike-cleanup-ordinary-quit-oct27/root-ref-digest.json')]:
 shutil.copyfile(src,dest/name)
pins=[]
for p in sorted(dest.rglob('*')):
 if p.is_file():pins.append(dict(path=str(p.relative_to(dest)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(dest/'manifest.json').write_text(json.dumps(pins,indent=2)+'\n')
dump('checkpoint.json',dict(status=q['status'],pins=q['sourcePins'],fixtureResult=q['result'],remaining=q['remaining'],guestStarts=0,box='bx_fk6x4peu',boxTouched=False,lifecycleOwner='coordinator',evidence=str(dest)))
print('Packaged',len(pins),'exact evidence files; no guest execution')

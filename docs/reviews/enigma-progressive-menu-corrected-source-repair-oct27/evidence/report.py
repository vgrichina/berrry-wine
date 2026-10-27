import os,sys,pathlib,json,hashlib,shutil,re,time,resource
B=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27');O=B/'ops';R=B/'repo';H=R/'docs/reviews/enigma-progressive-menu-corrected-source-repair-oct27'
H.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def size(p):
 total=0
 if not p.exists():return 0
 for x in [p,*p.rglob('*')] if p.is_dir() else [p]:
  try:
   if not x.is_symlink():total+=x.stat().st_blocks*512
  except FileNotFoundError:pass
 return total
pins={str(p.relative_to(R)):sha(p) for p in list((R/'tools').glob('*.py'))+list((R/'test/fixtures/enigma-controller').glob('*'))+[R/'test/run.js'] if p.is_file()}
assert pins['test/run.js']=='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e'
donor=pathlib.Path('/tmp/enigma-streams-independent-accept-integrate-oct27/repo')
for p,s in {'tools/enigma-frozen-gameplay-controller.py':'77997362d75f9873cd8b022b4840606ed1b66780171e7c82d8f8a6f20b304f26','tools/enigma-supervised-gameplay.py':'ed3cfbb659a3ed6bdc6e218293579613a1709da1ab283f87a0b59de706048aa9'}.items():assert sha(donor/p)==s
passed=set()
for op in ('verify-progress','regressions','remaining','final-affected'):
 for line in (O/(op+'.stderr')).read_text().splitlines():
  m=re.match(r'^(test_\S+) \(([^)]+)\) \.\.\. ok$',line)
  if m:passed.add(m[2] if m[2].endswith('.'+m[1]) else m[2]+'.'+m[1])
sys.path.insert(0,str(R/'test/fixtures/enigma-controller'))
import unittest
names=['test_controller.ControllerTests','test_ownership.OwnershipTests','test_listener.ListenerTests','test_supervised.SupervisedTests','test_progressive.ProgressEntryTests','test_progressive.ProgressReserveTests']
def flat(s):
 for x in s:
  if isinstance(x,unittest.TestSuite):yield from flat(x)
  else:yield x.id()
expected=set(flat(unittest.defaultTestLoader.loadTestsFromNames(names)))
assert expected<=passed,sorted(expected-passed)
for n in ('remaining','final-affected'):
 assert json.loads((O/(n+'-checkpoint.json')).read_text())['passed']
 for suffix in ('-supervision.json',):
  v=json.loads((O/(n+suffix)).read_text());assert v['cleanupComplete'] and not v['stopReason']
incidents=[dict(operation='initial read-only discovery',detail='Overbroad rg filename glob returned excessive/truncated output; no mutation. Bounded explicit paths thereafter; launcher events retain original tool diagnostics.'),dict(operation='checkout',detail='Git checkout completed, accounting traversal raced a disappearing ref lock. Supervisor stopped/reaped its owned processes. Fixed missing-file race, read-only isolated status clean; no repeated checkout.'),dict(operation='boundary-red',detail='Unchanged production Python entry reproducer failed before repair: reviewed loading frame followed by quit, zero click; exact JS source full-file pin retained.'),dict(operation='verify-progress',detail='Two new test oracles initially wrong: identical old decision is intentionally ignored; two wall seconds still cover 1.1-second cleanup. Corrected to distinct stale approval and .2-second exhausted reserve; affected methods passed.'),dict(operation='regressions',detail='Guard stopped aggregate RSS139202560 >134217728 in competing-supervisor test. Completed ok methods reused. Non-Git capture shim now execs test, eliminating redundant Python waiter with unchanged limits. Remaining7 passed peak133058560; final affected5 peak103776256.')]
write(O/'incidents.json',incidents)
write(O/'acceptance-checkpoint.json',dict(status='PASS_SOURCE_ONLY',sourceBaseline='b160b5403e69f28e92e218849cc8165c67776bd2',tree='a5e301efefcdc881816f5686e9e12cc57252b764',pins=pins,passedMethods=sorted(expected),methodCount=len(expected),productionBoundary='actual production Python supervisor CLI / exclusive owned offline listener / all-requested-batches ACK then matching frozen-zero / loading->menu controlled state; JS runner source pinned unchanged, not executed',historicalReport='96cac00c07a4c54cd0c39c0f84455148ebedc151 preserved',guestInvocations=0,nodeExecutions=0,boxes=[],remaining=['independent acceptance','separately admitted actual Enigma menu/runtime qualification','coordinator-owned scoped integration']))
# Preserve all completed operation payloads and failure logs. Active report
# streams/receipts are retained in ops and cannot be archived while still open.
for p in sorted(O.rglob('*')):
 if not p.is_file() or p.name.startswith('report2') or p.name in ('report.stdout','report.stderr','report.json'):continue
 target=H/'evidence'/p.relative_to(O)
 if target.suffix in ('.stdout','.stderr'):target=target.with_name(target.name+'.bin')
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
for name,path in {'task-admission.json':'/home/user/wine-assembly/scratch/usage-watch/enigma-progressive-menu-corrected-source-repair-oct27-admission.json','initial-root-ref.json':'/home/user/wine-assembly/scratch/usage-watch/enigma-progressive-menu-corrected-source-repair-oct27/root-ref-digest.json','fleet-admission.json':'/home/user/wine-assembly/scratch/usage-watch/source-repair-fleet-admission-oct27.json','historical-runtime-result.json':'/tmp/enigma-full-frame-terminal-startgame-oct27/ops/result.json','historical-launch-config.json':'/tmp/enigma-full-frame-terminal-startgame-oct27/ops/launch-config.json','historical-source-reuse.json':'/tmp/enigma-full-frame-terminal-startgame-oct27/ops/source-reuse.json'}.items():shutil.copyfile(path,H/name)
(H/'README.md').write_text('''# Enigma bounded loading-to-menu repair

The controller now makes serial, bounded progress after an explicitly reviewed loading checkpoint, and requires a separate hash/batch-bound actual-menu approval before Start Game input. Every step retains all-requested-batches ACK and a following frozen-zero snapshot. Unique full-size captures, cumulative review/CPU/wall/batch/API/capture budgets, and action/cleanup reserves prevent a checkpoint from renewing the allowance. The original supervisor alone supplies measured cumulative CPU and retains listener/process authority and cleanup.

Source-only change from the explicitly corrected donor b160b540; this is not a current-main identity claim. The unchanged production Python CLI reproducer failed before repair, then passed controlled loading-to-menu transition. Full JS runner SHA is pinned without executing Node or guest code. Complete affected method coverage and exact source/fixture hashes are in evidence/acceptance-checkpoint.json; causal failures and successful partial-suite receipts are retained. Evidence stdout/stderr files have .bin suffixes to preserve raw Git hints/trailing whitespace byte-for-byte.

No actual Enigma menu/gameplay/ordinary Quit is qualified. The coordinator owns independent acceptance, any source-scoped integration, and separately admitted runtime qualification. No box, public deployment, main ownership, worker launch or root/donor mutation occurred. Prior report96cac00c remains preserved. Read test/fixtures/enigma-controller/README.md for the review protocol and budget knobs. Do not blindly merge this sparse task tree into main; review the scoped source/test diff against the corrected donor.
''')
manifest={str(p.relative_to(H)):dict(bytes=p.stat().st_size,sha256=sha(p)) for p in H.rglob('*') if p.is_file()}
write(H/'manifest.json',manifest)
assert all(sha(H/p)==v['sha256'] for p,v in manifest.items())
session=pathlib.Path('/home/user/.codex/sessions/2026/10/27/rollout-2026-10-27T09-40-49-01a17cbb-de4d-7ef3-8580-53a2ff244dd5.jsonl')
events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-progressive-menu-corrected-source-repair-oct27')
wals={str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
a=dict(at=time.time(),sourceGit=size(R),ops=size(O),events=size(events),session=size(session),sharedWALCurrentUpperBound=sum(wals.values()),walFiles=wals,walBaseline='unknown; charge entire current shared WAL once conservatively, no exact growth attribution',reserve=40*1024**2,futureGrowth=8*1024**2,free=shutil.disk_usage(B).free,memAvailable=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024)
a['chargedOps']=a['ops']+a['sharedWALCurrentUpperBound'];a['chargedEvents']=a['events']+a['session'];a['totalProjected']=a['sourceGit']+a['chargedOps']+a['chargedEvents']+a['reserve']+a['futureGrowth'];a['projectedFree']=a['free']-a['reserve']-a['futureGrowth'];a['futureClientReservation']=0;a['actualPeerRSSAlreadyIncludedInMemAvailable']=True
a['pass']=a['sourceGit']<=20*1024**2 and a['chargedOps']<=52*1024**2 and a['chargedEvents']<=16*1024**2 and a['totalProjected']<=128*1024**2 and a['projectedFree']>=2982150144 and a['memAvailable']>=805306368+268435456
write(O/'admission-publication.json',a);assert a['pass'],a
v=dict(status='PASS_SOURCE_ONLY_PROGRESSIVE_MENU_REPAIR',methodCount=len(expected),manifestPayloads=len(manifest),manifestSHA256=sha(H/'manifest.json'),sourceBaseline='b160b5403e69f28e92e218849cc8165c67776bd2',sourceTree='a5e301efefcdc881816f5686e9e12cc57252b764',historicalReport='96cac00c07a4c54cd0c39c0f84455148ebedc151',guestInvocations=0,nodeExecutions=0,boxesAssigned=[],boxesTouched=[],main=False,deploy=False,workersLaunched=0,publication='pending task branch only',rootRefReceiptReused=True,rootFinalRefComparison='not required; no root mutation',ownedBoardWatcher=dict(pid=4038885,parent=4038018,startTicks=pathlib.Path('/proc/4038885/stat').read_text().split(') ')[1].split()[19]),admission=a,remaining=['independent review','scoped integration by coordinator','separately admitted actual menu/runtime acceptance'])
write(O/'result.json',v)
print(json.dumps(dict(status=v['status'],methods=len(expected),manifestPayloads=len(manifest),totalProjected=a['totalProjected'],admitted=a['pass'])))

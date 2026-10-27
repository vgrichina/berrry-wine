from common import *
import ast
D=R/'docs/reviews/generally-census-cleared-driving-oct27';E=D/'evidence';E.mkdir(parents=True,exist_ok=True)
def j(n):return json.loads((H/n).read_text())
module=j('retained-module.json');assert module['sha256']==sha((H/'wine-assembly.wasm').read_bytes())
build=[j('retained-'+n+'-supervision.json') for n in ['compile','compile-continuation','compile-continuation-two']]
assert [x['exit'] for x in build]==[1,1,0] and all(x['stopReason'] is None and x['cleanupComplete'] for x in build)
assert sum(x['cpuSeconds'] for x in build)<=180 and sum(x['wallSeconds'] for x in build)<=240
assert sum((H/('retained-'+n+'.stdout')).read_text().count('Compiling (WATX)...') for n in ['compile','compile-continuation','compile-continuation-two'])==1
guest=j('retained-guest-supervision.json');assert guest['exit']==1 and guest['cleanupComplete']
assert j('retained-startup-preguest-v5-supervision.json')['exit']==0
assert 'uncertain ACK timeout 0012.json' in (H/'retained-guest.stderr').read_text()
assert not j('collect-replies-0012.json.json')['exists']
assert not any(q.get('request',{}).get('cmd','').startswith(('keydown:38','keyup:38')) for p in H.glob('control-[0-9]*.json') for q in [json.loads(p.read_text())] if isinstance(q,dict))
for p in H.glob('*.py'):ast.parse(p.read_text(),filename=str(p))
ledger=[]
for p in sorted(H.glob('*.command.json')):
 q=json.loads(p.read_text());q['receipt']=p.name
 label=p.name[:-len('.command.json')]
 q['streams']={}
 for stream in ['stdout','stderr']:
  f=H/(label+'.api.'+stream)
  if f.exists():q['streams'][stream]=dict(bytes=f.stat().st_size,sha256=sha(f.read_bytes()),retainedOriginal=str(f))
 ledger.append(q)
(E/'api-command-ledger.json').write_text(json.dumps(ledger,indent=2))
selected=set(['stage-manifest.json','projection.json','initial-configuration.json','local-verified-closure.json','conditional-gameplay-readiness.json','startup-helper-repair.json','signature-helper-repair.json','stage-wrapper-incident.json','proxy-storage-repair.json','build-continuation-plan.json','second-continuation-plan.json','recovered-bundles.json','visual-reviews.json','intro.png','intro.json','control-cursor.json','owned-process-cleanup.json','boat-state.stdout','wine-assembly.wasm-retained.json','wine-assembly.compat.wasm-retained.json','startup-preguest-v5.stdout','launch.stdout'])
selected.update(p.name for p in H.glob('retained-*'))
selected.update(p.name for p in H.glob('control-[0-9]*.json'))
selected.update(p.name for p in H.glob('*.json') if '.command.' not in p.name and p.stat().st_size<12000)
# Preserve every failed setup stream, plus command streams with causal runtime diagnostics.
for p in H.glob('*.json'):
 try:q=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 if isinstance(q,dict) and q.get('exit') not in (None,0):
  label=p.name[:-5]
  selected.update(f.name for f in H.glob(label+'.*') if f.suffix in ('.stdout','.stderr','.supervisor-output'))
for label in ['prebuild','preguest','compile-launch','control-12']:
 for f in H.glob(label+'.api.*'):selected.add(f.name)
for name in sorted(selected):
 p=H/name
 if p.is_file() and p.stat().st_size<=2*M:shutil.copyfile(p,E/name)
recipes=D/'recipe';recipes.mkdir(exist_ok=True)
for p in [*H.glob('*.py'),*H.glob('*.cjs')]:shutil.copyfile(p,recipes/p.name)
summary=dict(sourceRevision=PIN,module=module,canonicalBuild=dict(invocations=1,compilerInvocations=1,setupContinuations=2,CPU=sum(x['cpuSeconds'] for x in build),wall=sum(x['wallSeconds'] for x in build),finalPass=True,missingInputs=['index.html','docs/dos-corpus/live/toyvm-bundle.js','docs/dos-corpus/live/toyvm-jit-bundle.js'],passedPrefixNotRepeated=True),startup='PASS exact remote Node v24.22.1 flags/environment/limits, production mount parser, actual named+ordinal API resolution, compiled module/import-signature presence',guest=dict(attempts=1,firstBlocker='100000-batch loading step0012 did not ACK within client38s / bridge40s; no overlap/replay',reviewedFrame='intro.png',reviewedScene='Main Menu',menuClicksDispatched=['Player540,125','Agari145,360','Start700,580'],pendingStep=100000,drivingUpDispatched=False,drivingReleased='not applicable: no driving key dispatched',timeTrialEnter=False,countdown=False,beforeAfterTrackFrames=False,gameplayQualified=False,ordinaryQuit=False,terminal=guest),cleanup='owned-process-cleanup.json',lifecycle=dict(box=BOX,expiry='2026-10-27T13:20:39.001Z',leaveRunning=True,owner='coordinator',cutoff='13:08UTC',handback='13:11UTC',shutdown='13:14UTC'),historicalProof='docs/re-notes/generally.md links prior reviewed race proof; preserved, not replayed or represented as new evidence',remainingGates=['Bound loading requests to measured completion latency or accept a controller that reports progress without closing the guest pipe','Fresh coordinator-assigned attempt: inspect ordinary intro, Enter, countdown, before/after Up dispatch+release','Ordinary game Quit; no FPS qualification'],incidents=['Initial oversized displays retained in launcher/session','Mount parser validation occurred after sparse checkout, before build/guest','Stage exec shared namespace caused incidental owned local upload fragment; fixed namespace','Long donor-view symlinks consumed60MiB; short links preserve all targets; first compaction supervisor raced unlink, atomic replacement fixed without physical-cap violation','Whole root apps.js differed after concurrent integration; GeneRally route declaration and root string match exact selected pin','Startup helper incorrectly rejected ordinals, then addressed signature document outside .sigs; both repaired without modifying production source','Detached CLI initially rejected timeout+detach locally before remote execution','Coordinator source closure omitted3 canonical build paths; restored same-pin blobs; continued exact remaining canonical commands under cumulative unchanged budget','Module compressed transfer692111B exceeded preliminary1MiB envelope estimate; complete actual transfer separately admitted after guest stopped, total raw wire remained within8MiB; no accepted track capture claimed'])
(D/'receipt.json').write_text(json.dumps(summary,indent=2))
(D/'README.md').write_text('''# GeneRally: canonical build passes; loading ACK blocks driving qualification

The exact published source `1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba` built successfully on the assigned Boat. The production runner rendered a newly inspected main menu and dispatched ordinary Player, Agari and Start clicks. The following 100000-batch loading step did not acknowledge completion within the controller deadlines. No further commands or retries were issued. The bridge closed its pipe; Node reported EPIPE, and supervised cleanup completed.

**Gameplay is unqualified.** No time-trial Enter, countdown, Up press/release, before/after track pair, ordinary Quit or FPS acceptance is claimed. Timer00.00 was never used to gate input. The prior reviewed race evidence remains historical.

The supplied closure omitted index.html and two committed ToyVM bundles. They were recovered from the same immutable revision. Only the remaining byte-exact canonical build suffixes ran; completed gates were reused. There was one WAT compilation and cumulative build CPU/wall/output controls were preserved. All setup failures and helper corrections are retained.

`receipt.json` binds the result; `evidence/api-command-ledger.json` records actual command hashes and distinct original stdout/stderr pins. `recipe/` preserves the bounded recovery and execution recipe. Both compiled modules are retained separately in the worker ops directory, outside Git. The assigned Boat stays available for coordinator-owned lifecycle handling. This report delta must not be whole-merged into main.
''')
payloads=[]
for p in sorted(D.rglob('*')):
 if p.is_file() and p.name!='payloads.json':payloads.append(dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(D/'payloads.json').write_text(json.dumps(payloads,indent=2))
print('report PASS',len(payloads),'payloads',sum(x['bytes'] for x in payloads),'bytes; build cumulative',summary['canonicalBuild']['CPU'],'CPU seconds; gameplay BLOCKED')

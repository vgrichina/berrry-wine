from run import *
import tarfile
D=R/'docs/reviews/gta2-ordinary-driving-gameplay-oct27';D.mkdir(exist_ok=True)
result=json.loads((H/'task-result.json').read_text());assert result['guestInvocations']==0 and len(result['firstBlocker']['changed'])==2
(D/'README.md').write_text('''GTA2 demo gameplay qualification — BLOCKED before guest execution

The exact pinned production build (4a2bec145ef34b0d084b96b09a682a16e89703fd) fails `node tools/callback-ownership-census.js` inside the one canonical `bash tools/build.sh` invocation. The census rejects changed whole-file host-entry producer SHA256 fingerprints for `host.js` and `lib/renderer-input.js`. `result.json` records expected/actual hashes. The census was left unchanged; memory-map and later gates were not reached. No WATX module was produced, no guest ran, no input was dispatched, and no PNG was captured or inspected. Gameplay/movement/driving, ordinary Quit, FPS/audio/device qualification remain open.

Completed: all71 original game files SHA256 verified (26207806 bytes); root-authoritative registered gta2_demo route blocks identical to the selected source; all3878 staged source/runtime/game files remotely hash verified (98062584 bytes); exact build Node startup successful with unlimited DATA/AS and process-specific physical6GiB CPU180 wall240/heap4096MiB; four full PNG capture/envelope reservation8179810 of8388608 raw API bytes including1MiB terminal reserve; one actual canonical build, exit1, physical peak493821952 bytes, conservative CPU13.483629s, wall3.070756s, complete owned cleanup. Production source unchanged against its pinned Git revision. Guest startup and actual canonical filename parser were not reached because the build prerequisite failed.

The failed build is a concrete prerequisite blocker. This worker performs no callback-lifetime source repair, census refresh, build retry, replacement task or runtime bypass. A coordinator-assigned review/repair of the exact producer changes and a separately admitted runtime task are required before gameplay qualification.

Causal diagnostics and exact recipes are in `diagnostics.tgz`, `remote/`, `recipe/`, `source-compiler-pin.json`, `stage-manifest.json`, and `capture-reservation.json`. The diagnostics archive retains original local stdout/stderr separately, supervisor exit/resource/cleanup receipts, raw API responses/stderr, command SHA256 history, and failed setup evidence. Large transfer command payloads are retained in the original ops directory; immutable manifest inputs, versioned transfer recipes and command hashes permit recovery without publishing game media. The canonical final binding is `/tmp/gta2-ordinary-driving-gameplay-oct27/ops/receipt-manifest.json`; it binds final commit/ref verification, payload pins, cleanup, resources and remaining gates after publication.

Retained incidents: initial oversized displays; recursive donor-alternate warnings/listing guard failure; stage-manifest/operation-label collision recovered byte-identically before transfer; temporary aggregate RAM rejection during host snapshot capture followed by measured capacity recovery; completed staging chunk's conservative CPU rejection followed by shorter remainder operations without replay; queued pre-check commit cancelled before Git ran, then failed report-whitespace check corrected and passed before the actual WIP commit; failed optional path lookups/edit attempts. A broad process-argument diagnostic exposed platform signed URLs only in the tool transcript; no values were copied into task evidence/source. Subsequent process measurements use names only. Earlier memory-map wording was corrected: the actual failing gate is the preceding callback census. No retrospective compliance claim.

Resource allocation: local128MiB including8MiB reserve; actual consolidated checkout/Git/ops/events/positive-WAL growth counted once. Component estimates were corrected within that same allocation. Local Python physical128MiB CPU90 wall120 file24MiB output2MiB under one execution-pool permit and trusted supervisor9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85; Git child physical256MiB/DATA512MiB under two permits+production flock and exact strict launcher SSH. DATA was never imposed on Node, Python or Codex. Live client reservations320MiB, pooledchildren256MiB and805306368-byte headroom were preserved. Source donor flat alternate views are read-only and neither copy/repack donor objects nor mutate donor/root tracked/index/refs. Initial root-ref receipt reused; no full ref listing or later root comparison. No main ownership/deployment/workers/downloads. The WIP90f465d04595cfc47840cf8555242635f76e4676 was pushed and its exact task ref verified before30minutes.

Remote1GiB allocation includes64MiB reserve; actual allocated107986944 bytes at handback observation. Guest allocation was physical4GiB/Node old-space2048MiB/CPU180/wall240/output2MiB with at most one invocation, never consumed. Heap old-space is not a total-process physical memory cap. Local board watcher4114750 was checked by exact argv/parent/start identity and stopped by pidfdSIGTERM; no coordinator watcher was touched. No guest Quit or caller-SIGTERM-as-Quit claim.

Boat bx_9th86yg2: RUNNING_API_EXEC_OBSERVED and left running, no owned build processes remain. Complete pinned inputs and build diagnostics remain at `/tmp/gta2-ordinary-driving-gameplay-oct27` on that Boat. Coordinator owns lifecycle: guest cutoff11:24UTC, handback11:27, shutdown11:30, expiry2026-10-27T11:37:58.013Z. No stop/delete/resume/create or watcher cancellation was performed.
''')
shutil.copyfile(H/'task-result.json',D/'result.json')
for n in ['source-compiler-pin.json','stage-manifest.json','capture-reservation.json','owned-cleanup.json','local-wrapper-validation.json','first-aggregate-rejection.json','remote-stage-verified.json']:
 shutil.copyfile(H/n,D/n)
shutil.copyfile(ROOT/'scratch/usage-watch/gta2-ordinary-driving-gameplay-oct27/root-ref-digest.json',D/'initial-root-ref-digest.json')
remote=D/'remote';remote.mkdir(exist_ok=True)
for p in (H/'remote-evidence').iterdir():shutil.copyfile(p,remote/p.name)
recipe=D/'recipe';recipe.mkdir(exist_ok=True)
for p in [*H.glob('*.py'),H/'startup.js']:
 if p.name in ['common-prewhitespace-fix.py']:continue
 shutil.copyfile(p,recipe/p.name)
# Snapshot only completed diagnostic operations; exclude mutable/current capture
# and transfer-media payload commands. API raw stdout and stderr stay distinct.
paths=[]
for p in H.iterdir():
 if not p.is_file() or p.name.startswith('package-report-op') or p.name in ('accounting.json','receipt-manifest.json'):continue
 if p.suffix in ('.json','.stdout','.stderr') or p.name.endswith('.supervisor-output') or p.name=='api-history.jsonl':paths.append(p)
paths += [p for p in (H/'api').iterdir() if p.suffix in ('.raw','.err')]
with tarfile.open(D/'diagnostics.tgz','w:gz') as t:
 for p in sorted(paths):t.add(p,arcname=str(p.relative_to(H)),recursive=False)
rows=[]
for p in sorted(D.rglob('*')):
 if p.is_file() and p.name!='payload-manifest.json':rows.append(dict(path=p.relative_to(D).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(D/'payload-manifest.json').write_text(json.dumps(dict(status=result['status'],files=rows),indent=2)+'\n')
dump('packaged-report.json',dict(files=len(rows),bytes=sum(x['bytes'] for x in rows),diagnosticsArchiveBytes=(D/'diagnostics.tgz').stat().st_size,report=str(D),status=result['status']))
print(json.dumps(json.loads((H/'packaged-report.json').read_text())))

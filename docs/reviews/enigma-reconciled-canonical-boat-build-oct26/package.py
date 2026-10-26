from common import *
import datetime,base64,re
N='docs/reviews/'+H.name;E=R/N;E.mkdir(parents=True,exist_ok=True)
transport=json.load(open(O/'readback-ledger.json'))['chunks'] if (O/'readback-ledger.json').exists() else [];events=[]
for r in transport:
 if r.get('startedAt') and r.get('finishedAt'):events += [(r['startedAt'],1),(r['finishedAt'],-1)]
for p in O.glob('api-*.json'):
 try:
  j=json.load(open(p));a=json.loads(j.get('stdout','null'))
  if not isinstance(a,dict) or not a.get('success'):continue
  if '-read-' in p.name:
   data=base64.b64decode(a['stdout']);r=dict(file=p.name,bytes=len(data),sha256=sha(data),responseSHA256=sha(p.read_bytes()),commandId=a['commandId'],startedAt=a.get('startedAt'),finishedAt=a.get('finishedAt'))
   transport.append(r)
   if a.get('startedAt') and a.get('finishedAt'):events += [(a['startedAt'],1),(a['finishedAt'],-1)]
   # Retain compact cryptographic receipt rather than base64 duplicate binary.
   p.write_text(json.dumps(r,indent=2)+'\n')
  elif re.search(r'archive-\d+\.json$',p.name):
   if a.get('startedAt') and a.get('finishedAt'):events += [(a['startedAt'],1),(a['finishedAt'],-1)]
 except (ValueError,KeyError):pass
active=peak=0
for at,delta in sorted(events,key=lambda x:(x[0],x[1])):active+=delta;peak=max(peak,active)
save('readback-ledger.json',dict(chunks=transport,actualPeakAPIChunkIntervals=peak,globalFourSlotGuardAdded=True))
summary=json.load(open(O/'remote-static-summary.json'));assert summary['pass'];modules={}
for x in summary['backends']:
 p=H/'modules'/x['file'];b=p.read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes'];modules[x['file']]=dict(bytes=len(b),sha256=sha(b),local=str(p),remote=str(H/'source/build'/x['file']),recovery='coordinator snapshot of bx_xw8d895f; preserve before expiry; no rebuild needed while hashes match')
save('modules.json',modules)
pins=json.load(open(O/'accepted-14-unchanged.json'))
for x in pins['files']:
 b=(pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')/x['path']).read_bytes();assert sha(b)==x['sha256']
save('accepted-14-after.json',dict(unchanged=True,files=pins['files']))
incidents=dict(substantiveCompilerFailures=[],sourceChanges=False,generatorInvocations=1,canonicalBuildInvocations=1,staticInspectorFailures=[dict(label='static',failure='independent inventory used lowercase hex; stopped before module inspection',log='remote-static.log'),dict(label='static-corrected',failure='storage-only generated mirror omitted DIRECT_WINDOW span; b0f1d4c2a339d18f rejected against canonical9a3bc9149d58209c before module inspection',log='remote-static-corrected.log')],resolvedWithinTask=['Boat CLI rejected --detach with --timeout before any remote execution; removed incompatible --timeout for detach','missing local loose static-mirror blob resolved using exact candidate blob-ID-matching readonly donor; no dependency/compiler substitution','local full projection stopped with stale completed GL128MiB reservation; reconciled coordinator actual completed/replacement64MiB tasks and retained unfinished reservations','static inspector inventory corrected to exact uppercase serialization and all source-declared spans; final static-complete passed, no generator/build rerun'],actualReadbackPeakConcurrentIntervals=peak,priorHistory='upstream-incidents.json retained unchanged; local128MiB generator/full-fragment stops and actual CivII/Maelstrom/SSH/resume/platform denials remain truthful',preflightNote='initial policy/help reads were pool-serialized lightweight commands; all build/transfer/staging/publication execution uses retained physical supervisors')
if peak>4:incidents['transportConcurrencyIncident']='Overlapping report readback and module retention briefly exceeded four actual chunk intervals; no source mutation or build replay. A shared cross-process four-slot guard was added; all later transfers serialized through it.'
save('incidents.json',incidents)
old=pathlib.Path('/tmp/enigma-reconciled-msg-independent-source-accept-oct26/ops')
for n in ['checkpoint.json','source-review-result.json','candidate-pins.json','publication.json','upstream-incidents.json']:
 p=old/n
 if p.exists():shutil.copyfile(p,E/('accepted-'+n))
# Keep exact compact evidence and the recovery/inspection recipes. Large per-read
# envelopes are represented by the readback ledger rather than committed twice.
names=['input-manifest.json','payload.json','archive-transfer.json','transfer-probe.json','remote-extraction.json','supplemental-static-input.json','accepted-14-unchanged.json','accepted-14-after.json','modules.json','incidents.json','launch-configuration.json','readback-ledger.json','remote-checkpoint.json','remote-closeout.json','region-map.generated.js','remote-run.py','static-check.js','remote-static-check.js','remote-static-check-corrected.js','transport.py','fetch.py','prepare.py','deploy.py','supplement.py','close-remote.py','common.py','invoke.py','package.py','git-init.py','final-resources.json','resources.py','publish.py']
names += [p.name for p in O.glob('remote-*.json') if p.name not in names]
names += [p.name for p in O.glob('remote-*.log')]
names += [p.name for p in O.glob('admission-*.json')]
names += [p.name for p in O.glob('git-*-execution.json')]
for name in sorted(set(names)):
 if (O/name).exists():shutil.copyfile(O/name,E/name)
shutil.copyfile(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json',E/'initial-root-ref-digest.json')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
text=f'''# Enigma reconciled candidate canonical build qualification

BUILD_AND_STATIC_PASS at {now}. Exact independently accepted candidate
425755ee5ee9be0734c7aca187521100f5487674, accepted source tree
fb1ef0832eb9e0229cd272c67b8465c4fcbf4396, base main
ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd. Source acceptance
facebcb2e6d04b84e80211a7814654e528566b0f is reused; no repeated acceptance,
295-mapping oracle or rejecting challenges. This is not a whole-current-main claim.

The NORMAL `node tools/gen-host-import-sigs.js --check` exited0 with295imports.
ONE `node tools/build-compile-wat.js` invocation exited0, default vendored WATX,
no shake/custom dispatch/names. It compiled and validated BOTH canonical backends:

| Module | Bytes | SHA256 |
|---|---:|---|
| wine-assembly.wasm | 1880854 | af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b |
| wine-assembly.compat.wasm | 1883427 | ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8 |

Both pass WebAssembly.validate/Module compilation without instantiation, exact
295 generated function import signatures (including all5changed completion
imports),296total imports,2226source-exact exports, equal export/import ABI,
set_message_completion(i32)->void and shared host.memory8192..32768pages.
No start section. Complete269-entry layout includes DIRECT_WINDOW span and
matches canonical hash9a3bc9149d58209c. Static reports enumerate full ABI.

147inputs/22210551bytes are SHA256+Git-blob verified before transfer and after
safe selective extraction and before/after every group. All14accepted source
pins remain unchanged, including13original nonrunner files and full reconciled
runner55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e.
The static-only mirror supplemental blob7f96dd1a81886946eb5fccefd5676c24e9016349
is verified against the candidate tree using source-review readobj/entries.
Standing readonly historical CivII donor files supplied source bytes only.

Boat bx_xw8d895f supported exec API only. Node24.22.1, heap1536MiB;
startup verifies inherited unlimited DATA/AS. Physical3GiB includes supervisor
and descendants, CPU90s/wall120s/file24MiB/output2MiB/excerpts8192B. Generator
peak479150080B/1.499s; both-backend build peak433176576B/9.078s, aggregateCPU14.18s;
static final peak130457600B. Exact tool hash/env/limits and fresh admissions
are retained per group. Remote allocated35835904B at execution handback within
1024MiB complete allocation, including remaining growth/reserve; free floor
2982150144B and host768MiB floor preserved. Local80MiB full accounting includes
selective Git, compressed payload, retained modules/reports, session/events,
positive WAL once, future publication/growth and8MiB reserve. Final resource
receipt records measured categories and peer unfinished reservations.

Two inspector fixture failures are retained: lowercase serialization, then
storage-only mirror missing DIRECT_WINDOW. Corrected independent static inventory
passed; source/compiler/tests were not weakened and generator/build were not
repeated. CLI detach pre-execution syntax, selective mirror donor recovery and
stale completed-peer admission bookkeeping are documented in incidents.json.
Measured transfer concurrency peak: {peak}; see incidents/readback ledger.
Historical physical128MiB generator failures and real access/platform denials
remain retained; no unchanged denied operations were replayed.

## Recovery and handback

Pinned binaries are retained outside Git at
`/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/` locally and
`/tmp/enigma-reconciled-canonical-boat-build-oct26/source/build/` on bx_xw8d895f.
`modules.json` supplies exact hashes/paths. Git does not preserve these binaries.
The remote selective payload, manifest, sources, recipes, logs and modules remain
under the same task root. Coordinator must snapshot-stop/preserve them before
expiry2026-10-27T00:37:17.515Z; shutdown checkpoint00:20UTC, no worker shutdown.
Use supported boat exec/readback only, fetch.py4500B decoded reads and<=8192B
responses, shared maximum4transport slots, verify full SHA256 before reuse.
Do not rebuild exact modules or download bulky intermediates. `prepare.py`,
`deploy.py`, input-manifest and payload receipts reconstruct the selective source
transport; remote-run.py reconstructs exact supervised commands if separately
authorized. Never replay an uncertain mutating API request; inspect its status.

Box remains RUNNING (API idle/healthok); all owned compiler/static process groups
are absent, detached build PID20769 exited0. Coordinator owns lifecycle. No
gameplay, guest instantiation, source repair, main integration, deployment,
trust/key/permissions/services changes, SSH/resume, new worker or task refill.
Remaining gates: exact changed-module initializer/thunk/decoded CALL-JMP/
park-retry/async qualification, then step ACK for every requested batch and a
following frozen zero-credit snapshot before input. RuntimeQualified=false;
gameplay=unknown. Return ownership and stop.
'''
(E/'README.md').write_text(text)
gate('packaged')
save('evidence-manifest.json',{str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in E.rglob('*') if p.is_file()})
print(json.dumps(dict(evidenceFiles=len(json.load(open(O/'evidence-manifest.json'))),ownBytes=alloc(H),gitBytes=alloc(R/'.git'),moduleBytes=alloc(H/'modules'),reportsBytes=alloc(O),transportPeak=peak)))

import pathlib,json,hashlib,shutil,gzip,time,os
P=pathlib.Path('/tmp/gta2-raw-exit-independent-accept-oct27')
R=P/'repo';O=P/'ops';D=R/'reports/gta2-raw-exit-independent-accept-oct27';E=D/'evidence'
E.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
ad=json.loads((O/'admission.json').read_text())
for name,pin in ad['pins'].items():
 b=(R/name).read_bytes();assert sha(b)==pin['sha256'];assert len(b)==pin['bytes']
assert sum(x['bytes'] for x in ad['pins'].values())<2097152
results={}
for label in ['node-startup','production-boundary','independent-causal','base-rejection','independent-remaining','typed-pointer','source-binding']:
 r=json.loads((O/(label+'.json')).read_text());assert r['stopReason'] is None and r['cleanupComplete']
 assert r['exit']==(1 if label=='base-rejection' else 0)
 results[label]={k:r[k] for k in ['exit','stopReason','cleanupComplete','peakRSS','command']}
review='''Independent source review: ACCEPT source-only candidate e99799cd80087eddcd574a58a7062d354fc4d050.
Only six runner hunks differ from exact original base: selected-entry state, entry reset,
selection bit, diagnostic integer handling, authoritative raw return fallback, and exit reset.
No API signature/table/formatter change, guest code change, or silent success implementation.
GetAttachedSurface has no ret metadata. API #672 is the CLI call sequence counter, not table ID;
COM 0xC0DE marker resolves the actual table method before the normal entry callback.
Return identity follows existing last-entry CLI semantics; callbacks carry no invocation token.
This does not establish nested invocation ownership: a new/filtered call supersedes old state,
and an exit is attributed to the last selected entry. Synthetic stale exits are checked only
when realizable by no-entry/duplicate callbacks, not invented API/sequence arguments.
Assumption: log_api_exit follows handler result storage and precedes caller register overwrite.
This task verifies the host boundary with stubbed registers; retained dispatch/runtime evidence
remains the authority for guest callback placement. No guest has been started to reverify it.
0xC0DE and multiword diagnostic markers keep their existing protocol meaning. They are not
unconditionally printed as arbitrary integers or interpreted as return values. Current-call
correlation survives diagnostic messages. Marker-shaped test inputs invoke actual callbacks.
Intentional legacy trace delta: untyped diagnostics now print [i32], while log_api_exit adds
one raw EAX line with API name; this is the repair. Typed trace formatting/suppression remains
unchanged. Filtered entries no longer inherit stale return/out-param/TVITEM metadata.
Quiet/default-off behavior installs no exit observer when no trace/ESP/critical consumer exists;
no observer register/memory reads occur. Paused tracing preserves the existing apiLogOff gate;
pause is effective through the existing quiet-mode dispatch suppression, not a new independent
pause guard inside callbacks. Forcing callbacks with another consumer follows legacy semantics.
Known ESP audit behavior may emit per-integer and exit deltas; it is unchanged by the repair.
No unintended legacy trace change found in the six-hunk diff. Existing broad producer groups
and six controls are reused, not rerun. Independent targeted cases add marker payloads,
zero/positive/signed/unsigned HRESULT/all-ones boundaries, current unknown/filtered sequence,
duplicate exit reads, omitted exit-reset and traced-return guards, and real GetClientRect
BOOL/LPRECT entry-pointer/ESP churn with one typed return/out-param and no guest mutation.
'''
(O/'source-review.txt').write_text(review)
checkpoint=dict(candidate='e99799cd80087eddcd574a58a7062d354fc4d050',status='ACCEPTED_SOURCE_ONLY',results=results,
 reused={'producerGroups':11,'producerRejectingControls':6,'verifiedPayloads':70,
 'producerManifestSHA256':'cd5336e81ce84f5d1fb0e83ec04b31673da581932722d94ba6ccc2b3a496bf48',
 'predecessor9276PayloadAcceptance':'unchanged coordinator verified; not repeated'},
 remaining=['later independently assigned current-main reconciliation','fresh coordinator runtime task/admission','real GTA2 HRESULT and build/gameplay gates'])
(O/'checkpoint.json').write_text(json.dumps(checkpoint,indent=2)+'\n')
# Preserve launcher-owned initial root-ref receipt without listing shared refs.
shutil.copyfile('/home/user/wine-assembly/scratch/usage-watch/gta2-raw-exit-independent-accept-oct27/root-ref-digest.json',O/'root-ref-digest.json')
compressed=[]
for f in sorted(O.iterdir()):
 if f.name in ['receipt-manifest.json','publication-closeout.json'] or f.name.startswith('package') and f.suffix in ['.json','.stdout','.stderr'] or not f.is_file():continue
 if f.suffix=='.diff':
  raw=f.read_bytes();dst=E/(f.name+'.gz');dst.write_bytes(gzip.compress(raw,mtime=0))
  compressed.append(dict(path=str(dst.relative_to(R)),rawBytes=len(raw),rawSHA256=sha(raw),recipe='gzip -dc '+str(dst.relative_to(R))))
 else:shutil.copyfile(f,E/f.name)
payloads=[dict(path=str(f.relative_to(R)),bytes=f.stat().st_size,sha256=sha(f.read_bytes())) for f in sorted(E.iterdir())]
manifest=dict(status='INDEPENDENT_ACCEPTANCE_SOURCE_ONLY',candidate=checkpoint['candidate'],base='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba',
 testedPins=ad['pins'],sourceGitBlobs='evidence/source-binding.stdout',results=results,reused=checkpoint['reused'],payloads=payloads,
 losslessCompressedDiagnostics=compressed,resource=['evidence/resource-pre-execution.json','evidence/resource-final.json'],review='evidence/source-review.txt',
 executionScripts={'independent-causal':'evidence/independent-causal-original.js','base-rejection':'evidence/base-rejection.js','independent-remaining':'evidence/independent-boundaries.js','typed-pointer':'evidence/typed-pointer.js'},
 controls={'originalBase':'expected exit1: diagnostic became premature return','independentOmissions':2,'producerReused':6},
 incidents=['producer initial missing author/base-only push preserved in referenced original closeout',
 'producer decimal/hex fixture correction preserved in original closeout',
 'producer disappearing index.lock accounting incident preserved in original closeout',
 'donor alternates nesting warning retained in checkout/source binding stderr; required source object reads succeeded',
 'initial local remote URL template corrected to exact donor vgrichina before any network operation'],
 producerCloseout='/tmp/gta2-untyped-api-return-observer-repair-oct27/ops/publication-closeout.json',
 preservation={'compiledModules':'all predecessor modules untouched, zero rebuild','originalDonors':'read only; no predecessor wrappers executed'},
 runtime={'guest':0,'compiler':0,'boatActions':0,'assignedBox':None,'lifecycleOwner':'coordinator','realGTA2HRESULT':None,'gameplay':False},
 remaining=checkpoint['remaining'],publication='postcommit exact remote verification in ops/publication-closeout.json; no main publication')
raw=json.dumps(manifest,indent=2)+'\n';(O/'receipt-manifest.json').write_text(raw);(D/'receipt-manifest.json').write_text(raw)
(D/'README.md').write_text('''# GTA2 raw API-exit independent acceptance

ACCEPTED SOURCE ONLY: candidate `e99799cd80087eddcd574a58a7062d354fc4d050`.
The exact pinned production host callback emits authoritative EAX once for untyped
IDirectDrawSurface_GetAttachedSurface after integer diagnostics and before caller
overwrite. The original base fails the unchanged oracle. This is synthetic callback
qualification with stub guest memory/registers, not an observed GTA2 HRESULT.

Independent numeric, marker/protocol, filtered/new/unknown sequence, stale/duplicate
exit, quiet/paused/default, two omitted-guard controls, and real typed GetClientRect
pointer/ESP churn checks pass. Reuse the unchanged producer 11 groups/six controls
and coordinator-verified 70 payloads plus predecessor 9276 payload acceptance.
See `evidence/source-review.txt` for callback ordering, last-entry correlation and
legacy trace-output assumptions. No signature or source repair was made here.

`receipt-manifest.json` binds source/fixture/command/diagnostic hashes, controls,
predecessor reuse, resource admission, preservation and cleanup. Evidence includes
the exact extraction spans, Node startup with inherited unlimited DATA/AS, distinct
stdout/stderr, exit/stopReason/cleanup, and original expected base failure.
Reproduce with installed Node v24.18.1, heap512MiB, the retained controlled wrapper,
one-permit light pool and trusted physical768MiB supervisor. Scripts retain original
absolute task/donor paths. No downloads, native recompilation or guest startup.

Original producer incidents remain in its referenced canonical closeout. Donor
alternate nesting warnings are retained; required source blobs are bound exactly.
This branch adds only the independent report; candidate history is preserved.
Final commit/strict-SSH exact remote verification is recorded separately in owned
`ops/publication-closeout.json` to avoid a circular commit hash.

Remaining gates: later independently assigned reconciliation against current main,
fresh coordinator runtime assignment/admission, actual GTA2 raw HRESULT and any
required build/gameplay acceptance. Runtime is not justified by this report alone.
Existing compiled modules are preserved. No box is assigned or changed; coordinator
retains lifecycle ownership. No main integration, public deployment, game/Boat,
worker launch, Claude or HeroesII actions. Stop and hand back to coordinator.
''')
print(json.dumps(dict(status=manifest['status'],payloads=len(payloads),manifestSHA256=sha(raw.encode()))))

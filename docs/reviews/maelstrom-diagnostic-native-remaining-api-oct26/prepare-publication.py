import pathlib,json,hashlib,gzip,base64,shutil,time,os,subprocess
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';D=pathlib.Path('/tmp/maelstrom-diagnostic-changed-module-native-oct26/ops');ROOT=pathlib.Path('/home/user/wine-assembly')
sha=lambda b:hashlib.sha256(b).hexdigest()
archive=json.loads(gzip.decompress((O/'remote-evidence.json.gz').read_bytes()));meta=json.load(open(O/'remote-evidence-manifest.json'))
for row in meta['files']:
 b=base64.b64decode(archive[row['name']]);assert len(b)==row['bytes'] and sha(b)==row['sha256']
results={}
for name,data in archive.items():
 if name.startswith('native-result-') and name.endswith('.json.gz'):
  j=json.loads(gzip.decompress(base64.b64decode(data)));assert j['status']=='PASS';results[j['scenario']+('-compat' if j['compat'] else '-tail')]=j
assert len(results)==39,len(results)
for n in ['errno0-tail','errno37-tail','errno0-compat','errno4-compat','errno37-compat']:assert results[n]['equivalent']
prior=json.load(open(D/'native-result-errno4-tail.json'));assert prior['status']=='PASS' and prior['equivalent']
assert sha((R/'test/maelstrom-diagnostic-canonical-native.cjs').read_bytes())=='ddb0d889541d32dddd881b168d6a69a85610050c1d56679765cec1c1531c65e2'
for n,h in [('errno-latch.wasm','aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1'),('errno-latch.compat.wasm','85eaf35e803a55b18992ac6a717ba0fe937e92aa65e71d40f675a5ccec6fa3ab')]:assert sha((D/n).read_bytes())==h
for k,j in results.items():
 assert j['moduleSHA256']==('85eaf35e803a55b18992ac6a717ba0fe937e92aa65e71d40f675a5ccec6fa3ab' if j['compat'] else 'aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1')
 assert j['nativeInstances']==1 and j['arenaMiB']==512 and j['heapMiB']==512
 assert j['off']['starting']==j['on']['starting']==[0,0]
diagnostics={k:j['capture'] for k,j in results.items() if j['capture']['rejectReason']}
assert set(d['rejectReason'] for d in diagnostics.values())=={4}
failed=json.load(open(O/'first-failure.json'));assert failed['case']=='completion-code16-tail'
progress=json.loads(base64.b64decode(archive['native-progress-completion-code16-tail.json']))
assert progress['snapshots'][-1]['diag']['status']==2
notcovered=['compiled completion reasons1/2/3: first supplemental native fixture failed because ready-select route did not invoke the intended socket_event callback; no actual mode transition', 'compiled completion reasons5/6/7/8/9: no public private-state setters or direct completion-function export; no native coverage established', 'cap exhaustion', 'stale token/internal-global mutation after completion', 'owner resumption after foreign-thread/regbank hook', 'disabled diagnostic getter call inertness: canonical OFF lane intentionally reads zero diagnostic getters; no new call-inertness test', 'full original _getptd implementation', 'loader-proven original CRT mapping', 'original errno/caller/gameplay', 'full-memory equivalence outside initialized fixture spans']
handoff=json.load(open(O/'remote-size.json'))
result=dict(status='PARTIAL_NATIVE_QUALIFICATION_FIRST_SUPPLEMENTAL_FIXTURE_FAILURE',candidate='44e344fdb26daab9a07210656597902ba27cb5f7',qualificationParent='606fa069a71920597a29764b27bd57b02fe7e5dd',branch='task/'+H.name,session=os.environ['CODEX_SESSION_ID'],nativeCanonical=dict(newPass=39,reusedPass=1,totalPass=40,newCases=sorted(results),errnoEquivalence=['errno0-tail','errno4-tail REUSED','errno37-tail','errno0-compat','errno4-compat','errno37-compat'],diagnosticReasonsPassed=[4],diagnosticCaptures=diagnostics,compiledProductionDispatch=True,oneArenaPerProcess=True,preCMPStop=True),supplemental=dict(status='STOP_AT_FIRST_NATIVE_FIXTURE_FAILURE',case=failed['case'],commandId='cmd_su0q8n2mywed',expectedModeChanges=1,observedModeChanges=0,productionDefectEstablished=False,earliestEvidence='earliest-native-failure-excerpt.json',retry=False),reused=dict(sourceStatic='unchanged exact accepted source/static/ABI seals; no source review/build/recompile',errno4TailModuleSHA256=prior['moduleSHA256'],inventory='donor checkpoint-final.json/result.json; source/static/errno4-tail checks not repeated'),moduleHashes=handoff['moduleHashes'],fixtureSHA256=sha((R/'test/maelstrom-diagnostic-canonical-native.cjs').read_bytes()),driverSHA256=sha((R/'tools/maelstrom-diagnostic-canonical-build.cjs').read_bytes()),remaining=notcovered,mapping='explicit controlled CRT base0x522000; authentic _errno CALL/ADD/C3 RET bytes, synthetic _getptd; not original-loader proof',originalGame=dict(errno='UNKNOWN',caller='UNKNOWN',gameplay='UNKNOWN',loader='UNKNOWN'),evidence=dict(remoteArchive='remote-evidence.json.gz',remoteArchiveSHA256=sha((O/'remote-evidence.json.gz').read_bytes()),preReductionArchive='remote-before-capture-reduction.json.gz',preReductionArchiveSHA256=sha((O/'remote-before-capture-reduction.json.gz').read_bytes()),durableCheckpoints=len(list(O.glob('checkpoint-*.json')))),lifecycle=handoff,at=time.time())
(O/'result.json').write_text(json.dumps(result,indent=2))
cp=dict(candidate=result['candidate'],moduleHashes=result['moduleHashes'],fixtureSHA256=result['fixtureSHA256'],driverSHA256=result['driverSHA256'],result=result['status'],groups=dict(canonicalNew39='PASS',tailErrno4='REUSED PASS',compiledReason4BothBackends='PASS',supplementalCode16='FIXTURE FAIL; STOP'),remaining=notcovered,evidence=['result.json','remote-evidence.json.gz','remote-evidence-manifest.json','first-failure.json','earliest-native-failure-excerpt.json'],at=time.time())
(O/'checkpoint-final.json').write_text(json.dumps(cp,indent=2))
dest=R/'docs/reviews'/H.name;dest.mkdir(parents=True)
selected=[p for p in O.iterdir() if p.is_file() and p.suffix in ['.json','.jsonl','.py','.cjs','.gz'] and p.name not in ['prepare-publication.py']]
for p in selected:shutil.copyfile(p,dest/p.name)
for n in ['checkpoint-final.json','result.json','native-result-errno4-tail.json','checkpoint-compile-static.json']:shutil.copyfile(D/n,dest/('reused-'+n))
text='''The exact retained diagnostic modules pass all 40 canonical controlled native cases: 39 newly executed remotely and the prior tail-call errno4 case reused. Tail-call errno0/37 and compatibility errno0/4/37 pass OFF/ON register, lazy-flag, initialized-memory, budget and yield equivalence. Wrong-return diagnostic reason4 is captured on both backends; ownership, frame, unsafe-read, start-mode, unowned/nested/foreign-return controls pass. No module rebuild or production source change was made.

Qualification remains partial. A separately sealed completion-mode fixture tried to use a real select socket-event callback to transition code16 before completion. That ready-select route made no such callback; the first native assertion observed zero transitions instead of one. Native execution stopped at that first substantive fixture failure. This does not establish a production defect. Compiled reasons1–3 and5–9, cap exhaustion, private stale-token mutation and the other explicit result.json gaps remain unqualified. No JS-model substitute was used.

The CRT base0x522000 is controlled, authentic _errno CALL/ADD/C3 RET bytes are reused, and _getptd is synthetic. This is neither original loader nor original gameplay proof. Source/static checks and errno4-tail were reused by exact seals. The original fixture remains byte exact; the supplementary fixture has its own derivation receipt and hash.

Remote evidence is retained losslessly in remote-evidence.json.gz, a gzip JSON map of filename to base64 bytes, with per-file hashes in remote-evidence-manifest.json. Native result/progress/preflight files within it are individually gzip compressed. Read-only standing modules/anchors are bound by input-manifest.json and remote transfer receipts, not duplicated in Git. Per-group checkpoints preserve passed-versus-remaining work.

Two setup/capture incidents were corrected without repeating passed native cases: excess new Git symlink views were replaced with standing flattened donor views, and growing full admission inventories were losslessly compressed after the2MiB capture gate stopped checkpointing. Both original rejection receipts and the pre-reduction evidence archive are retained. Final remote capture is646239bytes; all80 supervised processes were reaped, with no owned heavy children remaining. bx_7qwjxps7 is left RUNNING; coordinator owns shutdown05:50UTC, expiry06:06:24.385UTC.
'''
(dest/'README.md').write_text(text)
rows=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(dest.iterdir()) if p.is_file()]
(dest/'evidence-manifest.json').write_text(json.dumps(rows,indent=2));(O/'publication-plan.json').write_text(json.dumps(dict(destination=str(dest),files=len(rows)+1,bytes=sum(r['bytes'] for r in rows),at=time.time()),indent=2))
print(json.dumps(dict(status='REVIEWED partial',canonical39New=39,priorReused=1,firstFailure=failed['case'],publicationFiles=len(rows)+1,publicationBytes=sum(r['bytes'] for r in rows))))

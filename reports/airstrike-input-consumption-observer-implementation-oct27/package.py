import hashlib,json,pathlib,shutil
B=pathlib.Path('/tmp/airstrike-input-consumption-observer-implementation-oct27')
O=B/'ops';R=B/'repo';D=R/'reports/airstrike-input-consumption-observer-implementation-oct27'
D.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
payloads=[]
for p in sorted(O.iterdir()):
    if not p.is_file() or (p.name!='package.py' and p.name.startswith(('package.','receipt-manifest.','publication.','remote-verify.','commit.','add.','staged.','closeout.','final-'))):continue
    q=D/p.name;shutil.copyfile(p,q)
    payloads.append(dict(path=q.name,sha256=sha(q),bytes=q.stat().st_size,original=str(p)))
checkpoint=json.loads((O/'acceptance-checkpoint.json').read_text())
manifest=dict(kind='source-only input consumption observer implementation',status='targeted acceptance passed; independent acceptance/runtime pending',
    baseRevision=checkpoint['baseRevision'],testedSource=checkpoint['source'],
    pins={'test/run.js':'f52b03a096a9a614b681cdf0f912ce20ca19fcba','test/input-consumption-trace.js':'3152c3974fc2c0aa702b26ba2bfc521917ae281f'},
    historicalRunner={'revision':'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a','sha256':'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'},
    retainedCausalEvidence={'manifest':'/tmp/airstrike-space-startup-boundary-repair-oct27/ops/receipt-manifest.json','sha256':'9aca5b02421586e2572b3db4b7854400f1059c3cb7996ffb33fef9b832375531','coordinatorVerifiedPayloads':51,'replaySHA256':'f994c20a88ae44549bf355eddd2d1e69a16671c07025578581278db17177a573','report':'96e9d04041007471056509af14df270bc66a16eb'},
    firstCheckpoint='production-gap.json: pinned production control snapshot lacks queue/key/wait/counter observations',
    results={name:json.loads((O/(name+'.json')).read_text()) for name in checkpoint['passingGroups']},
    rejectedControls=['detached production input-state branch','guest clock probe','scheduled queue drain','raw-state clock label','remapped tick history','trace spending tick probe','detached host clock reader','missing last tick','malformed request/options','nonfrozen/nonzero credits'],
    originalDiagnostic='production-state.stderr: extra closing brace in new test, corrected; original exit1 retained; no guard exhausted',
    publicationCheck='full staged diff check flags three original git init stderr hint lines with trailing spaces; raw diagnostic bytes preserved. Source/test/README-only staged whitespace check passes; no source rejection.',
    method='byte-exact production regions and actual helper/host routing, no guest initialization or module execution',
    disabledDefault='legacy snapshots unchanged; request rejects without existing trace flag; disabled hooks emit no output or clock probes',
    preservation='read-only donor objects; no emulator/WAT edit, compiler/build, download, guest/game/Boat call or ignored tree copy; retained compiled modules untouched',
    lifecycle={'box':None,'operations':0,'owner':'coordinator; no assigned box'},
    remaining=['independent exact-source acceptance','later coordinator-assigned diagnostic runtime with fresh admission; SDL consumption remains unknown','any main publication requires independent current-main reconciliation'],
    cleanup='all completed supervised operations record cleanupComplete=true; only own messageboard watcher remains until closeout',
    resourceManifest='per-operation *.admission.json: current own/source/Git + launcher + session/full WAL once +96MiB growth/publication +8MiB reserve within256MiB; remaining client growth only; shared child768MiB; host floor2982150144',
    payloads=payloads,publication='external ops/publication.json and remote-verify.json bind final commit; canonical manifest cannot contain its own commit')
data=json.dumps(manifest,indent=2)+'\n'
(O/'receipt-manifest.json').write_text(data);(D/'receipt-manifest.json').write_text(data)
print(json.dumps(dict(payloads=len(payloads),canonicalSHA256=sha(O/'receipt-manifest.json'),testedRunner=checkpoint['source']['test/run.js'])))

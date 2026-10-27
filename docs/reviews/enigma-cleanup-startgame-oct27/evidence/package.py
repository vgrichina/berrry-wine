gate('package')
g=H/'repo/.git';assert g.is_dir();(g/'objects/info/alternates').write_text('/tmp/enigma-streams-independent-accept-integrate-oct27/repo/.git/objects\n');(g/'info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
with (g/'config').open('a') as f:f.write('\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n[core]\n sparseCheckout = true\n')
apirows=[json.loads(s) for s in (O/'requests.jsonl').read_text().splitlines()];capture=sum(p.stat().st_size for p in (O/'responses').iterdir());meta=json.loads((O/'new-menu-metadata.json').read_text());wire=None
for p in sorted((O/'responses').glob('*.stdout')):
 try:
  j=json.loads(p.read_bytes());v=json.loads(j.get('stdout',''))
  if set(v)=={'wire'}:wire=v['wire']
 except (ValueError,TypeError):pass
pieces={};byhash={r['commandSHA256']:r for r in apirows};missing=[]
if wire:
 for off in range(0,wire,4096):
  code='import pathlib,base64,zlib;b=pathlib.Path('+repr(meta['path'])+').read_bytes();b=zlib.compress(b,9);print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  row=byhash.get(sha(('python3 -c '+shlex.quote(code)).encode()))
  if not row:missing.append(off);continue
  j=json.loads((O/'responses'/(row['response']+'.stdout')).read_bytes());pieces[off]=base64.b64decode(j['stdout'].strip(),validate=True)
 if not missing:
  b=zlib.decompress(b''.join(pieces[k] for k in sorted(pieces)));assert len(b)==meta['bytes'] and sha(b)==meta['sha256'];(O/'retained-actual-menu.png').write_bytes(b)
save('readback-recovery.json',dict(fromAlreadyCapturedResponsesOnly=True,newAPIRequests=0,wireBytes=wire,chunksRecovered=len(pieces),missingOffsets=missing,complete=(O/'retained-actual-menu.png').exists(),actualSHA256=meta['sha256'],notAnInputAuthorization=True))
last=O/'responses/1793091626854700473.stdout';diagnostic=json.loads(json.loads(last.read_bytes())['stdout']);save('already-captured-runtime-diagnostic.json',diagnostic)
limits=dict(apiCapture=1048576,actualAPICapture=capture,overshoot=max(0,capture-1048576),guardFailure='Post-response guard and eagerly queued concurrent fetch admitted all pending chunks; a subsequent diagnostic also ran before post-capture rejection. No further API calls after recognition. Pre-dispatch guard fixed locally but no runtime retries.',responses=len(list((O/'responses').glob('*.stdout'))),maxResponseBytes=max(r['stdoutBytes']+r['stderrBytes'] for r in apirows))
save('capture-budget-incident.json',limits)
life=json.loads((ROOT/'scratch/usage-watch/enigma-cleanup-startgame-oct27.task.runtime.json').read_text())
result=dict(status='BLOCKED_FRAME_REVIEW_CAPTURE_BUDGET_STOP',at=time.time(),acceptedSupervisor='b160b5403e69f28e92e218849cc8165c67776bd2',productionRuntime='425755ee5ee9be0734c7aca187521100f5487674',moduleSHA256='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b',mapSHA256='06a72d86b409850d73a8158d4f12d974b517ed0c9532652a1fc5f0ee2cb09f83',mapFiles=2665,mapBytes=37525867,moduleSupplementBytes=1880854,guestInvocations=1,restarts=0,decisions=0,inputs=0,gameplay=False,ordinaryGuestQuit=False,actualNewFrame=meta,historicalTransportGate=json.loads((O/'historical-review.png.receipt.json').read_text()),captureBudget=limits,terminal='Not independently retrieved: cumulative API capture budget exhausted; remote original supervisor owns no-review cleanup within unchanged110s allowance. Actual terminal/owned absence require coordinator preservation/collection under separate authorization.',startup='Original accepted supervisor produced new menu metadata at batch45569; exact startup diagnostics retained on box and partially in already-captured-runtime-diagnostic.json. Do not substitute detached acknowledgment for startup proof.',box=BOX,lastProvenState='RUNNING_API_EXEC_SUCCEEDED_2026-10-27T09:00:26Z',leaveRunning=True,shutdownOwner='coordinator',lifecycle=life,remainingGate='Pre-admit entire new-frame envelope and terminal reserve, inspect genuine current frame within accepted review window then correlated StartGame and after-action gameplay review under a separately assigned fresh invocation; this spent attempt must not restart.',cleanup='All local supervised child receipts retained; remote supervisor/Node terminal and absence unverified; coordinator owns snapshot-stop and evidence preservation.')
save('result.json',result);save('checkpoint.json',result)
save('key-source-pins.json',dict(supervisor=sha(pathlib.Path('/tmp/enigma-streams-independent-accept-integrate-oct27/repo/tools/enigma-supervised-gameplay.py').read_bytes()),controller=sha(pathlib.Path('/tmp/enigma-streams-independent-accept-integrate-oct27/repo/tools/enigma-frozen-gameplay-controller.py').read_bytes()),trustedSupervisor=sha(pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py').read_bytes()),runner=next(r['sha256'] for r in json.loads((ROOT/'scratch/usage-watch/enigma-cleanup-verified-runtime-map-oct27.json').read_text())['files'] if r['target']=='runner/test/run.js')))
for p in O.glob('*.py'):ast=__import__('ast');ast.parse(p.read_text())
save('report-validation.json',dict(pythonSyntax='PASS',jsonFiles='All retained JSON documents parsed where complete; raw stdout/error streams intentionally retain non-JSON diagnostics',readbackRecovery='readback-recovery.json',noRepeatedAcceptanceSuites=True,publication='Evidence-only independent-root sparse branch; no production source edits and no main merge authorization'))
D=H/'repo/docs/reviews'/H.name;D.mkdir(parents=True,exist_ok=True)
for p in sorted(O.rglob('*')):
 if p.is_file() and '__pycache__' not in p.parts and p.name not in ['package.log','package.execution.json']:
  q=D/'evidence'/p.relative_to(O);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
(D/'README.md').write_text('''# Enigma Start Game acceptance — blocked, no input

One accepted production supervisor invocation was launched on bx_mueag3dn at 08:59:33.817 UTC (cmd_hqtwflmxdxp3). It generated a genuine new menu-candidate frame at batch 45569, SHA256 b876992c5035e22563a9a2c9ed87bda8d3ab381bc7b55974050d6205b8933be9, 413407 bytes. The frame differed from the historical transport fixture. Review delivery failed on the cumulative 1 MiB API capture guard; no decision file or click was delivered, and gameplay is unverified. The post-capture guard overshot; capture-budget-incident.json records exact actual bytes and cause. The historical readback gate passed in 4.670 seconds, but it did not pre-admit the complete subsequent frame and cleanup envelope.

All 2665 map files (37525867 bytes) were staged and hash verified; canonical parser enumeration passed for 2460 VFS files and eight DLLs. The supplied map omitted the explicit af202 tailcall module required at the original launch path, instead carrying an unrelated canonical module at runtime/build. The exact af202 module (1880854 bytes) was recovered from the already-retained immutable source named in readiness and staged separately; the other module was never executed. No build, native replay, semantic repair or reacquisition occurred.

Failed setup is retained: mount-wrapper HOME placeholder SyntaxError, incompatible local CLI timeout+detach arguments, and a detached wrapper missing the module before supervisor/Node startup. Only the final wrapper started the accepted supervisor. Exact per-command hashes, API command IDs, distinct raw stdout/stderr and startup configuration/source pins are retained. After capture rejection, no further API calls were made once the exhausted budget was recognized. Already captured responses may recover the complete actual PNG locally; that recovery is evidence preservation and never authorizes late input.

The original 110-second supervisor allowance owns no-review cleanup. Remote terminal status and owned-process absence were not independently retrieved after capture exhaustion. This report therefore makes no clean-exit, ordinary guest Quit or gameplay claim. Coordinator must preserve remote /tmp/enigma-cleanup-startgame-oct27/ops before snapshot-stop. Leave bx_mueag3dn running: handback09:20, coordinator snapshot-stop09:25, expiry09:42:54 UTC.

This independent-root sparse report branch contains evidence only. Root tracked files/index/refs and donor stores remained read-only. Never merge this orphan report as production code. No main ownership, public deployment, other boxes, SSH runtime, new worker, allowance reset or uncertain-step replay was used.
''')
manifest=[dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(D.rglob('*')) if p.is_file()]
(D/'manifest.json').write_text(json.dumps(dict(files=manifest),indent=2)+'\n');save('publication-manifest.json',dict(files=len(manifest),bytes=sum(r['bytes'] for r in manifest),sha256=sha((D/'manifest.json').read_bytes())))
print(json.dumps(dict(status=result['status'],capture=limits,recovery=json.loads((O/'readback-recovery.json').read_text()),files=len(manifest))))

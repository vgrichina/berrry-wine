gate('package')
g=H/'repo/.git';(g/'objects/info/alternates').write_text('/tmp/enigma-streams-independent-accept-integrate-oct27/repo/.git/objects\n')
(g/'info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
with (g/'config').open('a') as f:f.write('\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n[core]\n sparseCheckout = true\n')
D=H/'repo/docs/reviews'/H.name;D.mkdir(parents=True,exist_ok=True)
save('checkpoint.json',dict(at=time.time(),phase='BLOCKED_TRANSPORT_502_ATTEMPT_SPENT',guestInvocations=1,restarts=0,inputs=0,gameplay=False,ordinaryQuit=False,readbackGate=True,readbackSeconds=4.630762290908024,readbackBytes=389913,readbackSHA256='8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5',cause='Supported API read-only new-frame metadata poll returned HTTP 502 with empty response; no unchanged retry, decision, input, restart or replay. Supervisor handles original bounded no-review cleanup.',commandId='cmd_ao080xgrytd4',box='bx_nmvbu5c7',shutdownOwner='coordinator',expiry='2026-10-27T05:12:05Z'))
for p in O.rglob('*'):
 if p.is_file() and p.name!='board-watch.log' and '__pycache__' not in str(p):
  q=D/'evidence'/p.relative_to(O);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
for n in ['REPORT.md','review-latency.json']:
 src=OLD/'repo/docs/reviews/enigma-separated-stream-runtime-oct27'/n if n=='REPORT.md' else OLD/'ops'/n
 shutil.copyfile(src,D/('predecessor-'+n))
shutil.copyfile(ROOT/'scratch/usage-watch/enigma-prepared-readback-startgame-oct27/root-ref-digest.json',D/'initial-root-ref-digest.json')
shutil.copyfile(ROOT/'scratch/usage-watch/enigma-prepared-readback-startgame-oct27.task.runtime.json',D/'runtime.json')
(D/'REPORT.md').write_text('''# Enigma prepared readback and bounded runtime attempt

The mandatory prelaunch readback gate passed. A fresh single guest attempt then stopped at a supported Boat API HTTP 502 during read-only capture-metadata polling. No decision or gameplay input was sent; no poll replay, guest restart, attach, source repair, build or regression replay occurred. Start Game, gameplay and ordinary guest Quit remain unqualified.

The exact immutable 389,913-byte menu PNG was transferred with four parallel read-only API requests maximum, 4,096 decoded bytes per chunk, through lossless zlib transport. Its SHA256 matched `8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`; transfer elapsed 4.630762 seconds. Actual serialized API responses were retained, not printed. The full preflight supervisor completed in 4.970503 seconds with peak RSS 65,458,176 bytes. The image was inspected before launch. This historical inspection authorized no input: the prepared decision helper requires actual new capture SHA256 and batch plus a fresh visual review. The prior task's 13.36-second delayed start and 16.13-second transfer failure remain in the predecessor report/receipt.

All 67 predecessor evidence manifest entries were freshly rehashed without mismatch. Accepted supervisor/controller pins remained exact. Production source `425755ee5ee9be0734c7aca187521100f5487674`, supervisor integration `b160b5403e69f28e92e218849cc8165c67776bd2`, and retained module SHA256 `af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b` are reused; this does not qualify the current-main emulator. Canonical filename-bearing mount argv remained identical and reused the immutable passing parser/enumeration receipt (2,460 files, eight DLLs, zero comma-bearing files). New wrapper/config/output paths are task-owned; retained runtime paths were read only.

Fresh local aggregate disk/RAM and remote RAM/disk admission passed before execution. Old supervisor/Node identities were absent. API detached launch command `cmd_ao080xgrytd4` was acknowledged at 04:31:14.894 UTC; that acknowledgement alone does not prove guest startup. The next-frame poll returned `{status:502,error:"request failed (502): <empty response>"}` at 04:31:24.543 UTC. The unchanged controller has no decision file and retains its original 110-second aggregate budget. Terminal/startup/cleanup collection is recorded separately when available; uncertainty is never inferred as completion.

The unchanged accepted controller exposes one reviewed Start Game action and an after-action capture followed by harness quit. It supplies no ordinary guest Quit action; harness cleanup is never credited as ordinary Quit. No custom controller, extra guest request or review waiver was used.

This independent-root sparse evidence branch must not be merged as production code. Root tracked/index/refs and donors remain read only except append-only messageboard. Box bx_nmvbu5c7 lifecycle remains coordinator-owned, cutoff 04:40, handback 04:43, shutdown 04:45, expiry 05:12:05 UTC. No box stop/resume/delete operation is authorized or performed.
''')
rows=[dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(D.rglob('*')) if p.is_file() and p.name!='manifest.json']
(D/'manifest.json').write_text(json.dumps(dict(files=rows),indent=2)+'\n');print('packaged',len(rows),sum(r['bytes'] for r in rows))

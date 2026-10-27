gate('finalize');D=H/'repo/docs/reviews'/H.name
receipt=json.loads((O/'acceptance.json').read_text());receipt['incidents'].append('First packaging attempted to include all base64 runtime transfer command bodies, exceeded its16MiB archive projection guard before write. No OS/provider resource denial, no guest replay or limit change. Bulk command bodies remain owned ops; compact publication retains exact hashes and executable staging recovery recipe with immutable input manifest.')
save('acceptance.json',receipt);shutil.copyfile(O/'acceptance.json',D/'acceptance.json')
allfiles=[]
for p in sorted(O.rglob('*')):
 if p.is_file():allfiles.append(dict(path=str(p.relative_to(O)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(D/'local-evidence-manifest.json').write_text(json.dumps(allfiles,indent=2)+'\n')
shutil.copyfile(ROOT/'scratch/usage-watch/enigma-published-progressive-startgame-oct27/root-ref-digest.json',D/'initial-root-ref-digest.json')
shutil.copyfile(O/'stage.py',D/'stage.py');shutil.copyfile(O/'finalize.py',D/'finalize.py')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for p in sorted(O.rglob('*')):
  if p.is_file() and 'commands' not in p.parts and 'remote-evidence' not in p.parts and p.name not in ('board-watch.log','terminal-evidence.tar.gz') and p.suffix!='.png':t.add(p,arcname=str(p.relative_to(O)))
assert len(buf.getvalue())<8388608;(D/'causal-diagnostics.tar.gz').write_bytes(buf.getvalue())
(D/'README.md').write_text('Enigma Loading to reviewed Main Menu, one bounded invocation\n\nActual full640x480 Loading frame at batch49665 followed by reviewed Main Menu at batch78593. Start Game was visible and externally approved but not dispatched: the original cumulative28second review allowance expired during serial full-frame transfer and review. No gameplay or ordinary Quit evidence. Every requested step had a matching full ACK followed by a frozen snapshot with zero credits. The controller sent harness quit; supervisor recorded listener identity change and SIGTERM child completion, with no owned survivors.\n\nPinned production runner and accepted controllers over retained canonical module: this is not a whole current-main emulator qualification. No replay/source repair/main ownership/public deployment. Reused accepted source groups without repetition.\n\nSee acceptance.json, frame-1.png, frame-2.png, terminal-evidence.tar.gz and causal-diagnostics.tar.gz. Exact bulk staging commands remain in owned ops/commands; local-evidence-manifest.json pins each command, response and diagnostic. stage.py/control.py and runtime-manifest.json retain the recovery recipe and immutable input identities. First overlarge archive guard and all earlier setup/display incidents remain disclosed.\n\nReport-only sparse orphan branch: never merge whole tree. bx_pa3bb5zc left running; coordinator owns shutdown11:00UTC, handback10:57UTC, expiry2026-10-27T11:06:11Z.\n')
manifest=[]
for p in sorted(D.iterdir()):
 if p.is_file() and p.name!='manifest.json':manifest.append(dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for r in manifest:
 b=(D/r['path']).read_bytes();assert len(b)==r['bytes'] and sha(b)==r['sha256']
save('package-validation.json',dict(at=time.time(),allPayloadHashes=True,files=len(manifest),allStepACKAndFrozenZero=True,steps=receipt['stepRequests'],inputs=0,quitCommands=receipt['quitCommands'],compactArchiveBytes=len(buf.getvalue()),sourceGitActual=alloc(H/'repo'),opsActual=alloc(O)))
save('result.json',receipt);print(json.dumps(dict(status=receipt['status'],steps=receipt['stepRequests'],inputs=0,files=len(manifest),archiveBytes=len(buf.getvalue()))))

repo=H/'repo';doc=repo/'docs/reviews'/H.name;doc.mkdir(parents=True,exist_ok=True)
run=repo/'scratch/runs'/H.name;run.mkdir(parents=True,exist_ok=True)
outcome=json.loads((O/'outcome.json').read_text())
cleanup=json.loads(json.loads((O/'remote-last.json').read_text())['stdout']);assert cleanup['cleanupComplete'] and cleanup['ownedLive']==[];save('remote-owned-cleanup.json',cleanup)
for p in O.rglob('*'):
 if not p.is_file() or p.name.startswith('board-watch') or p.suffix in ['.png'] or p==O/'payload-manifest.json':continue
 if 'remote-tools' in p.parts:continue
 dest=doc/'evidence'/p.relative_to(O);dest.parent.mkdir(parents=True,exist_ok=True)
 # Encode diagnostic streams losslessly to avoid Git whitespace interpretation.
 if p.suffix in ['.stdout','.stderr']:dest=dest.with_suffix(dest.suffix+'.base64');dest.write_bytes(base64.b64encode(p.read_bytes())+b'\n')
 else:shutil.copyfile(p,dest)
for p in O.glob('*.png'):shutil.copyfile(p,run/p.name)
for name in ['acceptance-tests.json','cpu-accounting.json','profile.json','remote-owned-cleanup.json']:
 shutil.copyfile(O/name,run/name)
from datetime import datetime,timezone
previous=json.loads((OLD/'repo/scratch/runs'/OLD.name/'result.json').read_text());start=json.loads((O/'remote-evidence/guest/command.json').read_text())['at'];end=json.loads((O/'remote-evidence/guest/supervision.json').read_text())['at']
previous.update(taskId=H.name,agentId='codex:ricochet-measured-cpu-round-gameplay-oct27',startedAt=datetime.fromtimestamp(start,timezone.utc).isoformat(),finishedAt=datetime.fromtimestamp(end,timezone.utc).isoformat(),outcome='harness-error',route='round-entry',command=json.loads((O/'remote-tools/guest-args.json').read_text()),summary=outcome['summary'],screenshots=['menu.png','round-before.png'],artifacts=['acceptance-tests.json','cpu-accounting.json','profile.json','remote-owned-cleanup.json'],acceptance=dict(closurePins=True,remoteHashes=True,nodeStartup=True,canonicalParser=True,freshMenu=True,round=True,paddleBallResponse=False,ordinaryQuit=False),termination=json.loads((O/'remote-evidence/guest/supervision.json').read_text()))
(run/'result.json.tmp').write_text(json.dumps(previous,indent=2)+'\n');(run/'result.json.tmp').rename(run/'result.json')
for p in (O/'remote-tools').glob('*'):
 dest=doc/'remote-tools'/p.name;dest.parent.mkdir(exist_ok=True);shutil.copyfile(p,dest)
readme='# Ricochet bounded round continuation\n\n'+outcome['summary']+'\n\nOne fresh invocation; retained537-file/53313381-byte closure rehashed; no transfer/build rerun. CPU300 aggregate, wall180, physical3GiB, Node24.22.1 heap2048; unchanged trusted supervisor also enforces per-process CPU90. Original CPU90 aggregate stop and every setup incident preserved. DATA/AS unlimited for Node; Git DATA512MiB applies to Git children only.\n\nNo main ownership or public deployment. Box bx_e9mecsag is handed back RUNNING; coordinator owns09:35UTC snapshot/stop, expiry09:43:37UTC.\n'
(doc/'README.md').write_text(readme)
manifest=[]
for p in [*doc.rglob('*'),*run.rglob('*')]:
 if p.is_file() and p!=doc/'payload-manifest.json':manifest.append(dict(path=str(p.relative_to(repo)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(doc/'payload-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for x in manifest:assert sha((repo/x['path']).read_bytes())==x['sha256']
save('payload-test.json',dict(files=len(manifest),hashes='PASS',scope='docs/reviews and scratch/runs only',at=time.time()))
save('result.json',dict(outcome=outcome,branch='task/'+H.name,box=BOX,state='RUNNING',expiry='2026-10-27T09:43:37Z',shutdownOwner='coordinator',oneInvocation=True,evidence=str(doc),remaining=outcome['remaining'],stop=True))
print('packaged',len(manifest),'verified payloads')

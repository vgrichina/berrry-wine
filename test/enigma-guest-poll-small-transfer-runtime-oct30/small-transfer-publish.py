"""Explicit-path publication only; separate index preserves sparse predecessor omissions."""
import pathlib,json,hashlib,shutil,datetime,os
import small_transfer_gate as g
g.setup();o=g.ops;r=o.ROOT;e=o.E
scope='test/enigma-guest-poll-small-transfer-runtime-oct30'
d=o.REPO/scope
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(n,args):
 rc,s=o.run(n,['git','-C',str(o.REPO)]+args,cwd=o.REPO,git=True);assert rc==0,(n,rc);return s
if not d.exists():
 d.mkdir()
 for n in ['small_transfer_ops.py','small_transfer_gate.py','small-transfer-runtime-v2.py','small-transfer-create.py','small-transfer-preflight.py','small-transfer-report.py','small-transfer-publish.py','owner-policy-guest.py','guest-poll-instrument.py','guest-poll-args.json']:
  shutil.copyfile(r/n,d/n)
 for n in ['preflight.json','controls.json','startup.json','canonical-parser.json','canonical-parser.stdout','file-control.json','boat-created.json','boat-assignment.json','schedule.json','watchdog.json','transfer-complete.json','capture-manifest.json','capture-selection.json','runtime-evidence.json','failure.json','closeout.json','transfer-prefix-proof.json','interruption-state.json','transfer-0802.stdout','handoff-state.stdout','transport-initial-reference.json','transport-final-reference.json']:
  if (e/n).exists():shutil.copyfile(e/n,d/n)
 shutil.copyfile(r/'small-transfer/raw/transfer-0000.stdout',d/'transfer-0000.stdout')
 # Seal raw transport receipts and ledgers by a streaming inventory, without base64 duplication.
 rows=[]
 for p in sorted((r/'small-transfer/raw').iterdir()):
  if p.is_file():rows.append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)))
 inventory=r/'small-transfer/raw/artifact-inventory.json'
 inventory.write_text(json.dumps(rows,separators=(',',':'))+'\n')
 (d/'raw-artifacts.json').write_text(json.dumps(dict(path=str(inventory),sha256=sha(inventory),files=len(rows),bytes=sum(x['bytes'] for x in rows),allPhysicallyCharged=True))+'\n')
 for p in (r/'small-transfer/images').glob('*.png'):shutil.copyfile(p,d/p.name)
 pins=json.loads((o.REPO/'test/enigma-guest-poll-causal-runtime-oct30/input-identities.json').read_text())
 pins.update(taskBornHEAD='7c45c0a0136721cd47bf149b946a73287af57507',instrumentedRunnerExecuted=(e/'runtime-evidence.json').exists())
 (d/'input-identities.json').write_text(json.dumps(pins,indent=2)+'\n')
 # Human-reviewed report and result are prepared separately after actual evidence inspection.
 for n in ['README.md','completion-receipt.json']:
  shutil.copyfile(r/'small-transfer'/n,d/n)
 (d/'artifact-hashes.json').write_text(json.dumps({p.name:dict(bytes=p.stat().st_size,sha256=sha(p)) for p in d.iterdir() if p.is_file()},indent=2)+'\n')
g.admission()
os.environ['GIT_INDEX_FILE']=str(r/'small-transfer/publication-index')
assert run('publication-head',['rev-parse','HEAD']).strip()=='7c45c0a0136721cd47bf149b946a73287af57507'
run('isolated-index',['read-tree','HEAD'])
run('stage',['add','--',scope])
run('diff-check',['diff','--cached','--check','--',scope])
paths=run('staged-paths',['ls-files','--stage','--',scope]);assert len(paths.splitlines())==len(list(d.iterdir()))
for i,line in enumerate(paths.splitlines()):assert run('object-%02d'%i,['cat-file','-t',line.split()[1]]).strip()=='blob'
run('review-stat',['diff','--cached','--stat','--',scope])
run('commit',['commit','-m','Fix bounded API exec transfer and record original Enigma guest poll'])
head=run('commit-sha',['rev-parse','HEAD']).strip()
run('push',['push','origin','HEAD:refs/heads/'+scope])
remote=run('remote-sha',['ls-remote','--heads','origin','refs/heads/'+scope]).split();assert remote==[head,'refs/heads/'+scope]
receipt=r/'small-transfer/completion-receipt.json';v=json.loads(receipt.read_text());v.update(commit=head,remoteSHA=head,remoteRef=remote[1],remoteVerified=True,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());receipt.write_text(json.dumps(v,indent=2)+'\n')
note=f"{v['completedAt']} small-transfer worker RELEASE: {v['status']}; commit {head} remote {remote[1]} exactSHA verified; Boat {v['boat']} snapshot-stop {v['lifecycle']}; receipt {receipt}. No renderer/WAT edit, workers, Telegram or main merge.\n"
(r/'small-transfer/messageboard-note.txt').write_text(note)
for board in [o.REPO/'messageboard.txt',pathlib.Path('/home/user/wine-assembly/messageboard.txt')]:
 with board.open('a') as f:f.write(note)
print(json.dumps(dict(commit=head,remoteSHA=remote[0],receipt=str(receipt))))

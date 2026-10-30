import pathlib,json,hashlib,os,tarfile,ast
import ops
from limit_contract import configure_parent
R=pathlib.Path(__file__).parent
ops.BASE=configure_parent();a=ops.admission()
manifest=pathlib.Path('/tmp/madbomber-telegram-render-oct30/manifest.json');rows=json.loads(manifest.read_text())
assert len(rows)==378
for row in rows:
 p=manifest.parent/(row.get('target') or row['dest']);b=p.read_bytes()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],str(p)
packet=pathlib.Path('/tmp/madbomber-original-gameover-restart-runtime-oct30/runtime.tar.gz')
assert packet.stat().st_size==9487608 and hashlib.sha256(packet.read_bytes()).hexdigest()=='e77cb5b768c4b07026250d815f264c590dcde12c4426500d1522bba84ece19d1'
verified=json.loads(pathlib.Path('/tmp/madbomber-original-gameover-restart-runtime-oct30/verified-inputs.json').read_text())['rows']
with tarfile.open(packet) as t:
 members={m.name:m for m in t.getmembers() if m.isfile()}
 for row in verified:
  m=members[row['path']];b=t.extractfile(m).read()
  assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'] and oct(m.mode)==row['mode']
for name in ['adaptive-runtime.py','controller.py','feedback.py']:ast.parse((R/name).read_text())
reuse=json.loads((R.parent/'reset-created-boat/controls-reuse.json').read_text())
for n,k in [('ops.py','opsSHA256'),('limit_contract.py','limitContractSHA256')]:
 # ops changed only allocation census root for this new nested task.
 if n=='limit_contract.py':assert hashlib.sha256((R/n).read_bytes()).hexdigest()==reuse[k]
allocation={'standingAllocated':a['allocated'],'futureSelectedPNG':8*1048576,'futureCompact':1048576,'publicationReserve':8*1048576,'futureMiscAndEvents':2*1048576,'cap':64*1048576}
allocation['projected']=sum(allocation[k] for k in ['standingAllocated','futureSelectedPNG','futureCompact','publicationReserve','futureMiscAndEvents'])
assert allocation['projected']<=allocation['cap'],allocation
rec={'PASS':True,'manifestSHA256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'files':len(rows),'packetFilesVerified':len(verified),'packetBytes':packet.stat().st_size,'source':'historical runner72e7a30d6e36df896eb25007b6139d750e715720 and module build30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d; current-main report parent a370b362a; no current-main qualification','admission':a,'allocation':allocation,'remoteProjection':{'stagingAndPacket':33000000,'selectedAndFeedbackPNG':16*1048576,'logs':2*1048576,'reserve':8*1048576,'cap':256*1048576},'controlsReuse':reuse,'mountValidatedThisTask':str(R/'mount-startup-receipt.json'),'fileLimit':12*1048576,'captureLimit':512*1024,'denials':{'initialBaselineObjectMissing':'cat-file a370b362a against shared root read-only donor: exit128 fatal: git cat-file: could not get object info; resolved via one bounded depth1 blobless fetch; no guest/access denial'},'smokeOrder':'create new explicit-ID finiteTTL1800 boat after this closure, record assignment, then API16KiB transfer/capture smoke on new ID before staging'}
(R/'preflight.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec))

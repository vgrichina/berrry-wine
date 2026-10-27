import hashlib,json,os,resource,shutil,sys,time
from pathlib import Path
R=Path('/tmp/penguin-explicit-budget-independent-accept-oct27')
D=Path('/tmp/penguin-explicit-capture-budget-repair-oct27/repo')
pins={'tools/penguin_capture_contract.py':'efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b','test/test_penguin_capture_contract.py':'455a24b0c71f39d9544a4020ae832375260f2338ddc2785c7bfa07d0ec2baf7b','test/fixtures/penguin-wire-envelope.json':'30df71f26400cd565268c22c9a42ea159233c50ed5ee2069375a53f84a5b4066'}
for p,h in pins.items(): assert hashlib.sha256((D/p).read_bytes()).hexdigest()==h,p
src=Path('/tmp/penguin-visible-projectile-gameplay-oct27/repo/docs/re-notes/penguin-visible-projectile-gameplay-20261027/decision')
images={'b39999.png':(806077,'95112041c84196db00873e676117ac51d58562a21cabe06f5498d1f4b0504972'),'b40060.png':(811393,'de65fbced5b3e255433a7c80dfde87a956f427dbc3287aab05c8e66d1a6c5754')}
for n,(size,h) in images.items():
 p=src/n; assert p.stat().st_size==size and hashlib.sha256(p.read_bytes()).hexdigest()==h
receipt=dict(at=time.time(),candidate='7378523e65935406837a80ecd800040b660ccf1a',baseline='f78bca4820c5de96afe46d81e5583d71e39d1882',pins=pins,images=images,python=sys.executable,limits={n:resource.getrlimit(getattr(resource,'RLIMIT_'+n)) for n in ('DATA','AS','RSS','CPU','FSIZE')},admission=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/penguin-explicit-budget-independent-accept-oct27-admission.json').read_text()),initialRootRefs=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/penguin-explicit-budget-independent-accept-oct27/root-ref-digest.json').read_text()),mounts='No mount argv: offline Python source/test only; live canonical mount acceptance remains open',sourceReadOnly=True,allocated=134217728,reserve=41943040)
(R/'ops/preflight-result.json').write_text(json.dumps(receipt,indent=2));print('PASS exact source/test/envelope/original-image pins; offline only')

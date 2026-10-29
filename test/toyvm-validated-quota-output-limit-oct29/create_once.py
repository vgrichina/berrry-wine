from run_owned import *
import datetime
dispatch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-validated-quota-output-limit-oct29-dispatch.json')
d=json.loads(dispatch.read_bytes())
assert hashlib.sha256(dispatch.read_bytes()).hexdigest()=='4a9a4ec314c8dd311e0890f86a9529880535e73bde2857e24d5fd8d1c2a26a5f'
assert hashlib.sha256(pathlib.Path(d['admission']).read_bytes()).hexdigest()=='f2fd42baa0f20da5fb4188c6a8781e4802a514cf0d64c021ecd46f774afc435e'
assert hashlib.sha256((ROOT/'limit_contract.py').read_bytes()).hexdigest()==d['limitModulePin']['sha256']
for p,v in d['sourcePins'].items():assert hashlib.sha256((REPO/p).read_bytes()).hexdigest()==v['sha256']
q=json.loads((ROOT/'quota-preflight.json').read_text());assert q['PASS'] and q['quotas']==dict(live_limit=32768,write_limit=65536,file_limit=16384)
assert '8192<=live_limit<=1048576' in (REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py').read_text()
assert json.loads(pathlib.Path(d['prelaunchControls']).read_text())['PASS']
assert time.time()<datetime.datetime(2026,10,29,4,11,tzinfo=datetime.timezone.utc).timestamp()
assert not (ROOT/'create.stdout').exists()
files=[('/tmp/tvdt/repo/'+p,str(REPO/p)) for p in d['sourcePins']]+[('/tmp/tvdt/pins.json',str(ROOT/'pins.json')),('/tmp/tvdt/remote_test.py',str(ROOT/'remote_test.py')),('/tmp/tvdt/cancellation.json',d['originalCancellationReceipt'])]
argv=['/home/user/.ascii/bin/boat','--no-update','--json','new','--ttl','1800','--name','toyvm-output-limit-oct29']
for remote,local in files:argv+=['--file',remote+'='+local]
rc=run(argv,cwd=REPO,label='create')
objects=[]
for line in (ROOT/'create.stdout').read_text().splitlines():
 try:objects.append(json.loads(line))
 except ValueError:pass
def ids(x):
 if isinstance(x,dict):
  for k,v in x.items():
   if k in ('id','sandboxId','sandbox_id') and isinstance(v,str) and v.startswith('bx_'):yield v
   yield from ids(v)
 elif isinstance(x,list):
  for v in x:yield from ids(v)
boxids=set(ids(objects));assert len(boxids)==1,objects
box=next(iter(boxids));(ROOT/'box.json').write_text(json.dumps(dict(id=box,createExit=rc,cutoff='2026-10-29T04:15:00Z',shutdownOwner='this worker delegated snapshot-stop'))+'\n');print('BOX',box)
assert rc==0

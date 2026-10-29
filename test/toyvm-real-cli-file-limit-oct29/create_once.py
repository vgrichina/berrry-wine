from control import *
import datetime
d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-file-limit-oct29-dispatch.json').read_bytes())
admit('precreate')
assert hashlib.sha256((ROOT/'limit_contract.py').read_bytes()).hexdigest()==d['limitModulePin']['sha256']
for p,v in d['sourcePins'].items():assert hashlib.sha256((REPO/p).read_bytes()).hexdigest()==v['sha256'] and (REPO/p).stat().st_size==v['bytes']
assert json.loads((ROOT/'quota-preflight.json').read_bytes())['PASS']
assert json.loads((ROOT/'prelaunch-controls.json').read_bytes())['PASS']
assert json.loads((ROOT/'git-readiness.json').read_bytes())['pinsVerified']
assert time.time()<datetime.datetime(2026,10,29,4,35,tzinfo=datetime.timezone.utc).timestamp()
assert not (ROOT/'create.stdout').exists()
rc,out,err=git('identity-head',['rev-parse','HEAD']);assert rc==0 and out.decode().strip()==d['candidate']
rc,out,err=git('identity-branch',['branch','--show-current']);assert rc==0 and out.decode().strip()=='task/toyvm-real-cli-file-limit-oct29'
(ROOT/'pins.json').write_text(json.dumps(d['sourcePins'],indent=2)+'\n')
files=[('/tmp/tvfile/repo/'+p,str(REPO/p)) for p in d['sourcePins']]+[('/tmp/tvfile/pins.json',str(ROOT/'pins.json')),('/tmp/tvfile/remote_test.py',str(ROOT/'remote_test.py')),('/tmp/tvfile/cancellation.json',d['originalCancellationReceipt'])]
assert all(',' not in a+b and '=' not in a+b for a,b in files)
(ROOT/'launch-configuration.json').write_text(json.dumps(dict(ssh=SSH,guestMountArgv=[],intendedMountedFilenames=[],productionCLIParser='unchanged argparse receives actual argv; no guest mount parser invocation',boatFiles=files,socketPath='/tmp/tvfile/w/status.sock',socketBytes=25,preflightPASS=True,limitations=['Instruction/source inspections used direct shell before owned guarded supervisor; no behavioral result inferred from them.']),indent=2)+'\n')
argv=['/home/user/.ascii/bin/boat','--no-update','--json','new','--ttl','1800','--name','toyvm-file-limit-oct29']
for remote,local in files:argv+=['--file',remote+'='+local]
rc,out,err=run(argv,cwd=REPO,label='create')
objects=[]
for line in out.decode().splitlines():
 try:objects.append(json.loads(line))
 except ValueError:pass
def ids(x):
 if isinstance(x,dict):
  for k,v in x.items():
   if k in ('id','sandboxId','sandbox_id') and isinstance(v,str) and v.startswith('bx_'):yield v
   yield from ids(v)
 elif isinstance(x,list):
  for v in x:yield from ids(v)
boxids=set(ids(objects));assert len(boxids)==1
box=next(iter(boxids));(ROOT/'box.json').write_text(json.dumps(dict(id=box,createExit=rc,cutoff='2026-10-29T04:40:00Z',ttl=1800,shutdownOwner='worker explicitly delegated preservation snapshot-stop before handback'))+'\n')
print('BOX',box)
assert rc==0

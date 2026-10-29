from ops import *
import datetime
d=json.loads((E/'dispatch.json').read_text())
assert time.time()<datetime.datetime(2026,10,29,5,32,tzinfo=datetime.timezone.utc).timestamp(),'insufficient time before cutoff'
files={'/tmp/tvdr/dispatch.json':E/'dispatch.json','/tmp/tvdr/runtime-observer.py':OWN/'runtime-observer.py','/tmp/tvdr/fixture.py':OWN/'fixture.py','/tmp/tvdr/cancellation.json':pathlib.Path(d['originalCancellationReceipt'])}
for rel in d['sourcePins']:files['/tmp/tvdr/repo/'+rel]=REPO/rel
args=['/home/user/.ascii/boat','--json','new','--ttl','1800','--name','toyvm-dir-reuse-oct29']
for remote,local in files.items():args.extend(['--file',remote+'='+str(local)])
assert all(',' not in r and ',' not in str(l) and '\0' not in r and '\0' not in str(l) for r,l in files.items())
record('boat-file-argv',dict(argv=args,intendedFiles=[dict(remote=r,local=str(l),bytes=l.stat().st_size,sha256=hashlib.sha256(l.read_bytes()).hexdigest()) for r,l in files.items()],commaBearingFiles=[],guestMountArgv=[],note='Boat --file exact transfers; no guest runner mounts; actual API exec only'))
rc,out,err=run(args,cwd=OWN,name='create')
events=[json.loads(x) for x in out.splitlines() if x.startswith('{')]
ready=next(x for x in events if x.get('event')=='ready')
record('lifecycle',dict(box=ready['id'],state=ready['state'],expiry=ready['archiveAfter'],cutoff='2026-10-29T05:40:00Z',shutdownOwner='worker explicitly delegated preserve snapshot-stop and verify before handback',createEvents=events))
print(json.dumps(dict(box=ready['id'],state=ready['state'],expiry=ready['archiveAfter'],exit=rc)))
assert rc==0

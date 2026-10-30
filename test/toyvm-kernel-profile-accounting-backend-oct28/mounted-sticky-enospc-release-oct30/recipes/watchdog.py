import os,pathlib,json,subprocess,time,resource
R=pathlib.Path(__file__).resolve().parent;E=R/'evidence'
a=json.loads((E/'boat-assignment.json').read_text())
resource.setrlimit(resource.RLIMIT_FSIZE,(524288,524288))
time.sleep(max(0,a['shutdownEpoch']-time.time()))
b='/home/user/.ascii/boat'
with (E/'watchdog-stop.stdout').open('wb') as out,(E/'watchdog-stop.stderr').open('wb') as err:
 q=subprocess.run([b,'--no-update','--json','stop',a['id']],cwd=R,stdout=out,stderr=err,timeout=90)
assert q.returncode==0
for n in range(8):
 q=subprocess.run([b,'--no-update','--json','info',a['id']],cwd=R,capture_output=True,timeout=30)
 assert q.returncode==0 and len(q.stdout)+len(q.stderr)<=524288
 v=[json.loads(l) for l in q.stdout.decode().splitlines()][-1]['sandbox']
 (E/'watchdog-lifecycle.json').write_text(json.dumps(v))
 if v['state']=='stopped' and v.get('lastSnapshotStatus')=='completed' and v.get('snapshotAvailable') and v.get('stop',{}).get('status')=='completed':break
 time.sleep(2)
else:raise RuntimeError('snapshot-stop not completed')

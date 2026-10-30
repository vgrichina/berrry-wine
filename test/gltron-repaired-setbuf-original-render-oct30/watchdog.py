from control import *
a=json.loads((E/'boat-assignment.json').read_text())
while not (E/'lifecycle-proof.json').exists():
 remaining=a['shutdownEpoch']-time.time()
 if remaining<=0:break
 time.sleep(min(20,remaining))
else:raise SystemExit(0)
native(['stop',a['id']],'watchdog-stop',wall=90)
for n in range(8):
 v=native(['info',a['id']],'watchdog-info-'+str(n))[-1]['sandbox']
 if v['state']=='stopped' and v.get('snapshotAvailable') and v.get('lastSnapshotStatus')=='completed' and v.get('stop',{}).get('status')=='completed':
  save('watchdog-lifecycle.json',v);break
 time.sleep(2)
else:raise RuntimeError('actual snapshot-stop not verified')

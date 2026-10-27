import json,pathlib,time,sys
import run as c
H=c.H
# Read-only supported execution, no guest, staging or lifecycle changes.
code="import json,os,time;print(json.dumps(dict(probe='bounded response latency',cwd=os.getcwd(),payload='A'*7000)))"
for i in range(3):
 prior=sum(p.stat().st_size for p in H.glob('api-*.stdout'))
 assert prior+8192+1048576<=8388608
 c.dump('api-reservation-'+str(i)+'.json',dict(previousRawBytes=prior,pendingReserved=8192,cleanupReserved=1048576,limit=8388608))
 sys.argv=['run','api','api-probe-'+str(i),'/home/user/.ascii/boat','exec','--json','--timeout','20','bx_ffsw74qe','python3','-B','-c',code]
 before=time.monotonic();c.main();elapsed=time.monotonic()-before
 raw=(H/('api-probe-'+str(i)+'.stdout')).read_bytes();q=json.loads(raw)
 assert len(raw)<=8192 and q.get('exitCode')==0 and not q.get('stdoutTruncated') and not q.get('stderrTruncated')
 c.dump('latency-'+str(i)+'.json',dict(seconds=elapsed,rawBytes=len(raw),payloadBytes=7000,guest=False))
 print('measured roundtrip',i,elapsed,len(raw))

import pathlib,json,time,base64,shlex,sys,math
from api import api
O=pathlib.Path(__file__).parent
plan=json.loads((O/'transfer-plan.json').read_text());index=int(sys.argv[1]);g=plan['groups'][index]
R='/home/user/wineops-gta2-causal-trace-oct27';remote=R+'/group-'+str(index)+'.tar.gz'
start=time.monotonic();requests=0
with (O/('group-'+str(index)+'.tar.gz')).open('rb') as f:
 while True:
  b=f.read(22500)
  if not b:break
  code='import pathlib,base64;p=pathlib.Path('+repr(remote)+');f=p.open('+repr('xb' if requests==0 else 'ab')+');f.write(base64.b64decode('+repr(base64.b64encode(b).decode())+'));f.close();print("ok")'
  api('python3 -c '+shlex.quote(code));requests+=1
code='import pathlib,hashlib,tarfile;p=pathlib.Path('+repr(remote)+');h=hashlib.sha256();\nwith p.open("rb") as f:\n while b:=f.read(65536):h.update(b)\nassert h.hexdigest()=='+repr(g['gzipSHA256'])+'\nwith tarfile.open(p,"r|gz") as t:\n for m in t:\n  assert m.isfile() and not m.name.startswith("/") and ".." not in pathlib.Path(m.name).parts\n  t.extract(m,'+repr(R+'/repo')+',filter="data")\np.unlink();print("extracted")'
api('python3 -c '+shlex.quote(code));requests+=1
seconds=time.monotonic()-start
v=dict(group=index,seconds=seconds,requests=requests,bytes=g['gzipBytes'],secondsPerRequest=seconds/requests,remainingRequests=sum(q['requests']+1 for q in plan['groups'][index+1:]),at=time.time())
v['projectedRemainingSeconds']=v['remainingRequests']*v['secondsPerRequest']
v['stagingDeadline']=1793109180
v['timePass']=v['at']+v['projectedRemainingSeconds']+60<v['stagingDeadline']
(O/('transfer-'+str(index)+'.json')).write_text(json.dumps(v,indent=2))
print(json.dumps(v))

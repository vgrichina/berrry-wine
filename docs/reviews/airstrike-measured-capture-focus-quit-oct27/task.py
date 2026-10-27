import sys,pathlib,json,hashlib,base64,zlib,subprocess,time,os,tarfile,threading
import run as c
H,R=c.H,c.R;REMOTE='/tmp/airstrike-measured-capture-focus-quit-oct27';BOX='bx_ffsw74qe';API_LIMIT=8*1048576
def api(code,label,args=(),detach=False,terminal=False):
 d=H/'api';d.mkdir(exist_ok=True)
 # Reserve full pending raw envelope BEFORE execution, no cap resets.
 with open(H/'api-ledger.lock','a') as lock:
  c.fcntl.flock(lock,c.fcntl.LOCK_EX)
  ledger=H/'api-ledger.json';q=json.loads(ledger.read_text()) if ledger.exists() else dict(charged=0,pending={},limit=API_LIMIT,reserve=1048576)
  if not q.get('priorProbeCharged'):
   q['charged']+=sum(p.stat().st_size for p in H.glob('api-probe-*.std*'));q['priorProbeCharged']=True
  assert label not in q['pending'] and not (d/(label+'.stdout')).exists()
  assert q['charged']+sum(q['pending'].values())+8192+(0 if terminal else q['reserve'])<=API_LIMIT,'API reserve exhausted'
  q['pending'][label]=8192;ledger.write_text(json.dumps(q))
 cmd=['/home/user/.ascii/boat','exec','--json']+(['--detach'] if detach else ['--timeout','20'])+[BOX,'python3','-B','-c',code,*args]
 (d/(label+'.command.json')).write_text(json.dumps(dict(argvPrefix=cmd[:8],commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),codeSHA256=hashlib.sha256(code.encode()).hexdigest(),argumentBytes=[len(a.encode()) for a in args],at=time.time())))
 with (d/(label+'.stdout')).open('wb') as out,(d/(label+'.stderr')).open('wb') as err:
  p=subprocess.run(cmd,stdout=out,stderr=err,timeout=110)
 raw=(d/(label+'.stdout')).read_bytes();stderr=(d/(label+'.stderr')).read_bytes()
 with open(H/'api-ledger.lock','a') as lock:
  c.fcntl.flock(lock,c.fcntl.LOCK_EX);q=json.loads(ledger.read_text());q['charged']+=len(raw)+len(stderr);q['pending'].pop(label);ledger.write_text(json.dumps(q))
 assert len(raw)+len(stderr)<=8192 and p.returncode==0,(label,p.returncode,stderr[:1000])
 q=json.loads(raw);assert not q.get('stdoutTruncated') and not q.get('stderrTruncated'),label
 if not detach:assert q.get('exitCode')==0,(label,q)
 return q if detach else q['stdout']
def sendfiles(rows,label):
 assert len(rows)<=40
 code='''import sys,pathlib,json,zlib,base64,hashlib
R=pathlib.Path(sys.argv[1]);rows=json.loads(zlib.decompress(base64.b64decode(sys.argv[2])));n=0
for x in rows:
 p=R/x['target'];p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode(x['data']);assert hashlib.sha256(b).hexdigest()==x['sha256'];p.write_bytes(b);n+=len(b)
print(json.dumps(dict(files=len(rows),bytes=n)))'''
 encoded=base64.b64encode(zlib.compress(json.dumps(rows).encode())).decode()
 if len(encoded)<=50000:return api(code,label,[REMOTE,encoded])
 pack=REMOTE+'/transfer-'+label+'.pack'
 for n in range(0,len(encoded),50000):api('import pathlib,sys;p=pathlib.Path(sys.argv[1]);p.parent.mkdir(parents=True,exist_ok=True);f=p.open(sys.argv[2]);f.write(sys.argv[3]);f.close();print(p.stat().st_size)',label+'-chunk-'+str(n),[pack,'w' if n==0 else 'a',encoded[n:n+50000]])
 value=api(code.replace('sys.argv[2]',"pathlib.Path(sys.argv[2]).read_text()"),label,[REMOTE,pack]);api('import pathlib,sys;pathlib.Path(sys.argv[1]).unlink();print("removed")',label+'-pack-clean',[pack]);return value
def payload(target,b):return dict(target=target,sha256=hashlib.sha256(b).hexdigest(),data=base64.b64encode(b).decode())
def source(x,t):
 if x.get('gitRevision')=='097f3b2904d833ca8fb152e686032c156c16e39a':return (pathlib.Path('/tmp/airstrike-portable-fixtures-accepted-main-integration-oct27/repo')/x['source']).read_bytes()
 return t.extractfile(x['source']).read() if x['kind']=='git' else pathlib.Path(x['source']).read_bytes()
def main():
 mode=sys.argv[1];rows=json.loads((H/'runtime-map.json').read_text())['files']
 if mode=='verify':
  with tarfile.open('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar') as t:
   for x in rows:
    b=source(x,t);assert len(b)==x['bytes'] and hashlib.sha256(b).hexdigest()==x['sha256'],x['source']
  c.dump('immutable-closure-pass.json',dict(files=len(rows),bytes=sum(x['bytes'] for x in rows),sha256=hashlib.sha256((H/'runtime-map.json').read_bytes()).hexdigest(),allPinsPass=True));print('all immutable sources PASS',len(rows))
 elif mode=='stage':
  start=int(sys.argv[2]);items=[]
  with tarfile.open('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/git-sources.tar') as t:
   for x in rows[start:start+40]:
    b=source(x,t);assert hashlib.sha256(b).hexdigest()==x['sha256'];items.append(payload(x['target'],b))
  print(sendfiles(items,'stage-'+str(start)+(sys.argv[3] if len(sys.argv)>3 else '')))
 elif mode=='extras':
  names=('remote.py','runtime-map.json','startup.cjs','abi-preload.cjs') if len(sys.argv)<3 else (('remote.py',) if sys.argv[2]=='-launcher-corrected' else ('startup.cjs',))
  items=[payload('ops/'+n,(H/n).read_bytes()) for n in names]
  if len(sys.argv)<3:items.append(payload('ops/supervisor.py',c.S.read_bytes()))
  print(sendfiles(items,'extras'+(sys.argv[2] if len(sys.argv)>2 else '')))
 elif mode=='call':print(api(sys.argv[2],sys.argv[3],sys.argv[4:]))
 elif mode=='launch':print(api('import os;os.execv("/usr/bin/python3",["python3","-B",'+repr(REMOTE+'/ops/remote.py')+',"run"])','launch'+(sys.argv[2] if len(sys.argv)>2 else ''),detach=True))
if __name__=='__main__':main()

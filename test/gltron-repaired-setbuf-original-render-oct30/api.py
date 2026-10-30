from control import *
import base64,concurrent.futures,threading,datetime,tarfile,traceback
A=None;watch=None;lock=threading.Lock();journal=[]
REMOTE='/home/user/gltron-render'
def epoch(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def api(code,label,timeout=30,cwd='/home/user',record=True):
 assert A and time.time()<A['shutdownEpoch']
 argv=[B,'--no-update','--json','exec','--cwd',cwd,'--timeout',str(timeout),A['id'],'--','/usr/bin/python3','-B','-c',code]
 assert sum(len(x.encode())+1 for x in argv)+1024<=16384
 assert not (E/(label+'.json')).exists(),label
 start=time.time();q=subprocess.Popen(argv,cwd=R,env=dict(os.environ,BOAT_NO_UPDATE='1'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);sel=selectors.DefaultSelector();out=bytearray();err=bytearray();sel.register(q.stdout,selectors.EVENT_READ,out);sel.register(q.stderr,selectors.EVENT_READ,err);bad=None
 while sel.get_map() or q.poll() is None:
  for k,_ in sel.select(.04):
   b=os.read(k.fileobj.fileno(),4096)
   if not b:sel.unregister(k.fileobj);continue
   room=max(0,16384-len(out)-len(err));k.data.extend(b[:room])
   if len(b)>room:bad='API response overflow'
  if time.time()-start>timeout+15:bad='API wall'
  if bad:
   try:os.killpg(q.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   q.wait();break
 q.wait();sel.close();assert not bad,(label,bad)
 assert q.returncode==0,(label,q.returncode,err.decode(errors='replace')[:1500],out.decode(errors='replace')[:1500])
 v=[json.loads(x) for x in out.decode().splitlines()][-1]
 rec=dict(label=label,request=pin(code.encode()),response=pin(bytes(out)),elapsed=time.time()-start,exit=v.get('exitCode'),success=v.get('success'),responseBytes=len(out))
 with lock:journal.append(rec)
 if record:save(label+'.json',dict(receipt=rec,response=v))
 assert v.get('success') is True and v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),(label,v)
 return v['stdout']
def transfer(p,rel):
 b=p.read_bytes();dest=REMOTE+'/'+rel
 for off in range(0,len(b),6000):
  raw=b[off:off+6000];code='import pathlib,base64;p=pathlib.Path('+repr(dest)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(raw).decode())+');f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(b);f.close();assert p.stat().st_size=='+str(off+len(raw))
  api(code,'transfer-'+rel.replace('/','_')+'-'+str(off),record=False)
 return dict(path=rel,**pin(b))

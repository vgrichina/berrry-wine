#!/usr/bin/python3
"""Exact production serve on private duplex pipe (unnamed socketpair).
No direct handle call, mount, adapter, guest or historical suite execution.
All forked child work remains in the ops.py process group and inherited limits.
"""
import errno, hashlib, importlib.util, json, os, pathlib, select, signal, socket
import stat, struct, sys, threading, time
BASE=pathlib.Path('/tmp/toyvm-seven-guards-production-serve-wire-oct29')
OUT=BASE/'repo/test/toyvm-seven-guards-production-serve-wire-oct29'
SOURCE=BASE/'repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
P=lambda fmt,*args:struct.pack('<'+fmt,*args)
U=lambda fmt,data,off=0:struct.unpack_from('<'+fmt,data,off)
CONTROL="            if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.EISDIR,'unlink directory')"

def exact(sock,n):
 out=b''
 while len(out)<n:
  if not select.select([sock],[],[],3)[0]:raise TimeoutError('private wire read')
  part=sock.recv(n-len(out))
  if not part:raise EOFError('short reply')
  out+=part
 return out

def snapshot(b):
 return dict(nodes={str(i):{k:(bytes(v).hex() if k=='data' else {n.hex():j for n,j in v.items()} if k=='names' else v) for k,v in n.items()} for i,n in b.nodes.items()},next=b.next,state=b.state())

class Fixture:
 def __init__(self,variant):
  self.variant=variant;self.trace=[];self.seq=0;self.reaped=False
  self.wire,child=socket.socketpair();self.obs,observer=socket.socketpair()
  self.status=BASE/('s-'+variant)
  assert not self.status.exists()
  self.pid=os.fork()
  if self.pid==0:
   self.wire.close();self.obs.close()
   try:
    source=SOURCE.read_text()
    if variant=='control':
     assert source.count(CONTROL)==1
     source=source.replace(CONTROL,'            # private control: removed UNLINK directory type guard',1)
    namespace={'__name__':'private_backend','__file__':str(SOURCE)}
    exec(compile(source,str(SOURCE),'exec'),namespace)
    b=namespace['Backend'](BASE/'fixture-root',live_limit=262144,write_limit=65536,file_limit=16384)
    b.fd=child.detach()
    def observe():
     while observer.recv(1):
      data=json.dumps(snapshot(b),sort_keys=True).encode()
      observer.sendall(P('I',len(data))+data)
    threading.Thread(target=observe,daemon=True).start()
    b.serve(self.status)
    observer.close();os._exit(0)
   except BaseException:
    import traceback;traceback.print_exc();os._exit(1)
  child.close();observer.close()
 def snap(self):
  self.obs.sendall(b'?');n=U('I',exact(self.obs,4))[0]
  return json.loads(exact(self.obs,n))
 def request(self,label,op,ino=1,data=b'',expected=0):
  before=self.snap();self.seq+=1
  raw=P('2I2Q4I',40+len(data),op,self.seq,ino,os.getuid(),os.getgid(),os.getpid(),0)+data
  self.wire.sendall(raw)
  header=exact(self.wire,16);length,error,unique=U('IiQ',header)
  assert 16<=length<=131072 and unique==self.seq,(label,header.hex())
  body=exact(self.wire,length-16);after=self.snap()
  record=dict(label=label,request=raw.hex(),reply=(header+body).hex(),expected=-expected,actual=error)
  self.trace.append(record)
  assert error==-expected,(label,'errno',-expected,error)
  assert after['state']['operations']==before['state']['operations']+1,label
  if expected:
   assert not body,(label,'error payload')
   before['state'].pop('operations');after['state'].pop('operations')
   assert before==after,(label,'rejected mutation changed namespace/accounting')
   # Positive dispatch after every rejection; invariant operations is separate.
   self.request(label+' positive GETATTR',3)
  return body
 def mkdir(self,parent,name):
  return U('Q',self.request('MKDIR '+name.decode(),9,parent,P('2I',0o700,0)+name+b'\0'))[0]
 def create(self,parent,name):
  return U('Q',self.request('CREATE '+name.decode(),35,parent,P('4I',0,0o600,0,0)+name+b'\0'))[0]
 def rename(self,parent,old,newparent,new,expected=0,op=12):
  return self.request('RENAME '+old.decode()+' -> '+new.decode(),op,parent,P('Q',newparent)+(P('2I',0,0) if op==45 else b'')+old+b'\0'+new+b'\0',expected)
 def close(self):
  self.wire.shutdown(socket.SHUT_WR)
  deadline=time.monotonic()+3
  while time.monotonic()<deadline:
   pid,status=os.waitpid(self.pid,os.WNOHANG)
   if pid:
    self.reaped=True;self.exit=os.waitstatus_to_exitcode(status);break
   time.sleep(.01)
  if not self.reaped:
   os.kill(self.pid,signal.SIGKILL);os.waitpid(self.pid,0);self.reaped=True;self.exit='timeout-killed'
  self.wire.close();self.obs.close()
  if self.status.exists():self.status.unlink()
  assert self.exit==0,('child exit',self.exit)

def suite(f):
 init=f.request('INIT 7.31',26,data=P('2I',7,31))
 assert U('2I',init)==(7,31)
 f.request('positive root GETATTR',3)
 a=f.mkdir(1,b'a');b=f.mkdir(a,b'b');file=f.create(1,b'file');empty=f.mkdir(1,b'empty')
 # Earliest relevant boundary: UNLINK directory must produce EISDIR and no changes.
 f.request('UNLINK directory type guard',10,1,b'empty\0',errno.EISDIR)
 f.rename(1,b'file',1,b'empty',errno.EISDIR)
 f.rename(1,b'empty',1,b'file',errno.ENOTDIR,45)
 f.rename(1,b'a',b,b'cycle',errno.EINVAL)
 f.rename(1,b'a',a,b'self',errno.EINVAL,45)
 f.rename(1,b'file',999,b'x',errno.ENOENT)
 f.rename(999,b'file',1,b'x',errno.ENOENT)
 f.rename(1,b'file',file,b'x',errno.ENOTDIR,45)
 f.rename(file,b'file',1,b'x',errno.ENOTDIR)
 for old,new in [(b'.',b'x'),(b'file',b'..'),(b'file',b'x/y'),(b'file',b'')]:
  f.rename(1,old,1,new,errno.EINVAL)
 f.rename(1,b'empty',1,b'a',errno.ENOTEMPTY)
 f.request('RMDIR file type guard',11,1,b'file\0',errno.ENOTDIR)
 f.request('RMDIR nonempty guard',11,1,b'a\0',errno.ENOTEMPTY)
 f.request('UNLINK missing',10,1,b'absent\0',errno.ENOENT)
 for op,head in [(9,P('2I',0o700,0)),(35,P('4I',0,0o600,0,0))]:
  for parent,name,err in [(999,b'x',errno.ENOENT),(file,b'x',errno.ENOTDIR),(1,b'.',errno.EINVAL),(1,b'..',errno.EINVAL),(1,b'x/y',errno.EINVAL),(1,b'',errno.EINVAL),(1,b'x'*256,errno.EINVAL)]:
   f.request('parent/name guard '+str(op)+' '+str(parent)+' '+repr(name[:10]),op,parent,head+name+b'\0',err)
 # SETATTR unknown flags + size simultaneously: rejection must precede resize.
 f.request('SETATTR rejected flags atomicity',4,file,P('IIQQ',8|2048,0,0,4097),errno.EOPNOTSUPP)
 f.request('SETATTR valid growth',4,file,P('IIQQ',8,0,0,3))
 f.request('SETATTR rejected flags after growth',4,file,P('IIQQ',8|2048,0,0,8000),errno.EOPNOTSUPP)
 f.rename(1,b'file',a,b'moved',op=45)
 f.rename(1,b'empty',1,b'renamed')
 # READDIR parent identity before and after moving nested directories.
 def readdir(ino,parent):
  raw=f.request('READDIR parent identity',28,ino,P('2QI',ino,0,4096));entries={};off=0
  while off<len(raw):
   child,cookie,n,kind=U('2Q2I',raw,off);name=raw[off+24:off+24+n];entries[name]=child;off+=(24+n+7)//8*8
  assert entries[b'.']==ino and entries[b'..']==parent,entries
 readdir(b,a);readdir(a,1)
 f.rename(a,b'b',1,b'newb');readdir(b,1)
 f.request('positive RMDIR after rejection',11,1,b'renamed\0')
 f.request('positive UNLINK after rejection',10,a,b'moved\0')
 f.request('positive RELEASE deleted file',18,file,P('Q',file))
 f.request('final root GETATTR',3)

if __name__=='__main__':
 variant=sys.argv[1];f=Fixture(variant);failure=None
 try:suite(f)
 except BaseException as e:failure=repr(e)
 finally:
  try:f.close()
  except BaseException as e:failure=(failure or '')+' '+repr(e)
 result=dict(variant=variant,passed=failure is None,failure=failure,requests=len(f.trace),trace=f.trace,childPid=f.pid,childReaped=f.reaped,childExit=f.exit,sourceSHA256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),controlRemoved=CONTROL if variant=='control' else None)
 (OUT/(variant+'-results.json')).write_text(json.dumps(result,indent=2))
 print(json.dumps({k:v for k,v in result.items() if k!='trace'}))
 if variant=='candidate':sys.exit(0 if failure is None else 1)
 assert failure and 'UNLINK directory type guard' in failure and "'errno', -21, 0" in failure,result

"""Independent bounded local acceptance. Never mounts or launches the backend."""
import copy, errno, gc, hashlib, json, os, pathlib, selectors, socket, struct, threading, types
HERE=pathlib.Path(__file__).resolve().parent
SOURCE=HERE.parent/"toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py"
PIN="75842ffafd6ebd0c29fa2889a463bfd6f5245634096f4dfef9a3fd69f703e822"
S=SOURCE.read_text()
assert hashlib.sha256(S.encode()).hexdigest()==PIN
P=lambda fmt,*v:struct.pack("<"+fmt,*v)
def load(text):
 m=types.ModuleType("independent_private_backend")
 exec(compile(text,str(SOURCE),"exec"),m.__dict__)
 return m
def identity(fd):
 st=os.fstat(fd);return (st.st_dev,st.st_ino,st.st_mode)
def transport(text,kind):
 m=load(text); owned=[]; held=[]; errors=[]; witness=[]; selected=threading.Event()
 class Listener(socket.socket):
  def __init__(self,*a,**kw):
   super().__init__(*a,**kw);owned.append(("listener",self.fileno(),identity(self.fileno())));held.append(self)
 class Selector(selectors.DefaultSelector):
  def __init__(self):
   super().__init__();owned.append(("selector",self.fileno(),identity(self.fileno())));held.append(self)
  def select(self,timeout=None):
   events=super().select(timeout)
   if any(isinstance(k.fileobj,Listener) for k,v in events):selected.set()
   return events
 m.socket=types.SimpleNamespace(socket=Listener,AF_UNIX=socket.AF_UNIX)
 m.selectors=types.SimpleNamespace(DefaultSelector=Selector,EVENT_READ=selectors.EVENT_READ)
 wire,peer=socket.socketpair();wire.settimeout(2);peer.settimeout(2)
 borrowed=[(x.fileno(),identity(x.fileno())) for x in (wire,peer)]
 b=m.Backend(str(HERE));b.fd=os.dup(wire.fileno());owned.append(("backend",b.fd,identity(b.fd)))
 path=pathlib.Path("test/toyvm-seven-guards-selector-independent-accept-oct29")/(".transport-"+kind)
 assert not path.exists()
 disabled=not gc.isenabled();gc.disable()
 def run():
  try:b.serve(path)
  except BaseException as ex:errors.append(ex) # retained traceback intentionally roots serve locals
 t=threading.Thread(target=run,daemon=True)
 try:
  t.start()
  # Wait on actual bind/listen readiness without treating pathname existence as evidence.
  import time
  deadline=time.monotonic()+2
  while not path.exists() and t.is_alive() and time.monotonic()<deadline:time.sleep(.002)
  with socket.socket(socket.AF_UNIX) as probe:
   probe.settimeout(2);probe.connect(str(path));payload=probe.recv(4096)
  state=json.loads(payload);assert state==b.state(),"listener state witness"
  assert selected.wait(1),"listener was never selected"
  # First dispatch is INIT through the exact production serve, before the cleanup trigger.
  init=P("2I",7,31)
  peer.sendall(P("2I2Q4I",40+len(init),26,101,1,0,0,0,0)+init)
  answer=peer.recv(4096)
  assert struct.unpack_from("<IiQ",answer)==(len(answer),0,101)
  assert struct.unpack_from("<2I",answer,16)==(7,31)
  witness.append("listener selected and returned exact state; INIT reply validated")
  if kind=="eof":peer.shutdown(socket.SHUT_WR)
  else:
   peer.shutdown(socket.SHUT_RD)
   peer.sendall(P("2I2Q4I",40+len(init),26,102,1,0,0,0,0)+init)
  t.join(2);assert not t.is_alive(),"serve did not finish"
  assert not gc.isenabled()
  if kind=="eof":assert not errors,repr(errors)
  else:assert len(errors)==1 and isinstance(errors[0],BrokenPipeError) and errors[0].errno==errno.EPIPE,repr(errors)
  checks=[]
  for name,fd,original in owned:
   try:now=identity(fd)
   except OSError as ex:assert ex.errno==errno.EBADF;checks.append(name+":EBADF")
   else:raise AssertionError(("owned descriptor survived",kind,name,fd,original,now))
  for fd,original in borrowed:assert identity(fd)==original,"borrowed fd changed"
  assert wire.getsockopt(socket.SOL_SOCKET,socket.SO_TYPE)==socket.SOCK_STREAM
  assert peer.getsockopt(socket.SOL_SOCKET,socket.SO_TYPE)==socket.SOCK_STREAM
  return dict(kind=kind,witness=witness,ownedBeforeFixtureCleanup=checks,borrowedIdentitiesPreserved=True,GCDisabled=True,retainedExceptions=len(errors),retainedObjects=len(held))
 finally:
  if t.is_alive():peer.shutdown(socket.SHUT_WR);t.join(2)
  # Explicit fixture cleanup happens only AFTER the oracle above, including for mutants.
  for obj in held:obj.close()
  for name,fd,original in owned:
   try:
    if identity(fd)==original:os.close(fd)
   except OSError as ex:assert ex.errno==errno.EBADF
  wire.close();peer.close()
  if path.exists():path.unlink()
  if not disabled:gc.enable()

def interactions(text):
 m=load(text);b=m.Backend(str(HERE),262144,262144,65536);log=[]
 def send(op,ino=1,data=b"",expected=None,label="valid"):
  prior=copy.deepcopy(vars(b));result=None;got=None
  try:result=b.handle(op,ino,data)
  except OSError as ex:got=ex.errno
  if expected is None:assert got is None,(label,"unexpected errno",got)
  else:
   assert got==expected,(label,"errno",got,expected)
   after=copy.deepcopy(vars(b));assert after.pop("operations")==prior.pop("operations")+1
   assert after==prior,(label,"state changed on rejection")
  log.append(dict(label=label,op=op,errno=got));return result
 def mkdir(parent,name):
  r=send(9,parent,P("2I",0o700,0)+name+b"\0");return struct.unpack_from("<Q",r)[0]
 def create(parent,name):
  r=send(35,parent,P("4I",0,0o600,0,0)+name+b"\0");return struct.unpack_from("<Q",r)[0]
 def rename(parent,old,dest,new,op=12):return P("Q",dest)+(P("2I",0,0) if op==45 else b"")+old+b"\0"+new+b"\0"
 def pulse(ino,n):
  data=("after-reject-"+str(n)).encode()
  send(16,ino,P("2QI",ino,0,len(data))+bytes(20)+data)
  assert send(15,ino,P("2QI",ino,0,len(data)))==data
  send(1,1,b"file\0")
 def reject(label,op,ino,data,err,n):send(op,ino,data,err,label);pulse(file,n)
 init=send(26,1,P("2I",7,31));assert struct.unpack_from("<2I",init)==(7,31)
 directory=mkdir(1,b"dir");file=create(1,b"file");child=mkdir(directory,b"child")
 reject("create-parent-type",35,file,P("4I",0,0o600,0,0)+b"bad\0",errno.ENOTDIR,1)
 reject("unlink-directory",10,1,b"dir\0",errno.EISDIR,2)
 reject("rmdir-file",11,1,b"file\0",errno.ENOTDIR,3)
 reject("replace-directory-with-file",12,1,rename(1,b"file",1,b"dir"),errno.EISDIR,4)
 reject("replace-file-with-directory",45,1,rename(1,b"dir",1,b"file",45),errno.ENOTDIR,5)
 reject("directory-cycle",12,1,rename(1,b"dir",child,b"cycle"),errno.EINVAL,6)
 for n,(parent,dest,err) in enumerate([(999,1,errno.ENOENT),(1,999,errno.ENOENT),(file,1,errno.ENOTDIR),(1,file,errno.ENOTDIR)],7):
  reject("rename-parent-"+str(n),12,parent,rename(parent,b"file",dest,b"moved"),err,n)
 # Successful namespace transformations and open orphan lifecycle after all rejected changes.
 send(12,directory,rename(directory,b"child",1,b"child"))
 listing=send(28,child,P("2QI",child,0,4096))
 assert struct.unpack_from("<Q",listing,32)[0]==1,"READDIR parent after move"
 send(45,1,rename(1,b"child",directory,b"returned",45))
 send(11,directory,b"returned\0");send(11,1,b"dir\0")
 send(10,1,b"file\0");assert file in b.nodes and b.nodes[file]["links"]==0
 assert send(15,file,P("2QI",file,0,64)).startswith(b"after-reject-")
 send(18,file,P("Q",file));assert set(b.nodes)=={1} and b.live==4096 and b.handles==0 and b.failure is None
 return dict(trace=log,rejected=sum(x["errno"] is not None for x in log),finalState=b.state())

def main():
 results={"backendSHA256":PIN}
 # Exact local dispatch boundary first, then broader handle interactions.
 results["transport"]=[transport(S,k) for k in ("eof","epipe")]
 results["interactions"]=interactions(S)
 # Text spans are exact production private guard removals, never written to source.
 removals=[
 ("create-parent-type","        if not stat.S_ISDIR(n['mode']):raise OSError(errno.ENOTDIR,'parent non-directory')"),
 ("unlink-directory","            if op==10 and stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.EISDIR,'unlink directory')"),
 ("rmdir-file","            if op==11 and not stat.S_ISDIR(self.nodes[child]['mode']):raise OSError(errno.ENOTDIR,'rmdir non-directory')"),
 ("replace-directory-with-file","                if not source_is_dir and dest_is_dir:raise OSError(errno.EISDIR,'replacement is directory')"),
 ("replace-file-with-directory","                if source_is_dir and not dest_is_dir:raise OSError(errno.ENOTDIR,'replacement is not directory')"),
 ("directory-cycle","                    if child==newdir:raise OSError(errno.EINVAL,'rename directory cycle')"),
 ("rename-parent-missing","                if parent not in self.nodes:raise OSError(errno.ENOENT,'rename parent missing')"),
 ("rename-parent-type","                if not stat.S_ISDIR(self.nodes[parent]['mode']):raise OSError(errno.ENOTDIR,'rename parent not directory')")]
 controls=[]
 for label,line in removals:
  assert S.count(line)==1,("mutant span",label)
  try:interactions(S.replace(line,""))
  except (AssertionError,KeyError) as ex:controls.append(dict(guard=label,detected=True,reason=str(ex)))
  else:raise AssertionError(("undetected guard removal",label))
 results["guardControls"]=controls
 mutant=S.replace("sel.close()","pass # private no-close control").replace("if control is not None:control.close()","if control is not None:pass").replace("os.close(self.fd)","pass # private no-close control")
 controls=[]
 for kind in ("eof","epipe"):
  try:transport(mutant,kind)
  except AssertionError as ex:
   assert "owned descriptor survived" in str(ex);controls.append(dict(kind=kind,detected=True,reason=str(ex)))
  else:raise AssertionError("no-close mutant passed")
 results["noCloseControls"]=controls;results["PASS"]=True
 (HERE/"results.json").write_text(json.dumps(results,indent=2)+"\n")
 print(json.dumps({k:v for k,v in results.items() if k!="interactions"}));print("operations",len(results["interactions"]["trace"]))
if __name__=="__main__":main()

"""Independent source-loader and real epoll/local-wire lifetime acceptance.
No adapter invocation, mounts, candidate oracle, historical suite, or children.
"""
import errno,hashlib,importlib.util,json,marshal,os,pathlib,selectors,socket,struct,sys,tempfile,threading,time
from verify_inputs import TASK,REPO,OUT,DISPATCH,pin
D=json.loads(DISPATCH.read_text())
CALLER=REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
ADAPTER=REPO/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py'
BACKEND=ADAPTER.with_name('fuse_backend.py')
RESULT={'status':'RUNNING','sourcePinsBefore':{},'loader':{},'wire':[],'mutant':None}

def module(path,name,source=None):
 spec=importlib.util.spec_from_file_location(name,path)
 m=importlib.util.module_from_spec(spec)
 exec(compile(path.read_bytes() if source is None else source,str(path),'exec',dont_inherit=True),m.__dict__)
 return m

def sources():
 for n,wanted in D['sourcePins'].items():assert pin(REPO/n)==wanted,n
 return {n:pin(REPO/n) for n in D['sourcePins']}

def exact_exception(call,kind,message=None,number=None):
 try:call()
 except BaseException as e:
  assert type(e) is kind,(type(e),str(e))
  if message is not None:assert str(e)==message,str(e)
  if number is not None:assert e.errno==number,(e.errno,number)
  return {'type':type(e).__name__,'message':str(e),'errno':getattr(e,'errno',None)}
 raise AssertionError('expected '+kind.__name__)

def loader():
 # Earliest production boundary, before any wire test.
 c=module(CALLER,'independent_exact_caller');f=c.load_backend()
 assert f.__name__=='supervise_accounted'
 expected=module(ADAPTER,'independent_donor_comparison').supervise_accounted
 assert marshal.dumps(f.__code__)==marshal.dumps(expected.__code__)
 g=f.__globals__
 assert f.__code__.co_filename==str(ADAPTER)
 assert g['__file__']==str(ADAPTER) and g['__spec__'].origin==str(ADAPTER)
 assert g['__name__']=='accepted_accounted_adapter' and g['HERE']==ADAPTER.parent
 assert g['PIN']==D['sourcePins']['test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py']['sha256']
 assert g['subprocess'].__name__=='subprocess' and g['os'] is os
 assert set(c.BACKEND_PINS)=={n.removeprefix('test/') for n in D['sourcePins'] if n!=str(CALLER.relative_to(REPO))}
 stale=module(CALLER,'independent_stale_caller',(TASK/'inputs/candidate-tests/baseline-caller.py').read_bytes())
 stale.ROOT=REPO
 stale_error=exact_exception(stale.load_backend,RuntimeError,'accepted backend identity mismatch: toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py')
 # An audit hook observes any execution from a tampered private dependency.
 # The exact caller is compiled before arming; rejection must execute none.
 audit={'armed':False,'events':[],'root':None}
 def hook(event,args):
  if audit['armed'] and event=='exec' and str(args[0].co_filename).startswith(audit['root']):
   audit['events'].append(args[0].co_filename)
 sys.addaudithook(hook)
 rejected=[]
 with tempfile.TemporaryDirectory(prefix='loader-',dir=TASK) as t:
  root=pathlib.Path(t)
  for relative in c.BACKEND_PINS:
   for name in D['sourcePins']:
    target=root/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((REPO/name).read_bytes())
   target=root/'test'/relative
   target.write_bytes(target.read_bytes()+b"\nraise AssertionError('TAMPER_EXECUTED')\n")
   private_c=module(root/CALLER.relative_to(REPO),'private_exact_caller')
   audit.update(armed=True,events=[],root=str(root))
   try:err=exact_exception(private_c.load_backend,RuntimeError,'accepted backend identity mismatch: '+relative)
   finally:audit['armed']=False
   assert audit['events']==[],audit['events']
   rejected.append({'relative':relative,'error':err,'dependencyExecEvents':[]})
 return {'returnedFunction':'accepted_accounted_adapter.supervise_accounted','adapterInvocations':0,
  'codeMarshalSHA256':hashlib.sha256(marshal.dumps(f.__code__)).hexdigest(),'origin':str(ADAPTER),
  'globalsVerified':['HERE','PIN','__file__','__spec__.origin','__name__','os','subprocess'],
  'staleCallerPin':stale_error,'tamperRejectedBeforeExecution':rejected}

def fdmap():
 result={}
 for s in os.listdir('/proc/self/fd'):
  try:
   fd=int(s);st=os.fstat(fd);result[fd]=(st.st_dev,st.st_ino,st.st_mode)
  except OSError:pass
 return result

def closed(fd):
 try:os.fstat(fd)
 except OSError as e:
  assert type(e) is OSError and e.errno==errno.EBADF
  return
 raise AssertionError('owned transport remained open')

def recv_exact(s,n):
 data=b''
 while len(data)<n:
  more=s.recv(n-len(data));assert more,'unexpected EOF';data+=more
 return data

def request(peer,op,unique,body):
 peer.sendall(struct.pack('<2I2Q4I',40+len(body),op,unique,1,os.getuid(),os.getgid(),os.getpid(),0)+body)
 header=recv_exact(peer,16);length,error,got=struct.unpack('<IiQ',header)
 assert got==unique and length>=16
 return error,recv_exact(peer,length-16)

def borrowed_transport(peer,borrowed):
 os.fstat(borrowed)
 os.write(borrowed,b'B');assert peer.recv(1)==b'B'

def wire_thread(m,mode):
 baseline=fdmap();owned=None;borrowed=None;peer=None;thread=None
 with tempfile.TemporaryDirectory(prefix='w-',dir=TASK) as tmp:
  status=pathlib.Path(tmp)/'s';backend=m.Backend(tmp)
  server,peer=socket.socketpair();peer.settimeout(3)
  owned=server.detach();borrowed=os.dup(owned);backend.fd=owned
  errors=[]
  def run():
   try:backend.serve(status)
   except BaseException as e:errors.append(e)
  thread=threading.Thread(target=run,name='bounded-real-serve',daemon=True)
  try:
   thread.start()
   deadline=time.monotonic()+3
   while not status.exists():
    assert thread.is_alive(),repr(errors)
    assert time.monotonic()<deadline,'control bind timeout'
    time.sleep(.005)
   # Real status connection also proves selector dispatch has started.
   with socket.socket(socket.AF_UNIX) as control:
    control.settimeout(3);control.connect(str(status));state=json.loads(control.recv(8192))
    assert state['operations']==0
   if mode=='eof':
    err,body=request(peer,26,101,struct.pack('<2I',7,31))
    assert err==0 and len(body)==64
    assert struct.unpack_from('<2I',body)==(7,31)
    # MKDIR unsafe namespace component must be rejected over the wire.
    err,body=request(peer,9,102,struct.pack('<2I',0o700,0)+b'../outside\0')
    assert (err,body)==(-errno.EINVAL,b'')
    assert backend.operations==2 and set(backend.nodes)=={1} and backend.nodes[1]['names']=={}
    peer.shutdown(socket.SHUT_WR)
   else:
    peer.sendall(struct.pack('<2I2Q4I',41,26,103,1,0,0,0,0))
   thread.join(3);assert not thread.is_alive(),'serve thread did not stop'
   if mode=='eof':assert errors==[],repr(errors);error=None
   else:
    assert len(errors)==1 and type(errors[0]) is RuntimeError and str(errors[0])=='FUSE request truncated',repr(errors)
    error={'type':'RuntimeError','message':str(errors[0]),'errno':None}
   # Assert before cleanup, so a missing production close cannot be masked.
   closed(owned)
   borrowed_transport(peer,borrowed)
   # With selector/control closed, only original fixtures remain.
   after=fdmap();assert set(after)==set(baseline)|{borrowed,peer.fileno()},(baseline,after)
   return {'case':mode,'requests':2 if mode=='eof' else 1,'exception':error,
    'namespaceErrno':errno.EINVAL if mode=='eof' else None,'ownedFD':'EBADF',
    'borrowedTransport':'usable byte transfer','selectorAndControl':'no leaked FDs','thread':'joined'}
  finally:
   if thread.is_alive():
    peer.shutdown(socket.SHUT_RDWR);thread.join(3)
   assert not thread.is_alive(),'fixture cleanup could not join server'
   # Independently reclaim a mutant leak, after the assertion has observed it.
   try:os.close(owned)
   except OSError as e:assert e.errno==errno.EBADF
   os.close(borrowed);peer.close()

 assert fdmap()==baseline

def collision(m):
 baseline=fdmap()
 with tempfile.TemporaryDirectory(prefix='b-',dir=TASK) as tmp:
  status=pathlib.Path(tmp)/'s'
  with socket.socket(socket.AF_UNIX) as listener:
   listener.settimeout(3);listener.bind(str(status));listener.listen(1)
   server,peer=socket.socketpair();peer.settimeout(3);owned=server.detach();borrowed=os.dup(owned)
   try:
    backend=m.Backend(tmp);backend.fd=owned
    error=exact_exception(lambda:backend.serve(status),OSError,number=errno.EADDRINUSE)
    closed(owned);borrowed_transport(peer,borrowed)
    with socket.socket(socket.AF_UNIX) as probe:
     probe.settimeout(3);probe.connect(str(status));accepted,_=listener.accept()
     with accepted:probe.sendall(b'L');assert accepted.recv(1)==b'L'
    assert set(fdmap())==set(baseline)|{listener.fileno(),peer.fileno(),borrowed}
   finally:
    try:os.close(owned)
    except OSError as e:assert e.errno==errno.EBADF
    os.close(borrowed);peer.close()
 assert fdmap()==baseline
 return {'case':'bind collision','exception':error,'ownedFD':'EBADF','borrowedListener':'connect/accept/byte transfer usable','borrowedTransport':'usable byte transfer','leaks':0}

def regular(m):
 baseline=fdmap()
 with tempfile.TemporaryDirectory(prefix='r-',dir=TASK) as tmp:
  path=pathlib.Path(tmp)/'file';path.write_bytes(b'valid regular file')
  owned=os.open(path,os.O_RDWR);borrowed=os.dup(owned)
  try:
   backend=m.Backend(tmp);backend.fd=owned
   # A valid file descriptor reaches actual EpollSelector.register -> EPERM.
   error=exact_exception(lambda:backend.serve(pathlib.Path(tmp)/'s'),PermissionError,number=errno.EPERM)
   closed(owned);assert os.pread(borrowed,18,0)==b'valid regular file'
   assert os.pwrite(borrowed,b'V',0)==1 and os.pread(borrowed,1,0)==b'V'
   assert set(fdmap())==set(baseline)|{borrowed}
  finally:
   try:os.close(owned)
   except OSError as e:assert e.errno==errno.EBADF
   os.close(borrowed)
 assert fdmap()==baseline
 return {'case':'valid regular file epoll registration','exception':error,'ownedFD':'EBADF','borrowedFile':'pread/pwrite usable','leaks':0}

def main():
 RESULT['sourcePinsBefore']=sources()
 # Input preflight has already passed; never invoke an imported adapter.
 assert json.loads((OUT/'input-verification.json').read_text())['status']=='PASS'
 baseline=fdmap();RESULT['loader']=loader()
 assert fdmap()==baseline
 with selectors.DefaultSelector() as sel:assert type(sel) is selectors.EpollSelector
 m=module(BACKEND,'exact_combined_backend')
 RESULT['wire'].append(wire_thread(m,'eof'));assert fdmap()==baseline
 RESULT['wire'].append(wire_thread(m,'malformed'));assert fdmap()==baseline
 RESULT['wire'].append(collision(m));RESULT['wire'].append(regular(m))
 source=BACKEND.read_bytes();needle=b'                    os.close(self.fd)'
 assert source.count(needle)==1
 mutant=source.replace(needle,b'                    pass # private distinguishing mutant: omit owned transport close')
 mutant_module=module(BACKEND,'private_close_mutant',mutant)
 try:wire_thread(mutant_module,'eof')
 except AssertionError as e:
  assert str(e)=='owned transport remained open',str(e)
  RESULT['mutant']={'change':'remove only final owned transport os.close(self.fd)','rejectedBy':'owned transport remained open',
   'sha256':hashlib.sha256(mutant).hexdigest(),'cleanup':'leaked owned fd independently closed; thread joined'}
 else:raise AssertionError('close-removal mutant escaped lifecycle assertion')
 assert fdmap()==baseline
 assert not any(t.name=='bounded-real-serve' for t in threading.enumerate())
 RESULT.update(status='PASS',selector='actual selectors.EpollSelector',behavioralChildren=0,
  sourcePinsAfter=sources(),descriptorCleanup='all fixture FDs closed; pre/post fd maps equal',
  remainingGates=['mounted/kernel/CLI/browser/guest/gameplay acceptance not performed'])
 print('PASS exact caller.load_backend, four tamper controls, stale caller pin, four real-selector serve exits, one-close mutant rejection')
if __name__=='__main__':
 try:main()
 except BaseException as e:
  RESULT.update(status='FAIL',failure=repr(e));raise
 finally:(OUT/'results.json').write_text(json.dumps(RESULT,indent=2)+'\n')

"""Exact production sample boundary; only intercept os.open to schedule real mutation."""
import os,pathlib,hashlib,importlib.util,tempfile,json,time
from unittest import mock
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);P=O.parent/'repo/tools/ricochet/runtime-accounting.py'
assert len(P.read_bytes())==14705 and hashlib.sha256(P.read_bytes()).hexdigest()=='eda4947b2e96b115fcc92deecf147cb8fdeb03189f4600fdb9be82b45a18dae4'
s=importlib.util.spec_from_file_location('production',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def v(s):return dict(ino=s.st_ino,size=s.st_size,blocks=s.st_blocks,mtime=s.st_mtime_ns,ctime=s.st_ctime_ns,nlink=s.st_nlink,mode=s.st_mode)
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp);p=root/'continue.json';p.write_bytes(b'{}');initial=p.stat();a=m.RuntimeAccounting([root],ephemeral_files={p:24*1048576},ceiling=256*1048576)
 realopen=os.open;calls=[];events=[];answer=None;error=None;fdcount=len(list(pathlib.Path('/proc/self/fd').iterdir()))
 def opening(name,flags,*args,**kw):
  if name=='continue.json' and kw.get('dir_fd') is not None:
   calls.append(1)
   if len(calls)==2:
    # Keep ctime visibly distinct, demonstrating the consumed branch ignores it.
    time.sleep(.02);p.write_bytes(b'[]');os.utime(p,ns=(initial.st_atime_ns,initial.st_mtime_ns))
    changed=p.stat();events.append(dict(event='rewrite',content=p.read_text(),version=v(changed)));assert changed.st_ctime_ns!=initial.st_ctime_ns
    p.unlink();events.append(dict(event='unlink',pinned=v(os.fstat(a.control_fds[p]))))
  try:return realopen(name,flags,*args,**kw)
  except FileNotFoundError as e:
   if name=='continue.json':events.append(dict(event='genuine-open-error',errno=e.errno))
   raise
 with mock.patch.object(os,'open',opening):
  try:answer=a.sample()
  except (m.AccountingError,OSError) as e:error=str(e)
 r=dict(candidate='03b1c12fb6edd1ca88ff51658fea811f26c740ec',sourceSHA256=hashlib.sha256(P.read_bytes()).hexdigest(),initial=v(initial),events=events,opens=len(calls),expected='AccountingError; lastBytes null; no inventory',actualError=error,actualInventory=None if answer is None else dict(bytes=answer['bytes'],sizes={str(k):n for k,n in answer['sizes'].items()}),receipt=dict(a.receipt),fdsBefore=fdcount,fdsAfter=len(list(pathlib.Path('/proc/self/fd').iterdir())))
 (O/'minimal-reproducer.json').write_text(json.dumps(r,indent=2));print(json.dumps(r));assert error is not None and answer is None and a.receipt['lastBytes'] is None,'REJECT: changed pinned content accepted after genuine ENOENT'

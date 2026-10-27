import os,pathlib,hashlib,importlib.util,tempfile,json
from unittest import mock
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);P=O.parent/'repo/tools/ricochet/runtime-accounting.py';assert hashlib.sha256(P.read_bytes()).hexdigest()=='eda4947b2e96b115fcc92deecf147cb8fdeb03189f4600fdb9be82b45a18dae4'
s=importlib.util.spec_from_file_location('production_accounting',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def version(s):return dict(ino=s.st_ino,size=s.st_size,blocks=s.st_blocks,mtime_ns=s.st_mtime_ns,ctime_ns=s.st_ctime_ns,mode=s.st_mode,nlink=s.st_nlink)
results=[]
# The only patch delays a genuine os.open; all accounting methods remain actual production code.
for case,reject in [('unchanged-unlink',False),('grow-unlink',True),('shrink-unlink',True),('same-size-rewrite-unlink',True),('same-size-restored-mtime-unlink',True)]:
 with tempfile.TemporaryDirectory() as tmp:
  root=pathlib.Path(tmp);c=root/'continue.json';c.write_bytes(b'{}');before=c.stat();ledger=m.RuntimeAccounting([root],ephemeral_files={c:24*1048576},ceiling=256*1048576);realopen=os.open;hits=[];events=[];answer=None;error=None;startfds=len(list(pathlib.Path('/proc/self/fd').iterdir()))
  def opening(name,flags,*a,**kw):
   if name=='continue.json' and kw.get('dir_fd') is not None:
    hits.append(1)
    if len(hits)==2:
     if case.startswith('grow'):c.write_bytes(b'x'*33)
     if case.startswith('shrink'):c.write_bytes(b'x')
     if case.startswith('same-size'):c.write_bytes(b'[]')
     if 'restored-mtime' in case:os.utime(c,ns=(before.st_atime_ns,before.st_mtime_ns))
     events.append(dict(event='before-unlink',actualContent=c.read_text(),version=version(c.stat())))
     c.unlink();events.append(dict(event='after-unlink',pinned=version(os.fstat(ledger.control_fds[c])),namedExists=c.exists()))
   try:return realopen(name,flags,*a,**kw)
   except FileNotFoundError as e:
    if name=='continue.json':events.append(dict(event='real-os-open-ENOENT',errno=e.errno,ordinal=len(hits)))
    raise
  with mock.patch.object(os,'open',opening):
   try:answer=ledger.sample()
   except (m.AccountingError,OSError) as e:error=dict(type=type(e).__name__,message=str(e))
  endfds=len(list(pathlib.Path('/proc/self/fd').iterdir()));passed=(error is not None and answer is None and ledger.receipt['lastBytes'] is None) if reject else error is None and answer is not None
  r=dict(case=case,expectedReject=reject,passed=passed,before=version(before),events=events,opens=len(hits),actualError=error,actualResult=None if answer is None else dict(bytes=answer['bytes'],sizes={str(p):n for p,n in answer['sizes'].items()}),receipt=dict(ledger.receipt),fdsBefore=startfds,fdsAfter=endfds,cleanupComplete=startfds==endfds);results.append(r)
  (O/'challenge.json').write_text(json.dumps(dict(source=str(P),sourceSHA256=hashlib.sha256(P.read_bytes()).hexdigest(),results=results),indent=2));print(json.dumps(dict(case=case,passed=passed,error=error,lastBytes=ledger.receipt['lastBytes'],fdsClean=startfds==endfds)))
  assert startfds==endfds,'FD leak'
  if not passed:raise SystemExit('REJECT: content rewritten on pinned inode, restored mtime then unlink accepted successful inventory')

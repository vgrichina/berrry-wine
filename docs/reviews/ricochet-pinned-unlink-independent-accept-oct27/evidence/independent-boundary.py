import pathlib,os,json,hashlib,importlib.util,tempfile,stat
from unittest import mock
O=pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS']);P=O.parent/'repo/tools/ricochet/runtime-accounting.py'
assert hashlib.sha256(P.read_bytes()).hexdigest()=='eda4947b2e96b115fcc92deecf147cb8fdeb03189f4600fdb9be82b45a18dae4'
s=importlib.util.spec_from_file_location('actual_accounting',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def version(s):return dict(dev=s.st_dev,ino=s.st_ino,size=s.st_size,blocks=s.st_blocks,mtime_ns=s.st_mtime_ns,ctime_ns=s.st_ctime_ns,mode=s.st_mode,nlink=s.st_nlink)
results=[]
cases=[('absent',False),('unchanged',False),('unlink-before-second',False),('unlink-after-second',False),('consumed-before-final',False),('grow-before-second',True),('rewrite-before-second',True),('mode-after-second',True),('hardlink-before-second',True),('symlink-before-second',True),('replace-before-second',True),('grow-unlink-before-second',True)]
for case,reject in cases:
 with tempfile.TemporaryDirectory() as tmp:
  root=pathlib.Path(tmp);c=root/'continue.json';c.write_bytes(b'{}');before=version(c.stat());ledger=m.RuntimeAccounting([root],ephemeral_files={c:24*1048576},ceiling=256*1048576)
  if case=='absent':c.unlink()
  realopen=os.open;realscandir=os.scandir;hits=[];events=[];answer=None;error=None;scans=[]
  def action():
   if case.startswith('grow'):c.write_bytes(b'{"changedDuringFinalReopen":true}')
   if case.startswith('rewrite'):
    c.write_bytes(b'[]');os.utime(c,ns=(before['mtime_ns'],before['mtime_ns']+1000000))
   if case.startswith('mode'):c.chmod(0o600)
   if case.startswith('hardlink'):os.link(c,root/'other.json')
   if case.startswith('symlink'):c.unlink();c.symlink_to(root/'missing')
   if case.startswith('replace'):
    n=root/'replacement';n.write_bytes(b'[]');n.replace(c)
   if 'unlink' in case:c.unlink()
   pin=ledger.control_fds.get(c)
   events.append(dict(event='boundary-action',case=case,pinnedInode=None if pin is None else version(os.fstat(pin)),namedExists=c.exists()))
  def opening(name,flags,*a,**kw):
   control=name=='continue.json' and kw.get('dir_fd') is not None
   if control:
    hits.append(1)
    if len(hits)==2 and case.endswith('before-second'):action()
   try:fd=realopen(name,flags,*a,**kw)
   except OSError as e:
    if control:events.append(dict(event='real-open-failed',ordinal=len(hits),errno=e.errno))
    raise
   if control:
    events.append(dict(event='real-open-return',ordinal=len(hits),observed=version(os.fstat(fd))))
    if len(hits)==2 and case.endswith('after-second'):action()
   return fd
  def scanning(fd):
   scans.append(1)
   if len(scans)==2 and case=='consumed-before-final':
    c.unlink();events.append(dict(event='legitimate-consumption-before-final-enumeration'))
   return realscandir(fd)
  with mock.patch.object(os,'open',opening),mock.patch.object(os,'scandir',scanning):
   try:answer=ledger.sample()
   except (m.AccountingError,OSError) as e:error=dict(type=type(e).__name__,message=str(e))
  passed=(error is not None and answer is None and ledger.receipt['lastBytes'] is None) if reject else (error is None and answer is not None and 24*1048576<=answer['bytes']<=256*1048576 and ledger.receipt['lastBytes']==answer['bytes'])
  results.append(dict(case=case,expectedReject=reject,passed=passed,opens=len(hits),error=error,accepted=None if answer is None else dict(bytes=answer['bytes'],sizes={str(k):v for k,v in answer['sizes'].items()}),receipt=dict(ledger.receipt),before=before,events=events))
  (O/'independent-boundary.json').write_text(json.dumps(dict(source=str(P),sha256=hashlib.sha256(P.read_bytes()).hexdigest(),controlReserve=24*1048576,ceiling=256*1048576,results=results,fixtures='TemporaryDirectory cleanup on each case'),indent=2))
  print(json.dumps(dict(case=case,passed=passed,rejected=error is not None,opens=len(hits),lastBytes=ledger.receipt['lastBytes'])))
  if not passed:raise SystemExit('REJECT: independent boundary counterexample; stop integration')

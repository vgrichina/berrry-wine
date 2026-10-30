import os,json,time,hashlib,errno
R='/tmp/tvsa/domain';S=R+'/source,sticky';D=R+'/destination,sticky'
source=b'S'*4096;old=b'D'*4096
sf=df=None
def emit(step,**kw):print(json.dumps(dict(step=step,at=time.monotonic(),**kw)),flush=True)
def state(fd):
 b=os.pread(fd,8192,0);s=os.fstat(fd);return dict(inode=s.st_ino,length=s.st_size,sha256=hashlib.sha256(b).hexdigest())
def reject(fd,offset):
 try:os.pwrite(fd,b'X',offset)
 except OSError as e:
  assert e.errno==errno.ENOSPC;return dict(errno=e.errno,offset=offset,bytes=1)
 raise AssertionError('WRITE unexpectedly succeeded')
try:
 sf=os.open(S,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600);df=os.open(D,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
 assert os.write(sf,source)==4096 and os.write(df,old)==4096
 emit('before',source=state(sf),destination=state(df));time.sleep(.4)
 os.rename(S,D);assert not os.path.exists(S)
 assert os.pread(sf,8192,0)==source and os.pread(df,8192,0)==old
 with open(D,'rb') as f:assert f.read()==source
 emit('retained',source=state(sf),oldDestination=state(df));time.sleep(.4)
 rejected=reject(sf,4096);assert os.pread(sf,8192,0)==source and os.fstat(sf).st_size==4096
 emit('rejected',write=rejected,source=state(sf),oldDestination=state(df));time.sleep(.4)
 # This stable window intentionally permits the unchanged production supervisor
 # to enforce its stop-on-failure policy. Do not mask SIGTERM or race admission.
 os.close(df);df=None;emit('closed-old');time.sleep(.7)
 emit('before-retry');rejected=reject(sf,0)
 assert os.pread(sf,8192,0)==source and os.fstat(sf).st_size==4096
 emit('retry-rejected',write=rejected,source=state(sf));time.sleep(.4)
finally:
 for fd in (df,sf):
  if fd is not None:os.close(fd)
 for p in (S,D):
  try:os.unlink(p)
  except FileNotFoundError:pass
emit('cleanup',empty=os.listdir(R)==[])

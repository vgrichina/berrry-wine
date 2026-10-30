import os,json,time,hashlib
R='/tmp/tvsa/domain'
S=R+'/source,retained';D=R+'/destination,retained'
source=b'S'*4096;old=b'D'*4096
def emit(step,**kw):
    print(json.dumps(dict(step=step,at=time.monotonic(),**kw)),flush=True)
def state(fd):
    data=os.pread(fd,8192,0);s=os.fstat(fd)
    return dict(inode=s.st_ino,length=s.st_size,sha256=hashlib.sha256(data).hexdigest())
sf=df=None
try:
    sf=os.open(S,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
    df=os.open(D,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
    assert os.write(sf,source)==4096 and os.write(df,old)==4096
    assert os.pread(sf,8192,0)==source and os.pread(df,8192,0)==old
    before=state(df)
    emit('before',source=state(sf),destination=before,heldDescriptors=['source','old-destination'])
    time.sleep(.5)
    os.rename(S,D)
    assert not os.path.exists(S)
    with open(D,'rb') as f:assert f.read()==source
    assert os.pread(df,8192,0)==old and state(df)==before
    emit('retained',sourceAbsent=True,newDestinationSourceBytes=True,oldHandleOldBytes=True,oldDestination=state(df),source=state(sf),heldDescriptors=['source','old-destination'])
    time.sleep(.5)
    emit('closing-old',oldDestination=state(df))
    os.close(df);df=None
    emit('closed-old',heldDescriptors=['source'])
    # RELEASE is asynchronous. The external status observer must see the exact
    # lower accounting before reuse; this sleep is not itself acceptance.
    time.sleep(.7)
    emit('before-reuse',heldDescriptors=['source'])
    assert os.pwrite(sf,b'X',4096)==1
    expected=source+b'X'
    assert os.pread(sf,8192,0)==expected and os.fstat(sf).st_size==4097
    with open(D,'rb') as f:assert f.read()==expected
    emit('reused',source=state(sf),exactPrefix=True,newByte=True,destinationSourceBytes=True,heldDescriptors=['source'])
    time.sleep(.5)
finally:
    for fd in (df,sf):
        if fd is not None:os.close(fd)
    for path in (S,D):
        try:os.unlink(path)
        except FileNotFoundError:pass
emit('cleanup',empty=os.listdir(R)==[])
time.sleep(.25)

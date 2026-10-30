import os,errno,json,time,hashlib,resource
R='/tmp/tvsa/domain';P=R+'/size,atomic'
def emit(step,**kw):
    print(json.dumps(dict(step=step,at=time.monotonic(),**kw)),flush=True)
def state(fd):
    content=os.pread(fd,16384,0);s=os.fstat(fd);v=os.statvfs(R)
    return dict(length=s.st_size,sha256=hashlib.sha256(content).hexdigest(),inode=s.st_ino,blocks=s.st_blocks,availableBlocks=v.f_bavail,freeInodes=v.f_ffree)
payload=(b'AtomicSetattr-0123456789abcdef'*200)[:4096]
assert len(payload)==4096
fd=os.open(P,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
try:
    assert os.write(fd,payload)==len(payload)
    assert os.pread(fd,8192,0)==payload
    before=state(fd)
    emit('before',state=before,FSIZE=resource.getrlimit(resource.RLIMIT_FSIZE))
    time.sleep(.15)
    try:os.ftruncate(fd,8193)
    except OSError as e:actual=e.errno
    else:actual=0
    after=state(fd)
    emit('rejected',errno=actual,expected=errno.ENOSPC,state=after,unchanged=before==after)
    assert actual==errno.ENOSPC and before==after
    # No artificial post-rejection delay: the exact supervisor may terminate
    # the child on its next poll because the backend latches quota failure.
    os.truncate(P,1024)
    assert os.pread(fd,16384,0)==payload[:1024]
    emit('shrink',state=state(fd))
    os.ftruncate(fd,8192)
    assert os.pread(fd,16384,0)==payload[:1024]+b'\0'*7168
    emit('regrowth',state=state(fd),prefixRetained=True,zeroFill=True,expectedWritten=11264)
finally:
    os.close(fd)
    os.unlink(P)
emit('cleanup',empty=os.listdir(R)==[])

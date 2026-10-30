import os,json,time,hashlib
R='/tmp/tvsa/domain';U=R+'/open,unlinked';B=R+'/ordinary,reuse'
payload=bytes(range(128));ordinary=b'B'*128;patch=b'LIVE-FD';extension=b'R'*3969
def emit(step,**kw):print(json.dumps(dict(step=step,at=time.monotonic(),**kw)),flush=True)
def state(fd):
    s=os.fstat(fd);data=os.pread(fd,8192,0)
    return dict(inode=s.st_ino,length=s.st_size,links=s.st_nlink,sha256=hashlib.sha256(data).hexdigest())
u=b=None
try:
    u=os.open(U,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
    b=os.open(B,os.O_CREAT|os.O_EXCL|os.O_RDWR,0o600)
    assert os.write(u,payload)==len(payload) and os.write(b,ordinary)==len(ordinary)
    assert os.pread(u,8192,0)==payload and os.pread(b,8192,0)==ordinary
    initial=state(u);emit('created',unlinked=initial,ordinary=state(b));time.sleep(.4)
    os.unlink(U)
    try:os.stat(U)
    except FileNotFoundError:pass
    else:raise AssertionError('unlinked namespace still present')
    assert os.pread(u,8192,0)==payload and os.fstat(u).st_ino==initial['inode']
    emit('unlinked-open',namespaceAbsent=True,sameFD=u,unlinked=state(u));time.sleep(.4)
    assert os.pwrite(u,patch,51)==len(patch)
    expected=payload[:51]+patch+payload[51+len(patch):]
    assert os.pread(u,8192,0)==expected
    assert os.fstat(u).st_ino==initial['inode']
    emit('unlinked-written-read',sameFD=u,unlinked=state(u));time.sleep(.4)
    emit('closing-unlinked',inode=initial['inode']);os.close(u);u=None
    emit('closed-unlinked',inode=initial['inode'])
    # Kernel RELEASE may follow close. Actual callback/counter evidence decides
    # acceptance; this pause does not itself establish reclamation.
    time.sleep(.7);emit('before-extension',ordinary=state(b))
    assert os.pwrite(b,extension,len(ordinary))==len(extension)
    assert os.pread(b,8192,0)==ordinary+extension
    emit('extended',ordinary=state(b),exactContents=True);time.sleep(.4)
finally:
    for fd in (u,b):
        if fd is not None:os.close(fd)
    for path in (U,B):
        try:os.unlink(path)
        except FileNotFoundError:pass
assert os.listdir(R)==[];emit('cleanup',empty=True);time.sleep(.2)

"""Read-only trace of returned raw production FUSE handlers; no result mutation."""
import sys,os,json,struct,time
TARGET='/tmp/tvsa-stage/repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
count=0
def returned(frame,event,value):
    global count
    if event!='c_return' or value is not os.write or frame.f_code.co_name!='serve' or frame.f_code.co_filename!=TARGET:return
    wire=frame.f_locals;op=wire.get('op')
    if op not in (12,45,28):return
    count+=1
    if count>64:raise RuntimeError('read-only wire capture bound exceeded')
    raw=wire['raw'];answer=wire['answer'];error=wire['error']
    response=struct.pack('<IiQ',16+len(answer),error,wire['unique'])+answer
    record=dict(sequence=count,at=time.monotonic(),opcode=op,unique=wire['unique'],inode=wire['ino'],errno=-error,requestHex=raw.hex(),responseHex=response.hex(),observedBoundary='successful os.write c_return in pinned production serve')
    if op==28 and isinstance(answer,bytes):
        entries=[];off=0
        while off<len(answer):
            ino,cookie,n,kind=struct.unpack_from('<QQII',answer,off)
            name=answer[off+24:off+24+n];entries.append(dict(inode=ino,cookie=cookie,type=kind,name=name.decode('utf-8')))
            off+=(24+n+7)&~7
        assert off==len(answer);record['entries']=entries
    b=(json.dumps(record)+'\n').encode();assert len(b)<=8192
    fd=os.open('/tmp/tvsa-stage/raw-wire.jsonl',os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
    try:os.write(fd,b)
    finally:os.close(fd)
sys.setprofile(returned)

"""Read-only successful production callback observation; no backend mutation."""
import sys,os,json,struct,time
TARGET='/tmp/tvsa-stage/repo/test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
count=0
def returned(frame,event,value):
    global count
    if event!='c_return' or value is not os.write or frame.f_code.co_name!='serve' or frame.f_code.co_filename!=TARGET:return
    w=frame.f_locals;op=w.get('op')
    if op not in (10,15,16,18,35):return
    count+=1;assert count<=64
    response=struct.pack('<IiQ',16+len(w['answer']),w['error'],w['unique'])+w['answer']
    backend=w['self']
    nodes={str(i):dict(links=n['links'],opens=n['opens'],bytes=len(n['data'])) for i,n in backend.nodes.items()}
    record=dict(sequence=count,at=time.monotonic(),opcode=op,unique=w['unique'],inode=w['ino'],errno=-w['error'],requestHex=w['raw'].hex(),responseHex=response.hex(),after=backend.accounting_counters(),nodes=nodes,observedBoundary='successful os.write c_return in pinned production serve')
    raw=(json.dumps(record)+'\n').encode();assert len(raw)<=16384
    fd=os.open('/tmp/tvsa-stage/raw-wire.jsonl',os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
    try:os.write(fd,raw)
    finally:os.close(fd)
sys.setprofile(returned)

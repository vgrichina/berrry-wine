from pathlib import Path
import json
r=Path(__file__).parent
out=r/'small-transfer'
for p in [out,out/'e',out/'raw',out/'images']:p.mkdir(exist_ok=True)
for old,new in [('owner_policy_ops.py','small_transfer_ops.py'),('owner_policy_gate.py','small_transfer_gate.py')]:
 s=(r/old).read_text().replace("owner-policy/e","small-transfer/e").replace("import owner_policy_ops as ops","import small_transfer_ops as ops").replace("OUT=ops.ROOT/'owner-policy'","OUT=ops.ROOT/'small-transfer'")
 (r/new).write_text(s)
s=(r/'owner-policy-runtime.py').read_text().replace('import owner_policy_gate as gate','import small_transfer_gate as gate')
s=s.replace('import os,sys,json,pathlib,time,hashlib,base64,contextlib,io,datetime,signal','import os,sys,json,pathlib,time,hashlib,base64,contextlib,io,datetime,signal,shlex')
s=s.replace("box=json.loads((O/'boat-created.json').read_text())['id']\n v=call(name,", "box=json.loads((O/'boat-created.json').read_text())['id']\n bounded_command(code,args)\n v=call(name,",1)
start=s.index('def transfer(a):');end=s.index('def collect():',start)
s=s[:start]+'''CHUNK=16384
COMMAND_LIMIT=32768
TRANSFER_CODE="import pathlib,base64,sys,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); n=int(sys.argv[1]); assert (p.stat().st_size if p.exists() else 0)==n; b=base64.b64decode(sys.argv[2],validate=True); assert 0<len(b)<=16384; h=hashlib.sha256(b).hexdigest(); assert h==sys.argv[3]; f=p.open('ab'); assert f.tell()==n; assert f.write(b)==len(b); f.close(); assert p.stat().st_size==n+len(b); print(json.dumps(dict(offset=n,end=n+len(b),sha256=h)))"
def bounded_command(code,args):
 argv=['/usr/bin/python3','-B','-c',code,*args]
 shell=shlex.join(argv)
 sizes=dict(argvBytes=sum(len(x.encode())+1 for x in argv),shellBytes=len(shell.encode()),serializedBytes=len(json.dumps({'command':shell},ensure_ascii=True).encode()))
 assert max(sizes.values())<=COMMAND_LIMIT,('encoded command bound',sizes)
 return sizes
def transfer(a):
 off=0;k=0
 for part in a['parts']:
  with (R/part).open('rb') as f:
   while b:=f.read(CHUNK):
    h=hashlib.sha256(b).hexdigest();args=(str(off),base64.b64encode(b).decode(),h)
    sizes=bounded_command(TRANSFER_CODE,args)
    v=json.loads(remote('transfer-%04d'%k,TRANSFER_CODE,*args,compact=True))
    assert v==dict(offset=off,end=off+len(b),sha256=h),v
    off+=len(b);k+=1
    if k%50==0:print(json.dumps(dict(transferred=off,total=a['bytes'],at=utc())),flush=True)
 assert off==a['bytes']
 v=json.loads(remote('archive-sha',"import pathlib,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest())))"))
 assert v==dict(bytes=a['bytes'],sha256=a['sha256']),v
 save('transfer-complete.json',dict(**v,chunks=k,rawChunkMax=CHUNK,commandByteLimit=COMMAND_LIMIT,at=utc()))
''' +s[end:]
s=s.replace("'enigma-guest-poll-owner-policy-oct30'","'enigma-small-transfer-oct30'")
# Original task explicitly delegates preservation and verified snapshot-stop.
s=s.replace("assert len(b)<=49152","assert len(b)<=16384")
s=s.replace("wall=110)","wall=120)") # remote Python supervises original 116s child; guest hardwall remains115s.
(r/'small-transfer-runtime.py').write_text(s)
# Exact unchanged remote guest/observer and limits; no experiment replay or synthetic replacement.
for n in ['small_transfer_ops.py','small_transfer_gate.py','small-transfer-runtime.py']:
 p=r/n;compile(p.read_text(),n,'exec');p.chmod(0o444)
print(json.dumps(dict(created=True,output=str(out))))

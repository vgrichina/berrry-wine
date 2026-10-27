from common import *
import sys,zlib
name=sys.argv[1];remote=sys.argv[2]
# Compression is lossless transport only. Acceptance images use unchanged full PNGs.
code='import pathlib,zlib,hashlib,json;p=pathlib.Path('+repr(remote)+');b=p.read_bytes();z=zlib.compress(b,9);q=pathlib.Path('+repr(O+'/'+name+'.z')+');q.write_bytes(z);print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),compressedBytes=len(z),compressedSHA256=hashlib.sha256(z).hexdigest(),path=str(q))))'
x=json.loads(py('large-meta-'+name,code)['stdout']);used=sum(p.stat().st_size for p in H.glob('*.api.stdout'));envelope=((x['compressedBytes']+4095)//4096)*8192
assert used+envelope+M<=8*M
save(name+'-transfer-admission.json',dict(at=time.time(),used=used,envelope=envelope,terminalReserve=M,metadata=x))
parts=[]
for off in range(0,x['compressedBytes'],4096):
 v=py('large-'+name+'-'+str(off),'import pathlib,base64;b=pathlib.Path('+repr(x['path'])+').read_bytes();print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())');assert len(json.dumps(v).encode())<=8192;parts.append(base64.b64decode(v['stdout'].strip(),validate=True))
z=b''.join(parts);assert sha(z)==x['compressedSHA256'];b=zlib.decompress(z);assert len(b)==x['bytes'] and sha(b)==x['sha256'];(H/name).write_bytes(b);save(name+'-retained.json',dict(x,retained=str(H/name),verified=True));print(name,'retained',len(b),'compressed',len(z))

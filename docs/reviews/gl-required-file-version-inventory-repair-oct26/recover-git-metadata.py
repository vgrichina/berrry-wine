from pathlib import Path as P
import subprocess,sys,hashlib,zlib,json
h=P(__file__).resolve().parent.parent;o=h/'ops';g=h/'repo/.git';base='9e7b74218b6518534638efdd9a48310df7b6f1ad'
p=subprocess.Popen([sys.executable,str(o/'git-child.py'),'-C','/tmp/gl-transient-accounting-measured-client-repair-oct26/repo','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
seen=set();total=0
try:
 todo=[base]
 while todo:
  oid=todo.pop()
  if oid in seen:continue
  p.stdin.write((oid+'\n').encode());p.stdin.flush();header=p.stdout.readline().split();assert len(header)==3 and header[0].decode()==oid,header
  typ=header[1];n=int(header[2]);assert typ in (b'commit',b'tree') and n<2*1048576
  data=p.stdout.read(n);assert len(data)==n and p.stdout.read(1)==b'\n'
  raw=typ+b' '+str(n).encode()+b'\0'+data;assert hashlib.sha1(raw).hexdigest()==oid
  dest=g/'objects'/oid[:2]/oid[2:];dest.parent.mkdir(exist_ok=True);(dest.write_bytes(zlib.compress(raw)) if not dest.exists() else None);assert zlib.decompress(dest.read_bytes())==raw;seen.add(oid);total+=len(raw);assert total<8*1048576
  if typ==b'commit':todo.append(data.splitlines()[0].split()[1].decode())
  else:
   i=0
   while i<len(data):
    end=data.index(b'\0',i);mode=data[i:end].split(b' ',1)[0];child=data[end+1:end+21].hex();i=end+21
    if mode==b'40000':todo.append(child)
 p.stdin.close();assert p.wait(timeout=5)==0
finally:
 if p.poll() is None:p.kill();p.wait()
# Recover precisely supplied verified source blobs (the only missing-blob inputs
# authorized here), using their already verified donor SHA256/Git pins.
pins=json.loads((o/'pins.json').read_text())
for f,v in pins['files'].items():
 data=(P('/tmp/gl-transient-accounting-measured-client-repair-oct26/repo')/f).read_bytes();assert hashlib.sha256(data).hexdigest()==v['sha256']
 raw=b'blob '+str(len(data)).encode()+b'\0'+data;oid=hashlib.sha1(raw).hexdigest();dest=g/'objects'/oid[:2]/oid[2:];dest.parent.mkdir(exist_ok=True);(dest.write_bytes(zlib.compress(raw)) if not dest.exists() else None);assert zlib.decompress(dest.read_bytes())==raw
(g/'objects/info/alternates').unlink();(g/'shallow').write_text(base+'\n')
print(json.dumps(dict(metadataObjects=len(seen),uncompressedMetadataBytes=total,sourceBlobsRecovered=4,alternatesRemoved=True,shallowBase=base,recipe='commit and recursive tree metadata only; no assets/other blobs')))

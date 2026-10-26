import pathlib,hashlib,zlib,glob,json,subprocess,re
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';rows=json.loads((O/'object-recovery.json').read_text())
roots=glob.glob('/tmp/*/repo/.git/objects')+glob.glob('/tmp/*/ops/v/*')
for attempt in range(100):
 p=subprocess.run(['git','-C',str(R),'write-tree'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if not p.returncode:break
 assert len(p.stderr)<8192
 m=re.search(rb'invalid object \d+ ([0-9a-f]{40})',p.stderr);assert m,p.stderr.decode()
 oid=m[1].decode();found=False
 for root in roots:
  source=pathlib.Path(root)/oid[:2]/oid[2:]
  if not source.is_file():continue
  b=source.read_bytes();raw=zlib.decompress(b);assert hashlib.sha1(raw).hexdigest()==oid
  q=R/'.git/objects'/oid[:2]/oid[2:];q.parent.mkdir(exist_ok=True);q.write_bytes(b)
  rows.append(dict(oid=oid,source=str(source),bytes=len(b),firstFailure=p.stderr.decode()));found=True;break
 assert found,oid
else:raise RuntimeError('bounded recovery exceeded 100 missing blobs')
(O/'object-recovery.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(dict(recovered=len(rows),bytes=sum(r['bytes'] for r in rows),tree=p.stdout.decode().strip())))

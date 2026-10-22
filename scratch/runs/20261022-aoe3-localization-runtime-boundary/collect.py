"""Recover this run only, with bounded compression and trace offsets."""
import base64,hashlib,importlib.util,json,pathlib
E=pathlib.Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('prepare',E/'prepare.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
def main():
 code='''import pathlib,json,hashlib,gzip,os,socket,datetime,tarfile
d=pathlib.Path(%r);data=(d/"output.log").read_bytes();rows=data.splitlines(keepends=True)
keys=[b"stringtable",b"unithelp",b"0x00bcc9d8",b"0x00bcc9e8",b"0x004870",b"0x004871",b"[CreateDialog]",b"[api-mem] SendMessageW",b"[SetWindowText]"]
selected=set(range(min(65,len(rows))))|set(range(max(0,len(rows)-100),len(rows)))
for i,row in enumerate(rows):
 if any(k in row.lower() if k in [b"stringtable",b"unithelp"] else k in row for k in keys):selected.update(range(max(0,i-3),min(len(rows),i+8)))
offset=0;focus=[];boundary=[]
for i,row in enumerate(rows):
 if i in selected:focus.append(str(i+1).encode()+b" byte="+str(offset).encode()+b": "+row)
 if row.startswith(b"[BOUNDARY] "):boundary.append(json.loads(row[len(b"[BOUNDARY] "):]))
 offset+=len(row)
(d/"focused-trace.log").write_bytes(b"".join(focus))
(d/"trace-summary.json").write_text(json.dumps(dict(rawBytes=len(data),rawLines=len(rows),rawSha256=hashlib.sha256(data).hexdigest(),observerEvents=len(boundary),observerBlocks=sum(x["kind"]=="block" for x in boundary),lastObserverEvent=boundary[-1]),indent=2))
with gzip.open(d/"output.log.gz","wb",compresslevel=6) as f:f.write(data)
launch=json.loads((d/"launch.json").read_text());alive=True
try:os.killpg(launch["pgid"],0)
except ProcessLookupError:alive=False
ports={}
for n in [8123,8124]:
 s=socket.socket();ports[str(n)]=s.connect_ex(("127.0.0.1",n));s.close()
(d/"process-state.json").write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),pid=launch["pid"],processGroupPresent=alive,portsConnectEx=ports,free=os.statvfs(d).f_bavail*os.statvfs(d).f_frsize),indent=2));assert not alive
names=["launch.json","exit.json","preflight.json","postflight.json","process-state.json","focused-trace.log","trace-summary.json","output.log.gz","final-registry.json","preguest-failure/launch.json","preguest-failure/exit.json","preguest-failure/output.log","preguest-failure/postflight.json"]
manifest=[]
for n in names:
 b=(d/n).read_bytes();manifest.append(dict(path=n,size=len(b),sha256=hashlib.sha256(b).hexdigest()))
(d/"collected-manifest.json").write_text(json.dumps(manifest,indent=2))
with tarfile.open(d/"evidence.tar.gz","w:gz") as t:
 for n in names+["collected-manifest.json"]:t.add(d/n,arcname=n)
b=(d/"evidence.tar.gz").read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),remote=str(d/"evidence.tar.gz"),manifest=manifest)))
'''%p.D
 receipt=p.run(code,'collection');meta=json.loads(receipt['stdout']);assert meta['bytes']<8*1024*1024
 (E/'archive-metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
 chunks=[]
 for pos in range(0,meta['bytes'],60000):
  r=p.run('import pathlib,base64;f=pathlib.Path(%r).open("rb");f.seek(%d);print(base64.b64encode(f.read(60000)).decode())'%(p.D+'/evidence.tar.gz',pos),'archive-chunk-'+str(pos))
  chunks.append(base64.b64decode(r['stdout']));(E/('archive-chunk-'+str(pos)+'.json')).unlink()
 b=b''.join(chunks);assert len(b)==meta['bytes'] and hashlib.sha256(b).hexdigest()==meta['sha256'];(E/'evidence.tar.gz').write_bytes(b)
 import tarfile,io
 with tarfile.open(fileobj=io.BytesIO(b)) as t:t.extractall(E/'raw',filter='data')
 print(json.dumps(dict(archiveBytes=len(b),sha256=meta['sha256'],rawFiles=len(meta['manifest']))))
if __name__=='__main__':main()

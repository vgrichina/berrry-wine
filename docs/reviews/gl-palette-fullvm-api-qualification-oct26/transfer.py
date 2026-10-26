from common import *
import base64,tarfile,io,shlex
def put_bytes(data,dest):
 api('python3 -c '+shlex.quote('import pathlib; p=pathlib.Path('+repr(dest)+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"")'))
 for off in range(0,len(data),49152):
  chunk=base64.b64encode(data[off:off+49152]).decode()
  cmd='import pathlib,base64;p=pathlib.Path('+repr(dest)+');f=p.open("ab");f.write(base64.b64decode('+repr(chunk)+'));f.close()'
  api('python3 -c '+shlex.quote(cmd))
 actual=json.loads(api('python3 -c '+shlex.quote('import pathlib,hashlib,json;b=pathlib.Path('+repr(dest)+').read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))')))
 assert actual==dict(bytes=len(data),sha256=sha(data)),actual
 return actual
if __name__=='__main__':
 gate('transfer-start',remote=34*1048576)
 probe=bytes(range(256))*512
 receipt=put_bytes(probe,REM+'/transfer-probe.bin')
 back=api('python3 -c '+shlex.quote('import pathlib,base64;print(base64.b64encode(pathlib.Path('+repr(REM+'/transfer-probe.bin')+').read_bytes()).decode())'))
 assert base64.b64decode(back)==probe
 api('rm '+shlex.quote(REM+'/transfer-probe.bin'))
 save('large-transfer-validation.json',dict(bytes=len(probe),chunkBytes=49152,hash=receipt['sha256'],fullReadback=True,removed=True))
 # Do not retain the probe's base64 in evidence logs.
 rows=(O/'api-receipts.jsonl').read_text().splitlines();rows=[json.dumps(dict(json.loads(l),stdout='<131072-byte probe readback verified>')) if len(json.loads(l).get('stdout',''))>100000 else l for l in rows];(O/'api-receipts.jsonl').write_text('\n'.join(rows)+'\n')
 archive=(H/'source.tar.gz').read_bytes();a=put_bytes(archive,REM+'/source.tar.gz')
 pkg=pathlib.Path('/tmp/wa-local-runtime-deps/node_modules/pngjs');files=[];buf=io.BytesIO()
 with tarfile.open(fileobj=buf,mode='w:gz') as t:
  for p in sorted(pkg.rglob('*')):
   if p.is_file():
    b=p.read_bytes();name='node_modules/pngjs/'+str(p.relative_to(pkg));info=tarfile.TarInfo(name);info.size=len(b);info.mtime=0;t.addfile(info,io.BytesIO(b));files.append(dict(path=name,bytes=len(b),sha256=sha(b)))
 dep=put_bytes(buf.getvalue(),REM+'/pngjs.tar.gz');save('pngjs-manifest.json',dict(standingSource=str(pkg),version='7.0.0',files=files,archive=dep))
 for name in ['source-manifest.json','capture.cjs','remote-run.py']:
  put_bytes((O/name).read_bytes(),REM+'/'+name)
 cmd='import pathlib,tarfile,json,hashlib;h=pathlib.Path('+repr(REM)+');[tarfile.open(h/n).extractall(h,filter="data") for n in ["source.tar.gz","pngjs.tar.gz"]];m=json.load(open(h/"source-manifest.json"));verified=[]\nfor r in m["files"]:\n b=(h/r["path"]).read_bytes();assert len(b)==r["bytes"] and hashlib.sha256(b).hexdigest()==r["sha256"],r\n if "blob" in r:assert hashlib.sha1(b"blob "+str(len(b)).encode()+b"\\0"+b).hexdigest()==r["blob"],r\n verified.append(r["path"])\n[h.joinpath(n).unlink() for n in ["source.tar.gz","pngjs.tar.gz"]];print(json.dumps(dict(candidate=m["candidate"],verified=len(verified),sourceBytes=m["total"],allocated=sum(p.stat().st_blocks*512 for p in h.rglob("*") if p.is_file()))))'
 result=json.loads(api('python3 -c '+shlex.quote(cmd)));save('remote-source-verification.json',dict(result,archive=a,pngjs=dep))
 gate('transferred',remote=result['allocated']+5*1048576)
 print(json.dumps(result))

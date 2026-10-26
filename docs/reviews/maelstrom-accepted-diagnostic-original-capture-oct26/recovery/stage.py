import pathlib,sys,json,base64,zlib,shlex,time
from common import *
account('prestage')
m=json.load(open(H/'manifest.json'));receipts=[]
extras=[]
for n in ['guest-args.json','manifest.json','validate-tree.cjs','supervise.py']:
 p=H/n;b=p.read_bytes();extras.append(dict(target=n,path=str(p),bytes=len(b),sha256=sha(b)))
for x in m+extras:
 b=pathlib.Path(x['path']).read_bytes();assert sha(b)==x['sha256']
 # Compress each bounded segment before transport; write and readback the
 # completed file remotely against the same immutable manifest.
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode();p=str(H/x['target'])
  code='import pathlib,zlib,base64;p=pathlib.Path('+repr(p)+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')));print("ok")'
  j=py(code);receipts.append(dict(commandId=j.get('commandId'),file=x['target'],offset=off))
 (O/'transfer-receipts.json').write_text(json.dumps(receipts,separators=(',',':')))
j=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');m=json.load(open(h/"manifest.json"));bad=[x["target"] for x in m if len((h/x["target"]).read_bytes())!=x["bytes"] or hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()!=x["sha256"]];print(json.dumps(dict(files=len(m),bad=bad,allocated=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob("*") if p.is_file()))));assert not bad')
save('remote-full-readback.json',j);assert not json.loads(j['stdout'])['bad'];account('staged',json.loads(j['stdout'])['allocated'])
print(json.dumps(dict(files=len(m),transfers=len(receipts),readback=True)))

import pathlib,json,base64,hashlib,zlib,sys,time
from api import py,putrows,H,O
from account import admit
admit('before-stage')
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
r=py('import pathlib,json,shutil,hashlib;h=pathlib.Path("/home/user/maelstrom-errno-api-canonical-native-oct25/ops/errno-latch.wasm");b=h.read_bytes();mem=int(next(l.split()[1] for l in open("/proc/meminfo") if l.startswith("MemAvailable")))*1024;free=shutil.disk_usage("/tmp").free;assert mem>=2684354560;assert free-16000000>=2982150144;assert len(b)==1882300 and hashlib.sha256(b).hexdigest()=="a77709fb784a21e6775771450f54b709373f0cc8ad2d4878012c949eaae88f69";print(json.dumps(dict(memAvailable=mem,free=free,moduleBytes=len(b),moduleSHA256=hashlib.sha256(b).hexdigest())))');save('remote-prestage.json',r)
test='transfer-probe.txt';putrows([[test,base64.b64encode(b'bounded API transfer probe\n').decode()]])
r=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(str(H/test))+');assert p.read_bytes()==b"bounded API transfer probe\\n";print(json.dumps(dict(transferVerified=True,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))');save('transfer-probe.json',r)
M=json.loads((H/'manifest.json').read_text());M.append(dict(target='manifest.json',path=str(H/'manifest.json'),sha256=hashlib.sha256((H/'manifest.json').read_bytes()).hexdigest()))
rows=[];batches=0
for x in M:
 b=pathlib.Path(x['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==x['sha256']
 row=[x['target'],base64.b64encode(b).decode()]
 # Per-file compressed API command; large incompressible file split below.
 trial=rows+[row]
 if len(base64.b64encode(zlib.compress(json.dumps(trial).encode())))>30000:
  if rows:putrows(rows);batches+=1;rows=[]
  if len(base64.b64encode(zlib.compress(json.dumps([row]).encode())))>30000:
   for off in range(0,len(b),18000):
    enc=base64.b64encode(b[off:off+18000]).decode()
    py('import pathlib,base64;p=pathlib.Path('+repr(str(H/x['target']))+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(enc)+');'+('assert not p.exists();p.write_bytes(b)' if off==0 else 'assert p.stat().st_size=='+str(off)+';p.open("ab").write(b)'))
    batches+=1
   continue
 rows.append(row)
if rows:putrows(rows);batches+=1
r=py('import pathlib,json,hashlib;h=pathlib.Path('+repr(str(H))+');m=json.loads((h/"manifest.json").read_text());[(None if hashlib.sha256((h/x["target"]).read_bytes()).hexdigest()==x["sha256"] else (_ for _ in ()).throw(Exception(x["target"]))) for x in m];(h/"guest").mkdir();print(json.dumps(dict(files=len(m),allHashesVerified=True,ownedBytes=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob("*") if p.is_file()))))');save('remote-staged.json',r)
print(json.dumps(dict(staged=True,batches=batches)))

"""API-only bounded evidence readback. Never prints binary/encoded payloads."""
import pathlib,subprocess,json,base64,hashlib,gzip,time
from api import REMOTE,BOX
O=pathlib.Path(__file__).resolve().parent
code='''import pathlib,json,gzip,base64,hashlib
O=pathlib.Path(REMOTE)/'ops'
selected=[p for p in O.iterdir() if p.is_file() and p.name not in ['sources.json.gz','static-abi.py','native-module-bound.cjs','manifest.json','static-oracle.json','pinned-inputs.json'] and p.suffix in ['.json','.stdout','.stderr','.py']]
selected=sorted(selected,key=lambda p:p.name)
archive=gzip.compress(json.dumps({p.name:base64.b64encode(p.read_bytes()).decode() for p in selected},sort_keys=True,separators=(',',':')).encode(),mtime=0)
'''.replace('REMOTE',repr(REMOTE))
def run(tail,label):
 p=subprocess.run(['boat','--json','exec',BOX,'--timeout','60','--','python3','-c',code+tail],capture_output=True,text=True,timeout=90)
 r=json.loads(p.stdout);assert p.returncode==0 and r.get('success'),r.get('stderr')
 with (O/'api-readback.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),label=label,commandId=r.get('commandId'),exitCode=r.get('exitCode'),stdoutBytes=len(r['stdout']),stdoutSHA256=hashlib.sha256(r['stdout'].encode()).hexdigest(),stderr=r.get('stderr'),payloadRetainedIn='remote-evidence.json.gz'))+'\n')
 return r['stdout'].strip()
meta=json.loads(run('print(json.dumps(dict(bytes=len(archive),sha256=hashlib.sha256(archive).hexdigest(),files=[dict(name=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in selected])))','archive-manifest'))
out=bytearray()
for off in range(0,meta['bytes'],32768):out+=base64.b64decode(run('print(base64.b64encode(archive['+str(off)+':'+str(off+32768)+']).decode())','archive-chunk-'+str(off)))
assert len(out)==meta['bytes'] and hashlib.sha256(out).hexdigest()==meta['sha256']
(O/'remote-evidence.json.gz').write_bytes(out);(O/'remote-evidence-manifest.json').write_text(json.dumps(meta,indent=2))
decoded=json.loads(gzip.decompress(out))
for row in meta['files']:
 b=base64.b64decode(decoded[row['name']]);assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
print(json.dumps(dict(status='PASS',bytes=meta['bytes'],sha256=meta['sha256'],files=len(meta['files']))))

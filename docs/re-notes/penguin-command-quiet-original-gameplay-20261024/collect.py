import sys,pathlib,json,shlex,zlib,base64,hashlib,time
sys.path.insert(0,'/tmp/penguin-retained-codec-oct24');from api import remote
H=pathlib.Path('/tmp/penguin-quiet-gameplay-oct24');E=H/'repo/docs/re-notes/penguin-command-quiet-original-gameplay-20261024'
def get(target,dest):
 code='import pathlib,zlib;print(len(zlib.compress(pathlib.Path('+repr(target)+').read_bytes())))';n=int(remote('python3 -c '+shlex.quote(code))['stdout']);out=bytearray()
 for off in range(0,n,4096):
  code='import pathlib,zlib,base64;b=zlib.compress(pathlib.Path('+repr(target)+').read_bytes());print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  out.extend(base64.b64decode(remote('python3 -c '+shlex.quote(code))['stdout']))
 b=zlib.decompress(out);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);return dict(path=str(dest.relative_to(E)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
j=remote("python3 -c 'import pathlib,json;h=pathlib.Path(\"/tmp/penguin-quiet-gameplay-oct24\");print(json.dumps([str(p.relative_to(h)) for p in h.rglob(\"*\") if p.is_file()]))'");files=json.loads(j['stdout']);seals=[]
for name in files:seals.append(get('/tmp/penguin-quiet-gameplay-oct24/'+name,E/name))
seals.append(get('/tmp/penguin-retained-codec-oct24/manifest.json',E/'retained-payload-manifest.json'))
(E/'collection-seals.json').write_text(json.dumps(seals,indent=2));(E/'launch.json').write_bytes((H/'launch.json').read_bytes());print(json.dumps({'files':len(seals),'bytes':sum(x['bytes'] for x in seals)}))

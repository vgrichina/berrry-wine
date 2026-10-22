"""Retrieve bounded evidence from the assigned box through Boat exec, not SCP."""
import base64,hashlib,json,pathlib,subprocess,sys
E=pathlib.Path(__file__).resolve().parent
remote=sys.argv[1];local=E/(sys.argv[2] if len(sys.argv)>2 else pathlib.Path(remote).name)
def run(code):
 r=subprocess.run(['boat','exec','bx_2gnkcnac','--','python3','-c',code],capture_output=True,text=True)
 v=json.loads(r.stdout);assert r.returncode==0 and v['exitCode']==0,v
 assert not v.get('stdoutTruncated'),v
 return v
v=run("import pathlib,hashlib,json;p=pathlib.Path(%r);print(json.dumps(dict(size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))"%remote)
identity=json.loads(v['stdout']);assert identity['size']<20*1024*1024
with local.open('wb') as f:
 for off in range(0,identity['size'],45000):
  v=run("import base64;f=open(%r,'rb');f.seek(%d);print(base64.b64encode(f.read(45000)).decode())"%(remote,off))
  f.write(base64.b64decode(v['stdout']))
assert hashlib.sha256(local.read_bytes()).hexdigest()==identity['sha256']
with (E/'retrieval.jsonl').open('a') as f:f.write(json.dumps(dict(remote=remote,local=local.name,**identity))+'\n')
print(local,identity)

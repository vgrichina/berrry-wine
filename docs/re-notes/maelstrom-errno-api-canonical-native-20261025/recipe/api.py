import subprocess,json,pathlib,base64,hashlib,zlib,sys,time,os
H=pathlib.Path(__file__).resolve().parent;BOX='bx_k38z8byn';REMOTE='/home/user/maelstrom-errno-api-canonical-native-oct25'
def call(args,timeout=60,label='api'):
 p=subprocess.run(['boat','--json','exec',BOX,'--timeout',str(timeout),'--',*args],capture_output=True,text=True,timeout=timeout+30)
 try:r=json.loads(p.stdout)
 except Exception:
  (H/(label+'-unparsed.txt')).write_text(p.stdout+p.stderr);raise RuntimeError('API result not JSON, retained')
 with (H/'api-commands.jsonl').open('a') as f:f.write(json.dumps(dict(label=label,at=time.time(),result=r))+'\n')
 if p.returncode or r.get('exitCode',0)!=0 or r.get('success') is False:raise RuntimeError('API failure '+label+': '+json.dumps(r)[:2000])
 return r
def py(code,label='python',timeout=60):return call(['python3','-c',code],timeout,label)
def put(local,remote):
 local=pathlib.Path(local);b=local.read_bytes();digest=hashlib.sha256(b).hexdigest()
 # Each API command writes a bounded chunk directly to the final file; no payload copy.
 for off in range(0,len(b),24576):
  chunk=base64.b64encode(b[off:off+24576]).decode()
  code='import pathlib,base64;p=pathlib.Path('+repr(remote)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(chunk)+');'
  code+=('assert not p.exists();p.write_bytes(b)' if off==0 else 'assert p.stat().st_size=='+str(off)+';p.open("ab").write(b)')
  r=py(code,'stage-'+local.name+'-'+str(off))
 r=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(remote)+');b=p.read_bytes();assert len(b)=='+str(len(b))+';assert hashlib.sha256(b).hexdigest()=='+repr(digest)+';p.chmod(0o444);print(json.dumps(dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))','verify-'+local.name)
 return json.loads(r['stdout'])
if __name__=='__main__':
 if sys.argv[1]=='admit':
  r=py('import os,pathlib,shutil,json,subprocess;mem=int(next(l.split()[1] for l in open("/proc/meminfo") if l.startswith("MemAvailable")))*1024;free=shutil.disk_usage("/home/user").free;print(json.dumps(dict(memAvailable=mem,diskFree=free,node=subprocess.check_output(["/home/user/.nvm/versions/node/v24.22.1/bin/node","-p","JSON.stringify({version:process.version,v8:process.versions.v8,tailcalls:WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0]))})"],text=True).strip())));assert mem>=2684354560;assert free-67108864>=2982150144','remote-admission')
  (H/'remote-admission.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))

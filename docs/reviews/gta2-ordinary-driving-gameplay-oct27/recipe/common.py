import os,sys,pathlib,json,time,hashlib,shlex,subprocess,base64,zlib
H=pathlib.Path(__file__).parent;M=1048576;REMOTE='/tmp/gta2-ordinary-driving-gameplay-oct27';BOX='bx_9th86yg2'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def used():return sum(p.stat().st_size for p in (H/'api').glob('*.raw'))+sum(p.stat().st_size for p in (H/'api').glob('*.err'))
def remote(cmd,timeout=30,reserve=8192,detach=False):
 assert len(cmd.encode())<=36000
 a=H/'api';a.mkdir(exist_ok=True);i=len(list(a.glob('*.raw')))
 assert used()+reserve+M<=8*M,'API/terminal reserve'
 save('api-pending.json',dict(index=i,used=used(),reserve=reserve,terminalReserve=M,budget=8*M,commandSHA256=sha(cmd.encode()),timeout=timeout))

 if 'rows=json.loads(zlib.decompress' not in cmd:(a/(str(i)+'.cmd')).write_text(cmd)
 out=a/(str(i)+'.raw');err=a/(str(i)+'.err');args=['/home/user/.ascii/boat','--no-update','--json','exec']+(['--detach'] if detach else ['--timeout',str(timeout)])+[BOX,cmd]
 with out.open('xb') as o,err.open('xb') as e:
  p=subprocess.Popen(args,stdout=o,stderr=e)
  try:p.wait(timeout=timeout+15)
  except BaseException:p.terminate();p.wait();raise
 raw=out.read_bytes();error=err.read_bytes()
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(index=i,at=time.time(),commandSHA256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(raw),stderrBytes=len(error),exit=p.returncode,used=used()))+'\n')
 assert len(raw)+len(error)<=reserve,'API response reservation exceeded'
 assert p.returncode==0,('CLI failed / possible denial STOP',i,p.returncode)
 j=json.loads(raw);assert not j.get('stdoutTruncated') and not j.get('stderrTruncated'),('truncation',i)
 if not detach:assert j.get('exitCode')==0,('remote command failure',i,j)
 assert not error,('provider stderr retained',i)
 return j,raw
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def transfer_command(rows):
 data=base64.b64encode(zlib.compress(json.dumps(rows,separators=(',',':')).encode())).decode()
 code='import pathlib,json,base64,zlib;root=pathlib.Path('+repr(REMOTE)+');rows=json.loads(zlib.decompress(base64.b64decode('+repr(data)+')));[((root/x[0]).parent.mkdir(parents=True,exist_ok=True),(root/x[0]).open(x[1]).write(base64.b64decode(x[2]))) for x in rows];print(len(rows))'
 return 'python3 -c '+shlex.quote(code)
def send(b,target):
 for off in range(0,len(b),18000):remote(transfer_command([[target,'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]]))
if __name__=='__main__':
 code='import pathlib,json,os,resource,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,node=shutil.which("node"),limits={n:resource.getrlimit(getattr(resource,"RLIMIT_"+n)) for n in ("DATA","AS","RSS","CPU","FSIZE")},modules=[str(p) for p in pathlib.Path("/home/user").glob("*/node_modules/skia-canvas/package.json")],cwd=os.getcwd())))'
 j,raw=py(code);save('remote-initial.json',j);print(j['stdout'])

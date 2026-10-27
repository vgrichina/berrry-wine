import os,sys,pathlib,json,time,hashlib,shutil,resource,subprocess,shlex,base64,zlib,importlib.util
H=pathlib.Path(__file__).parent;REMOTE='/tmp/penguin-published-projectile-gameplay-oct27';BOX='bx_5pu4jynk';M=1048576
HELPER=pathlib.Path('/tmp/penguin-accepted-explicit-budget-main-integrate-oct27/repo/tools/penguin_capture_contract.py')
assert hashlib.sha256(HELPER.read_bytes()).hexdigest()=='efcf3c5656a40800a4add90f1882d24830b8cb142626161dd3535d0027491c0b'
sp=importlib.util.spec_from_file_location('contract',HELPER);contract=importlib.util.module_from_spec(sp);sp.loader.exec_module(contract)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):(H/n).write_text(json.dumps(j,indent=2)+'\n')
def used():return sum(p.stat().st_size for p in (H/'api').glob('*.raw'))+sum(p.stat().st_size for p in (H/'api').glob('*.err'))
def remote(cmd,timeout=30,reserve=8192):
 assert len(cmd.encode())<=36000
 a=H/'api';a.mkdir(exist_ok=True);i=len(list(a.glob('*.raw')))
 assert used()+reserve+M<=8*M,'pending API/terminal reserve'
 before=used();save('api-pending.json',dict(index=i,used=before,reserve=reserve,terminalReserve=M,budget=8*M,commandSHA256=sha(cmd.encode()),timeout=timeout))
 out=a/(str(i)+'.raw');err=a/(str(i)+'.err');args=['/home/user/.ascii/boat','--no-update','--json','exec','--timeout',str(timeout),BOX,cmd]
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(args,stdout=o,stderr=e)
  try:p.wait(timeout=timeout+15)
  except BaseException:p.kill();p.wait();raise
 raw=out.read_bytes();error=err.read_bytes()
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(index=i,at=time.time(),commandSHA256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(raw),stderrBytes=len(error),exit=p.returncode,used=used()))+'\n')
 assert len(raw)+len(error)<=reserve and len(raw)+len(error)<=8192,'API operation output guard'
 assert p.returncode==0 and not error,('CLI failed',i,p.returncode)
 j=json.loads(raw);contract.provider_stdout(raw,1024)
 return j,raw
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def send(b,target):
 for off in range(0,len(b),18000):
  row=[target,'wb' if off==0 else 'ab',base64.b64encode(b[off:off+18000]).decode()]
  cmd=transfer_command([row]);remote(cmd)
def transfer_command(rows):
 data=base64.b64encode(zlib.compress(json.dumps(rows,separators=(',',':')).encode())).decode()
 code='import pathlib,json,base64,zlib;root=pathlib.Path('+repr(REMOTE)+');rows=json.loads(zlib.decompress(base64.b64decode('+repr(data)+')));[( (root/x[0]).parent.mkdir(parents=True,exist_ok=True),(root/x[0]).open(x[1]).write(base64.b64decode(x[2]))) for x in rows];print(len(rows))'
 return 'python3 -c '+shlex.quote(code)

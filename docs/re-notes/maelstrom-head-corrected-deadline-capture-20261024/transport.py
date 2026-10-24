import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib
H=pathlib.Path(__file__).parent.parent
BOX='bx_qp99542b'; B='/home/user/.ascii/boat'
E=H/'repo/docs/re-notes/maelstrom-original-bounded-runtime-20261024'
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def remote(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 try:j=json.loads(p.stdout)
 except Exception:
  save('first-rejection.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId')))+'\n')
 if p.returncode or j.get('exitCode')!=0 or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError(str(j)[:1200])
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def payload(x):
 return subprocess.check_output(['git','-C',x['donor'],'show',x['revision']+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def size(p):return sum(max(x.stat().st_size,x.stat().st_blocks*512) for x in p.rglob('*') if x.is_file()) if p.exists() else 0

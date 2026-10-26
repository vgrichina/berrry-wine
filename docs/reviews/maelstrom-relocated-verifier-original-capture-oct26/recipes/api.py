import pathlib,subprocess,json,time,hashlib,base64,zlib,shlex
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';BOX='bx_k38z8byn'
def call(cmd,timeout=30):
 assert len(cmd.encode())<=36000
 p=subprocess.run(['boat','--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+10)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=131072
 try:j=json.loads(p.stdout)
 except Exception:
  (O/'first-unparsed.json').write_text(json.dumps(dict(stdout=p.stdout,stderr=p.stderr,exit=p.returncode)));raise
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),commandSHA=hashlib.sha256(cmd.encode()).hexdigest(),result=j))+'\n')
 if p.returncode or j.get('exitCode')!=0 or not j.get('success') or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  if not (O/'first-rejection.json').exists():(O/'first-rejection.json').write_text(json.dumps(j,indent=2))
  raise RuntimeError('API rejected; first evidence retained')
 return j
def py(code,timeout=30):return call('python3 -c '+shlex.quote(code),timeout)
def putrows(rows):
 enc=base64.b64encode(zlib.compress(json.dumps(rows).encode())).decode()
 return py('import pathlib,json,zlib,base64;h=pathlib.Path('+repr(str(H))+');rows=json.loads(zlib.decompress(base64.b64decode('+repr(enc)+')));[( (h/p).parent.mkdir(parents=True,exist_ok=True),(h/p).write_bytes(base64.b64decode(b))) for p,b in rows];print(len(rows))')

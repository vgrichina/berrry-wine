import sys,os,pathlib,subprocess,resource,time,signal,json
H=pathlib.Path(__file__).parent
cap=(576 if sys.argv[1]=='git' else 64)*2**20;args=sys.argv[2:]
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits);os.set_blocking(p.stdout.fileno(),False);t=time.monotonic();peak=0;out=b'';reason='natural';owned={}
while p.poll() is None:
 rows={}
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=(q/'stat').read_text();v=s[s.rfind(')')+2:].split();rows[int(q.name)]=(int(v[1]),v[19],int(v[21])*4096)
  except (OSError,ValueError,IndexError):pass
 ids={p.pid}
 for _ in range(len(rows)):
  n={k for k,v in rows.items() if v[0] in ids}-ids
  if not n:break
  ids|=n
 owned.update({k:rows[k][1] for k in ids if k in rows});rss=sum(rows[k][2] for k,s in owned.items() if k in rows and rows[k][1]==s);peak=max(peak,rss)
 try:out+=os.read(p.stdout.fileno(),8192)
 except BlockingIOError:pass
 if rss>cap or len(out)>2097152 or time.monotonic()-t>119:
  reason='physical/output/wall-limit';os.killpg(p.pid,signal.SIGKILL);break
 time.sleep(.02)
p.wait()
while True:
 try:b=os.read(p.stdout.fileno(),8192)
 except BlockingIOError:break
 if not b:break
 out+=b
assert len(out)<=2097152
with (H/'local-supervision.jsonl').open('a') as f:f.write(json.dumps(dict(argv=args,cap=cap,peak=peak,elapsed=time.monotonic()-t,exit=p.returncode,reason=reason))+'\n')
sys.stdout.buffer.write(out[:8192]);sys.exit(p.returncode if reason=='natural' else 99)

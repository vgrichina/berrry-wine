import tarfile,io,base64,subprocess,pathlib,json,time,hashlib,os
H=pathlib.Path(__file__).resolve().parents[1];E=H/'evidence';cursor=E/'transfer-cursor.json';done=json.loads(cursor.read_text())['files'] if cursor.exists() else 0;start=time.monotonic();batch=[];sent=0;wire=0
code='import base64,tarfile,io,pathlib,sys; p=pathlib.Path("/tmp/shadow-task/repo");p.mkdir(parents=True,exist_ok=True); t=tarfile.open(fileobj=io.BytesIO(base64.b64decode(sys.argv[1])),mode="r:gz");t.extractall(p,filter="data");print("STAGED",len(t.getmembers()))'
def pack(rows):
 b=io.BytesIO()
 with tarfile.open(fileobj=b,mode='w:gz') as t:
  for name,data in rows:
   ti=tarfile.TarInfo(name);ti.size=len(data);ti.mode=0o644;t.addfile(ti,io.BytesIO(data))
 return b.getvalue()
def send(rows):
 global done,sent,wire
 b=pack(rows)
 if len(b)>60000:
  if len(rows)>1:
   mid=len(rows)//2;send(rows[:mid]);send(rows[mid:]);return
  # One large file: compressed bytes transfer is chunked then decompressed in memory, no remote archive.
  name,data=rows[0];encoded=base64.b64encode(b).decode();chunks=[encoded[i:i+60000] for i in range(0,len(encoded),60000)]
  for i,c in enumerate(chunks):
   ccode='import pathlib,sys; p=pathlib.Path("/tmp/shadow-task/chunk.b64");p.parent.mkdir(exist_ok=True);p.open("'+('w' if i==0 else 'a')+'").write(sys.argv[1]);print("CHUNK")'
   call(ccode,c)
  ccode='import pathlib,base64,tarfile,io;p=pathlib.Path("/tmp/shadow-task/chunk.b64");t=tarfile.open(fileobj=io.BytesIO(base64.b64decode(p.read_bytes())),mode="r:gz");t.extractall("/tmp/shadow-task/repo",filter="data");p.unlink();print("STAGED",len(t.getmembers()))';call(ccode,None)
 else:call(code,base64.b64encode(b).decode())
 done+=len(rows);sent+=len(rows);cursor.write_text(json.dumps({'files':done,'lastAt':time.time()}))
def call(script,arg):
 global wire
 argv=['boat','--no-update','--json','exec','bx_k4htahnf','--timeout','30','python3','-c',script]+([] if arg is None else [arg]);wire+=sum(len(a) for a in argv)
 p=subprocess.run(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=35)
 with (E/'transfer-results.jsonl').open('a') as f:
  f.write(json.dumps({'index':done,'argvSHA256':hashlib.sha256(json.dumps(argv).encode()).hexdigest(),'wireBytes':sum(len(a) for a in argv),'exit':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()})+'\n')
 assert p.returncode==0,(p.returncode,p.stderr[:300]);r=json.loads(p.stdout);assert r['exitCode']==0 and not r['stdoutTruncated'] and not r['stderrTruncated'],r
with tarfile.open(H/'inputs.tar.gz','r|gz') as t:
 for i,m in enumerate(t):
  if i<done:continue
  data=t.extractfile(m).read();batch.append((m.name,data))
  if sum(len(d) for _,d in batch)>=200000:
   send(batch);batch=[]
   if time.monotonic()-start>35:break
 else:
  if batch:send(batch)
print(json.dumps({'completedFiles':done,'sentFiles':sent,'commandWireBytes':wire,'elapsed':time.monotonic()-start}))

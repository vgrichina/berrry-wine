from common import *
import base64,concurrent.futures
REMOTE=str(H);BOX='bx_xw8d895f'
def api(code,label,timeout=25,detach=False):
 cmd=['boat','--no-update','exec','--json']
 if detach:cmd+=['--detach']
 else:cmd+=['--timeout',str(timeout)]
 cmd += [BOX,'python3','-c',code]
 assert sum(len(x)+1 for x in cmd)<=60000
 # One four-slot pool across all local transport processes, including readback.
 held=None
 while held is None:
  for ix in range(4):
   f=open(O/('api-slot-'+str(ix)),'a')
   try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);held=f;break
   except BlockingIOError:f.close()
  if held is None:time.sleep(.01)
 try:p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout+10)
 finally:held.close()
 assert len(p.stdout)<=8192 and len(p.stderr)<=8192,('response size',label)
 save('api-'+label+'.json',dict(argvBytes=sum(len(x)+1 for x in cmd),returncode=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode()))
 assert p.returncode==0,(label,p.stdout,p.stderr)
 j=json.loads(p.stdout)
 assert not j.get('timedOut'),('uncertain command, inspect status; never replay',j)
 if not detach:assert j.get('exitCode')==0 and j.get('success'),j
 return j
def send(data,name):
 parts=[data[i:i+34000] for i in range(0,len(data),34000)]
 def part(ix):
  b=parts[ix];out=REMOTE+'/transport/'+name+'.'+str(ix)
  code='import pathlib,base64,hashlib; p=pathlib.Path('+repr(out)+'); p.parent.mkdir(parents=True,exist_ok=True); b=base64.b64decode('+repr(base64.b64encode(b).decode())+'); assert not p.exists(); p.write_bytes(b); print(hashlib.sha256(p.read_bytes()).hexdigest())'
  j=api(code,name+'-'+str(ix));assert j['stdout'].strip()==sha(b)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:list(ex.map(part,range(len(parts))))
 code='import pathlib,hashlib; d=pathlib.Path('+repr(REMOTE+'/transport')+'); p=d/'+repr(name)+'; assert not p.exists(); h=hashlib.sha256(); f=p.open("wb"); '+ '; '.join('b=(d/'+repr(name+'.'+str(i))+').read_bytes(); f.write(b); h.update(b)' for i in range(len(parts)))+'; f.close(); print(h.hexdigest())'
 j=api(code,name+'-join');assert j['stdout'].strip()==sha(data)
 return dict(name=name,bytes=len(data),sha256=sha(data),chunks=len(parts),chunkBytes=34000,maxConcurrent=4)
if __name__=='__main__':
 if sys.argv[1]=='probe':
  b=bytes(i%251 for i in range(65537));r=send(b,'large-probe.bin')
  j=api('import pathlib,base64,hashlib; b=pathlib.Path('+repr(REMOTE+'/transport/large-probe.bin')+').read_bytes(); print(base64.b64encode(b[32000:36000]).decode()); print(len(b)); print(hashlib.sha256(b).hexdigest())','probe-readback')
  lines=j['stdout'].splitlines();assert base64.b64decode(lines[0])==b[32000:36000] and int(lines[1])==len(b) and lines[2]==sha(b)
  save('transfer-probe.json',dict(pass_=True,**r,readbackBytes=4000))
 elif sys.argv[1]=='archive':save('archive-transfer.json',send((O/'payload.tar.gz').read_bytes(),'payload.tar.gz'))

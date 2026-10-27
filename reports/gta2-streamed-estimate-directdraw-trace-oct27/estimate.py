"""Immutable blob -> 64KiB read -> tar stream -> gzip -> counting/hash sink.
No archive or source blob is retained. One git process, no nested controllers.
"""
import pathlib,json,hashlib,tarfile,gzip,subprocess,fcntl,resource,time,os,sys
O=pathlib.Path(__file__).parent
OLD=pathlib.Path('/tmp/gta2-compressed-retained-staging-driving-oct27/ops')
ROOT=pathlib.Path('/home/user/wine-assembly')
rc=json.loads((OLD/'source-readiness.json').read_text())
rows=[dict(r,kind='source',target=r['path']) for r in rc['sourceFiles']]
rows += [dict(r,kind='game',target=str(pathlib.Path(r['path']).relative_to(ROOT))) for r in json.loads((ROOT/'scratch/usage-watch/gta2-driving-input-readiness-oct27.json').read_text())['files']]
rows += [dict(r,kind='source',target=r['path']) for r in json.loads((OLD/'fonts-pins.json').read_text())]
for name,sha in [('wine-assembly.wasm','bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9'),('wine-assembly.compat.wasm','ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc')]:
 p=OLD/'retrieved'/name;rows.append(dict(kind='file',path=str(p),target='build/'+name,bytes=p.stat().st_size,sha256=sha))
class Sink:
 def __init__(self,path=None):self.count=0;self.h=hashlib.sha256();self.f=open(path,'xb') if path else None
 def write(self,b):
  self.count+=len(b);self.h.update(b)
  if self.f:self.f.write(b)
  return len(b)
 def flush(self):pass
class Reader:
 def __init__(self,f,n):
  self.f=f;self.remaining=n;self.h=hashlib.sha256();self.git=hashlib.sha1(b'blob '+str(n).encode()+b'\0');self.maxRead=0
 def read(self,n):
  assert n<=65536,n
  b=self.f.read(min(n,self.remaining));self.remaining-=len(b);self.h.update(b);self.git.update(b);self.maxRead=max(self.maxRead,len(b));return b
groups=[];batch=[];size=0
for r in rows:
 if batch and (len(batch)>=40 or size+r['bytes']>2097152):groups.append(batch);batch=[];size=0
 batch.append(r);size+=r['bytes']
 if size>=2097152:groups.append(batch);batch=[];size=0
if batch:groups.append(batch)
def gitlim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
out=[];start=time.monotonic()
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 with (O/('generate-'+sys.argv[1]+'-git.stderr' if len(sys.argv)>1 else 'estimate-git.stderr')).open('xb') as err:
  p=subprocess.Popen(['git','-C',rc['sourceDonor'],'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,preexec_fn=gitlim)
  for index,batch in enumerate(groups):
   if len(sys.argv)>1 and sys.argv[1]!='all' and index!=int(sys.argv[1]):continue
   if len(sys.argv)>1 and sys.argv[1]=='all' and index==0:continue
   sink=Sink(O/('group-'+str(index)+'.tar.gz') if len(sys.argv)>1 else None);pins=[]
   with gzip.GzipFile(fileobj=sink,mode='wb',compresslevel=6,mtime=0,filename='') as z:
    with tarfile.open(fileobj=z,mode='w|',bufsize=65536) as t:
     for r in batch:
      if r['kind']=='source':
       p.stdin.write((r['oid']+'\n').encode());p.stdin.flush();assert p.stdout.readline().decode().split()==[r['oid'],'blob',str(r['bytes'])];f=p.stdout
      else:f=open(r['path'],'rb')
      reader=Reader(f,r['bytes']);i=tarfile.TarInfo(r['target']);i.size=r['bytes'];i.mode=420;t.addfile(i,reader)
      assert reader.remaining==0
      if r['kind']=='source':assert p.stdout.read(1)==b'\n' and reader.git.hexdigest()==r['oid']
      else:f.close();assert reader.h.hexdigest()==r['sha256']
      pins.append(dict(r,sha256=reader.h.hexdigest()))
   if sink.f:sink.f.close()
   out.append(dict(index=index,count=len(batch),bytes=sum(r['bytes'] for r in batch),gzipBytes=sink.count,gzipSHA256=sink.h.hexdigest(),requests=(sink.count+22499)//22500,pins=pins))
  p.stdin.close();assert p.wait(timeout=5)==0
plan=dict(groups=out,count=len(rows),bytes=sum(r['bytes'] for r in rows),gzipBytes=sum(g['gzipBytes'] for g in out),requests=sum(g['requests'] for g in out),seconds=time.monotonic()-start,maxFiles=40,maxGroupBytes=2097152,oversizeSingletons=[dict(path=r['target'],bytes=r['bytes']) for r in rows if r['bytes']>2097152],chunkBytes=65536,wholeBlobRetained=False,wholeArchiveRetained=False,remoteAllocation=1073741824,remoteProjection=440297036,localAllocation=335544320,localReserve=33554432,remoteReserve=67108864,commandMax=36000,rawAllowance=8388608,terminalReserve=1048576)
(O/('group-'+sys.argv[1]+'.json' if len(sys.argv)>1 else 'transfer-plan.json')).write_text(json.dumps(plan,indent=2)+'\n')
print(json.dumps({k:v for k,v in plan.items() if k!='groups'}))

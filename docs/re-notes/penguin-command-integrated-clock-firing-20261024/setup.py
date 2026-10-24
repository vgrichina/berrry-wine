import subprocess,pathlib,json,hashlib,re,os
H=pathlib.Path(__file__).parent
D='/tmp/input-consumption-clock-independent-closeout-oct24/repo'
REV='5691793a58b4670fd2a621114d7926100a1e47de'
OLD=pathlib.Path('/tmp/penguin-scheduled-gameplay-oct24/repo/docs/re-notes/penguin-command-scheduled-input-gameplay-20261024')
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
def read(p):return subprocess.check_output(['git','-C',D,'show',REV+':'+p],env=env,stderr=subprocess.DEVNULL)
if __name__=='__main__':
 m=json.load(open(OLD/'manifest.json'));blobs={};pending=[x['path'] for x in m if x['kind']=='git']+['test/test-input-consumption-clock-domain.js']
 while pending:
  p=pending.pop()
  if p in blobs:continue
  try:b=read(p)
  except subprocess.CalledProcessError:
   # Historical helpers may have been removed by main's host split.
   continue
  blobs[p]=b
  if p.endswith('.js'):
   for a in re.findall(rb'require\([\'\"]([^\'\"]+)[\'\"]\)',b):
    a=a.decode()
    if not a.startswith('.'):continue
    q=os.path.normpath(str(pathlib.PurePosixPath(p).parent/a))
    if not pathlib.PurePosixPath(q).suffix:q+='.js'
    if q not in blobs:pending.append(q)
 new=[]
 for x in m:
  if x['kind']=='git':
   if x['path'] not in blobs:continue
   b=blobs[x['path']];x=dict(x,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),revision=REV,donor=D)
  new.append(x)
 existing={x['path'] for x in m if x['kind']=='git'}
 for p,b in blobs.items():
  if p not in existing:new.append(dict(kind='git',path=p,target='runner/'+p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),revision=REV,donor=D))
 (H/'manifest.json').write_text(json.dumps(new,indent=2));(H/'closure-paths.json').write_text(json.dumps(sorted(blobs),indent=2))
 print(json.dumps(dict(files=len(new),bytes=sum(x['bytes'] for x in new),gitFiles=len(blobs),gitBytes=sum(map(len,blobs.values())),originalManifestFiles=len(m),originalManifestBytes=sum(x['bytes'] for x in m))))
 r=H/'repo';subprocess.run(['git','init','-q',str(r)],check=True)
 objects=[];queue=[pathlib.Path(D)/'.git/objects']
 while queue:
  o=queue.pop()
  if str(o) in objects:continue
  objects.append(str(o));a=o/'info/alternates'
  if a.exists():queue.extend((o/x).resolve() if not x.startswith('/') else pathlib.Path(x) for x in a.read_text().splitlines())
 (r/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
 subprocess.run(['git','-C',str(r),'config','core.sparseCheckout','true'],check=True)
 (r/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in sorted(blobs))+'\n')
 subprocess.run(['git','-C',str(r),'update-ref','refs/heads/task/penguin-integrated-clock-firing-oct24',REV],check=True)
 subprocess.run(['git','-C',str(r),'symbolic-ref','HEAD','refs/heads/task/penguin-integrated-clock-firing-oct24'],check=True)
 subprocess.run(['git','-C',str(r),'read-tree','-mu','HEAD'],check=True,stderr=subprocess.DEVNULL)
 subprocess.run(['git','-C',str(r),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
 print('private explicit sparse ready')

import pathlib,subprocess,os,shutil,json,hashlib
D=pathlib.Path('/home/user/wine-assembly-shadow-man-null-arming-independent-accept-oct23'); C='aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec'; O=pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23'); env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*a):return subprocess.check_output(['git','-C',str(D),*a],env=env)
old=json.loads((D/'docs/re-notes/shadow-man-null-arming-independent-accept-20261023/admission.json').read_text())
files=[x['path'] for x in old['manifest']]
blobs={}
for f in files:
 r=subprocess.run(['git','-C',str(D),'show',C+':'+f],env=env,capture_output=True)
 if r.returncode==0:b=r.stdout
 else:
  b=(D/f).read_bytes(); oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert oid==git('ls-tree',C,'--',f).decode().split()[2],f
 blobs[f]=b
for f in ['fresh-selection.cjs','selection-path.wat','check-source.py']:
 p='docs/re-notes/shadow-man-null-arming-independent-accept-20261023/'+f;blobs[p]=(D/p).read_bytes()
size=lambda p:sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
A={'candidate':C,'review':'ff5156adfe3b8708bf15f5689cd02ce928a5fc62','parts':{'gitObjects':size(D/'.git/objects'),'source':sum(map(len,blobs.values())),'metadata':2097152,'outputsTempGrowth':12582912,'reserve':8388608},'cap':67108864,'freeFloor':2982150144,'freeBefore':shutil.disk_usage(O.parent).free,'manifest':[{'path':f,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for f,b in blobs.items()],'standingTools':old['standingTools'],'readOnlyDonors':[{'path':str(D),'bytes':size(D)},*old['readOnlyDonors']]}
compiler=pathlib.Path('/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools');A['standingCompiler']=[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [compiler/'watx.js',*sorted((compiler/'watx-src').glob('*.js'))]]
A['projectedPeak']=sum(A['parts'].values());assert A['projectedPeak']<A['cap'];assert A['freeBefore']-A['projectedPeak']>A['freeFloor'];assert not O.exists();print(json.dumps({k:v for k,v in A.items() if k not in ['manifest','standingCompiler']},indent=2),flush=True)
O.mkdir();shutil.copytree(D/'.git/objects',O/'.git/objects');subprocess.run(['git','init',str(O)],check=True,stdout=subprocess.DEVNULL)
def own(*a):return subprocess.check_output(['git','-C',str(O),*a],env=env)
own('config','user.name','Wine bounded worker');own('config','user.email','wine-worker@local');own('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');own('update-ref','refs/heads/task/shadow-man-fresh-selection-repair-oct23',C);own('symbolic-ref','HEAD','refs/heads/task/shadow-man-fresh-selection-repair-oct23');own('read-tree',C)
for f,b in blobs.items():
 p=O/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
E=O/'docs/re-notes/shadow-man-fresh-selection-repair-20261023';E.mkdir(parents=True);(E/'admission.json').write_text(json.dumps(A,indent=2)+'\n');shutil.copyfile('/tmp/shadow-fresh-setup.py',E/'setup.py')

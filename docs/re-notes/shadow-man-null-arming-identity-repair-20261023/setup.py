import pathlib,subprocess,os,shutil,json,hashlib
D=pathlib.Path('/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23'); O=pathlib.Path('/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23'); E={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*a):return subprocess.check_output(['git','-C',str(D),*a],env=E)
files=['CLAUDE.md','AGENTS.md','tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs','test/test-shadow-man-null-capture.cjs','test/run.js','tools/callback-ownership-census.js','tools/test-tiers.js','tools/check-test-timeouts.js','tools/check-test-manifest.sh']+['src/'+x for x in ['13-exports.wat','09c3a-dialog-runtime.wat','09b-dispatch.wat']]
C='6d145e98589caeab2d43c4bb54297d90c248b9de'
# Discover exact ledger/timeout inputs without materialization.
names=git('ls-tree','-r','--name-only',C).decode().splitlines()
files+= [x for x in names if ('callback-ownership-census' in x and x.endswith('.json')) or ('timeout' in x and x.endswith('.json'))]
blobs={}
for x in files:
 r=subprocess.run(['git','-C',str(D),'show',C+':'+x],env=E,capture_output=True)
 if r.returncode==0: blobs[x]=r.stdout
 else:
  expected=git('ls-tree',C,'--',x).decode().split()[2]
  rr=subprocess.run(['git','-C','/home/user/wine-assembly','cat-file','blob',expected],env=E,capture_output=True)
  b=rr.stdout if rr.returncode==0 else ((D/x).read_bytes() if (D/x).exists() else (pathlib.Path('/home/user/wine-assembly')/x).read_bytes())
  oid=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
  expected=git('ls-tree',C,'--',x).decode().split()[2]
  assert oid==expected,(x,oid,expected)
  blobs[x]=b
size=lambda p:sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
A={'candidate':C,'review':'43a1d1d7b8c0418cdc1d61f646e2ea5150a318c4','cap':67108864,'freeFloor':2982150144,'freeBefore':shutil.disk_usage(O.parent).free,'parts':{'objects':size(D/'.git/objects'),'metadataAllowance':1048576,'focusedFiles':sum(map(len,blobs.values())),'testEvidenceTempGrowth':12582912,'reserve':8388608},'manifest':[{'path':x,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for x,b in blobs.items()],'standingTools':{},'readOnlyDonor':{'path':str(D),'bytes':size(D)},'standingCompiler':{'path':str(D/'tools/watx.js'),'files':[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [D/'tools/watx.js',*sorted((D/'tools/watx-src').glob('*.js'))]]}}
for n in ['node','python3','git','ssh','bash']:
 p=pathlib.Path(shutil.which(n)).resolve();A['standingTools'][n]={'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
A['projectedPeak']=sum(A['parts'].values());assert A['projectedPeak']<A['cap'];assert A['freeBefore']-A['projectedPeak']>A['freeFloor'];assert not O.exists();print(json.dumps(A,indent=2))
O.mkdir();shutil.copytree(D/'.git/objects',O/'.git/objects');subprocess.run(['git','init',str(O)],check=True,stdout=subprocess.DEVNULL)
def own(*a):return subprocess.check_output(['git','-C',str(O),*a],env=E)
own('config','user.name','Wine bounded worker');own('config','user.email','wine-worker@local');own('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');own('update-ref','refs/heads/task/shadow-man-null-arming-identity-repair-oct23',C);own('symbolic-ref','HEAD','refs/heads/task/shadow-man-null-arming-identity-repair-oct23');own('read-tree',C)
for x,b in blobs.items():
 p=O/x;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
P=O/'docs/re-notes/shadow-man-null-arming-identity-repair-20261023';P.mkdir(parents=True);(P/'admission.json').write_text(json.dumps(A,indent=2)+'\n');shutil.copyfile('/tmp/shadow-arm-setup.py',P/'setup.py')

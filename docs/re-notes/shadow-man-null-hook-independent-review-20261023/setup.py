import pathlib,os,json,subprocess,shutil,hashlib
r=pathlib.Path('/home/user/wine-assembly');d=pathlib.Path(str(r)+'-shadow-man-null-capture-mechanism-oct23');o=pathlib.Path(str(r)+'-shadow-man-null-hook-independent-review-oct23')
E={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*a):return subprocess.check_output(['git','-C',str(d),*a],env=E)
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
files=['tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs','test/test-shadow-man-null-capture.cjs','src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','test/run.js','tools/watx.js']+['tools/watx-src/'+x for x in ['compiler.js','compiler-parser.js','compiler-stages.js','compiler-codegen.js']]
a={'cap':67108864,'floor':2982150144,'freeBefore':shutil.disk_usage(r).free,'parts':{'gitObjects':size(d/'.git/objects'),'gitMetadataAllowance':1048576,'focusedFiles':sum((d/x).stat().st_size for x in files),'testEvidenceTempAllowance':8388608,'reserve':8388608},'donor':{'path':str(d),'bytes':size(d),'commit':git('rev-parse','HEAD').decode().strip()},'standingTools':{}}
for n in ['node','python3','git','ssh','bash']:
 p=pathlib.Path(shutil.which(n)).resolve();a['standingTools'][n]={'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
a['projectedWhole']=sum(a['parts'].values());assert a['projectedWhole']<a['cap'];assert a['freeBefore']-a['projectedWhole']>a['floor'];assert not o.exists()
pathlib.Path('/tmp/shadow-null-independent-admission.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps(a,indent=2))
o.mkdir();shutil.copytree(d/'.git/objects',o/'.git/objects');subprocess.run(['git','init',str(o)],check=True,stdout=subprocess.DEVNULL)
def own(*a):return subprocess.check_output(['git','-C',str(o),*a],env=E)
own('config','user.name','Wine independent review');own('config','user.email','wine-worker@local');own('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');own('update-ref','refs/heads/task/shadow-man-null-hook-independent-review-oct23',a['donor']['commit']);own('symbolic-ref','HEAD','refs/heads/task/shadow-man-null-hook-independent-review-oct23')
for x in files:
 p=o/x;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(d/x,p)
e=o/'docs/re-notes/shadow-man-null-hook-independent-review-20261023';e.mkdir(parents=True);shutil.copyfile('/tmp/shadow-null-independent-admission.json',e/'admission.json');shutil.copyfile('/tmp/shadow-null-independent-setup.py',e/'setup.py')

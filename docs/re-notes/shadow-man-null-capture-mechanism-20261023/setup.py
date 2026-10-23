import pathlib,os,json,subprocess,shutil,hashlib
r=pathlib.Path('/home/user/wine-assembly'); d=pathlib.Path(str(r)+'-shadow-man-null-exit-diagnosis-oct23'); p=pathlib.Path(str(r)+'-shadow-man-null-boundary-capture-preflight-oct23'); o=pathlib.Path(str(r)+'-shadow-man-null-capture-mechanism-oct23')
def size(p):return sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
files=['tools/watx.js']+['tools/watx-src/'+x for x in ['compiler.js','compiler-parser.js','compiler-stages.js','compiler-codegen.js']]
src=['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','test/run.js']
env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
def git(*a):return subprocess.check_output(['git','-C',str(d),*a],env=env)
manifest={'cap':67108864,'floor':2982150144,'freeBefore':shutil.disk_usage(r).free,'parts':{'ownGitProjected':size(d/'.git')+2097152,'focusedSourcesTools':sum((d/x).stat().st_size for x in src)+sum((r/x).stat().st_size for x in files),'implementationEvidenceTempAllowance':8388608,'reserve':8388608},'readOnlyDonors':{str(d):size(d),str(p):size(p)},'standingHostTools':{}}
for x in ['/home/user/.nvm/versions/node/v24.18.1/bin/node','/usr/bin/python3','/usr/bin/git','/usr/bin/ssh','/usr/bin/bash']:
 q=pathlib.Path(x).resolve();manifest['standingHostTools'][str(q)]={'bytes':q.stat().st_size,'sha256':hashlib.sha256(q.read_bytes()).hexdigest()}
manifest['sourcePins']={x:git('rev-parse','58e90870a40a541a4083cae5e987ca8de31889e6:'+x).decode().strip() for x in src}
manifest['projectedWhole']=sum(manifest['parts'].values());assert manifest['projectedWhole']<manifest['cap'];assert manifest['freeBefore']-manifest['projectedWhole']>manifest['floor'];assert not o.exists()
# Manifest is measured/written BEFORE creation of the isolated checkout.
pathlib.Path('/tmp/shadow-null-admission.json').write_text(json.dumps(manifest,indent=2)+'\n'); print(json.dumps(manifest,indent=2))
o.mkdir();shutil.copytree(d/'.git/objects',o/'.git/objects');subprocess.run(['git','init',str(o)],check=True,stdout=subprocess.DEVNULL)
def own(*a):return subprocess.check_output(['git','-C',str(o),*a],env=env)
own('config','user.name','Wine diagnostic worker');own('config','user.email','wine-worker@local');own('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');own('update-ref','refs/heads/task/shadow-man-null-capture-mechanism-oct23','bb9c496ed13095cc832fdf607f0937fb9c14b7de');own('symbolic-ref','HEAD','refs/heads/task/shadow-man-null-capture-mechanism-oct23')
for x in src+files:
 target=o/x;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile((d if x in src else r)/x,target)
out=o/'docs/re-notes/shadow-man-null-capture-mechanism-20261023';out.mkdir(parents=True);shutil.copyfile('/tmp/shadow-null-admission.json',out/'admission.json');shutil.copyfile('/tmp/shadow-null-setup.py',out/'setup.py')

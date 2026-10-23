import pathlib,subprocess,os,shutil,json,hashlib
D=pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23'); O=pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-independent-accept-oct23'); C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
env={**os.environ,'GIT_NO_LAZY_FETCH':'1'}
files=['AGENTS.md','CLAUDE.md','test/run.js','test/shadow-man-null-fresh-selection.cjs','test/test-shadow-man-null-capture.js','tools/shadow-man-null-capture.cjs','tools/shadow-man-null-preload.cjs','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat','src/13-exports.wat','tools/callback-ownership-census.json','tools/callback-ownership-census.js','tools/test-tiers.js','tools/test-timeouts.json']
blobs={f:subprocess.check_output(['git','-C',str(D),'show',C+':'+f],env=env) for f in files}
size=lambda p:sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
identity=lambda p:{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
prior=json.loads((D/'docs/re-notes/shadow-man-fresh-selection-repair-20261023/admission.json').read_text())
tools=[identity(pathlib.Path(shutil.which(t)).resolve()) for t in ['node','python3','git','ssh','bash']]
compiler=[identity(pathlib.Path(x['path'])) for x in prior['standingCompiler']]
A={'candidate':C,'review':'ff5156adfe3b8708bf15f5689cd02ce928a5fc62','parts':{'gitObjects':size(D/'.git/objects'),'source':sum(map(len,blobs.values())),'metadataGrowth':2097152,'outputTempGrowth':12582912,'reserve':8388608},'manifest':[{'path':f,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for f,b in blobs.items()],'standingTools':tools,'standingCompiler':compiler,'readOnlyDonors':[{'path':str(p),'bytes':size(p)} for p in [D,pathlib.Path('/home/user/wine-assembly-shadow-man-null-arming-identity-repair-oct23'),pathlib.Path('/home/user/wine-assembly-shadow-man-null-arming-independent-accept-oct23'),pathlib.Path('/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23')]],'freeBefore':shutil.disk_usage(O.parent).free,'cap':67108864,'floor':2982150144}
A['projectedPeak']=sum(A['parts'].values());assert A['projectedPeak']<A['cap'];assert A['freeBefore']-A['projectedPeak']>=A['floor'];assert not O.exists();print(json.dumps({'projectedPeak':A['projectedPeak'],'freeBefore':A['freeBefore'],'verdict':'PASS BEFORE CHECKOUT'}),flush=True)
O.mkdir();shutil.copytree(D/'.git/objects',O/'.git/objects');subprocess.run(['git','init','-q',str(O)],check=True)
def own(*a):return subprocess.check_output(['git','-C',str(O),*a],env=env)
own('config','user.name','Wine bounded worker');own('config','user.email','wine-worker@local');own('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');own('update-ref','refs/heads/task/shadow-man-fresh-selection-independent-accept-oct23',C);own('symbolic-ref','HEAD','refs/heads/task/shadow-man-fresh-selection-independent-accept-oct23');own('read-tree',C)
for f,b in blobs.items():
 p=O/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
E=O/'docs/re-notes/shadow-man-fresh-selection-independent-accept-20261023';E.mkdir(parents=True);(E/'admission.json').write_text(json.dumps(A,indent=2)+'\n');shutil.copyfile(__file__,E/'setup.py')

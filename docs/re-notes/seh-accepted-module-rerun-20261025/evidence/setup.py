import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/seh-trust-anchor-independent-closeout-oct25/repo')
C='ae188c981dad2337050acf88d74d567d5644c367';TREE='755d5831544556b5e9333b57863a4502ca6a1736';BR='task/seh-accepted-module-rerun-oct25'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
E=dict(os.environ,GIT_SSH_COMMAND=SSH)
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def git(r,*a):
 p=subprocess.run(['git','-C',str(r),*a],env=E,capture_output=True,timeout=55);assert len(p.stdout)+len(p.stderr)<=131072;assert p.returncode==0 and not p.stderr,(a,p.returncode,p.stderr[:1000]);return p.stdout
assert json.load(open(O/'admission-precheckout.json'))['passAdmission']
trusted=json.load(open('/tmp/seh-current-canonical-qualifier-oct25/ops/trusted-configuration.json'))
assert trusted['SSH']==SSH and trusted['mountArgv']==[] and trusted['intendedFiles']==[]
save('trusted-configuration.json',dict(SSH=SSH,reusedReceipt=dict(path='/tmp/seh-current-canonical-qualifier-oct25/ops/trusted-configuration.json',sha256=sha(pathlib.Path('/tmp/seh-current-canonical-qualifier-oct25/ops/trusted-configuration.json').read_bytes())),mountArgv=[],intendedFiles=[],validation='Exact unchanged empty configuration; no mount command or conditional guest execution. Canonical filename parser not applicable to zero mount arguments.',box=None,state='notassigned',expiry=None,protectedBox='bx_69aem736 untouched'))
view=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json'));stores=[x['view'] for x in view['sources']]
stores+=json.load(open('/tmp/seh-trust-anchor-independent-closeout-oct25/ops/checkout.json'))['stores']
leaf=O/'accepted-leaf';leaf.mkdir()
for p in (D/'.git/objects').iterdir():
 if p.name!='info':(leaf/p.name).symlink_to(p,target_is_directory=p.is_dir())
stores=list(dict.fromkeys(stores+[str(leaf)]));assert all(not (pathlib.Path(s)/'info/alternates').exists() for s in stores)
E.update(GIT_OBJECT_DIRECTORY=str(leaf),GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(stores[:-1]))
assert git(D,'rev-parse',C+'^{commit}').decode().strip()==C
assert git(D,'rev-parse',C+'^{tree}').decode().strip()==TREE
f='docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs';h='c4f2d1383bb7fa253b2134443548820a4b6cd40991c4581cdd10d5a8db97cf70'
assert sha(git(D,'cat-file','blob',C+':'+f))==h and sha((D/f).read_bytes())==h
E.pop('GIT_OBJECT_DIRECTORY');E.pop('GIT_ALTERNATE_OBJECT_DIRECTORIES')
p=subprocess.run(['git','init','-q',str(R)],env=E,capture_output=True,timeout=55);assert p.returncode==0
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
for k,v in [('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('gc.auto','0'),('user.name','Wine Ops'),('user.email','wine-ops@localhost')]:git(R,'config',k,v)
new='docs/re-notes/seh-accepted-module-rerun-20261025/'
(R/'.git/info/sparse-checkout').write_text('/'+f+'\n/'+new+'\n')
git(R,'remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git(R,'checkout','-q','-b',BR,C)
assert sha((R/f).read_bytes())==h
pins=[('/tmp/seh-current-canonical-qualifier-oct25/ops/contract.json','4aca68bf97038d771390dd499703fac2e559146186d23f34e6e27425a5083a4b'),('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs','47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'),('/tmp/seh-corrected-memory-canonical-build-oct25/ops/wine-assembly.wasm','bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9'),('/tmp/seh-corrected-memory-canonical-build-oct25/ops/wine-assembly.compat.wasm','ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc')]
rows=[]
for p,h in pins+[(str(R/f),h)]:
 b=pathlib.Path(p).read_bytes();assert sha(b)==h;rows.append(dict(path=p,sha256=h,bytes=len(b),usedInPlace=True))
assert rows[2]['bytes']==1880317 and rows[3]['bytes']==1882890
review=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/seh-trust-anchor-closeout-coordinator-review-oct25.json');rv=json.loads(review.read_bytes());assert rv['commit']==C and rv['manifestVerifiedFiles']==198 and not rv['errors']
save('pinned-inputs.json',dict(qualifierRevision=C,qualifierTree=TREE,sourceRevision='a3fe340b962da3f31df249881074afe41d6c69a2',compiledBuildEvidence='9d85af30e9ed0c19bac7f9ba99d1b540a508f4e4',inputs=rows,acceptedStaticEvidence=dict(path=str(review),sha256=sha(review.read_bytes()),verifiedFiles=198,repeated=False),historicalNativeReturns='separately retained in prior qualifier ops; predate trust-anchor repair'))
save('checkout.json',dict(base=C,tree=TREE,branch=BR,sparsePaths=[f,new],ownObjects=str(R/'.git/objects'),nonrecursiveStores=stores,donorsReadonly=True))
print('Pinned accepted commit/tree/driver/contract/guard/both modules PASS; sparse checkout complete')

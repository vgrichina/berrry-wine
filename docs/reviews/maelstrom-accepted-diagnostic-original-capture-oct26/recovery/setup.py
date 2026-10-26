import pathlib,json,os,subprocess,hashlib,shutil,zlib,time,importlib.util
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');D=pathlib.Path('/tmp/maelstrom-terminal-closure-accepted-integrate-oct26/repo');S=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25');REV='44e344fdb26daab9a07210656597902ba27cb5f7'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH)
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def dg(*a):return subprocess.check_output(['git','-C',str(D),*a])
pins=json.load(open(ROOT/'scratch/usage-watch'/ (H.name+'-dispatch.json')))
checked=[]
for x in pins['pins']:
 b=dg('show',REV+':'+x['path']) if 'donor' in x else pathlib.Path(x['path']).read_bytes()
 assert sha(b)==x['sha256'] and len(b)==x['bytes'],x['path'];checked.append(x)
save('pins.json',checked)
schedule=json.load(open(ROOT/'scratch/usage-watch'/(H.name+'.runtime.json')));save('schedule.json',schedule)
probe=json.load(open(O/'api-transfer-probe.json'));rr=json.loads(probe['stdout']);assert rr['probeOK'] and rr['uid']==1000 and rr['memAvailable']>=2684354560
# Actual filename parser and canonical effective-size checks before checkout.
src=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text()
args=json.load(open(S/'guest-args.json'));args=[x for x in args if not x.startswith('--maelstrom-select-frozen-record=')]
canonical=pathlib.Path('/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py');assert sha(canonical.read_bytes())=='0ffbfdee6d64f66613731e8a4fbc00883320ee623cdd9bc45c66362b81067394'
spec=importlib.util.spec_from_file_location('canonical',canonical);c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
effective=c.effective_sizes(src,[args[:2]+['inert-placeholder']+args[2:]]);assert effective[0]['size']==1000
parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(3);'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),dlls:getArgs("dlls"),mounts:getArgs("vfs-mount"),input:getArg("input")}))'
argfile=O/'standing-argv.json';argfile.write_text(json.dumps(args));p=subprocess.run(['node','--max-old-space-size=256','-e',code,str(argfile)],capture_output=True,text=True,timeout=30);assert p.returncode==0,p.stderr
parsed=json.loads(p.stdout);assert parsed['tree']==[str(S/'vfs')] and parsed['mounts']==[]
m=json.load(open(S/'manifest.json'));intended=[]
for x in m:
 b=pathlib.Path(x['path']).read_bytes();assert sha(b)==x['sha256'] and len(b)==x['bytes'],x['target']
 if x['target'].startswith('vfs/'):intended.append(dict(target=x['target'],bytes=len(b),sha256=sha(b),guest='C:\\'+x['target'][4:].replace('/','\\')))
assert len(intended)==48 and any(',' in x['target'] for x in intended)
save('mount-precheckout.json',dict(effective=effective,parser=parsed,intended=intended,canonicalSHA256=sha(canonical.read_bytes()),allConsumedManifestFilesVerified=len(m),passChecks=True))
save('configuration.json',dict(ssh=SSH,donor=str(D),revision=REV,sourceTree=dg('rev-parse',REV+'^{tree}').decode().strip()))
assert json.load(open(O/'resource-initial.json'))['pass']
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],env=env).decode().strip()
# One standing flat leaf; recover only exact missing commit/tree/selected blobs.
(R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n')
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-select-completion-hook.cjs']
ids={REV:'commit'}
for line in dg('ls-tree','-rt',REV).decode().splitlines():
 meta,path=line.split('\t',1);mode,kind,oid=meta.split()
 if kind=='tree' or path in selected:ids[oid]=kind
tree=dg('rev-parse',REV+'^{tree}').decode().strip();ids[tree]='tree'
# Keep missing ancestry commits available for normal thin publication.
for oid in dg('rev-list',REV,'--not',subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD']).decode().strip()).decode().splitlines():ids[oid]='commit'
copied=[]
for oid,kind in ids.items():
 q=subprocess.run(['git','-C',str(R),'cat-file','-e',oid],stderr=subprocess.DEVNULL)
 if q.returncode==0:continue
 b=dg('cat-file',kind,oid);raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 dest=R/'.git/objects'/oid[:2]/oid[2:];dest.parent.mkdir(exist_ok=True);dest.write_bytes(zlib.compress(raw));copied.append(dict(oid=oid,kind=kind,bytes=dest.stat().st_size))
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+x for x in selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,REV);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for k in ['user.name','user.email']:git('config',k,dg('config',k).decode().strip())
save('checkout.json',dict(revision=REV,tree=tree,selected=selected,flatAlternates=[str(ROOT/'.git/objects')],recovered=copied,noFetch=True,noClone=True,noRepack=True))
save('checkpoint-inputs.json',dict(candidate=REV,pins=True,mount=True,resource=True,checkout=True,guestAttempts=0))
print(json.dumps(dict(pins=len(checked),manifest=len(m),mounts=len(intended),copiedObjects=len(copied),checkout=True)))

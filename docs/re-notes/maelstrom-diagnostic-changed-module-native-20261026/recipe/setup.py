import pathlib,json,os,hashlib,subprocess,shutil,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');C=pathlib.Path('/home/user/.codex');D=pathlib.Path('/tmp/maelstrom-terminal-closure-accepted-integrate-oct26/repo')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def git(*a,cwd=R):return subprocess.check_output(['git',*a],cwd=cwd,env=env,text=True).strip()
save('sqlite-baseline.json',{str(p):p.stat().st_size for p in C.glob('*.sqlite')})
s=(ROOT/'test/run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')];old=json.load(open('/tmp/maelstrom-errno-api-canonical-native-oct25/ops/configuration.json'))
assert hashlib.sha256(parser.encode()).hexdigest()==old['parserSHA256']
out=subprocess.check_output(['node','--max-old-space-size=128','-e','const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}));'],text=True,timeout=60)
assert json.loads(out)=={'tree':[],'mount':[]}
save('configuration.json',dict(ssh=SSH,parserSHA256=old['parserSHA256'],actualArgv=[],intendedFiles=[],validatedInThisTask=True,scope='direct compiled native fixture, no mounts',commaControlReceipt=old['mountReceiptReused']))
a=lambda p:max(p.stat().st_size,p.stat().st_blocks*512)
wal=sum(a(p) for p in C.glob('*.sqlite-*'));free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
charges=dict(checkoutGitViews=4194304,driverFixtureEvidencePublication=4194304,compiledModules=4194304,sessionLauncherDBgrowth=4194304,sharedWALSHM=wal,future=4194304,reserve=8388608)
peak=sum(charges.values());passed=peak<=67108864 and mem>=2684354560 and free-peak>=2982150144
save('admission-precheckout.json',dict(utc=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,minMem=2684354560,free=free,projectedFree=free-peak,diskFloor=2982150144,passed=passed,standing='canonical/compiler/source gzip/anchors/donor object leaves/install executables read in place, zero staged bytes'))
assert passed,'fresh admission failed; stop without retry'
receipt=json.load(open(ROOT/'scratch/usage-watch/maelstrom-diagnostic-changed-module-native-oct26-dispatch.json'))
assert git('rev-parse','HEAD',cwd=D)==receipt['candidate']
for p,h in receipt['pins'].items():assert hashlib.sha256((D/p).read_bytes()).hexdigest()==h,p
for r in receipt['recipes']:assert hashlib.sha256(pathlib.Path(r['path']).read_bytes()).hexdigest()==r['sha256']
save('pinned-inputs.json',receipt)
R.mkdir();git('init','-q',str(R),cwd=H)
obj=D/'.git/objects';leaves=[]
for line in (obj/'info/alternates').read_text().splitlines():
 p=(obj/line).resolve();assert not (p/'info/alternates').exists();leaves.append(p)
leaves.append(obj)
views=[]
for i,p in enumerate(leaves):
 v=O/'v'/str(i);v.mkdir(parents=True);views.append(str(v))
 for q in p.iterdir():
  if q.name=='pack' or (len(q.name)==2 and all(c in '0123456789abcdef' for c in q.name)):(v/q.name).symlink_to(q.resolve(),target_is_directory=True)
(R/'.git/objects/info/alternates').write_text('\n'.join(views)+'\n')
selected=list(receipt['pins'])
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,receipt['candidate']);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD')
for k in ['user.name','user.email']:git('config',k,git('config',k,cwd=D))
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),paths=selected,flattenedViews=len(views),recursiveAlternates=False,clone=False))
subprocess.run(['bash','-c','echo "$(date -Iseconds) maelstrom-diagnostic-changed-module-native-oct26 CLAIM accepted44e344fd exact changed-latch compile/native; isolated repo/ops/taskbranch, root/donors readonly except appendboard; local heavy lock, no box/workers/main integration." >> messageboard.txt'],cwd=ROOT,check=True)
print(subprocess.check_output(['tail','-n','1',str(ROOT/'messageboard.txt')],text=True).strip())
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['timeout','55','tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid,boundedSeconds=55))
print(json.dumps(dict(status='PASS',peak=peak,memAvailable=mem,views=len(views))))

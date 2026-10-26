import pathlib,json,os,hashlib,subprocess,shutil,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');C=pathlib.Path('/home/user/.codex');D=pathlib.Path('/tmp/maelstrom-diagnostic-changed-module-native-oct26/repo')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
def save(n,d):(O/n).write_text(json.dumps(d,indent=2)+'\n')
def git(*a,cwd=R):return subprocess.check_output(['git',*a],cwd=cwd,env=env,text=True,timeout=60).strip()
save('sqlite-baseline.json',{str(p):p.stat().st_size for p in C.glob('*.sqlite')})
s=(ROOT/'test/run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')];old=json.load(open(D.parent/'ops/configuration.json'))
assert hashlib.sha256(parser.encode()).hexdigest()==old['parserSHA256']
out=subprocess.check_output(['node','--max-old-space-size=256','-e','const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}));'],text=True,timeout=60)
assert json.loads(out)=={'tree':[],'mount':[]}
save('configuration.json',dict(ssh=SSH,parserSHA256=old['parserSHA256'],actualArgv=[],intendedFiles=[],validatedInThisTask=True,scope='direct compiled native fixture; no mounts',commaControlReceipt=old['commaControlReceipt']))
receipt=json.load(open(ROOT/'scratch/usage-watch/maelstrom-diagnostic-native-remaining-api-oct26-dispatch.json'))
assert git('rev-parse','HEAD',cwd=D)==receipt['qualificationCandidate']
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','tools/maelstrom-diagnostic-canonical-build.cjs','test/maelstrom-diagnostic-canonical-native.cjs']
inputs=[pathlib.Path(r['path']) for r in receipt['modules']]+[D/p for p in selected]+[D.parent/'ops/static-abi.json']
inputs+=list(map(pathlib.Path,['/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll','/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe','/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll','/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs']))
manifest=[dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in inputs]
for m,r in zip(manifest,receipt['modules']):assert m['sha256']==r['sha256']
for p,k in [(receipt['driverPath'],'driverSHA256'),(receipt['fixturePath'],'fixtureSHA256')]:assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==receipt[k]
save('input-manifest.json',manifest);save('dispatch.json',receipt)
a=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512)
wal=sum(a(p) for p in C.glob('*.sqlite-*'));free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
session=list((C/'sessions/2026/10/26').glob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'));assert len(session)==1
charges=dict(localSparseGitViews=2097152,localScriptsEvidence=3145728,remoteInputs=sum(((m['bytes']+4095)//4096)*4096 for m in manifest if not m['path'].endswith('canonical-build.cjs')),remoteScriptsEvidence=4194304,publicationCopiesGit=4194304,session=a(session[0]),launcher=1048576,sharedWALSHM=wal,sessionDBfuture=4194304,reserve=8388608)
peak=sum(charges.values());passed=peak<=67108864 and mem>=805306368 and free-peak>=2982150144
save('admission-precheckout.json',dict(utc=time.time(),manifest=manifest,charges=charges,peak=peak,cap=67108864,memAvailable=mem,minMem=805306368,free=free,projectedFree=free-peak,diskFloor=2982150144,passed=passed,standing='readonly donor objects/modules/anchors and installed executables in place; newly staged remote bytes charged separately'))
assert passed,'fresh admission failed; stop without retry'
R.mkdir();git('init','-q',str(R),cwd=H)
obj=D/'.git/objects';leaves=[pathlib.Path(p) for p in (obj/'info/alternates').read_text().splitlines()]+[obj];views=[]
for i,p in enumerate(leaves):
 assert not (p/'info/alternates').exists() or p==obj
 v=O/'v'/str(i);v.mkdir(parents=True);views.append(str(v))
 for q in p.iterdir():
  if q.name=='pack' or (len(q.name)==2 and all(c in '0123456789abcdef' for c in q.name)):(v/q.name).symlink_to(q.resolve(),target_is_directory=True)
(R/'.git/objects/info/alternates').write_text('\n'.join(views)+'\n')
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,receipt['qualificationCandidate']);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD')
for k in ['user.name','user.email']:git('config',k,git('config',k,cwd=D))
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
save('checkout.json',dict(candidate=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),paths=selected,flattenedViews=len(views),recursiveAlternates=False,clone=False))
shutil.copyfile(ROOT/'scratch/usage-watch/maelstrom-diagnostic-native-remaining-api-oct26.task.runtime.json',O/'runtime.json')
subprocess.run(['bash','-c','echo "$(date -Iseconds) maelstrom-diagnostic-native-remaining-api-oct26 CLAIM remaining exact44e344fd native only; isolated repo/ops/taskbranch, donor/root readonly except appendboard; APIexec bx_7qwjxps7 exclusive heavy qualification lock; leave running coordinator shutdown. No workers/main." >> messageboard.txt'],cwd=ROOT,check=True)
print(subprocess.check_output(['tail','-n','1',str(ROOT/'messageboard.txt')],text=True).strip())
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['timeout','55','tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid,boundedSeconds=55))
print(json.dumps(dict(status='PASS',peak=peak,memAvailable=mem,views=len(views))))

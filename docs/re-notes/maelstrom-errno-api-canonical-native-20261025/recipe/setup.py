import pathlib,subprocess,json,os,hashlib,time,shutil,gzip,base64
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-native-errno-snapshot-independent-closeout-oct25/repo')
C=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23')
REV='eeb4b3372c8b18361dae83509652b67281f67d0c';BRANCH='task/maelstrom-errno-api-canonical-native-oct25'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH)
def git(*args,cwd=D):return subprocess.check_output(['git',*args],cwd=cwd,env=ENV).decode().strip()
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
assert git('rev-parse','HEAD')==REV
assert git('rev-parse',REV+'^{tree}')=='ce75c16793ef8ee9fdde24a8a4e60d34a72943a8'
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-native-errno-source-snapshot.test.cjs','test/maelstrom-select-hook-model.cjs']
projection=[dict(path=p,bytes=int(git('cat-file','-s',REV+':'+p))) for p in selected]
save('sparse-projection.json',dict(paths=projection,bytes=sum(x['bytes'] for x in projection),nonCone=True,fullTree=False))
dispatch=json.load(open('/home/user/wine-assembly/scratch/usage-watch/maelstrom-native-errno-disk-recovered-canonical-native-oct25-dispatch.json'))
for row in dispatch['pins']:
 b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
m=json.load(open(C/'docs/re-notes/shadow-man-span-static-canonical-20261023/manifest.json'))
for row in m['files']:
 b=(C/row['path']).read_bytes();assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
save('pinned-inputs.json',dict(status='PASS',canonicalCurrentHEAD=git('rev-parse','HEAD',cwd=C),historicalManifestRevision=m['candidate'],acceptedDonor=REV,dispatchPins=len(dispatch['pins']),closureFiles=len(m['files']),closureBytes=sum(x['bytes'] for x in m['files']),pins=dispatch['pins']))
# Exact production argv contains no filesystem mounts. Reuse accepted unchanged parser receipt.
receipt=json.load(open('/tmp/maelstrom-event-observer-native-qualification-oct24/ops/mount-parser.json'))
s=pathlib.Path('/home/user/wine-assembly/test/run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
assert hashlib.sha256(parser.encode()).hexdigest()==receipt['parserSHA256']
js='const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}));'
p=subprocess.run(['node','--max-old-space-size=256','-e',js],capture_output=True,text=True,timeout=60);assert p.returncode==0,p.stderr
assert json.loads(p.stdout)==receipt['actualParsed'] and receipt['actualArgv']==[] and receipt['intendedFiles']==[]
save('configuration.json',dict(ssh=SSH,parserSHA256=receipt['parserSHA256'],mountReceiptReused=receipt,validatedInThisTask=True,actualMountArgv=[],intendedFiles=[],box='bx_k38z8byn'))
# Conservative measured disk projection, including all shared WAL and this full session.
codex=pathlib.Path('/home/user/.codex')
def n(p):return max(p.stat().st_size,p.stat().st_blocks*512)
wal=[dict(path=str(p),bytes=n(p)) for p in codex.glob('*.sqlite-wal')]
session=list((codex/'sessions/2026/10/25').glob('*01a17571-c3ee-7aa3-b392-95a660b7f8a7.jsonl'))
launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-errno-api-canonical-native-oct25')
bundle=gzip.compress(json.dumps({r['path']:base64.b64encode((C/r['path']).read_bytes()).decode() for r in m['files'] if r['path'].startswith('src/')},separators=(',',':')).encode(),mtime=0)
save('compressed-projection.json',dict(sourceFiles=128,expandedSourceBytes=sum(r['bytes'] for r in m['files'] if r['path'].startswith('src/')),compressedSourceBytes=len(bundle),bundleSHA256=hashlib.sha256(bundle).hexdigest(),mechanism='decode authentic bytes into canonical three-alias VFS in memory, never materialize source tree',unchangedCompilerHelperSHA256=next(r['sha256'] for r in m['files'] if r['path']=='tools/watx-closure.js')))
charges=dict(remoteCompiler=sum(((r['bytes']+4095)//4096)*4096 for r in m['files'] if not r['path'].startswith('src/')),remoteSourceBundle=((len(bundle)+4095)//4096)*4096,localSourceBundle=((len(bundle)+4095)//4096)*4096,remoteAuthenticAnchors=450560,remoteBothModules=4194304,localSparseGit=2097152,localScriptsEvidence=1048576,remoteScriptsEvidence=1048576,publicationGit=1048576,session=sum(n(p) for p in session),launcher=sum(n(p) for p in launcher.rglob('*') if p.is_file()),sharedWAL=sum(x['bytes'] for x in wal),futureExternalDB=4194304,reserve=8388608,transferFiles=262144,localModules=0)
free=shutil.disk_usage(H).free;mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
peak=sum(charges.values());a=dict(charges=charges,peak=peak,cap=67108864,wal=wal,free=free,projectedLocalFloor=free-peak,memAvailable=mem,localMinimum=1073741824,passChecks=peak<=67108864 and free-peak>=2982150144 and mem>=1073741824,projection='no local module copies; binary static inspection in memory; in-memory compressed per-file APIexec; remote module output additionally capped 2MiB each')
if (O/'admission-precheckout.json').exists():shutil.copyfile(O/'admission-precheckout.json',O/'admission-expanded-projection-rejected.json')
save('admission-precheckout.json',a);print(json.dumps(a));assert a['passChecks'],'precise allocation blocker'
(O/'sources.json.gz').write_bytes(bundle)
save('sqlite-baseline.json',{str(p):p.stat().st_size for p in codex.glob('*.sqlite')})
seen=set();order=[]
def visit(p):
 p=p.resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else pathlib.Path(line))
 order.append(str(p))
visit(D/'.git/objects');R.mkdir();git('init','-q',str(R));(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
git('config','core.sparseCheckout','true',cwd=R);git('config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('update-ref','refs/heads/'+BRANCH,REV,cwd=R);git('symbolic-ref','HEAD','refs/heads/'+BRANCH,cwd=R);git('read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:git('config',k,git('config',k),cwd=R)
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
save('checkout.json',dict(revision=REV,branch=BRANCH,selected=projection,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid))
with open('/home/user/wine-assembly/messageboard.txt','a') as f:f.write(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+' maelstrom-errno-api-canonical-native CLAIM task branch '+BRANCH+' own '+str(H)+' remote /home/user/maelstrom-errno-api-canonical-native-oct25 sole runtime bx_k38z8byn; APIexec only, no original game/main/children; coordinator shutdown.\n')
print(json.dumps(dict(checkout='PASS',paths=len(selected),branch=BRANCH)))

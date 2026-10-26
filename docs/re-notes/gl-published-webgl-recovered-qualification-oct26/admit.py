import pathlib,os,json,hashlib,shutil,datetime,resource
P=pathlib.Path; M=1048576
ROOT=P('/home/user/wine-assembly'); H=P('/tmp/gl-published-webgl-recovered-qualification-oct26'); O=H/'ops'; task=H.name
A=json.loads((ROOT/('scratch/usage-watch/'+task+'-admission.json')).read_text())
def alloc(p):
 try:return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if not q.is_symlink())
 except FileNotFoundError:return 0
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
plan=json.loads((ROOT/'scratch/usage-watch/gl-palette-current-webgl-closure-plan-oct26.json').read_text())
assert len(plan['files'])==149 and not plan['missing']
for r in plan['files']:
 p=P(A['sourceRoot'])/r['path']; b=p.read_bytes()
 assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['blob'],r['path']
for name,h in A['acceptedProductionPins'].items():assert sha(P(A['acceptedFixtureRoot'])/name)==h,name
publication=json.loads(P('/tmp/gl-accepted-rss-main-publication-oct26/ops/publication.json').read_text())
assert publication['commit']==A['candidate'] and publication['tree']=='ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce'
chrome=P('/opt/google/chrome/chrome')
with chrome.open('rb') as f:assert f.read(4)==b'\x7fELF'
assert os.access(chrome,os.X_OK)
assert sha(chrome)=='22e4d5ef0c637a87b59a9baad42625aba3284dc03d4a5908748e253556318c97'
save('pinned-inputs.json',dict(candidate=A['candidate'],tree=publication['tree'],sourcePlan=str(ROOT/'scratch/usage-watch/gl-palette-current-webgl-closure-plan-oct26.json'),sourcePlanSHA256=sha(ROOT/'scratch/usage-watch/gl-palette-current-webgl-closure-plan-oct26.json'),verifiedSourceFiles=149,verifiedFixtureFiles=A['acceptedProductionPins'],chrome=str(chrome),chromeSHA256=sha(chrome),chromeELF=True,moduleBytesRetained=False,expectedCompiledModule=A['moduleExpectedSHA256'],priorRuntimeAcceptance=False,independentAcceptance='1e19d8c01e5d7e40f1e8ad60df5079ee9d9d4d4e'))
# No mount operations are proposed. Retain the unchanged canonical parser receipt,
# whose empty filename-bearing mount argv and dedicated trusted SSH are identical.
mount=json.loads(P('/tmp/gl-palette-current-webgl-qualification-oct26/ops/mount-configuration.json').read_text())
src=(ROOT/'test/run.js').read_text(); parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
assert hashlib.sha256(parser.encode()).hexdigest()==mount['parserSHA256']
assert mount['argv']==mount['enumeration']==mount['commaFilenames']==[]
assert mount['trustedSSH']=='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
save('launch-configuration.json',dict(reusedExactEmptyMountReceipt=mount,parserRehashed=True,chromeExplicitELF=str(chrome),rootRefReceipt=str(ROOT/('scratch/usage-watch/'+task+'/root-ref-digest.json')),noGitOrNodeYet=True))
clients=[];physical=[]
for p in P('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  args=(p/'cmdline').read_bytes().split(b'\0'); st=(p/'stat').read_text(); v=st[st.rindex(')')+2:].split();rss=max(0,int(v[21]))*os.sysconf('SC_PAGE_SIZE')
  if args and b'/bin/codex' in args[0] and b'exec' in args:
   clients.append(dict(pid=int(p.name),rss=rss,own=os.environ['CODEX_THREAD_ID'].encode() in (p/'environ').read_bytes()))
  if rss>=64*M:physical.append(dict(pid=int(p.name),ppid=int(v[1]),rss=rss,exe=os.readlink(p/'exe')))
 except (OSError,ValueError,IndexError):pass
# All clients already resident; MemAvailable already deducts their physical RSS.
growth=sum(max(0,320*M-r['rss']) for r in clients)
components=dict(host=768*M,ownNodeBrowserSupervisor=1024*M,otherActualLightGit=512*M,remoteControllerHelpers=128*M,actualResidentClientRemainingGrowth=growth,completedCivGuest=0,completedCivPublication=0,prospectiveOwnClient=0)
required=max(3489660928,sum(components.values()))
roots=[H,ROOT/('scratch/usage-watch/'+task),P('/tmp/gl-palette-current-webgl-qualification-oct26'),P('/tmp/gl-accepted-rss-main-publication-oct26')]
roots.extend(P('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
charges={str(p):alloc(p) for p in roots}
charges['positiveWALOnce']=sum(max(0,alloc(P(p))-n) for p,n in A['walBaseline'].items())
charges.update(futureSelectiveGitLocalRemote=16*M,futureProfileFixtureOutputs=32*M,futureSessionEventsPublication=32*M,reserve=8*M)
projection=sum(charges.values());future=88*M
mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
free=shutil.disk_usage(H).free
rec=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),singleFreshImmediateExecutionAdmission=True,clients=clients,physicalProcessesOver64MiB=physical,ramComponents=components,memAvailable=mem,requiredBytes=required,clientGrowthChargedOnce=True,ownClientResident=True,charges=charges,totalProjected=projection,cap=192*M,freeDisk=free,projectedFree=free-future,hostDiskFloor=2982150144,standingReadonlyExcluded=['/opt/google/chrome','/tmp/wa-local-runtime-deps/node_modules'],limits=dict(physicalSubtree=1024*M,NodeHeapMiB=512,CPU=90,wall=120,file=24*M,output=2*M,excerpt=8192,GitDATAChildOnly=512*M,parentDATA=resource.getrlimit(resource.RLIMIT_DATA),parentAS=resource.getrlimit(resource.RLIMIT_AS)),boxes=[],noRuntimeStarted=True)
rec['pass']=mem>=required and projection<=192*M and free-future>=2982150144
save('admission.json',rec)
print(json.dumps({k:rec[k] for k in ['at','memAvailable','requiredBytes','ramComponents','clients','totalProjected','cap','freeDisk','projectedFree','pass']}))

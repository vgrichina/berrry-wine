import pathlib,os,sys,json,subprocess,resource,time,hashlib,importlib.util,shutil
P=pathlib.Path;M=1048576;H=P('/tmp/gl-published-webgl-recovered-qualification-oct26');O=H/'ops';R=H/'repo';ROOT=P('/home/user/wine-assembly');A=json.loads((ROOT/('scratch/usage-watch/'+H.name+'-admission.json')).read_text());S=P(A['sourceRoot']);D=P(A['acceptedFixtureRoot']);NODE='/usr/local/bin/node'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',NODE_PATH='/tmp/wa-local-runtime-deps/node_modules',CHROME='/opt/google/chrome/chrome',TMPDIR=str(H/'tmp'),PALETTE_GPU_SOURCE_ROOT=str(S),PALETTE_GPU_EVIDENCE=str(O/'test-result.json'),PALETTE_BROWSER_RESOURCE_CONFIG='{"explicitTaskAccounting":"accepted supervise check callback;192MiB whole-task"}')
(H/'tmp').mkdir(exist_ok=True)
sp=importlib.util.spec_from_file_location('accepted',D/'test/helpers/palette-browser-supervisor.py');supervisor=importlib.util.module_from_spec(sp);sp.loader.exec_module(supervisor)
def alloc(p):
 try:return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if not q.is_symlink())
 except FileNotFoundError:return 0
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def ledger():
 roots=[H,ROOT/('scratch/usage-watch/'+H.name),S.parent,D.parent,*P('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'*')]
 c={str(p):alloc(p) for p in roots};c['positiveWALOnce']=sum(max(0,alloc(P(p))-n) for p,n in A['walBaseline'].items());c.update(futureLocalRemoteGit=16*M,futureProfileOutput=32*M,futureSessionPublication=32*M,reserve=8*M)
 return dict(charges=c,total=sum(c.values()),projectedFree=shutil.disk_usage(H).free-88*M)
def check():
 d=ledger()
 if d['total']>192*M:return 'whole task 192MiB disk cap'
 if d['projectedFree']<2982150144:return 'projected host disk floor'
 mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 if mem<768*M:return 'host physical memory remainder'
 return None
def run(cmd,name,rss=512*M,cwd=H):
 assert check() is None,check()
 old=P.cwd();os.chdir(cwd)
 rec=supervisor.supervise(cmd,rss_limit=rss,cpu_limit=90,wall_limit=120,output_limit=2*M,check=check)
 os.chdir(old);out=rec.pop('output');(O/(name+'.log')).write_bytes(out);rec.update(argv=cmd,ledger=ledger());save(name+'-receipt.json',rec)
 assert rec['exit']==0 and rec['stopReason'] is None and rec['cleanupComplete'],(name,rec,out[:8192])
 return out
counter=0
def git(*args):
 global counter
 counter+=1
 return run(['/usr/bin/prlimit','--data=536870912:536870912','--','/usr/bin/git','-c','gc.auto=0','-c','maintenance.auto=false','-c','pack.threads=1','-C',str(R),*args],'git-%02d'%counter)

import os,sys,pathlib,json,hashlib,importlib.util,fcntl,time,shutil
O=pathlib.Path(__file__).parent
T=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(T.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_OPTIONAL_LOCKS']='0'
os.environ['PYTHONDONTWRITEBYTECODE']='1'
os.environ['PALETTE_BROWSER_BOOTSTRAP']=str(os.getppid())
label,kind=sys.argv[1:3];argv=sys.argv[3:]
clients=[]
for p in pathlib.Path('/proc').glob('[0-9]*'):
 try:
  cmd=(p/'cmdline').read_bytes().split(b'\0');s=(p/'stat').read_text().split(') ')[1].split()
  if cmd and pathlib.Path(os.fsdecode(cmd[0])).name=='codex' and b'exec' in cmd:clients.append(dict(pid=int(p.name),rss=int(s[21])*4096))
 except (OSError,IndexError):pass
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
required=sum(max(0,335544320-c['rss']) for c in clients)+max(0,3-len(clients))*335544320+2*805306368
free=shutil.disk_usage(O).free
ad=dict(at=time.time(),clients=clients,memAvailable=mem,requiredRAM=required,freeDisk=free,projectedFree=free-1006632960,diskFloor=2982150144)
ad['pass']=mem>=required and ad['projectedFree']>=ad['diskFloor']
(O/(label+'.admission.json')).write_text(json.dumps(ad,indent=2));assert ad['pass'],ad
s=importlib.util.spec_from_file_location('trusted',T);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
lock=None
if kind=='git':
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 argv=['/usr/bin/prlimit','--data=536870912:536870912','--',*argv]
def check():
 total=sum(p.stat().st_size for p in (O/(label+'.stdout'),O/(label+'.stderr')) if p.exists())
 return 'output-file-limit' if total>2097152 else None
try:
 r=m.supervise(['/bin/bash','-c','exec "$@" >"$0.stdout" 2>"$0.stderr"',str(O/label),*argv],rss_limit={'git':268435456,'api':335544320}.get(kind,134217728),cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
finally:
 if lock:lock.close()
(O/(label+'.supervisor.log')).write_bytes(r.pop('output'))
(O/(label+'.execution.json')).write_text(json.dumps(dict(argv=argv,kind=kind,result=r),indent=2))
print(json.dumps(dict(label=label,**{k:v for k,v in r.items() if k!='owned'})))
assert r['exit']==0 and not r['stopReason'] and r['cleanupComplete'],r

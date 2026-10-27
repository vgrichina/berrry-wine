import sys, os, pathlib, hashlib, json, resource, importlib.util, time, shutil
O=pathlib.Path(__file__).resolve().parent
S=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.update(GIT_SSH_COMMAND=SSH,GIT_TERMINAL_PROMPT='0',PYTHONDONTWRITEBYTECODE='1',RICOCHET_ACCEPT_OPS=str(O),TMPDIR=str(O/'fixtures'))
mode,name,*argv=sys.argv[1:]
assert mode in ('python','git') and '/' not in name
os.chdir(O.parent/'repo')
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
free=shutil.disk_usage(O).free
assert mem>=805306368+268435456 and free-134217728>=2982150144,(mem,free)
record=dict(argv=argv,mode=mode,cwd=os.getcwd(),ssh=SSH,at=time.time(),envSHA256=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest(),inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ('RLIMIT_AS','RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE')},supervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),pythonSHA256=hashlib.sha256(pathlib.Path(sys.executable).read_bytes()).hexdigest(),memAvailable=mem,free=free,initialRootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/ricochet-final-writer-independent-accept-oct27/root-ref-digest.json')
(O/(name+'.command.json')).write_text(json.dumps(record,indent=2))
spec=importlib.util.spec_from_file_location('trusted',S);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for suffix in ('.stdout','.stderr'):(O/(name+suffix)).touch(exist_ok=False)
def check():
    total=sum((O/(name+s)).stat().st_size for s in ('.stdout','.stderr'))
    return 'distinct output limit' if total>2*1048576 else None
r=m.supervise([sys.executable,'-B',str(O/'child.py'),name,mode,*argv],rss_limit=(256 if mode=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2*1048576,check=check)
(O/(name+'.bootstrap')).write_bytes(r.pop('output'))
r['streamBytes']=sum((O/(name+s)).stat().st_size for s in ('.stdout','.stderr'))
(O/(name+'.result.json')).write_text(json.dumps(r,indent=2))
print(json.dumps(dict(name=name,**{k:r[k] for k in ('exit','stopReason','peakRSS','cleanupComplete','streamBytes')})))
raise SystemExit(0 if r['exit']==0 and not r['stopReason'] and r['cleanupComplete'] and r['streamBytes']<=2*1048576 else 1)

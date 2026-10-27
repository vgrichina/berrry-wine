import sys,os,json,pathlib,importlib.util,hashlib,fcntl
P=pathlib.Path('/tmp/generally-ordinary-driving-gameplay-oct27/ops')
S='/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py'
assert hashlib.sha256(pathlib.Path(S).read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
spec=importlib.util.spec_from_file_location('trusted',S);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
label,mode,*cmd=sys.argv[1:]
if mode=='archive':
 cmd=json.loads((P/'archive-command.json').read_text());mode='git'
if mode=='git':
 os.environ['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 cmd=['/usr/bin/prlimit','--data=536870912','--',*cmd]
# Distinct stdout/stderr from command creation, while the trusted supervisor
# bounds the entire owned descendant tree.
shim='import subprocess,sys; a=subprocess.run(sys.argv[3:],stdout=open(sys.argv[1],"wb"),stderr=open(sys.argv[2],"wb"));sys.exit(a.returncode)'
def check():
 out=sum(x.stat().st_size for x in P.glob('*.api.stdout'))
 if out>8*m.MIB:return 'raw API response8MiB'
 if any(x.stat().st_size>2*m.MIB for x in P.glob('*.std*') if '.api.' not in x.name):return 'operation output2MiB'
 used=sum(x.lstat().st_blocks*512 for x in P.parent.rglob('*'))
 if used+8*m.MIB>128*m.MIB:return 'local allocation128MiB including reserve'
 return None
r=m.supervise([sys.executable,'-c',shim,str(P/(label+'.stdout')),str(P/(label+'.stderr')),*cmd],rss_limit=(256 if mode=='git' else 128)*m.MIB,cpu_limit=90,wall_limit=120,output_limit=2*m.MIB,check=check)
(P/(label+'.supervisor-output')).write_bytes(r.pop('output'))
r.update(command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest())
(P/(label+'.json')).write_text(json.dumps(r,indent=2))
print(json.dumps({**{k:v for k,v in r.items() if k not in ('command','owned')},'ownedCount':len(r['owned'])}))
for suffix in ('stdout','stderr'):
 p=P/(label+'.'+suffix)
 if p.exists(): print(suffix+': '+p.read_text(errors='replace')[:2500])
sys.exit(1 if r['stopReason'] else r['exit'] or 0)

import pathlib,sys,os,json,time,hashlib,importlib.util,subprocess,resource,fcntl
H=pathlib.Path(__file__).parent
R=H.parent/'repo'
M=1048576
SUP=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(SUP.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
spec=importlib.util.spec_from_file_location('pinned_supervisor',SUP);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def write(name,j):
 p=H/name;t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def bytes_at(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')] if not x.is_symlink())
def gate(name):
 baseline=json.loads((H/'external-baseline.json').read_text())
 external={p:max(0,pathlib.Path(p).stat().st_size-v) if pathlib.Path(p).exists() else 0 for p,v in baseline.items()}
 own=bytes_at(H.parent);growth=sum(external.values())
 # The entire new task allocations include reserves; consumption is already in free.
 peers=[('/tmp/airstrike-focus-menu-independent-accept-oct27',32*M),('/tmp/enigma-retained-integration-allocation-recovery-oct27',48*M)]
 # Airstrike actual assigned path is supplied below once checked; conservative full future if absent.
 future=max(0,32*M-own-growth)+sum(max(0,cap-bytes_at(pathlib.Path(p))) for p,cap in peers)
 v=os.statvfs('/tmp');free=v.f_bavail*v.f_frsize
 mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 j=dict(at=time.time(),ownAllocated=own,externalPositiveGrowth=external,future=future,free=free,projected=free-future,floor=2982150144,memAvailable=mem,physicalFloor=1946157056,sourceGit=bytes_at(R),evidence=bytes_at(H),allocations=dict(total=32*M,sourceGit=8*M,events=8*M,evidence=8*M,reserve=8*M),peers=peers)
 j['pass']=j['projected']>=j['floor'] and mem>=j['physicalFloor'] and own+growth<=24*M and j['sourceGit']<=8*M and j['evidence']<=8*M and growth<=8*M
 write('admission-'+name+'.json',j)
 if not j['pass']:raise RuntimeError('ADMISSION REJECT '+name)
 return j
def run(name,argv,git=False):
 gate(name)
 result=s.supervise(argv,rss_limit=(256 if git else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M)
 output=result.pop('output');(H/(name+'.log')).write_bytes(output)
 write(name+'-supervisor.json',dict(result,argv=argv,supervisorSHA256=hashlib.sha256(SUP.read_bytes()).hexdigest(),DATA='Git child only 512MiB' if git else 'unchanged'))
 print(output[:8192].decode(errors='replace'))
 assert result['exit']==0 and result['stopReason'] is None and result['cleanupComplete'],result
 return output
def git(args,name='git'):
 # Called only under pool permit2; DATA is set in the immediate Git child.
 with open('/tmp/wine-ops-production-git.lock','a') as f:
  fcntl.flock(f,fcntl.LOCK_EX)
  return run(name,[sys.executable,str(H/'git_child.py'),*args],git=True)
if __name__=='__main__':
 if sys.argv[1]=='git':git(sys.argv[3:],sys.argv[2])
 else:run(sys.argv[1],sys.argv[2:])

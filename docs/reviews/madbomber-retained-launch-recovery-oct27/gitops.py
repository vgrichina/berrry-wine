import os,sys,json,fcntl,subprocess,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent));import diagnose as d
R=d.O.parent/'repo'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
BR='task/madbomber-retained-launch-recovery-oct27'
BASE='498c64f3284fc8625173d4bb5e442b27b8815f0c'
def git(*args):
 r=subprocess.run([sys.executable,str(d.ROOT/'scratch/usage-watch/light-execution-pool-oct26.py'),'--slots','2','--',sys.executable,__file__,*args],capture_output=True)
 assert r.returncode==0,(args,r.stdout[:8192],r.stderr[:8192]);return r.stdout.decode().strip()
if __name__=='__main__':
 with open('/tmp/wine-ops-production-git.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX);label='git-'+str(os.getpid());d.gate(label);os.environ['GIT_SSH_COMMAND']=SSH
  p=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
  assert d.sha(p.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
  s=importlib.util.spec_from_file_location('sup',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  argv=['prlimit','--data=536870912:536870912','git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','-C',str(R),*sys.argv[1:]]
  r=m.supervise(argv,rss_limit=268435456,cpu_limit=90,wall_limit=120,output_limit=2097152);b=r.pop('output');d.save(label+'.json',dict(argv=argv,result=r,ssh=SSH,outputSha256=d.sha(b),outputBytes=len(b)));sys.stdout.buffer.write(b);sys.exit(1 if r['stopReason'] else r['exit'] or 0)

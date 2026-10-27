import os,pathlib,subprocess,json,hashlib,fcntl
O=pathlib.Path(__file__).parent;R=O.parent/'repo';D='/tmp/generally-census-accepted-main-integration-oct27/repo';PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba'
def git(label,args):
 with (O/('git-'+label+'.stdout')).open('xb') as out,(O/('git-'+label+'.stderr')).open('xb') as err:
  r=subprocess.run(['/usr/bin/prlimit','--data=536870912:536870912','--','git','-c','gc.auto=0','-c','pack.threads=1',*args],stdout=out,stderr=err)
 assert r.returncode==0,(label,r.returncode)
with open('/tmp/wine-ops-production-git.lock','a') as lk:
 fcntl.flock(lk,fcntl.LOCK_EX)
 git('runner',['-C',D,'show',PIN+':test/run.js'])
 h=hashlib.sha256((O/'git-runner.stdout').read_bytes()).hexdigest();assert h=='6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e'
 assert (O/'git-runner.stdout').read_bytes()==pathlib.Path('/tmp/gta2-fullscreen-mode-cause-repair-oct27/ops/canonical-runner.txt').read_bytes()
 git('init',['init',str(R)]);(R/'.git/objects/info/alternates').write_text(D+'/.git/objects\n')
 git('sparse',['-C',str(R),'config','core.sparseCheckout','true']);(R/'.git/info/sparse-checkout').write_text('/reports/'+O.parent.name+'/\n')
 git('checkout',['-C',str(R),'checkout','-b','task/'+O.parent.name,PIN])
 git('remote',['-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'])
 git('name',['-C',str(R),'config','user.name','Wine Ops Worker']);git('email',['-C',str(R),'config','user.email','wine-ops@local'])
(O/'launch-identity.json').write_text(json.dumps(dict(source=PIN,runnerSHA256=h,ssh=os.environ['GIT_SSH_COMMAND'],rootRefReceipt='/home/user/wine-assembly/scratch/usage-watch/'+O.parent.name+'/root-ref-digest.json',parser='parser-check.execution.json',box='bx_cqss3x42',cutoff='2026-10-27T14:08Z',handback='14:12Z',shutdown='14:15Z',expiry='2026-10-27T14:27:50.265Z'),indent=2))
print('PASS pinned sparse report checkout; Git DATA on Git child only')

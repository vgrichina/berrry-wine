from work import *
import fcntl
env=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',GIT_NO_LAZY_FETCH='1')
def run(*args):
 p=subprocess.run(['git','-C',str(H/'repo'),*args],env=env,capture_output=True,text=True)
 if p.returncode:
  save('publication-rejection-'+str(time.time_ns())+'.json',dict(argv=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr));raise RuntimeError(p.stderr[:1500])
 return p.stdout.strip()
with open('/home/user/wine-assembly/scratch/usage-watch/shared-integration.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 main=run('ls-remote','origin','refs/heads/main').split()[0]
 save('remote-main-reconciliation.json',dict(expected=REV,actual=main,equal=main==REV,action='task branch only; no integration or main merge'))
 assert main==REV, 'remote main changed; retain task without integration'
 seals=json.load(open(E/'artifact-seals.json'))
 for x in seals:
  b=(E/x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path']
 run('add','-f','docs/re-notes/penguin-command-immediate-shot-state-20261024.md','docs/re-notes/penguin-command-immediate-shot-state-20261024')
 staged=run('diff','--cached','--name-only').splitlines()
 assert all(p.startswith('docs/re-notes/penguin-command-immediate-shot-state-20261024') for p in staged)
 # Preserve the authentic raw trace's single trailing space byte-for-byte.
 # Check all authored files and all other captures normally.
 run('diff','--cached','--check','--','.',':!docs/re-notes/penguin-command-immediate-shot-state-20261024/filter/output.log')
 run('config','user.name','Codex');run('config','user.email','codex@openai.com')
 run('commit','-m','docs: capture Penguin SDL A filter and bounded cannon trace limitation')
 commit=run('rev-parse','HEAD')
 run('push','origin','HEAD:refs/heads/'+BRANCH)
 actual=run('ls-remote','origin','refs/heads/'+BRANCH).split()[0];assert actual==commit
 verification=[]
 for x in seals:
  p='docs/re-notes/penguin-command-immediate-shot-state-20261024/'+x['path']
  b=subprocess.check_output(['git','-C',str(H/'repo'),'show',commit+':'+p],stderr=subprocess.DEVNULL)
  assert sha(b)==x['sha256'];verification.append(x['path'])
 assert not run('status','--porcelain')
 save('committed-verification.json',dict(commit=commit,artifactSeals=len(verification),passAll=True,ownedFiles=len(staged),privateClean=True))
 save('publication.json',dict(commit=commit,branch=BRANCH,actualRemoteSHA=actual,main=main,strictSSH=True,mainMerged=False,lock='scratch/usage-watch/shared-integration.lock',verifiedAt=time.time()))
 print(json.dumps(json.load(open(H/'publication.json'))))

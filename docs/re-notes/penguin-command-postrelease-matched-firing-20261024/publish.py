from work import *
import fcntl,ast
env=dict(os.environ,GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts')
def network(*args):
 p=subprocess.run(['git','-C',str(H/'repo'),*args],env=env,capture_output=True,text=True,timeout=90)
 if p.returncode:
  save('publication-rejection.json',dict(argv=args,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));raise RuntimeError(p.stderr[:1500])
 return p.stdout.strip()
with open('/home/user/wine-assembly/scratch/usage-watch/shared-integration.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 remoteMain=network('ls-remote','origin','refs/heads/main').split()[0]
 save('remote-main-reconciliation.json',dict(actualRemoteMain=remoteMain,testedRunnerMain=REV,taskBranchOnly=True,merge=False))
 for n in ['work.py','supervise.py','compare.py','verify.py','account.py','publish.py']:
  b=(H/n).read_bytes();ast.parse(b);(E/n).write_bytes(b)
 for n in ['admission.json','source-health-api.json','supervisor-diff.json','control-args.json','treatment-args.json','control-inputs.json','treatment-inputs.json','control-launch-api.json','treatment-launch-api.json','control-collection-seals.json','treatment-collection-seals.json','control-baseline-seal.json','essential-image-seals.json','late-image-seals.json','remote-files.json','pixel-comparison.json','pixel-comparison-api.json','verification.json','resource-prepublish.json','guest-handoff-api.json','box-state-final.json','remote-main-reconciliation.json']:
  (E/n).write_bytes((H/n).read_bytes())
 # Immutable prior allocation receipt preserves standing/shared accounting.
 (E/'prior-resource-final.json').write_bytes((OLD/'resource-final.json').read_bytes())
 seals=[dict(path=str(p.relative_to(E)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(E.rglob('*')) if p.is_file() and p.name!='artifact-seals.json']
 (E/'artifact-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
 git('add','docs/re-notes/penguin-command-postrelease-matched-firing-20261024.md','docs/re-notes/penguin-command-postrelease-matched-firing-20261024')
 for p in E.rglob('*.png'):git('add','-f',str(p.relative_to(H/'repo')))
 git('diff','--cached','--check')
 changed=git('diff','--cached','--name-only').splitlines();assert changed and all(p.startswith('docs/re-notes/penguin-command-postrelease-matched-firing-20261024') for p in changed)
 git('config','user.name','Codex');git('config','user.email','codex@openai.com')
 git('commit','-m','Document matched Penguin A firing test and unresolved visible response')
 commit=git('rev-parse','HEAD');assert git('rev-parse','HEAD^')==REV
 pushed=network('push','origin','HEAD:refs/heads/'+BRANCH)
 actual=network('ls-remote','origin','refs/heads/'+BRANCH).split()[0];assert actual==commit
 mainAfter=network('ls-remote','origin','refs/heads/main').split()[0]
 save('publication.json',dict(commit=commit,branch=BRANCH,actualRemoteSHA=actual,remoteMainBefore=remoteMain,remoteMainAfter=mainAfter,strictSSH=True,forcePush=False,merged=False,pushOutput=pushed,changedFiles=len(changed)))
 assert git('status','--porcelain')==''
 print(json.dumps(json.load(open(H/'publication.json'))))

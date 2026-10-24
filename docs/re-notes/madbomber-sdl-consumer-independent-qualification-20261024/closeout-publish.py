import pathlib,subprocess,os,json,datetime,hashlib
P=pathlib.Path(__file__).parent;repo=P/'repo'
E=repo/'docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024'
env=dict(os.environ)
env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
err=(P/'closeout-git-stderr.log').open('ab')
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],env=env,stderr=err)
branch=git('branch','--show-current').decode().strip()
assert branch=='task/madbomber-sdl-consumer-independent-qualification-oct24'
base=git('rev-parse','HEAD').decode().strip()
assert base=='979042c93eec78095d0e4ee078d4efb25a55a5ff'
remoteBefore=git('ls-remote','origin','refs/heads/main','refs/heads/'+branch).decode()
assert not any(line.endswith('refs/heads/'+branch) for line in remoteBefore.splitlines()),'unexpected published branch: stop to reconcile'
paths=['docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024.md','docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024','test/system-thunk-identity.js','test/test-madbomber-system-thunk-identity.js','test/test-madbomber-sdl-error-consumer-candidate.js']
git('add','--',*paths)
git('diff','--cached','--check')
names=git('diff','--cached','--name-only').decode().splitlines()
assert all(n in paths or n.startswith(paths[1]+'/') for n in names)
diff=git('diff','--cached','--binary','--',*paths)
(P/'closeout-staged.patch').write_bytes(diff)
(P/'closeout-staged-stat.txt').write_bytes(git('diff','--cached','--stat'))
git('commit','-m','Qualify original SDL consumer with bounded thunk identity and rejecting output control')
head=git('rev-parse','HEAD').decode().strip()
(P/'closeout-local-commit.json').write_text(json.dumps({'commit':head,'branch':branch,'base':base,'remoteBefore':remoteBefore,'paths':names,'diffSHA256':hashlib.sha256(diff).hexdigest()},indent=2)+'\n')
push=git('push','origin','HEAD:refs/heads/'+branch).decode()
remote=git('ls-remote','origin','refs/heads/'+branch).decode().split()
assert remote==[head,'refs/heads/'+branch],remote
assert not git('status','--porcelain','--untracked-files=normal').strip()
record={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':head,'remoteSHA':remote[0],'branch':branch,'base':base,'remoteBefore':remoteBefore,'pushStdout':push,'diffSHA256':hashlib.sha256(diff).hexdigest(),'publishedPaths':names,'clean':True,'ssh':env['GIT_SSH_COMMAND'],'mainMerge':False}
(P/'closeout-publication.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:record[k] for k in ['commit','remoteSHA','branch','clean']}))

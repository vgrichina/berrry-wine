import pathlib,hashlib,json,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'docs/re-notes/seh-accepted-module-rerun-20261025';E=P/'evidence';BR='task/seh-accepted-module-rerun-oct25';BASE='ae188c981dad2337050acf88d74d567d5644c367'
assert 'GIT_OBJECT_DIRECTORY' not in os.environ and 'GIT_ALTERNATE_OBJECT_DIRECTORIES' not in os.environ
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';assert os.environ['GIT_SSH_COMMAND']==SSH
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*args):
 p=subprocess.run(['git','-C',str(R),*args],capture_output=True,timeout=55);assert p.returncode==0,(args,p.returncode,p.stderr[:1500]);assert len(p.stdout)+len(p.stderr)<=131072;return p.stdout.decode().strip()
assert git('rev-parse','HEAD')==BASE and git('branch','--show-current')==BR
for row in json.load(open(E/'seal.json')):assert sha((P/row['path']).read_bytes())==row['sha256']
assert json.load(open(O/'result.json'))['state']=='BOTH_MODULE_QUALIFICATION_PASS'
for p in O.iterdir():
 if p.is_file() and p.suffix in ['.json','.py','.md','.stdout','.stderr'] and not p.name.startswith('publication-'):(E/p.name).write_bytes(p.read_bytes())
# Include the fresh publication admission before producing any Git objects.
for p in O.glob('publication-admission-*.json'):(E/p.name).write_bytes(p.read_bytes())
seal=[dict(path=str(p.relative_to(P)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.rglob('*')) if p.is_file() and p.name!='seal.json'];(E/'seal.json').write_text(json.dumps(seal,indent=2)+'\n')
git('add','--','docs/re-notes/seh-accepted-module-rerun-20261025');git('diff','--cached','--check')
files=git('diff','--cached','--name-only').splitlines();assert files and all(f.startswith('docs/re-notes/seh-accepted-module-rerun-20261025/') and not f.endswith('.wasm') for f in files)
for row in seal:assert sha((P/row['path']).read_bytes())==row['sha256']
print(git('commit','-m','test: qualify both canonical modules with accepted trust anchor'))
commit=git('rev-parse','HEAD');print(git('push','-u','origin',BR))
remote=git('ls-remote','origin','refs/heads/'+BR).split()[0];assert remote==commit
assert not git('status','--porcelain=v1')
(O/'publication-complete.json').write_text(json.dumps(dict(commit=commit,remoteBranch=BR,verifiedRemoteSHA=remote,strictSSH=SSH,mainMerged=False,binariesCommitted=False,files=len(files),sealFiles=len(seal),diffCheck=True,sealVerified=True,cleanOwnedIndex=True),indent=2)+'\n')
print(json.dumps(dict(commit=commit,remote=remote,branch=BR,files=len(files))))

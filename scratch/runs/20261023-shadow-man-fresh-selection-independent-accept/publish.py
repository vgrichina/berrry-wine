import pathlib,subprocess,os,json,hashlib,shutil,datetime
R=pathlib.Path('/home/user/wine-assembly-shadow-man-fresh-selection-independent-accept-oct23');E=R/'docs/re-notes/shadow-man-fresh-selection-independent-accept-20261023';P=R/'scratch/runs/20261023-shadow-man-fresh-selection-independent-accept';P.mkdir(parents=True,exist_ok=True)
env={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_SSH_COMMAND':'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -i /home/user/.ssh/wine_github_ed25519'}
C='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a';branch='task/shadow-man-fresh-selection-independent-accept-oct23'
def run(*a,inp=None):return subprocess.check_output(['git','-C',str(R),*a],env=env,input=inp,timeout=60)
remote=run('ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-fresh-selection-repair-oct23').decode();assert 'bb9c496ed13095cc832fdf607f0937fb9c14b7de\trefs/heads/main' in remote;assert C+'\trefs/heads/task/shadow-man-fresh-selection-repair-oct23' in remote
(E/'remote-inputs.json').write_text(json.dumps({'argv':['git','ls-remote','origin','refs/heads/main','refs/heads/task/shadow-man-fresh-selection-repair-oct23'],'env':{k:env[k] for k in ['GIT_NO_LAZY_FETCH','GIT_SSH_COMMAND']},'exit':0,'stdout':remote,'dateUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
report=R/'docs/re-notes/shadow-man-fresh-selection-independent-accept-20261023.md'
files=sorted([report,*[p for p in E.iterdir() if p.is_file() and p.suffix!='.wasm' and p.name!='seals.json']])
assert all(not p.is_symlink() for p in files)
seals=[{'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
(E/'seals.json').write_text(json.dumps(seals,indent=2)+'\n');files.append(E/'seals.json')
for x in seals:assert hashlib.sha256((R/x['path']).read_bytes()).hexdigest()==x['sha256']
run('add','--',*[str(p.relative_to(R)) for p in files])
staged=run('diff','--cached','--name-status').decode();assert all(l.startswith('A\tdocs/re-notes/shadow-man-fresh-selection-independent-accept-20261023') for l in staged.splitlines()),staged
tree=run('write-tree','--missing-ok').decode().strip()
def listing(ref):return {l.split(b'\t',1)[1]:l.split(b'\t',1)[0] for l in run('ls-tree','-r',ref).splitlines()}
before=listing(C);after=listing(tree);assert all(after.get(p)==v for p,v in before.items());assert len(after)-len(before)==len(files)
review={'parent':C,'tree':tree,'preservedParentEntries':len(before),'addedReviewFiles':len(files),'staged':staged,'publicationSealsVerified':len(seals)}
(P/'tree-review.json').write_text(json.dumps(review,indent=2)+'\n')
commit=run('commit-tree',tree,'-p',C,inp=b'Review Shadow Man fresh selection with independent offline acceptance\n').decode().strip();run('update-ref','refs/heads/'+branch,commit,C)
measure=lambda p:sum(x.stat().st_size for x in p.rglob('*') if x.is_file())
owned=measure(R)+pathlib.Path('/tmp/shadow-fresh-accept-publish.py').stat().st_size+pathlib.Path('/tmp/shadow-fresh-accept-setup.py').stat().st_size
free=shutil.disk_usage(R).free;account={'materializedFileBytesIncludingGit':owned,'reserve':8388608,'remainingGrowthAllowance':2097152,'cap':67108864,'freeNow':free,'floor':2982150144}
assert owned+8388608+2097152<67108864;assert free-2097152>2982150144
push=subprocess.run(['git','-C',str(R),'push','origin','HEAD:refs/heads/'+branch],env=env,capture_output=True,text=True,timeout=60)
(P/'push.stdout').write_text(push.stdout);(P/'push.stderr').write_text(push.stderr);assert push.returncode==0,push.stderr
actual=run('ls-remote','origin','refs/heads/'+branch,'refs/heads/main').decode();assert commit+'\trefs/heads/'+branch in actual;assert 'bb9c496ed13095cc832fdf607f0937fb9c14b7de\trefs/heads/main' in actual
receipt={'commit':commit,'branch':branch,'actualRemote':actual,'strictSSH':env['GIT_SSH_COMMAND'],'GIT_NO_LAZY_FETCH':'1','pushExit':push.returncode,'treeReview':review,'accounting':account,'sealsVerified':len(seals),'wasmRecovery':'run-checks.py recompiles fixed8MiB fixture arenas from tracked WAT; binary hashes in results','box':'none assigned/contacted; bx_fn7pn7yg coordinator-reported snapshotSTOPPED, expiry2026-10-23T03:46:00.580Z historical/unprobed; coordinator owns lifecycle'}
(P/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n');shutil.copyfile(__file__,P/'publish.py');print(json.dumps({'commit':commit,'branch':branch,'actualRemote':actual,'accounting':account,'reviewFiles':len(files),'sealsVerified':len(seals)}))

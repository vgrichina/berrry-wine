import guard,json,pathlib,os,hashlib,shutil,sys
B=guard.B;r=B/'repo';name='d3d-scoped-native-qualification-20261023';dest=r/'docs/re-notes'/name;dest.mkdir(parents=True,exist_ok=True)
j=json.loads((B/'source-inventory.json').read_text());node=j['tools']['node']['path']
deny=json.loads((B/'first-phase-denial.json').read_text());deny['command'][0]=node;guard.write(B/'first-phase-denial.json',deny)
def footprint(p):return sum(x['size'] for x in guard.scan_files(p).values())
standing={}
for p in ['/tmp/d3d-render-cache-independent-closeout-oct23/repo','/tmp/d3d-late-batch-oct23/repo','/tmp/d3d-late-batch-independent-oct23/repo','/home/user/wine-assembly/.git/objects']:
 standing[p]={'bytes':footprint(pathlib.Path(p)),'readOnly':True}
ldd=guard.run(['ldd',node],phase='python');libs=[]
for line in ldd.splitlines():
 for s in line.split():
  if s.startswith('/') and pathlib.Path(s).is_file():
   p=pathlib.Path(s).resolve();libs.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
guard.write(B/'standing-inputs.json',{'donorFootprints':standing,'installedTools':j['tools'],'nodeSharedLibraries':libs,'engine':guard.run([node,'--max-old-space-size=256','-p','JSON.stringify(process.versions)'],cwd=r),'ldd':ldd})
def git(*a,env=None):return guard.run(['git','-C',str(r),*a],phase='python',env=env)
assert not git('diff','--','src','lib')
git('diff','--check')
fixtureDiff=git('diff','--','test/test-d3d-software-compaction.js')
guard.write(B/'fixture-diff-identity.json',{'sha256':hashlib.sha256(fixtureDiff.encode()).hexdigest(),'bytes':len(fixtureDiff.encode()),'candidate':j['fixture'],'appliedBlob':next(x['blob'] for x in j['closure'] if x['path']=='test/test-d3d-software-compaction.js')})
guard.write(B/'final-accounting.json',guard.sample())
for n in ['guard.py','guard-rejection-control.json','plan.py','setup.py','native.py','publish.py','admission.json','source-inventory.json','compiler-identity.json','checkout.json','execution.jsonl','first-phase-denial.json','fixture-diff-identity.json','standing-inputs.json','final-accounting.json']:
 shutil.copyfile(B/n,dest/n)
shutil.copyfile(guard.BASELINE,dest/'prelaunch-baseline.json')
git('add','--sparse','--','test/test-d3d-software-compaction.js','docs/re-notes/'+name+'.md','docs/re-notes/'+name)
git('diff','--cached','--check');changed=git('diff','--cached','--name-only').splitlines()
assert all(p=='test/test-d3d-software-compaction.js' or p.startswith('docs/re-notes/'+name) for p in changed)
git('commit','-m','docs: record scoped D3D native memory admission blocker')
head=git('rev-parse','HEAD').strip()
env=os.environ.copy();env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o ConnectTimeout=15'
branch='task/d3d-scoped-native-qualification-oct23'
git('push','origin','HEAD:refs/heads/'+branch,env=env)
remote=git('ls-remote','--heads','origin','refs/heads/'+branch,env=env).split()[0];assert remote==head
guard.write(B/'publication.json',{'commit':head,'branch':branch,'remoteSha':remote,'verified':True,'strictSSH':True,'sample':guard.sample()})
print(json.dumps({'commit':head,'remoteSha':remote,'branch':branch,'verified':True}))

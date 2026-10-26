import pathlib,subprocess,json,os,time,hashlib,resource
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';E=R/'docs/re-notes/maelstrom-errno-api-canonical-native-20261025'
env=dict(os.environ,GIT_SSH_COMMAND=json.load(open(O/'configuration.json'))['ssh'])
def limit():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(args,label):
 p=subprocess.run(args,cwd=R,env=env,capture_output=True,text=True,timeout=60,preexec_fn=limit)
 row=dict(argv=args,exit=p.returncode,stdout=p.stdout,stderr=p.stderr,at=time.time())
 with (O/'publication-commands.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 assert len(p.stdout.encode())+len(p.stderr.encode())<=131072
 assert p.returncode==0,(label,p.stderr[:2000]);return p.stdout.strip()
plan=json.load(open(O/'publication-plan.json'))
for row in json.load(open(E/'manifest.json')):assert hashlib.sha256((R/row['path']).read_bytes()).hexdigest()==row['sha256'],row['path']
D=pathlib.Path('/tmp/maelstrom-native-errno-snapshot-independent-closeout-oct25/repo')
for row in json.load(open(O/'checkout.json'))['selected']:assert (R/row['path']).read_bytes()==(D/row['path']).read_bytes()
assert json.load(open(O/'admission-before-commit.json'))['passChecks']
run(['git','add','--sparse','--',*plan['paths']],'stage exact focused paths')
run(['git','diff','--cached','--check'],'whitespace')
staged=run(['git','diff','--cached','--name-only'],'staged paths').splitlines();assert set(staged)==set(plan['paths'])
run(['git','commit','-m','Qualify canonical errno latch with controlled native CALL and RET fixtures'],'commit')
commit=run(['git','rev-parse','HEAD'],'commit identity');tree=run(['git','rev-parse','HEAD^{tree}'],'tree identity');branch='task/maelstrom-errno-api-canonical-native-oct25'
(O/'commit.json').write_text(json.dumps(dict(commit=commit,tree=tree,branch=branch,at=time.time()),indent=2))
subprocess.run(['python3',str(O/'account.py'),'admission-before-push.json'],check=True)
run(['git','push','origin','HEAD:refs/heads/'+branch],'push')
remote=run(['git','ls-remote','origin','refs/heads/'+branch],'verify push');assert remote.split()[0]==commit
assert run(['git','status','--porcelain=v1'],'clean task worktree')==''
seals=[]
for row in json.load(open(E/'manifest.json')):
 b=subprocess.check_output(['git','show',commit+':'+row['path']],cwd=R);assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'];seals.append(row)
out=dict(commit=commit,tree=tree,branch=branch,remoteSHA=remote.split()[0],remoteVerified=True,clean=True,committedSeals=len(seals),ssh=env['GIT_SSH_COMMAND'],mainMerged=False)
(O/'publication.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))

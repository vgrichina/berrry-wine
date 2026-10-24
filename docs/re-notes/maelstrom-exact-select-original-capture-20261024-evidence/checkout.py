import pathlib,subprocess,json,os,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-select-hook-native-independent-integrate-oct24/repo');rev='606caff1de558f185487aed5e31ede159262ba7e'
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def run(*a,cwd=D):return subprocess.check_output(a,cwd=cwd,text=True,env=env).strip()
assert json.load(open(O/'resource-precheckout.json'))['pass']
assert json.load(open(O/'mount-and-pacing.json'))['passChecks']
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],capture_output=True,text=True,env=env,timeout=30)
(O/'configuration.json').write_text(json.dumps(dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr),indent=2));assert p.returncode==0 and p.stdout.split()[0]==rev
assert run('git','rev-parse',rev+'^{tree}')=='fa0cf92625c22dc90e3effbb0a32f3759c3c79bd'
seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects');R.mkdir();run('git','init','-q',str(R))
(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
selected=['tools/maelstrom-select-completion-hook.cjs','test/maelstrom-select-hook-model.cjs']
run('git','config','core.sparseCheckout','true',cwd=R);run('git','config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
branch='task/maelstrom-exact-select-original-capture-oct24'
run('git','update-ref','refs/heads/'+branch,rev,cwd=R);run('git','symbolic-ref','HEAD','refs/heads/'+branch,cwd=R);run('git','read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:run('git','config',k,run('git','config',k),cwd=R)
run('git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
(O/'checkout.json').write_text(json.dumps(dict(revision=rev,branch=branch,selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False,sourceTree='fa0cf92625c22dc90e3effbb0a32f3759c3c79bd'),indent=2))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],stdout=log,stderr=log,start_new_session=True);log.close()
(O/'watcher.json').write_text(json.dumps(dict(pid=p.pid,pgid=p.pid,startedAt=time.time())))
print(json.dumps(dict(checkout=True,paths=len(selected),alternates=len(order),revision=rev)))

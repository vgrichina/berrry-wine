from work import *
C=pathlib.Path('/home/user/.codex');session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'))
save('sqlite-baseline.json',{str(p):allocated(p) for p in C.glob('*.sqlite*') if p.is_file()})
save('admission.json',dict(session=str(session),launcher='/home/user/wine-assembly/scratch/usage-watch/enigma-quiet-filesystem-startup-oct24'))
prior=json.load(open(P/'capture-final.json'));save('capture-history.json',dict(priorReceipt=str(P/'capture-final.json'),priorReceiptSHA256=sha((P/'capture-final.json').read_bytes()),prior=prior,newAllowance=2097152,historicalViolationRetained=True))
D=pathlib.Path('/tmp/enigma-quiet-fs-independent-integrate-oct24/repo');rev='979042c93eec78095d0e4ee078d4efb25a55a5ff'
f=json.load(open(D.parent/'final-tree-verification.json'))['files'];assert len(f)==32
for x in f:assert sha((D/x['path']).read_bytes())==x['sha256']
save('accepted-32-blobs.json',f)
args=json.load(open(D/'docs/re-notes/enigma-quiet-filesystem-20261024/next-argv.json'));save('guest-args.json',args)
env=json.load(open(D/'docs/re-notes/enigma-quiet-filesystem-20261024/next-env.json'));save('next-env.json',env)
s=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();assert sha(s.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
code='const assert=require("assert"),args='+json.dumps(args[5:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(R+'/vfs')+']);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("dlls").length,8);console.log("PASS actual argv canonical parser eight providers/tree")'
r=subprocess.run(['node','--max-old-space-size=256','-e',code],capture_output=True,text=True,timeout=60);save('precheckout-parser.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,argv=args,parserSHA256=sha(parser.encode())));assert r.returncode==0
r=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=dict(os.environ,GIT_SSH_COMMAND=SSH),capture_output=True,text=True,timeout=30);save('trusted-donor.json',dict(ssh=SSH,status=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0 and r.stdout.split()[0]==rev
j=py('import os,json,pathlib,shutil,subprocess;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,node=subprocess.check_output(["node","--version"],text=True).strip())))');save('remote-admission.json',j);info=json.loads(j['stdout']);assert info['uid']==1000 and info['memAvailable']>=2684354560
measure('precheckout')
repo=H/'repo';repo.mkdir();
def git(*a):
 r=subprocess.run(['git','-C',str(repo),*a],capture_output=True,text=True);assert r.returncode==0,r.stderr;return r.stdout
git('init');(repo/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n');git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
patterns=['/'+x['path'] for x in f]+['/docs/re-notes/enigma-quiet-filesystem-startup-20261024.md','/docs/re-notes/enigma-quiet-filesystem-startup-20261024/','/scratch/runs/20261024T1019Z-enigma-quiet-filesystem-startup/']
(repo/'.git/info/sparse-checkout').write_text('\n'.join(patterns)+'\n');git('checkout','-b','task/enigma-quiet-filesystem-startup-oct24',rev)
for key in ['user.name','user.email']:git('config',key,subprocess.check_output(['git','-C',str(D),'config',key],text=True).strip())
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for name in ['manifest.json','validate-tree.cjs','preflight.py','capture.cjs']:(H/name).write_bytes((P/name).read_bytes())
v=(H/'validate-tree.cjs').read_text().replace('const H=__dirname','const H='+json.dumps(R)).replace('full.slice(4)','full.slice(5)');(H/'validate-tree.cjs').write_text(v)
sup=(P/'supervise.py').read_text().replace("1792835520,'latest start09:52UTC'","1792838160,'latest start10:36UTC'").replace("bx_fvkjwxap","bx_784z5j62").replace('shutdown09:57UTC','shutdown10:42UTC').replace('2026-10-24T10:02:44.741Z','2026-10-24T10:47:44Z')
sup=sup.replace("env['MAELSTROM_CAPTURE_INSTALL']='1'","env['MAELSTROM_CAPTURE_INSTALL']='1';env['ENIGMA_RUNNER_ROOT']="+repr(R+'/runner'))
(H/'supervise.py').write_text(sup)
save('reused-evidence.json',json.load(open(D/'docs/re-notes/enigma-quiet-filesystem-independent-20261024/reused-evidence.json')))
measure('pretransfer');print(json.dumps(dict(acceptedBlobs=len(f),admission=True,remote=info)))

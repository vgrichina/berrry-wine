import pathlib,json,os,subprocess,hashlib,shutil,re,time
H=pathlib.Path(__file__).parent;P=pathlib.Path('/tmp/enigma-diagnostic-loader-startup-oct24');D=P/'repo'
def save(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
for n in ['work.py','preflight.py','preload.cjs','capture.cjs','validate-tree.cjs','supervise.py','preload-test.cjs','trace-capability.json','twenty-pins.json']:
 s=(P/n).read_text().replace(str(P),str(H)).replace('bx_ucns7qgy','bx_fvkjwxap').replace('1792834140','1792835520').replace('09:29UTC','09:52UTC').replace('09:34UTC','09:57UTC').replace('2026-10-24T09:40:12.681Z','2026-10-24T10:02:44.741Z')
 (H/n).write_text(s)
# All capture history remains retained. Measure raw tool result text and remote response bytes separately, without deduplicating historical charges.
prior=json.load(open(P/'admission.json'));sp=pathlib.Path(prior['session']);rows=[json.loads(l) for l in sp.read_text().splitlines()];outs=[x['payload'] for x in rows if x.get('payload',{}).get('type')=='custom_tool_call_output'];priorOutput=sum(len(v.get('text','').encode()) for x in outs for v in x['output']);priorRemote=sum(x['responseBytes'] for x in map(json.loads,(P/'api-history.jsonl').read_text().splitlines()))
save('capture-history.json',dict(priorFullSession=str(sp),priorSessionBytes=sp.stat().st_size,priorSessionSHA256=sha(sp.read_bytes()),priorToolOutputBytes=priorOutput,priorRemoteResponseBytes=priorRemote,carriedCharge=priorOutput+priorRemote,newAllowance=2097152,totalAllowance=priorOutput+priorRemote+2097152,historicalCapViolationRetained=True,method='sum UTF8 bytes of every retained custom_tool_call_output text block plus all recorded remote stdout/stderr responseBytes; conservative double-charge overlap, no deletion/reset'))
C=pathlib.Path('/home/user/.codex');save('sqlite-baseline.json',{str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()})
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));save('admission.json',dict(session=str(session),launcher='/home/user/wine-assembly/scratch/usage-watch/enigma-provider-complete-startup-oct24',charges=dict(remoteMaterialized=43741184),standingDonor=str(D),standingDonorCommit='4285b2bc213da24003a574af45e9d4622d1cfb7c'))
# Manifest stays complete, filenames and bytes identical; no local asset copy.
m=json.load(open(P/'manifest.json'));save('manifest.json',m)
args=json.load(open(P/'guest-args.json'));args=[s.replace(str(P),str(H)) for s in args]
parserPath=pathlib.Path('/tmp/enigma-register-load-cause-oct24/repo/tools/enigma-unpacked-closure.py');b=parserPath.read_bytes();assert sha(b)=='f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf';ns={'__name__':'sealed'};exec(compile(b,str(parserPath),'exec'),ns)
images={pathlib.Path(x['target']).name.lower():x for x in m if x['target'].startswith('vfs/') and len(pathlib.Path(x['target']).parts)==3 and x['target'].lower().endswith(('.dll','.exe'))};images['msvcrt.dll']=next(x for x in m if x['target']=='system/msvcrt.dll')
meta={n:ns['pe'](x['path']) for n,x in images.items()};order=[];active=set();seen=set();edges=[]
def visit(n):
 if n in seen:return
 assert n not in active,('native cycle',n);active.add(n)
 for dep in meta[n]['imports']:
  if dep in images:edges.append([n,dep]);visit(dep)
 active.remove(n);seen.add(n)
 if n!='enigma.exe':order.append(n)
visit('msvcrt.dll');visit('enigma.exe')
def gate(providers):
 required=set(order);assert required<=set(providers),'missing required providers: '+str(sorted(required-set(providers)))
 assert meta['sdl.dll']['export_rvas']['SDL_getenv']==37536
 assert sha(pathlib.Path(images['sdl.dll']['path']).read_bytes())=='66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b'
 for a,b in edges:
  if a!='enigma.exe':assert providers.index(b)<providers.index(a),(a,b)
gate(order)
try:gate([n for n in order if n!='sdl.dll'])
except AssertionError as e:reject=str(e)
else:raise AssertionError('missing SDL accepted')
args=[('--dlls='+','.join(str(H/images[n]['target']) for n in order)) if a.startswith('--dlls=') else a for a in args];save('guest-args.json',args)
save('provider-readiness.json',dict(passGate=True,providers=order,edges=edges,omittedNotNormalImport=sorted(set(images)-set(order)-{'enigma.exe'}),rejectMissingSDL=reject,SDL_getenvRVA=37536,parserSHA256=sha(b),runnerSHA256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',normalImportsOnly=True))
# Canonical exact parser checkpoint before checkout.
s=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')];code='const assert=require("assert"),args='+json.dumps(args[4:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(str(H/'vfs'))+']);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArg("dlls").split(",").length,'+str(len(order))+');console.log("PASS actual explicit argv/tree parser")';r=subprocess.run(['node','--max-old-space-size=256','-e',code],capture_output=True,text=True,timeout=60);save('precheckout-parser.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,argv=args));assert r.returncode==0
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';r=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/task/enigma-diagnostic-loader-startup-oct24'],env=dict(os.environ,GIT_SSH_COMMAND=ssh),capture_output=True,text=True,timeout=30);assert r.returncode==0 and r.stdout.split()[0]=='4285b2bc213da24003a574af45e9d4622d1cfb7c';save('trusted-donor.json',dict(ssh=ssh,remote=r.stdout))
from work import py
j=py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))');save('remote-admission.json',j)
print(json.dumps(dict(providers=order,reject=reject,remote=j['stdout'],history=priorOutput+priorRemote)))

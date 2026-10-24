from work import *
import re
P=pathlib.Path('/tmp/maelstrom-select-return-capture-oct24');D=pathlib.Path('/tmp/enigma-register-load-cause-oct24/repo');C=pathlib.Path('/home/user/.codex')
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
assert subprocess.check_output(['git','-C',str(D),'rev-parse','HEAD'],text=True).strip()=='763c9f6bca47fd555b675aaa400e477307318af0'
q=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/task/enigma-register-load-cause-oct24'],env=dict(os.environ,GIT_SSH_COMMAND=ssh),capture_output=True,text=True,timeout=30);assert q.returncode==0,q.stderr;assert q.stdout.split()[0]=='763c9f6bca47fd555b675aaa400e477307318af0';save('trusted-donor.json',dict(ssh=ssh,remote=q.stdout))
m=[x for x in json.load(open(P/'manifest.json')) if not x['target'].startswith('vfs/')]
orig=pathlib.Path('/tmp/enigma-original-win32-closure-oct24/original');pins=json.load(open(orig.parent/'original-sha256.json'));assert sha((orig.parent/'original-sha256.json').read_bytes())=='74a65c35b0742c00f0a53f4590fe1c888715e6b59acae8f0349d1d98c1dbb574'
outputs=pathlib.Path('/tmp/enigma-authentic-static-unpack-oct24/outputs');over={p.name.lower():p for p in outputs.iterdir() if p.is_file()};assert len(over)==10
dirs=set();originalLogical=0;originalAllocated=0;overlaid=[]
for rel,expected in pins.items():
 p=orig/rel;assert p.is_file() and sha(p.read_bytes())==expected;originalLogical+=p.stat().st_size;originalAllocated+=p.stat().st_blocks*512
 alt=over.get(p.name.lower()) if len(pathlib.Path(rel).parts)==2 else None
 src=alt or p;target='vfs/'+rel
 row=dict(kind='file',path=str(src),target=target,bytes=src.stat().st_size,sha256=sha(src.read_bytes()),originalSHA256=expected,diagnosticOverlay=bool(alt));m.append(row);overlaid.append(row)
 dirs.update(str(x) for x in pathlib.Path(target).parents if str(x)!='.')
assert len(overlaid)==2460 and originalLogical==17591277 and originalAllocated==22994944
save('manifest.json',m);save('original-overlay.json',dict(originalManifestSHA256=sha((orig.parent/'original-sha256.json').read_bytes()),files=len(overlaid),originalLogical=originalLogical,originalAllocated=originalAllocated,overlays=[x for x in overlaid if x['diagnosticOverlay']],commaNames=[x['target'] for x in overlaid if ',' in x['target']]))
a=['node','--max-old-space-size=512','--require='+str(H/'preload.cjs'),str(H/'runner/test/run.js'),'--no-build','--wasm='+str(H/'runtime/build/wine-assembly.wasm'),'--exe='+str(H/'vfs/Enigma-1.01/enigma.exe'),'--exe-guest-path=C:\\Enigma-1.01\\enigma.exe','--cwd=C:\\Enigma-1.01','--dlls='+str(H/'system/msvcrt.dll'),'--quiet-api','--quiet-blocks','--no-close','--max-seconds=55','--memory-mb=512','--screen=640x480','--vfs-tree='+str(H/'vfs'),'--max-batches=10000000','--trace-api=LoadLibraryA,GetProcAddress,ExitProcess,MessageBoxA,MessageBoxW','--count=0x5ab8f0,0x5ab957,0x5ab965,0x5ab98e','--input=30000:png:'+str(H/'guest/startup.png')]
save('guest-args.json',a)
source=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();assert sha(source.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
parser=source[source.index('const getArg ='):source.index('// Was `--name=...`')]
code='const assert=require("assert");const args='+json.dumps(a[4:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(str(H/'vfs'))+']);assert.equal(getArgs("vfs-mount").length,0);assert(hasFlag("quiet-api")&&hasFlag("quiet-blocks"));console.log(JSON.stringify({tree:getArgs("vfs-tree"),cwd:getArg("cwd"),noBuild:hasFlag("no-build")}));'
r=subprocess.run(['node','--max-old-space-size=256','-e',code],capture_output=True,text=True,timeout=60);save('precheckout-parser.json',dict(status=r.returncode,stdout=r.stdout,stderr=r.stderr,parserSHA256=sha(parser.encode())));assert r.returncode==0
save('trace-capability.json',dict(runnerSHA256=sha(source.encode()),decision='supported API trace only; counts are block observations, not exact native-entry/string/cache observations',reason='trace-at uses set_bp one address and JS block boundaries for multiple addresses; builtin strings read g2w without a guest-readable mapping proof; no supported exact-instruction bounded valid-pointer observation established',requestedEntry='0x5ab8f0',limit=16))
j=py('import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,node=shutil.which("node"))))');save('remote-admission.json',j);remoteInfo=json.loads(j['stdout']);assert remoteInfo['uid']==1000
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-diagnostic-loader-startup-oct24')
sql={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
alloc=sum((x['bytes']+4095)//4096*4096 for x in m)+(len(dirs)+40)*4096
charges=dict(remoteMaterialized=alloc,remoteHelpersEvidence=1048576,localCheckoutGitEvidence=3145728,transferOverlap=262144,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,externalFuture=8388608,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
j=dict(charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,remoteFree=remoteInfo['free'],remoteAfter=remoteInfo['free']-peak,session=str(session),launcher=str(launcher),sourceMemAvailable=mem,perFileMax=max(x['bytes'] for x in m),standingManifest=str(P/'manifest.json'),standingTools=[])
for name in ['git','python3','node']:
 p=pathlib.Path(shutil.which(name)).resolve();j['standingTools'].append(dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
j['passAdmission']=peak<=67108864 and min(free,remoteInfo['free'])-peak>=2982150144 and mem>=805306368 and remoteInfo['memAvailable']>=2684354560 and j['perFileMax']<=25165824
save('admission.json',j);print(json.dumps(j),flush=True);assert j['passAdmission'],j
R=H/'repo';R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
obj=subprocess.check_output(['git','-C',str(D),'rev-parse','--git-path','objects'],text=True).strip();obj=str((D/obj).resolve()) if not obj.startswith('/') else obj
seen=set();ordered=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));ordered.append(str(p));f=p/'info/alternates'
 if f.exists():
  for line in f.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
visit(obj);(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n')
subprocess.run(['git','-C',str(R),'config','core.sparseCheckout','true'],check=True);subprocess.run(['git','-C',str(R),'config','core.sparseCheckoutCone','false'],check=True)
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/docs/re-notes/enigma-diagnostic-loader-startup-20261024*\n/tools/enigma-diagnostic-startup*\n')
save('sparse-projection.json',dict(paths=(R/'.git/info/sparse-checkout').read_text(),capCheckoutGit=3145728))
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/enigma-diagnostic-loader-startup-oct24','763c9f6bca47fd555b675aaa400e477307318af0'],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
print('setup PASS')

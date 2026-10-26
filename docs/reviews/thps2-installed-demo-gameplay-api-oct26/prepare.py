from common import *
import re,shutil
pins=json.load(open(ROOT/'scratch/usage-watch/parallel-game-recovery-1828-oct26-pins.json'))
for e in pins['pins']:assert pathlib.Path(e['path']).stat().st_size==e['bytes'] and sha(e['path'])==e['sha256'],e['path']
save('pins.json',dict(receiptSHA256=sha(ROOT/'scratch/usage-watch/parallel-game-recovery-1828-oct26-pins.json'),verified=26,pins=pins['pins']))
remote=py('import json,shutil,pathlib; print(json.dumps(dict(memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,diskFree=shutil.disk_usage("/tmp").free)))');save('remote-initial.json',remote)
C=pathlib.Path('/home/user/.codex'); db={str(p):p.stat().st_blocks*512 for p in C.glob('*.sqlite*')};save('db-baseline.json',db)
session=list((C/'sessions/2026/10/26').glob('*'+os.environ['CODEX_SESSION_ID']+'*'))[0]
launch=ROOT/'scratch/usage-watch'/H.name
def bytesize(p):return sum(f.stat().st_blocks*512 for f in p.rglob('*') if f.is_file())
m=json.load(open('/tmp/enigma-provider-complete-startup-oct24/manifest.json'))
selected=[e for e in m if e['kind']=='git' and (e['path'].endswith(('.js','.json','.wat','.tlb','.fon')) and e['path']!='package-lock.json' or e['path'].startswith('fonts/subset/'))]
localClosure=sum(e['bytes'] for e in selected)
game=[dict(path=e['path'],target='vfs/THPS2/'+pathlib.Path(e['path']).name,bytes=e['bytes'],sha256=e['sha256'],kind='file') for e in pins['pins'] if '/thps2-demo/game/' in e['path']]
module=next(e for e in pins['pins'] if e['path'].endswith('build/wine-assembly.wasm'))
charges=dict(hostClosure=0,remoteClosure=localClosure+sum(e['bytes'] for e in game)+module['bytes'],codecBoth=500000,gitCheckoutEvidence=1500000,hostSession=session.stat().st_blocks*512,hostLauncher=bytesize(launch),futureSessionLauncherWAL=2200000,capturesLogsBoth=1800000,helpersBoth=250000,reserve=8388608)
total=sum(charges.values());hostmem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
admit=dict(charges=charges,total=total,cap=67108864,hostMemAvailable=hostmem,hostFree=shutil.disk_usage(H).free,remote=remote,remoteRequired=2684354560+805306368+268435456,aggregateLiveArenaBytes=0,prospectiveArenaBytes=536870912,prospectiveGuestHeapBytes=536870912,prospectiveSupervisorHeapBytes=201326592,helpersTransient=268435456,session=str(session),launcher=str(launch),standingGameBytes=sum(e['bytes'] for e in game),passGate=total<=67108864 and hostmem>=805306368 and shutil.disk_usage(H).free-total>=2982150144 and remote['memAvailable']>=2684354560+805306368+268435456)
save('resource-prestage.json',admit);assert admit['passGate'],admit
# Trusted transport is checked before checkout; no trust-file mutation.
remoteRef=git('ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main').decode().strip();save('trusted-git.json',dict(command=SSH,remoteMain=remoteRef))
R=H/'repo';R.mkdir();git('init','-q',str(R)); seen=set();order=[]
def visit(p):
 p=p.resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(pathlib.Path(line) if line.startswith('/') else p/line)
 order.append(str(p))
visit(ROOT/'.git/objects');(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
base=git('rev-parse','HEAD').decode().strip()
git('config','core.sparseCheckout','true',cwd=R);git('config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
git('update-ref','refs/heads/task/'+H.name,base,cwd=R);git('symbolic-ref','HEAD','refs/heads/task/'+H.name,cwd=R);git('read-tree','-mu','HEAD',cwd=R)
git('config','user.name','Wine Ops',cwd=R);git('config','user.email','wine-ops@local',cwd=R);git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
save('checkout.json',dict(base=base,branch='task/'+H.name,alternates=order))
manifest=[]
for e in selected:
 data=git('show',e['revision']+':'+e['path'],cwd=pathlib.Path(e['donor']));assert len(data)==e['bytes'] and hashlib.sha256(data).hexdigest()==e['sha256']
 manifest.append(dict(e,standingDonor=e['donor'],historicalPath=e['path'],streamGitWithoutHostCopy=True))
manifest+=game+[dict(module,target='runtime/build/wine-assembly.wasm',kind='file')]
# Existing installed pngjs only, no install/download. Bind every transferred file.
codec=ROOT/'scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs'
for p in codec.rglob('*'):
 if p.is_file() and (p.suffix=='.js' or p.name=='package.json'):
  manifest.append(dict(path=str(p),target='runner/node_modules/pngjs/'+str(p.relative_to(codec)),bytes=p.stat().st_size,sha256=sha(p),kind='file'))
helper=pathlib.Path('/tmp/enigma-accepted-lossless-startup-oct24/repo/tools/lossless-capture-png.cjs')
assert sha(helper)=='537acd267b07490bca0694116b0fbc20a81d553487dac2606be27ec20811f03e'
manifest.append(dict(path=str(helper),target='ops/lossless-capture-png.cjs',bytes=helper.stat().st_size,sha256=sha(helper),kind='file'))
save('manifest.json',manifest); print(json.dumps(dict(admission=True,projected=total,files=len(manifest),remoteBytes=sum(e['bytes'] for e in manifest),historicalRevision=selected[0]['revision'])))

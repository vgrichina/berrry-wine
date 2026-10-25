import os,json,hashlib,shutil,subprocess,time,signal
from pathlib import Path
from run import run,OUT,limits
R=OUT.parent/'repo'
BASE='397cdb6ca37c1f247cdd6e2618f6e1f3529342c4'
CAND='a86f708fdb65e99ebd067ce4ea5dfbeb33c47c98'
REVIEW='1cab775d047f651a91b4752d031854cf8c835068'
MAIN='880654e00710fe89c1ea95aa2d583a53ad4de890'
BRANCH='task/save-sync-owned-upload-accepted-integrate-oct25'
DONOR=Path('/tmp/save-sync-upload-independent-accept-oct25/repo')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ.pop('GIT_OBJECT_DIRECTORY',None)
leaves=json.loads(Path('/tmp/render-byte-identity-accepted-integrate-oct25/ops/configuration.json').read_text())['flatLeaves']
leaves += json.loads(Path('/tmp/seh-coordinator-object-view-oct25/receipt.json').read_text())['gitAlternateObjectDirectories'].split(':')
leaves += ['/tmp/render-byte-identity-accepted-integrate-oct25/repo/.git/objects','/tmp/save-sync-upload-independent-accept-oct25/repo/.git/objects','/tmp/save-sync-owned-upload-repair-oct25/repo/.git/objects']
leaves += ['/tmp/save-overlay-atomic-independent-accept-oct25/repo/.git/objects','/tmp/recovery-save-overlay-correctness-oct25/repo/.git/objects']
leaves=list(dict.fromkeys(leaves))
assert all(Path(p).is_dir() and not (Path(p)/'info/alternates').exists() for p in leaves)
E={'GIT_ALTERNATE_OBJECT_DIRECTORIES':':'.join(leaves),'GIT_SSH_COMMAND':SSH,'PYTHONDONTWRITEBYTECODE':'1','GIT_CONFIG_COUNT':'2','GIT_CONFIG_KEY_0':'gc.auto','GIT_CONFIG_VALUE_0':'0','GIT_CONFIG_KEY_1':'maintenance.auto','GIT_CONFIG_VALUE_1':'false'}
def save(n,j): (OUT/(n+'.json')).write_text(json.dumps(j,indent=2)+'\n')
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 return h.hexdigest()
def admission(stage):
 used=sum(p.lstat().st_blocks*512 for p in OUT.parent.rglob('*') if not p.is_symlink())
 sess=Path('/home/user/wine-assembly/scratch/usage-watch/save-sync-owned-upload-accepted-integrate-oct25')
 launch=sum(p.stat().st_blocks*512 for p in sess.rglob('*') if p.is_file())
 sessionFiles=list(Path('/home/user/.codex/sessions/2026/10/25').glob('*'+json.loads((OUT/'shared-db-checkpoint.json').read_text())['sessionId']+'*'))
 session=sum(p.stat().st_blocks*512 for p in sessionFiles)
 db=Path('/home/user/.codex');initial=json.loads((OUT/'shared-db-checkpoint.json').read_text())['databaseAllocated']
 shared=sum(p.stat().st_blocks*512 for pat in ['*.sqlite-wal','*.sqlite-shm'] for p in db.glob(pat))
 growth=sum(max(0,p.stat().st_blocks*512-initial.get(str(p),p.stat().st_blocks*512)) for p in db.glob('*.sqlite'))
 mem=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage('/tmp').free;future=8*1048576;reserve=8*1048576
 peak=used+launch+session+shared+growth+future+reserve
 ok=peak<=64*1048576 and free-future-reserve>=2982150144 and mem>=1073741824
 save('admission-'+stage,dict(owned=used,launch=launch,session=session,sharedWALSHM=shared,positiveDBgrowth=growth,projected=peak,cap=67108864,reserve=reserve,futureCheckoutGitEvidencePublicationCaptureSessionSharedGrowth=future,free=free,availableRAM=mem,passGate=ok,commands='focused offline JS fixtures, syntax, sparse Git plumbing, strict Git SSH; no compiler/browser/guest/wasm',limits='heap128MiB CPUwall60s file24MiB combinedcapture128KiB cumulative2MiB TERM2KILL3reap5s',standing='readonly flattened donor objects and installed tools in place, no duplicate staging'))
 assert ok

def git(*args,cwd=R,label=None):
 rc,a,b=run(['git',*args],cwd=cwd,env=E,label=label)
 assert rc==0,(args,rc,b[:1500]);return a
def closure(tree):
 p=subprocess.Popen(['git','ls-tree','-r','-t',tree],cwd=R,env={**os.environ,**E},stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits)
 q=subprocess.Popen(['git','cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],cwd=R,env={**os.environ,**E},stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits)
 h=hashlib.sha256();n=0;total=0;start=time.monotonic()
 try:
  for line in p.stdout:
   assert time.monotonic()-start<60
   oid=line.split(b'\t',1)[0].split()[2];q.stdin.write(oid+b'\n');q.stdin.flush();a=q.stdout.readline(256)
   assert b' missing' not in a and len(a)<256,(oid,a)
   total+=int(a.split()[2]);h.update(line);n+=1
  q.stdin.close();assert p.wait(timeout=5)==0 and q.wait(timeout=5)==0
  assert not p.stderr.read(8192) and not q.stderr.read(8192)
 finally:
  for proc in [p,q]:
   if proc.poll() is None:
    os.killpg(proc.pid,signal.SIGTERM)
    try:proc.wait(timeout=2)
    except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=3)
 save('closure',dict(tree=tree,objects=n,standingReachableBytes=total,inventorySHA256=h.hexdigest(),complete=True))
def identities():
 assert sha(R/'lib/save-sync.js')=='87bc3878b4700b64f93a82f8920977677e9caeb2bbfcbecd1a572eb750d2dced'
 assert sha(R/'lib/d3d9-host.js')=='3519e4ffeee513a1ba106ac25c77cadab7ffbe492eb61f70f5b4f7fbb38db22c'
 assert sha(R/'lib/overlay-store.js')=='355c04686750794b161b725c00195fc84ea8d89f59a0ab773b4f7f93ecfbc0c9'
if __name__=='__main__':
 admission('checkout')
 save('configuration',dict(ssh=SSH,ownObjects=True,flatLeaves=leaves,nonrecursive=True,mountArgv=[],intendedMountedFiles=[],mountValidation='No mount/runtime invocation; canonical mount parser inapplicable',flatReceiptSHA256=sha('/tmp/seh-coordinator-object-view-oct25/receipt.json')))
 tools=[]
 for name in ['git','node','python3']:
  p=Path(shutil.which(name)).resolve();tools.append(dict(name=name,path=str(p),bytes=p.stat().st_size,sha256=sha(p),standing=True))
 save('standing-inputs',dict(tools=tools,donorsReadonly=True))
 seals=json.loads((DONOR.parent/'ops/evidence-manifest.json').read_text())
 for v in seals:
  n=v['name'];d=v['sha256'];assert sha(DONOR.parent/'ops'/n)==d,n
 save('accepted-inputs',dict(seals=len(seals),candidate=CAND,review=REVIEW,acceptedResult=json.loads((DONOR.parent/'ops/result.json').read_text()),publication=json.loads((DONOR.parent/'ops/publication.json').read_text())))
 git('init','-q',str(R),cwd=OUT)
 for k,v in [('user.name','Wine Assembly Worker'),('user.email','worker@wine-assembly.local'),('core.sparseCheckout','true'),('core.sparseCheckoutCone','false')]:git('config',k,v)
 url=git('remote','get-url','origin',cwd=DONOR).decode().strip();git('remote','add','origin',url)
 refs=git('ls-remote','--exit-code','origin','refs/heads/main','refs/heads/task/save-sync-upload-independent-accept-oct25','refs/heads/task/save-sync-owned-upload-repair-oct25',label='remote-before').decode().splitlines()
 refs={x.split()[1]:x.split()[0] for x in refs};assert refs['refs/heads/main']==MAIN and refs['refs/heads/task/save-sync-upload-independent-accept-oct25']==REVIEW and refs['refs/heads/task/save-sync-owned-upload-repair-oct25']==CAND
 git('fetch','--no-tags','--no-auto-maintenance','origin','+refs/heads/main:refs/remotes/origin/main','+refs/heads/task/save-sync-upload-independent-accept-oct25:refs/remotes/origin/accepted',label='fetch')
 assert git('rev-parse','refs/remotes/origin/main').decode().strip()==MAIN
 assert git('rev-parse','refs/remotes/origin/accepted').decode().strip()==REVIEW
 (R/'.git/shallow').write_text(BASE+'\n')
 changed=git('diff','--name-only',BASE,REVIEW).decode().splitlines()
 allowed={'lib/save-sync.js','test/test-save-sync-owned-upload.js','test/test-d3d9-immutable-rgba-snapshot.js','test/test-d3d9-texture-snapshot-cache.js','test/test-d3d9-rgba-generation-independent.js','test/test-d3d9-rgba-source-identity.js','test/test-d3d9-byte-identity-acceptance.js'}
 assert all(p in allowed or p.startswith('ops/handoffs/save-sync-owned-upload-repair-oct25/') or p.startswith('docs/reviews/save-sync-upload-independent-accept-oct25/') for p in changed),changed
 selected=set(changed)|{'lib/*.js','test/test-vfs-overlay.js','test/test-d3d9-immutable-rgba-snapshot.js','test/test-save-sync-upload-validation.js','test/test-save-bundle.js'}
 (R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in sorted(selected)))
 git('checkout','-q','-b',BRANCH,MAIN,label='checkout')
 git('merge','--no-ff','--no-commit',REVIEW,label='merge')
 tree=git('write-tree').decode().strip()
 actual=git('diff','--cached','--name-only',MAIN).decode().splitlines();assert actual==changed
 for p in changed:assert git('rev-parse',':'+p)==git('rev-parse',REVIEW+':'+p)
 identities();git('diff','--cached','--check',label='diff-check');closure(tree)
 save('merged-tree',dict(preMain=MAIN,candidate=CAND,review=REVIEW,tree=tree,acceptedPaths=changed,unrelatedPreserved=True,saveSyncSHA256=sha(R/'lib/save-sync.js'),rendererSHA256=sha(R/'lib/d3d9-host.js'),overlaySHA256=sha(R/'lib/overlay-store.js')))
 print(json.dumps(dict(tree=tree,paths=len(changed),seals=len(seals))))

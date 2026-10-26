from common import *
import tarfile,io,gzip,difflib
if not (O/'db-baseline.json').exists():save('db-baseline.json',{str(p):alloc(p) for p in C.glob('*.sqlite*')})
save('incidents.json',[dict(kind='procedural-read-overrun',detail='Initial tool reads of instructions/pins were not limited to8192 bytes. No guest or runtime group executed; all subsequent capture reads bounded.')])
save('schedule.json',dict(box=BOX,guestCutoff='2026-10-26T19:10:00Z',handback='2026-10-26T19:15:00Z',shutdown='2026-10-26T19:20:00Z',expiry='2026-10-26T19:29:32Z'))
pins=json.load(open(ROOT/'scratch/usage-watch/parallel-game-recovery-1828-oct26-pins.json'))
verified=[]
for x in pins['pins']:
 if not ('/maelstrom-' in x['path']):continue
 p=pathlib.Path(x['path']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],str(p);verified.append(x)
for x in json.load(open(ROOT/'scratch/usage-watch/maelstrom-next-original-capture-pins-oct26.json'))['pins']:
 b=pathlib.Path(x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
save('pins-verified.json',dict(inputReceiptSHA256=sha((ROOT/'scratch/usage-watch/parallel-game-recovery-1828-oct26-pins.json').read_bytes()),pins=verified,eightOriginalPinsPass=True,source=SOURCE,evidenceBase=BASE))
account('before-checkout',extra=7000000)
R.mkdir(exist_ok=True);git('init','-q',str(R),cwd=H)
stores=[];seen=set()
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for x in a.read_text().splitlines():visit(p/x if not x.startswith('/') else x)
 stores.append(str(p))
visit(ROOT/'.git/objects');visit(pathlib.Path('/tmp/maelstrom-retained-native-independent-closeout-oct26/repo/.git/objects'))
(R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/'+H.name+'/\n')
git('update-ref','refs/heads/task/'+H.name,BASE);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD')
if 'origin' not in git('remote').decode().splitlines():git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for k in ['user.name','user.email']:git('config',k,git('config',k,cwd=ROOT).decode().strip())
save('checkout.json',dict(base=BASE,source=SOURCE,branch='task/'+H.name,ssh=SSH,alternates=str(ROOT/'.git/objects'),rootRefReceipt=json.load(open(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json')),sparse=['docs/reviews/'+H.name],rootRefMutation=False))
if not (O/'watcher.json').exists():
 log=open(O/'board-watch.log','ab');watch=subprocess.Popen(['tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=watch.pid))
# Runtime closure from the accepted standing manifest; tracked runtime files are taken from exact production SOURCE.
old=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25');rows=json.load(open(old/'manifest.json'))
standing=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text()
patched=pathlib.Path('/tmp/maelstrom-current-uop-original-errno-capture-oct26/runner/test/run.js').read_text()
patched=patched.replace('function nativeRaw(stage, error) {','function nativeRaw(stage, error, batch=null) {').replace("stage,crtGetptdTarget,error:","stage,batch,crtGetptdTarget,error:")
patched=patched.replace("catch(error){nativeRaw('first-latch-rejection',error);throw error;}","catch(error){nativeRaw('first-latch-rejection',error,batch);throw error;}")
patched=patched.replace('    } catch (e) {\n      flushLogs();\n      console.log(`\\n*** CRASH at batch ${batch}: ${e.message}`);','    } catch (e) {\n      nativeRaw(\'first-run-failure\',e,batch);\n      flushLogs();\n      console.log(`\\n*** CRASH at batch ${batch}: ${e.message}`);')
assert "nativeRaw('first-run-failure',e,batch)" in patched
assert sha(standing.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
assert patched.count('const nativeDiagnostic =')==1 and patched.count('originalNativeObserve(batch)')==4
save('runner-diff.json',dict(standingSHA256=sha(standing.encode()),adaptedSHA256=sha(patched.encode()),patch=''.join(difflib.unified_diff(standing.splitlines(True),patched.splitlines(True),fromfile='pinned-standing',tofile='adapted-observer')),guestMemoryMutation=False))
files={};provenance={}
tracked=set(git('ls-tree','-r','--name-only',SOURCE).decode().splitlines())
for x in rows:
 target=x['target']
 if target.startswith(('runtime/fonts/','runtime/test/')) or target=='runner/package-lock.json':continue
 if target=='runtime/build/wine-assembly.wasm':continue
 p=pathlib.Path(x['path']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],target
 rel=target.removeprefix('runner/')
 if target.startswith('runner/') and rel in tracked:
  b=git('show',SOURCE+':'+rel);provenance[target]=SOURCE+':'+rel
 else:provenance[target]='standing:'+str(p)
 files[target]=b
donor=pathlib.Path('/tmp/maelstrom-accepted-guard-diagnostics-canonical-qualification-oct26')
files['runner/lib/render-clear.js']=git('show',SOURCE+':lib/render-clear.js');provenance['runner/lib/render-clear.js']=SOURCE+':lib/render-clear.js'
files['runtime/build/wine-assembly.wasm']=(donor/'ops/errno-latch.wasm').read_bytes();provenance['runtime/build/wine-assembly.wasm']='accepted retained module'
for n in ['maelstrom-native-errno-latch.cjs','maelstrom-original-errno-adapter.cjs','maelstrom-select-completion-hook.cjs']:
 files['runner/tools/'+n]=(donor/'repo/tools'/n).read_bytes();provenance['runner/tools/'+n]='accepted pinned helper'
files['runner/test/run.js']=patched.encode();provenance['runner/test/run.js']='pinned standing runner + recorded observer-only patch'
manifest=[dict(target=t,bytes=len(b),sha256=sha(b),provenance=provenance[t]) for t,b in sorted(files.items())]
save('../manifest.json',manifest)
args=json.load(open(old/'guest-args.json'));args=[x.replace(str(old),str(H)) for x in args if not x.startswith('--maelstrom-select-frozen-record=')]
args+=['--original-native-record='+str(H/'guest/native.jsonl')]
save('../guest-args.json',args)
with tarfile.open(O/'closure.tar.gz','w:gz') as tar:
 for t,b in files.items():
  i=tarfile.TarInfo(t);i.size=len(b);i.mode=0o644;tar.addfile(i,io.BytesIO(b))
del files
save('closure.json',dict(files=len(manifest),expandedBytes=sum(x['bytes'] for x in manifest),archiveBytes=(O/'closure.tar.gz').stat().st_size,archiveSHA256=sha((O/'closure.tar.gz').read_bytes()),noBuild=True,source=SOURCE))
account('closure-prepared',remoteProjection=sum(x['bytes']+4096 for x in manifest)+2000000,extra=2000000)
print(json.dumps(json.load(open(O/'closure.json'))))

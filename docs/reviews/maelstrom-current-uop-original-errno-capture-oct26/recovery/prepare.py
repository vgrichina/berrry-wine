from common import *
import gzip,base64,zlib,re,importlib.util
if not (O/'db-baseline.json').exists():save('db-baseline.json',{str(p):alloc(p) for p in C.glob('*.sqlite')})
save('schedule.json',dict(guestCutoff='2026-10-26T10:00:00Z',handback='2026-10-26T10:05:00Z',shutdown='2026-10-26T10:10:00Z',expiry='2026-10-26T10:32:43.299Z'))
save('configuration.json',dict(revision=REV,ssh=SSH,sourceDonor=str(DONOR),box=BOX,session='01a17792-ce1d-7f43-8678-8bcdabd5c979'))
account('initial-compressed-source',remoteProjection=12582912)
pins=json.load(open(ROOT/'scratch/usage-watch/maelstrom-original-recapture-immutable-inputs-oct26.json'))
for row in pins['pinsVerified']:
 if row['path'].endswith('.wasm'):continue
 b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
save('immutable-pins.json',pins)
args=[a.replace(str(S),str(H)) for a in json.load(open(S/'guest-args.json')) if not a.startswith('--maelstrom-select-frozen-record=')];args+=['--original-native-record='+str(H/'guest/native.jsonl')]
save('../guest-args.json',args)
src=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text();parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')]
code='const fs=require("fs"),vm=require("vm");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(3);'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mounts:getArgs("vfs-mount"),dlls:getArgs("dlls"),input:getArg("input")}))'
p=subprocess.run(['node','--max-old-space-size=512','-e',code,str(H/'guest-args.json')],capture_output=True,text=True,timeout=30);assert not p.returncode,p.stderr
parsed=json.loads(p.stdout);assert parsed['tree']==[str(H/'vfs')] and parsed['mounts']==[]
m=json.load(open(S/'manifest.json'));intended=[]
for row in m:
 b=pathlib.Path(row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
 if row['target'].startswith('vfs/'):intended.append(dict(target=row['target'],bytes=len(b),sha256=sha(b),futureHost=str(H/row['target']),guest='C:\\'+row['target'][4:].replace('/','\\')))
assert len(intended)==48 and any(',' in x['target'] for x in intended)
save('mount-precheckout.json',dict(passChecks=True,actualFutureArgv=args,parserSHA256=sha(parser.encode()),parsed=parsed,intended=intended,method='Canonical runner parser on exact future argv; all intended original tree files hash-verified before checkout; actual remote tree enumeration required before guest'))
R.mkdir(exist_ok=True);git('init','-q',str(R),cwd=H)
(R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n')
# Accepted immutable commit is in the standing root object store. No fetching or cloning.
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-select-completion-hook.cjs']
ids={REV:'commit'}
tree=git('rev-parse',REV+'^{tree}',cwd=DONOR/'repo').decode().strip();ids[tree]='tree'
treeRows=git('ls-tree','-rd',REV,cwd=DONOR/'repo')+git('ls-tree',REV,'--',*selected,cwd=DONOR/'repo')
for line in treeRows.decode().splitlines():
 meta,p=line.split('\t',1);_,kind,oid=meta.split()
 if kind=='tree' or p in selected:ids[oid]=kind
roothead=git('rev-parse','HEAD',cwd=ROOT).decode().strip()
for oid in git('rev-list',REV,'--not',roothead,cwd=DONOR/'repo').decode().splitlines():ids[oid]='commit'
copied=[]
for oid,kind in ids.items():
 if subprocess.run(['git','cat-file','-e',oid],cwd=R,preexec_fn=glim,stderr=subprocess.DEVNULL).returncode==0:continue
 b=git('cat-file',kind,oid,cwd=DONOR/'repo');raw=(kind+' '+str(len(b))+'\0').encode()+b;assert hashlib.sha1(raw).hexdigest()==oid
 q=R/'.git/objects'/oid[:2]/oid[2:];q.parent.mkdir(exist_ok=True);q.write_bytes(zlib.compress(raw));copied.append(dict(oid=oid,kind=kind,bytes=q.stat().st_size))
save('recovered-git-objects.json',copied)
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
git('update-ref','refs/heads/task/'+H.name,REV);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for key in ['user.name','user.email']:git('config',key,git('config',key,cwd=DONOR/'repo').decode().strip())
for p,h in [(selected[0],'3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f'),(selected[1],'28c1c3249ef488d4b2df1ccb3d0658cc1b02803ca9163f5a2bb24f945ba00551')]:assert sha((R/p).read_bytes())==h
save('checkout.json',dict(revision=REV,branch='task/'+H.name,selected=selected,alternates=str(ROOT/'.git/objects'),noFetch=True))
manifest=json.load(open(DONOR/'ops/current-manifest.json'));rows=manifest['files'];assert len(rows)==140
# Stream the sealed sources through gzip: no expanded materialized source tree.
with gzip.GzipFile(filename=str(O/'sources.json.gz'),mode='wb',mtime=0) as out:
 out.write(b'{');n=0
 for row in rows:
  b=blob(row['path']);assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
  if row['path'].startswith('src/'):
   if n:out.write(b',')
   out.write(json.dumps(row['path']).encode()+b':'+json.dumps(base64.b64encode(b).decode()).encode());n+=1
  else:
   p=H/'canonical'/row['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
 out.write(b'}')
assert n==128;oldBundle=manifest['bundleSHA256'];manifest['bundleSHA256']=sha((O/'sources.json.gz').read_bytes());save('current-manifest.json',manifest)
save('source-closure.json',dict(revision=REV,originalManifestCandidate=manifest['candidate'],files=rows,sourceBytes=manifest['sourceBytes'],sourceCount=n,oldBundleSHA256=oldBundle,newBundleSHA256=manifest['bundleSHA256'],bundleOnlyReserialization=True))
driver=(DONOR/'repo/tools/maelstrom-diagnostic-canonical-build.cjs').read_text();before=sha(driver.encode())
assert driver.count('for(const tailCalls of [true,false])')==1;driver=driver.replace('for(const tailCalls of [true,false])','for(const tailCalls of [true])')
# Serialization changes only build selection, not transform, source or compiler.
(R/'tools/maelstrom-diagnostic-canonical-build.cjs').write_text(driver)
for n,p in [('net',pathlib.Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/SDL_net.dll')),('exe',pathlib.Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6/Maelstrom.exe')),('crt',S/'runtime/system/msvcrt.dll')]:
 q=O/'anchors'/n;q.parent.mkdir(exist_ok=True);q.write_bytes(p.read_bytes())
save('reconstruction-recipe.json',dict(immutableHelperSHA256=sha((DONOR/'ops/maelstrom-diagnostic-canonical-build.cjs.immutable').read_bytes()),acceptedDriverSHA256=before,tailOnlyDriverSHA256=sha(driver.encode()),onlyDriverChange='for(const tailCalls of [true,false]) -> [true]',expectedSHA256='fec642f6c711e57e1c4a3dfaeaff0e11be587c56fc64cde394ed7f54147b5988',expectedBytes=1884180,noNativeReplay=True))
account('source-prepared',remoteProjection=12582912)
print(json.dumps(dict(ready=True,sources=n,bytes=manifest['sourceBytes'],bundleBytes=(O/'sources.json.gz').stat().st_size,selected=selected)))

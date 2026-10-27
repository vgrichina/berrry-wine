import pathlib,json,os,sys,time,hashlib,shutil,subprocess,resource
H=pathlib.Path('/tmp/enigma-exact-production-initialization-gameplay-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly')
s=pathlib.Path('/tmp/alien-shooter-current-gameplay-api-oct26/ops/work.py').read_text().replace('/tmp/alien-shooter-current-gameplay-api-oct26',str(H)).replace("BOX='bx_a9dwsx2x'","BOX='bx_c7m7bu48'")
(O/'work.py').write_text(s)
from work import *
M=json.loads((ROOT/'scratch/usage-watch/enigma-exact-production-runtime-map-oct27.json').read_text());rows=M['rows'];seen=set()
for x in rows:
 p=pathlib.Path(x['path']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256'],x
 assert x['target'] not in seen;seen.add(x['target']);x['mode']=p.stat().st_mode&511
 if 'gitOid' in x:assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['gitOid']
p=pathlib.Path('/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/wine-assembly.wasm');assert sha(p.read_bytes())=='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b';rows.append(dict(path=str(p),target='runtime/build/wine-assembly.wasm',bytes=p.stat().st_size,sha256=sha(p.read_bytes()),mode=p.stat().st_mode&511))
save('manifest.json',rows);save('trusted-ssh-config.json',dict(command=SSH,unchanged=True))
save('sqlite-baseline.json',{str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*sqlite*')})
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;free=shutil.disk_usage(H).free
save('prestage-admission.json',dict(at=time.time(),free=free,new=62914560,peerFuture=50331648,projected=free-62914560-50331648,floor=2982150144,mem=mem,memRequired=1610612736,localAllocation=62914560,remoteAllocation=268435456,projection=dict(sourceGitOpsDashboard=20971520,sessionEventsWAL=16777216,staging=8388608,publication=8388608,reserve=8388608)))
assert free-62914560-50331648>=2982150144 and mem>=1610612736
old=pathlib.Path('/tmp/enigma-verified-input-menu-gameplay-api-oct26');a=json.loads((old/'ops/guest-args.json').read_text());a=[x.replace(str(old),R) for x in a if not x.startswith(('--require=','--input=','--count=','--trace-api=','--max-seconds=','--max-batches='))];a[1]='--max-old-space-size=2048';a+=['--frozen','--max-seconds=110','--max-batches=20000','--trace-message-boundary'];save('guest-args.json',a)
source=pathlib.Path(next(x['path'] for x in rows if x['target']=='runner/test/run.js')).read_text();parser=source[source.index('const getArg ='):source.index('// Was `--name=...`')];idx=a.index(R+'/runner/test/run.js')
code='const assert=require("assert"),args='+json.dumps(a[idx+1:])+';'+parser+';assert.deepEqual(getArgs("vfs-tree"),['+json.dumps(R+'/vfs')+']);assert.equal(getArgs("vfs-mount").length,0);assert.equal(getArgs("dlls").length,8);assert(hasFlag("no-build"));assert(hasFlag("frozen"));console.log("PASS exact canonical parser mounts/dlls8")'
(O/'parser-check.cjs').write_text(code)
save('parser-enumeration.json',dict(parserSHA256=sha(parser.encode()),argv=a,files=[x['target'] for x in rows if x['target'].startswith('vfs/')],commaFilenames=[x['target'] for x in rows if ',' in x['target']]))
print('LOCAL VERIFIED',len(rows),flush=True)
print(py('import pathlib,json,shutil;print(json.dumps(dict(mem=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,free=shutil.disk_usage("/tmp").free)))')['stdout'],flush=True)
remote('test ! -e '+R+' && mkdir -p '+R+'/ops/guest')
transfer([('probe-small',pathlib.Path('/etc/hostname'))]);print(py('import pathlib,hashlib;print(hashlib.sha256(pathlib.Path('+repr(R+'/probe-small')+').read_bytes()).hexdigest())')['stdout'],flush=True)
b=os.urandom(32769);(O/'probe.bin').write_bytes(b);transfer([('probe-large',O/'probe.bin')]);assert json.loads(py('import pathlib,json,hashlib;p=pathlib.Path('+repr(R+'/probe-large')+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))')['stdout'])==dict(bytes=len(b),sha256=sha(b));save('transfer-probes.json',dict(small=True,largeBytes=len(b),sha256=sha(b)));(O/'probe.bin').unlink()
start=time.time();transfer([(x['target'],pathlib.Path(x['path'])) for x in rows]);print('TRANSFERRED',time.time()-start,flush=True)
transfer([('ops/manifest.json',O/'manifest.json'),('guest-args.json',O/'guest-args.json')])
code='import pathlib,json,hashlib,os;h=pathlib.Path('+repr(R)+');rows=json.loads((h/"ops/manifest.json").read_text());bad=[]\nfor x in rows:\n p=h/x["target"];b=p.read_bytes()\n if len(b)!=x["bytes"] or hashlib.sha256(b).hexdigest()!=x["sha256"] or p.stat().st_mode&511!=x["mode"]:bad.append(x["target"])\nprint(json.dumps(dict(rows=len(rows),bytes=sum(x["bytes"] for x in rows),bad=bad)))\nassert not bad'
j=py(code);save('remote-integrity.json',j);print(j['stdout'],flush=True)

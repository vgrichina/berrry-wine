from common import *
import fcntl,base64,re,shutil
lock=open('/tmp/wine-game-capture-bx_xfbwmcty.lock','a+')
print('Waiting interruptibly for assigned box lock',flush=True);fcntl.flock(lock,fcntl.LOCK_EX);print('LOCK ACQUIRED',flush=True)
save('lock.json',dict(pid=os.getpid(),path=lock.name,acquired=time.time()))
hostmem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
save('host-before-transfer.json',dict(memAvailable=hostmem,diskFree=shutil.disk_usage(H).free,helperHeapMax=201326592,remainingNewProjection=50000000))
assert hostmem>=805306368 and shutil.disk_usage(H).free-50000000>=2982150144
assert time.time()+180<1793041800,'guest cutoff too close'
remote=py('import pathlib,json,shutil,subprocess;print(json.dumps(dict(memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,diskFree=shutil.disk_usage("/tmp").free,liveNode=subprocess.check_output(["pgrep","-a","node"],text=True) if subprocess.run(["pgrep","node"],stdout=subprocess.DEVNULL).returncode==0 else "none")))');save('resource-before-transfer.json',remote)
assert remote['memAvailable']>=3758096384 and remote['diskFree']-50000000>=2982150144
# Independent multi-chunk API transfer/write/readback, then remove owned probe.
test=bytes(range(256))*1024
for offset in range(0,len(test),49152):send(test[offset:offset+49152],'transfer-probe',offset)
r=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(str(H/'transfer-probe'))+');print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())));p.unlink()')
assert r['sha256']==hashlib.sha256(test).hexdigest();save('chunked-api-roundtrip.json',dict(r,chunkBytes=49152,base64ArgBytes=65536,readbackHashVerified=True))
manifest=json.load(open(O/'manifest.json'))
for name in ['capture.cjs','supervise.cjs','remote_check.py','guest-args.json','input-timeline.json']:
 p=O/name;manifest.append(dict(path=str(p),target='ops/'+name,bytes=p.stat().st_size,sha256=sha(p),kind='file'))
save('transfer-manifest.json',manifest)
for i,e in enumerate(manifest):
 if e['kind']=='git':data=git('show',e['revision']+':'+e['historicalPath'],cwd=pathlib.Path(e['donor']))
 else:data=pathlib.Path(e['path']).read_bytes()
 assert len(data)==e['bytes'] and hashlib.sha256(data).hexdigest()==e['sha256'],e['target']
 # Stage directly: no archive or host payload copy.
 for offset in range(0,len(data),49152):send(data[offset:offset+49152],e['target'],offset)
 if i%20==0:print('transferred',i+1,len(manifest),flush=True)
send(json.dumps(manifest).encode(),'ops/manifest.json')
verify='''import pathlib,json,hashlib,os
H=pathlib.Path(ROOT);m=json.load(open(H/'ops/manifest.json'));bad=[]
for e in m:
 p=H/e['target'];h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 if p.stat().st_size!=e['bytes'] or h.hexdigest()!=e['sha256']:bad.append(e['target'])
 if e['target'].startswith('vfs/'):p.chmod(0o444)
(H/'guest').mkdir(exist_ok=True)
p=H/'guest/output.log';p.touch();f=p.open('ab');f.write(b'[bootstrap] append verified\\n');f.close()
print(json.dumps(dict(files=len(m),bytes=sum(e['bytes'] for e in m),mismatches=bad,appendVerified=p.stat().st_size>0)))
'''.replace('ROOT',repr(str(H)))
r=py(verify);save('remote-hashes.json',r);assert not r['mismatches']
r=api('import subprocess;subprocess.run(["python3",'+repr(str(O/'remote_check.py'))+'],check=True)',60);save('startup-api.json',r)
print('STAGED AND STARTUP CHECK PASSED; awaiting same-task continuation',flush=True)
# Keep the lock through run/cleanup; readiness is event based through this marker.
(O/'stage-ready').touch()
while not (O/'continue-guest').exists():
 if time.time()>=1793041500:raise RuntimeError('handoff deadline before guest authorization marker')
 time.sleep(1)
r=api('''import os,pathlib,resource,subprocess,json,time,re
H=pathlib.Path(ROOT);mem=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=3758096384;assert time.time()+90<1793041800
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(524288,524288))
env={k:v for k,v in os.environ.items() if k not in ['NODE_OPTIONS','WINE_RUN_EXTRA_ARGS','WINE_REGION_MAP','WINE_ASSEMBLY_WASM','MAELSTROM_CAPTURE_INSTALL','ENIGMA_TERMINAL_CAPTURE_INSTALL']}
print(json.dumps(dict(memAvailable=mem,started=time.time())),flush=True)
r=subprocess.run(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--max-old-space-size=192',str(H/'ops/supervise.cjs')],env=env,cwd=H,preexec_fn=limits,timeout=100)
print(json.dumps(dict(supervisorExit=r.returncode)))
'''.replace('ROOT',repr(str(H))),110);save('guest-api.json',r)
print('GUEST FINISHED; lock released',flush=True)

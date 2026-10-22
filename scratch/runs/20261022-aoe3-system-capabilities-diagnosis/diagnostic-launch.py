from pathlib import Path
import subprocess,json,os,time,datetime,hashlib,signal,socket,shutil
E=Path('/home/user/aoe3-system-capabilities-diagnosis-oct22');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');P=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');D=E/'guest';D.mkdir(exist_ok=True)
assert not (D/'launch.json').exists();assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-22T14:05:00+00:00')
assert shutil.disk_usage(E).free>4294967296+134217728
for p,row in json.loads((P/'guest/identities-before.json').read_text()).items():
 f=Path(p);assert f.stat().st_size==row['bytes'] and hashlib.sha256(f.read_bytes()).hexdigest()==row['sha256'],p
for port in [8123,8124]:
 s=socket.socket();assert s.connect_ex(('127.0.0.1',port))!=0;s.close()
cmd=json.loads((P/'guest/launch.json').read_text())['command'];cmd=[x for x in cmd if not x.startswith(('--trace-api=','--max-seconds=','--reg-export=','--png='))]
cmd+=['--max-seconds=180','--reg-export='+str(D/'final-registry.json'),'--png='+str(D/'final.png'),'--trace-api=GetProcAddress,LoadLibraryA,LoadLibraryW,CoCreateInstance,CoInitialize,CoUninitialize,GetSystemDirectoryA,GetFileVersionInfoSizeA,GetFileVersionInfoA,VerQueryValueA','--trace-eip-range=ConfigDetect+0x10007dc0-ConfigDetect+0x10008c34','--trace-eip-detail','--trace-eip-dump=0x074ff900:96','--trace-at=0x00488b05','--trace-at-limit=1','--trace-at-mem=esp+0x30:32']
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
for k in ['NODE_OPTIONS','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:env.pop(k,None)
start=time.monotonic()
with (D/'output.log').open('wb') as out:
 p=subprocess.Popen(cmd,cwd=S,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
 (D/'launch.json').write_text(json.dumps(dict(command=cmd,cwd=str(S),pid=p.pid,pgid=p.pid,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),guestAttempts=1,ordinaryAcceptAttempts=0,observer='existing unchanged relocated original runner: bounded native version-helper EIP range and one caller return breakpoint; diagnostic arguments, canonical module unchanged',missingState='prior log has API entry only; COM HRESULT and fallback/version/init outputs UNKNOWN',guardSeconds=200,remoteCap=134217728,free=shutil.disk_usage(E).free),indent=2)+'\n')
 sent=[]
 while p.poll() is None:
  elapsed=time.monotonic()-start
  if elapsed>=195 and 'TERM' not in sent:os.killpg(p.pid,signal.SIGTERM);sent.append('TERM')
  if elapsed>=200:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   sent.append('KILL');break
  time.sleep(.25)
 code=p.wait()
(D/'exit.json').write_text(json.dumps(dict(exitCode=code,elapsedSeconds=time.monotonic()-start,signals=sent,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2)+'\n')
print((D/'exit.json').read_text())

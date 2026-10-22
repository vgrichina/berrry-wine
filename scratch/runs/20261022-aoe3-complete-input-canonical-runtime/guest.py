from pathlib import Path
import subprocess,json,os,time,datetime,hashlib,signal,socket
E=Path('/home/user/aoe3-canonical-c7fae5ac-evidence');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged');R=Path('/home/user/aoe3-original-oct22');D=E/'guest'
assert not (D/'launch.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-22T13:55:00+00:00')
assert json.loads((E/'build-result.json').read_text())['exitCode']==0
for p,row in json.loads((D/'identities-before.json').read_text()).items():
    f=Path(p);assert f.stat().st_size==row['bytes'] and hashlib.sha256(f.read_bytes()).hexdigest()==row['sha256'],p
for port in [8123,8124]:
    s=socket.socket();assert s.connect_ex(('127.0.0.1',port))!=0;s.close()
cmd=json.loads((R/'installed-audit/launch-command.json').read_text());cmd[1]=str(D/'original-run-relocated.js')
cmd=[x for x in cmd if not x.startswith(('--wasm=','--max-seconds=','--reg-export=','--save-vfs=','--png='))]
cmd += ['--wasm='+str(S/'build/wine-assembly.wasm'),'--max-seconds=240','--reg-export='+str(D/'final-registry.json'),'--png='+str(D/'final.png'),'--trace-api=GetProcAddress,LoadLibraryA,LoadLibraryW,LoadLibraryExA,LoadLibraryExW,CoCreateInstance,SetWindowTextW,SetDlgItemTextW']
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'))
for k in ['NODE_OPTIONS','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:env.pop(k,None)
start=time.monotonic()
with (D/'output.log').open('wb') as out:
    p=subprocess.Popen(cmd,cwd=S,env=env,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
    (D/'launch.json').write_text(json.dumps(dict(command=cmd,cwd=str(S),pid=p.pid,pgid=p.pid,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),canonicalModuleSHA256=hashlib.sha256((S/'build/wine-assembly.wasm').read_bytes()).hexdigest(),guardSeconds=260,guestAttempts=1,ordinaryAcceptAttempts=0,observer='none; ordinary runner API tracing only'),indent=2)+'\n')
    sent=[]
    while p.poll() is None:
        elapsed=time.monotonic()-start
        if elapsed>=255 and 'TERM' not in sent:
            os.killpg(p.pid,signal.SIGTERM);sent.append('TERM')
        if elapsed>=260:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            sent.append('KILL');break
        time.sleep(.25)
    code=p.wait()
(D/'exit.json').write_text(json.dumps(dict(exitCode=code,elapsedSeconds=time.monotonic()-start,signals=sent,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2)+'\n')
for base,rows in [(R/'runtime',json.loads((R/'runtime-pins.json').read_text())),(R/'installed',json.loads((R/'installed-audit/installed-manifest.json').read_text())['files'])]:
    for row in rows:
        f=base/row['path'];assert f.stat().st_size==row['size'] and hashlib.sha256(f.read_bytes()).hexdigest()==row['sha256'],str(f)
(D/'original-pins-after-guest.log').write_text('PASS 373 immutable original runtime/installed pins\n')
print((D/'exit.json').read_text())

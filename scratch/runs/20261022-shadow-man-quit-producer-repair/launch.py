"""ONE launch, <=45s, byte/event quotas; coordinator retains runtime lifecycle."""
import datetime,hashlib,json,os,pathlib,resource,selectors,signal,subprocess,time,urllib.request
from preflight import R,O,seals,conflicts,previous_capture_seals
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,16,45,tzinfo=datetime.timezone.utc)
assert not (O/'attempt.json').exists()
before=json.loads((O/'preflight.json').read_text());assert before['passAll'];assert seals()==before['seals'];conflicts()
previous=previous_capture_seals();assert previous
(O/'previous-capture-seals.json').write_text(json.dumps(previous,indent=2)+'\n')
assert os.statvfs(O).f_bavail*os.statvfs(O).f_frsize>=4*1024**3+16*1024**2
fixture=subprocess.run(['node',str(O/'sealed/observer-fixture.cjs'),str(R/'runtime')],env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules')),capture_output=True,text=True);assert fixture.returncode==0,fixture.stderr
(O/'observer-fixture.json').write_text(json.dumps(dict(exitCode=fixture.returncode,stdout=fixture.stdout,stderr=fixture.stderr),indent=2)+'\n')
qfixture=subprocess.run(['node',str(O/'sealed/quit-fixture.cjs')],capture_output=True,text=True);assert qfixture.returncode==0,qfixture.stderr
(O/'quit-fixture.json').write_text(json.dumps(dict(exitCode=qfixture.returncode,stdout=qfixture.stdout,stderr=qfixture.stderr),indent=2)+'\n')
original=json.loads((R/'setup-run/command.json').read_text())
remove=['--spawn-processes','--pipe-child-args=','--capture-launch=','--reg-export=','--save-vfs=','--max-seconds=','--png=']
cmd=[x for x in original if not any(x==p or (p.endswith('=') and x.startswith(p)) for p in remove)]
cmd[1:1]=['--require',str(O/'sealed/observer.cjs')]
cmd += ['--max-seconds=45','--trace-api=CreateFileA,ReadFile,WriteFile,SetFilePointer,CloseHandle,GetLastError,LoadStringA,MessageBoxA','--trace-api-dedup','--png='+str(O/'final.png')]
assert '--spawn-processes' not in cmd and '--max-seconds=240' not in cmd
(O/'command.json').write_text(json.dumps(cmd,indent=2)+'\n')
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'),SHADOW_CAPTURE_OBSERVER='1')
start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
(O/'attempt.json').write_text(json.dumps(dict(at=at,attempt=1,maxSeconds=45,rawByteCap=8*1024**2,observerByteCap=4*1024**2,observerEventCap=6000,stdoutByteCap=256*1024,childExecution=False,historicalDiagnostic=True)))
def limit():resource.setrlimit(resource.RLIMIT_FSIZE,(4*1024**2,4*1024**2))
p=subprocess.Popen(cmd,cwd=R/'runtime',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limit)
(O/'pid.json').write_text(json.dumps(dict(pid=p.pid,pgid=p.pid)))
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);log=(O/'output.log').open('xb');logged=0;truncated=False;reason=None;controls=[];term=False;kill=False;requested=False
def ctl(commands):
    req=urllib.request.Request('http://127.0.0.1:8123/ctl',data=json.dumps(commands).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=1.5) as r:return json.loads(r.read())
def size():return sum(x.stat().st_size for x in O.rglob('*') if x.is_file())
while p.poll() is None and time.monotonic()-start<45:
    for key,_ in sel.select(.02):
        data=os.read(key.fileobj.fileno(),65536)
        if data:
            remain=256*1024-logged;log.write(data[:remain]);logged+=min(remain,len(data))
            if len(data)>remain:truncated=True;reason='stdout-quota'
        else:sel.unregister(key.fileobj)
    if size()>8*1024**2-65536:reason='aggregate-quota'
    if (O/'stop-request.json').exists() and not reason:reason=json.loads((O/'stop-request.json').read_text())['reason']
    if time.monotonic()-start>=39 and not reason:reason='time-bound'
    if reason and not requested:
        requested=True
        (O/'control-input.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),reason=reason)))
        commands=[{'action':'snapshot'},{'action':'png','path':str(O/'stop.png')},{'action':'eval','code':'globalThis.__shadowCaptureSnapshot()'},{'action':'quit'}]
        try:controls.append(dict(commands=commands,result=ctl(commands)))
        except Exception as e:controls.append(dict(error=type(e).__name__+': '+str(e)))
    if reason and requested and time.monotonic()-start>=43:break
if p.poll() is None:
    term=True;os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=max(.05,44.5-(time.monotonic()-start)))
    except subprocess.TimeoutExpired:kill=True;os.killpg(p.pid,signal.SIGKILL);p.wait()
for key,_ in sel.select(0):
    data=os.read(key.fileobj.fileno(),65536);remain=256*1024-logged;log.write(data[:remain]);logged+=min(remain,len(data));truncated=truncated or len(data)>remain
log.close()
try:os.killpg(p.pid,signal.SIGTERM)
except ProcessLookupError:pass
after=seals();assert after==before['seals'],'preserved original seal mismatch'
assert previous_capture_seals()==previous,'previous capture changed'
c=conflicts();free=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize
result=dict(startedAt=at,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsedSeconds=time.monotonic()-start,exitCode=p.returncode,reason=reason,externalTERM=term,externalKILL=kill,stdoutTruncated=truncated,controls=controls,prePostSealsMatch=True,sealedFiles=len(after),previousCaptureUnchanged=True,previousCaptureFiles=len(previous),freeBytes=free,newBytes=size(),**c)
(O/'exit.json').write_text(json.dumps(result,indent=2)+'\n')
manifest=[dict(path=x.relative_to(O).as_posix(),size=x.stat().st_size,sha256=hashlib.sha256(x.read_bytes()).hexdigest()) for x in sorted(O.rglob('*')) if x.is_file()]
(O/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert size()<=8*1024**2,'capture incomplete: aggregate quota exceeded'
print(json.dumps(result))

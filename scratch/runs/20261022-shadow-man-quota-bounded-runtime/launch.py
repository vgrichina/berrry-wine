"""ONE attempt. All guest descendants share one external <=60s process-group bound."""
import pathlib,json,os,subprocess,time,signal,datetime,hashlib
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22');Q=pathlib.Path('/home/user/shadow-man-bounded-runtime');O=Q/'attempt'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def check_seals(rows):
 for r in rows:
  p=pathlib.Path(r['path']);assert p.stat().st_size==r['size'] and sha(p)==r['sha256'],r
pre=json.loads((O/'preflight.json').read_text());assert pre['passAll'];check_seals(pre['seals'])
assert os.statvfs(Q).f_blocks*os.statvfs(Q).f_frsize==150994944
assert not (O/'attempt.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,19,35,tzinfo=datetime.timezone.utc)
exe=R/'recovery/source/Demos/Shadowman/Setup.exe';runtime=R/'runtime'
cmd=['node','--require',str(O/'observer.cjs'),str(runtime/'test/run.js'),'--exe='+str(exe),'--no-build','--wasm='+str(runtime/'build/wine-assembly.wasm'),'--vfs-include=**/*','--dll-seed='+str(exe.parent/'_Setup.dll')+','+str(runtime/'test/binaries/dlls/msvcrt.dll'),'--spawn-processes','--pipe-child-args=--real-ticks --trace-api=ShowWindow,UpdateWindow,ExitProcess','--max-seconds=55','--max-batches=1000000000','--stuck-after=0','--no-close','--quiet-blocks','--real-ticks','--trace-api=ShowWindow,UpdateWindow,ExitProcess','--png='+str(O/'parent-final.png'),'--save-vfs='+str(O/'parent-vfs'),'--reg-export='+str(O/'parent-registry.json')]
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'),TMPDIR=str(O/'tmp'),TMP=str(O/'tmp'),TEMP=str(O/'tmp'))
assert not any(x.startswith(('--input=','--control=','--guest-page-stats','--capture-launch=')) for x in cmd)
assert len([x for x in cmd if x.startswith('--max-seconds=')])==1
launch=dict(command=cmd,cwd=str(O),environment={k:env[k] for k in ['TMPDIR','TMP','TEMP','NODE_PATH']},guestAttempts=1,aggregateBoundSeconds=60,realTickParentAndDescendants=True)
(O/'command.json').write_text(json.dumps(launch,indent=2));(O/'attempt.json').write_text(json.dumps(dict(startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),attempt=1)))
seen={};peak=0;reason=None;boundary_seen=None
def processes(pgid):
 rows=[]
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   stat=(d/'stat').read_text();fields=stat[stat.rfind(')')+2:].split()
   if int(fields[2])!=pgid:continue
   cmdline=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if not cmdline:continue
   vals={v.split(b'=',1)[0].decode():v.split(b'=',1)[1].decode(errors='replace') for v in (d/'environ').read_bytes().split(b'\0') if b'=' in v and v.split(b'=',1)[0] in [b'TMPDIR',b'TMP',b'TEMP']}
   rows.append(dict(pid=int(d.name),ppid=int(fields[1]),pgid=int(fields[2]),startTime=fields[19],command=cmdline,environment=vals))
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 return rows
start=time.monotonic()
with (O/'output.log').open('xb',buffering=0) as log:
 p=subprocess.Popen(cmd,cwd=O,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  while time.monotonic()-start<58:
   for r in processes(p.pid):seen[str(r['pid'])]=r
   st=os.statvfs(Q);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
   stop=O/'stop-request.json'
   if stop.exists():
    if boundary_seen is None:boundary_seen=time.monotonic()
    try:
     b=json.loads(stop.read_text());summary=O/(b['tag']+'-'+str(b['pid'])+'-summary.json')
     if summary.exists() or time.monotonic()-boundary_seen>.2:reason=b['reason'];break
    except json.JSONDecodeError:pass
   if p.poll() is not None:reason='parent-exit';break
   time.sleep(.02)
  if reason is None:reason='external-monotonic-bound'
 finally:
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:p.wait(timeout=max(.01,59-time.monotonic()+start))
  except subprocess.TimeoutExpired:pass
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait(timeout=.5)
elapsed=time.monotonic()-start;remaining=processes(p.pid)
check_seals(pre['seals'])
st=os.statvfs(Q);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
result=dict(parentPid=p.pid,pgid=p.pid,parentOsExitCode=p.returncode,reason=reason,elapsedSeconds=elapsed,aggregateBoundPassed=elapsed<60,processes=list(seen.values()),remainingLiveProcesses=remaining,quotaBytes=st.f_blocks*st.f_frsize,peakObservedQuotaUsed=peak,finalQuotaUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,pinsPreserved=True,postSealCount=len(pre['seals']),finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
try:(O/'exit.json').write_text(json.dumps(result,indent=2))
except OSError as e:result['exitReceiptWriteError']=str(e)
print(json.dumps(result))

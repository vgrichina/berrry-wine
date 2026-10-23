"""One asynchronous supervised original config invocation, no retry."""
import pathlib,json,os,time,re,hashlib,datetime,socket,sys
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');F=R/'fixed';M=R/'mutable';I=R/'immutable'
sys.path.insert(0,str(F));from watchdog import supervise
g=json.loads((F/'preguest-gate.json').read_text());assert g['passAll']
assert not (F/'attempt.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,1,10,tzinfo=datetime.timezone.utc)
assert hashlib.sha256((I/'runtime/build/wine-assembly.wasm').read_bytes()).hexdigest()==g['moduleSHA256']
assert (M/'registry.json').read_bytes()==(I/'restored/parent-registry.json').read_bytes()
with socket.socket() as s:s.bind(('127.0.0.1',g['controlPort']))
(F/'attempt.json').write_text(json.dumps(dict(attempt=1,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=g['command']),indent=2)+'\n')
offset=0;pending=b'';peak=0;failure=None;start=time.monotonic();endpoint=None;captured=None
log=F/'session.log'
def fail(reason,detail):
 global failure
 failure=dict(reason=reason,detail=detail,elapsed=time.monotonic()-start);(F/'first-failure.json').write_text(json.dumps(failure,indent=2)+'\n');return reason
def observe():
 global offset,pending,peak,endpoint,captured
 elapsed=time.monotonic()-start;st=os.statvfs(M);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
 with log.open('rb') as f:f.seek(offset);b=f.read(262144);offset=f.tell()
 pending+=b;lines=pending.split(b'\n');pending=lines.pop()
 for line in lines:
  if re.search(rb'RuntimeError:|^Error:|ENOSPC|EACCES|EADDRINUSE|MODULE_NOT_FOUND|\[control\] server error:|\[eip-zero\]|\[spawn\].*failed:|unimplemented.*API|compile-guard:|named.event.*(?:denied|failed)',line,re.I):return fail('first-real-error',line.decode(errors='replace'))
 if (M/'output/stop-request.json').exists():return fail('observer-first-boundary',json.loads((M/'output/stop-request.json').read_text()))
 if (F/'operator-stop.json').exists():return 'operator-stop'
 if log.stat().st_size>=8388608:return fail('bounded-log-limit',log.stat().st_size)
 if endpoint is None:
  with socket.socket() as s:
   s.settimeout(.01)
   if s.connect_ex(('127.0.0.1',g['controlPort']))==0:
    endpoint=elapsed;(F/'endpoint-ready.json').write_text(json.dumps(dict(elapsed=elapsed,port=g['controlPort'])))
  if endpoint is None and elapsed>10:return fail('endpoint-timeout',10)
 if endpoint is not None and captured is None:
  if (M/'output/session/launcher-before.png').exists():captured=elapsed
  elif elapsed-endpoint>10:return fail('launcher-live-capture-timeout',dict(endpoint=endpoint,limit=10))
 if (F/'input-dispatched.json').exists():
  dispatch=json.loads((F/'input-dispatched.json').read_text())
  if time.time()-dispatch['time']>15 and not (F/'response-recorded.json').exists():return fail('configuration-response-timeout',15)
res=supervise(g['command'],str(M/'output'),g['environment'],str(log),str(F/'watchdog-receipt.json'),90,observe)
st=os.statvfs(M);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
result=dict(**res,firstFailure=failure,endpointSeconds=endpoint,launcherCaptureSeconds=captured,peakSampledMutable=peak,finalTmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,guestSessionAttempts=1)
(F/'session-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

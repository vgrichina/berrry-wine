"""One configuration process group, bounded across every descendant."""
import pathlib,json,os,time,re,hashlib,datetime,socket,sys
R=pathlib.Path('/home/user/shadow-man-streamed-installed-runtime-oct22');F=R/'fixed';M=R/'mutable';I=R/'immutable'
sys.path.insert(0,str(F));from watchdog import supervise
g=json.loads((F/'stream-preguest-gate.json').read_text());assert g['passAll']
assert not (F/'stream-attempt.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,0,18,tzinfo=datetime.timezone.utc)
assert hashlib.sha256((I/'runtime/build/wine-assembly.wasm').read_bytes()).hexdigest()==g['moduleSHA256']
assert (M/'registry.json').read_bytes()==(I/'restored/parent-registry.json').read_bytes()
for port in g['portsFreeAtGate']:
 with socket.socket() as s:s.bind(('127.0.0.1',port))
assert os.statvfs(M).f_blocks*os.statvfs(M).f_frsize==939524096
(F/'stream-attempt.json').write_text(json.dumps(dict(attempt=1,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=g['command'],watchdogSHA256=hashlib.sha256((F/'watchdog.py').read_bytes()).hexdigest()),indent=2)+'\n')
offset=0;pending=b'';peak=0;failure=None
log=F/'stream-session.log'
def observe():
 global offset,pending,peak,failure
 st=os.statvfs(M);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
 with log.open('rb') as f:f.seek(offset);b=f.read(262144);offset=f.tell()
 pending+=b;lines=pending.split(b'\n');pending=lines.pop()
 for line in lines:
  if re.search(rb'RuntimeError:|^Error:|ENOSPC|EACCES|EADDRINUSE|MODULE_NOT_FOUND|\[control\] server error:|\[eip-zero\]|\[spawn\].*failed:|unimplemented.*API|compile-guard:|named.event.*(?:denied|failed)',line,re.I):
   failure=dict(line=line.decode(errors='replace'),readThrough=offset);(F/'stream-first-failure.json').write_text(json.dumps(failure,indent=2)+'\n');return 'first-real-error'
 if (M/'output/stop-request.json').exists():
  failure=json.loads((M/'output/stop-request.json').read_text());(F/'stream-first-failure.json').write_text(json.dumps(failure,indent=2)+'\n');return 'observer-first-boundary'
 if (F/'stream-operator-stop.json').exists():return 'operator-first-boundary'
 if log.stat().st_size>=8388608:return 'bounded-full-log-limit'
res=supervise(g['command'],str(M/'output'),g['environment'],str(log),str(F/'stream-watchdog.json'),90,observe)
st=os.statvfs(M);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
result=dict(**res,firstFailure=failure,peakSampledMutable=peak,finalTmpfsUsed=(st.f_blocks-st.f_bfree)*st.f_frsize,tmpfsCap=st.f_blocks*st.f_frsize,guestSessionAttempts=1)
(F/'stream-session-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

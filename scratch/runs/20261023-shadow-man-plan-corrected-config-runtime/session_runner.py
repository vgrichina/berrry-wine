"""External OS watchdog; one unique session, only owned process groups."""
import pathlib,json,os,time,re,sys,datetime
R=pathlib.Path('/home/user/shadow-man-launcher-configuration-capture-oct23');F=R/'fixed';M=R/'mutable'
sys.path.insert(0,str(F));from watchdog import supervise
sid=sys.argv[1];assert sid in ('session1','session2','session3')
S=F/'save-gameplay'/sid;O=M/'output/save-gameplay'/sid
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,23,2,42,tzinfo=datetime.timezone.utc)
g=json.loads((S/'gate.json').read_text());assert g['passAll'] and not (S/'attempt.json').exists()
(S/'attempt.json').write_text(json.dumps(dict(session=sid,command=g['command'],time=datetime.datetime.now(datetime.timezone.utc).isoformat())))
start=time.monotonic();offset=0;pending=b'';failure=None;peak=0;log=S/'session.log'
def observe():
 global offset,pending,failure,peak
 st=os.statvfs(M);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
 with log.open('rb') as f:f.seek(offset);chunk=f.read(262144);offset=f.tell()
 pending+=chunk;lines=pending.split(b'\n');pending=lines.pop()
 for line in lines:
  if re.search(rb'RuntimeError:|^Error:|ENOSPC|EACCES|EADDRINUSE|MODULE_NOT_FOUND|\[control\] server error:|\[eip-zero\]|\[spawn\].*failed:|unimplemented.*API|compile-guard:',line,re.I):
   failure=dict(reason='first-real-error',line=line.decode(errors='replace'),seconds=time.monotonic()-start);(S/'first-failure.json').write_text(json.dumps(failure));return 'first-real-error'
 if (O/'stop-request.json').exists():
  failure=json.loads((O/'stop-request.json').read_text());return 'observer-first-boundary'
 if (S/'operator-stop.json').exists():return 'operator-stop'
 if log.stat().st_size>=8388608:return 'bounded-log-limit'
 if peak+96*1024**2+32*1024**2>1024**3:return 'mutable-capacity-limit'
result=supervise(g['command'],str(O),g['environment'],str(log),str(S/'watchdog-receipt.json'),90,observe)
result.update(firstFailure=failure,peakTmpfsUsed=peak,guestExitObserved=bool(re.search(r'\[API #\d+\] ExitProcess\(',log.read_text(errors='replace'))))
(S/'session-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

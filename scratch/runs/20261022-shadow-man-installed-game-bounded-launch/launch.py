import pathlib,json,os,subprocess,time,hashlib,re,datetime
from watchdog import *
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22');Q=pathlib.Path('/home/user/shadow-man-install-quota-oct22');F=R/'bounded-diagnostic';O=Q/'bounded-game';V=Q/'session/parent-vfs';I=V/'program files/acclaim entertainment/shadowman'
gate=json.loads((F/'gate.json').read_text());assert gate['passAll'];assert not (O/'attempt.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,20,35,tzinfo=datetime.timezone.utc)
for r in gate['seals']:
 p=pathlib.Path(r['path']);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256']
fixture=subprocess.run(['node',str(F/'forwarding-fixture.cjs')],capture_output=True,text=True);assert fixture.returncode==0,(fixture.stdout,fixture.stderr);(F/'forwarding-fixture.json').write_text(fixture.stdout)
# Observer and every mutable runtime path are inside the hard tmpfs. Fixed watchdog outside.
(O/'observer.cjs').write_bytes((F/'game-observer.cjs').read_bytes())
cmd=['node','--require',str(O/'observer.cjs'),str(R/'runtime/test/run.js'),'--exe='+str(I/'shadowman.exe'),'--exe-guest-path=c:\\program files\\acclaim entertainment\\shadowman\\shadowman.exe','--vfs-tree='+str(V),'--cwd=c:\\program files\\acclaim entertainment\\shadowman','--reg-import='+str(Q/'session/parent-registry.json'),'--no-build','--wasm='+str(R/'runtime/build/wine-assembly.wasm'),'--dll-seed='+str(I/'mss32.dll'),'--spawn-processes','--max-seconds=84','--max-batches=1000000000','--stuck-after=0','--no-close','--quiet-api','--quiet-blocks','--real-ticks','--pipe-child-args=--real-ticks','--trace-api=ShowWindow,UpdateWindow,ExitProcess','--png='+str(O/'game-final.png'),'--save-vfs='+str(O/'game-vfs'),'--reg-export='+str(O/'game-registry.json')]
env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules'),TMPDIR=str(O/'tmp'),TMP=str(O/'tmp'),TEMP=str(O/'tmp'))
(O/'command.json').write_text(json.dumps(dict(command=cmd,cwd=str(O),environment={k:env[k] for k in ['NODE_PATH','TMPDIR','TMP','TEMP']},sourceClosure='a0236c978074ece58495c9eab7db6168e27e71b4',historicalModuleNotCanonicalMain=True),indent=2));(O/'attempt.json').write_text(json.dumps(dict(attempt=1,startedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())))
peak=0;offset=0;tail=b'';failure=None
def observe():
 global peak,offset,tail,failure
 st=os.statvfs(Q);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
 with (O/'output.log').open('rb') as f:f.seek(offset);b=f.read();offset=f.tell()
 tail+=b;lines=tail.split(b'\n');tail=lines.pop()
 for line in lines:
  if re.search(rb'RuntimeError:|^Error:|ENOSPC|\[control\] server error:|\[eip-zero\]|\[spawn\].*failed:|unimplemented.*API',line):
   failure=dict(line=line.decode(errors='replace'),readThrough=offset);return 'first-real-error'
 if (O/'stop-request.json').exists():return 'observer-first-boundary'
 if (O/'operator-stop.json').exists():return 'operator-first-blocker'
 if offset>16777216:return 'bounded-diagnostic-output-limit'
res=supervise(cmd,str(O),env,str(O/'output.log'),str(F/'exit.json'),90,observe)
st=os.statvfs(Q);peak=max(peak,(st.f_blocks-st.f_bfree)*st.f_frsize)
post=[]
for r in gate['seals']:
 p=pathlib.Path(r['path']);assert p.stat().st_size==r['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'];post.append(r['path'])
result=dict(**res,firstFailure=failure,peakSampledMutable=peak,mutableFinal=(st.f_blocks-st.f_bfree)*st.f_frsize,pinsPreserved=len(post),hardQuotaBytes=st.f_blocks*st.f_frsize)
(F/'launch-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

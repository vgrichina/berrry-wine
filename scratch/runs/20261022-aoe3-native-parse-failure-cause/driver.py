"""One original guest run. Fresh absolute deadlines; finite process-group guard."""
import datetime,hashlib,json,os,pathlib,signal,subprocess,time
D=pathlib.Path(__file__).resolve().parent;R=D.parent
assert not (D/'launch.json').exists()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-22T11:45:00+00:00')
assert json.loads((D/'dependency-selected-route.json').read_text())['pass']
cmd=json.loads((R/'installed-audit/launch-command.json').read_text());cmd[1]=str(D/'diagnostic-run.js')
cmd=[x for x in cmd if not x.startswith(('--max-seconds=','--reg-export=','--save-vfs=','--png='))]
cmd += ['--max-seconds=240','--reg-export='+str(D/'final-registry.json'),'--png='+str(D/'final.png'),
 '--trace-api=GetProcAddress,GetModuleHandleA,GetModuleHandleW,LoadLibraryA,LoadLibraryW,LoadLibraryExA,LoadLibraryExW,RaiseException,RtlUnwind,GetLastError,CoCreateInstance,ReadFile',

 '--trace-eip-range=0x400000-0x01894000']
assert '--threads' not in cmd
start=time.monotonic();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (D/'output.log').open('w') as out:
 p=subprocess.Popen(cmd,cwd=R/'runtime',env=dict(os.environ,NODE_PATH=str(R/'runner/node_modules')),stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
 (D/'launch.json').write_text(json.dumps(dict(command=cmd,pid=p.pid,pgid=p.pid,at=at,guard=dict(guest=240,TERM=255,KILL=260),node=subprocess.check_output(['node','--version'],text=True).strip()),indent=2))
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
(D/'exit.json').write_text(json.dumps(dict(exitCode=code,elapsedSeconds=time.monotonic()-start,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),signals=sent),indent=2))
pins=json.loads((R/'runtime-pins.json').read_text())
pins += [dict(x,path='../installed/'+x['path']) for x in json.loads((R/'installed-audit/installed-manifest.json').read_text())['files']]
for x in pins:
 q=R/'runtime'/x['path'];assert q.stat().st_size==x['size'] and hashlib.file_digest(q.open('rb'),'sha256').hexdigest()==x['sha256'],str(q)
(D/'postflight.json').write_text(json.dumps(dict(pins=len(pins),passAll=True,at=datetime.datetime.now(datetime.timezone.utc).isoformat()),indent=2))
print((D/'exit.json').read_text())

#!/usr/bin/env python3
"""Real process route tests, including transient parent return and parent death."""
import ctypes,importlib.util,json,os,pathlib,signal,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
OWNER=ROOT/'tools/halflife2-persistent-owner.py'
def read(p):return json.loads(p.read_text())
def until(fn,seconds=15):
 end=time.monotonic()+seconds
 while not fn():
  assert time.monotonic()<end,'condition deadline'
  time.sleep(.01)
def token(pid):return pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()[19]
def outer(out,seconds):
 spec=importlib.util.spec_from_file_location('outer',ROOT/'tools/gltron-current-supervise.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 code="import pathlib,time,sys; p=pathlib.Path(sys.argv[1]);(p/'prepared.json').write_text('{}');time.sleep(float(sys.argv[2]));print('fixture native completion')"
 return m.ParentProcessSupervisor(out,[sys.executable,'-c',code,str(out),seconds],preparation=10,runtime=15,preparation_watchdog=12,runtime_watchdog=17).run()
def run(out,native_mode=False):
 out=pathlib.Path(out);out.mkdir(parents=True)
 if native_mode:
  spec=importlib.util.spec_from_file_location('route',OWNER);route=importlib.util.module_from_spec(spec);spec.loader.exec_module(route)
  worker=int(os.environ['HL2_WORKER_PID']);anchorfd,anchorpoll,anchoridentity=route.anchor(worker,token(worker))
  (out/'witness-worker-pin.json').write_text(json.dumps(anchoridentity))
 assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0 # adopt owner-death orphans for real waitpid
 results=[]
 cases=[('healthy','8' if native_mode else '2'),('owner-death','100' if native_mode else '10')]
 if not native_mode:cases.append(('deadline','20'))
 for mode,seconds in cases:
  r=out/mode;r.mkdir();o=r/'owner';native=r/'outer-fixture/outer' if native_mode else r/'outer';log=(r/'launcher.log').open('wb')
  worker=int(os.environ['HL2_WORKER_PID']) if native_mode else os.getpid()
  command=[sys.executable,'-B','tools/halflife2-current-native.py','--supervised'] if native_mode else [sys.executable,'-B',__file__,'outer',str(native),seconds]
  if native_mode and os.environ.get('HL2_WORKING')=='1':command.append('--working-qualification')
  args=[sys.executable,'-B',str(OWNER),'owner',str(o),str(worker),token(worker),'1000' if native_mode else '10' if mode=='deadline' else '25',*command]
  env=dict(os.environ,HL2_RUN=str(r/'outer-fixture'),HL2_FIXTURE_SECONDS=seconds)
  # A separate transient launcher returns only after the safe handover.
  code="import subprocess,time,pathlib,sys; p=subprocess.Popen(sys.argv[2:],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True); end=time.monotonic()+5\nwhile not pathlib.Path(sys.argv[1]).exists():\n assert p.poll() is None and time.monotonic()<end\n time.sleep(.005)\nprint(p.pid)"
  launcher=subprocess.run([sys.executable,'-c',code,str(o/'worker-owner-armed.json'),*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,env=env)
  assert launcher.returncode==0,launcher.stderr
  pid=int(launcher.stdout);fd=os.pidfd_open(pid)
  until(lambda:(native/'runtime-start.json').exists(),120)
  if native_mode:until(lambda:(r/'outer-fixture/native.stdout.log').exists() and '[CreateDialog]' in (r/'outer-fixture/native.stdout.log').read_text(),20)
  armed=read(native.with_name('outer-parent-process-armed.json'));identity=read(o/'worker-owner-armed.json')
  assert armed['pid']==pid and armed['startToken']==token(pid)
  # launcher is actually waited/reaped; healthy dedicated parent still alive.
  signal.pidfd_send_signal(fd,0)
  outerpid=read(o/'outer-child.json')['pid'];pidfds=[]
  for f in pathlib.Path(f'/proc/{outerpid}/fdinfo').iterdir():
   body=f.read_text()
   if any(line.split()==['Pid:',str(pid)] for line in body.splitlines()):pidfds.append(dict(fd=int(f.name),fdinfo=body))
  assert pidfds,'actual supervisor must hold actual dedicated-parent pidfd'
  (r/'tool-return-proof.json').write_text(json.dumps(dict(launcherActualWait=True,launcherExit=launcher.returncode,ownerAlive=True,ownerPid=pid,ownerStartToken=token(pid),actualOuterParent=armed,actualParentPidfds=pidfds,worker=identity)))
  if mode=='owner-death':signal.pidfd_send_signal(fd,signal.SIGKILL)
  _,status=os.waitpid(pid,0)
  adopted=[]
  if mode=='owner-death':
   until(lambda:(native/'wait.json').exists())
   until(lambda:(o/'owner-watchdog-result.json').exists())
   for child in [read(o/'outer-child.json')['pid'],read(o/'owner-watchdog-armed.json')['pid']]:
    waited,st=os.waitpid(child,0);adopted.append(dict(pid=waited,actualWait=True,exit=os.waitstatus_to_exitcode(st)))
  w=read(native/'wait.json')
  assert w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'] and not w['remainingAfterRuntime']
  assert all(x['actualWait'] and x['stdoutEOF'] and x['stderrEOF'] and x['returncode']==0 for x in w['watchdogs'])
  if native_mode:
   nw=read(r/'outer-fixture/native-wait.json');release=read(r/'outer-fixture/runtime-release.json')
   assert nw['actualWait'] and nw['stdoutEOF'] and nw['stderrEOF']
   assert release['ownDescriptorsClosed'] and release['compactorJoined'] and not release['compactionErrors']
   if mode=='owner-death':assert nw['hostCleanup'] and nw['exit']==0
  parent=read(native/'parent-process-owner.json')
  assert parent['parentDeathObserved']==(mode=='owner-death')
  if mode=='healthy':
   ow=read(o/'owner-outer-wait.json');assert ow['actualWait'] and ow['stdoutEOF'] and ow['stderrEOF'] and ow['returncode']==0
   assert read(o/'owner-watchdog-wait.json')['actualWait']
  if mode=='deadline':
   assert read(o/'owner-watchdog-result.json')['fired']
   assert read(o/'owner-outer-wait.json')['actualWait'] and w['supervisorExitCode']==143
  results.append(dict(mode=mode,ownerActualWait=True,ownerExit=os.waitstatus_to_exitcode(status),adoptedActualWaits=adopted,parent=parent,outer=w))
  os.close(fd);log.close()
 (out/'proof.json').write_text(json.dumps(dict(passed=True,realNative=native_mode,componentGit=os.environ.get('HL2_COMPONENT_PIN'),transientLauncherActuallyReturned=True,unchangedActualParentSupervisor=True,results=results),indent=2))
 print('PASS dedicated waiting owner survives transient launcher; actual parent death cancels and joins child and watchdogs with both EOF')
if __name__=='__main__':
 if sys.argv[1]=='outer':sys.exit(outer(pathlib.Path(sys.argv[2]),sys.argv[3]))
 run(sys.argv[2] if sys.argv[1]=='--native' else sys.argv[1],sys.argv[1]=='--native')

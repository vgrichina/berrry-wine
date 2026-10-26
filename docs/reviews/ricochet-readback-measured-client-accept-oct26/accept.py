import pathlib,sys,os,json,time,hashlib,shlex,shutil,tempfile,signal
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';F=R/'test/fixtures/ricochet-serial-controller'
sys.path.insert(0,str(F));import read as adapter;import work
capture=work.capture
SHA='9e6b81e080cfa6476fdd76ef4093217b43567e37f9d9f7fcd69cc021d1541d88'
candidate='3a332fcc5f50232fa276a350eba3ca63af9c50e9'
pins=json.loads((O/'input-pins.json').read_text())
for p,j in pins.items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==j['sha256']
results=[]
def checkpoint(remaining):
 j=dict(candidate=candidate,pins=pins,completed=results,remaining=remaining,unchangedDonorGroupsReused=8,sourcePublicationAllowed=not any(x.get('rejectedCandidate') for x in results))
 t=O/'checkpoint.new';t.write_text(json.dumps(j,indent=2)+'\n');t.replace(O/'checkpoint.json')
def run(mode,budget=8,symlink=False):
 with tempfile.TemporaryDirectory(dir=O) as td:
  t=pathlib.Path(td);source=t/'source';source.mkdir();shutil.copyfile(F/'later.png',source/'later.png');adapter.R=str(source)
  dest=t/'destination';victim=t/'victim';victim.write_bytes(b'original victim')
  if symlink:dest.symlink_to(victim)
  else:dest.write_bytes(b'original destination')
  log=O/(mode+'.requests.jsonl');calls=[];live=set();peaks=[];completed=[];factory=work.python_argv;original_start=capture.SubprocessExecutor.start
  def argv(code,remaining):
   intended=factory(code,remaining)
   assert intended[:5]==['boat','--no-update','--json','exec','--timeout']
   shell=shlex.split(intended[-1]);assert shell[:7]==['timeout','120','prlimit','--cpu=90','--fsize=25165824','--','sh']
   inner=shlex.split(shell[-1]);assert inner[:2]==['python3','-c'] and inner[2]==code
   assert 'f=open(p,"rb")' in code and 'ctl(' not in code and 'socket' not in code
   calls.append(dict(remaining=remaining,at=time.monotonic(),argv=intended))
   return [sys.executable,str(O/'local_transport.py'),code,mode,str(log)]
  def start(ex,code,remaining):
   job=original_start(ex,code,remaining);live.add(job);peaks.append(len(live));cancel=job.cancel;poll=job.poll
   def wrapped_poll():
    raw=poll()
    if raw is not None and 'f.seek(' in code:completed.append(int(code.split('f.seek(')[1].split(')')[0]))
    return raw
   job.poll=wrapped_poll
   def wrapped():
    try:return cancel()
    finally:live.discard(job)
   job.cancel=wrapped;return job
  work.python_argv=argv;capture.SubprocessExecutor.start=start
  started=time.monotonic();deadline=started+budget;error=None;receipt=None
  try:receipt=adapter.readfile('later.png',dest,deadline=deadline)
  except Exception as e:error=type(e).__name__+': '+str(e)
  finally:work.python_argv=factory;capture.SubprocessExecutor.start=original_start
  elapsed=time.monotonic()-started
  j=dict(mode=mode,error=error,elapsed=elapsed,budget=budget,requests=len(calls),maxActive=max(peaks,default=0),remainingDeadlinePassedUnchanged=all(abs(c['remaining']-(deadline-c['at']))<.02 for c in calls),liveJobsAfter=len(live),destinationSymlink=dest.is_symlink(),victimUnchanged=victim.read_bytes()==b'original victim',outOfOrder=completed!=sorted(completed))
  if mode in ('baseline','reorder'):
   assert error is None and hashlib.sha256(dest.read_bytes()).hexdigest()==SHA
   assert receipt['chunks']==90 and len(calls)==92 and max(peaks)<=4
   assert j['remainingDeadlinePassedUnchanged'] and not live and j['victimUnchanged']
   if symlink:assert not dest.is_symlink()
   if mode=='reorder':assert j['outOfOrder']
  elif mode in ('held-pipe','detached-child'):
   assert error and elapsed<budget+.5
   child=int(pathlib.Path(str(log)+'.child').read_text());state=pathlib.Path('/proc')/str(child)/'stat'
   # SIGKILL delivery is asynchronous. Distinguish a true escaped child from
   # a same-group child merely sampled before the kernel schedules its exit.
   time.sleep(.05)
   alive=state.exists() and state.read_text().split(') ')[1][0]!='Z'
   stat=state.read_text().split(') ')[1].split() if state.exists() else None
   j.update(childPID=child,childLiveAfterReturnPlus50ms=alive,childProcessGroup=int(stat[2]) if stat else None,childSession=int(stat[3]) if stat else None,rejectedCandidate=alive)
   if alive:
    # Preserve failure, then explicitly clean up only this fixture-owned identity.
    os.kill(child,signal.SIGKILL);j['fixtureEmergencyCleanup']='SIGKILL owned detached child'
   assert dest.read_bytes()==b'original destination'
  else:
   assert error and dest.read_bytes()==b'original destination' and not live
   if mode=='denial':assert len(calls)==1
   assert not list(t.glob('.*.readback-*'))
  results.append(j);checkpoint(['additional independent groups','conditional integration/publication']);print(json.dumps(j))
  return j
group=sys.argv[1]
if group!='boundary':results[:]=json.loads((O/'checkpoint.json').read_text())['completed']
if group=='boundary':run('baseline',symlink=True);checkpoint(['adversarial integrity','descendant/deadline','conditional integration'])
if group=='integrity':
 for mode in ('envelope','hash','stat','denial','mutate','replace','reorder'):run(mode)
 checkpoint(['descendant/deadline','conditional integration'])
if group=='process':
 results[:]=[j for j in results if j['mode'] not in ('held-pipe','detached-child')]
 run('held-pipe',budget=.25)
 run('detached-child',budget=.25)
 checkpoint(['conditional integration only if no rejection'])

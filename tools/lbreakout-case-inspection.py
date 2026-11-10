"""Generate read-only inspection for one LBreakout browser case.

Launcher completion and each stream EOF are separate records. Live log
availability must never mask passive terminal records.
"""
import json


def pause_workflow_source(source):
    """Extend the actual bound browser caller with ordinary local-game P input.

    Original EXE cc1fd5c3: handle_default_key 0x41e474 tests SDLK_p;
    0x41e75c..0x41e7ef toggles local states 8 and 20. No guest calls/writes.
    A play command attests that its reviewed image visibly showed pause.
    """
    replacements = [
        ("['capture','click','key','quit']", "['capture','click','key','play','quit']"),
        ("'Enter','Space'].includes(c.key)", "'Enter','Space','p'].includes(c.key)"),
        ("   await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});", """   if(c.action==='play'){
    assert.equal(c.pauseConfirmed,latest.label,'reviewed visible pause required');
    assert(['ArrowLeft','ArrowRight','Space'].includes(c.key),'supported play key');
    assert(Number.isInteger(c.holdMs)&&c.holdMs>=0&&c.holdMs<=300,'short play hold');
    assert(Number.isInteger(c.playMs)&&c.playMs>=c.holdMs&&c.playMs<=500,'short play interval');
    const toggle=async phase=>{
     assert(!terminal,'terminal: no later pause input');
     const k=require('./input.cjs').key('p'),{text,...release}=k;
     await pulse({down:()=>send('Input.dispatchKeyEvent',{type:'keyDown',...k},pageSession),up:()=>send('Input.dispatchKeyEvent',{type:'keyUp',...release},pageSession),deadline,onFailure:fail,holdMs:80,save:r=>save('input-'+c.id+'-'+phase+'.json',r)});
    };
    await toggle('resume');
    assert(!terminal,'terminal: no later play input');
    await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs,save:r=>save('input-'+c.id+'-pulse.json',r)});
    await wait(c.playMs-c.holdMs);
    await toggle('pause');
   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});"""),
    ]
    # Check the complete template before changing any of it. Drift is offline.
    for before, _ in replacements:
        if source.count(before) != 1:
            raise ValueError('unsupported bound browser template: ' + before)
    for before, after in replacements:
        source = source.replace(before, after)
    return source


def owning_worker_source():
    """Select the module-bound process owner, allowing real secondary threads."""
    return """async function owningWorker(){
 const live=await chain.readLive();
 const owner=workers.get(live.worker.sessionId);
 assert(owner&&!owner.closed&&owner.url.includes('guest-worker'),'live bound owning guest Worker');
 assert.equal(owner.targetId,live.identity.workerTarget,'bound owning Worker target');
 return live.worker.sessionId;
}"""


def inspection_source(root, run, case):
    if case not in ('fixture', 'original'):
        raise ValueError('unsupported LBreakout case')
    return '''import json,pathlib
p=pathlib.Path(%s)/%s
out=p/%s
log=p/(%s+'.log')
markers=['first-browser-failure.json','first-failure.json','cleanup.json','chrome-exit.json']
terminal={n:json.loads((out/n).read_text()) for n in markers if (out/n).exists()}
wait=p/(('fixture-launcher' if %s=='fixture' else 'launcher')+'-wait.json')
if wait.exists():terminal['launcherWait']=json.loads(wait.read_text())
for stream in ['stdout','stderr']:
 eof=wait.with_name(wait.name.replace('-wait.json','-'+stream+'-eof.json'))
 if eof.exists():terminal[stream+'EOF']=json.loads(eof.read_text())
print(json.dumps(dict(case=%s,files=sorted(f.name for f in out.iterdir()) if out.exists() else [],latest=json.loads((out/'latest.json').read_text()) if (out/'latest.json').exists() else None,terminal=terminal,logPath=str(log),logAvailable=log.exists(),output=log.read_text()[-4000:] if log.exists() else None)))
''' % tuple(json.dumps(v) for v in (root, run, case, case, case, case))


def launcher_source(root, run, case, command, env=None, deadline_from_lifecycle=False):
    """One parent owns wait and two independent pipe drains; publish atomically."""
    if case not in ('fixture', 'original'):
        raise ValueError('unsupported LBreakout case')
    prefix = 'fixture-launcher' if case == 'fixture' else 'launcher'
    return '''import json,os,pathlib,subprocess,threading,time
root=pathlib.Path(%r);run=root/%r
case=%r;prefix=%r

def put(name,value):
 p=run/name;tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(p)
env=dict(os.environ,**%r)
if %r:env['BROWSER_DEADLINE']=str(json.loads((run/'lifecycle.json').read_text())['browserDeadline'])
p=subprocess.Popen(%r,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
put(prefix+'.json',dict(pid=p.pid,parentPid=os.getpid()))
def drain(stream,suffix):
 with (run/(case+('-stderr' if suffix=='stderr' else '')+'.log')).open('wb') as out:
  while True:
   b=stream.read(65536)
   if not b:break
   out.write(b)
 put(prefix+'-'+suffix+'-eof.json',dict(pid=p.pid,eof=True,stream=suffix,at=time.time()))
threads=[threading.Thread(target=drain,args=(stream,name)) for stream,name in [(p.stdout,'stdout'),(p.stderr,'stderr')]]
for t in threads:t.start()
code=p.wait()
put(prefix+'-wait.json',dict(pid=p.pid,code=code,actualWait=True,at=time.time()))
for t in threads:t.join()
''' % (root, run, case, prefix, env or {}, deadline_from_lifecycle, command)


def handoff_source(root, run, original_source, close_command=None, timeout=15):
    """Actual close -> bounded parent completion/EOF -> one original creation.

    A close ACK or cleanup marker alone cannot release the launch. Missing
    publication is pending until the deadline; a negative record is terminal.
    """
    if not 0 < timeout <= 60:
        raise ValueError('bounded parent completion timeout required')
    return '''import json,pathlib,subprocess,time,sys
root=pathlib.Path(%r);run=root/%r
close_command=%r
if close_command is not None:
 subprocess.run(close_command,cwd=root,check=True,timeout=%r)
due=time.monotonic()+%r
while True:
 for name in ['first-browser-failure.json','first-failure.json']:
  if (run/'fixture'/name).exists():raise RuntimeError('terminal fixture '+name)
 cleanup=run/'fixture/cleanup.json'
 if cleanup.exists():
  value=json.loads(cleanup.read_text())
  if value.get('closed') is False or value.get('code',0) not in (0,None):raise RuntimeError('failed fixture cleanup')
 wait=run/'fixture-launcher-wait.json'
 if wait.exists():
  value=json.loads(wait.read_text())
  if value.get('actualWait') is not True or value.get('code')!=0:raise RuntimeError('failed fixture actual parent wait')
  ready=cleanup.exists()
  for stream in ['stdout','stderr']:
   eof=run/('fixture-launcher-'+stream+'-eof.json')
   if not eof.exists():ready=False;continue
   record=json.loads(eof.read_text())
   if record.get('eof') is not True or record.get('stream')!=stream or record.get('pid')!=value.get('pid'):raise RuntimeError('invalid fixture separate EOF '+stream)
  if ready:break
 if time.monotonic()>=due:raise TimeoutError('fixture parent completion/separate EOF unpublished')
 time.sleep(.02)
# This is the sole creation point, reached only after actual wait and both EOFs.
p=subprocess.Popen([sys.executable,'-c',%r],cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
(run/'original-parent.json').write_text(json.dumps(dict(pid=p.pid,fixtureWait=value,stdoutEOF=True,stderrEOF=True)))
print(json.dumps(dict(parentPid=p.pid,fixtureParentCompleted=True,separateEOF=True)))
''' % (root, run, close_command, timeout, timeout, original_source)



def original_workflow_source(root, run, command, close_command=None, timeout=15):
    """Compose the real original launcher without text substitution of env keys."""
    parent = launcher_source(root, run, 'original', command,
                             {'CASE_TAG': 'original'}, deadline_from_lifecycle=True)
    return handoff_source(root, run, parent, close_command, timeout)

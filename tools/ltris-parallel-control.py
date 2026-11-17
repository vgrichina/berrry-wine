"""Audited single-operation local control. No game state analysis or moves.

The published controller is loaded from exact Git objects, not mutable source.
Each invocation including the independent UP child logs every HTTP operation.
"""
import os, sys, pathlib, json, time, subprocess, types, urllib.request, uuid, hashlib,select,signal,atexit,mmap,struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=pathlib.Path(os.environ['FORSAKEN_CONTROL_OUT']).resolve()
URL=os.environ['FORSAKEN_CONTROL_URL']
HEAD=os.environ['LTRIS_CONTROL_HEAD']
assert URL.startswith('http://127.0.0.1:') and URL.endswith('/ctl')
SELF_SHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
OBS_END=None
# Optional bounded host observations. Exit-only publication keeps diagnostic
# serialization outside the guarded operation. No phase acknowledges input.
CALL_PHASES=[] if os.environ.get('LTRIS_CONTROL_PHASES')=='1' else None
def phase(name,**fields):
    if CALL_PHASES is not None and len(CALL_PHASES)<1024:
        CALL_PHASES.append(dict(phase=name,ns=time.monotonic_ns(),at=time.time(),**fields))
def publish_phases():
    if CALL_PHASES is not None:
        save('controller-phases-'+str(os.getpid())+'.json',dict(pid=os.getpid(),rows=CALL_PHASES))
atexit.register(publish_phases)
if os.environ.get('LTRIS_CONTROL_SHA256'):
    assert SELF_SHA256==os.environ['LTRIS_CONTROL_SHA256'],'current control helper changed'
def save(name,value):
    with (OUT/name).open('x') as f: json.dump(value,f,indent=2);f.write('\n')
def call(command,timeout=3):
    started=time.time();reply=None;error=None
    phase('call-enter',action=command.get('action'),nonce=command.get('guard',{}).get('nonce'))
    limit=min(timeout, .5 if command.get('action') in ('guarded-input','guarded-release','guarded-bind','guarded-status') else 3)
    if OBS_END is not None:limit=min(limit,max(0,OBS_END-time.monotonic()))
    # Socket timeouts alone permit a slow trickle to extend an operation.
    # A separately waitable transport child enforces one absolute deadline.
    transport_phases=mmap.mmap(-1,64) if CALL_PHASES is not None else None
    def stamp(index):
        if transport_phases is not None:struct.pack_into('Q',transport_phases,index*8,time.monotonic_ns())
    r,w=os.pipe();er,ew=os.pipe();child=os.fork()
    if child==0:
        os.close(r);os.close(er)
        try:
            stamp(0)
            if transport_phases is not None:
                build_opener=urllib.request.build_opener
                def observed_opener(*args,**kwargs):
                    stamp(2);opener=build_opener(*args,**kwargs);stamp(3);return opener
                urllib.request.build_opener=observed_opener
            request=urllib.request.Request(URL,data=json.dumps(command).encode(),headers={'Content-Type':'application/json'})
            stamp(1)
            with urllib.request.urlopen(request,timeout=limit) as response:
                stamp(4);body=response.read();stamp(5)
            while body:
                n=os.write(w,body);body=body[n:]
        except BaseException as e:os.write(ew,repr(e).encode())
        finally:os.close(w);os.close(ew);stamp(6)
        os._exit(0)
    phase('fork-return',child=child)
    os.close(w);os.close(ew);chunks={r:bytearray(),er:bytearray()};pending=set(chunks);expired=False
    try:
        end=time.monotonic()+max(0,limit-(time.time()-started))
        while pending:
            remaining=end-time.monotonic()
            if remaining<=0:expired=True;os.kill(child,signal.SIGKILL);break
            ready,_,_=select.select(list(pending),[],[],remaining)
            for fd in ready:
                body=os.read(fd,65536)
                if body:chunks[fd].extend(body)
                else:pending.remove(fd)
        phase('transport-read-loop-return',expired=expired)
        _,status=os.waitpid(child,0)
        phase('transport-child-wait',exit=os.waitstatus_to_exitcode(status))
        for fd in pending:
            while True:
                body=os.read(fd,65536)
                if not body:break
                chunks[fd].extend(body)
        if expired:raise TimeoutError('absolute HTTP observation/transport bound')
        if chunks[er]:raise RuntimeError(chunks[er].decode())
        phase('decode-enter',bytes=len(chunks[r]))
        reply=json.loads(chunks[r])
        phase('decode-return')
        if not reply.get('ok'):raise RuntimeError(reply)
        return reply['value']
    except BaseException as e:error=repr(e);raise
    finally:
        os.close(r);os.close(er)
        native_transport_phases=None if transport_phases is None else dict(zip(['child-enter','request-created','opener-enter','opener-return','headers-received','body-read','pipes-closed'],struct.unpack_from('7Q',transport_phases)))
        if transport_phases is not None:transport_phases.close()
        phase('http-observer-publish-enter')
        save('http-'+str(time.time_ns())+'-'+str(os.getpid())+'.json',dict(
            command=command,response=reply,error=error,at=started,completedAt=time.time(),limitSeconds=limit,url=URL,
            transportPhases=native_transport_phases,
            transportWait=dict(pid=child,exit=os.waitstatus_to_exitcode(status),actualWait=True,stdoutEOF=True,stderrEOF=True),expired=expired))
        phase('http-observer-publish-return')
def loaded(relative,name):
    body=subprocess.check_output(['git','show',HEAD+':'+relative],cwd=ROOT)
    module=types.ModuleType(name);module.__file__=str(ROOT/relative)
    # The controller's sibling import must also use the exact Git guard;
    # its usual disk loader is replaced only during this module evaluation.
    import importlib.machinery
    get_code=importlib.machinery.SourceFileLoader.get_code
    guard_body=subprocess.check_output(['git','show',HEAD+':tools/ltris-guard.py'],cwd=ROOT)
    def pinned(loader,fullname):
        if pathlib.Path(loader.path).resolve()==ROOT/'tools/ltris-guard.py':
            return compile(guard_body,loader.path,'exec')
        return get_code(loader,fullname)
    importlib.machinery.SourceFileLoader.get_code=pinned
    try:exec(compile(body,module.__file__,'exec'),module.__dict__)
    finally:importlib.machinery.SourceFileLoader.get_code=get_code
    save('helper-'+name+'-'+str(time.time_ns())+'.json',dict(head=HEAD,path=relative,sha256=hashlib.sha256(body).hexdigest()))
    return module
c=loaded('tools/ltris-guard.py','guard');c.R=OUT;c.URL=URL;c.call=call
# Route the actual independent child through this same auditable adapter.
c.__file__=__file__
a=loaded('tools/ltris-controller.py','controller');a.c=c
capture_unbounded=c.capture
def bounded_capture(name):
    global OBS_END
    assert OBS_END is None,'nested observation'
    OBS_END=time.monotonic()+3
    try:
        result=capture_unbounded(name)
        if time.monotonic()>OBS_END:
            error=TimeoutError('complete observation exceeded fixed three seconds');c.fail(error,name);raise error
        return result
    finally:OBS_END=None
c.capture=bounded_capture
def safe_call(command,timeout=3):
    enforce_reserve()
    c.opened()
    if command.get('action')=='guarded-input':
        # Current public native identity is bound to each personally reviewed
        # capture. No board/piece/score bytes are inspected.
        scene=c.read(os.environ['LTRIS_REVIEW']+'.json')['snapshot']
        command={**command,'guard':{**command['guard'],'intent':scene}}
    return call(command,timeout)
def enforce_reserve():
    launch=c.read('launch.json')
    if launch['seconds']==1200 and time.time()>=launch['deadline']-180 and not (OUT/'quit-phase.json').exists():
        c.save('quit-phase.json',dict(at=time.time(),cutoff=launch['deadline']-180,reserveSeconds=180,irreversible=True,beforeContextRecovery=True))
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='release':
        c.release(sys.argv[2],sys.argv[3],float(sys.argv[4]),'final' in sys.argv[5:],'channel' in sys.argv[5:])
    elif mode=='capture':
        c.call=safe_call;print(c.capture(sys.argv[2]))
    elif mode=='snapshot':
        enforce_reserve();c.opened();print(json.dumps(call({'action':'snapshot'})))
    elif mode=='bind':
        name=sys.argv[2];rr=c.read(name+'.json')
        c.save(name+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=sys.argv[3],submittedScene=True))
        original=c.call
        def reviewed(command,timeout=3):
            if command.get('action')=='guarded-bind':command={**command,'reviewedScene':dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256'])}
            return safe_call(command,timeout)
        c.call=reviewed;a.bind(name)
    elif mode in ('play','menu','quit'):
        name,key,ms,review,observation,*flags=sys.argv[2:]
        assert 80<=int(ms)<=1400
        os.environ['LTRIS_REVIEW']=review
        c.call=safe_call
        rr=c.read(review+'.json')
        c.save(review+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],observation=observation,
            mode=mode,quitRoute=flags[0] if mode=='quit' else None,
            selectedBack='selected-back' in flags,selectedQuit='selected-quit' in flags,endGamePrompt='end-game-prompt' in flags))
        print(a.pulse(name,[key],int(ms),review,observation,mode,flags[0] if mode=='quit' else None))
    elif mode=='fixture-call':
        # Only authored-fixture qualification, never an original recipe.
        assert 'fixture-' in OUT.name
        print(json.dumps(call(json.loads(sys.argv[2]))))
    else:raise ValueError(mode)

#!/usr/bin/env python3
"""Local Caesar III qualification; one original only after exact Git proof.

The game clock begins after compilation, sealed inheritance and authored USER
controls. No old endpoint, save, source checkout or media copy is used.
"""
import ast, fcntl, hashlib, json, os, pathlib, select, signal, socket, subprocess, sys, threading, time, types, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUN = pathlib.Path(os.environ.get('CAESAR3_RUN', ROOT/'scratch/runs/20261117-caesar3-current-native-assignment2-food'))
NATIVE_SECONDS, WATCHDOG_SECONDS, QUIT_RESERVE = 1200, 1220, 180
GAME_FRESHNESS_SECONDS, MENU_FRESHNESS_SECONDS = 15, 30
COMPONENTS = ('tools/caesar3-current-native.py',)
REPAIR_PROOF = ROOT/'scratch/runs/20261117-caesar3-reviewed-hover-city-construction/repair-outer'

def component_revision(base):
    return os.environ.get('CAESAR3_COMPONENT_REVISION', base)

def verify_components(reference, sources, module_sha):
    """Reuse the completed repaired controls by exact bytes, excluding this adapter.

    This adapter's composition and actual native owner lifecycle are tested
    separately. Its controller and native execution bodies must remain exact.
    """
    reference=pathlib.Path(reference)
    old=json.loads((reference/'runtime-inputs.json').read_text())
    assert {n:h for n,h in sources.items() if n not in COMPONENTS} == {n:h for n,h in old['sources'].items() if n not in COMPONENTS}, 'unchanged component graph differs'
    assert old['moduleSHA256']==module_sha==sha((reference/'module.wasm').read_bytes())
    assert old['sourceSeals']==old['moduleSeals']==15 and not old['foreignWIPAdopted']
    for name in ('authored-native-wait.json','outer-native-printable-wait.json','inheritance-wait.json'):
        w=json.loads((reference/name).read_text())
        assert w['exit']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF']
    assert json.loads((reference/'authored/assertions.json').read_text())['pass']
    assert json.loads((reference/'runtime-release.json').read_text())['success']
    outer=json.loads((reference/'outer/wait.json').read_text())
    assert outer['actualWait'] and outer['stdoutEOF'] and outer['stderrEOF'] and outer['supervisorExitCode']==0 and not outer['remainingAfterRuntime']
    assert all(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'] and w['returncode']==0 for w in outer['watchdogs'])
    prior=git('show','aa25b83f8:tools/caesar3-current-native.py').decode()
    current=pathlib.Path(__file__).read_text()
    def bodies(source):
        return {n.name:ast.get_source_segment(source,n) for n in ast.parse(source).body
                if isinstance(n,ast.FunctionDef)}
    before,after=bodies(prior),bodies(current)
    for name in ('original','execute_native','public_input_ready','controller'):
        assert before[name]==after[name], 'native execution/controller changed: '+name
    return dict(passed=True,reference=str(reference),referenceGit=old['gitSHA'],moduleSHA256=module_sha,
        unchangedComponentsExact=True,excludedComponents=list(COMPONENTS),
        originalWaitsReused=False,proofSHA256=sha((reference/'qualification.json').read_bytes()))

def sha(body): return hashlib.sha256(body).hexdigest()
def save(name, value):
    target = RUN/name
    pending = target.with_name(target.name+'.'+str(os.getpid())+'.pending')
    with pending.open('x') as f:
        json.dump(value, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.link(pending, target); pending.unlink()
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def published_module(name, revision):
    m = types.ModuleType(name.replace('/', '_'))
    m.__file__ = str(ROOT/name)
    exec(compile(git('show', revision+':'+name), m.__file__, 'exec'), m.__dict__)
    return m
def free_disk():
    s = os.statvfs('/home'); assert s.f_bavail*s.f_frsize > 1500000000
def outer_ready(media_before_clock=False):
    outer=os.environ.get('CAESAR3_OUTER_RUN')
    if not outer:return
    p=pathlib.Path(outer)
    assert p.parent==RUN and p.name=='outer'
    prepared=p/'prepared.json'
    with prepared.open('x') as f:json.dump(dict(at=time.time(),compiledAndQualified=True,mediaBeforeClock=media_before_clock),f)
    due=time.monotonic()+5
    while not (p/'runtime-start.json').exists():
        assert time.monotonic()<due,'outer runtime watchdog did not prearm'
        time.sleep(.005)
    ready=json.loads((p/'native-armed.json').read_text())
    assert ready['seconds']==NATIVE_SECONDS

def supervised():
    """Reuse the GL worker's published process-parent ownership repair.

    This adds an outer OS lifecycle boundary; guest clocks, input receipts,
    native deadline and independent release are unchanged.
    """
    RUN.mkdir(parents=True,exist_ok=True);free_disk()
    revision=git('rev-parse',os.environ.get('CAESAR3_PINNED_REVISION','HEAD')).decode().strip()
    assert git('merge-base','--is-ancestor',revision,'origin/main')==b'', 'choose a published main graph'
    working='--working-qualification' in sys.argv
    assert not working or '--outer-fixture' in sys.argv
    names=('tools/gltron-current-supervise.py','tools/boids-current-supervise.py',
           'tools/caesar3-current-native.py')
    for name in names:
        if working and name=='tools/caesar3-current-native.py':continue
        pin=component_revision(revision) if name in COMPONENTS else revision
        assert git('show',pin+':'+name)==(ROOT/name).read_bytes(), 'publish exact supervisor before use: '+name
    assert ('--original' in sys.argv) != ('--outer-fixture' in sys.argv)
    (RUN/'outer-owned-helper.patch').write_bytes(git('diff','--binary',revision,'--','tools/caesar3-current-native.py'))
    save('outer-source-pins.json',dict(gitSHA=revision,sources={n:sha((ROOT/n).read_bytes()) for n in names},workingAuthoredOnly=working,
        preparationSeconds=240,runtimeSeconds=NATIVE_SECONDS,independentRuntimeWatchdogSeconds=WATCHDOG_SECONDS))
    m=published_module('tools/gltron-current-supervise.py',revision)
    os.environ['CAESAR3_OUTER_RUN']=str(RUN/'outer')
    os.environ['CAESAR3_PINNED_REVISION']=revision
    command=[sys.executable,'-B',str(ROOT/'tools/caesar3-current-native.py'),
             '--original' if '--original' in sys.argv else '--outer-fixture']
    if working:command.append('--working-qualification')
    return m.ParentProcessSupervisor(RUN/'outer',command,preparation=240,runtime=NATIVE_SECONDS,
        preparation_watchdog=260,runtime_watchdog=WATCHDOG_SECONDS,grace=5).run()
def token(pid):
    s = pathlib.Path(f'/proc/{pid}/stat').read_text()
    return s[s.rindex(')')+2:].split()[19]
def watchdog(deadline):
    save('watchdog-armed.json', dict(pid=os.getpid(), independent=True, deadline=deadline, at=time.time()))
    while time.time() < deadline:
        if (RUN/'native-wait.json').exists():
            save('watchdog-exit.json', dict(reason='actual native wait', at=time.time())); return
        time.sleep(.02)
    p = json.loads((RUN/'native-pid.json').read_text())
    sent = []
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            if token(p['pid']) == p['startToken']:
                os.killpg(p['pid'], sig); sent.append(int(sig))
        except (FileNotFoundError, ProcessLookupError): pass
        if sig == signal.SIGTERM: time.sleep(3)
    save('watchdog-exit.json', dict(reason='immutable deadline', signals=sent, at=time.time()))
def media_inventory():
    media = ROOT/'test/binaries/candidates/caesar-3-demo/installed'
    return [dict(path=str(p.relative_to(ROOT)), size=p.stat().st_size, sha256=sha(p.read_bytes()))
            for p in sorted(media.rglob('*')) if p.is_file()]

def verify_native_proof(reference, sources, module_sha):
    """Reuse completed native evidence only for the identical executed graph.

    An unrelated main publication changes the Git label, not these source bytes.
    Fresh compilation, sealed inheritance and media prehash still run each time.
    """
    reference=pathlib.Path(reference)
    read=lambda n:json.loads((reference/n).read_text())
    pins=read('runtime-inputs.json');compiled=read('compile-inputs.json')
    assert pins['sources']==compiled['sources']==sources, 'native proof source graph differs'
    assert pins['moduleSHA256']==compiled['moduleSHA256']==module_sha, 'native proof module differs'
    assert pins['sourceSeals']==pins['moduleSeals']==15 and not pins['foreignWIPAdopted']
    assert not compiled['workingQualification'], 'native proof must be published'
    q=read('qualification.json')
    assert q['passed'] and not q['originalStarted'] and q['gitSHA']==pins['gitSHA'] and q['moduleSHA256']==module_sha
    assert read('runtime-release.json')['success'] and read('runtime-release.json')['descriptorsClosed']
    for name in ('authored-native-wait.json','outer-native-printable-wait.json','inheritance-wait.json'):
        w=read(name)
        assert w['exit']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'], 'incomplete native proof: '+name
    assert read('authored/assertions.json')['pass']
    outer=read('outer/wait.json')
    assert outer['actualWait'] and outer['nativeWait']['actualWait'] and outer['returncode']==outer['supervisorExitCode']==0
    assert outer['stdoutEOF'] and outer['stderrEOF'] and not outer['timedOut'] and not outer['remainingAfterRuntime']
    assert len(outer['watchdogs'])==2
    for w in outer['watchdogs']:
        assert w['actualWait'] and w['returncode']==0 and w['stdoutEOF'] and w['stderrEOF'] and not w['result']['fired']
    return dict(gitSHA=pins['gitSHA'],moduleSHA256=module_sha,sourceCount=len(sources),
        nativeProofSHA256=sha((reference/'qualification.json').read_bytes()),
        parentProofSHA256=sha((reference/'outer/wait.json').read_bytes()))

def original(env, source, module):
    free_disk()
    pins = media_inventory()
    assert len(pins)==114, 'complete installed recursive media inventory required before clocks'
    assert next(p['sha256'] for p in pins if p['path'].endswith('/c3.exe')) == 'd7c73f21d3837b1fc465a6035f4fea6ab5a7eddf62907c72c4dd076a5193d236'
    save('media.json', dict(files=pins, recursive=True, beforeNativeClock=True, at=time.time()))
    outer_ready(media_before_clock=True)
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    start = time.time(); deadline = start+NATIVE_SECONDS
    invocation = str(uuid.uuid4())
    args = ['node', 'test/run.js', '--app=caesar3_demo', '--no-build', '--threads', '--real-ticks',
            '--native-exit-receipt='+str(RUN/'native-exit.json'), '--native-invocation-token='+invocation,
            '--screen=800x600', '--control='+str(port), '--max-seconds='+str(NATIVE_SECONDS),
            '--max-batches=1000000000', '--stuck-after=0', '--quiet-api', '--quiet-blocks', '--png-canvas',
            '--public-consumer-trace='+str(RUN/'public-consumers.jsonl'),
            '--trace-api=GetMessageA,PeekMessageA,WaitMessage,DispatchMessageA,GetAsyncKeyState,GetKeyState,GetCursorPos,DirectInputCreateA,IDirectInputDevice_GetDeviceState,IDirectInputDevice_GetDeviceData',
            '--trace-input-dispatch']
    save('launch.json', dict(at=start, deadline=deadline, gameplayCutoff=deadline-QUIT_RESERVE,
         inputReadinessRequired=True,
         reserveSeconds=QUIT_RESERVE, rootPort=port, args=args, nativeSeconds=NATIVE_SECONDS,
         watchdogSeconds=WATCHDOG_SECONDS, nativeScene=True, bindingContract='native-reviewed-context-v1',
         inputPolicy=dict(confirmationMs=500, physicalUpMs=1750, observationMs=3000,
                          gameFreshnessSeconds=GAME_FRESHNESS_SECONDS, menuFreshnessSeconds=MENU_FRESHNESS_SECONDS)))
    execute_native(args, env, (source, module), port, invocation, start+WATCHDOG_SECONDS)
    assert media_inventory() == pins, 'recursive media paths, sizes or hashes changed'
    save('media-after.json', dict(unchanged=True, files=len(pins)))

def execute_native(args, env, fds, port, invocation, deadline):
    """Join the native process, both pipes and watchdog even on outer TERM/INT."""
    w = subprocess.Popen([sys.executable, '-B', __file__, 'watchdog', str(deadline)],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    p = None; cleanup = False; info = {}; ends = {}; threads = []
    try:
        while not (RUN/'watchdog-armed.json').exists():
            assert w.poll() is None; time.sleep(.01)
        native_env = dict(env, WINE_PUBLIC_INPUT_TRACE=str(RUN/'public-input.jsonl'))
        p = subprocess.Popen(args, cwd=ROOT, env=native_env, pass_fds=fds,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        info = dict(pid=p.pid, startToken=token(p.pid), port=port, invocationToken=invocation,
                    bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip())
        save('native-pid.json', info)
        def drain(pipe, name):
            with (RUN/('native.'+name+'.log')).open('xb') as f:
                while b := pipe.read1(65536): f.write(b); f.flush()
            ends[name] = True
        for name in ('stdout', 'stderr'):
            t = threading.Thread(target=drain, args=(getattr(p, name), name)); t.start(); threads.append(t)
        while p.poll() is None:
            if (RUN/'PERMANENT-UNKNOWN.json').exists() or (RUN/'stop-native.json').exists():
                cleanup = True
                save('native-cancellation.json', dict(at=time.time(), nativeQuit=False,
                     reason='permanent UNKNOWN' if (RUN/'PERMANENT-UNKNOWN.json').exists() else 'explicit host cleanup'))
                os.killpg(p.pid, signal.SIGTERM); break
            time.sleep(.02)
        try: rc = p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL); rc = p.wait()
        for t in threads: t.join()
        save('native-wait.json', dict(**info, exit=rc, actualWait=True, stdoutEOF=ends.get('stdout', False),
              stderrEOF=ends.get('stderr', False), atWait=time.time(), atWaitMono=time.monotonic(),
              disposition='normal' if rc==0 and not cleanup else 'cleanup', hostCleanup=cleanup))
    finally:
        if p is not None and p.poll() is None:
            cleanup = True
            try: os.killpg(p.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            try: p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL); p.wait()
        if p is not None: p.wait() # poll/absence never substitutes for wait
        for t in threads: t.join()
        if not (RUN/'native-wait.json').exists():
            save('native-wait.json', dict(**info, actualWait=p is not None,
                exit=None if p is None else p.returncode, stdoutEOF=ends.get('stdout',False),
                stderrEOF=ends.get('stderr',False), atWait=time.time(), atWaitMono=time.monotonic(),
                disposition='cleanup', hostCleanup=True, nativeQuit=False, interrupted=True))
        try: a, b = w.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            w.terminate(); a,b=w.communicate(timeout=5)
        save('watchdog-wait.json', dict(pid=w.pid, exit=w.returncode, actualWait=True,
                                      stdoutEOF=True, stderrEOF=True, stdout=a.decode(), stderr=b.decode()))
def public_input_ready(run, snapshot):
    """First unfiltered USER poll of this native focus actor, not a receipt.

    A painted loading screen can precede the application's first message pump.
    Observe public API returns only; never call a guest API or infer pixels.
    """
    run=pathlib.Path(run);launch=json.loads((run/'launch.json').read_text())
    focus=snapshot['focusWindow'];target=int(snapshot['focus'],16)
    main=next((w for w in snapshot.get('windows',[]) if w['hwnd']==snapshot.get('mainHwnd')),None)
    if not (main and focus.get('live') and main.get('live') and focus.get('processId')==main.get('processId')
            and focus.get('threadId')==main.get('threadId') and snapshot.get('modalHwnd')=='0x0'
            and snapshot.get('capture')=='0x0' and snapshot.get('physicalUp')):return None
    p=run/'public-consumers.jsonl'
    if not p.exists():return None
    for line in reversed(p.read_text().splitlines()):
        try:r=json.loads(line)
        except json.JSONDecodeError:continue # an active writer's incomplete last row
        a=r.get('args',[])
        actor=r.get('actor',{})
        if (r.get('phase')=='input-poll-return' and r.get('name') in ('GetMessageA','GetMessageW','PeekMessageA','PeekMessageW')
            and r.get('sameInstanceMemory') is True and actor.get('live') is True and actor.get('memoryBytes',0)>0
            and actor.get('processId')==focus['processId'] and actor.get('threadId')==focus['threadId']
            and actor.get('focusThread')==focus['threadId'] and actor.get('focus')==target
            and actor.get('focusGeneration')==focus['generation']
            and actor.get('main')==int(main['hwnd'],16) and actor.get('mainGeneration')==main['generation']
            and actor.get('modal')==actor.get('capture')==0
            and r.get('threadId')==focus['threadId'] and len(a) in (4,5) and a[0] and a[1] in (0,target)
            and a[2:4]==[0,0] and not r.get('yieldFlag') and not r.get('yieldReason')
            and r.get('doneSp')==r.get('sp',0)+4*(len(a)+1) and (r['name'].startswith('Peek') or r.get('eax'))
            and max(launch['at']*1000,time.time()*1000-3000)<=r.get('at',0)<=time.time()*1000):return r
    return None

def controller():
    """One personally reviewed intent, with an independently forked UP.

    Reuse the published controller's identity, immutable review and release
    implementation from the recorded Git object, without reading foreign WIP.
    A completed frame is an observation for the next personal review, never
    automatic proof of a game objective or permission for another input.
    """
    invoked_at=time.time()
    inputs=json.loads((RUN/'runtime-inputs.json').read_text())
    m=published_module('tools/vb5cce-reviewed-control.py', inputs['gitSHA'])
    m.R=RUN; m.PORT=json.loads((RUN/'launch.json').read_text())['rootPort']
    def sourcecheck():
        assert sha(pathlib.Path(__file__).read_bytes())==inputs['sources']['tools/caesar3-current-native.py']
    m.sourcecheck=sourcecheck
    def reviewed(scene):
        # Caesar's explicit owner policy; preserve every inherited review and
        # invocation check without modifying the shared VB/NV controller.
        rr=m.read(scene+'.json');r=m.read(scene+'-review.json')
        freshness=GAME_FRESHNESS_SECONDS if r['kind']=='game' else MENU_FRESHNESS_SECONDS
        assert 0<=time.time()-rr['at']<freshness and 0<=time.time()-r['at']<freshness
        assert rr['target']==m.identity() and rr['port']==m.PORT and r['rawCompleteScene'] and r['observation'] and r['visibleLabel']
        assert r['pngSHA256']==rr['pngSHA256']==sha((RUN/(scene+'.png')).read_bytes())
        return rr,r
    m.reviewed=reviewed
    mode=sys.argv[2]
    if mode in ('ready','capture') and m.read('launch.json').get('inputReadinessRequired'):
        m.reserve();snap=m.call(dict(action='snapshot'),timeout=.5)
        poll=public_input_ready(RUN,snap)
        if not poll:
            print(json.dumps(dict(ready=False,reason='owner has not returned an unfiltered public USER poll',
                                 captured=False,intents=0,downs=0)))
            raise SystemExit(3)
        if mode=='ready':
            print(json.dumps(dict(ready=True,publicPoll=poll,deliveryReceipt=False)));return
    if mode=='capture': return m.capture(sys.argv[3])
    if mode=='review': return m.review(*sys.argv[3:8])
    if mode=='bind': return m.bind(sys.argv[3])
    assert mode in ('intent','review-intent','hover-intent','review-hover-intent')
    hover=mode in ('hover-intent','review-hover-intent')
    name,scene,x,y,kind=sys.argv[3:8];x=int(x);y=int(y)
    offset=11 if mode.startswith('review-') else 8
    char_code=int(sys.argv[offset]) if x==-2 else None
    if x==-2: assert kind!='quit' and 32<=char_code<=126 and 1<=y<=255
    if hover:assert x>=0 and y>=0 and kind!='quit'
    child=None
    try:
        if mode.startswith('review-'):
            # A single explicitly supplied personal review and finite intent.
            # Retain the original capture clock; never recapture or replay.
            m.reserve(kind=='quit')
            m.review(scene,sys.argv[8],sys.argv[9],kind,sys.argv[10])
        launch=m.reserve(kind=='quit')
        try: rr,r=m.reviewed(scene)
        except AssertionError as e:
            raise AssertionError('personal review preflight refused before intent/DOWN; immutable scene/review clocks and identity retained') from e
        assert kind in ('install','game','quit') and r['kind']==kind
        snap=rr['snapshot']
        target=next(w for w in snap['windows'] if w['hwnd']==snap['mainHwnd'])
        assert target['controlClass']==0 and snap['focus']==snap['mainHwnd']
        assert snap['modalHwnd']=='0x0' and snap['nativeMessageBox'] is None and snap['nativeDialogBox'] is None
        if kind!='quit': assert not (RUN/'quit-phase.json').exists() and time.time()+3<launch['gameplayCutoff']
        owner=m.read('input-owner.json'); start=time.time(); nonce=str(uuid.uuid4())
        invocation=dict(rr['target']); assert invocation==m.identity() and m.same_live_invocation(invocation)
        save(name+'-intent.json',dict(scene=scene,x=x,y=y,charCode=char_code,kind=kind,nonce=nonce,at=start,
             action='mousemove' if hover else 'keydown' if x<0 else 'mousedown',
             confirmationDeadline=start+.5,physicalUpDeadline=start+1.75,observationDeadline=start+3,
             latency=dict(controllerInvokedAt=invoked_at,captureStartedAt=rr['at'],
                          captureCompletedAt=rr['completedAt'],personalReviewAt=r['at'],
                          preflightMs=(start-invoked_at)*1000,captureAgeAtIntentMs=(start-rr['at'])*1000)))
        child=m.ArmedRelease(name,owner['owner'],start+1.4)
        ready,_,_=select.select([child.stdout],[],[],.15); assert ready,'independent release not prearmed'
        arm=json.loads(child.stdout.readline());save(name+'-release-arm.json',arm);assert arm['armed']
        command=f'mousemove:{x}:{y}' if hover else f'keytext:{y}:{char_code}' if x==-2 else f'keydown:{y}' if x==-1 else f'mousedown:{x}:{y}'
        guard={**owner,'nonce':nonce,'reviewed':True,'intent':dict(review=m.native_review(rr,r)),
               'deadline':int(min(start+.5,min(rr['at'],r['at'])+(GAME_FRESHNESS_SECONDS if kind=='game' else MENU_FRESHNESS_SECONDS))*1000)}
        m.reserve(kind=='quit');assert time.time()<start+.5
        receipt=m.call(dict(action='guarded-input',cmd=command,guard=guard),timeout=max(.001,start+.5-time.time()))
        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
        assert receipt.get('receiptBoundary') == 'native-input-return'
        if receipt['receiptBoundary']=='native-input-return':
            proof=receipt['nativeMessage']
            assert proof['consumption']=='owner-user-return' and proof['nonce']==nonce and proof['token']>0
            assert proof['apiKind'] in (1,2,3) and proof['threadId']>0
            # The native token already pins the exact mapped client lParam;
            # reviewed canvas coordinates need not equal client coordinates.
            if hover:assert proof['msg']==0x200 and proof['hwnd']==int(target['hwnd'],16) and proof['wParam']==0
            if x==-2:
                pair=receipt['nativeMessages'];assert len(pair)==2
                assert [p['msg'] for p in pair]==[0x100,0x102]
                assert [p['wParam'] for p in pair]==[y,char_code] and pair[0]['lParam']==pair[1]['lParam']
                assert pair[0]['token']!=pair[1]['token']
                assert all(p['consumption']=='owner-user-return' and p['nonce']==nonce and p['token']>0 and
                    p['apiKind'] in (1,2,3) and p['threadId']==proof['threadId'] and p['hwnd']==proof['hwnd'] for p in pair)
        assert all(receipt.get(k)==guard[k] for k in ('owner','epoch','nonce','deadline'))
        assert start*1000<=receipt['consumedAt']<guard['deadline']
        save(name+'-up-at.json',dict(at=receipt['consumedAt']/1000+.1))
        a,b=child.communicate(timeout=max(.001,start+1.75-time.time()))
        save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,
             stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        up=m.read(name+'-up.json');assert child.returncode==0 and up['physicalUpACK'] and up['at']<start+1.75
        assert up['reply']['owner']==owner['owner'] and receipt['consumedAt']/1000<=up['sentAt']<=up['at']
        if kind=='quit':
            while m.normal_exit(invocation,up['monotonic'],start) is None:
                assert time.time()<start+3;time.sleep(.005)
            save(name+'-native-quit.json',dict(proven=True,nativeWait=m.read('native-wait.json'),nativeExit=m.read('native-exit.json')))
        else:
            at=time.time(); image=RUN/(name+'-observed.png')
            reply=m.call(dict(action='native-reviewed-capture',path=str(image)),timeout=max(.001,start+3-time.time()))
            assert time.time()<start+3 and reply['contract']=='native-reviewed-context-v1'
            save(name+'-observed.json',dict(at=reply['startedAt']/1000,completedAt=reply['completedAt']/1000,
                 target=invocation,port=m.PORT,snapshot=reply['snapshot'],image=reply,captureId=reply['captureId'],
                 pngSHA256=sha(image.read_bytes()),captureRequestedAt=at,semanticOutcome='awaiting personal review'))
        save(name+'-completion.json',dict(at=time.time(),elapsedMs=(time.time()-start)*1000,
             limitsMs=dict(confirmation=500,physicalUp=1750,aggregate=3000),automaticObjectiveClaim=False))
        assert time.time()<start+3
    except BaseException as e:
        try:
            if child:
                try:a,b=child.communicate(timeout=2)
                except subprocess.TimeoutExpired:child.kill();a,b=child.communicate()
                if not (RUN/(name+'-release-wait.json')).exists():
                    save(name+'-release-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,
                         stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        finally:m.fail(name,e)
        raise
def run():
    RUN.mkdir(parents=True, exist_ok=True); free_disk()
    requested = '--original' in sys.argv
    text_diagnostic = '--text-diagnostic' in sys.argv
    modal_fixture = '--modal-fixture' in sys.argv
    personal_fixture = '--personal-fixture' in sys.argv
    controller_fixtures = '--controller-fixtures' in sys.argv
    readiness_fixture = '--input-readiness-fixture' in sys.argv
    hover_fixture = '--hover-fixtures' in sys.argv
    shutdown_fixture = '--adapter-shutdown' in sys.argv
    outer_fixture = '--outer-fixture' in sys.argv
    diagnostic = '--consumer-diagnostic' in sys.argv or text_diagnostic or personal_fixture or controller_fixtures or readiness_fixture or hover_fixture or shutdown_fixture or modal_fixture
    working = '--working-qualification' in sys.argv
    baseline = '--consumer-baseline' in sys.argv
    assert not baseline or (working and diagnostic), 'baseline is authored working diagnosis only'
    assert not (requested and working), 'original requires published Git-only helpers'
    assert not (requested and diagnostic), 'consumer diagnosis never authorizes an original'
    revision = os.environ.get('CAESAR3_PINNED_REVISION') or git('rev-parse', 'HEAD').decode().strip()
    assert git('merge-base','--is-ancestor',revision,'origin/main')==b''
    # The imported supervisor body comes from Git, never the shared worktree.
    helper = published_module('tools/vb5cce-original-runtime.py', revision)
    helper.ROOT, helper.RUN, helper.HEAD = ROOT, RUN, revision
    # Importing the helper bypasses its __main__ signal-handler installation.
    helper.install_shutdown_handlers()
    helper.OWN_SOURCES = ('tools/caesar3-current-native.py', 'test/test-caesar3-current-native.cjs',
        'test/run.js', 'lib/cli-guarded-input.js', 'lib/cli-input-owner.js', 'lib/cli-native-printable.js',
        'tools/native-printable-fixture.cjs', 'test/test-native-printable-input.cjs')
    if working:
        # Only our leased files may overlay the sealed published graph.
        helper.OWN_SOURCES = ('tools/caesar3-current-native.py', 'test/test-caesar3-current-native.cjs',
            'lib/cli-native-scene.js', 'test/test-disciples2-native-paint-binding.cjs','test/public-consumer-observer.js')
    if baseline: helper.OWN_SOURCES = ('test/test-caesar3-current-native.cjs',)
    composed=os.environ.get('CAESAR3_COMPONENT_REVISION')
    if composed:
        assert revision==git('rev-parse','c993e385c').decode().strip(), 'explicit reviewed base required'
        assert git('merge-base','--is-ancestor',composed,'origin/main')==b''
        helper.OWN_SOURCES=()
        base_sources=helper.sources
        def component_sources():
            files=base_sources()
            files['test/test-caesar3-current-native.cjs']=git('show','aa25b83f8:test/test-caesar3-current-native.cjs')
            for name in COMPONENTS:
                body=(ROOT/name).read_bytes() if working else git('show',composed+':'+name)
                assert body==(ROOT/name).read_bytes(), 'published component changed: '+name
                files[name]=body
            patch=git('diff','--binary',revision,'--',*COMPONENTS,'test/test-caesar3-current-native.cjs') if working else git('diff','--binary',revision,composed,'--',*COMPONENTS,'test/test-caesar3-current-native.cjs')
            (RUN/'composed-components.patch').write_bytes(patch)
            save('component-pins.json',dict(baseGit=revision,componentGit=composed,workingAuthoredOnly=working,
                 components={n:sha(files[n]) for n in COMPONENTS},repairTestGit='aa25b83f8'))
            return files
        helper.sources=component_sources
    if not working:
        assert git('show', component_revision(revision)+':tools/caesar3-current-native.py') == pathlib.Path(__file__).read_bytes()
    def qualify(env, files, source, module, **unused):
        if diagnostic:
            if modal_fixture:
                helper.checked('modal-fixture', ['python3', '-B', 'test/test-caesar3-reviewed-modal.py',
                    str(RUN/'modal')], dict(env, CAESAR3_TEST_INPUTS=str(RUN/'runtime-inputs.json')), (source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,
                    gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if shutdown_fixture:
                helper.checked('adapter-shutdown',['node','test/test-caesar3-current-native.cjs',
                    '--adapter-shutdown',str(RUN/'adapter-shutdown')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,
                    gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if hover_fixture:
                helper.checked('hover-fixtures',['node','test/test-caesar3-current-native.cjs',
                    '--hover-fixtures',str(RUN/'hover')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,safeForOriginal=False,
                    gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if readiness_fixture:
                helper.checked('input-readiness-fixture',['node','test/test-caesar3-current-native.cjs',
                    '--input-readiness-fixture',str(RUN/'readiness')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,safeForOriginal=False,
                    gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if controller_fixtures:
                helper.checked('controller-fixtures', ['node','test/test-caesar3-current-native.cjs',
                    '--controller-fixtures',str(RUN/'authored')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,
                    safeForOriginal=False,gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if personal_fixture:
                helper.checked('personal-fixture', ['node','test/test-caesar3-current-native.cjs',
                    '--personal-fixture',str(RUN/'personal')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,
                    safeForOriginal=False,gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if text_diagnostic:
                helper.checked('text-diagnostic', ['node','test/test-caesar3-current-native.cjs',
                    '--text-diagnostic',str(RUN/'text')],env,(source,module))
                save('diagnostic-completion.json',dict(completed=True,originalStarted=False,
                    characterReceiptQualified=False,gitSHA=revision,moduleSHA256=env['DISCIPLES2_MODULE_SHA256']))
                return
            if baseline: env['C3_HOST_BOUNDARY_BASELINE']='1'
            helper.checked('consumer-diagnostic', ['node', 'test/test-caesar3-current-native.cjs',
                           '--consumer-diagnostic', str(RUN/'consumer')], env, (source, module))
            save('diagnostic-completion.json', dict(completed=True, contractPassed=json.loads((RUN/'consumer/diagnostic.json').read_text())['contractPassed'],
                 safeForOriginal=False, originalStarted=False, gitSHA=revision,
                 moduleSHA256=env['DISCIPLES2_MODULE_SHA256'], at=time.time()))
            return
        # Native controls invoke only sealed JS. No mutable external Python
        # controller or original-game startup test is launched as a fixture.
        if composed:
            proof=verify_components(REPAIR_PROOF,{n:sha(b) for n,b in files.items()},env['DISCIPLES2_MODULE_SHA256'])
            save('component-proof-reuse.json',proof)
        reference=os.environ.get('CAESAR3_NATIVE_PROOF') if requested else None
        if composed:
            pass
        elif reference:
            proof=verify_native_proof(reference,{n:sha(b) for n,b in files.items()},env['DISCIPLES2_MODULE_SHA256'])
            assert git('merge-base','--is-ancestor',proof['gitSHA'],'origin/main')==b''
            save('native-proof-reuse.json',dict(**proof,reference=reference,freshInheritance=True,at=time.time()))
        else:
            helper.checked('authored-native', ['node', 'test/test-caesar3-current-native.cjs', str(RUN/'authored')], env, (source, module))
        save('qualification.json', dict(passed=True, gitSHA=revision, originalStarted=False,
             moduleSHA256=env['DISCIPLES2_MODULE_SHA256'], at=time.time()))
        if outer_fixture:
            outer_ready()
            if composed:
                helper.checked('owner-fixture-create',['node','-e',"require('fs').writeFileSync(process.argv[1],require('./test/test-cli-native-button-delivery.cjs').fixture(0))",str(RUN/'owner-fixture.exe')],env,(source,module))
                with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
                invocation=str(uuid.uuid4())
                seconds=os.environ.get('CAESAR3_FIXTURE_SECONDS','8')
                args=['node','test/run.js','--exe='+str(RUN/'owner-fixture.exe'),'--control='+str(port),
                    '--native-invocation-token='+invocation,'--native-exit-receipt='+str(RUN/'native-exit.json'),
                    '--no-build','--threads','--real-ticks','--max-seconds='+seconds,'--max-batches=1000000000',
                    '--stuck-after=0','--quiet-api','--quiet-blocks']
                execute_native(args,env,(source,module),port,invocation,time.time()+WATCHDOG_SECONDS)
            else:
                helper.checked('outer-native-printable',['node','test/test-native-printable-input.cjs',str(RUN/'outer-native')],env,(source,module))
        if requested:
            assert git('merge-base','--is-ancestor',revision,'origin/main')==b'', 'chosen published main graph retired'
            assert git('show',component_revision(revision)+':tools/caesar3-current-native.py')==pathlib.Path(__file__).read_bytes(), 'chosen helper changed; no original'
            if composed:
                route=json.loads(pathlib.Path(os.environ['CAESAR3_OWNER_PROOF']).read_text())
                assert route['passed'] and route['realNative'] and route['transientLauncherActuallyReturned']
                assert route['adapterSHA256']==sha(pathlib.Path(__file__).read_bytes())
                assert route['ownerSHA256']==sha((ROOT/'tools/caesar3-persistent-owner.py').read_bytes())
            original(env, source, module)
    helper.qualify = qualify
    # Its --original option is intentionally not forwarded: this wrapper owns
    # the single Caesar invocation, media identity and fixed native deadline.
    previous = sys.argv[:]; sys.argv = [__file__]
    if working: sys.argv += ['--working-qualification']
    success = False
    try: helper.run(); success = True
    finally:
        for fd in list(helper.OWN_FDS): helper.close_owned(fd)
        save('runtime-release.json', dict(success=success, descriptorsClosed=True, at=time.time(), box=None))
        sys.argv = previous
if __name__ == '__main__':
    if len(sys.argv)>1 and sys.argv[1]=='supervised': sys.exit(supervised())
    elif len(sys.argv)>1 and sys.argv[1]=='watchdog': watchdog(float(sys.argv[2]))
    elif len(sys.argv)>1 and sys.argv[1]=='control': controller()
    else: run()

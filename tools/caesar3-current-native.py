#!/usr/bin/env python3
"""Local Caesar III qualification; one original only after exact Git proof.

The game clock begins after compilation, sealed inheritance and authored USER
controls. No old endpoint, save, source checkout or media copy is used.
"""
import fcntl, hashlib, json, os, pathlib, select, signal, socket, subprocess, sys, threading, time, types, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUN = pathlib.Path(os.environ.get('CAESAR3_RUN', ROOT/'scratch/runs/20261117-caesar3-current-native-assignment2-food'))
NATIVE_SECONDS, WATCHDOG_SECONDS, QUIT_RESERVE = 2400, 2420, 240

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
    revision=git('rev-parse','HEAD').decode().strip()
    assert git('rev-parse','origin/main').decode().strip()==revision
    working='--working-qualification' in sys.argv
    assert not working or '--outer-fixture' in sys.argv
    names=('tools/gltron-current-supervise.py','tools/boids-current-supervise.py',
           'tools/caesar3-current-native.py')
    for name in names:
        if working and name=='tools/caesar3-current-native.py':continue
        assert git('show',revision+':'+name)==(ROOT/name).read_bytes(), 'publish exact supervisor before use: '+name
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
         reserveSeconds=QUIT_RESERVE, rootPort=port, args=args, nativeSeconds=NATIVE_SECONDS,
         watchdogSeconds=WATCHDOG_SECONDS, nativeScene=True, bindingContract='native-reviewed-context-v1',
         inputPolicy=dict(confirmationMs=500, physicalUpMs=1750, observationMs=3000,
                          gameFreshnessSeconds=5, menuFreshnessSeconds=30)))
    w = subprocess.Popen([sys.executable, '-B', __file__, 'watchdog', str(start+WATCHDOG_SECONDS)],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    p = None; cleanup = False
    try:
        while not (RUN/'watchdog-armed.json').exists():
            assert w.poll() is None; time.sleep(.01)
        native_env = dict(env, WINE_PUBLIC_INPUT_TRACE=str(RUN/'public-input.jsonl'))
        p = subprocess.Popen(args, cwd=ROOT, env=native_env, pass_fds=(source, module),
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        info = dict(pid=p.pid, startToken=token(p.pid), port=port, invocationToken=invocation,
                    bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip())
        save('native-pid.json', info)
        ends = {}; threads = []
        def drain(pipe, name):
            with (RUN/('native.'+name+'.log')).open('xb') as f:
                while b := pipe.read(65536): f.write(b); f.flush()
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
            os.killpg(p.pid, signal.SIGTERM); p.wait()
        if not (RUN/'native-wait.json').exists():
            save('native-wait.json', dict(actualWait=p is not None, exit=None if p is None else p.returncode, failedStartup=True))
        a, b = w.communicate(timeout=10)
        save('watchdog-wait.json', dict(pid=w.pid, exit=w.returncode, actualWait=True,
                                      stdoutEOF=True, stderrEOF=True, stdout=a.decode(), stderr=b.decode()))
    assert media_inventory() == pins, 'recursive media paths, sizes or hashes changed'
    save('media-after.json', dict(unchanged=True, files=len(pins)))
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
    mode=sys.argv[2]
    if mode=='capture': return m.capture(sys.argv[3])
    if mode=='review': return m.review(*sys.argv[3:8])
    if mode=='bind': return m.bind(sys.argv[3])
    assert mode in ('intent','review-intent')
    name,scene,x,y,kind=sys.argv[3:8];x=int(x);y=int(y)
    offset=11 if mode=='review-intent' else 8
    char_code=int(sys.argv[offset]) if x==-2 else None
    if x==-2: assert kind!='quit' and 32<=char_code<=126 and 1<=y<=255
    child=None
    try:
        if mode=='review-intent':
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
             confirmationDeadline=start+.5,physicalUpDeadline=start+1.75,observationDeadline=start+3,
             latency=dict(controllerInvokedAt=invoked_at,captureStartedAt=rr['at'],
                          captureCompletedAt=rr['completedAt'],personalReviewAt=r['at'],
                          preflightMs=(start-invoked_at)*1000,captureAgeAtIntentMs=(start-rr['at'])*1000)))
        child=m.ArmedRelease(name,owner['owner'],start+1.4)
        ready,_,_=select.select([child.stdout],[],[],.15); assert ready,'independent release not prearmed'
        arm=json.loads(child.stdout.readline());save(name+'-release-arm.json',arm);assert arm['armed']
        command=f'keytext:{y}:{char_code}' if x==-2 else f'keydown:{y}' if x==-1 else f'mousedown:{x}:{y}'
        guard={**owner,'nonce':nonce,'reviewed':True,'intent':dict(review=m.native_review(rr,r)),
               'deadline':int(min(start+.5,min(rr['at'],r['at'])+(5 if kind=='game' else 30))*1000)}
        m.reserve(kind=='quit');assert time.time()<start+.5
        receipt=m.call(dict(action='guarded-input',cmd=command,guard=guard),timeout=max(.001,start+.5-time.time()))
        save(name+'-down.json',dict(at=time.time(),receipt=receipt))
        assert time.time()<start+.5 and receipt['state']=='CONSUMED' and receipt['consumed'],'confirmation UNKNOWN'
        assert receipt.get('receiptBoundary') == 'native-input-return'
        if receipt['receiptBoundary']=='native-input-return':
            proof=receipt['nativeMessage']
            assert proof['consumption']=='owner-user-return' and proof['nonce']==nonce and proof['token']>0
            assert proof['apiKind'] in (1,2,3) and proof['threadId']>0
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
    personal_fixture = '--personal-fixture' in sys.argv
    controller_fixtures = '--controller-fixtures' in sys.argv
    outer_fixture = '--outer-fixture' in sys.argv
    diagnostic = '--consumer-diagnostic' in sys.argv or text_diagnostic or personal_fixture or controller_fixtures
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
    helper.OWN_SOURCES = ('tools/caesar3-current-native.py', 'test/test-caesar3-current-native.cjs',
        'test/run.js', 'lib/cli-guarded-input.js', 'lib/cli-input-owner.js', 'lib/cli-native-printable.js',
        'tools/native-printable-fixture.cjs', 'test/test-native-printable-input.cjs')
    if working:
        # Only our leased files may overlay the sealed published graph.
        helper.OWN_SOURCES = ('tools/caesar3-current-native.py', 'test/test-caesar3-current-native.cjs',
            'tools/native-printable-fixture.cjs', 'test/test-native-printable-input.cjs')
    if baseline: helper.OWN_SOURCES = ('test/test-caesar3-current-native.cjs',)
    if not working:
        assert git('show', revision+':tools/caesar3-current-native.py') == pathlib.Path(__file__).read_bytes()
    def qualify(env, files, source, module, **unused):
        if diagnostic:
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
        helper.checked('authored-native', ['node', 'test/test-caesar3-current-native.cjs', str(RUN/'authored')], env, (source, module))
        save('qualification.json', dict(passed=True, gitSHA=revision, originalStarted=False,
             moduleSHA256=env['DISCIPLES2_MODULE_SHA256'], at=time.time()))
        if outer_fixture:
            outer_ready()
            helper.checked('outer-native-printable',['node','test/test-native-printable-input.cjs',str(RUN/'outer-native')],env,(source,module))
        if requested:
            assert git('merge-base','--is-ancestor',revision,'origin/main')==b'', 'chosen published main graph retired'
            assert git('show',revision+':tools/caesar3-current-native.py')==pathlib.Path(__file__).read_bytes(), 'chosen helper changed; no original'
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

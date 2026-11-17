"""Sealed local runtime inputs and prearmed independent deadline, no build.

Only Git plus patches persist source. The source/module pools live in sealed
memfds until the actual native wait and both EOFs. No remote service is used.
"""
import os, sys, json, pathlib, subprocess, hashlib, fcntl, time, signal, threading, base64

ROOT = pathlib.Path(__file__).resolve().parents[1]
def digest(b): return hashlib.sha256(b).hexdigest()
def save(out, name, value):
    with (out/name).open('x') as f:
        json.dump(value, f, indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
def token(pid):
    s = pathlib.Path('/proc/'+str(pid)+'/stat').read_text()
    return s[s.rindex(')')+2:].split()[19]
def sealed(label, body):
    fd = os.memfd_create(label, os.MFD_ALLOW_SEALING)
    with os.fdopen(os.dup(fd), 'wb') as f: f.write(body)
    os.lseek(fd, 0, 0)
    seals = fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL
    fcntl.fcntl(fd, fcntl.F_ADD_SEALS, seals)
    assert fcntl.fcntl(fd, fcntl.F_GET_SEALS) == seals
    return fd
def git(*args): return subprocess.check_output(['git', *args], cwd=ROOT)
def source_pool(out):
    head = git('rev-parse', 'HEAD').decode().strip()
    names = git('ls-tree', '-r', '--name-only', head).decode().splitlines()
    # Runtime providers and their dynamic Worker entries, never the source tree
    # or unrelated tests. Bodies come from exact Git, excluding foreign WIP.
    selected = [p for p in names if
                (p.startswith('lib/') and p.endswith(('.js', '.json'))) or
                p in ['host.js', 'test/run.js', 'src/api_table.json', 'src/win16-ordinals.generated.json',
                      'fonts/substitutions.json'] or
                (p.startswith('test/') and '/' not in p[5:] and p.endswith('.js') and
                 p in ['test/main-timing-waits.js','test/input-consumption-trace.js','test/runner-experiments.js',
                       'test/cli-wave-callback-owner.js','test/main-scheduler-observer.js']) or
                p in ['tools/region-layout-hash.js','tools/disasm.js']]
    # pngjs is the actual CLI codec, not a native replacement renderer.
    codec = ROOT/'node_modules/pngjs'
    selected += [str(p.relative_to(ROOT)) for p in codec.rglob('*') if p.is_file() and p.suffix in ['.js','.json']]
    # Resolve literal relative imports recursively, including tools used by
    # the CLI. These are source dependencies, not unrelated repository files.
    import re, posixpath
    selected = list(dict.fromkeys(selected))
    bodies = {}
    owned_control_sha = os.environ.get('LTRIS_OWNED_CONTROL_SHA256')
    for p in selected:
        adopted_control = p == 'lib/control-server.js' and owned_control_sha is not None
        body = (ROOT/p).read_bytes() if p.startswith('node_modules/') or adopted_control else git('show', head+':'+p)
        if adopted_control:
            assert digest(body) == owned_control_sha, 'owned HTTP observation provider changed'
        bodies[p] = body
        for relative in re.findall(rb'require\([\'\"](\.[^\'\"]+)[\'\"]\)', body):
            candidate=posixpath.normpath(posixpath.join(posixpath.dirname(p),relative.decode()))
            for found in [candidate,candidate+'.js',candidate+'.json',candidate+'/index.js']:
                if found in names and found not in selected:
                    selected.append(found);break
    owned=['tools/ltris-parallel-native-runtime.py','tools/ltris-parallel-native-runtime.cjs',
           'tools/ltris-parallel-control.py','test/test-ltris-parallel-native-runtime.cjs',
           'test/test-ltris-parallel-guards.py','lib/control-server.js','test/test-ltris-sdl-latency.cjs','test/test-control-server-phases.cjs']
    patches=[]
    for p in owned:
        if not (ROOT/p).is_file():continue
        tracked=subprocess.run(['git','ls-files','--error-unmatch','--',p],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        result=subprocess.run(['git','diff','--binary',head,'--',p] if tracked else
            ['git','diff','--no-index','--binary','--','/dev/null',p],cwd=ROOT,capture_output=True)
        assert result.returncode in ([0] if tracked else [1]) and not result.stderr
        patches.append(result.stdout)
    owned_patch=b''.join(patches)
    (out/'owned-source.patch').write_bytes(owned_patch)
    files = []
    for p in selected:
        body = bodies[p]
        files.append(dict(path=p, body=base64.b64encode(body).decode(), sha256=digest(body)))
    preload = ROOT/'tools/ltris-parallel-native-runtime.cjs'
    body = preload.read_bytes()
    files.append(dict(path=str(preload.relative_to(ROOT)), body=base64.b64encode(body).decode(), sha256=digest(body)))
    patch = git('diff', '--binary', head, '--', *[p for p in selected if not p.startswith('node_modules/')])
    (out/'relevant-unadopted-wip.patch').write_bytes(patch)
    save(out, 'source-identity.json', dict(head=head, provider='Git HEAD plus explicitly hash-pinned owned control-server.js if requested; foreign WIP excluded',
         ownedControlSHA256=owned_control_sha,
         ownedPatchSHA256=digest(owned_patch),
         necessaryRuntimeInventory=[dict(path=i['path'],sha256=i['sha256']) for i in files],
         patchSHA256=digest(patch), sourceArchive='Git plus patches; no source snapshot'))
    return json.dumps(dict(head=head, files=files), separators=(',', ':')).encode(), body
def run(out, seconds, args):
    assert out.is_dir() and seconds > 0 and args and '--no-build' in args
    assert os.statvfs('/home').f_bavail * os.statvfs('/home').f_frsize > 1500000000
    assert not os.environ.get('NODE_OPTIONS'), 'inherited preload forbidden'
    pool, preload = source_pool(out)
    module_path = pathlib.Path(os.environ.get('LTRIS_MODULE_PATH', ROOT/'build/wine-assembly.wasm')).resolve()
    with module_path.open('rb') as f:
        before = os.fstat(f.fileno()); wasm = f.read(); after = os.fstat(f.fileno())
    assert (before.st_ino,before.st_size,before.st_mtime_ns)==(after.st_ino,after.st_size,after.st_mtime_ns)
    assert len(wasm)==before.st_size and wasm[:4]==b'\0asm'
    viewfd, wasmfd = sealed('ltris-source', pool), sealed('ltris-module', wasm)
    prefix='/proc/'+str(os.getpid())+'/fd/'
    wasm_path = prefix+str(wasmfd)
    env=dict(os.environ, LTRIS_VIEW_ROOT=str(ROOT), LTRIS_VIEW_FD=prefix+str(viewfd),
             LTRIS_VIEW_SHA256=digest(pool), LTRIS_VIEW_OUT=str(out),
             LTRIS_WASM_SHA256=digest(wasm), LTRIS_WASM_SIZE=str(len(wasm)))
    # --import is inherited by real worker_threads. Embed this one owned,
    # exact hashed loader, whose source is also retained as a Git patch.
    bootstrap="import {createRequire} from 'node:module'; const require=createRequire("+json.dumps(str(ROOT/'package.json'))+");\n"+preload.decode()
    env['NODE_OPTIONS']='--import=data:text/javascript;base64,'+base64.b64encode(bootstrap.encode()).decode()
    args=[*args, '--wasm='+wasm_path]
    deadline=time.time()+seconds
    save(out,'sealed-inputs.json',dict(sourcePoolSHA256=digest(pool),wasmSHA256=digest(wasm),
         wasmSize=len(wasm),seals=15,storage='sealed transient memfd; no dump',args=args,
         retainedModulePath=str(module_path),
         loaderSHA256=digest(preload),bootstrapSHA256=digest(bootstrap.encode())))
    r,w=os.pipe()
    wo,wi=os.pipe();we,wei=os.pipe()
    watchdog=os.fork()
    if watchdog==0:
        os.close(wo);os.close(we);os.dup2(wi,1);os.dup2(wei,2);os.close(wi);os.close(wei)
        os.close(r); os.setsid()
        save(out,'watchdog-armed.json',dict(pid=os.getpid(),at=time.time(),deadline=deadline+20,independent=True))
        os.write(w,b'A');os.close(w)
        while time.time()<deadline+20:
            if (out/'native-wait.json').exists(): os._exit(0)
            time.sleep(.05)
        signals=[]
        if (out/'native-pid.json').exists():
            info=json.loads((out/'native-pid.json').read_text())
            for sig in [signal.SIGTERM,signal.SIGKILL]:
                try:
                    if token(info['pid'])==info['startToken']: os.killpg(info['pid'],sig); signals.append(sig)
                except (FileNotFoundError,ProcessLookupError): pass
                if sig==signal.SIGTERM: time.sleep(3)
        save(out,'watchdog-fired.json',dict(at=time.time(),signals=signals));os._exit(1)
    os.close(wi);os.close(wei)
    os.close(w); assert os.read(r,1)==b'A';os.close(r)
    save(out,'launch.json',dict(at=time.time(),deadline=deadline,args=args,seconds=seconds,reserveSeconds=180))
    p=subprocess.Popen(args,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    info=dict(pid=p.pid,startToken=token(p.pid),at=time.time());save(out,'native-pid.json',info)
    eof={};errors=[]
    def drain(pipe,name):
        try:
            with (out/('native.'+name+'.log')).open('xb') as f:
                while True:
                    b=pipe.read1(65536)
                    if not b: break
                    f.write(b);f.flush()
            eof[name]=True
        except BaseException as e: errors.append(repr(e))
    threads=[threading.Thread(target=drain,args=(p.stdout,'stdout')),threading.Thread(target=drain,args=(p.stderr,'stderr'))]
    for t in threads:t.start()
    code=p.wait()
    for t in threads:t.join()
    save(out,'native-wait.json',dict(**info,exit=code,actualWait=True,stdoutEOF=eof.get('stdout',False),stderrEOF=eof.get('stderr',False),drainErrors=errors,completedAt=time.time()))
    wid,status=os.waitpid(watchdog,0)
    for fd,name in [(wo,'stdout'),(we,'stderr')]:
        with (out/('watchdog.'+name+'.log')).open('xb') as f:
            while True:
                body=os.read(fd,65536)
                if not body:break
                f.write(body)
        os.close(fd)
    save(out,'watchdog-wait.json',dict(pid=wid,exit=os.waitstatus_to_exitcode(status),actualWait=True,stdoutEOF=True,stderrEOF=True))
    save(out,'supervisor-complete.json',dict(pid=os.getpid(),nativeExit=code,actualChildWaits=True,bothEOF=all(eof.values()),at=time.time()))
    return code
if __name__=='__main__':
    if sys.argv[1]=='--inner':
        raise SystemExit(run(pathlib.Path(sys.argv[2]).resolve(),float(sys.argv[3]),sys.argv[4:]))
    out=pathlib.Path(sys.argv[1]).resolve()
    source=pathlib.Path(__file__).read_bytes()
    # Tool-parent loss must not discard the actual child wait or pipe EOFs.
    # The native and its independent watchdog remain bounded by the original
    # deadline; this observer never extends or restarts them.
    interruptions=[]
    def interrupted(signum, frame):
        interruptions.append(dict(signal=signum,at=time.time()))
        save(out,'observer-signal-'+str(time.time_ns())+'.json',interruptions[-1])
    for sig in (signal.SIGTERM,signal.SIGHUP):signal.signal(sig,interrupted)
    child=subprocess.Popen([sys.executable,'-B',__file__,'--inner',*sys.argv[1:]],
        cwd=ROOT,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    save(out,'supervisor-start.json',dict(pid=child.pid,startToken=token(child.pid),outerPID=os.getpid(),launcherSHA256=digest(source),at=time.time()))
    while True:
        try:
            a,b=child.communicate(timeout=10)
            break
        except subprocess.TimeoutExpired:
            print('LTris observer waiting for bounded native lifecycle',flush=True)
    (out/'supervisor.stdout.log').write_bytes(a);(out/'supervisor.stderr.log').write_bytes(b)
    save(out,'supervisor-child-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,interruptions=interruptions,at=time.time()))
    raise SystemExit(child.returncode)

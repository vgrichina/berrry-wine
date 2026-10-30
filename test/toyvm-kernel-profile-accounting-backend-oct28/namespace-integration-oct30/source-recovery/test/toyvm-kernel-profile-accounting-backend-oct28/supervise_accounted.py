"""Prototype adapter; publication requires its independent confinement review."""
import hashlib,importlib.util,json,os,pathlib,socket,subprocess,sys,time
HERE=pathlib.Path(__file__).resolve().parent
PIN='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'

def supervise_accounted(argv,work,*,live_limit=32768,write_limit=65536,file_limit=16384,backend='synchronous-fuse',rename_evidence=0,namespace_evidence=0,**limits):
    if type(rename_evidence) is not int or not 0<=rename_evidence<=64:
        raise ValueError('rename evidence limit must be an integer from 0 to 64')
    if type(namespace_evidence) is not int or not 0<=namespace_evidence<=64:
        raise ValueError('namespace evidence limit must be an integer from 0 to 64')
    if backend!='synchronous-fuse':raise ValueError('unsafe filesystem accounting backend')
    work=pathlib.Path(work);root=work/'domain';status=work/'status.sock'
    source=HERE.parent/'toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py'
    supervisor_source=source.read_bytes()
    if hashlib.sha256(supervisor_source).hexdigest()!=PIN:raise RuntimeError('supervisor identity mismatch')
    spec=importlib.util.spec_from_file_location('immutable_supervisor',source);m=importlib.util.module_from_spec(spec)
    # Execute exactly the checked source, ignoring cached bytecode and later writes.
    exec(compile(supervisor_source,str(source),'exec',dont_inherit=True),m.__dict__)
    server_argv=[sys.executable,'-B',str(HERE/'fuse_backend.py'),str(root),str(status),str(live_limit),str(write_limit),str(file_limit)]
    if rename_evidence:
        server_argv.extend(['--rename-evidence',str(rename_evidence)])
    if namespace_evidence:
        server_argv.extend(['--namespace-evidence',str(namespace_evidence)])
    server=subprocess.Popen(server_argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    final=None;result=None;cleanup=None;primary=None
    def snapshot():
        if server.poll() is not None:raise RuntimeError('filesystem backend exited')
        with socket.socket(socket.AF_UNIX) as s:
            s.settimeout(.5);s.connect(str(status));data=b''
            while True:
                part=s.recv(8192)
                if not part:break
                data+=part
                if len(data)>(32768 if namespace_evidence else 8192):raise RuntimeError('filesystem backend receipt too large')
        state=json.loads(data)
        if set(('live','peak','written','failure','openHandles'))-state.keys():raise RuntimeError('filesystem backend receipt incomplete')
        return state
    try:
        start=time.monotonic()
        while not status.exists():
            if server.poll() is not None:raise RuntimeError('filesystem mount/backend failed')
            if time.monotonic()-start>3:raise RuntimeError('filesystem backend startup deadline')
            time.sleep(.01)
        check=limits.pop('check',None)
        def owned_check():
            state=snapshot()
            if state['failure']:return state['failure']
            if check:return check()
        result=m.supervise([sys.executable,'-B',str(HERE/'confine.py'),str(root),*argv],check=owned_check,**limits)
        deadline=time.monotonic()+1
        while True:
            final=snapshot()
            if not final['openHandles'] or time.monotonic()>deadline:break
            time.sleep(.01)
        if final['failure']:result['stopReason']=result['stopReason'] or final['failure']
        if final['openHandles']:result['stopReason']=result['stopReason'] or 'filesystem handles remain after reap'
        result['filesystem']=final
        return result
    except BaseException as error:
        primary=error
        raise
    finally:
        # All child execution has ended before disconnecting the trusted server.
        mounted=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(root) in s]
        q=subprocess.run(['/usr/bin/fusermount3','-u','--',str(root)],capture_output=True,timeout=5) if mounted else None
        if server.poll() is None:server.terminate()
        try:out,err=server.communicate(timeout=3)
        except subprocess.TimeoutExpired:server.kill();out,err=server.communicate(timeout=3)
        remaining=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(root) in s]
        cleanup=dict(unmountExit=q.returncode if q else None,unmountStdout=q.stdout.decode() if q else '',unmountStderr=q.stderr.decode() if q else '',remainingMounts=remaining,serverExit=server.returncode,serverStdout=out.decode(),serverStderr=err.decode())
        if result is not None:result['filesystemCleanup']=cleanup
        if primary is not None:primary.filesystemCleanup=cleanup
        if (remaining or q and q.returncode) and primary is None:raise RuntimeError('filesystem cleanup failed: '+json.dumps(cleanup))

from guard import *
import socket,base64,ctypes

def main():
    limits=configure_parent();save('remote-startup.json',dict(limits=limits,pid=os.getpid(),root=str(ROOT)))
    assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
    controls={}
    for label,kw in [('omitted',{}),('root',{'cwd':'/'}),('outside',{'cwd':'/tmp'})]:
        try:run(['/bin/false'],**kw)
        except (ValueError,TypeError):controls[label]='rejected before spawn'
        else:raise AssertionError(label)
    controls['sentinel']=run(['/bin/pwd'],cwd=ROOT)['stdout'].strip();save('remote-containment.json',controls)
    pins=json.load(open(ROOT/'source-pins.json'));actual={}
    for rel,pin in pins.items():
        p=REPO/rel;actual[rel]=dict(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size)
        assert actual[rel]==pin
    save('remote-source-pins.json',actual)
    py=pathlib.Path('/usr/bin/python3').resolve(strict=True);fuse=pathlib.Path('/usr/bin/fusermount3').resolve(strict=True)
    assert pathlib.Path('/dev/fuse').exists()
    save('remote-executables.json',dict(python=str(py),pythonSHA256=hashlib.sha256(py.read_bytes()).hexdigest(),fusermount=str(fuse),fusermountSHA256=hashlib.sha256(fuse.read_bytes()).hexdigest(),fuseDevice=os.stat('/dev/fuse').st_rdev))
    work=ROOT/'w';assert not work.exists();work.mkdir()
    sock=work/'status.sock';length=len(os.fsencode(sock));save('socket-path.json',dict(path=str(sock),filesystemEncodedBytes=length,valid=length<108));assert length<108
    fixture=(ROOT/'fixture.py').read_text()
    argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(ROOT/'cancellation.json'),'--work',str(work),'--live-limit','32768','--write-limit','65536','--file-limit','4096','--rss-limit',str(128*1048576),'--cpu-limit','5','--wall-limit','2','--output-limit','8192','--','/usr/bin/python3','-B','-c',fixture]
    save('invocation.json',dict(argv=argv,cwd=str(REPO),fixtureSHA256=hashlib.sha256(fixture.encode()).hexdigest(),sourcePins=pins))
    live=[]
    def observe(ps,selected):
        if len(live)>=3 or not sock.exists():return
        try:
            with socket.socket(socket.AF_UNIX) as s:
                s.settimeout(.15);s.connect(str(sock));data=b''
                while True:
                    b=s.recv(4096)
                    if not b:break
                    data+=b
                    if len(data)>8192:raise RuntimeError('state capture rejection')
            state=json.loads(data)
            if state['openHandles']>0 and state['written']>=16:
                live.append(dict(at=time.time(),state=state,processes={str(pid):ps[pid] for pid in selected if pid in ps},mounts=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in s]))
        except (OSError,ValueError):pass
    rec=run(argv,cwd=REPO,check=False,observe=observe)
    save('cli-result.json',rec);save('live-observations.json',live)
    # Reap adopted descendants only after the production CLI has completed.
    reaped=[]
    while True:
        try:
            pid,status=os.waitpid(-1,os.WNOHANG)
            if not pid:break
            reaped.append([pid,status])
        except ChildProcessError:break
    ps=procs();remaining={pid:row for pid,row in rec['processes'].items() if int(pid)!=os.getpid() and ps.get(int(pid),(0,-1,0))[1]==row[1]}
    mounts=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in s]
    save('process-mount-cleanup.json',dict(remainingProcesses=remaining,remainingMounts=mounts,adoptedReaped=reaped,socketExists=sock.exists()))
    report=json.loads(rec['stdout']);backend=report.get('backendReceipt',{});output=backend.get('output',{});identities=[json.loads(x) for x in base64.b64decode(output.get('data','')).decode().splitlines()]
    result=dict(cliRejected=rec['exit']==1 and report.get('accepted') is False,stopReason=backend.get('stopReason'),identities=identities,authoritativeFilesystem=backend.get('filesystem'),authoritativeCleanup=backend.get('filesystemCleanup'),allOwnedProcessesGone=not remaining,mountDisconnected=not mounts,liveBackendObserved=bool(live),report=report)
    result['PASS']=result['cliRejected'] and result['stopReason']=='wall deadline' and {x['role'] for x in identities}=={'parent','descendant'} and not remaining and not mounts and bool(live) and report['cleanupComplete'] is True
    save('acceptance.json',result)
    if not result['PASS']:raise RuntimeError('REAL correctness failure; preserve unchanged reproducer, no repair or retry')
    print(json.dumps(dict(PASS=True,identities=identities,cleanup=result['authoritativeCleanup'])))

if __name__=='__main__':main()

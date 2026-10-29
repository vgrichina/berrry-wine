from guard import *
import ctypes,base64,socket
def main():
    startup()
    assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
    pins=json.load(open(ROOT/'source-pins.json'))
    for rel,pin in pins.items():
        p=REPO/rel;assert dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())==pin
    save('verified-pins.json',pins)
    exe={}
    for name in ['/usr/bin/python3','/usr/bin/fusermount3']:
        p=pathlib.Path(name).resolve(strict=True);exe[name]=dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    assert pathlib.Path('/dev/fuse').exists();save('executables.json',exe)
    work=ROOT/'w';work.mkdir();sock=work/'status.sock';assert len(os.fsencode(sock))==23
    fixture=(ROOT/'fixture.py').read_text()
    argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(ROOT/'cancellation.json'),'--work',str(work),'--live-limit','32768','--write-limit','65536','--file-limit','4096','--rss-limit',str(128*1048576),'--cpu-limit','5','--wall-limit','8','--output-limit','8192','--','/usr/bin/python3','-B','-c',fixture]
    save('invocation.json',dict(argv=argv,cwd=str(REPO),mountArgv=[],fixtureSHA256=hashlib.sha256(fixture.encode()).hexdigest(),productionInvocations=1))
    live=[];identities={}
    def observe(ps,selected):
        for pid in selected:
            if pid in ps:identities[str(pid)]=ps[pid]
        if len(live)>=4 or not sock.exists():return
        try:
            with socket.socket(socket.AF_UNIX) as s:
                s.settimeout(.1);s.connect(str(sock));data=b''
                while True:
                    b=s.recv(4096)
                    if not b:break
                    data+=b
                    if len(data)>8192:raise RuntimeError('backend capture rejection')
            state=json.loads(data)
            if state['openHandles']>0 and state['written']>=17:
                live.append(dict(at=time.time(),state=state,processes={str(p):ps[p] for p in selected if p in ps},mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in x]))
        except (OSError,ValueError):pass
    rec=run(argv,cwd=REPO,check=False,observe=observe);save('cli-result.json',rec);save('live-observations.json',live)
    ps=procs(); remaining={pid:r for pid,r in identities.items() if int(pid)!=os.getpid() and int(pid) in ps and ps[int(pid)]['start']==r['start']}
    mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in x]
    save('production-cleanup-observation.json',dict(remaining=remaining,mounts=mounts,identities=identities))
    safety=[]
    for pid,r in remaining.items():
        try:os.kill(int(pid),signal.SIGKILL);safety.append([pid,r['start']])
        except ProcessLookupError:pass
    reaped=[]
    for _ in range(100):
        try:
            pid,status=os.waitpid(-1,os.WNOHANG)
            if pid:reaped.append([pid,status]);continue
        except ChildProcessError:break
        time.sleep(.01)
    final=procs();left={pid:r for pid,r in identities.items() if int(pid)!=os.getpid() and int(pid) in final and final[int(pid)]['start']==r['start']}
    save('outer-safety-cleanup.json',dict(killed=safety,reaped=reaped,remaining=left,mounts=mounts))
    report=json.loads(rec['stdout']); b=report.get('backendReceipt',{}); output=base64.b64decode(b.get('output',{}).get('data','')).decode(errors='replace')
    result=dict(cliExit=rec['exit'],report=report,fixtureOutput=output,liveBackendObserved=bool(live),noProductionSurvivors=not remaining,noFinalSurvivors=not left,mountDisconnected=not mounts,safetyIntervened=bool(safety or rec['safetyKilled']),wall=rec['wall'],physicalRSS=rec['peakGroupPhysicalRSS'])
    result['PASS']=rec['exit']==0 and report.get('accepted') is True and b.get('exit')==0 and b.get('stopReason') is None and report.get('cleanupComplete') is True and bool(live) and not remaining and not left and not mounts and not safety and not rec['safetyKilled'] and 'parent-normal-exit' in output and 'child-ready' in output and rec['wall']<5
    save('acceptance.json',result)
    print(json.dumps(dict(PASS=result['PASS'],cliExit=rec['exit'],wall=rec['wall'],output=output)))
    if not result['PASS']:raise RuntimeError('FIRST counterexample STOP; no repair or retry')
if __name__=='__main__':main()

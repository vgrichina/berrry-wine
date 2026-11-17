#!/usr/bin/env python3
"""Real process lifecycle regressions; no game media or guest input."""
import importlib.util,json,os,pathlib,signal,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parent.parent
s=importlib.util.spec_from_file_location('runtime',ROOT/'tools/neverhood-original-current-runtime.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def until(path):
    end=time.monotonic()+10
    while not path.exists():
        assert time.monotonic()<end,str(path)
        time.sleep(.01)
    return json.loads(path.read_text())
def component_tests(out):
    from unittest.mock import patch
    out.mkdir()
    name='lib/cli-native-scene.js';revision='63d7b0d0e8d979772a4e527a4d3561b4bdeb3692'
    expected=m.H.git(ROOT,'show',revision+':'+name)
    original=pathlib.Path.read_bytes
    def drift(p):return b'concurrent shared-tree edit' if p==ROOT/name else original(p)
    with patch.dict(os.environ,{'NEVERHOOD_PUBLISHED_COMPONENTS':json.dumps({name:revision})}),patch.object(pathlib.Path,'read_bytes',drift):
        assert (ROOT/name).read_bytes()!=expected
        actual=m.component_bytes(name);assert actual==expected
        assert m.component_bytes('tools/neverhood-original-current-control.py')==original(ROOT/'tools/neverhood-original-current-control.py')
        pool,index,rows=m.H.indexed_sources({name:actual})
        manifest=dict(sourceIndexSHA256=m.H.digest(index),sources=rows)
        assert m.H.validate_sources(pool,manifest)==rows
        fd=m.H.seal('published-component-test',pool)
        try:assert os.pread(fd,len(pool),0)==pool
        finally:os.close(fd)
    with patch.dict(os.environ,{'NEVERHOOD_PUBLISHED_COMPONENTS':json.dumps({'host.js':revision})}):
        try:m.component_bytes('host.js')
        except AssertionError:pass
        else:raise AssertionError('unapproved component path selected')
    with patch.dict(os.environ,{'NEVERHOOD_PUBLISHED_COMPONENTS':json.dumps({name:'0'*40})}):
        try:m.component_bytes(name)
        except AssertionError:pass
        else:raise AssertionError('unpublished component selected')
    m.save(out,'component-proof.json',dict(passed=True,publishedRevision=revision,path=name,
        sha256=m.H.digest(expected),sharedDriftExcluded=True,unselectedPathUnchanged=True,
        forbiddenPathRefused=True,unpublishedRevisionRefused=True,sealedInventoryVerified=True))
    print('PASS explicit published component under shared-tree drift; sealed inventory, path/ancestry refusals')
def listener_tests(out):
    import socket,tempfile
    from unittest.mock import patch
    out.mkdir()
    # Real listener creation between the old FD snapshot and TCP read faithfully
    # reproduces the failed local admission without any HTTP or native input.
    race=out/'race';race.mkdir()
    info=dict(pid=os.getpid(),startToken=m.H.token(os.getpid()))
    m.save(race,'native-pid.json',info)
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    before={str(p.readlink()) for p in pathlib.Path(f'/proc/{os.getpid()}/fd').iterdir() if p.exists()}
    # Use a second socket: bind/listen after the old snapshot, so its inode is new.
    sock.close();sock=socket.socket();sock.bind(('127.0.0.1',port));sock.listen()
    rows=[r.split() for r in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]]
    row=next(r for r in rows if r[1]=='0100007F:'+format(port,'04X') and r[3]=='0A')
    assert 'socket:['+row[9]+']' not in before
    receipt=m.wait_owned_listener(race,port,1)
    assert receipt['inode']==row[9] and receipt['tcpBeforeFDs']
    sock.close()
    # PID alone never admits a socket; the unchanged process creates a real
    # delayed listener, after which matching ownership is required.
    run=out/'delayed';run.mkdir()
    code="import socket,time;time.sleep(.25);s=socket.socket();s.bind(('127.0.0.1',"+str(port)+"));s.listen();print('listening',flush=True);time.sleep(60)"
    p=subprocess.Popen([sys.executable,'-c',code],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    m.save(run,'native-pid.json',dict(pid=p.pid,startToken=m.H.token(p.pid)))
    try:
        result=m.wait_owned_listener(run,port,2)
        assert result['pidWithoutListenerSamples']>0 and result['verifiedAt']-result['startedAt']>=.2
        foreign=out/'foreign';foreign.mkdir();m.save(foreign,'native-pid.json',info)
        try:m.wait_owned_listener(foreign,port,1)
        except AssertionError as e:assert 'not owned' in str(e)
        else:raise AssertionError('foreign listener admitted')
        stale=out/'stale';stale.mkdir();m.save(stale,'native-pid.json',dict(pid=p.pid,startToken='wrong'))
        try:m.wait_owned_listener(stale,port,1)
        except AssertionError as e:assert 'identity changed' in str(e)
        else:raise AssertionError('stale PID admitted')
    finally:
        p.terminate();a,b=p.communicate(timeout=5)
        m.save(run,'native-wait.json',dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
    absent=out/'absent';absent.mkdir();m.save(absent,'native-pid.json',info)
    try:m.wait_owned_listener(absent,port,.05)
    except AssertionError as e:assert 'deadline' in str(e)
    else:raise AssertionError('PID alone admitted')
    closed=out/'unknown';closed.mkdir();m.save(closed,'PERMANENT-UNKNOWN.json',{})
    with patch.object(m.pathlib.Path,'read_text',side_effect=AssertionError('read after UNKNOWN')):
        try:m.wait_owned_listener(closed,port,1)
        except AssertionError as e:assert 'permanent UNKNOWN' in str(e)
        else:raise AssertionError('UNKNOWN read process state')
    assert not list(out.rglob('requests.jsonl'))
    m.save(out,'listener-proof.json',dict(passed=True,oldOrderRaceReproduced=True,tcpBeforeFDs=True,
        actualDelayedSocket=True,pidAloneRefused=True,foreignRefused=True,staleIdentityRefused=True,
        UNKNOWNNoReads=True,HTTPRequests=0))
    print('PASS real listener sampling race, delayed socket/PID-alone, foreign/stale/deadline/UNKNOWN; zero HTTP')

def main():
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
    if mode=='components':return component_tests(out)
    if mode=='listener':return listener_tests(out)
    if mode=='native':
        m.RUN=out
        code="import signal,time,sys;signal.signal(signal.SIGTERM,lambda s,f:sys.exit(0));print('ready',flush=True);time.sleep(60)"
        m.admit=lambda o,r:(dict(os.environ),(),[sys.executable,'-c',code,'--control=1234','--pipe-child-args=--control=1235','--native-invocation-token=fixture'])
        m.run(out,{})
        return
    if mode=='outer-child':
        m.save(out,'prepared.json',{'authoredOnly':True})
        while not (out/'runtime-start.json').exists():time.sleep(.005)
        time.sleep(.3);print('authored outer route complete')
        return
    if mode=='outer':
        rev=m.H.git(ROOT,'rev-parse','HEAD').decode().strip()
        g=m.published('tools/gltron-current-supervise.py',rev)
        return g.ParentProcessSupervisor(out,[sys.executable,'-B',__file__,'outer-child',str(out)],preparation=10,runtime=10,preparation_watchdog=12,runtime_watchdog=12).run()
    assert mode=='test';out.mkdir()
    for sig in (signal.SIGTERM,signal.SIGINT):
        run=out/sig.name;run.mkdir()
        p=subprocess.Popen([sys.executable,'-B',__file__,'native',str(run)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        until(run/'native-pid.json');time.sleep(.1);p.send_signal(sig);a,b=p.communicate(timeout=8)
        assert p.returncode==0,b.decode()
        wait=until(run/'native-wait.json')
        assert wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'] and wait['disposition']=='host-cancellation'
        assert until(run/'watchdog-wait.json')['actualWait'] and until(run/'runtime-closed.json')['descriptorsClosed']
    for name,seconds in (('transient-launcher',10),('owner-deadline',.3),('outer-route',30)):
        run=out/name;run.mkdir()
        child=([sys.executable,'-B',__file__,'outer',str(run/'outer')] if name=='outer-route' else
               [sys.executable,'-c','import time;time.sleep('+('1' if name=='transient-launcher' else '60')+')'])
        command=[sys.executable,'-B',str(ROOT/'tools/neverhood-original-current-runtime.py'),'persistent-owner',str(run),str(os.getpid()),m.H.token(os.getpid()),str(seconds),*child]
        code="import subprocess,sys,time,pathlib;p=subprocess.Popen(sys.argv[2:],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True);f=pathlib.Path(sys.argv[1]);end=time.time()+5\nwhile not f.exists():\n assert time.time()<end;time.sleep(.005)"
        subprocess.run([sys.executable,'-c',code,str(run/'persistent-owner-armed.json'),*command],check=True,timeout=8)
        wait=until(run/'owner-wait.json')
        assert wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'] and wait['workerAlive']
        until(run/'owner-watchdog-wait.json')
        assert until(run/'owner-watchdog-result.json')['fired']==(name=='owner-deadline')
        assert wait['exit']==(-signal.SIGTERM if name=='owner-deadline' else 0)
        if name=='outer-route':
            w=until(run/'outer/wait.json')
            assert w['supervisorExitCode']==0 and w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'] and not w['remainingAfterRuntime']
            assert all(r['actualWait'] and r['stdoutEOF'] and r['stderrEOF'] and r['returncode']==0 for r in w['watchdogs'])
            assert until(run/'outer/parent-process-owner.json')['parentProcessAliveAtJoin']
    print('PASS native TERM/INT finally wait/both EOF; transient launcher; independent owner deadline; actual outer/two watchdogs/empty scope')
if __name__=='__main__':sys.exit(main())

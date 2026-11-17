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
def main():
    mode=sys.argv[1];out=pathlib.Path(sys.argv[2]).resolve()
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

#!/usr/bin/env python3
"""Prearm independent deadline process before each one-shot original launch."""
import json, os, pathlib, signal, subprocess, sys, time
def write(p,v): pathlib.Path(p).write_text(json.dumps(v,indent=2))
def watchdog(out, token, seconds, phase):
    seconds=int(seconds)
    write(out+'/'+phase+'-watchdog-armed.json',{'pid':os.getpid(),'armedAt':time.time(),'seconds':seconds,'independent':True})
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if pathlib.Path(out+'/'+phase+'-watchdog-cancel').exists():
            write(out+'/'+phase+'-watchdog-result.json',{'fired':False,'cancelledAt':time.time()});return
        time.sleep(.1)
    fired=[]
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            env=(p/'environ').read_bytes().split(b'\0')
            if ('BOIDS_CURRENT_TOKEN='+token).encode() in env:
                os.kill(int(p.name),signal.SIGKILL);fired.append(int(p.name))
        except (OSError,ProcessLookupError): pass
    write(out+'/'+phase+'-watchdog-result.json',{'fired':True,'pids':fired})
def main():
    out,commit,backend,mode,*fixture=sys.argv[1:];pathlib.Path(out).mkdir(parents=True,exist_ok=False)
    token=os.urandom(16).hex()
    w=subprocess.Popen([sys.executable,__file__,'watchdog',out,token,'260','preparation'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    while not pathlib.Path(out+'/preparation-watchdog-armed.json').exists():
        if w.poll() is not None: raise RuntimeError('watchdog failed')
        time.sleep(.01)
    env=dict(os.environ,BOIDS_CURRENT_TOKEN=token)
    p=subprocess.Popen(['node','tools/boids-current-run.cjs',out,commit,backend,mode,*fixture],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,start_new_session=True)
    preparation_end=time.monotonic()+240
    write(out+'/preparation-armed.json',{'pid':p.pid,'watchdogPid':w.pid,'startedAt':time.time(),'seconds':240})
    while not pathlib.Path(out+'/prepared.json').exists() and p.poll() is None and time.monotonic()<preparation_end: time.sleep(.05)
    prepared=pathlib.Path(out+'/prepared.json').exists() and time.monotonic()<preparation_end and p.poll() is None
    pathlib.Path(out+'/preparation-watchdog-cancel').touch();po,pe=w.communicate(timeout=5)
    write(out+'/preparation-wait.json',{'watchdogPid':w.pid,'returncode':w.returncode,'stdoutEOF':True,'stderrEOF':True,'prepared':prepared})
    if prepared:
        w=subprocess.Popen([sys.executable,__file__,'watchdog',out,token,'320','runtime'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        while not pathlib.Path(out+'/runtime-watchdog-armed.json').exists():
            if w.poll() is not None: raise RuntimeError('runtime watchdog failed')
            time.sleep(.01)
        started=time.time();runtime_end=time.monotonic()+300
        write(out+'/native-armed.json',{'pid':p.pid,'watchdogPid':w.pid,'startedAt':started,'seconds':300,'deadline':started+300})
        write(out+'/runtime-start.json',{'deadline':int((started+300)*1000)})
    else:
        os.killpg(p.pid,signal.SIGTERM) if p.poll() is None else None
    timed=False
    try: stdout,stderr=p.communicate(timeout=max(0,runtime_end-time.monotonic()) if prepared else 5)
    except subprocess.TimeoutExpired:
        timed=True;os.killpg(p.pid,signal.SIGTERM)
        try: stdout,stderr=p.communicate(timeout=5)
        except subprocess.TimeoutExpired: os.killpg(p.pid,signal.SIGKILL);stdout,stderr=p.communicate()
    pathlib.Path(out+'/stdout.log').write_bytes(stdout);pathlib.Path(out+'/stderr.log').write_bytes(stderr)
    # Close any descendants remaining after the awaited runtime, by unique token.
    remaining=[]
    for q in pathlib.Path('/proc').iterdir():
        if not q.name.isdigit(): continue
        try:
            if ('BOIDS_CURRENT_TOKEN='+token).encode() in (q/'environ').read_bytes().split(b'\0'):
                remaining.append(int(q.name));os.kill(int(q.name),signal.SIGTERM)
        except OSError: pass
    if prepared:
        pathlib.Path(out+'/runtime-watchdog-cancel').touch();wo,we=w.communicate(timeout=5)
    write(out+'/wait.json',{'pid':p.pid,'returncode':p.returncode,'timedOut':timed,'phase':'runtime' if prepared else 'preparation','stdoutEOF':True,'stderrEOF':True,'watchdogReturncode':w.returncode,'watchdogStdoutEOF':True,'watchdogStderrEOF':True,'remainingAfterRuntime':remaining,'endedAt':time.time()})
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='watchdog': watchdog(*sys.argv[2:])
    else: main()

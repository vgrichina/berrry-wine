import subprocess, os, sys, json, time, resource, selectors, signal
from pathlib import Path
OUT=Path(__file__).parent
def limits():
    os.setsid()
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
def run(argv, cwd=None, env=None, label=None, cap=131072):
    e=os.environ.copy(); e.update(env or {}); e['NODE_OPTIONS']='--max-old-space-size=128'
    start=time.monotonic(); p=subprocess.Popen(argv,cwd=cwd,env=e,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits)
    sel=selectors.DefaultSelector(); sel.register(p.stdout,selectors.EVENT_READ);sel.register(p.stderr,selectors.EVENT_READ)
    data={p.stdout:bytearray(),p.stderr:bytearray()};failure=None
    while sel.get_map():
        if time.monotonic()-start>60: failure='wall60s'
        if sum(map(len,data.values()))>cap: failure='capture cap'
        if failure:
            os.killpg(p.pid,signal.SIGTERM)
            try:p.wait(timeout=2)
            except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
            break
        for k,_ in sel.select(.05):
            b=os.read(k.fileobj.fileno(),8192)
            if b:data[k.fileobj].extend(b)
            else:sel.unregister(k.fileobj)
    rc=p.wait(timeout=5)
    a,b=(bytes(data[x]) for x in [p.stdout,p.stderr])
    rec={'argv':argv,'cwd':str(cwd),'exitCode':rc,'seconds':time.monotonic()-start,'stdout':a.decode(errors='replace'),'stderr':b.decode(errors='replace'),'guardFailure':failure}
    if label:(OUT/(label+'.json')).write_text(json.dumps(rec,indent=2))
    if failure:raise RuntimeError(failure)
    return rc,a,b
if __name__=='__main__':
    rc,a,b=run(sys.argv[2:],cwd=OUT.parent/'repo',label=sys.argv[1]);sys.stdout.buffer.write(a+b);sys.exit(rc)

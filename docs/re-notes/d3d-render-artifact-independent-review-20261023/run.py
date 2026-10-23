import os, sys, json, time, subprocess, resource, selectors, signal, shutil, glob
from pathlib import Path
base=Path(__file__).resolve().parent
task=Path('/tmp/d3d-render-artifact-independent-oct23')
external=Path('/home/user/wine-assembly/scratch/usage-watch/d3d-render-artifact-independent-integrate-oct23')
def guard():
    paths=[p for root in (task,external) for p in root.rglob('*') if p.is_file()]
    assert all(p.stat().st_size<=25165824 for p in paths),'file guard'
    private=sum(p.stat().st_size for p in task.rglob('*') if p.is_file())
    assert private<=8388608,'private cap'
    wal=sum(os.stat(p).st_size for pattern in ('/home/user/.codex/*.sqlite-wal','/home/user/.codex/*.sqlite-shm') for p in glob.glob(pattern))
    session_paths=list(Path('/home/user/.codex/sessions/2026/10/23').glob('*01a16a4e-d12b-7282-bbfd-8f540c8afbe9*'))
    sessions=sum(p.stat().st_size for p in session_paths)
    actual=sum(p.stat().st_size for p in paths)+wal+sessions
    peak=actual+16777216+8388608+1048576
    mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
    r=dict(actual=actual,private=private,wal_shm=wal,session_files=[str(p) for p in session_paths],session_bytes=sessions,peak=peak,host_free=shutil.disk_usage(task).free,MemAvailable=mem)
    assert peak<=67108864,r
    assert r['host_free']-(peak-actual)>=2982150144,r
    assert mem>=805306368,r
    return r
def limits():
    os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
receipt={'before':guard(),'command':sys.argv[1:]};start=time.monotonic()
proc=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits)
sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ)
captured=0
try:
    with open(base/'checks.log','ab',buffering=0) as out:
        while sel.get_map():
            assert time.monotonic()-start<60,'wall guard'
            for key,_ in sel.select(.1):
                b=os.read(key.fd,4096)
                if not b:sel.unregister(key.fileobj);continue
                captured+=len(b)
                assert (base/'checks.log').stat().st_size+len(b)<=131072,'capture before buffer guard'
                out.write(b)
    receipt.update(exit=proc.wait(timeout=1),captured=captured,after=guard(),wall=time.monotonic()-start)
finally:
    if proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
with open(base/'execution.jsonl','a') as f:f.write(json.dumps(receipt)+'\n')
print(json.dumps(receipt));sys.exit(receipt['exit'])

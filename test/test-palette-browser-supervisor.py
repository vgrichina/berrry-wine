#!/usr/bin/env python3
"""Small offline children only. Never starts Chrome, WebGL or a guest."""
import importlib.util
import os
import pathlib
import subprocess
import sys
import signal
import tempfile
import json
import time

spec = importlib.util.spec_from_file_location('controls',pathlib.Path(__file__).parent/'helpers/palette-browser-supervisor.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

def run(code, **limits):
    result = s.supervise([sys.executable,'-c',code],wall_limit=limits.pop('wall_limit',3),**limits)
    assert result['cleanupComplete'],result
    for pid,start in result['owned']:
        row=s.snapshot().get(pid)
        assert row is None or row['start']!=start,result
    print(json.dumps({k:v for k,v in result.items() if k!='output'}))
    return result

# Pre-existing child must neither be adopted as owned, reaped nor signalled.
unrelated=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'])
try:
    start=s.snapshot()[unrelated.pid]['start']
    detached="import os,subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c',\"x=bytearray(12*1024*1024)\\nwhile True: pass\"],start_new_session=True); print(p.pid,flush=True); time.sleep(20)"
    result=run(detached,cpu_limit=.18)
    assert result['stopReason']=='aggregate CPU limit',result
    child=int(result['output'].strip())
    assert child in [row[0] for row in result['owned']]
    assert result['cpuSeconds']>=.18 and result['peakRSS']>25*1024*1024
    print('PASS detached child remains CPU/RSS charged and cleaned')
    result=run(detached,rss_limit=48*1024*1024)
    assert result['stopReason']=='aggregate RSS limit',result
    print('PASS detached child aggregate RSS enforcement')
    # The detached child allocates and exits wholly inside check(), between
    # /proc samples. Its parent waits it, so only the parent's final wait4
    # high water can retain the missed descendant peak. No timing retries.
    with tempfile.TemporaryDirectory(prefix='palette-reaped-rss-') as directory:
        root=pathlib.Path(directory)
        child_code="""import pathlib,resource,time,json
p=pathlib.Path(%r)
(p/'ready').touch()
while not (p/'release').exists(): time.sleep(.001)
x=bytearray(48*1024*1024)
for i in range(0,len(x),4096): x[i]=1
(p/'peak').write_text(str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024))
del x
(p/'done').touch()
""" % directory
        parent_code=('import subprocess,sys,time; '
                     'p=subprocess.Popen([sys.executable,"-c",%r],start_new_session=True); '
                     'p.wait();time.sleep(.12);sys.exit(p.returncode)') % child_code
        calls=[]
        def await_file(name):
            deadline=time.monotonic()+2
            while not (root/name).exists() and time.monotonic()<deadline:
                time.sleep(.001)
            assert (root/name).exists(),name
        def between_samples():
            calls.append(True)
            if len(calls)==1:
                await_file('ready')
            elif len(calls)==2:
                (root/'release').touch()
                await_file('done')
                time.sleep(.1)
        result=run(parent_code,rss_limit=48*1024*1024,check=between_samples)
        actual_peak=int((root/'peak').read_text())
        assert actual_peak>48*1024*1024,result
        assert result['sampledPeakRSS']<=48*1024*1024,result
        assert result['reapedPeakRSS']>=actual_peak,result
        assert result['peakRSS']==max(result['sampledPeakRSS'],result['reapedPeakRSS']),result
        assert result['stopReason']=='aggregate RSS limit',result
        assert unrelated.poll() is None and s.snapshot()[unrelated.pid]['start']==start
        print('PASS waited detached descendant high water rejects missed inter-sample peak')
    result=run('import time;time.sleep(20)',wall_limit=.12)
    assert result['stopReason']=='wall deadline',result
    print('PASS timeout cleanup')
    # Immediate parent exit: detached child is adopted before first sampling.
    result=run("import subprocess,sys;subprocess.Popen([sys.executable,'-c','import time;time.sleep(20)'],start_new_session=True);sys.exit(7)")
    assert result['exit']==7 and len(result['owned'])>=2,result
    print('PASS failure/orphan cleanup')
    result=run('print("small")',output_limit=2)
    assert result['stopReason']=='output limit'
    print('PASS output bound')
    sent=[]
    def interrupt():
        if not sent:
            os.kill(os.getpid(),signal.SIGTERM)
            sent.append(True)
        return None
    result=run('import time;time.sleep(20)',check=interrupt)
    assert result['stopReason']=='supervisor interrupted',result
    print('PASS supervisor signal cleanup')
    def fail_check():
        raise RuntimeError('synthetic ledger rejection')
    result=run('import time;time.sleep(20)',check=fail_check)
    assert result['stopReason']=='accounting check failed: synthetic ledger rejection',result
    print('PASS accounting exception cleanup')
    helper=str(pathlib.Path(__file__).parent/'helpers/palette-browser-launch.js')
    code="const c=require("+json.dumps(helper)+");c.ensureSupervised();require('child_process').spawn('/usr/bin/python3',['-c','import time;time.sleep(20)'],{detached:true,stdio:'inherit'});setTimeout(()=>process.exit(7),30)"
    result=s.supervise(['/usr/local/bin/node','--max-old-space-size=64','-e',code],wall_limit=5)
    assert result['exit']==7 and result['cleanupComplete'],result
    assert b'PALETTE_SUPERVISOR ' in result['output'] and b'"cleanupComplete": true' in result['output'],result
    for pid,stamp in result['owned']:
        row=s.snapshot().get(pid)
        assert row is None or row['start']!=stamp,result
    print('PASS JS bootstrap actual supervised re-exec and detached failure cleanup')
    assert unrelated.poll() is None and s.snapshot()[unrelated.pid]['start']==start
    print('PASS unrelated process untouched throughout')
finally:
    unrelated.terminate();unrelated.wait(timeout=2)

"""Real kernel regression for creation arriving during Nox's durable service.

Only scheduling is controlled. waitid/waitpid/GETEVENTMSG are never fabricated.
No Chrome. The predecessor must lose the pending clone; the repair must consume
it before resuming exit_group. Missing kernel lineage must still refuse.
"""
import ctypes
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
ADAPTER = runpy.run_path(str(ROOT / 'tools/nox-startup-custody.py'))
SPEC = importlib.util.spec_from_file_location('controls', ROOT / 'tools/native_kernel_custody_test.py')
CONTROLS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CONTROLS)

SOURCE = r'''
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/wait.h>
static void *leaf(void *p) { for (;;) pause(); }
static void *creator(void *p) {
  while(access("go", F_OK)) usleep(1000);
  pthread_t t; if(pthread_create(&t,0,leaf,0)) _exit(81);
  for (;;) pause();
}
static void *killer(void *p) { _exit(0); }
int main(int argc,char **argv) {
  if(chdir(argv[1])) return 80;
  pid_t p=fork(); if(p<0)return 82;
  if(p) { int s;return waitpid(p,&s,0)==p && s==0?0:83; }
  pthread_t a,b;
  if(pthread_create(&a,0,creator,0))return 84;
  usleep(30000);
  if(pthread_create(&b,0,killer,0))return 85;
  for (;;) pause();
}
'''


def fixture(run, repaired):
    module = ADAPTER['load']()
    if not repaired:
        # Exactly the predecessor adapter: durable every CONT, no late scan.
        source = ADAPTER['candidate']((ROOT/'tools/native_kernel_custody.py').read_bytes())
        begin = source.index('                # Durable service may have blocked')
        end = source.index('                released = trace_task(CONT, task, deliver)', begin)
        exec(compile(source[:begin]+source[end:], 'nox-before-rescan', 'exec'), module.__dict__)
    (run/'fixture.c').write_text(SOURCE)
    subprocess.run(['cc','-O2','-pthread',str(run/'fixture.c'),'-o',str(run/'fixture')],check=True)
    clones=[]; rows=[]; armed=[]; triggered=[]; last={}; durable=[]; conts=[]
    waitid, waitpid, trace, sync = os.waitid, os.waitpid, module.ptrace, os.fsync
    append = module.Journal.append

    def observe(journal, value, **options):
        result = append(journal, value, **options)
        if journal.path.name == 'custody.ndjson': rows.append(dict(value))
        return result

    def consume(task, flags):
        result=waitpid(task,flags)
        if result[0]:
            last[task]=result[1]
            if os.WIFSTOPPED(result[1]) and result[1]>>16==3 and len(clones)<2:
                child=ctypes.c_ulong();trace(module.GETEVENTMSG,task,data=ctypes.addressof(child))
                clones.append(child.value)
                if len(clones)==2 and last.get(child.value)==4991:
                    armed.append(child.value)
            if len(clones)==2 and task==clones[1] and result[1]==4991:
                armed.append(task)
        return result

    def fsync(fd):
        result=sync(fd)
        if os.readlink('/proc/self/fd/'+str(fd)) != str(run/'custody.ndjson'): return result
        durable[:]=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
        if armed and not triggered:
            # The pre-flush scan has returned. Let an already admitted creator
            # reach a REAL pending CLONE while durable service owns the CPU.
            (run/'go').write_text('1')
            due=time.monotonic()+2
            while time.monotonic()<due:
                value=waitid(os.P_PID,clones[0],os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|module.WALL)
                if value and value.si_code==os.CLD_TRAPPED and value.si_status==773:
                    child=ctypes.c_ulong();trace(module.GETEVENTMSG,clones[0],data=ctypes.addressof(child))
                    triggered.append(dict(creator=clones[0],child=child.value,siStatus=value.si_status))
                    (run/'pending-during-fsync.json').write_text(json.dumps(triggered[0]))
                    break
                time.sleep(.001)
            assert triggered, 'creator did not reach real clone stop during fsync'
        return result

    def ptrace(request, task, addr=0, data=0):
        if request==module.CONT:
            assert durable==rows, 'CONT without successfully synced full prefix'
            conts.append(dict(pid=task,wait=last[task],prefix=len(durable)))
            if armed and task==clones[1]:
                result=trace(request,task,addr,data)
                # Let exit_group replace a still-unconsumed sibling event.
                time.sleep(.03)
                return result
        return trace(request,task,addr,data)

    error=None
    try:
        with patch.object(module.Journal,'append',observe),patch.object(module.os,'waitpid',consume), \
             patch.object(module.os,'fsync',fsync),patch.object(module,'ptrace',ptrace):
            due=time.time()+7
            module.supervise(run,[str(run/'fixture'),str(run)],deadline=due,cleanup_deadline=due+2)
    except AssertionError as exc:
        error=repr(exc)
    drain=json.loads((run/'kernel-drain.json').read_text())
    assert triggered and drain['exit']==0 and len(drain['owned'])==len(drain['reaped'])
    assert not drain['remaining'] and not drain['unreaped']
    child=triggered[0]['child']; killer=clones[1]
    if repaired:
        assert error is None and drain['complete'] and drain['kernelForkLineageComplete']
        custody=next(r for r in rows if r['kind']=='custody' and r['pid']==child)
        assert custody['cause']=='clone' and custody['parentCustodian']==clones[0]
        msg=next(r for r in rows if r['kind']=='kernel-event-message' and r['kernelMessage']==child)
        wait=next(r for r in rows if r['sequence']==msg['waitSequence'])
        assert wait['waitStatus']>>16==3
        release=next(r for r in rows if r['kind']=='ptrace-cont-returned' and r['pid']==killer)
        assert wait['sequence']<msg['sequence']<custody['sequence']
        assert custody['sequence']<release['sequence']
    else:
        assert error and 'unresolved kernel lineage' in error and not drain['complete']
        assert [r['pid'] for r in drain['unresolvedLineage']]==[child]
        assert any(r['kind']=='unlinked-exit-retirement' and r['pid']==child for r in rows)
    (run/'fixture-result.json').write_text(json.dumps(dict(passed=True,repaired=repaired,error=error,
        actualKernelEvents=True,owned=len(drain['owned']),reaped=len(drain['reaped']),conts=conts),indent=2))


def missing_lineage(run):
    CONTROLS.kernel=ADAPTER['load']()
    try: CONTROLS.parked_fixture(run)
    except AssertionError as error: assert 'unresolved kernel lineage' in str(error)
    else: raise AssertionError('missing lineage admitted')
    d=json.loads((run/'kernel-drain.json').read_text())
    assert not d['complete'] and not d['kernelForkLineageComplete'] and d['unresolvedLineage']
    assert len(d['owned'])==len(d['reaped']) and not d['remaining']
    assert not (run/'unlinked-userspace-ran').exists()


def exec_control(run, version):
    # Reuse the real leader EXIT / nonleader EXEC reproducer with this exact
    # generated adapter. Negative variants remove the binding or final wait.
    CONTROLS.kernel=ADAPTER['load']()
    assert CONTROLS.kernel.libc.prctl(36,1,0,0,0)==0
    CONTROLS.cancel_creators_fixture(run, 'exec', version)
    adopted=[]
    while True:
        try:
            pid,status=os.waitpid(-1,0)
            adopted.append(dict(pid=pid,status=status))
        except ChildProcessError: break
    (run/'adopted-waits.json').write_text(json.dumps(adopted))
    d=json.loads((run/'kernel-drain.json').read_text())
    assert d['complete']==(version=='fixed')
    w=json.loads((run/'creator-waits.json').read_text())
    assert w['supervisorWait']==(0 if version=='fixed' else 1)
    assert w['watchdogWait']==-15
    if version=='fixed':
        assert len(d['execTransfers'])==1
        t=d['execTransfers'][0]
        assert t['leaderExitSequence']<t['sequence']<t['reapSequence']
    else:
        assert d['failure'] and d['unreaped']


if __name__=='__main__':
    if sys.argv[1]=='--case':
        run=Path(sys.argv[3]).resolve()
        if sys.argv[2]=='missing': missing_lineage(run)
        elif sys.argv[2].startswith('exec-'):
            exec_control(run, 'fixed' if sys.argv[2]=='exec-fixed' else sys.argv[2])
        else: fixture(run,sys.argv[2]=='fixed')
    else:
        out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
        for name in ('before','fixed','missing','exec-fixed','exec-unbound','exec-missing-wait'):
            run=out/name;run.mkdir()
            p=subprocess.run([sys.executable,__file__,'--case',name,str(run)],capture_output=True,timeout=15)
            (run/'parent-wait.json').write_text(json.dumps(dict(wait=p.returncode,stdoutEOF=True,stderrEOF=True)))
            (run/'stdout').write_bytes(p.stdout);(run/'stderr').write_bytes(p.stderr)
            assert p.returncode==0,p.stderr.decode()
        print('PASS real before/fixed fsync race; missing lineage refuses despite all reaped; real exec transfer and missing binding/wait controls')

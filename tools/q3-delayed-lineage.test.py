"""Native creation during durable service must precede a sibling's exit_group.

Only scheduling is controlled: all waits and creator messages come from Linux.
The baseline adapter is recovered from Git against the unchanged provider.
"""
import ctypes
import gzip
import inspect
import json
import os
from pathlib import Path
import runpy
import signal
import subprocess
import sys
import tempfile
import time
import types
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
BASE = 'd140e31d375ce6fdfdb487d05211187636276aac'


def fixture(run, version, binary):
    adapter = ROOT/'tools/q3-startup-custody.py'
    if version in ('before','rescan','rescan-late'):
        source = subprocess.check_output(['git', 'show', BASE+':tools/q3-startup-custody.py'])
        scope = {'__file__': str(adapter)}
        exec(compile(source, str(adapter), 'exec'), scope)
    else:
        scope = runpy.run_path(str(adapter))
    if version in ('before','rescan','rescan-late'):
        provider = subprocess.check_output(['git', 'show', BASE+':tools/native_kernel_custody.py'])
        kernel = types.ModuleType('baseline')
        transformed = scope['candidate'](provider.decode())
        if version.startswith('rescan'):
            transformed = transformed.replace('                del resumes[task]\n','')
            seam = '                journal.release_barrier() # ordered durable prefix before executable userspace\n'
            assert transformed.count(seam)==1
            transformed = transformed.replace(seam,seam+'                if priority_wait() is not None: continue\n                del resumes[task]\n')
        exec(compile(transformed, 'baseline', 'exec'), kernel.__dict__)
    else:
        kernel = scope['load']()
    clones, pending, released = [], [], []
    gated = version in ('fixed','late','inflight')
    trace, barrier = kernel.ptrace, kernel.Journal.release_barrier
    flags = os.WEXITED | os.WSTOPPED | os.WNOHANG | os.WNOWAIT | kernel.WALL

    def await_creation():
        (run/'go').touch()
        due = time.monotonic()+2
        while time.monotonic() < due:
            value = os.waitid(os.P_PID, clones[0], flags)
            if value and value.si_code == os.CLD_TRAPPED and value.si_status == (1797 if gated else 773):
                if gated:
                    pending.append(None)
                    (run/'pending-creation.json').write_text(json.dumps(dict(
                        creator=clones[0], child=None, killer=clones[1], at=time.time(),
                        kernelEntryStop=value.si_status)))
                    return
                child = ctypes.c_ulong()
                trace(kernel.GETEVENTMSG, clones[0], data=ctypes.addressof(child))
                pending.append(child.value)
                (run/'pending-creation.json').write_text(json.dumps(dict(
                    creator=clones[0], child=child.value, killer=clones[1], at=time.time())))
                return
            time.sleep(.001)
        raise AssertionError('native creation did not become pending')

    def observed_trace(request, task, addr=0, data=0):
        if (version in ('late','rescan-late') and request == kernel.CONT and len(clones) == 2
                and task == clones[1] and not pending):
            # A real creator can run after the last scan, before CONT enters
            # the kernel. A rescan alone does not close this causal window.
            await_creation()
        if request == kernel.CONT and len(clones)==2 and task==clones[1] and version!='inflight':
            (run/'kill').touch()
        result = trace(request, task, addr, data)
        if (version=='inflight' and len(clones)==2 and task==clones[1] and
                request==kernel.CONT and not (run/'go').exists()):
            (run/'go').touch()
        if (version=='inflight' and len(clones)==2 and task==clones[0] and
                request==kernel.SYSCALL and not pending):
            due=time.monotonic()+2
            while time.monotonic()<due:
                value=os.waitid(os.P_PID,task,flags)
                if value and value.si_status==773: break
                time.sleep(.001)
            else: raise AssertionError('real in-flight clone missing')
            child=ctypes.c_ulong();trace(kernel.GETEVENTMSG,task,data=ctypes.addressof(child))
            pending.append(child.value)
            (run/'kill').touch()
            while time.monotonic()<due:
                value=os.waitid(os.P_PID,clones[1],flags)
                if value and value.si_status==1797: break
                time.sleep(.001)
            else: raise AssertionError('killer did not stop at kernel syscall entry')
            # Neither status has been consumed. The actual creator message
            # survives while the killer is already trying to exit the group.
            child2=ctypes.c_ulong();trace(kernel.GETEVENTMSG,task,data=ctypes.addressof(child2))
            assert child2.value==child.value
            (run/'pending-creation.json').write_text(json.dumps(dict(
                creator=task,child=child.value,killer=clones[1],at=time.time(),
                killerKernelEntryStop=value.si_status)))
        if request == kernel.GETEVENTMSG and len(clones) < 2:
            # The first two CLONE messages create the creator and killer.
            value = os.waitid(os.P_PID, task, flags)
            # waitpid already consumed this stop; inspect the actual caller's
            # latest consumed status rather than fabricating a wait result.
            frame = inspect.currentframe().f_back
            while frame and frame.f_code.co_name != 'supervise': frame = frame.f_back
            if frame and frame.f_locals.get('event') == 3:
                clones.append(ctypes.c_ulong.from_address(data).value)
        if request == kernel.CONT and len(clones) == 2 and task == clones[1] and not released:
            released.append(task)
            time.sleep(.03)  # allow actual exit_group to supersede the creator
        return result

    def service(journal):
        result = barrier(journal)
        caller = inspect.currentframe().f_back
        if (version not in ('late','rescan-late','inflight') and len(clones) == 2 and not pending and
                caller.f_code.co_name == 'supervise' and caller.f_locals.get('task') == clones[1]):
            await_creation()
        return result

    with patch.object(kernel, 'ptrace', side_effect=observed_trace), \
            patch.object(kernel.Journal, 'release_barrier', service):
        due = time.time()+8
        kernel.supervise(run, [binary, str(run)], deadline=due, cleanup_deadline=due+2,
                         journal_compression='gzip', command_compression='gzip')


def gated_version(version):
    return version in ('fixed','late','inflight')


def main(out):
    out.mkdir(parents=True, exist_ok=False)
    # This parent retains real waits and separate stdout/stderr EOF. EXITKILL
    # bounds an unexpectedly failing supervisor; adoption retains its children.
    libc = ctypes.CDLL(None)
    assert libc.prctl(36, 1, 0, 0, 0) == 0
    source = r'''
#define _GNU_SOURCE
#include <pthread.h>
#include <sched.h>
#include <sys/mman.h>
#include <unistd.h>
#include <sys/wait.h>
static int leaf(void *p) { for(;;) pause(); }
static void *creator(void *p) {
  while(access("go",F_OK)) usleep(1000);
  void *stack=mmap(0,65536,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
  if(stack==MAP_FAILED || clone(leaf,(char *)stack+65536,CLONE_VM|CLONE_FS|CLONE_FILES|CLONE_SIGHAND|CLONE_THREAD|CLONE_SYSVSEM,0)<0) _exit(81);
  for(;;) pause();
}
static void *killer(void *p) { while(access("kill",F_OK))usleep(1000); _exit(0); }
int main(int argc,char **argv) {
  if(chdir(argv[1])) return 80;
  pid_t p=fork(); if(p<0)return 82;
  if(p) { int s; return waitpid(p,&s,0)==p && s==0?0:83; }
  pthread_t a,b; if(pthread_create(&a,0,creator,0))return 84;
  usleep(30000); if(pthread_create(&b,0,killer,0))return 85;
  for(;;) pause();
}
'''
    with tempfile.TemporaryDirectory() as tmp:
        c, binary = Path(tmp)/'fixture.c', Path(tmp)/'fixture'
        c.write_text(source)
        subprocess.run(['cc', '-O2', '-pthread', str(c), '-o', str(binary)], check=True)
        for version in ('before','rescan','rescan-late','fixed','late','inflight'):
            run = out/version
            run.mkdir()
            result = subprocess.run([sys.executable, '-B', __file__, '--fixture', str(run),
                                     version, str(binary)], capture_output=True, timeout=15)
            adopted = []
            while True:
                try: task, status = os.waitpid(-1, 0)
                except ChildProcessError: break
                adopted.append(dict(pid=task, status=status))
            (run/'parent-wait.json').write_text(json.dumps(dict(returnCode=result.returncode,
                actualWait=True, stdoutEOF=True, stderrEOF=True, stdout=result.stdout.decode(),
                stderr=result.stderr.decode(), adopted=adopted)))
            drain = json.loads((run/'kernel-drain.json').read_text())
            event = json.loads((run/'pending-creation.json').read_text())
            rows = [json.loads(s) for s in gzip.open(run/'custody.ndjson.gz', 'rt')]
            fixed = version in ('rescan','fixed','late','inflight')
            assert result.returncode == (0 if fixed else 1), result.stderr
            assert drain['complete'] == fixed
            assert drain['kernelForkLineageComplete'] == fixed
            assert drain['remaining'] == drain['unreaped'] == adopted == []
            assert drain['commandLog']['eof']
            if fixed and event['child'] is None:
                bindings=[r for r in rows if r['kind']=='kernel-event-message' and
                          r['pid']==event['creator'] and r['waitStatus']>>16==3]
                if bindings: event['child']=bindings[0]['kernelMessage']
                else:
                    # The destructive syscall won the serial gate: the clone
                    # never entered Linux. No child identity may be inferred.
                    assert not any(r['parentCustodian']==event['creator'] for r in drain['owned'])
                    entry=next(r for r in rows if r['kind']=='syscall-gate-entry' and r['pid']==event['creator'])
                    terminal=next(r for r in rows if r['kind']=='reaped' and r['pid']==event['creator'])
                    assert entry['sequence']<terminal['sequence']
                    continue
            assert event['child'] in [r['pid'] for r in drain['reaped']]
            child = next(r for r in drain['owned'] if r['pid'] == event['child'])
            assert child['parentCustodian'] == (event['creator'] if fixed else None)
            if fixed:
                consumed = next(r for r in rows if r['kind'] == 'kernel-event-message' and
                                r['pid'] == event['creator'] and r['kernelMessage'] == event['child'])
                waits={r['sequence']:r['waitStatus'] for r in rows if r['kind']=='wait-consumed'}
                release = next(r for r in rows if r['kind'] == 'ptrace-cont-returned' and
                               r['pid'] == event['killer'] and
                               (not gated_version(version) or waits[r['waitSequence']]>>16==7))
                assert consumed['sequence'] < release['sequence']
            else:
                assert 'unresolved kernel lineage' in result.stderr.decode()
    print('PASS real service/late-window negatives, gated prevention and in-flight clone preservation')


if __name__ == '__main__':
    if sys.argv[1] == '--fixture': fixture(Path(sys.argv[2]), sys.argv[3], sys.argv[4])
    else: main(Path(sys.argv[1]).resolve())

"""Only new immutable-deadline API behavior; accepted fork controls are reused."""
import importlib.util
from pathlib import Path
import tempfile
import time
import unittest
import os
import json
import ctypes
import sys
import subprocess
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('kernel',Path(__file__).with_name('native_kernel_custody.py'))
kernel=importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)


class Deadlines(unittest.TestCase):
    def test_killed_fork_child_reaped_before_delayed_parent_lineage(self):
        with tempfile.TemporaryDirectory() as run:
            result=subprocess.run([sys.executable,__file__,'--parked-fork-fixture',run],
                                  capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            rows=[json.loads(s) for s in (Path(run)/'custody.ndjson').read_text().splitlines()]
            retirement=next(x for x in rows if x['kind']=='unlinked-exit-retirement')
            task=retirement['pid']
            reaped=next(x for x in rows if x['kind']=='reaped' and x['pid']==task)
            lineage=next(x for x in rows if x['kind']=='fork-lineage' and x['pid']==task)
            self.assertLess(reaped['sequence'],lineage['sequence'])
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertEqual(drain['unresolvedLineage'],[])
            self.assertEqual(drain['remaining'],[])
            self.assertTrue(drain['kernelForkLineageComplete'])

    def test_sigkill_supersedes_thread_clone_lineage_and_drains_without_execution(self):
        # Only wait selection is controlled: all statuses and the lost clone
        # event are real kernel results. Run separately so a failing predecessor
        # is retired by EXITKILL rather than stranding stopped fixture tasks.
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(os.environ.get('CUSTODY_PARKED_EVIDENCE',tmp))
            result=subprocess.run([sys.executable,__file__,'--parked-fixture',str(run)],
                                  capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            rows=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            retirement=next(x for x in rows if x['kind']=='unlinked-exit-retirement')
            task=retirement['pid']
            self.assertEqual(retirement['exitStatus'],9)
            self.assertFalse(any(x['kind']=='parked-child-release' and x['pid']==task for x in rows))
            self.assertFalse(any(x['kind']=='fork-lineage' and x['pid']==task for x in rows))
            before=next(x for x in rows if x['kind']=='before-reap' and x['pid']==task)
            self.assertLess(retirement['sequence'],before['sequence'])
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['exit'],0)
            self.assertEqual(len(drain['owned']),len(drain['reaped']))
            self.assertEqual([x['pid'] for x in drain['unresolvedLineage']], [task])
            for row in drain['owned']:
                self.assertFalse(Path('/proc',str(row['pid'])).exists())

    def test_autoattach_zero_retry_keeps_child_parked_until_parent_lineage(self):
        waitid,waitpid=os.waitid,os.waitpid
        pending=[];injected=[];consumed=[]
        def peek(which, pid, flags):
            if pending and not consumed:
                return waitid(os.P_PID,pending[0],flags)
            value=waitid(which,pid,flags)
            if value and value.si_code==os.CLD_TRAPPED and value.si_status>>8==1 and not pending:
                child=ctypes.c_ulong()
                kernel.ptrace(kernel.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
                pending.append(child.value)
                due=time.time()+2
                while time.time()<due:
                    stopped=waitid(os.P_PID,child.value,flags)
                    if stopped:return stopped
                    time.sleep(.001)
                self.fail('autoattach stop did not arrive')
            return value
        def consume(pid,flags):
            if pending and pid==pending[0] and not consumed:
                if not injected:
                    injected.append(pid);return 0,0
                consumed.append(pid)
            return waitpid(pid,flags)
        with tempfile.TemporaryDirectory() as run, patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume):
            due=time.time()+5
            kernel.supervise(run,[sys.executable,'-c','import os;p=os.fork();os._exit(0) if p==0 else os.waitpid(p,0)'],deadline=due,cleanup_deadline=due+2)
            rows=[json.loads(s) for s in (Path(run)/'custody.ndjson').read_text().splitlines()]
            child=injected[0]
            park=next(x for x in rows if x['kind']=='parked-autoattach' and x['pid']==child)
            lineage=next(x for x in rows if x['kind']=='fork-lineage' and x['pid']==child)
            release=next(x for x in rows if x['kind']=='parked-child-release' and x['pid']==child)
            self.assertLess(park['sequence'],lineage['sequence'])
            self.assertLess(lineage['sequence'],release['sequence'])
            self.assertFalse(Path('/proc',str(child)).exists())

    def test_nonterminal_peek_then_no_status_retries_without_releasing_child(self):
        # Execute real TRACEME/WNOWAIT custody. Inject exactly the legal
        # WNOHANG-zero interleaving reported by the concurrent Chrome launch,
        # leaving that real stopped child waitable for the next kernel peek.
        waitpid=os.waitpid
        injected=[]
        def consume(pid, flags):
            if not injected:
                injected.append(pid)
                return 0,0
            return waitpid(pid, flags)
        with tempfile.TemporaryDirectory() as run, patch.object(kernel.os,'waitpid',side_effect=consume):
            due=time.time()+5
            kernel.supervise(run,['/bin/true'],deadline=due,cleanup_deadline=due+2)
            rows=[json.loads(s) for s in (Path(run)/'custody.ndjson').read_text().splitlines()]
            retry=next(x for x in rows if x['kind']=='stop-peek-superseded')
            release=next(x for x in rows if x['kind']=='watchdog-barrier-released')
            self.assertLess(retry['sequence'],release['sequence'])
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertEqual(drain['exit'],0)
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(len(drain['owned']),len(drain['reaped']))
            self.assertFalse(Path('/proc',str(injected[0])).exists())
            if os.environ.get('CUSTODY_TEST_EVIDENCE'):
                destination=Path(os.environ['CUSTODY_TEST_EVIDENCE'])
                destination.mkdir(parents=True,exist_ok=True)
                for name in ['custody.ndjson','kernel-drain.json','kernel-armed.json']:
                    (destination/name).write_bytes((Path(run)/name).read_bytes())

    def test_expired_deadline_refuses_before_subreaper_or_fork(self):
        with tempfile.TemporaryDirectory() as run, patch.object(kernel.os,'fork') as fork, patch.object(kernel.libc,'prctl') as prctl:
            with self.assertRaisesRegex(AssertionError,'immutable deadlines'):
                kernel.supervise(run,['false'],deadline=time.time()-1,cleanup_deadline=time.time()+1)
            fork.assert_not_called()
            prctl.assert_not_called()

    def test_cleanup_must_follow_fixed_runtime_deadline(self):
        due=time.time()+10
        with tempfile.TemporaryDirectory() as run, patch.object(kernel.os,'fork') as fork, patch.object(kernel.libc,'prctl') as prctl:
            with self.assertRaisesRegex(AssertionError,'immutable deadlines'):
                kernel.supervise(run,['false'],deadline=due,cleanup_deadline=due)
            fork.assert_not_called()
            prctl.assert_not_called()


def parked_fixture(run, fork_only=False):
    waitid,waitpid=os.waitid,os.waitpid
    selected=[];consumed=[];terminal=[]
    def peek(which,pid,flags):
        if selected and (not consumed or (fork_only and not terminal)):
            return waitid(os.P_PID,selected[0],flags)
        value=waitid(which,pid,flags)
        if value and value.si_code==os.CLD_TRAPPED and value.si_status==19 and not selected:
            row=kernel.identity(value.si_pid)
            if row['tgid']!=row['pid']:
                selected.extend([row['pid'],row['tgid']])
        if value and value.si_code==os.CLD_TRAPPED and value.si_status>>8==(1 if fork_only else 3) and not selected:
            child=ctypes.c_ulong()
            kernel.ptrace(kernel.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
            selected.extend([child.value,value.si_pid])
            due=time.time()+2
            while time.time()<due:
                stopped=waitid(os.P_PID,child.value,flags)
                if stopped:return stopped
                time.sleep(.001)
            raise AssertionError('thread autoattach stop absent')
        return value
    def consume(pid,flags):
        result=waitpid(pid,flags)
        if fork_only and selected and pid==selected[0] and result[0] and (os.WIFEXITED(result[1]) or os.WIFSIGNALED(result[1])):
            terminal.append(pid)
        if selected and pid==selected[0] and not consumed and result[0]:
            consumed.append(pid)
            # Killing the creating thread group supersedes its pending clone
            # event while the new thread is still parked at its initial stop.
            os.kill(selected[0] if fork_only else selected[1],9)
        return result
    command='''import os,threading,time
p=os.fork()
if p==0:
 threading.Thread(target=lambda:time.sleep(30)).start()
 time.sleep(30)
else:
 _,status=os.waitpid(p,0)
 assert os.WIFSIGNALED(status) and os.WTERMSIG(status)==9
'''
    if fork_only:
        command='import os,time;p=os.fork();time.sleep(30) if p==0 else os.waitpid(p,0)'
    with patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume):
        due=time.time()+3
        kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1)


if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--parked-fixture':parked_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-fork-fixture':parked_fixture(sys.argv[2],True)
    else:unittest.main()

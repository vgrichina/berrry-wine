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
    def test_first_observed_child_stop_can_be_irreversible_exit(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(os.environ.get('CUSTODY_UNSEEN_EXIT_EVIDENCE',tmp))
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture','--unseen-exit-fixture',str(run)],
                                  capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            rows=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            retirement=next(x for x in rows if x['kind']=='unlinked-exit-retirement')
            task=retirement['pid']
            consumed=next(x for x in rows if x['kind']=='before-consume' and x['pid']==task)
            self.assertEqual(consumed['siStatus'],1541)
            self.assertEqual(retirement['exitStatus'],9)
            self.assertFalse(any(x['kind']=='parked-autoattach' and x['pid']==task for x in rows))
            self.assertFalse((run/'unlinked-userspace-ran').exists())
            barrier=json.loads((run/'first-exit-cont-barrier.json').read_text())
            self.assertEqual(barrier['durableSequence'],retirement['sequence'])
            reaped=next(x for x in rows if x['kind']=='reaped' and x['pid']==task)
            lineage=next(x for x in rows if x['kind']=='fork-lineage' and x['pid']==task)
            self.assertLess(retirement['sequence'],reaped['sequence'])
            self.assertLess(reaped['sequence'],lineage['sequence'])
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['exit'],0)
            self.assertTrue(drain['kernelForkLineageComplete'])

    def test_sigterm_supersedes_clone_and_retires_only_irreversible_exit(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(os.environ.get('CUSTODY_TERMINAL_EVIDENCE',tmp))
            result=subprocess.run([sys.executable,__file__,'--parked-term-fixture',str(run)],
                                  capture_output=True,text=True,timeout=12)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('unresolved kernel lineage',result.stderr)
            rows=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            retirement=next(x for x in rows if x['kind']=='unlinked-exit-retirement')
            task=retirement['pid']
            self.assertEqual(retirement['exitStatus'],15)
            self.assertFalse((run/'unlinked-userspace-ran').exists())
            self.assertFalse(any(x['kind'] in ('fork-lineage','parked-child-release') and x['pid']==task for x in rows))
            consumed=next(x for x in rows if x['kind']=='before-consume' and x['pid']==task and x['siStatus']==1541)
            reaped=next(x for x in rows if x['kind']=='reaped' and x['pid']==task)
            before=next(x for x in rows if x['kind']=='before-reap' and x['pid']==task)
            self.assertEqual(before['kind'],'before-reap')
            self.assertLess(consumed['sequence'],retirement['sequence'])
            self.assertLess(retirement['sequence'],before['sequence'])
            self.assertEqual(reaped['status'],15)
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['exit'],0)
            self.assertFalse(drain['kernelForkLineageComplete'])
            self.assertEqual([x['pid'] for x in drain['unresolvedLineage']],[task])
            barrier=json.loads((run/'retirement-cont-barrier.json').read_text())
            self.assertEqual(barrier['durableSequence'],retirement['sequence'])

    def test_late_lineage_refuses_observed_pid_reuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(os.environ.get('CUSTODY_REUSE_EVIDENCE',tmp))
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture','--parked-reuse-fixture',str(run)],
                                  capture_output=True,text=True,timeout=12)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('PID reused before late lineage',result.stderr)
            rows=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            task=next(x['pid'] for x in rows if x['kind']=='unlinked-exit-retirement')
            self.assertTrue(any(x['kind']=='reaped' and x['pid']==task for x in rows))
            self.assertFalse(any(x['kind']=='fork-lineage' and x['pid']==task for x in rows))

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
            self.assertNotEqual(result.returncode,0)
            self.assertIn('unresolved kernel lineage',result.stderr)
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


class ContinueRace(unittest.TestCase):
    def model(self, module, run, *, mode='exit', request=kernel.CONT):
        # Captured PID/start/TGID and EXIT stop, then legal terminal waits.
        # No sampled absence is used to manufacture a wait status.
        from types import SimpleNamespace
        root, task = 18259, 18349
        def stop(pid, sig, event=0):
            return SimpleNamespace(si_pid=pid, si_code=os.CLD_TRAPPED,
                                   si_status=(event << 8)|sig), (event << 16)|(sig << 8)|0x7f
        def exit(pid):
            return SimpleNamespace(si_pid=pid, si_code=os.CLD_EXITED,si_status=0), 0
        events=[stop(root,19),stop(root,5,1),
                stop(task,15 if mode=='signal' else 5,0 if mode=='signal' else (4 if mode in ('exec','exec-reidentity') else 6))]
        if mode not in ('nonexit','missing','reuse','busy','exec-reidentity'):
            events += ([stop(task,17)] if mode=='superseded' else []) + [exit(task),exit(root)]
        calls=[]; failed=[]; retired=set(); ticks=[100.0]
        def now():
            ticks[0]+=.5 if mode=='busy' and failed else .01
            return ticks[0]
        def peek(*args):
            if events:return events[0][0]
            if mode=='busy':
                events.append(stop(root,17)); return events[0][0]
            if mode=='nonexit':return None
            raise ChildProcessError()
        def consume(pid,flags):
            value,status=events.pop(0);self.assertEqual(value.si_pid,pid)
            if os.WIFEXITED(status) or os.WIFSIGNALED(status):retired.add(pid)
            return pid,status
        def identify(pid):
            if pid in retired:raise FileNotFoundError()
            if failed and pid==task and mode in ('missing','identity-gone'):raise FileNotFoundError()
            return dict(pid=pid,start=('reused' if failed and pid==task and mode=='reuse' else str(pid)),
                        ppid=root,state='t',tgid=18271 if pid==task else root)
        def trace(req,pid,addr=0,data=0):
            calls.append((req,pid,data))
            if req==module.GETEVENTMSG:
                ctypes.c_ulong.from_address(data).value=task if pid==root else (999 if mode=='exec-reidentity' else task)
            if pid==task and req==request and not failed and mode!='exec-reidentity':
                failed.append(pid)
                if mode=='reuse':events.append(exit(task))
                raise ProcessLookupError(3,'No such process',str(pid))
            return 0
        with patch.object(module.os,'fork',return_value=root),patch.object(module.libc,'prctl',return_value=0), \
             patch.object(module.os,'waitid',side_effect=peek),patch.object(module.os,'waitpid',side_effect=consume), \
             patch.object(module,'identity',side_effect=identify),patch.object(module,'ptrace',side_effect=trace), \
             patch.object(module.os,'kill') as kill,patch.object(module.time,'time',side_effect=now),patch.object(module.time,'sleep'):
            try:module.supervise(run,['fixture'],deadline=101,cleanup_deadline=103)
            finally:
                (Path(run)/'kill-calls.json').write_text(json.dumps(kill.call_args_list,default=str))
        return calls

    def test_exact_historical_cont_failure_and_fixed_reap(self):
        import types, hashlib
        sha='275dd018aad23b8e2988a78033cddaa2e25d8df3'
        data=subprocess.check_output(['git','show',sha+':tools/native_kernel_custody.py'])
        self.assertEqual(hashlib.sha256(data).hexdigest(),
                         'e5331081845bba9875f4e47fcb17f815945cc0c4455b5657f0678cd3626d5b7c')
        historical=types.ModuleType('historical');exec(compile(data,sha,'exec'),historical.__dict__)
        shared=types.ModuleType('shared_before')
        shared_sha='2486507db075ef7d350c83666fd098cb31a5191e'
        exec(compile(subprocess.check_output(['git','show',shared_sha+':tools/native_kernel_custody.py']),shared_sha,'exec'),shared.__dict__)
        for name,module in [('historical',historical),('shared-before',shared),('fixed',kernel)]:
            with tempfile.TemporaryDirectory() as tmp:
                run=Path(os.environ.get('CUSTODY_RACE_EVIDENCE',tmp))/name;run.mkdir(parents=True,exist_ok=True)
                if name!='fixed':
                    with self.assertRaises(ProcessLookupError):self.model(module,run)
                else:self.model(module,run)
                drain=json.loads((run/'kernel-drain.json').read_text())
                if name!='fixed':
                    self.assertIsNone(drain['exit']);self.assertEqual(drain['reaped'],[])
                    self.assertNotEqual((run/'kill-calls.json').read_text(),'[]')
                else:
                    self.assertEqual(drain['exit'],0);self.assertEqual(len(drain['reaped']),2)
                    self.assertEqual(drain['unreaped'],[]);self.assertEqual(drain['unresolvedPtrace'],[])
                    self.assertEqual((run/'kill-calls.json').read_text(),'[]')
                    rows=[json.loads(x) for x in (run/'custody.ndjson').read_text().splitlines()]
                    pending=next(x for x in rows if x['kind']=='ptrace-esrch-pending')
                    reap=next(x for x in rows if x['kind']=='reaped' and x['pid']==18349)
                    resolved=next(x for x in rows if x['kind']=='ptrace-esrch-reconciled')
                    self.assertLess(pending['sequence'],reap['sequence']);self.assertLess(reap['sequence'],resolved['sequence'])
                    self.assertTrue(drain['kernelForkLineageComplete'])

    def test_signal_and_exec_message_esrch_reconcile_only_at_real_exit(self):
        for mode,request in [('signal',kernel.CONT),('exec',kernel.GETEVENTMSG),('superseded',kernel.CONT),('identity-gone',kernel.CONT)]:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as run:
                self.model(kernel,run,mode=mode,request=request)
                drain=json.loads((Path(run)/'kernel-drain.json').read_text())
                self.assertEqual(len(drain['reaped']),2);self.assertEqual(drain['unresolvedPtrace'],[])

    def test_nonexit_esrch_and_missing_wait_receipt_fail_closed(self):
        for mode,error in [('nonexit',TimeoutError),('missing',AssertionError),('reuse',AssertionError),('busy',TimeoutError)]:
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as run:
                with self.assertRaises(error):self.model(kernel,run,mode=mode)
                drain=json.loads((Path(run)/'kernel-drain.json').read_text())
                self.assertTrue(drain['unreaped']);self.assertTrue(drain['unresolvedPtrace'])
                self.assertIsNone(drain['exit'])

    def test_nonleader_exec_transition_refuses_without_losing_custody(self):
        with tempfile.TemporaryDirectory() as run:
            with self.assertRaisesRegex(AssertionError,'nonleader exec identity transition'):
                self.model(kernel,run,mode='exec-reidentity')
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertEqual(len(drain['unreaped']),2)
            self.assertEqual(drain['reaped'],[])

    def test_finite_native_cont_esrch_has_real_wait_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(os.environ.get('CUSTODY_NATIVE_RACE_EVIDENCE',tmp))
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture','--cont-race-fixture',str(run)],
                                  capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            rows=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            self.assertTrue(any(x['kind']=='ptrace-esrch-reconciled' for x in rows))
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertEqual(drain['exit'],0);self.assertEqual(drain['unreaped'],[])
            self.assertEqual(len(drain['owned']),len(drain['reaped']))

    def test_actual_nonzero_exit_is_retained_and_refused(self):
        with tempfile.TemporaryDirectory() as run:
            due=time.time()+3
            with self.assertRaisesRegex(AssertionError,'7'):
                kernel.supervise(run,['/bin/sh','-c','exit 7'],deadline=due,cleanup_deadline=due+1)
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertEqual(drain['exit'],7);self.assertEqual(drain['unreaped'],[])
            self.assertEqual(drain['reaped'][0]['status'],7<<8)

    def test_concurrent_native_exits_retain_every_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=os.environ.get('CUSTODY_CONCURRENT_EVIDENCE',tmp)
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture','--concurrent-exit-fixture',run],
                                  capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertEqual(len(drain['owned']),9);self.assertEqual(len(drain['reaped']),9)
            self.assertEqual(drain['unreaped'],[]);self.assertEqual(drain['remaining'],[])


def cont_race_fixture(run, concurrent=False):
    trace=kernel.ptrace;waitid=os.waitid;injected=[]
    def resume(request,pid,addr=0,data=0):
        if request==kernel.CONT and not injected:
            rows=[json.loads(s) for s in (Path(run)/'custody.ndjson').read_text().splitlines()]
            if rows[-1]['kind']=='pre-exit-stop':
                injected.append(pid)
                # Force the completion interleaving at the CONT boundary. Both
                # CONT calls, ESRCH and WNOWAIT are real kernel results; this
                # is a scheduling shim, not proof of the original kernel timing.
                trace(request,pid,addr,data)
                due=time.monotonic()+2
                while time.monotonic()<due:
                    value=waitid(os.P_PID,pid,os.WEXITED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
                    if value:break
                    time.sleep(.001)
                assert value and value.si_code==os.CLD_EXITED
                return trace(request,pid,addr,data)
        return trace(request,pid,addr,data)
    command=['/bin/true']
    if concurrent:
        command=[sys.executable,'-c',"import os; children=[]\nfor _ in range(8):\n p=os.fork()\n if p==0:os._exit(0)\n children.append(p)\nfor p in children:os.waitpid(p,0)"]
    with patch.object(kernel,'ptrace',side_effect=trace if concurrent else resume):
        due=time.time()+4
        kernel.supervise(run,command,deadline=due,cleanup_deadline=due+1)


def unseen_exit_fixture(run):
    # Real initial SIGSTOP is superseded before the supervisor first observes
    # this child. Only wait selection and SIGKILL scheduling are controlled;
    # WNOWAIT, waitpid and GETEVENTMSG all return actual kernel results.
    run=Path(run).resolve();waitid,waitpid=os.waitid,os.waitpid;trace=kernel.ptrace
    selected=[];reaped=[]
    def peek(which,pid,flags):
        if selected and not reaped:return waitid(os.P_PID,selected[0],flags)
        value=waitid(which,pid,flags)
        if value and value.si_code==os.CLD_TRAPPED and value.si_status==261 and not selected:
            child=ctypes.c_ulong();trace(kernel.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
            selected.append(child.value)
            due=time.time()+2
            while time.time()<due:
                initial=waitid(os.P_PID,child.value,flags)
                if initial:break
                time.sleep(.001)
            assert initial.si_code==os.CLD_TRAPPED and initial.si_status==19
            os.kill(child.value,9)
            while time.time()<due:
                exited=waitid(os.P_PID,child.value,flags)
                if exited and exited.si_status==1541:return exited
                time.sleep(.001)
            raise AssertionError('real first EXIT stop absent')
        return value
    def consume(pid,flags):
        result=waitpid(pid,flags)
        if selected and pid==selected[0] and result[0] and (os.WIFEXITED(result[1]) or os.WIFSIGNALED(result[1])):reaped.append(pid)
        return result
    def ptrace(request,pid,addr=0,data=0):
        if request==kernel.CONT and selected and pid==selected[0]:
            last=json.loads((run/'custody.ndjson').read_text().splitlines()[-1])
            assert last['kind']=='unlinked-exit-retirement'
            (run/'first-exit-cont-barrier.json').write_text(json.dumps(dict(pid=pid,durableSequence=last['sequence'])))
        return trace(request,pid,addr,data)
    command="import os,pathlib;p=os.fork();pathlib.Path(MARKER).write_text('ran') if p==0 else os.waitpid(p,0)".replace('MARKER',repr(str(run/'unlinked-userspace-ran')))
    with patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel,'ptrace',side_effect=ptrace):
        due=time.time()+4
        kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1)


def parked_fixture(run, fork_only=False, death_signal=9, reuse=False):
    if death_signal==15:
        return term_fixture(run)
    waitid,waitpid=os.waitid,os.waitpid
    selected=[];consumed=[];terminal=[];original=[]
    identify=kernel.identity
    def observed_identity(pid):
        if reuse and terminal and pid==selected[0]:
            # Actual kernel reaping/late fork event; only the subsequent /proc
            # observation is injected because forcing PID reuse is unsafe.
            return dict(original[0],start=original[0]['start']+'-reused')
        return identify(pid)
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
            original.append(identify(child.value))
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
            # A fatal signal to the creating thread group supersedes its pending
            # clone event while the new thread is still at its initial stop.
            os.kill(selected[0] if fork_only else selected[1],death_signal)
        return result
    command='''import os,threading,time
p=os.fork()
if p==0:
 threading.Thread(target=lambda:open(MARKER,'w').write('unlinked userspace ran')).start()
 time.sleep(30)
else:
 _,status=os.waitpid(p,0)
 assert os.WIFSIGNALED(status) and os.WTERMSIG(status)==DEATH_SIGNAL
'''
    command=command.replace('MARKER',repr(str(Path(run).resolve()/'unlinked-userspace-ran'))).replace('DEATH_SIGNAL',str(death_signal))
    if fork_only:
        command='import os,time;p=os.fork();time.sleep(30) if p==0 else os.waitpid(p,0)'
    with patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel,'identity',side_effect=observed_identity):
        due=time.time()+3
        kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1)


def term_fixture(run):
    # Fatal SIGTERM must first pass a real signal-delivery stop. Deliver it to
    # an already running sibling while the creator's second clone event waits.
    # Its group exit then supersedes that clone event, just as in the retained
    # producer trace. No status/GETEVENTMSG result is invented.
    run=Path(run).resolve()
    waitid,waitpid=os.waitid,os.waitpid
    ptrace,fsync=kernel.ptrace,os.fsync
    durable=[]
    def sync(fd):
        fsync(fd)
        durable[:]=[json.loads((run/'custody.ndjson').read_text().splitlines()[-1])]
    def trace(request,pid,addr=0,data=0):
        if request==kernel.CONT and selected and pid==selected[0] and delivered:
            assert durable[-1]['kind']=='unlinked-exit-retirement'
            (run/'retirement-cont-barrier.json').write_text(json.dumps(dict(pid=pid,durableSequence=durable[-1]['sequence'])))
        return ptrace(request,pid,addr,data)
    sibling=[];selected=[];consumed=[];delivered=[]
    def peek(which,pid,flags):
        if selected:
            target=sibling[0] if consumed and not delivered else selected[0]
            return waitid(os.P_PID,target,flags)
        value=waitid(which,pid,flags)
        if value and value.si_code==os.CLD_TRAPPED and value.si_status==19 and sibling and value.si_pid!=sibling[0]:
            row=kernel.identity(value.si_pid)
            if row['tgid']!=row['pid']:
                selected.extend([row['pid'],row['tgid']])
                return value
        if value and value.si_code==os.CLD_TRAPPED and value.si_status>>8==3:
            child=ctypes.c_ulong()
            kernel.ptrace(kernel.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
            if not sibling:
                sibling.append(child.value)
            else:
                selected.extend([child.value,value.si_pid])
                due=time.time()+2
                while time.time()<due:
                    stopped=waitid(os.P_PID,child.value,flags)
                    if stopped:return stopped
                    time.sleep(.001)
                raise AssertionError('second thread autoattach absent')
        return value
    def consume(pid,flags):
        result=waitpid(pid,flags)
        if selected and pid==selected[0] and result[0] and not consumed:
            consumed.append(pid)
            assert kernel.libc.tgkill(selected[1],sibling[0],15)==0
        if selected and pid==sibling[0] and result[0] and os.WIFSTOPPED(result[1]) and os.WSTOPSIG(result[1])==15:
            delivered.append(pid)
        if selected and pid==selected[0] and result[0] and (os.WIFEXITED(result[1]) or os.WIFSIGNALED(result[1])):
            selected.clear()
        return result
    command='''import os,threading,time,pathlib
p=os.fork()
if p==0:
 ready=threading.Event()
 def first():
  ready.set()
  time.sleep(30)
 threading.Thread(target=first).start()
 ready.wait()
 threading.Thread(target=lambda:pathlib.Path(MARKER).write_text('unlinked userspace ran')).start()
 time.sleep(30)
else:
 _,status=os.waitpid(p,0)
 assert os.WIFSIGNALED(status) and os.WTERMSIG(status)==15
'''.replace('MARKER',repr(str(run/'unlinked-userspace-ran')))
    with patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel.os,'fsync',side_effect=sync),patch.object(kernel,'ptrace',side_effect=trace):
        due=time.time()+3
        kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1)


if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--isolated-fixture':
        # A deliberately failing supervisor uses EXITKILL. Reap its adopted
        # fixture tasks here so the unittest process's own subreaper never
        # inherits unrelated zombies between kernel tests.
        assert kernel.libc.prctl(36,1,0,0,0)==0
        result=subprocess.run([sys.executable,__file__,*sys.argv[2:]])
        while True:
            try:os.waitpid(-1,0)
            except ChildProcessError:break
        sys.exit(result.returncode)
    elif len(sys.argv)>1 and sys.argv[1]=='--cont-race-fixture':cont_race_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--concurrent-exit-fixture':cont_race_fixture(sys.argv[2],True)
    elif len(sys.argv)>1 and sys.argv[1]=='--unseen-exit-fixture':unseen_exit_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-fixture':parked_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-term-fixture':parked_fixture(sys.argv[2],death_signal=15)
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-fork-fixture':parked_fixture(sys.argv[2],True)
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-reuse-fixture':parked_fixture(sys.argv[2],True,reuse=True)
    else:unittest.main()

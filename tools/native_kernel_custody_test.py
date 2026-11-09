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
import gzip
import hashlib
import signal
import zlib
import struct
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('kernel',Path(__file__).with_name('native_kernel_custody.py'))
kernel=importlib.util.module_from_spec(spec)
spec.loader.exec_module(kernel)


def journal_probe(module):
    """Observe recorded records without forcing retirement batches to disk."""
    rows=[];append=module.Journal.append
    def observe(stream,value,**options):
        result=append(stream,value,**options)
        if stream.path.name.startswith('custody.ndjson'):rows.append(dict(value))
        return result
    return rows,patch.object(module.Journal,'append',observe)


class RetirementService(unittest.TestCase):
    def test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes(self):
        for compression in (None,'gzip'):
            with self.subTest(compression=compression),tempfile.TemporaryDirectory() as tmp:
                journal=kernel.Journal(Path(tmp),compression)
                records=[dict(sequence=i,payload='x'*(300 if i==9 else 10)) for i in range(20)]
                sync=os.fsync
                with patch.object(journal,'MAX_PENDING_BYTES',256),patch.object(journal,'MAX_PENDING_RECORDS',3), \
                     patch.object(kernel.os,'fsync',wraps=sync) as synced:
                    for record in records:
                        journal.append(record,defer=True)
                        self.assertLessEqual(len(journal.pending),256)
                        self.assertLessEqual(journal.pending_records,3)
                    # Saturation is bounded synchronous backpressure, not loss.
                    self.assertGreater(synced.call_count,0)
                    self.assertLess(synced.call_count,len(records))
                    barrier=dict(sequence=20,kind='admission')
                    journal.append(barrier)
                    self.assertFalse(journal.pending)
                    prefix=journal.path.read_bytes()
                    if compression:prefix=zlib.decompressobj(31).decompress(prefix)
                    self.assertEqual([json.loads(s) for s in prefix.splitlines()],records+[barrier])
                    journal.close()
                data=journal.path.read_bytes()
                if compression:data=gzip.decompress(data)
                self.assertEqual([json.loads(s) for s in data.splitlines()],records+[barrier])
                self.assertEqual(hashlib.sha256(data).hexdigest(),journal.sha.hexdigest())
                self.assertEqual(len(data),journal.size)

    def test_failed_sync_is_sticky_at_saturation_admission_and_finalization(self):
        for compression in (None,'gzip'):
            for boundary in ('saturation','admission','final'):
                with self.subTest(compression=compression,boundary=boundary),tempfile.TemporaryDirectory() as tmp:
                    journal=kernel.Journal(Path(tmp),compression)
                    journal.append(dict(sequence=1),defer=True)
                    with patch.object(journal,'MAX_PENDING_RECORDS',1 if boundary=='saturation' else 4096), \
                         patch.object(kernel.os,'fsync',side_effect=OSError('injected durable service failure')):
                        with self.assertRaisesRegex(OSError,'durable service failure'):
                            if boundary=='final':journal.close()
                            else:journal.append(dict(sequence=2),defer=boundary=='saturation')
                    # Recovery of the storage call cannot turn a partial prefix
                    # into an accepted successful journal after an earlier error.
                    with self.assertRaisesRegex(OSError,'journal service failed'):
                        journal.append(dict(sequence=3))
                    with self.assertRaisesRegex(OSError,'journal service failed'):journal.close()
                    self.assertTrue(journal.raw.closed)

    def test_native_executable_cont_always_has_durable_ordered_prefix(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=Path(tmp);trace=kernel.ptrace;waitpid=os.waitpid
            rows,probe=journal_probe(kernel);last={};barriers=[];deferred=[]
            def consume(pid,flags):
                result=waitpid(pid,flags)
                if result[0]:last[pid]=result[1]
                return result
            def resume(request,pid,addr=0,data=0):
                if request==kernel.CONT:
                    prefix=zlib.decompressobj(31).decompress((run/'custody.ndjson.gz').read_bytes())
                    durable=[json.loads(s) for s in prefix.splitlines()]
                    if last[pid]>>16==6:
                        deferred.append(len(durable)<len(rows))
                        custody=next(r for r in durable if r['kind']=='custody' and r['pid']==pid)
                        self.assertLess(custody['sequence'],rows[-1]['sequence'])
                    else:
                        self.assertEqual(durable,rows)
                        barriers.append(pid)
                return trace(request,pid,addr,data)
            with probe,patch.object(kernel,'ptrace',side_effect=resume),patch.object(kernel.os,'waitpid',side_effect=consume):
                due=time.time()+5
                kernel.supervise(run,[sys.executable,'-c',
                    "import os;p=os.fork();os.execl('/bin/true','true') if p==0 else os.waitpid(p,0)"],
                    deadline=due,cleanup_deadline=due+2,journal_compression='gzip')
            self.assertTrue(barriers);self.assertTrue(any(deferred))
            final=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
            self.assertEqual(final,rows)
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertTrue(drain['complete'])
            self.assertEqual(len(drain['owned']),len(drain['reaped']))

    def test_failed_admission_service_contains_owned_tasks_before_cont(self):
        write=kernel.Journal.write
        def failed(stream,data):
            if b'fork-parent-release' in data:
                raise OSError('injected admission failure')
            return write(stream,data)
        # Reuse the wait model, including real ordered identity obligations;
        # this failure probe must not create or signal actual host processes.
        with tempfile.TemporaryDirectory() as tmp,patch.object(kernel.Journal,'write',failed):
            with self.assertRaisesRegex(OSError,'injected admission failure'):
                ContinueRace().model(kernel,tmp)
            drain=json.loads((Path(tmp)/'kernel-drain.json').read_text())
            self.assertFalse(drain['complete'])
            self.assertIn('injected admission failure',drain['failure'])
            self.assertTrue(drain['unreaped'])
            self.assertNotEqual((Path(tmp)/'kill-calls.json').read_text(),'[]')

    def test_final_sync_failure_cannot_accept_fully_reaped_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            sync=os.fsync
            def failed(fd):
                data=(Path(tmp)/'custody.ndjson').read_bytes()
                if b'"kind": "reaped", "pid": 18259' in data:
                    raise OSError('injected final durability failure')
                return sync(fd)
            with patch.object(kernel.os,'fsync',side_effect=failed):
                with self.assertRaisesRegex(OSError,'journal finalization failed'):
                    ContinueRace().model(kernel,tmp)
            drain=json.loads((Path(tmp)/'kernel-drain.json').read_text())
            self.assertEqual(len(drain['reaped']),2)
            self.assertFalse(drain['complete']);self.assertFalse(drain['journal']['closed'])
            self.assertIn('final durability failure',drain['journal']['error'])

    def test_gzip_footer_requires_its_own_successful_final_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            journal=kernel.Journal(Path(tmp),'gzip')
            journal.append(dict(sequence=1))
            sync=os.fsync
            def failed(fd):
                # The final footer is present in the OS cache; deliberately
                # reject its actual durability call, regardless of readability.
                gzip.decompress(journal.path.read_bytes())
                raise OSError('injected footer sync failure')
            with patch.object(kernel.os,'fsync',side_effect=failed):
                with self.assertRaisesRegex(OSError,'footer sync failure'):journal.close()
            self.assertTrue(journal.raw.closed)


class ParentLineage(unittest.TestCase):
    def test_native_nonleader_exec_transfers_only_kernel_bound_wait_obligation(self):
        for version in ('exec-before', 'fixed', 'exec-cancel', 'exec-fork'):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as tmp:
                base=Path(os.environ.get('CUSTODY_EXEC_EVIDENCE',tmp))
                run=Path(tempfile.mkdtemp(prefix=version+'-',dir=base))
                result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                    '--cancel-creators-fixture',str(run),'exec',version],capture_output=True,text=True,timeout=15)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                (run/'fixture-process.json').write_text(json.dumps(dict(wait=result.returncode,
                    stdout=result.stdout,stderr=result.stderr,stdoutEOF=True,stderrEOF=True,
                    witness='subprocess.run communicate returned with both captured pipes drained')))
                receipt=json.loads((run/'creator-waits.json').read_text())
                self.assertEqual(receipt['supervisorWait'],1 if version in ('exec-before','exec-cancel') else 0)
                self.assertEqual(receipt['watchdogWait'],-15)
                drain=json.loads((run/'kernel-drain.json').read_text())
                self.assertEqual(drain['complete'],version!='exec-before')
                rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                self.assertFalse((run/'watchdog-fired.json').exists())
                if version=='exec-before':
                    self.assertTrue(drain['unreaped'])
                    self.assertRegex(drain['failure'],'PID reused while in custody|nonleader exec identity transition')
                    self.assertTrue(json.loads((run/'isolated-waits.json').read_text())['adoptedWaits'])
                    continue
                self.assertEqual(len(drain['execTransfers']),1)
                transfer=drain['execTransfers'][0]
                by_sequence={r['sequence']:r for r in rows}
                witness=by_sequence[transfer['beforeConsumeSequence']]
                self.assertEqual(witness['siStatus'],1029)
                leader_exit=by_sequence[transfer['leaderExitSequence']]
                self.assertEqual(leader_exit['kind'],'pre-exit-stop')
                self.assertEqual((leader_exit['pid'],leader_exit['start']),(transfer['pid'],transfer['start']))
                barrier=json.loads((run/'exec-resume-barrier.json').read_text())
                self.assertEqual(barrier['transferSequence'],transfer['sequence'])
                self.assertEqual(drain['deadline'],json.loads((run/'kernel-armed.json').read_text())['deadline'])
                self.assertEqual(transfer['formerPid'],transfer['kernelMessage'])
                self.assertEqual(transfer['kernelEvent'],4)
                self.assertEqual(transfer['waitStatus'],(4<<16)|(signal.SIGTRAP<<8)|0x7f)
                self.assertNotEqual(transfer['formerPid'],transfer['pid'])
                former=next(r for r in drain['owned'] if r['pid']==transfer['formerPid'])
                self.assertEqual(former['start'],transfer['formerStart'])
                self.assertEqual(former['registeredSequence'],transfer['formerCustodySequence'])
                self.assertFalse(any(r['pid']==transfer['formerPid'] for r in drain['reaped']))
                successor=next(r for r in drain['reaped'] if r['pid']==transfer['pid'])
                self.assertEqual(successor['sequence'],transfer['reapSequence'])
                self.assertEqual(successor['start'],transfer['start'])
                self.assertLess(transfer['sequence'],successor['beforeReapSequence'])
                # Every other identity still needs its own actual terminal wait.
                self.assertEqual({r['pid'] for r in drain['owned']} - {transfer['formerPid']},
                                 {r['pid'] for r in drain['reaped']})
                for reap in drain['reaped']:
                    before=by_sequence[reap['beforeReapSequence']]
                    self.assertEqual((before['pid'],before['start']),(reap['pid'],reap['start']))
                    self.assertEqual(by_sequence[reap['sequence']]['status'],reap['status'])
                for key in ('unreaped','remaining','unresolvedPtrace','unresolvedResumes','unresolvedLineage'):
                    self.assertEqual(drain[key],[])
                self.assertEqual(bool(drain['cancellation']),version=='exec-cancel')
                self.assertTrue(drain['commandLog']['eof'])
                self.assertEqual(json.loads((run/'isolated-waits.json').read_text())['adoptedWaits'],[])
                for name in ('journal','commandLog'):
                    stream=drain[name];data=gzip.decompress((run/stream['path']).read_bytes())
                    self.assertEqual(hashlib.sha256(data).hexdigest(),stream['originalSha256'])
                    self.assertEqual(len(data),stream['originalBytes'])
                    self.assertTrue(stream['closed'])
                if version=='exec-fork':
                    self.assertEqual(len(drain['owned']),4)
                    self.assertTrue(any(r['status']==7<<8 for r in drain['reaped']))

    def test_native_exec_binding_refuses_reuse_unbound_message_and_missing_wait(self):
        for version, error in (('exec-reuse-former','former TID reused'),
                               ('exec-reuse-leader','PID reused at exec binding'),
                               ('exec-unbound','exec former TID not in custody'),
                               ('exec-missing-wait','immutable cleanup deadline')):
            with self.subTest(version=version), tempfile.TemporaryDirectory() as tmp:
                base=Path(os.environ.get('CUSTODY_EXEC_EVIDENCE',tmp))
                run=Path(tempfile.mkdtemp(prefix=version+'-',dir=base))
                result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                    '--cancel-creators-fixture',str(run),'exec',version],capture_output=True,text=True,timeout=15)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                drain=json.loads((run/'kernel-drain.json').read_text())
                self.assertFalse(drain['complete'])
                self.assertIn(error,drain['failure'])
                self.assertTrue(drain['unreaped'])
                self.assertEqual(json.loads((run/'creator-waits.json').read_text())['watchdogWait'],-15)
                self.assertFalse((run/'watchdog-fired.json').exists())
                if version=='exec-missing-wait':
                    transfer=drain['execTransfers'][0]
                    self.assertNotIn('reapSequence',transfer)
                    self.assertTrue({transfer['pid'],transfer['formerPid']} <= {r['pid'] for r in drain['unreaped']})
                else:self.assertEqual(drain['execTransfers'],[])

    def test_cancellation_cannot_resume_creator_ahead_of_other_pending_lineage(self):
        for kind in ('clone', 'fork', 'signal'):
            for version in ('before', 'fixed'):
                with self.subTest(kind=kind, version=version), tempfile.TemporaryDirectory() as tmp:
                    base=Path(os.environ.get('CUSTODY_RETIREMENT_EVIDENCE',tmp))
                    run=Path(tempfile.mkdtemp(prefix=kind+'-'+version+'-',dir=base))
                    result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                        '--cancel-creators-fixture',str(run),kind,version],capture_output=True,text=True,timeout=15)
                    self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                    (run/'fixture-process.json').write_text(json.dumps(dict(wait=result.returncode,
                        stdout=result.stdout,stderr=result.stderr,stdoutEOF=True,stderrEOF=True,
                        witness='subprocess.run communicate returned with both captured pipes drained')))
                    receipt=json.loads((run/'creator-waits.json').read_text())
                    self.assertEqual(receipt['supervisorWait'],1) # cancellation is never normal
                    self.assertEqual(receipt['watchdogWait'],-15)
                    self.assertFalse((run/'watchdog-fired.json').exists())
                    drain=json.loads((run/'kernel-drain.json').read_text())
                    barrier=json.loads((run/'pending-creators.json').read_text())
                    rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                    self.assertEqual(drain['complete'],version=='fixed')
                    self.assertEqual(drain['kernelForkLineageComplete'],version=='fixed')
                    self.assertTrue(drain['cancellation'])
                    self.assertEqual(drain['unreaped'],[])
                    self.assertEqual(drain['remaining'],[])
                    self.assertEqual(drain['unresolvedResumes'],[])
                    self.assertEqual(drain['unresolvedPtrace'],[])
                    self.assertTrue(drain['commandLog']['eof'])
                    by_sequence={r['sequence']:r for r in rows}
                    for reap in drain['reaped']:
                        witness=by_sequence[reap['beforeReapSequence']]
                        terminal=by_sequence[reap['sequence']]
                        self.assertEqual((witness['pid'],witness['start']),(reap['pid'],reap['start']))
                        self.assertLess(witness['sequence'],terminal['sequence'])
                        self.assertEqual(terminal['status'],reap['status'])
                    for name in ('journal','commandLog'):
                        stream=drain[name];data=gzip.decompress((run/stream['path']).read_bytes())
                        self.assertEqual(hashlib.sha256(data).hexdigest(),stream['originalSha256'])
                        self.assertEqual(len(data),stream['originalBytes'])
                        self.assertTrue(stream['closed'])
                    child=barrier['secondChild']
                    self.assertTrue(any(r['pid']==child for r in drain['reaped']))
                    if version=='fixed':
                        error=json.loads((run/'supervisor-error.json').read_text())['error']
                        self.assertTrue(error.startswith('InterruptedError('),error)
                        lineage=next(r for r in rows if r['kind'] in ('custody','fork-lineage') and
                            r['pid']==child and r.get('parentCustodian')==barrier['secondCreator'])
                        release=json.loads((run/'first-creator-resume.json').read_text())
                        self.assertLess(lineage['at'],release['at'])
                        signals=[r for r in rows if r['kind']=='cancellation-sent']
                        self.assertTrue(signals)
                        self.assertLess(lineage['sequence'],signals[0]['sequence'])
                    else:
                        self.assertIn(child,[r['pid'] for r in drain['unresolvedLineage']])

    def test_missing_proc_at_queued_resume_still_requires_actual_terminal_wait(self):
        identify=kernel.identity;calls=[]
        def observation(pid):
            if pid!=os.getpid():
                calls.append(pid)
                if len(calls)==3:raise FileNotFoundError('injected unavailable observation')
            return identify(pid)
        with tempfile.TemporaryDirectory() as tmp,patch.object(kernel,'identity',side_effect=observation):
            due=time.time()+2
            kernel.supervise(tmp,['/bin/true'],deadline=due,cleanup_deadline=due+1,
                journal_compression='gzip',command_compression='gzip')
            drain=json.loads((Path(tmp)/'kernel-drain.json').read_text())
            rows=[json.loads(s) for s in gzip.open(Path(tmp)/'custody.ndjson.gz','rt')]
            self.assertTrue(drain['complete'])
            self.assertEqual(len(drain['reaped']),1)
            self.assertEqual(drain['unresolvedResumes'],[])
            self.assertTrue(any(r['kind']=='identity-unavailable-before-resume' for r in rows))

    def test_native_group_exit_cannot_overtake_pending_creation(self):
        for mode in ('before', 'fixed', 'parked-before', 'parked-fixed', 'fork-before', 'fork-fixed'):
            fixed=mode.endswith('fixed')
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                base=Path(os.environ.get('CUSTODY_LINEAGE_EVIDENCE',tmp))
                run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
                result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                    '--parent-lineage-fixture',str(run),mode],capture_output=True,text=True,timeout=18)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                receipt=json.loads((run/'lineage-waits.json').read_text())
                self.assertEqual(receipt['supervisorWait'],0 if fixed else 1)
                self.assertEqual(receipt['watchdogWait'],-15)
                self.assertFalse((run/'watchdog-fired.json').exists())
                drain=json.loads((run/'kernel-drain.json').read_text())
                event=json.loads((run/'pending-creation.json').read_text())
                rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                self.assertEqual(event['siStatus'],261 if mode.startswith('fork') else 773)
                self.assertEqual(drain['complete'],fixed)
                self.assertEqual(drain['exit'],0)
                self.assertFalse(drain['untracedCloneFlagsAudited'])
                self.assertEqual(drain['remaining'],[])
                self.assertEqual(drain['unreaped'],[])
                self.assertEqual(drain['unresolvedPtrace'],[])
                child=event['child']
                self.assertTrue(any(r['pid']==child for r in drain['reaped']))
                lineage=[r for r in drain['owned'] if r['pid']==child][0]
                self.assertEqual(lineage['parentCustodian'],event['creator'] if fixed else None)
                self.assertEqual([r['pid'] for r in drain['unresolvedLineage']],[] if fixed else [child])
                if fixed:
                    capture=next(r for r in rows if r['kind']=='fork-parent-release' and r['child']==child)
                    self.assertLess(capture['at'],json.loads((run/'killer-resume.json').read_text())['at'])


class ExitCausality(unittest.TestCase):
    def run_case(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(os.environ.get('CUSTODY_CAUSALITY_EVIDENCE',tmp))
            run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                '--causality-fixture',str(run),mode],capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            receipt=json.loads((run/'causality-waits.json').read_text())
            self.assertEqual(receipt['watchdogWait'],-15)
            self.assertFalse((run/'watchdog-fired.json').exists())
            drain=json.loads((run/'kernel-drain.json').read_text())
            rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
            for key in ('journal','commandLog'):
                stream=drain[key];data=gzip.decompress((run/stream['path']).read_bytes())
                self.assertTrue(stream['closed'])
                self.assertEqual(stream['originalSha256'],hashlib.sha256(data).hexdigest())
                self.assertEqual(stream['originalBytes'],len(data))
            self.assertTrue(drain['commandLog']['eof'])
            self.assertEqual(drain['unreaped'],[])
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['unresolvedPtrace'],[])
            if mode=='multi-fixed':
                observed=json.loads((run/'native-multi-observation.json').read_text())
                self.assertFalse(observed['present'])
                self.assertEqual(len(observed['tids']),8)
                self.assertTrue(drain['complete'])
                self.assertEqual(drain['exit'],0)
                self.assertEqual(len(drain['owned']),9)
                for task in observed['tids']:
                    self.assertTrue(any(r['pid']==task and r['status']==0 for r in drain['reaped']))
            elif mode in ('exit-before','exit-fixed'):
                observed=json.loads((run/'native-observation.json').read_text())
                self.assertEqual(observed['present'],mode=='exit-before')
                self.assertEqual(observed['iterations']==30,mode=='exit-before')
                self.assertEqual(drain['exit'],42 if mode=='exit-before' else 0)
                task=observed['tid']
                stop=next(r for r in rows if r['kind']=='pre-exit-stop' and r['pid']==task)
                reap=next(r for r in rows if r['kind']=='reaped' and r['pid']==task)
                self.assertTrue(any(r['pid']==task for r in drain['reaped']))
                # A delayed thread zombie can inherit the later group exit
                # status. Keep the actual kernel receipt, not its exit-stop
                # message or the status we expected from the worker function.
                self.assertIn(reap['status'],(0,42<<8) if mode=='exit-before' else (0,))
                between=[r for r in rows if stop['sequence']<r['sequence']<reap['sequence']]
                if mode=='exit-fixed':
                    # CONT is nonblocking: one competing event may arrive
                    # before the final thread status becomes waitable.
                    self.assertLessEqual(sum(r['kind']=='fork-parent-release' for r in between),1)
                else:self.assertTrue(any(r['kind']=='fork-parent-release' for r in between))
            else:
                task=json.loads((run/'cancel-barrier.json').read_text())['child']
                lineage=[r for r in rows if r['kind']=='fork-lineage' and r['pid']==task]
                self.assertEqual(bool(lineage),mode=='cancel-fixed')
                self.assertEqual(drain['complete'],mode=='cancel-fixed')
                self.assertEqual(drain['kernelForkLineageComplete'],mode=='cancel-fixed')
                if lineage:
                    first_signal=next(r for r in rows if r['kind']=='cancellation-sent')
                    self.assertLess(lineage[0]['sequence'],first_signal['sequence'])
                else:
                    self.assertEqual([r['pid'] for r in drain['unresolvedLineage']],[task])

    def test_real_joined_thread_final_wait_precedes_creation_backlog(self):
        for mode in ('exit-before','exit-fixed'):
            with self.subTest(mode=mode):self.run_case(mode)

    def test_pending_real_fork_lineage_is_consumed_before_cancellation(self):
        for mode in ('cancel-before','cancel-fixed'):
            with self.subTest(mode=mode):self.run_case(mode)

    def test_eight_native_threads_exit_without_starving_each_other(self):self.run_case('multi-fixed')


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
            self.assertEqual(barrier['recordedSequence'],retirement['sequence'])
            self.assertEqual(barrier['durableCustodySequence'],retirement['custodySequence'])
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
            self.assertEqual(barrier['recordedSequence'],retirement['sequence'])
            self.assertEqual(barrier['durableCustodySequence'],retirement['custodySequence'])

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

    def test_exec_with_unowned_former_tid_refuses_without_losing_custody(self):
        with tempfile.TemporaryDirectory() as run:
            with self.assertRaisesRegex(AssertionError,'exec former TID not in custody'):
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


class SupersededResume(unittest.TestCase):
    def test_real_group_exit_and_exec_replace_queued_stop(self):
        for kind in ('normal', 'cancel', 'exec'):
            for version in ('before', 'fixed'):
                with self.subTest(kind=kind, version=version), tempfile.TemporaryDirectory() as tmp:
                    base=Path(os.environ.get('CUSTODY_QUEUED_EVIDENCE',tmp))
                    run=Path(tempfile.mkdtemp(prefix=kind+'-'+version+'-',dir=base))
                    result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                        '--queued-stop-fixture',str(run),kind,version],capture_output=True,text=True,timeout=15)
                    (run/'fixture-process.json').write_text(json.dumps(dict(wait=result.returncode,
                        stdout=result.stdout,stderr=result.stderr,stdoutEOF=True,stderrEOF=True)))
                    self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                    waits=json.loads((run/'queued-waits.json').read_text())
                    self.assertEqual(waits['watchdogWait'],-15)
                    self.assertFalse((run/'watchdog-fired.json').exists())
                    barrier=json.loads((run/'queued-barrier.json').read_text())
                    self.assertEqual(barrier['siStatus'],1541) # actual PTRACE_EVENT_EXIT
                    drain=json.loads((run/'kernel-drain.json').read_text())
                    rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                    cont=json.loads((run/'queued-cont.json').read_text())
                    self.assertEqual(cont['pendingStatus'],1541 if version=='before' else None)
                    actual=json.loads((run/'actual-waits.json').read_text())
                    exit_waits=[r for r in actual if r['pid']==barrier['pid'] and
                        os.WIFSTOPPED(r['status']) and r['status']>>16==6 and r['at']<cont['at']]
                    self.assertEqual(len(exit_waits),int(version=='fixed'))
                    exits=[r for r in rows if r['kind']=='pre-exit-stop' and r['pid']==barrier['pid']]
                    self.assertEqual(bool(exits),version=='fixed')
                    self.assertEqual(drain['complete'],not(kind=='exec' and version=='before'))
                    self.assertEqual(waits['supervisorWait'],int(kind=='cancel' or (kind=='exec' and version=='before')))
                    if kind=='exec' and version=='before':
                        self.assertIn('unbound nonleader exec',drain['failure'])
                        self.assertTrue(drain['unreaped'])
                        continue
                    self.assertEqual(drain['unresolvedLineage'],[])
                    for key in ('remaining','unreaped','unresolvedPtrace','unresolvedResumes'):
                        self.assertEqual(drain[key],[])
                    self.assertTrue(drain['commandLog']['eof'])
                    self.assertEqual(bool(drain['cancellation']),kind=='cancel')
                    self.assertEqual(len(drain['execTransfers']),int(kind=='exec'))
                    by_sequence={r['sequence']:r for r in rows}
                    for receipt in drain['reaped']:
                        witness=by_sequence[receipt['beforeReapSequence']]
                        self.assertEqual((receipt['pid'],receipt['start']),(witness['pid'],witness['start']))
                        self.assertEqual(receipt['status'],by_sequence[receipt['sequence']]['status'])
                    for key in ('journal','commandLog'):
                        receipt=drain[key];data=gzip.decompress((run/receipt['path']).read_bytes())
                        self.assertEqual(hashlib.sha256(data).hexdigest(),receipt['originalSha256'])
                        self.assertEqual(len(data),receipt['originalBytes'])
                        self.assertTrue(receipt['closed'])
                    self.assertEqual(json.loads((run/'isolated-waits.json').read_text())['adoptedWaits'],[])


def queued_stop_fixture(run,kind,version):
    """Replace a consumed stop with a real EXIT before its queued CONT.

    The parent forks a multithread child. Its running nonleader terminates the
    group or execs while the leader is stopped; no wait result is synthesized.
    """
    run=Path(run).resolve()
    source=r'''
#include <pthread.h>
#include <unistd.h>
#include <signal.h>
#include <fcntl.h>
#include <sys/wait.h>
#include <string.h>
static int do_exec;
static void *actor(void *p) {
  close(creat("actor-ready",0600));
  while(access("terminate",F_OK))usleep(1000);
  if(do_exec) { execl("/bin/true","true",(char *)0);_exit(87); }
  _exit(0);
}
int main(int argc,char **argv) {
  if(chdir(argv[1]))return 80;
  do_exec=!strcmp(argv[2],"exec");
  pid_t child=fork();if(child<0)return 81;
  if(child) { int status;return waitpid(child,&status,0)==child && status==0?0:82; }
  pthread_t t;if(pthread_create(&t,0,actor,0))return 83;
  while(access("actor-ready",F_OK))usleep(1000);
  raise(SIGUSR1);
  return 84;
}
'''
    with tempfile.TemporaryDirectory() as tmp:
        c=Path(tmp)/'fixture.c';binary=Path(tmp)/'fixture'
        c.write_text(source)
        subprocess.run(['cc','-O2','-pthread',str(c),'-o',str(binary)],check=True,timeout=10)
        (run/'native-inputs.json').write_text(json.dumps(dict(inputs=[dict(name=p.name,
            size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (c,binary)],
            recovery='Regenerate queued_stop_fixture from Git; cc -O2 -pthread fixture.c -o fixture.')))
        gate_read,gate_write=os.pipe()
        supervisor=os.fork()
        if supervisor==0:
            os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
            module=kernel
            if version=='before':
                import types
                revision='9ab247857d0f5b341d2502d8b7191a20b4dfd762'
                data=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
                assert hashlib.sha256(data).hexdigest()=='a2d9ca6f74bdb193e017c3b340a450ee0b0b13736030e0d512ff500b26fda9b3'
                module=types.ModuleType('before');exec(compile(data,revision,'exec'),module.__dict__)
            waitpid,waitid,trace=os.waitpid,os.waitid,module.ptrace
            selected=[];actual=[]
            def consume(task,flags):
                result=waitpid(task,flags)
                if result[0]:actual.append(dict(pid=result[0],status=result[1],at=time.time()))
                if result[0] and os.WIFSTOPPED(result[1]) and os.WSTOPSIG(result[1])==signal.SIGUSR1:
                    assert not selected
                    selected.append(task)
                    (run/'terminate').write_text('1')
                    due=time.monotonic()+2
                    while time.monotonic()<due:
                        value=waitid(os.P_PID,task,os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
                        if value and value.si_code==os.CLD_TRAPPED and value.si_status==1541:
                            (run/'queued-barrier.json').write_text(json.dumps(dict(pid=task,
                                siStatus=value.si_status,at=time.time(),consumedStatus=result[1])))
                            if kind=='cancel':os.kill(os.getpid(),signal.SIGTERM)
                            break
                        time.sleep(.001)
                    else:raise AssertionError('real replacement EXIT stop missing')
                return result
            def resume(request,task,addr=0,data=0):
                if request==module.CONT and selected==[task] and not (run/'queued-cont.json').exists():
                    value=waitid(os.P_PID,task,os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
                    (run/'queued-cont.json').write_text(json.dumps(dict(pid=task,signal=data,
                        pendingStatus=value.si_status if value else None,at=time.time())))
                return trace(request,task,addr,data)
            try:
                with patch.object(module.os,'waitpid',side_effect=consume),patch.object(module,'ptrace',side_effect=resume):
                    due=time.time()+6
                    module.supervise(run,[str(binary),str(run),kind],deadline=due,cleanup_deadline=due+1,
                        journal_compression='gzip',command_compression='gzip')
            except BaseException as error:
                (run/'actual-waits.json').write_text(json.dumps(actual))
                (run/'supervisor-error.json').write_text(json.dumps(dict(error=repr(error))))
                os._exit(1)
            (run/'actual-waits.json').write_text(json.dumps(actual))
            os._exit(0)
        watchdog=os.fork()
        if watchdog==0:
            os.close(gate_read);os.close(gate_write)
            start=kernel.identity(supervisor)['start']
            (run/'watchdog-armed.json').write_text(json.dumps(dict(target=supervisor,start=start,deadline=time.time()+10)))
            time.sleep(10)
            try:
                if kernel.identity(supervisor)['start']==start:os.kill(supervisor,9)
            except (FileNotFoundError,ProcessLookupError):pass
            (run/'watchdog-fired.json').write_text('{}');os._exit(0)
        os.close(gate_read)
        while not (run/'watchdog-armed.json').exists():time.sleep(.001)
        os.write(gate_write,b'1');os.close(gate_write)
        _,status=os.waitpid(supervisor,0)
        os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
        (run/'queued-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
            watchdogWait=os.waitstatus_to_exitcode(watch_status))))


class PendingOutputWait(unittest.TestCase):
    def test_pending_native_exit_precedes_durable_command_output(self):
        for mode in ('before', 'fixed', 'nonzero'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                base=Path(os.environ.get('CUSTODY_OUTPUT_WAIT_EVIDENCE',tmp))
                run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
                result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                    '--output-wait-fixture',str(run),mode],capture_output=True,text=True,timeout=65)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                (run/'fixture-process.json').write_text(json.dumps(dict(wait=result.returncode,
                    stdout=result.stdout,stderr=result.stderr,stdoutEOF=True,stderrEOF=True,
                    witness='subprocess.run communicate returned with both captured pipes drained')))
                self.assertEqual(json.loads((run/'isolated-waits.json').read_text())['adoptedWaits'],[])
                drain=json.loads((run/'kernel-drain.json').read_text())
                barrier=json.loads((run/'output-wait-barrier.json').read_text())
                terminal=json.loads((run/'node-terminal.json').read_text())
                close=json.loads((run/'node-close.json').read_text())
                self.assertTrue(drain['complete'])
                self.assertTrue(drain['commandLog']['eof'])
                self.assertTrue(terminal['stdoutEOF']);self.assertTrue(terminal['stderrEOF'])
                long_stall=barrier['stallSeconds']>18
                if mode!='before' or not long_stall:
                    self.assertEqual(terminal['code'],1 if mode=='nonzero' else 0)
                    self.assertIsNone(terminal['signal'])
                self.assertEqual(close['normal'],mode!='nonzero' and not (mode=='before' and long_stall))
                if mode=='before' and long_stall:
                    self.assertFalse(close['drained'])
                    self.assertIsNone(close['terminal'])
                    self.assertFalse(close['stdoutEOF']);self.assertFalse(close['stderrEOF'])
                    self.assertEqual([r['signal'] for r in close['signals']],['SIGTERM','SIGKILL'])
                else:self.assertTrue(close['drained'])
                self.assertEqual(barrier['stalled'],mode=='before')
                self.assertGreater(barrier['releaseDelay'],barrier['stallSeconds']*.9 if mode=='before' else 0)
                if mode!='before':self.assertLess(barrier['releaseDelay'],.5)
                rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                reap=next(r for r in drain['reaped'] if r['pid']==barrier['pid'])
                if mode!='before' or not long_stall:self.assertEqual(reap['status'],256 if mode=='nonzero' else 0)
                before=next(r for r in rows if r['sequence']==reap['beforeReapSequence'])
                self.assertEqual(before['pid'],barrier['pid'])
                self.assertFalse((run/'watchdog-fired.json').exists())
                self.assertEqual(json.loads((run/'output-wait-waits.json').read_text())['watchdogWait'],-15)
                for key in ('journal','commandLog'):
                    receipt=drain[key];data=gzip.decompress((run/receipt['path']).read_bytes())
                    self.assertEqual(hashlib.sha256(data).hexdigest(),receipt['originalSha256'])


def output_wait_fixture(run,mode):
    # Real Node parent, native ELF child and separate child pipes. A fixed
    # storage-stall injection starts only while a witnessed kernel EXIT stop
    # still holds those writers open. No wait result or EOF is manufactured.
    run=Path(run).resolve();gate_read,gate_write=os.pipe()
    supervisor=os.fork()
    if supervisor==0:
        os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
        module=kernel
        if mode=='before':
            import types
            revision='2df8d81b41da78ac0ab846137cf4137f0f1c4a86'
            source=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
            module=types.ModuleType('published');exec(compile(source,revision,'exec'),module.__dict__)
        trace,waitpid,waitid=module.ptrace,os.waitpid,os.waitid
        write=module.Journal.write;selected=[];last={};barrier={}
        flags=os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL
        stall=float(os.environ.get('CUSTODY_OUTPUT_WAIT_STALL','0.25'))
        def consume(task,options):
            result=waitpid(task,options)
            if result[0]:last[task]=result[1]
            return result
        def resume(request,task,addr=0,data=0):
            status=last.get(task,0)
            if request==module.CONT and status>>16==6 and selected and task==selected[0]:
                barrier['releaseDelay']=time.monotonic()-barrier['pendingAt']
                (run/'output-wait-barrier.json').write_text(json.dumps(barrier))
            result=trace(request,task,addr,data)
            if request==module.CONT and status>>16==4 and not selected:
                try:exe=os.readlink('/proc/'+str(task)+'/exe')
                except FileNotFoundError:exe=''
                if exe in ('/usr/bin/true','/usr/bin/false'):
                    selected.append(task)
                    due=time.monotonic()+2
                    while time.monotonic()<due:
                        value=waitid(os.P_PID,task,flags)
                        if value and value.si_code==os.CLD_TRAPPED and value.si_status==1541:break
                        time.sleep(.001)
                    else:raise AssertionError('native pending EXIT stop missing')
                    # Let the running Node parent fill command output while
                    # its child remains at the actual pre-exit barrier.
                    time.sleep(.05)
                    barrier.update(pid=task,pendingAt=time.monotonic(),stallSeconds=stall,stalled=False,
                        siCode=value.si_code,siStatus=value.si_status)
            return result
        def durable(stream,data):
            if selected and stream.path.name=='kernel-command.log.gz' and 'releaseDelay' not in barrier and not barrier['stalled']:
                value=waitid(os.P_PID,selected[0],flags)
                assert value and value.si_status==1541
                barrier['stalled']=True
                time.sleep(stall)
            return write(stream,data)
        script=r'''const fs=require('fs'),cp=require('child_process');
const run=process.argv[1],child=cp.spawn(process.argv[2],[],{stdio:['ignore','pipe','pipe']});
const began=Date.now(),state={stdoutEOF:false,stderrEOF:false};
// The committed regression has no dependency on released Warcraft WIP. The
// retained actual adapter can also be selected explicitly for the 18s control.
const observer=process.argv[3]?require(process.argv[3]).observe(child,{deadline:Date.now()+45000,
 record:r=>fs.appendFileSync(run+'/node-lifecycle.jsonl',JSON.stringify(r)+'\n')}):
 {close:()=>new Promise(resolve=>child.once('close',(code,signal)=>resolve({normal:code===0&&signal===null,drained:true})))};
child.stdout.resume();child.stderr.resume();
child.stdout.on('end',()=>state.stdoutEOF=true);child.stderr.on('end',()=>state.stderrEOF=true);
const load=setInterval(()=>process.stdout.write(Buffer.alloc(4096,120)),1);
child.on('close',(code,signal)=>{clearInterval(load);fs.writeFileSync(run+'/node-terminal.json',JSON.stringify({...state,code,signal,elapsedMs:Date.now()-began}));});'''
        script+="\nobserver.close(()=>Promise.resolve()).then(r=>fs.writeFileSync(run+'/node-close.json',JSON.stringify(r)));"
        try:
            with patch.object(module,'ptrace',side_effect=resume),patch.object(module.os,'waitpid',side_effect=consume),patch.object(module.Journal,'write',durable):
                due=time.time()+50
                module.supervise(run,['node','-e',script,str(run),'/bin/false' if mode=='nonzero' else '/bin/true',
                    os.environ.get('CUSTODY_OUTPUT_WAIT_ADAPTER','')],
                    deadline=due,cleanup_deadline=due+5,journal_compression='gzip',command_compression='gzip')
        except BaseException as error:
            (run/'supervisor-error.json').write_text(repr(error));os._exit(1)
        os._exit(0)
    watchdog=os.fork()
    if watchdog==0:
        os.close(gate_read);os.close(gate_write)
        start=kernel.identity(supervisor)['start']
        (run/'watchdog-armed.json').write_text(json.dumps(dict(pid=supervisor,start=start,deadline=time.time()+60)))
        time.sleep(60)
        try:
            if kernel.identity(supervisor)['start']==start:os.kill(supervisor,9)
        except (FileNotFoundError,ProcessLookupError):pass
        (run/'watchdog-fired.json').write_text('{}');os._exit(0)
    os.close(gate_read)
    while not (run/'watchdog-armed.json').exists():time.sleep(.001)
    os.write(gate_write,b'1');os.close(gate_write)
    _,status=os.waitpid(supervisor,0)
    os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
    (run/'output-wait-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
        watchdogWait=os.waitstatus_to_exitcode(watch_status))))
    assert os.waitstatus_to_exitcode(status)==0


class CompressedCommand(unittest.TestCase):
    def test_exact_selected_predecessor_cannot_compress_command_output(self):
        import types
        revision='d8573b542dc437d6a2e6aeff0c3f3ed7c006a8de'
        source=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
        self.assertEqual(hashlib.sha256(source).hexdigest(),'5fb6488ef45f394ce871507528cb7cce48507b07eb5cf73f25a7becfaedd16b5')
        previous=types.ModuleType('previous');exec(compile(source,revision,'exec'),previous.__dict__)
        with tempfile.TemporaryDirectory() as run,patch.object(previous.os,'fork') as fork:
            with self.assertRaisesRegex(TypeError,'command_compression'):
                previous.supervise(run,['/bin/true'],deadline=time.time()+1,cleanup_deadline=time.time()+2,
                    journal_compression='gzip',command_compression='gzip')
            fork.assert_not_called()

    def run_case(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(os.environ.get('CUSTODY_COMMAND_EVIDENCE',tmp))
            run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                '--command-gzip-fixture',str(run),mode],capture_output=True,text=True,timeout=12)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertTrue(drain['complete'])
            self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['unreaped'],[])
            receipt=drain['commandLog']
            self.assertTrue(receipt['closed']);self.assertTrue(receipt['eof'])
            self.assertFalse((run/'kernel-command.log').exists())
            data=gzip.decompress((run/'kernel-command.log.gz').read_bytes())
            expected=(b'begin\x00\xff\n'+b'x'*2097152+b'unique-stderr\n') if mode=='bulk' else b'adopted-after-root\n'
            self.assertEqual(data,expected)
            self.assertEqual(receipt['originalBytes'],len(data))
            self.assertEqual(receipt['originalSha256'],hashlib.sha256(data).hexdigest())
            journal=gzip.decompress((run/'custody.ndjson.gz').read_bytes())
            self.assertEqual(drain['journal']['originalSha256'],hashlib.sha256(journal).hexdigest())

    def test_output_larger_than_pipe_is_lossless_binary_gzip_from_outset(self):self.run_case('bulk')
    def test_adopted_writer_after_root_exit_reaches_actual_eof(self):self.run_case('adopted')

    def test_invalid_compression_refuses_before_any_process(self):
        with tempfile.TemporaryDirectory() as run,patch.object(kernel.os,'fork') as fork,patch.object(kernel.libc,'prctl') as prctl:
            with self.assertRaisesRegex(ValueError,'command_compression'):
                kernel.supervise(run,['false'],deadline=time.time()+1,cleanup_deadline=time.time()+2,command_compression='zip')
            fork.assert_not_called();prctl.assert_not_called()

    def test_no_pipe_eof_cannot_be_promoted_from_all_terminal_waits(self):
        with tempfile.TemporaryDirectory() as run,patch.object(kernel.os,'read',side_effect=BlockingIOError()):
            due=time.time()+.1
            with self.assertRaisesRegex(TimeoutError,'immutable cleanup'):
                kernel.supervise(run,['/bin/true'],deadline=due,cleanup_deadline=due+.15,
                    journal_compression='gzip',command_compression='gzip')
            drain=json.loads((Path(run)/'kernel-drain.json').read_text())
            self.assertFalse(drain['complete']);self.assertFalse(drain['commandLog']['eof'])
            self.assertTrue(drain['commandLog']['closed']);self.assertEqual(drain['unreaped'],[])


def command_gzip_fixture(run,mode):
    due=time.time()+5
    command=("import os;os.write(1,b'begin\\x00\\xff\\n'+b'x'*2097152);os.write(2,b'unique-stderr\\n')"
        if mode=='bulk' else "import os,time;p=os.fork();os._exit(0) if p else None;time.sleep(.05);os.write(1,b'adopted-after-root\\n')")
    kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+2,
        journal_compression='gzip',command_compression='gzip')


class TerminalAdoption(unittest.TestCase):
    def test_real_tracer_wait_then_adopted_parent_wait(self):
        for mode in ('historical', 'adopt', 'adopt-gzip', 'adopt-signal', 'parent-wait', 'bad-status', 'third-receipt'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as tmp:
                base=Path(os.environ.get('CUSTODY_TERMINAL_EVIDENCE',tmp))
                run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
                result=subprocess.run([sys.executable,__file__,'--isolated-fixture',
                    '--terminal-fixture',str(run),mode],capture_output=True,text=True,timeout=12)
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                drain=json.loads((run/'kernel-drain.json').read_text())
                rows=[json.loads(s) for s in gzip.open(run/'custody.ndjson.gz','rt')]
                receipt=json.loads((run/'terminal-fixture-waits.json').read_text())
                self.assertFalse((run/'watchdog-fired.json').exists())
                self.assertEqual(receipt['watchdogWait'],-15)
                success=mode in ('adopt','adopt-gzip','adopt-signal','parent-wait')
                self.assertEqual(drain['complete'],success)
                self.assertEqual(receipt['supervisorWait'],0 if success else 1)
                if not success:
                    self.assertIn('duplicate terminal receipt',drain['failure'])
                    continue
                self.assertEqual(drain['remaining'],[]);self.assertEqual(drain['unreaped'],[])
                if mode=='adopt-gzip':
                    self.assertTrue(drain['commandLog']['closed']);self.assertTrue(drain['commandLog']['eof'])
                    output=gzip.decompress((run/'kernel-command.log.gz').read_bytes())
                    # Python may warn about this deliberately multithreaded
                    # fork. Preserve its real stderr instead of assuming silence.
                    self.assertEqual(drain['commandLog']['originalBytes'],len(output))
                    self.assertEqual(drain['commandLog']['originalSha256'],hashlib.sha256(output).hexdigest())
                    self.assertFalse((run/'kernel-command.log').exists())
                adoptions=[r for r in rows if r['kind']=='adopted-reaped']
                self.assertEqual(len(adoptions),1 if mode.startswith('adopt') else 0)
                for adoption in adoptions:
                    first=next(r for r in rows if r['sequence']==adoption['tracerReapSequence'])
                    before=next(r for r in rows if r['sequence']==adoption['beforeReapSequence'])
                    self.assertEqual(first['status'],15 if mode=='adopt-signal' else 7<<8)
                    self.assertEqual(first['start'],adoption['start'])
                    self.assertNotEqual(first['terminalParent'],adoption['terminalParent'])
                    self.assertEqual(before['ppid'],adoption['terminalParent'])
                    self.assertLess(first['sequence'],before['sequence'])
                    self.assertLess(before['sequence'],adoption['sequence'])


class CompressedCancellation(unittest.TestCase):
    def run_case(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(os.environ.get('CUSTODY_GZIP_EVIDENCE',tmp))
            run=Path(tempfile.mkdtemp(prefix=mode+'-',dir=base))
            # Outer process is a subreaper. Its isolated group and subprocess
            # timeout are independent of the supervisor's cleanup deadline.
            result=subprocess.run([sys.executable,__file__,'--isolated-fixture','--gzip-fixture',str(run),mode],
                                  capture_output=True,text=True,timeout=8,start_new_session=True)
            receipt=json.loads((run/'fixture-wait.json').read_text())
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertTrue((run/'watchdog-armed.json').exists())
            self.assertFalse((run/'watchdog-fired.json').exists())
            self.assertEqual(receipt['watchdogWait'],-signal.SIGTERM)
            stored=(run/'custody.ndjson.gz').read_bytes()
            prefix=zlib.decompressobj(31);data=prefix.decompress(stored)
            self.assertFalse((run/'custody.ndjson').exists())
            rows=[json.loads(s) for s in data.splitlines()]
            self.assertTrue(rows)
            if mode in ('hard-kill','legacy-term'):
                self.assertEqual(receipt['supervisorWait'],-(signal.SIGKILL if mode=='hard-kill' else signal.SIGTERM))
                self.assertFalse(prefix.eof)
                self.assertFalse((run/'kernel-drain.json').exists())
                with self.assertRaises(EOFError):gzip.decompress(stored)
                self.assertEqual(receipt['validation'],'INCOMPLETE: missing footer and drain')
                return
            self.assertTrue(prefix.eof)
            self.assertEqual(gzip.decompress(stored),data)
            self.assertEqual(struct.unpack('<II',stored[-8:]),(zlib.crc32(data),len(data) & 0xffffffff))
            if mode=='normal':
                corrupt=stored[:-8]+bytes([stored[-8]^1])+stored[-7:]
                with self.assertRaises(gzip.BadGzipFile):gzip.decompress(corrupt)
            drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertEqual(drain['journal']['originalBytes'],len(data))
            self.assertEqual(drain['journal']['originalSha256'],hashlib.sha256(data).hexdigest())
            self.assertTrue(drain['journal']['closed'])
            if mode=='no-waits':
                self.assertFalse(drain['complete']);self.assertTrue(drain['unreaped'])
                self.assertIn('immutable cleanup deadline',drain['failure'])
                self.assertNotEqual(receipt['supervisorWait'],0)
                return
            self.assertTrue(drain['complete'])
            self.assertEqual(drain['unreaped'],[]);self.assertEqual(drain['remaining'],[])
            self.assertEqual(drain['unresolvedPtrace'],[]);self.assertEqual(drain['unresolvedLineage'],[])
            self.assertEqual(len(drain['owned']),len(drain['reaped']))
            for r in drain['reaped']:
                before=next(x for x in rows if x['sequence']==r['beforeReapSequence'])
                self.assertIn(before['kind'],('before-reap','before-consume'))
                self.assertLess(before['sequence'],r['sequence'])
            if mode=='normal':
                self.assertEqual(receipt['supervisorWait'],0);self.assertEqual(drain['exit'],0)
            else:
                self.assertNotEqual(receipt['supervisorWait'],0)
                self.assertEqual(len([x for x in rows if x['kind']=='cancellation']),1)
                if mode!='deadline':
                    self.assertEqual(drain['exit'],0) # root exited before cancellation
                    self.assertEqual(len(drain['reaped']),4)
                    statuses=[os.waitstatus_to_exitcode(r['status']) for r in drain['reaped']]
                    self.assertTrue(any(s in (-15,-9) for s in statuses))
                if mode=='repeat-term':
                    self.assertTrue(any(x['kind']=='cancellation-sent' and x['signal']==9 for x in rows))
            self.assertLess(receipt['elapsed'],4)

    def test_gzip_normal_footer_and_original_hash(self):self.run_case('normal')
    def test_supervisor_term_after_root_exit_drains_adopted_children(self):self.run_case('term')
    def test_repeated_term_does_not_interrupt_kill_escalation(self):self.run_case('repeat-term')
    def test_child_group_shutdown_and_supervisor_signal_race(self):self.run_case('group-term')
    def test_runtime_deadline_cancels_and_reaps(self):self.run_case('deadline')
    def test_cleanup_deadline_is_incomplete_with_verified_prefix(self):self.run_case('no-waits')
    def test_sigkill_is_explicitly_incomplete_and_preserves_prefix(self):self.run_case('hard-kill')
    def test_original_supervisor_default_term_truncates_gzip(self):self.run_case('legacy-term')


def cancel_creators_fixture(run, kind, version):
    """Both creators have real pending messages when cancellation is latched.

    Select a legal wait order and delay after CONT; never synthesize a status.
    The first nonleader creator's exit_group can supersede the other's message.
    """
    run=Path(run).resolve()
    source=r'''
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/wait.h>
static int fork_leaf, signal_mode, exec_mode, argc_fork;
static void *leaf(void *p) { for (;;) pause(); }
static void *creator(void *p) {
  while(access("go",F_OK))usleep(1000);
  if(close(creat(p?"ready-b":"ready-a",0600)))_exit(85);
  while(access(p?"ready-a":"ready-b",F_OK))usleep(1000);
  if(exec_mode) {
    if(!p) {
      if(argc_fork)while(access("fork-ready",F_OK))usleep(1000);
      execl("/bin/true","true",(char *)0);_exit(86);
    }
    if(argc_fork) {
      pid_t c=syscall(SYS_fork);if(c<0)_exit(87);
      if(!c) { usleep(50000);_exit(7); }
      close(creat("fork-ready",0600));
    }
    for(;;)pause();
  }
  if(signal_mode) {
    if(!p) { raise(SIGTERM);for(;;)pause(); }
    while(access("signal-go",F_OK))usleep(1000);
  }
  if(fork_leaf) { pid_t c=syscall(SYS_fork);if(c<0)_exit(81);if(!c)for(;;)pause(); }
  else { pthread_t t;if(pthread_create(&t,0,leaf,0))_exit(82); }
  _exit(0);
}
int main(int argc,char **argv) {
  if(chdir(argv[1]))return 80;
  fork_leaf=argc>2 && !strcmp(argv[2],"fork");
  signal_mode=argc>2 && !strcmp(argv[2],"signal");
  exec_mode=argc>2 && !strncmp(argv[2],"exec",4);
  argc_fork=argc>2 && !strcmp(argv[2],"exec-fork");
  pthread_t a,b;
  if(pthread_create(&a,0,creator,0)||pthread_create(&b,0,creator,(void *)1))return 83;
  if(close(creat("go",0600)))return 84;
  for(;;)pause();
}
'''.replace('#include <sys/wait.h>','#include <sys/wait.h>\n#include <fcntl.h>\n#include <sys/syscall.h>\n#include <signal.h>\n#include <string.h>')
    with tempfile.TemporaryDirectory() as tmp:
        c=Path(tmp)/'fixture.c';binary=Path(tmp)/'fixture'
        c.write_text(source)
        subprocess.run(['cc','-O2','-pthread',str(c),'-o',str(binary)],check=True,timeout=10)
        (run/'native-inputs.json').write_text(json.dumps(dict(inputs=[dict(name=p.name,
            size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (c,binary)],
            recovery='Regenerate cancel_creators_fixture source from Git; cc -O2 -pthread fixture.c -o fixture.')))
        gate_read,gate_write=os.pipe()
        supervisor=os.fork()
        if supervisor==0:
            os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
            module=kernel
            if version in ('before','exec-before'):
                import types
                revision='0cde26d0bc27794ce04408be3500d9e661a273e4' if version=='exec-before' else 'dec33253ced7f76b850c63f7ad1137c7f214b1ef'
                data=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
                if version=='exec-before':assert hashlib.sha256(data).hexdigest()=='c7264650beb466176d4c5169aa50666805d7c53bc43b7a0404d93c462c72568b'
                module=types.ModuleType('before');exec(compile(data,revision,'exec'),module.__dict__)
            waitid,waitpid,trace=os.waitid,os.waitpid,module.ptrace
            creators=[];selected=[];released=[];exec_binding=[];hide_wait=[];exec_stop=[];captured={}
            identify=module.identity
            def observation(task):
                row=dict(captured[task]) if version=='exec-reuse-former' and exec_binding and task==exec_binding[0][1] else identify(task)
                if exec_binding and ((version=='exec-reuse-former' and task==exec_binding[0][1]) or
                                     (version=='exec-reuse-leader' and task==exec_binding[0][0])):
                    row['start']+='-reused' # injection only: actual forced PID reuse is unsafe
                return row
            def peek(which,task,options):
                value=waitid(which,task,options)
                if hide_wait and value and value.si_pid==hide_wait[0] and value.si_code in (os.CLD_EXITED,os.CLD_KILLED,os.CLD_DUMPED):
                    return None # keep the real kernel wait unconsumed
                return value
            flags=os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL
            def consume(task,options):
                result=waitpid(task,options)
                if result[0] and os.WIFSTOPPED(result[1]):
                    exec_stop.clear()
                    if result[1]>>16==4:exec_stop[:]=[task]
                    if kind=='exec' and result[1]>>16==3:
                        child=ctypes.c_ulong();trace(module.GETEVENTMSG,task,data=ctypes.addressof(child))
                        captured[child.value]=identify(child.value)
                if version=='exec-cancel' and result[0] and os.WIFSTOPPED(result[1]) and result[1]>>16==4:
                    former=ctypes.c_ulong();trace(module.GETEVENTMSG,task,data=ctypes.addressof(former))
                    if former.value!=task:os.kill(os.getpid(),signal.SIGTERM)
                creation=result[0] and os.WIFSTOPPED(result[1]) and result[1]>>16 in (1,3)
                fatal=result[0] and os.WIFSTOPPED(result[1]) and os.WSTOPSIG(result[1])==signal.SIGTERM
                if kind!='exec' and (creation or (fatal and kind=='signal' and not selected)):
                    child=ctypes.c_ulong();trace(module.GETEVENTMSG,task,data=ctypes.addressof(child))
                    if creation and len(creators)<2:
                        creators.append(child.value)
                    elif task in creators and not selected:
                        if kind=='signal':(run/'signal-go').write_text('1')
                        other=next(t for t in creators if t!=task)
                        due=time.monotonic()+2
                        while time.monotonic()<due:
                            value=waitid(os.P_PID,other,flags)
                            if value and value.si_code==os.CLD_TRAPPED and value.si_status in (261,773):
                                second=ctypes.c_ulong();trace(module.GETEVENTMSG,other,data=ctypes.addressof(second))
                                selected.append(task)
                                (run/'pending-creators.json').write_text(json.dumps(dict(firstCreator=task,
                                    firstChild=child.value,secondCreator=other,secondChild=second.value,
                                    siStatus=value.si_status,at=time.time())))
                                os.kill(os.getpid(),signal.SIGTERM)
                                break
                            time.sleep(.001)
                        assert selected,'second native creator message absent'
                return result
            def resume(request,task,addr=0,data=0):
                # The EXEC fault window ends at its actual CONT. A later
                # observation-only GETEVENTMSG for a pending CLONE must not
                # inject EXEC corruption before that CLONE is consumed.
                if request==module.CONT and exec_stop==[task]:exec_stop.clear()
                if request==module.CONT and selected and task==selected[0] and not released:
                    released.append(task)
                    (run/'first-creator-resume.json').write_text(json.dumps(dict(pid=task,at=time.time())))
                    result=trace(request,task,addr,data)
                    time.sleep(.03) # let real exit_group supersede the other stop
                    return result
                if request==module.CONT and exec_binding and task==exec_binding[0][0]:
                    durable=[json.loads(s) for s in zlib.decompressobj(31).decompress((run/'custody.ndjson.gz').read_bytes()).splitlines()]
                    transfers=[r for r in durable if r['kind']=='exec-identity-transfer']
                    if transfers and not (run/'exec-resume-barrier.json').exists():
                        (run/'exec-resume-barrier.json').write_text(json.dumps(dict(
                            transferSequence=transfers[-1]['sequence'],pid=task,at=time.time())))
                    if version=='exec-missing-wait':hide_wait[:]=[task]
                result=trace(request,task,addr,data)
                if request==module.GETEVENTMSG and exec_stop==[task] and kind=='exec':
                    former=ctypes.c_ulong.from_address(data).value
                    if former and former!=task:
                        exec_binding.append((task,former))
                        if version=='exec-unbound':ctypes.c_ulong.from_address(data).value=999999999
                return result
            try:
                with patch.object(module.os,'waitpid',side_effect=consume),patch.object(module,'ptrace',side_effect=resume), \
                     patch.object(module,'identity',side_effect=observation),patch.object(module.os,'waitid',side_effect=peek):
                    due=time.time()+(.5 if version=='exec-missing-wait' else 6)
                    module.supervise(run,[str(binary),str(run),'exec-fork' if version=='exec-fork' else kind],
                        deadline=due,cleanup_deadline=due+1,journal_compression='gzip',command_compression='gzip')
            except BaseException as error:
                (run/'supervisor-error.json').write_text(json.dumps(dict(error=repr(error))))
                os._exit(1)
            os._exit(0)
        watchdog=os.fork()
        if watchdog==0:
            os.close(gate_read);os.close(gate_write)
            start=kernel.identity(supervisor)['start']
            (run/'watchdog-armed.json').write_text(json.dumps(dict(target=supervisor,start=start,deadline=time.time()+10)))
            time.sleep(10)
            try:
                if kernel.identity(supervisor)['start']==start:os.kill(supervisor,9)
            except (FileNotFoundError,ProcessLookupError):pass
            (run/'watchdog-fired.json').write_text('{}');os._exit(0)
        os.close(gate_read)
        while not (run/'watchdog-armed.json').exists():time.sleep(.001)
        os.write(gate_write,b'1');os.close(gate_write)
        _,status=os.waitpid(supervisor,0)
        os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
        (run/'creator-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
            watchdogWait=os.waitstatus_to_exitcode(watch_status))))


def parent_lineage_fixture(run, mode):
    """Control legal wait order only; every creation, exit and status is native."""
    run=Path(run).resolve()
    source=r'''
#include <pthread.h>
#include <unistd.h>
#include <stdlib.h>
#include <sys/wait.h>
static int fork_leaf;
static void *leaf(void *p) { for (;;) pause(); }
static void *creator(void *p) {
  while(access("go",F_OK)) usleep(1000);
  if(fork_leaf) { pid_t p=fork();if(p<0)_exit(86);if(!p)_exit(0); }
  else { pthread_t t; if(pthread_create(&t,0,leaf,0)) _exit(81); }
  for (;;) pause();
}
static void *killer(void *p) { _exit(0); }
int main(int argc,char **argv) {
  if(chdir(argv[1]))return 80;
  fork_leaf=argc>2;
  pid_t p=fork(); if(p<0)return 82;
  if(p) { int s;return waitpid(p,&s,0)==p && s==0?0:83; }
  pthread_t a,b;
  if(pthread_create(&a,0,creator,0))return 84;
  usleep(30000);
  if(pthread_create(&b,0,killer,0))return 85;
  for (;;) pause();
}
'''
    with tempfile.TemporaryDirectory() as tmp:
        c=Path(tmp)/'fixture.c'; binary=Path(tmp)/'fixture'
        c.write_text(source)
        subprocess.run(['cc','-O2','-pthread',str(c),'-o',str(binary)],check=True,timeout=10)
        inputs=[]
        for path in (c,binary):
            data=path.read_bytes();assert data==path.read_bytes()
            inputs.append(dict(name=path.name,size=len(data),sha256=hashlib.sha256(data).hexdigest()))
        (run/'native-inputs.json').write_text(json.dumps(dict(inputs=inputs,
            recovery='Generate source from parent_lineage_fixture in Git; cc -O2 -pthread fixture.c -o fixture. No binary or source archive retained.')))
        gate_read,gate_write=os.pipe()
        supervisor=os.fork()
        if supervisor==0:
            os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
            module=kernel
            if mode.endswith('before'):
                import types
                revision='bcf8c7bd788f2c63668406b11f72652006cde8dc'
                data=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
                assert hashlib.sha256(data).hexdigest()=='5371233b12d3a63e13a9768529af43e5a61b7ff1682b2d3c09e4db6a976e12d0'
                module=types.ModuleType('before');exec(compile(data,revision,'exec'),module.__dict__)
            waitid,waitpid,trace=os.waitid,os.waitpid,module.ptrace
            clones=[];pending=[];killer_started=[];selected_initial=[]
            def peek(which,pid,flags):
                if pending and not killer_started and which==os.P_ALL:
                    value=waitid(os.P_PID,clones[1],flags)
                    if value:return value
                value=waitid(which,pid,flags)
                if (mode.startswith('parked') and len(clones)==1 and not selected_initial and
                    value and value.si_code==os.CLD_TRAPPED and value.si_status==773):
                    child=ctypes.c_ulong();trace(module.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
                    selected_initial.append(child.value)
                    due=time.monotonic()+1
                    while time.monotonic()<due:
                        initial=waitid(os.P_PID,child.value,flags)
                        if initial:return initial
                        time.sleep(.001)
                    raise AssertionError('native killer autoattach stop missing')
                return value
            def consume(task,flags):
                result=waitpid(task,flags)
                if (mode.startswith('parked') and len(clones)==1 and not selected_initial and
                    task!=clones[0] and result[0] and os.WIFSTOPPED(result[1]) and
                    os.WSTOPSIG(result[1])==signal.SIGSTOP):
                    selected_initial.append(task)
                if result[0] and os.WIFSTOPPED(result[1]) and result[1]>>16==3 and len(clones)<2:
                    child=ctypes.c_ulong();trace(module.GETEVENTMSG,task,data=ctypes.addressof(child))
                    clones.append(child.value)
                    if len(clones)==2:
                        (run/'go').write_text('1')
                        due=time.monotonic()+2
                        while time.monotonic()<due:
                            value=waitid(os.P_PID,clones[0],os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
                            if value and value.si_code==os.CLD_TRAPPED and value.si_status==(261 if mode.startswith('fork') else 773):
                                nested=ctypes.c_ulong();trace(module.GETEVENTMSG,clones[0],data=ctypes.addressof(nested))
                                pending.append(nested.value)
                                (run/'pending-creation.json').write_text(json.dumps(dict(
                                    creator=clones[0],child=nested.value,siStatus=value.si_status,at=time.time())))
                                break
                            time.sleep(.001)
                        assert pending,'native creator did not reach clone event'
                return result
            def resume(request,task,addr=0,data=0):
                if request==module.CONT and len(clones)==2 and task==clones[1] and not killer_started:
                    killer_started.append(task)
                    (run/'killer-resume.json').write_text(json.dumps(dict(pid=task,at=time.time())))
                    result=trace(request,task,addr,data)
                    # Let the real exit_group replace the creator's pending stop.
                    time.sleep(.03)
                    return result
                return trace(request,task,addr,data)
            try:
                with patch.object(module.os,'waitid',side_effect=peek),patch.object(module.os,'waitpid',side_effect=consume),patch.object(module,'ptrace',side_effect=resume):
                    due=time.time()+7
                    module.supervise(run,[str(binary),str(run)]+(['fork'] if mode.startswith('fork') else []),deadline=due,cleanup_deadline=due+1,
                        journal_compression='gzip',command_compression='gzip')
            except BaseException as error:
                (run/'supervisor-error.json').write_text(json.dumps(dict(error=repr(error))))
                os._exit(1)
            os._exit(0)
        watchdog=os.fork()
        if watchdog==0:
            os.close(gate_read);os.close(gate_write)
            start=kernel.identity(supervisor)['start']
            (run/'watchdog-armed.json').write_text(json.dumps(dict(target=supervisor,start=start,deadline=time.time()+11)))
            time.sleep(11)
            try:
                if kernel.identity(supervisor)['start']==start:os.kill(supervisor,9)
            except (FileNotFoundError,ProcessLookupError):pass
            (run/'watchdog-fired.json').write_text('{}');os._exit(0)
        os.close(gate_read)
        while not (run/'watchdog-armed.json').exists():time.sleep(.001)
        os.write(gate_write,b'1');os.close(gate_write)
        _,status=os.waitpid(supervisor,0)
        os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
        (run/'lineage-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
            watchdogWait=os.waitstatus_to_exitcode(watch_status))))


def causality_fixture(run, mode):
    run=Path(run).resolve()
    source=r'''
#include <pthread.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
#include <time.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>
#include <sched.h>
static pid_t tid;
static _Atomic int multi_release;
static void *worker(void *arg) {
  if(arg) {
    *(pid_t *)arg=syscall(SYS_gettid);
    while(!atomic_load(&multi_release))sched_yield();
  } else tid=syscall(SYS_gettid);
  return 0;
}
int main(int argc, char **argv) {
  if (chdir(argv[1])) return 80;
  if (argc>2 && !strcmp(argv[2],"multi")) {
    pthread_t ts[8];pid_t tids[8];
    for(int j=0;j<8;j++)if(pthread_create(&ts[j],0,worker,&tids[j]))return 89;
    atomic_store(&multi_release,1);
    for(int j=0;j<8;j++)if(pthread_join(ts[j],0))return 90;
    int i=0,present=0;
    for(;i<30;i++) {
      struct stat st;if(stat("/proc/self/task",&st))return 91;
      present=st.st_nlink!=3;if(!present)break;
      struct timespec delay={0,1L<<i};while(nanosleep(&delay,&delay) && errno==EINTR){}
    }
    FILE *f=fopen("native-multi-observation.json","w");if(!f)return 92;
    fprintf(f,"{\"present\":%s,\"tids\":[",present?"true":"false");
    for(int j=0;j<8;j++)fprintf(f,"%s%d",j?",":"",tids[j]);fprintf(f,"]}");fclose(f);
    return present?42:0;
  }
  if (argc>2) {
    pid_t p=fork();
    if (p<0) return 81;
    if (!p) { FILE *f=fopen("unlinked-userspace-ran","w"); if(f)fclose(f); }
    for (;;) pause();
  }
  pid_t helper=fork();
  if (helper<0) return 82;
  if (!helper) {
    while (access("exit-released",F_OK)) usleep(1000);
    for (int j=0;j<24;j++) {
      pid_t p=fork(); if(p<0)_exit(83); if(!p)_exit(0);
      int status; if(waitpid(p,&status,0)!=p || status)_exit(84);
    }
    _exit(0);
  }
  pthread_t t; if(pthread_create(&t,0,worker,0) || pthread_join(t,0))return 85;
  char path[128];snprintf(path,sizeof(path),"/proc/self/task/%d",tid);
  int i=0, present=0;
  for (;i<30;i++) {
    struct stat st;present=stat(path,&st)==0;
    if(!present) { if(errno!=ENOENT)return 86;break; }
    struct timespec ts={0,1L<<i};while(nanosleep(&ts,&ts) && errno==EINTR){}
  }
  FILE *f=fopen("native-observation.json","w");if(!f)return 87;
  fprintf(f,"{\"tid\":%d,\"iterations\":%d,\"present\":%s}",tid,i,present?"true":"false");fclose(f);
  int status;if(waitpid(helper,&status,0)!=helper || status)return 88;
  return present?42:0;
}
'''
    (run/'fixture.c').write_text(source)
    subprocess.run(['cc','-O2','-pthread',str(run/'fixture.c'),'-o',str(run/'fixture')],check=True,timeout=10)
    gate_read,gate_write=os.pipe()
    supervisor=os.fork()
    if supervisor==0:
        os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
        module=kernel
        if mode.endswith('before'):
            import types
            revision='3021d134c'
            data=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
            assert hashlib.sha256(data).hexdigest()=='e36d34990d738e616611ce8a8f4309548abcb751bd5ef5ec119d20e561c49360'
            module=types.ModuleType('before');exec(compile(data,revision,'exec'),module.__dict__)
        actual_waitid,actual_waitpid,trace,fsync=os.waitid,os.waitpid,module.ptrace,os.fsync
        selected=[];released=[];terminal=[]
        observed,probe=journal_probe(module)
        def rows():
            return observed
        def peek(which,pid,flags):
            if mode.startswith('cancel'):
                if selected and which==os.P_ALL and not terminal:
                    return actual_waitid(os.P_PID,selected[0],flags)
                value=actual_waitid(which,pid,flags)
                if which==os.P_ALL and value and value.si_code==os.CLD_TRAPPED and value.si_status==261 and not selected:
                    child=ctypes.c_ulong();trace(module.GETEVENTMSG,value.si_pid,data=ctypes.addressof(child))
                    selected.append(child.value)
                    due=time.monotonic()+1
                    while time.monotonic()<due:
                        initial=actual_waitid(os.P_PID,child.value,flags)
                        if initial:return initial
                        time.sleep(.001)
                    raise AssertionError('real child stop missing')
                return value
            if released and which==os.P_ALL:
                # Select real competing kernel statuses, simulating the legal
                # non-FIFO P_ALL order in Q2. Per-record sync latency below is
                # injected storage latency, not an invented wait/exit status.
                due=time.monotonic()+.03
                while time.monotonic()<due:
                    registered=[r['pid'] for r in rows() if r['kind']=='custody' and r['pid']!=selected[0]]
                    for task in registered:
                        try: value=actual_waitid(os.P_PID,task,flags)
                        except ChildProcessError:continue
                        if value:return value
                    time.sleep(.001)
            return actual_waitid(which,pid,flags)
        def consume(task,flags):
            result=actual_waitpid(task,flags)
            if mode.startswith('cancel') and selected and task==selected[0] and result[0]:
                if os.WIFSTOPPED(result[1]) and not released:
                    released.append(task)
                    (run/'cancel-barrier.json').write_text(json.dumps(dict(child=task)))
                    os.kill(os.getpid(),15)
                if os.WIFEXITED(result[1]) or os.WIFSIGNALED(result[1]):terminal.append(task)
            return result
        def resume(request,task,addr=0,data=0):
            if mode.startswith('exit') and request==module.CONT:
                last=rows()[-1]
                if last['kind']=='pre-exit-stop' and last['pid']==task and last['tgid']!=task:
                    selected.append(task);released.append(task)
                    (run/'exit-released').write_text(str(task))
            return trace(request,task,addr,data)
        def sync(fd):
            fsync(fd)
            if mode.startswith('exit'):time.sleep(.015)
        try:
            with probe,patch.object(module.os,'waitid',side_effect=peek),patch.object(module.os,'waitpid',side_effect=consume), \
                 patch.object(module,'ptrace',side_effect=resume),patch.object(module.os,'fsync',side_effect=sync):
                due=time.time()+6
                extra=['cancel'] if mode.startswith('cancel') else (['multi'] if mode=='multi-fixed' else [])
                module.supervise(run,[str(run/'fixture'),str(run)]+extra,
                    deadline=due,cleanup_deadline=due+1,journal_compression='gzip',command_compression='gzip')
        except BaseException as error:
            (run/'supervisor-error.json').write_text(json.dumps(dict(error=repr(error))))
            os._exit(1)
        os._exit(0)
    watchdog=os.fork()
    if watchdog==0:
        os.close(gate_read);os.close(gate_write)
        start=kernel.identity(supervisor)['start']
        (run/'watchdog-armed.json').write_text(json.dumps(dict(target=supervisor,start=start,deadline=time.time()+9)))
        time.sleep(9)
        try:
            if kernel.identity(supervisor)['start']==start:os.kill(supervisor,9)
        except (FileNotFoundError,ProcessLookupError):pass
        (run/'watchdog-fired.json').write_text('{}');os._exit(0)
    os.close(gate_read)
    while not (run/'watchdog-armed.json').exists():time.sleep(.001)
    os.write(gate_write,b'1');os.close(gate_write)
    _,status=os.waitpid(supervisor,0)
    os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
    (run/'causality-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
        watchdogWait=os.waitstatus_to_exitcode(watch_status))))


def terminal_fixture(run, mode):
    # Independent watchdog is armed before the supervisor's fork barrier.
    run=Path(run).resolve();gate_read,gate_write=os.pipe()
    pid=os.fork()
    if pid==0:
        os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
        module=kernel
        if mode=='historical':
            import types
            revision='e1a413983f251534ad77dbf337844ab9ca3afb74'
            source=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
            assert hashlib.sha256(source).hexdigest()=='04a3598c7e23966d57173df5f42ba740fd36106ca4e8f78c84c435f49451221d'
            module=types.ModuleType('historical');exec(compile(source,revision,'exec'),module.__dict__)
        actual_wait=os.waitpid;first=[];replay=[]
        def consume(task,flags):
            got,status=actual_wait(task,flags)
            if got and (os.WIFEXITED(status) or os.WIFSIGNALED(status)):
                row=module.identity(task) if Path('/proc',str(task)).exists() else None
                if row and row['ppid']!=os.getpid() and row['tgid']==task:
                    first.append(task)
                    (run/'tracer-consumed').write_text(str(task))
                elif task in first:
                    if mode=='bad-status':status=8<<8
                    if mode=='third-receipt':replay.append((got,status))
            return got,status
        actual_peek=os.waitid
        def peek(*args):
            if replay:
                from types import SimpleNamespace
                return SimpleNamespace(si_pid=replay[0][0],si_code=os.CLD_EXITED,si_status=7)
            return actual_peek(*args)
        def wait(task,flags):
            if replay:return replay.pop(0)
            return consume(task,flags)
        command='''import os,threading,time,pathlib,signal
def child():
 p=os.fork()
 if p==0:
  if SIGNAL:os.kill(os.getpid(),15)
  os._exit(7)
 pathlib.Path(CHILD).write_text(str(p))
threading.Thread(target=child).start()
while not pathlib.Path(MARKER).exists():time.sleep(.001)
if PARENT_WAIT:
 while not pathlib.Path(CHILD).exists():time.sleep(.001)
 p=int(pathlib.Path(CHILD).read_text());got,status=os.waitpid(p,0)
 assert got==p and status==7<<8
os._exit(0)
'''.replace('CHILD',repr(str(run/'child'))).replace('MARKER',repr(str(run/'tracer-consumed'))).replace('PARENT_WAIT',repr(mode=='parent-wait')).replace('SIGNAL',repr(mode=='adopt-signal'))
        try:
            with patch.object(module.os,'waitpid',side_effect=wait),patch.object(module.os,'waitid',side_effect=peek):
                due=time.time()+4
                options=dict(command_compression='gzip') if mode=='adopt-gzip' else {}
                module.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1,journal_compression='gzip',**options)
        except BaseException:os._exit(1)
        os._exit(0)
    watchdog=os.fork()
    if watchdog==0:
        os.close(gate_read);os.close(gate_write)
        target_start=kernel.identity(pid)['start']
        (run/'watchdog-armed.json').write_text(json.dumps(dict(pid=os.getpid(),target=pid,
            targetStart=target_start,seconds=7,deadline=time.time()+7)))
        time.sleep(7)
        try:
            if kernel.identity(pid)['start']==target_start:os.kill(pid,9)
        except (ProcessLookupError,FileNotFoundError):pass
        (run/'watchdog-fired.json').write_text('{}');os._exit(0)
    os.close(gate_read)
    while not (run/'watchdog-armed.json').exists():time.sleep(.001)
    os.write(gate_write,b'1');os.close(gate_write)
    _,status=os.waitpid(pid,0)
    os.kill(watchdog,15);_,watch_status=os.waitpid(watchdog,0)
    (run/'terminal-fixture-waits.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
        watchdogWait=os.waitstatus_to_exitcode(watch_status))))


def gzip_fixture(run, mode):
    run=Path(run).resolve();started=time.monotonic()
    # This parent is independent of the supervisor and retains its actual wait.
    gate_read,gate_write=os.pipe()
    pid=os.fork()
    if pid==0:
        os.close(gate_write);assert os.read(gate_read,1)==b'1';os.close(gate_read)
        due=time.time()+(.4 if mode in ('deadline','no-waits') else 3)
        command=['/bin/true']
        if mode!='normal':
            command=[sys.executable,'-c', '''import os,signal,time,pathlib,json
signal.signal(signal.SIGTERM,signal.SIG_IGN if IGNORE else signal.SIG_DFL)
children=[]
for _ in range(3):
 p=os.fork()
 if p==0:
  while True:time.sleep(1)
 children.append(p)
pathlib.Path(READY).write_text(json.dumps(dict(root=os.getpid(),children=children)))
os._exit(0)
'''.replace('IGNORE',repr(mode in ('repeat-term','deadline','no-waits'))).replace('READY',repr(str(run/'ready.json')))]
        actual_waitid=os.waitid;actual_waitpid=os.waitpid
        def consume(task,flags):
            result=actual_waitpid(task,flags)
            if result[0] and (os.WIFEXITED(result[1]) or os.WIFSIGNALED(result[1])) and (run/'ready.json').exists():
                ready=json.loads((run/'ready.json').read_text())
                if task==ready['root']:(run/'root-wait-consumed.json').write_text(json.dumps(dict(pid=task,status=result[1])))
            return result
        def peek(*args):
            if (run/'ready.json').exists():return None
            return actual_waitid(*args)
        try:
            with patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel.os,'waitid',side_effect=peek if mode=='no-waits' else actual_waitid):
                if mode=='legacy-term':
                    import types, builtins
                    revision='3a75ffb9c5b147512e4e30ce528f9788f9cb6704'
                    source=subprocess.check_output(['git','show',revision+':tools/native_kernel_custody.py'])
                    legacy=types.ModuleType('legacy');exec(compile(source,revision,'exec'),legacy.__dict__)
                    # Reproduce the original sink substitution through dependency
                    # injection, without altering even one byte of source text.
                    def sink(path,mode,**kwargs):
                        if Path(path).name=='custody.ndjson':return gzip.open(run/'custody.ndjson.gz','wt')
                        return builtins.open(path,mode,**kwargs)
                    legacy.open=sink
                    legacy.supervise(run,command,deadline=due,cleanup_deadline=due+.6)
                else:
                    kernel.supervise(run,command,deadline=due,cleanup_deadline=due+.6,journal_compression='gzip')
        except BaseException:
            os._exit(1)
        os._exit(0)
    # Prearm an independent observable watchdog before waiting for readiness.
    watchdog=os.fork()
    if watchdog==0:
        os.close(gate_read);os.close(gate_write)
        (run/'watchdog-armed.json').write_text(json.dumps(dict(pid=os.getpid(),target=pid,seconds=5)))
        time.sleep(5)
        try:os.kill(pid,signal.SIGKILL)
        except ProcessLookupError:pass
        (run/'watchdog-fired.json').write_text('{}');os._exit(0)
    os.close(gate_read)
    while not (run/'watchdog-armed.json').exists():time.sleep(.001)
    os.write(gate_write,b'1');os.close(gate_write)
    if mode not in ('normal','deadline','no-waits'):
        due=time.monotonic()+3
        while time.monotonic()<due:
            try:
                ready=json.loads((run/'ready.json').read_text())
                receipt=json.loads((run/'root-wait-consumed.json').read_text())
                if receipt['pid']==ready['root']:break
            except (FileNotFoundError,ValueError,zlib.error):pass
            time.sleep(.002)
        else:raise AssertionError('root terminal wait barrier missing')
        if mode=='group-term':os.killpg(ready['root'],signal.SIGTERM)
        os.kill(pid,signal.SIGKILL if mode=='hard-kill' else signal.SIGTERM)
        if mode=='repeat-term':
            for _ in range(10):
                time.sleep(.01);os.kill(pid,signal.SIGTERM)
    got,status=os.waitpid(pid,0);assert got==pid
    os.kill(watchdog,signal.SIGTERM);_,watch_status=os.waitpid(watchdog,0)
    (run/'fixture-wait.json').write_text(json.dumps(dict(supervisorWait=os.waitstatus_to_exitcode(status),
        watchdogWait=os.waitstatus_to_exitcode(watch_status),elapsed=time.monotonic()-started,
        validation='INCOMPLETE: missing footer and drain' if mode in ('hard-kill','legacy-term') else 'checked by test')))


def cont_race_fixture(run, concurrent=False):
    trace=kernel.ptrace;waitid=os.waitid;injected=[]
    rows,probe=journal_probe(kernel)
    def resume(request,pid,addr=0,data=0):
        if request==kernel.CONT and not injected:
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
    with probe,patch.object(kernel,'ptrace',side_effect=trace if concurrent else resume):
        due=time.time()+4
        kernel.supervise(run,command,deadline=due,cleanup_deadline=due+1)


def unseen_exit_fixture(run):
    # Real initial SIGSTOP is superseded before the supervisor first observes
    # this child. Only wait selection and SIGKILL scheduling are controlled;
    # WNOWAIT, waitpid and GETEVENTMSG all return actual kernel results.
    run=Path(run).resolve();waitid,waitpid=os.waitid,os.waitpid;trace=kernel.ptrace
    selected=[];reaped=[]
    rows,probe=journal_probe(kernel)
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
            last=rows[-1]
            assert last['kind']=='unlinked-exit-retirement'
            durable=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            custody=next(r for r in durable if r['sequence']==last['custodySequence'])
            (run/'first-exit-cont-barrier.json').write_text(json.dumps(dict(pid=pid,
                recordedSequence=last['sequence'],durableCustodySequence=custody['sequence'])))
        return trace(request,pid,addr,data)
    command="import os,pathlib;p=os.fork();pathlib.Path(MARKER).write_text('ran') if p==0 else os.waitpid(p,0)".replace('MARKER',repr(str(run/'unlinked-userspace-ran')))
    with probe,patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel,'ptrace',side_effect=ptrace):
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
    ptrace=kernel.ptrace
    rows,probe=journal_probe(kernel)
    def trace(request,pid,addr=0,data=0):
        if request==kernel.CONT and selected and pid==selected[0] and delivered:
            last=rows[-1];assert last['kind']=='unlinked-exit-retirement'
            durable=[json.loads(s) for s in (run/'custody.ndjson').read_text().splitlines()]
            custody=next(r for r in durable if r['sequence']==last['custodySequence'])
            (run/'retirement-cont-barrier.json').write_text(json.dumps(dict(pid=pid,
                recordedSequence=last['sequence'],durableCustodySequence=custody['sequence'])))
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
    with probe,patch.object(kernel.os,'waitid',side_effect=peek),patch.object(kernel.os,'waitpid',side_effect=consume),patch.object(kernel,'ptrace',side_effect=trace):
        due=time.time()+3
        kernel.supervise(run,[sys.executable,'-c',command],deadline=due,cleanup_deadline=due+1)


if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--isolated-fixture':
        # A deliberately failing supervisor uses EXITKILL. Reap its adopted
        # fixture tasks here so the unittest process's own subreaper never
        # inherits unrelated zombies between kernel tests.
        assert kernel.libc.prctl(36,1,0,0,0)==0
        result=subprocess.run([sys.executable,__file__,*sys.argv[2:]])
        adopted=[]
        while True:
            try:
                pid,status=os.waitpid(-1,0)
                adopted.append(dict(pid=pid,status=status,exit=os.waitstatus_to_exitcode(status)))
            except ChildProcessError:break
        if sys.argv[2] in ('--gzip-fixture','--terminal-fixture','--parent-lineage-fixture','--cancel-creators-fixture','--output-wait-fixture','--queued-stop-fixture'):
            (Path(sys.argv[3])/'isolated-waits.json').write_text(json.dumps(dict(
                fixtureWait=result.returncode,adoptedWaits=adopted)))
        sys.exit(result.returncode)
    elif len(sys.argv)>1 and sys.argv[1]=='--cancel-creators-fixture':cancel_creators_fixture(sys.argv[2],sys.argv[3],sys.argv[4])
    elif len(sys.argv)>1 and sys.argv[1]=='--queued-stop-fixture':queued_stop_fixture(sys.argv[2],sys.argv[3],sys.argv[4])
    elif len(sys.argv)>1 and sys.argv[1]=='--parent-lineage-fixture':parent_lineage_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--causality-fixture':causality_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--command-gzip-fixture':command_gzip_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--output-wait-fixture':output_wait_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--gzip-fixture':gzip_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--terminal-fixture':terminal_fixture(sys.argv[2],sys.argv[3])
    elif len(sys.argv)>1 and sys.argv[1]=='--cont-race-fixture':cont_race_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--concurrent-exit-fixture':cont_race_fixture(sys.argv[2],True)
    elif len(sys.argv)>1 and sys.argv[1]=='--unseen-exit-fixture':unseen_exit_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-fixture':parked_fixture(sys.argv[2])
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-term-fixture':parked_fixture(sys.argv[2],death_signal=15)
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-fork-fixture':parked_fixture(sys.argv[2],True)
    elif len(sys.argv)>1 and sys.argv[1]=='--parked-reuse-fixture':parked_fixture(sys.argv[2],True,reuse=True)
    else:unittest.main()

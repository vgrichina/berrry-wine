"""Real ptrace cohorts: durable authority, bounded lossless output, sticky failure.

Uses the prior Git adapter as the control, never a source-tree snapshot.
"""
from pathlib import Path
import gzip
import importlib.util
import json
import os
import runpy
import subprocess
import sys
import time
import types
import unittest
import zlib
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / 'tools/q3-startup-custody.py'
BASE = '2bc65ee74e5a5726a58a86ea1a390f6ec1e3d185'
RESULT_ONLY = {'ptrace-cont-returned', 'parked-child-release', 'parked-child-release-pending'}


def module(before=False):
    if before == 'matched':
        # Same kernel entry coordination, but the prior durability policy:
        # every release result forces a fresh complete-prefix barrier. This
        # isolates cohort service savings from the added kernel-stop workload.
        kernel=runpy.run_path(str(ADAPTER))['load']()
        append=kernel.Journal.append
        def strict(journal,value,**options):
            result=append(journal,value,**options)
            journal.release_required=True
            return result
        kernel.Journal.append=strict
        return kernel
    if not before: return runpy.run_path(str(ADAPTER))['load']()
    data = subprocess.check_output(['git', 'show', BASE+':tools/q3-startup-custody.py'])
    adapter = types.ModuleType('git_control')
    adapter.__file__ = str(ADAPTER)
    exec(compile(data, BASE+':tools/q3-startup-custody.py', 'exec'), adapter.__dict__)
    # Recover the matching provider from the same publication. Its adapter
    # authenticates this input; today's provider has a different contract.
    provider = subprocess.check_output(['git', 'show', BASE+':tools/native_kernel_custody.py'])
    kernel = types.ModuleType('git_control_provider')
    exec(compile(adapter.candidate(provider.decode()), BASE+':tools/native_kernel_custody.py', 'exec'),
         kernel.__dict__)
    return kernel


def probe(kernel, run):
    """Check disk bytes AND successful fsync completion before real CONT."""
    rows, durable, releases = [], [], []
    append, sync, trace = kernel.Journal.append, os.fsync, kernel.ptrace
    def observed_append(journal, value, **options):
        result = append(journal, value, **options)
        if journal.path.name in ('custody.ndjson', 'custody.ndjson.gz'): rows.append(dict(value))
        return result
    def synced(fd):
        result = sync(fd)
        path = run/'custody.ndjson.gz'
        if path.exists() or (run/'custody.ndjson').exists():
            # A readable OS-cache prefix alone is NOT a durability receipt.
            raw = zlib.decompressobj(31).decompress(path.read_bytes()) if path.exists() else (run/'custody.ndjson').read_bytes()
            durable[:] = [json.loads(line) for line in raw.splitlines()]
        return result
    def resumed(request, pid, addr=0, data=0):
        if request in (kernel.CONT, getattr(kernel,'SYSCALL',kernel.CONT)):
            # Any missing suffix must consist exclusively of outcomes of
            # earlier certified releases. In particular every consumed wait,
            # lineage, identity and retirement record must already be durable.
            assert rows[:len(durable)] == durable
            assert all(r['kind'] in RESULT_ONLY for r in rows[len(durable):]), (pid, rows[len(durable):])
            wait = next(r for r in reversed(rows) if r['kind']=='wait-consumed' and r['pid']==pid)
            assert wait in durable, ('release before actual wait durability', wait)
            custody = next(r for r in durable if r['kind']=='custody' and r['pid']==pid)
            assert custody['start'] == wait['start']
            releases.append(dict(pid=pid, waitSequence=wait['sequence'], durableSequence=durable[-1]['sequence'],
                                 trailingResultRecords=len(rows)-len(durable)))
        return trace(request, pid, addr, data)
    return rows, releases, (patch.object(kernel.Journal, 'append', observed_append),
                            patch.object(kernel.os, 'fsync', side_effect=synced),
                            patch.object(kernel, 'ptrace', side_effect=resumed))


def run(out):
    out.mkdir(parents=True, exist_ok=False)
    sys.path.insert(0, str(ROOT/'tools'))
    spec = importlib.util.spec_from_file_location('controls', ROOT/'tools/native_kernel_custody_test.py')
    controls = importlib.util.module_from_spec(spec); spec.loader.exec_module(controls)
    controls.kernel = module()
    suite = unittest.TestSuite(controls.RetirementService(n) for n in (
        'test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
        'test_final_sync_failure_cannot_accept_fully_reaped_run',
        'test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes',
        'test_gzip_footer_requires_its_own_successful_final_sync'))
    assert unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
    # Saturation flushing the previous batch must not certify the NEW record.
    for compression in (None, 'gzip'):
        directory=out/('journal-'+str(compression)); directory.mkdir()
        kernel=module(); journal=kernel.Journal(directory,compression)
        journal.MAX_PENDING_RECORDS=1
        journal.append(dict(kind='ptrace-cont-returned',sequence=1),defer=True)
        journal.append(dict(kind='fork-lineage',sequence=2),defer=True)
        assert journal.release_required and journal.pending
        journal.release_barrier(); assert not journal.pending
        journal.append(dict(kind='ptrace-cont-returned',sequence=3),defer=True)
        with patch.object(os,'fsync',side_effect=OSError('sticky cohort sync')):
            try: journal.flush_pending()
            except OSError: pass
            else: raise AssertionError('storage failure lost')
        for action in (journal.release_barrier,journal.close):
            try: action()
            except OSError as error: assert 'journal service failed' in str(error)
            else: raise AssertionError('failed cohort accepted')

    pressure=[]
    script='''const cp=require('node:child_process');let n=20;
for(let i=0;i<20;i++)cp.spawn('/bin/true').once('close',()=>{if(!--n)process.exit(0)});
'''
    for name in ('historical','before','after'):
        kernel=module(True if name=='historical' else 'matched' if name=='before' else False); directory=out/name; directory.mkdir()
        sync=os.fsync; calls=[]
        def slow(fd):
            calls.append(time.monotonic_ns());time.sleep(.025);return sync(fd)
        start=time.monotonic(); due=time.time()+20
        # Layer latency OUTSIDE probe's successful sync observer.
        with patch.object(os,'fsync',side_effect=slow):
            # Rebuild probe so it captures the slowed real durability call.
            rows,releases,patches=probe(kernel,directory)
            with patches[0],patches[1],patches[2]:
                kernel.supervise(directory,['node','-e',script],deadline=due,
                                 cleanup_deadline=due+5,journal_compression='gzip')
        elapsed=time.monotonic()-start
        final=[json.loads(s) for s in gzip.open(directory/'custody.ndjson.gz','rt')]
        assert final==rows
        drain=json.loads((directory/'kernel-drain.json').read_bytes())
        assert drain['complete'] and not drain['unreaped'] and not drain['remaining']
        assert len(drain['owned'])==len(drain['reaped'])>=21
        pressure.append(dict(mode=name,fsyncs=len(calls),seconds=elapsed,releases=releases,
                             actualOwned=len(drain['owned']),actualReaped=len(drain['reaped'])))
    historical=pressure.pop(0)
    (out/'historical-pressure.json').write_text(json.dumps(historical,indent=2))
    assert pressure[1]['fsyncs'] < pressure[0]['fsyncs']*.85, pressure
    assert pressure[1]['seconds'] < pressure[0]['seconds']*.9, pressure
    assert any(r['trailingResultRecords'] for r in pressure[1]['releases'])
    (out/'pressure.json').write_text(json.dumps(pressure,indent=2))
    # Real unlinked EXIT control: never execute unlinked userspace, and retain
    # the same required durability at irreversible retirement releases.
    directory=out/'unlinked-exit';directory.mkdir();kernel=module();controls.kernel=kernel
    rows,releases,patches=probe(kernel,directory)
    with patches[0],patches[1],patches[2]: controls.unseen_exit_fixture(directory)
    assert not (directory/'unlinked-userspace-ran').exists()
    assert json.loads((directory/'kernel-drain.json').read_bytes())['complete']
    assert [json.loads(s) for s in (directory/'custody.ndjson').read_text().splitlines()]==rows
    (out/'unlinked-releases.json').write_text(json.dumps(releases,indent=2))
    # The existing standalone fixture entrypoints import the shared provider.
    # Bind the adapter explicitly IN each isolated fixture process instead.
    # These retain actual exec former-TID transfer and cancellation lineage.
    fixture_script = '''import sys,runpy,importlib.util
from pathlib import Path
r=Path(sys.argv[1]);s=importlib.util.spec_from_file_location('controls',r/'tools/native_kernel_custody_test.py')
c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
c.kernel=runpy.run_path(str(r/'tools/q3-startup-custody.py'))['load']()
getattr(c,sys.argv[2])(sys.argv[3],sys.argv[4],sys.argv[5])
'''
    for name, function, kind, version in (
            ('exec-transfer','cancel_creators_fixture','exec','fixed'),
            ('cancel-lineage','cancel_creators_fixture','clone','fixed'),
            ('superseding-exec','queued_stop_fixture','exec','fixed')):
        directory=out/name;directory.mkdir()
        result=subprocess.run([sys.executable,'-B','-c',fixture_script,str(ROOT),function,str(directory),kind,version],
                              capture_output=True,timeout=20)
        adopted=[];due=time.monotonic()+5
        while True:
            try: peek=os.waitid(os.P_ALL,0,os.WEXITED|os.WNOHANG|os.WNOWAIT)
            except ChildProcessError:break
            assert time.monotonic()<due,'fixture adoption drain deadline'
            if peek is None:time.sleep(.001);continue
            identity=kernel.identity(peek.si_pid);pid,status=os.waitpid(peek.si_pid,0)
            adopted.append(dict(identity=identity,pid=pid,status=status))
        (directory/'fixture-parent-wait.json').write_text(json.dumps(dict(status=result.returncode,
            stdout=result.stdout.decode(),stderr=result.stderr.decode(),actualWait=True,stdoutEOF=True,stderrEOF=True,
            adoptedActualWaits=adopted)))
        assert result.returncode==0,(name,result.stdout,result.stderr)
        assert not adopted
        drain=json.loads((directory/'kernel-drain.json').read_bytes())
        assert drain['complete'] and not drain['unreaped'] and not drain['remaining']
        if name=='exec-transfer':assert len(drain['execTransfers'])==1
    print(json.dumps(dict(passed=True,pressure=[{k:r[k] for k in ('mode','fsyncs','seconds')} for r in pressure])))


if __name__=='__main__': run(Path(sys.argv[1]).resolve())

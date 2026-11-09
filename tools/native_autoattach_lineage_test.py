"""Real Linux diagnostic regression; historical missing lineage stays missing.

Candidate is compiled in memory until the pinned runtime releases shared source.
The before version is Git's actual1395 source, never an invented wait adapter.
"""
import ctypes
import contextlib
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import shutil
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch

REVISION = '8fd1a54210d7e3c4e1c47e4559f9c1498afdf02f'
SOURCE_SHA = '05b7fe42cf7ac09df5f12f0ea073ea066892efb598b64b05fae19a3492c9f32c'


def candidate(source):
    """Exact small diagnostic-only transform, also usable before shared edit."""
    changes = [
        ("        journal.append(dict(sequence=sequence, at=time.time(), kind=kind, **value), defer=retirement)\n",
         '        # Diagnostic records share the bounded journal batch. Existing\n'
         '        # admission barriers still flush the full prefix before CONT.\n'
         "        diagnostic = kind in ('wait-consumed', 'kernel-event-message',\n"
         "                              'creation-peek-message', 'ptrace-cont-returned')\n"
         '        journal.append(dict(sequence=sequence, at=time.time(), kind=kind, **value),\n'
         '                       defer=retirement or diagnostic)\n'),
        ('    exit_stops = {}\n', '    exit_stops = {}\n    consumed_waits = {} # one latest real wait per owned task, diagnostic only\n'),
        ('            got, status = os.waitpid(task, os.WNOHANG|WALL)\n',
         '            # Preserve a pending creator message even if a fatal signal\n'
         '            # replaces this peek before waitpid. This observation cannot\n'
         '            # register a child or authorize CONT; only consumed events do.\n'
         '            if peek.si_code == os.CLD_TRAPPED and peek.si_status in (261, 517, 773):\n'
         '                observed_message = ctypes.c_ulong()\n'
         '                try:\n'
         '                    ptrace(GETEVENTMSG, task, data=ctypes.addressof(observed_message))\n'
         '                except OSError as error:\n'
         "                    log('creation-peek-message', pid=task, start=row['start'],\n"
         '                        beforeConsumeSequence=before, peekStatus=peek.si_status,\n'
         '                        kernelMessage=None, errno=error.errno, observationalOnly=True)\n'
         '                else:\n'
         "                    log('creation-peek-message', pid=task, start=row['start'],\n"
         '                        beforeConsumeSequence=before, peekStatus=peek.si_status,\n'
         '                        kernelMessage=observed_message.value, errno=None, observationalOnly=True)\n'
         '            got, status = os.waitpid(task, os.WNOHANG|WALL)\n'),
        ('            ptrace(request, task, data=data)\n            return True\n',
         '            ptrace(request, task, data=data)\n'
         '            if request == GETEVENTMSG:\n'
         "                log('kernel-event-message', pid=task, start=owned[task]['start'],\n"
         "                    waitSequence=consumed_waits[task]['sequence'],\n"
         "                    waitStatus=consumed_waits[task]['status'],\n"
         '                    kernelMessage=ctypes.c_ulong.from_address(data).value)\n'
         '            elif request == CONT:\n'
         "                log('ptrace-cont-returned', pid=task, start=owned[task]['start'],\n"
         "                    signal=data, waitSequence=consumed_waits[task]['sequence'])\n"
         '            return True\n'),
        ("            assert got == task, ('peek/consume mismatch', task, got)\n",
         "            assert got == task, ('peek/consume mismatch', task, got)\n"
         '            # WNOWAIT is an observation, not the consumed status: a fatal\n'
         '            # signal may supersede it. Retain both without inferring lineage.\n'
         "            consumed_waits[task] = dict(status=status, sequence=log('wait-consumed',\n"
         "                pid=task, start=row['start'], waitStatus=status,\n"
         '                beforeConsumeSequence=before, peekCode=peek.si_code, peekStatus=peek.si_status))\n'),
        ("                  execTransfers=list(exec_transfers.values()),\n",
         "                  execTransfers=list(exec_transfers.values()),\n"
         "                  kernelEventEvidenceVersion=1,\n"),
    ]
    for old, new in changes:
        assert source.count(old) == 1, ('candidate source drift', old)
        source = source.replace(old, new)
    return source


def load(version):
    if version == 'current':
        source = Path(__file__).with_name('native_kernel_custody.py').read_text()
    else:
        source = subprocess.check_output(['git', 'show', REVISION+':tools/native_kernel_custody.py']).decode()
        assert hashlib.sha256(source.encode()).hexdigest() == SOURCE_SHA
        if version == 'candidate': source = candidate(source)
    module = types.ModuleType('custody_under_test')
    exec(compile(source, version, 'exec'), module.__dict__)
    return module


def audit(rows):
    """Reject missing/reordered/identity-mismatched evidence; no success receipt."""
    assert [r['sequence'] for r in rows] == list(range(1, len(rows)+1)), 'event loss/order'
    waits = {}; messages = []; releases = []; peeks = {}
    for row in rows:
        if row['kind'] == 'creation-peek-message':
            assert row['observationalOnly'] is True
            peeks[row['beforeConsumeSequence']] = row
        if row['kind'] == 'wait-consumed' and row['peekCode'] == os.CLD_TRAPPED and row['peekStatus'] in (261, 517, 773):
            observation = peeks[row['beforeConsumeSequence']]
            assert (observation['pid'], observation['start']) == (row['pid'], row['start']), 'peek identity mismatch'
            assert observation['sequence'] < row['sequence'], 'peek evidence ordering'
            assert observation['peekStatus'] == row['peekStatus'], 'peek status mismatch'
        if row['kind'] == 'wait-consumed': waits[row['sequence']] = row
        if row['kind'] not in ('kernel-event-message', 'ptrace-cont-request', 'ptrace-cont-returned'): continue
        wait = waits[row['waitSequence']]
        assert (row['pid'], row['start']) == (wait['pid'], wait['start']), 'PID/start mismatch'
        assert wait['sequence'] < row['sequence'], 'evidence ordering'
        if row['kind'] == 'kernel-event-message':
            assert row['waitStatus'] == wait['waitStatus'], 'consumed status mismatch'
            assert os.WIFSTOPPED(row['waitStatus']), 'message without consumed stop'
            messages.append(row)
        else: releases.append(row)
    assert waits and messages and releases, 'exact consumed wait/message/CONT evidence absent'
    return messages


def retrieve_actual_consumer(run, drain, corrupt=None):
    """Execute actual1395's no-input inventory/retrieval with local file transport.

    Input is this fixture's real supervisor journal/receipt, never fabricated
    custody. Only the transport is local; the generated consumer runs unchanged.
    """
    root = Path(__file__).resolve().parent.parent
    wrapper = root/'scratch/runs/20261109-redline-current-module-startup-fixture-1395/recover.py'
    spec = importlib.util.spec_from_file_location('retrieval_composition', root/'tools/redline-terminal-cleanup.py')
    repair = importlib.util.module_from_spec(spec); spec.loader.exec_module(repair)
    source = repair.compose('retrieval', repair.wrapper_source(wrapper))
    directory = run/('consumer-'+corrupt if corrupt else 'consumer')
    remote_root = directory/'remote'/'run'; remote_custody = remote_root/'fixture-custody'
    remote_custody.mkdir(parents=True); (remote_root/'native-fixture').mkdir()
    for name in (drain['journal']['path'], 'kernel-drain.json'):
        shutil.copyfile(run/name, remote_custody/name)
    (remote_root/'runtime-pins.json').write_text('{"files":[]}')
    local = directory/'local'; local.mkdir()
    control = types.ModuleType('control')
    control.R = local; control.RUN = 'run'; control.REMOTE = str(remote_root.parent)
    def remote(name, code, timeout):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream): exec(compile(code, name, 'exec'), {})
        return dict(stdout=stream.getvalue())
    def download(source, destination, row):
        data = Path(source).read_bytes()
        assert len(data)==row['size'] and hashlib.sha256(data).hexdigest()==row['sha256']
        if corrupt and 'custody.ndjson' in row['path']:
            decoded = gzip.decompress(data) if row['path'].endswith('.gz') else data
            lines = decoded.splitlines(keepends=True)
            if corrupt=='loss': lines.pop(0)
            else: lines[0], lines[1] = lines[1], lines[0]
            data = b''.join(lines)
            if row['path'].endswith('.gz'): data = gzip.compress(data, mtime=0)
        Path(destination).write_bytes(data)
    def save(name, value):
        (local/(name if name.endswith('.json') else name+'.json')).write_text(json.dumps(value))
    control.remote = remote; control.t = types.SimpleNamespace(download=download)
    control.save = control.durable = save
    with patch.dict(sys.modules, {'control': control}), patch.object(sys, 'argv', ['recover.py', 'fixture']), contextlib.redirect_stdout(io.StringIO()):
        exec(compile(source, str(wrapper), 'exec'), dict(__name__='__main__', __file__=str(wrapper)))
    receipt = json.loads((local/'fixture-retrieval-verified.json').read_text())
    assert receipt['kernelComplete']==drain['complete']
    assert receipt['fixturePASS'] is False and receipt['collectionIsNotBrowserEOF'] is True
    path = local/'retrieved'/'fixture-custody'/drain['journal']['path']
    # The actual consumer compresses large plain logs before transfer.
    if not path.exists(): path = path.with_name(path.name+'.gz')
    data = path.read_bytes()
    if path.name.endswith('.gz'): data = gzip.decompress(data)
    assert hashlib.sha256(data).hexdigest()==drain['journal']['originalSha256']
    return [json.loads(s) for s in data.splitlines()]


def fixture(run, version, mode):
    kernel = load(version)
    spec = importlib.util.spec_from_file_location('existing_custody_controls', Path(__file__).with_name('native_kernel_custody_test.py'))
    existing = importlib.util.module_from_spec(spec); spec.loader.exec_module(existing)
    existing.kernel = kernel
    if mode == 'superseded':
        waitpid = os.waitpid; selected = []
        def consume(task, flags):
            peek = os.waitid(os.P_PID, task, os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
            if not selected and peek and peek.si_code == os.CLD_TRAPPED and peek.si_status == 773:
                child = ctypes.c_ulong(); kernel.ptrace(kernel.GETEVENTMSG, task, data=ctypes.addressof(child))
                selected.append(child.value)
                os.kill(task, signal.SIGKILL)
                due = time.monotonic()+2
                while time.monotonic()<due:
                    value = os.waitid(os.P_PID, task, os.WEXITED|os.WSTOPPED|os.WNOHANG|os.WNOWAIT|kernel.WALL)
                    if value and value.si_status == 1541: break
                    time.sleep(.001)
                else: raise AssertionError('real superseding EXIT stop missing')
                (run/'superseded-witness.json').write_text(json.dumps(dict(pid=task, child=child.value, peekStatus=peek.si_status, supersedingStatus=value.si_status)))
            return waitpid(task, flags)
        with patch.object(kernel.os, 'waitpid', side_effect=consume):
            due = time.time()+3
            kernel.supervise(run, [sys.executable, '-c', 'import threading,time;threading.Thread(target=lambda:time.sleep(20)).start();time.sleep(20)'],
                deadline=due, cleanup_deadline=due+2, journal_compression='gzip')
    elif mode in ('clone-cancel', 'fork-cancel', 'exec'):
        existing.cancel_creators_fixture(run, 'exec' if mode == 'exec' else mode.split('-')[0], 'fixed')
    elif mode in ('early-stop', 'late-parent', 'reuse'):
        existing.parked_fixture(run, fork_only=mode != 'early-stop', reuse=mode == 'reuse')
    else:
        due = time.time()+3
        command = "import os,time;p=os.fork();os._exit(0) if p else None;time.sleep(.03);os.execl('/bin/echo','echo','inherited-writer')"
        kernel.supervise(run, [sys.executable, '-c', command], deadline=due, cleanup_deadline=due+2,
                         journal_compression='gzip', command_compression='gzip')


def isolated(run, version, mode):
    # Prearm an independent process deadline before starting the actual fixture.
    kernel = load(version)
    assert kernel.libc.prctl(36, 1, 0, 0, 0) == 0
    gate_r, gate_w = os.pipe()
    child = os.fork()
    if child == 0:
        os.close(gate_w); os.setsid(); assert os.read(gate_r, 1) == b'1'; os.close(gate_r)
        try: fixture(run, version, mode)
        except BaseException as error:
            (run/'fixture-error.json').write_text(json.dumps(repr(error))); os._exit(1)
        os._exit(0)
    watchdog = os.fork()
    if watchdog == 0:
        os.close(gate_r); os.close(gate_w)
        start = kernel.identity(child)['start']
        (run/'independent-watchdog.json').write_text(json.dumps(dict(pid=child, start=start, deadline=time.time()+15)))
        time.sleep(15)
        try:
            if kernel.identity(child)['start'] == start: os.killpg(child, signal.SIGKILL)
        except (ProcessLookupError, FileNotFoundError): pass
        (run/'watchdog-fired.json').write_text('{}'); os._exit(0)
    os.close(gate_r)
    while not (run/'independent-watchdog.json').exists(): time.sleep(.001)
    os.write(gate_w, b'1'); os.close(gate_w)
    _, status = os.waitpid(child, 0)
    os.kill(watchdog, signal.SIGTERM); _, watch_status = os.waitpid(watchdog, 0)
    adopted = []
    while True:
        try:
            pid, result = os.waitpid(-1, 0); adopted.append(dict(pid=pid, status=result))
        except ChildProcessError: break
    (run/'actual-waits.json').write_text(json.dumps(dict(wait=os.waitstatus_to_exitcode(status),
        watchdogWait=os.waitstatus_to_exitcode(watch_status), adopted=adopted)))


class ActualEventRetention(unittest.TestCase):
    def test_actual_consumers_old_missing_new_precise_and_loss_negatives(self):
        versions = ('before', 'candidate', 'current')
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(os.environ.get('CUSTODY_LINEAGE_EVIDENCE', tmp)); base.mkdir(parents=True, exist_ok=True)
            for version in versions:
                for mode in ('writer', 'clone-cancel', 'fork-cancel', 'exec', 'early-stop', 'late-parent', 'reuse', 'superseded'):
                    with self.subTest(version=version, mode=mode):
                        run = Path(tempfile.mkdtemp(prefix=version+'-'+mode+'-', dir=base))
                        result = subprocess.run([sys.executable, __file__, '--isolated', str(run), version, mode], capture_output=True, timeout=22)
                        self.assertEqual(result.returncode, 0, result.stderr.decode())
                        (run/'consumer-wait.json').write_text(json.dumps(dict(wait=result.returncode, stdoutEOF=True, stderrEOF=True)))
                        self.assertFalse((run/'watchdog-fired.json').exists())
                        drain = json.loads((run/'kernel-drain.json').read_text())
                        data = (run/drain['journal']['path']).read_bytes()
                        if drain['journal']['path'].endswith('.gz'): data = gzip.decompress(data)
                        self.assertEqual(hashlib.sha256(data).hexdigest(), drain['journal']['originalSha256'])
                        rows = [json.loads(s) for s in data.splitlines()]
                        self.assertEqual(retrieve_actual_consumer(run, drain), rows)
                        if version=='current' and mode=='writer':
                            for corrupt in ('loss', 'order'):
                                with self.assertRaises(AssertionError): retrieve_actual_consumer(run, drain, corrupt)
                                self.assertFalse((run/('consumer-'+corrupt)/'local/fixture-retrieval-verified.json').exists())
                        if version == 'before':
                            with self.assertRaisesRegex(AssertionError, 'evidence absent'): audit(rows)
                        else:
                            messages = audit(rows)
                            # Retained through actual Journal -> gzip/plain -> real consumer.
                            for corrupt in ('loss', 'order', 'identity', 'status'):
                                broken = [dict(row) for row in rows]
                                index = next(i for i, row in enumerate(broken) if row['kind']=='kernel-event-message')
                                if corrupt == 'loss': broken.pop(index)
                                elif corrupt == 'order': broken[index-1], broken[index] = broken[index], broken[index-1]
                                elif corrupt == 'identity': broken[index]['start'] += '-reused'
                                else: broken[index]['waitStatus'] = 0
                                with self.assertRaises((AssertionError, KeyError)): audit(broken)
                            self.assertTrue(messages)
                            peek_index = next(i for i, row in enumerate(rows) if row['kind']=='creation-peek-message')
                            broken = [dict(row) for row in rows]
                            broken.pop(peek_index)
                            # Even a loss that rewrites every sequence must
                            # fail the semantic peek/consumption association.
                            for row in broken:
                                if row['sequence']>rows[peek_index]['sequence']: row['sequence']-=1
                                for key in ('waitSequence', 'beforeConsumeSequence'):
                                    if row.get(key, 0)>rows[peek_index]['sequence']: row[key]-=1
                            with self.assertRaises((AssertionError, KeyError)): audit(broken)
                        if mode == 'superseded':
                            self.assertFalse(drain['complete']); self.assertTrue(drain['unresolvedLineage'])
                            if version != 'before':
                                witness = json.loads((run/'superseded-witness.json').read_text())
                                consumed = next(r for r in rows if r['kind']=='wait-consumed' and r['peekStatus']==773)
                                self.assertEqual(consumed['waitStatus'] >> 16, 6)
                                observation = next(r for r in rows if r['kind']=='creation-peek-message' and r['beforeConsumeSequence']==consumed['beforeConsumeSequence'])
                                self.assertTrue(observation['observationalOnly'])
                                self.assertEqual(observation['kernelMessage'], witness['child'])
                                self.assertIsNone(observation['errno'])
                                self.assertEqual(drain['unresolvedLineage'][0]['pid'], witness['child'])
                        elif mode == 'early-stop':
                            self.assertFalse(drain['complete']); self.assertTrue(drain['unresolvedLineage'])
                            self.assertFalse((run/'unlinked-userspace-ran').exists())
                        elif mode == 'reuse':
                            self.assertFalse(drain['complete']); self.assertIn('PID reused', drain['failure'])
                        else: self.assertTrue(drain['complete'], drain)
                        if mode == 'writer':
                            self.assertTrue(drain['commandLog']['eof'])
                            self.assertEqual(gzip.decompress((run/'kernel-command.log.gz').read_bytes()), b'inherited-writer\n')


if __name__ == '__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--isolated': isolated(Path(sys.argv[2]), sys.argv[3], sys.argv[4])
    else: unittest.main()

"""Real Node output under ptrace: bytes, preemption, durable CONT and failure.

No Chrome. The injection makes an actual child create a kernel stop while the
supervisor is inside its output pump; no wait/CONT/receipt is synthesized.
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
import unittest
from unittest.mock import patch

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=False)
assert out.is_relative_to(root / 'scratch/runs')
sys.path.insert(0, str(root / 'tools'))
adapter = runpy.run_path(str(root / 'tools/q3-startup-custody.py'))
import native_kernel_custody as original

spec = importlib.util.spec_from_file_location('controls', root / 'tools/native_kernel_custody_test.py')
controls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controls)
controls.kernel = adapter['load']()
suite = unittest.TestSuite(controls.RetirementService(name) for name in (
    'test_native_executable_cont_always_has_durable_ordered_prefix',
    'test_failed_sync_is_sticky_at_saturation_admission_and_finalization',
    'test_final_sync_failure_cannot_accept_fully_reaped_run',
    'test_bounded_ordered_batches_and_oversize_record_preserve_all_bytes'))
assert unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()

results = []
for name, module in (('published', original), ('fixed', adapter['load']())):
    run = out / name
    run.mkdir()
    gate = run / 'gate'
    script = '''const fs=require('node:fs'),cp=require('node:child_process');
fs.writeSync(1,Buffer.alloc(8192,65));
const poll=setInterval(()=>{if(!fs.existsSync(process.argv[1]))return;
clearInterval(poll);const child=cp.spawn('/bin/true',[],{stdio:'ignore'});
child.once('close',()=>{fs.writeSync(1,Buffer.alloc(65536,66));});},1);
'''
    read, write, waitpid = os.read, module.Journal.write, os.waitpid
    injected = False
    pending_before_write = []
    flags = os.WEXITED | os.WSTOPPED | os.WNOHANG | os.WNOWAIT | module.WALL
    def observed_read(fd, size):
        global injected
        data = read(fd, size)
        if data and not injected:
            injected = True
            gate.write_text('release actual Node spawn')
            due = time.monotonic() + 3
            while os.waitid(os.P_ALL, 0, flags) is None:
                assert time.monotonic() < due, 'actual kernel stop absent'
                time.sleep(.001)
        return data
    def observed_write(journal, data):
        if journal.path.name == 'kernel-command.log.gz':
            try: pending = os.waitid(os.P_ALL, 0, flags)
            except ChildProcessError: pending = None
            if pending: pending_before_write.append(dict(pid=pending.si_pid, status=pending.si_status))
        return write(journal, data)
    due = time.time() + 12
    with patch.object(module.os, 'read', side_effect=observed_read), patch.object(module.Journal, 'write', observed_write):
        module.supervise(run, ['node', '-e', script, str(gate)], deadline=due,
                         cleanup_deadline=due+5, journal_compression='gzip', command_compression='gzip')
    assert injected
    data = gzip.decompress((run / 'kernel-command.log.gz').read_bytes())
    assert data == b'A'*8192 + b'B'*65536
    drain = json.loads((run / 'kernel-drain.json').read_bytes())
    assert drain['complete'] and drain['commandLog']['eof']
    assert len(drain['owned']) == len(drain['reaped']) >= 2
    if name == 'published': assert pending_before_write
    else: assert not pending_before_write
    results.append(dict(mode=name, pendingStopOutputWrites=pending_before_write,
                        bytes=len(data), allReaped=True))
(out / 'causal-output-service.json').write_text(json.dumps(results, indent=2))
phase_run = out / 'phase-arm'
phase_run.mkdir()
node = '''const fs=require('node:fs'),cp=require('node:child_process'),r=process.argv[1];
fs.writeSync(1,'startup without phase records\\n');
setTimeout(()=>{
fs.writeFileSync(r+'/input-service-arm.json',JSON.stringify({at:Date.now(),monotonicNs:process.hrtime.bigint().toString()}));
const child=cp.spawn('/bin/true',[],{stdio:'ignore'});child.once('close',()=>process.exit(0));
},30);
'''
due = time.time()+8
adapter['supervise'](phase_run, ['node', '-e', node, str(phase_run)],
                     deadline=due, cleanup_deadline=due+3,
                     journal_compression='gzip', command_compression='gzip')
phase = json.loads((phase_run/'q3-input-service.json').read_bytes())
assert phase['armed'] and not phase['error'] and not phase['dropped']
assert 0 < len(phase['records']) <= 512
assert all(row['monotonicNs'] >= int(phase['armed']['monotonicNs']) for row in phase['records'])
assert any(row['kind']=='waitpid-return' and row['task'].get('start') for row in phase['records'])
assert any(row['kind']=='CONT-entry' and row['task'].get('start') for row in phase['records'])
assert any(row['kind']=='fsync-entry' for row in phase['records'])
print(json.dumps(dict(passed=True, actualNodeConsumer=True, results=results)))

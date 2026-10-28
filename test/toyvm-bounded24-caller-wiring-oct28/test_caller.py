#!/usr/bin/env python3
"""Exercise the real CLI function with injected bounded backend/child fixtures."""
import contextlib
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
import tempfile
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RECEIPT = pathlib.Path(sys.argv[1])
CALLER = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / 'qualify_accounted.py'
spec = importlib.util.spec_from_file_location('qualification_caller', CALLER)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
c.ROOT = ROOT
checks = []
limits = dict(live_limit=32768, write_limit=65536, file_limit=16384,
              rss_limit=128*1024**2, cpu_limit=1.25, wall_limit=2.5, output_limit=4096)
command = [sys.executable, '-B', '-c', 'print("bounded child success")']


def invoke(work, domain='tiny-fixture', receipt=RECEIPT, budget=None, child=None):
    args = ['--domain', domain, '--receipt', str(receipt), '--work', str(work)]
    for key, value in (budget or limits).items():
        args.extend(['--' + key.replace('_', '-'), str(value)])
    stream = io.StringIO()
    with contextlib.redirect_stdout(stream):
        code = c.main(args + ['--'] + (child or command))
    report = json.loads(stream.getvalue())
    assert report['browserAllowed'] is False
    assert report['browserAllowanceRemaining'] == c.BROWSER_ALLOWANCE
    assert code == (0 if report['accepted'] else 1)
    return report


def success():
    return dict(exit=0, stopReason=None, peakRSS=10000000, cpuSeconds=.01, wallSeconds=.1,
                output=b'bounded child success\n', cleanupComplete=True,
                filesystem=dict(live=12288, peak=12288, written=5, failure=None, openHandles=0),
                filesystemCleanup=dict(unmountExit=0, remainingMounts=[], serverExit=-15,
                                       serverStdout='', serverStderr=''))


with tempfile.TemporaryDirectory(prefix='caller-fixtures-', dir=HERE) as tmp:
    work = pathlib.Path(tmp)
    # Earliest production boundary first: real main -> exact pinned loader ->
    # accepted adapter. Stop at server creation, before any mount or child.
    with patch('subprocess.Popen', side_effect=RuntimeError('fixture stops before filesystem server')) as spawn:
        report = invoke(work)
        assert not report['accepted'] and 'fixture stops before filesystem server' in report['error']
        assert spawn.call_count == 1
        actual = spawn.call_args.args[0]
        assert pathlib.Path(actual[2]) == ROOT / 'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py'
        assert actual[3:] == [str(work / 'domain'), str(work / 'status.sock'), '32768', '65536', '16384']
    checks.append('production-entry-pinned-adapter-delegation-before-mount')

    for domain in ['browser', 'browser-profile', 'unknown']:
        with patch.object(c, 'load_backend', side_effect=AssertionError('unqualified child setup')) as loader:
            report = invoke(work, domain=domain)
            assert not report['accepted'] and 'unqualified browser/domain' in report['error']
            loader.assert_not_called()
    checks.append('unqualified-domains-rejected-before-backend-or-child')

    for receipt in [work / 'missing.json', work / 'wrong.json']:
        if receipt.name == 'wrong.json':
            receipt.write_text('{}')
        with patch.object(c, 'load_backend', side_effect=AssertionError('missing contract started child')) as loader:
            report = invoke(work, receipt=receipt)
            assert not report['accepted'] and ('FileNotFoundError' in report['error'] or 'receipt identity' in report['error'])
            loader.assert_not_called()
        if receipt.exists():receipt.unlink()
    checks.append('missing-and-wrong-receipt-rejected-before-child')

    calls = []
    children = []
    def fixture_backend(argv, actual_work, **forwarded):
        calls.append(dict(argv=argv, work=actual_work, limits=forwarded))
        child = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=2)
        children.append(dict(exit=child.returncode, stdout=child.stdout.decode(), stderr=child.stderr.decode()))
        result = success()
        result.update(exit=child.returncode, output=child.stdout)
        return result

    with patch.object(c, 'load_backend', return_value=fixture_backend):
        report = invoke(work)
    assert report['accepted'] and report['childSucceeded'] and report['accountingAccepted'] and report['cleanupComplete']
    assert calls == [dict(argv=command, work=work, limits=dict(limits, backend='synchronous-fuse'))]
    assert children == [dict(exit=0, stdout='bounded child success\n', stderr='')]
    checks.append('actual-cli-exact-argv-work-quota-resource-forwarding-and-bounded-child')

    variants = []
    def add(name, update):
        result = success();update(result);variants.append((name, result))
    add('backend-failure-overrides-child-zero', lambda r:r['filesystem'].update(failure='cumulative write quota'))
    add('missing-filesystem-receipt', lambda r:r.pop('filesystem'))
    add('missing-cleanup-receipt', lambda r:r.pop('filesystemCleanup'))
    add('remaining-mount-rejected', lambda r:r['filesystemCleanup'].update(remainingMounts=['owned mount']))
    add('unmount-failure-rejected', lambda r:r['filesystemCleanup'].update(unmountExit=1))
    add('backend-abnormal-cleanup-exit-rejected', lambda r:r['filesystemCleanup'].update(serverExit=1))
    add('open-handles-rejected', lambda r:r['filesystem'].update(openHandles=1))
    add('missing-tree-reap-rejected', lambda r:r.pop('cleanupComplete'))
    add('stop-reason-overrides-child-zero', lambda r:r.update(stopReason='accounting unknown'))
    add('missing-stop-receipt', lambda r:r.pop('stopReason'))
    add('missing-exit-is-not-zero', lambda r:r.pop('exit'))
    add('quota-excess-rejected', lambda r:r['filesystem'].update(written=65537))
    add('cpu-excess-rejected', lambda r:r.update(cpuSeconds=2))
    add('nan-wall-rejected', lambda r:r.update(wallSeconds=float('nan')))
    add('missing-resource-receipt', lambda r:r.pop('peakRSS'))
    add('output-limit-rejected', lambda r:r.update(output=b'x'*4097))
    add('child-nonzero-rejected', lambda r:r.update(exit=7))
    variants.append(('missing-entire-receipt', None))
    for name, result in variants:
        with patch.object(c, 'load_backend', return_value=lambda *a, **k:result):
            report = invoke(work)
        assert not report['accepted'], name
        checks.append(name)

    cleanup = success()['filesystemCleanup']
    marker = work / 'owned-child-token'
    def exceptional_backend(*a, **k):
        marker.write_text('owned')
        child = subprocess.Popen([sys.executable, '-B', '-c', 'import time;time.sleep(5)'],
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            raise RuntimeError('bounded backend failure after child success')
        except RuntimeError as error:
            error.filesystemCleanup = cleanup
            raise
        finally:
            child.terminate()
            out, err = child.communicate(timeout=2)
            assert not pathlib.Path('/proc', str(child.pid)).exists()
            children.append(dict(exit=child.returncode, stdout=out.decode(), stderr=err.decode()))
            marker.unlink()
    with patch.object(c, 'load_backend', return_value=exceptional_backend):
        report = invoke(work)
    assert not report['accepted'] and not marker.exists()
    assert report['filesystemCleanup'] == cleanup and report['filesystemCleanupComplete']
    assert not report['cleanupComplete']
    checks.append('exception-cleanup-retained-without-invented-child-reap')

    for key, value in [('rss_limit',129*1024**2), ('wall_limit',121), ('cpu_limit',float('nan')),
                       ('file_limit',32769), ('write_limit',0)]:
        budget = dict(limits);budget[key]=value
        with patch.object(c, 'load_backend', side_effect=AssertionError('invalid limit started backend')) as loader:
            assert not invoke(work, budget=budget)['accepted']
            loader.assert_not_called()
    checks.append('unsupported-limits-rejected-before-child')

    wrong = dict(c.BACKEND_PINS)
    wrong[next(iter(wrong))] = '0'*64
    with patch.object(c, 'BACKEND_PINS', wrong), patch('subprocess.Popen', side_effect=AssertionError('wrong pin child')) as spawn:
        report = invoke(work)
        assert not report['accepted'] and 'identity mismatch' in report['error']
        spawn.assert_not_called()
    checks.append('source-pin-rejected-before-child')

print(json.dumps(dict(checks=len(checks), passed=checks, children=children,
                     browserAllowed=False, browserAllowanceRemaining=c.BROWSER_ALLOWANCE,
                     productionMounts=0, productionChildren=0, fixtureChildren=2)))

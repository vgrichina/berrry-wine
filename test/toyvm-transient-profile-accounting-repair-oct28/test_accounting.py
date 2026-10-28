#!/usr/bin/env python3
"""Source-only diagnostic: never imports/executes the browser guard's main body.

The unchanged check() AST is compiled in isolation. Files are at most 8192B.
Large-size gates use explicitly injected stat metadata, not large fixtures.
"""
import ast
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import types
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
GUARD_SHA = 'c332e1d3ee0e9a0c47af78e9be0638eafc522e93251bc1a507902094d4a8992f'
SUPERVISOR_SHA = '9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
guard = (HERE/'pinned-guard.py').read_bytes()
supervisor = (HERE/'pinned-supervisor.py').read_bytes()
assert hashlib.sha256(guard).hexdigest() == GUARD_SHA
assert hashlib.sha256(supervisor).hexdigest() == SUPERVISOR_SHA
tree = ast.parse(guard)
function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'check')
code = compile(ast.Module(body=[function], type_ignores=[]), 'pinned-guard.py', 'exec')


class Clock(datetime.datetime):
    @classmethod
    def now(cls, tz=None):
        # Only isolate the already-expired cutoff. Resource code AST unchanged.
        return cls(2026, 10, 28, 21, 10, tzinfo=datetime.timezone.utc)


def callback(root):
    scope = dict(B=root, datetime=types.SimpleNamespace(datetime=Clock,
                                                       timezone=datetime.timezone))
    exec(code, scope)
    return scope['check']


results = []


def record(name, **evidence):
    results.append(dict(name=name, pass_=True, **evidence))


def raises(kind, action):
    try:
        action()
    except kind as error:
        return str(error)
    raise AssertionError('required rejection missing: '+kind.__name__)


original_stat = pathlib.Path.stat


def interleave(target, action):
    """Real rglob/is_file enumeration; mutate on subsequent accounting stat."""
    calls = 0

    def stat(p, *args, **kwargs):
        nonlocal calls
        if p == target:
            calls += 1
            if calls == 2:
                action()
        return original_stat(p, *args, **kwargs)
    return patch.object(pathlib.Path, 'stat', stat)


spec = importlib.util.spec_from_file_location('trusted_diagnostic', HERE/'pinned-supervisor.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

with tempfile.TemporaryDirectory(prefix='accounting-fixtures-') as temp:
    top = pathlib.Path(temp)
    root = top/'profile'
    root.mkdir()
    p = root/'.org.chromium.Chromium.hbL1Tj'
    check = callback(root)
    p.write_bytes(b'x'*1024)
    assert check() is None
    record('stable-tiny-file')

    with interleave(p, p.unlink):
        error = raises(FileNotFoundError, check)
    record('exact-disappearance-between-is_file-and-stat', error=error)

    p.write_bytes(b'x'*1024)
    with interleave(p, lambda: (_ for _ in ()).throw(PermissionError('controlled EACCES'))):
        raises(PermissionError, check)
    record('permission-error-fails-closed')

    # Synthetic metadata keeps fixtures tiny while testing unchanged thresholds.
    def metadata(size):
        def stat(q, *a, **kw):
            s = original_stat(q, *a, **kw)
            if q != p:
                return s
            fields = list(s)
            fields[6] = size
            return os.stat_result(fields)
        return patch.object(pathlib.Path, 'stat', stat)

    for size, expected in [(128*1024**2+1, 'remote128MiB'),
                           (24*1024**2+1, 'perfile24MiB')]:
        with metadata(size):
            assert check() == expected
        record('persistent-overlimit-'+expected, injectedStatSize=size)

    # Hold an allocated inode across unlink. Retrying a pathname traversal
    # cannot discover it even if every pathname operation is perfectly safe.
    p.write_bytes(b'x'*8192)
    with p.open('rb') as fd:
        with interleave(p, p.unlink):
            raises(FileNotFoundError, check)
        s = os.fstat(fd.fileno())
        assert s.st_nlink == 0 and s.st_size == 8192 and s.st_blocks > 0
        assert check() is None
        hidden = dict(size=s.st_size, allocated=s.st_blocks*512, links=s.st_nlink)
        record('retry-cannot-see-open-unlinked-inode', **hidden)

    p.write_bytes(b'x'*8192)
    outside = top/'renamed-outside-root'

    def rename_replace():
        p.rename(outside)
        p.write_bytes(b'x')

    with p.open('rb') as fd, interleave(p, rename_replace):
        assert check() is None
        assert os.fstat(fd.fileno()).st_size == 8192 and p.stat().st_size == 1
    record('rename-and-replacement-accepted-by-old-check', oldSize=8192, newSize=1)
    p.unlink()
    p.symlink_to(outside)
    assert check() is None
    assert p.stat().st_ino == outside.stat().st_ino
    record('old-check-follows-escaping-symlink')
    p.unlink()

    # No sample during a create/write/unlink cycle: both sampled inventories
    # are identical, while invocation-total written bytes and true peak differ.
    assert check() is None
    p.write_bytes(b'x'*8192)
    peak = p.stat().st_size
    p.unlink()
    assert check() is None
    record('between-samples-peak-and-cumulative-invisible', hiddenPeak=peak)

    # Negative mutations of suggested fixes. The safety oracle requires a
    # rejection when the hidden inode cannot be conservatively charged.
    def ignoring():
        try:
            return check()
        except FileNotFoundError:
            return None

    def retrying():
        try:
            return check()
        except FileNotFoundError:
            return check()

    def safety_oracle(candidate_result, inode):
        # The fixture supplies privileged ground truth unavailable to check().
        if candidate_result is None and inode.st_nlink == 0 and inode.st_blocks:
            raise m.AccountingUnknown('accepted sample omitted an allocated open inode')

    for name, unsafe in [('blanket-ENOENT-ignore', ignoring), ('full-sample-retry', retrying)]:
        p.write_bytes(b'x'*8192)
        with p.open('rb') as fd, interleave(p, p.unlink):
            result = unsafe()
            inode = os.fstat(fd.fileno())
            assert result is None and inode.st_nlink == 0
            rejection = raises(m.AccountingUnknown, lambda: safety_oracle(result, inode))
        record('safety-oracle-rejects-mutant-'+name, candidateAccepted=True,
               safetyAcceptance=False, rejection=rejection)

    # Exact production supervisor, unchanged callback, real short subprocess.
    p.write_bytes(b'x')
    with interleave(p, p.unlink):
        r = m.supervise([sys.executable, '-c', 'import time;time.sleep(.05)'],
                        rss_limit=128*1024**2, cpu_limit=90, wall_limit=120,
                        output_limit=2*1024**2, check=check)
    assert r['stopReason'].startswith('accounting check failed: ')
    assert r['cleanupComplete']
    record('production-supervisor-retains-error-and-cleans-up',
           stopReason=r['stopReason'], cleanupComplete=r['cleanupComplete'])

    called = []
    r = m.supervise([sys.executable, '-c', 'import time;time.sleep(.05)'],
                    rss_limit=1, cpu_limit=90, wall_limit=120,
                    output_limit=2*1024**2, check=lambda: called.append(True))
    assert r['stopReason'] == 'aggregate RSS limit' and not called and r['cleanupComplete']
    record('existing-RSS-rejection-precedes-accounting', cleanupComplete=True)

print(json.dumps(dict(status='BLOCKED_STRONG_ACCOUNTING_UNAVAILABLE',
                      guardSHA256=GUARD_SHA, supervisorSHA256=SUPERVISOR_SHA,
                      callbackASTUnchanged=True, cutoffClockOnlyIsolated=True,
                      browserInvocations=0, productionRepair=False,
                      results=results), indent=2))

#!/usr/bin/env python3
"""Real lightweight Node production-entry controls; no browser/guest/build.

The independent oracle/injection files are never edited. Only their historical
runner hash and authorized executable are rebound outside those files.
"""
import ast
import errno
import hashlib
import importlib.util
import json
import os
import pathlib
import runpy
import sys
import tempfile
import types
import unittest
from unittest import mock

P = pathlib.Path
ROOT = P(__file__).resolve().parent.parent
NODE = '/home/user/.nvm/versions/node/v24.18.1/bin/node'
SPEC = importlib.util.spec_from_file_location('confinement', ROOT/'test/test-gl-output-file-confinement.py')
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)
RUNNER = C.RUNNER
SOURCE = RUNNER.read_text()
LATE = ROOT/'docs/reviews/gl-anonymous-output-staging-repair-oct27/reproducer/hardlink-race.py'


def independent():
    i = C.load_independent()
    i.NODE = NODE
    # Synthetic oracle result tests the production success/collection path. These
    # observations are fixture objects, never WebGL qualification evidence.
    payload = dict(wasmSha256='module-pin', stage='passed', results=[
        dict(version=v, observations=[{}]*42, stats=dict(fallbacks=0)) for v in (1, 2)])
    i.workload = ('const fs=require("fs");fs.writeFileSync(process.env.PALETTE_GPU_EVIDENCE,'
                  + json.dumps(json.dumps(payload)) + ');console.log("synthetic routing only");')
    return i


def exercise(source=SOURCE, hook=None):
    i = independent()
    manager = hook if hook is not None else mock.patch.dict({}, {})
    def spec(name, path, *a, **kw):
        s = i.bridge_spec(name, path, *a, **kw)
        if P(path).name == 'collect-evidence.py':
            load = s.loader.exec_module
            def loading(mod):
                load(mod)
                collect = mod.collect
                def audit(root):
                    j = collect(root)
                    e = P(root)/'ops/output'
                    files = {p.name: dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in e.iterdir()}
                    assert j['files'] == files
                    receipts = [json.loads((e/n).read_text()) for n in files if n.endswith('-receipt.json')]
                    assert j['receiptCount'] == len(receipts)
                    assert j['owned'] == [v for r in receipts for v in r['owned']]
                    assert j['cleanupComplete'] == (bool(receipts) and all(r['cleanupComplete'] for r in receipts))
                    return j
                mod.collect = audit
            s.loader.exec_module = loading
        return s
    with mock.patch.object(importlib.util, 'spec_from_file_location', spec), manager:
        result = i.t.exercise(source)
    return result, i


def assert_normal(r):
    assert r['error'] is None, r['error']
    assert r['collectorError'] is None, r['collectorError']
    assert r['children'] == ['startup', 'test']
    a = r['artifacts']
    assert a['checkpoint.json']['success']
    assert a['remote-final-accounting.json']['accountingComplete']
    assert a['remote-final-accounting.json']['completeBytes'] == r['actualBytes']
    assert all(s['bytes'] == s['actual'] and s['complete'] == s['actualComplete'] for s in r['samples'])
    assert max(s['staging'] for s in r['samples']) > 0
    assert not any(p.endswith('.new') for p in r['files'])
    c = r['collected']
    assert c['receiptCount'] == 2 and c['cleanupComplete'] and c['testInvoked']
    assert set(c['files']) == {p.split('/')[-1] for p in r['files'] if p.startswith('ops/output/')}
    assert 'test-result.json' in c['files'] and 'test.log' in c['files']
    for n, d in c['files'].items():
        assert d['bytes'] > 0 and len(d['sha256']) == 64, n


def late_challenge(source):
    """Run the byte-exact rejected script; independently judge changed behavior.

    The original named-inode hardlink action remains in its os.write hook.
    Its len(injected)==1 assertion is now unreachable by design, so the adapter
    records actual production completion and anonymous writes before interpreting
    that historical assertion. An exception alone can never satisfy this test.
    """
    assert hashlib.sha256(LATE.read_bytes()).hexdigest() == '109fde795e3489590db0203e96cdfe0f44b5a9ca037a1e832a4bb38ee66d4efe'
    i = independent()
    i.source = source
    seen = []
    observed = []
    real_write = os.write
    entry = i.t.exercise
    with tempfile.TemporaryDirectory(prefix='gl-anonymous-challenge-') as tmp:
        def watch_write(fd, data):
            path = os.readlink('/proc/self/fd/' + str(fd))
            if '/ops/output/' in path:
                observed.append(dict(path=path, links=os.fstat(fd).st_nlink, bytes=len(data)))
            return real_write(fd, data)
        def watch_entry(code):
            r = entry(code)
            outside = list(P(tmp).glob('independent-late-link-*/external-log'))
            seen.append(dict(result=r, externalBytes=sum(p.stat().st_size for p in outside),
                             externalAllocated=sum(p.stat().st_blocks*512 for p in outside),
                             externalNames=len(outside)))
            return r
        adapter = types.ModuleType('accept')
        adapter.O = P(tmp)
        adapter.load = lambda: vars(i)
        adapter.sha = lambda p: hashlib.sha256(P(p).read_bytes()).hexdigest()
        adapter.RUNNER, adapter.REPRO = RUNNER, C.REPRO
        adapter.NODE, adapter.FLAGS = NODE, ['--max-old-space-size=512']
        historical = None
        with mock.patch.dict(sys.modules, accept=adapter), mock.patch.object(i.t, 'exercise', watch_entry), mock.patch.object(os, 'write', watch_write):
            try:
                runpy.run_path(str(LATE))
            except AssertionError as exc:
                historical = repr(exc)
        assert len(seen) == 1, (seen, historical)
        r = seen[0]['result']
        assert_normal(r)
        assert seen[0]['externalBytes'] == seen[0]['externalAllocated'] == seen[0]['externalNames'] == 0
        assert observed and all(w['links'] == 0 and '(deleted)' in w['path'] for w in observed), observed
        assert i.receipts and all(r['cleanupComplete'] and r['stopReason'] is None for r in i.receipts)
        return dict(externalBytes=0, externalAllocated=0, formerlyReachableNamedInode=False,
                    anonymousWrites=len(observed), children=r['children'], collected=True,
                    completeAccounting=True, historicalAssertion=historical, runtimeObservations=0)


class Staging(unittest.TestCase):
    def test_real_node_normal_entry(self):
        r, i = exercise()
        assert_normal(r)
        startup = i.receipts[0]['result']
        self.assertEqual(startup['execPath'], NODE)
        self.assertEqual(startup['version'], 'v24.18.1')
        self.assertIn('--max-old-space-size=512', startup['execArgv'])
        for label in ('Max data size', 'Max address space'):
            line = next(s for s in startup['limits'].splitlines() if s.startswith(label))
            self.assertIn('unlimited            unlimited', line)
        receipt = dict(startup=True, execPath=startup['execPath'], version=startup['version'],
                       flags=startup['execArgv'], limits=startup['limits'],
                       environmentSHA256=hashlib.sha256(json.dumps(startup['environment'], sort_keys=True).encode()).hexdigest(),
                       environmentKeys=sorted(startup['environment']), physicalCap=128*1048576,
                       cleanupComplete=i.receipts[0]['cleanupComplete'], stopReason=i.receipts[0]['stopReason'],
                       heapIsNotPhysicalCap=True)
        (ROOT.parent/'ops/node-production-startup.json').write_text(json.dumps(receipt, indent=2))

    def test_unchanged_late_hardlink_action(self):
        report = late_challenge(SOURCE)
        out = ROOT.parent/'ops/anonymous-late-hardlink.json'
        out.write_text(json.dumps(report, indent=2))

    def test_unsupported_open_and_publication_refuse(self):
        real_open = os.open
        for kind in ('open', 'link'):
            seen = []
            def denied_open(path, flags, *a, **kw):
                if flags & os.O_TMPFILE == os.O_TMPFILE:
                    seen.append(True)
                    raise OSError(errno.EOPNOTSUPP, 'O_TMPFILE deliberately unsupported')
                return real_open(path, flags, *a, **kw)
            hook = (mock.patch.object(os, 'open', denied_open) if kind == 'open' else
                    mock.patch.object(os, 'link', side_effect=OSError(errno.EPERM, 'publication deliberately denied')))
            r, _ = exercise(hook=hook)
            self.assertTrue(r['error'])
            self.assertEqual(r['children'], [])
            self.assertFalse(r['artifacts'].get('remote-final-accounting.json', {}).get('accountingComplete'))
            self.assertFalse(any(p.startswith('ops/output/') for p in r['files']))

    def test_prepublication_types_and_directory_replacement(self):
        real_link = os.link
        real_write = os.write
        for kind in ('symlink', 'hardlink', 'directory', 'descriptor-directory'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                outside = P(tmp)/'outside'
                outside.write_bytes(b'')
                injected = []
                def write(fd, data):
                    path = P(os.readlink('/proc/self/fd/' + str(fd)))
                    if '/ops/output/' in str(path) and not injected:
                        e = path.parent
                        if kind == 'symlink': (e/'unsafe').symlink_to(outside)
                        elif kind == 'hardlink': real_link(outside, e/'unsafe')
                        else:
                            moved = e.with_name('old-output')
                            e.rename(moved)
                            e.mkdir()
                            if kind == 'descriptor-directory':
                                # The descriptor still refers to old-output;
                                # the public path is a different real directory.
                                self.assertTrue(moved.is_dir())
                        injected.append(True)
                    return real_write(fd, data)
                r, _ = exercise(hook=mock.patch.object(os, 'write', write))
                self.assertEqual(injected, [True])
                self.assertTrue(r['error'])
                self.assertEqual(r['children'], [])
                self.assertEqual(outside.read_bytes(), b'')
                self.assertFalse(r['artifacts'].get('remote-final-accounting.json', {}).get('accountingComplete'))
                self.assertFalse(any(p.endswith('.new') for p in r['files']))

    def test_short_write_failure_closes_unpublished_inode(self):
        real_write = os.write
        captured = []
        def write(fd, data):
            if '/ops/output/' in os.readlink('/proc/self/fd/'+str(fd)):
                captured.append((fd, os.fstat(fd).st_ino))
                real_write(fd, data[:1])
                return 0
            return real_write(fd, data)
        r, _ = exercise(hook=mock.patch.object(os, 'write', write))
        self.assertTrue(r['error'])
        self.assertEqual(r['children'], [])
        self.assertFalse(any(p.startswith('ops/output/') for p in r['files']))
        self.assertTrue(captured)
        for fd, ino in captured:
            try: st = os.fstat(fd)
            except OSError: continue
            self.assertNotEqual(st.st_ino, ino, 'unpublished inode descriptor leaked')

    def test_link_after_publication_has_no_later_producer_write(self):
        real_replace = os.replace
        real_write = os.write
        with tempfile.TemporaryDirectory() as tmp:
            outside = P(tmp)/'external'
            identity = []
            writes_after = []
            def replace(a, b):
                real_replace(a, b)
                if P(b).name == 'node-startup.log':
                    os.link(b, outside)
                    st = outside.stat()
                    identity.append((st.st_dev, st.st_ino))
            def write(fd, data):
                st = os.fstat(fd)
                if (st.st_dev, st.st_ino) in identity: writes_after.append(len(data))
                return real_write(fd, data)
            with mock.patch.object(os, 'replace', replace):
                r, _ = exercise(hook=mock.patch.object(os, 'write', write))
            self.assertTrue(identity)
            self.assertGreater(outside.stat().st_size, 0)  # completed publication is visible
            self.assertEqual(writes_after, [])
            self.assertEqual(r['children'], ['startup'])
            self.assertTrue(r['error'] and r['collectorError'])
            self.assertIsNone(r['collected'])

    def test_named_writable_staging_mutant_is_rejected(self):
        # The exact original implementation is the meaningful staging-removal
        # mutant. It must fail the same action, not just a textual assertion.
        baseline = ROOT/'docs/reviews/gl-anonymous-output-staging-repair-oct27/reproducer/baseline-write.py'
        old = baseline.read_text()
        start = SOURCE.index('    def write(self, name, data):')
        end = SOURCE.index('    def read(self, name):', start)
        mutant = SOURCE[:start] + old + SOURCE[end:]
        with self.assertRaises(AssertionError): late_challenge(mutant)

    def test_publication_failure_removes_only_owned_temporary(self):
        real_replace = os.replace
        def failed_replace(a, b):
            if P(b).name == 'integrity-before.json':
                raise OSError(errno.EIO, 'deliberate publication failure')
            return real_replace(a, b)
        r, _ = exercise(hook=mock.patch.object(os, 'replace', failed_replace))
        self.assertIn('deliberate publication failure', r['error'])
        self.assertEqual(r['children'], [])
        self.assertFalse(any(p.endswith('.new') for p in r['files']))

    def test_publication_guard_removal_mutant(self):
        def challenge(source):
            real_link, real_write = os.link, os.write
            moved = []
            publications = []
            def write(fd, data):
                path = P(os.readlink('/proc/self/fd/'+str(fd)))
                if '/ops/output/' in str(path) and not moved:
                    path.parent.rename(path.parent.with_name('old-output'))
                    path.parent.mkdir()
                    moved.append(True)
                return real_write(fd, data)
            def link(*a, **kw):
                if moved: publications.append(True)
                return real_link(*a, **kw)
            with mock.patch.object(os, 'link', link):
                r, _ = exercise(source, mock.patch.object(os, 'write', write))
            assert moved and r['error'] and r['children'] == []
            assert not publications, 'publication attempted into replaced directory'
        challenge(SOURCE)
        needle = '    def publish(self, directory, name, fd):\n        self.verify(directory)'
        self.assertEqual(SOURCE.count(needle), 1)
        mutant = SOURCE.replace(needle, '    def publish(self, directory, name, fd):\n        pass')
        with self.assertRaisesRegex(AssertionError, 'publication attempted'):
            challenge(mutant)

    def test_anonymous_accounting_omission_mutant(self):
        needle = 'disk.allocated()+outputs.allocated_staging()'
        self.assertEqual(SOURCE.count(needle), 1)
        def challenge(source):
            i = independent()
            # A transient 1 MiB allocation must be measured while the child is
            # alive, even though the published result is later much smaller.
            i.workload = ('const fs=require("fs");fs.writeFileSync(process.env.PALETTE_GPU_EVIDENCE,Buffer.alloc(1048576));'
                          'const until=Date.now()+300;while(Date.now()<until){};' +
                          i.workload.replace('const fs=require("fs");', ''))
            with mock.patch.object(importlib.util, 'spec_from_file_location', i.bridge_spec):
                r = i.t.exercise(source)
            assert_normal(r)
            self.assertGreaterEqual(max(s['staging'] for s in r['samples']), 1048576)
            peak = r['artifacts']['test-receipt.json']['accounting']['peakProjected']
            assert peak >= (352*1048576 + 1048576), 'live anonymous allocation omitted from production accounting'
        challenge(SOURCE)
        with self.assertRaisesRegex(AssertionError, 'live anonymous allocation omitted'):
            challenge(SOURCE.replace(needle, 'disk.allocated()'))

    def test_child_publication_requires_cleanup_receipt(self):
        def challenge(source):
            i = independent()
            injected = []
            def spec(name, path, *a, **kw):
                s = i.bridge_spec(name, path, *a, **kw)
                if P(path).name == 'palette-browser-supervisor.py':
                    load = s.loader.exec_module
                    def loading(mod):
                        load(mod)
                        supervise = mod.supervise
                        def child(argv, **kwargs):
                            r = supervise(argv, **kwargs)
                            if '-c' in argv and 'localFake' not in argv[-1]:
                                assert r['cleanupComplete']  # actual child is gone
                                r['cleanupComplete'] = False  # refusal control only
                                injected.append(True)
                            return r
                        mod.supervise = child
                    s.loader.exec_module = loading
                return s
            with mock.patch.object(importlib.util, 'spec_from_file_location', spec):
                r = i.t.exercise(source)
            assert injected == [True] and r['children'] == ['startup', 'test']
            assert 'test-result.json' not in r['artifacts'], 'child result published without cleanup confirmation'
            assert r['error'] and 'child output writers not safely cleaned up' in r['error']
            assert not any(p.endswith('.new') for p in r['files'])
        challenge(SOURCE)
        needle = "  if rec['stopReason'] is not None or not rec['cleanupComplete']:raise RuntimeError('child output writers not safely cleaned up')\n"
        self.assertEqual(SOURCE.count(needle), 1)
        with self.assertRaisesRegex(AssertionError, 'child result published'):
            challenge(SOURCE.replace(needle, ''))


if __name__ == '__main__':
    unittest.main()

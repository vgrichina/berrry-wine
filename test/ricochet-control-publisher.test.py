"""Affected production writer gates. Tiny local children only; never API/guest."""
import ast
import ctypes
import errno
import hashlib
import importlib.util
import json
import os
import pathlib
import resource
import runpy
import shlex
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest import mock

R = pathlib.Path(__file__).resolve().parents[1]
B = R/'docs/reviews/ricochet-final-inventory-writer-contract-repair-oct27'


def load(name, p):
    s = importlib.util.spec_from_file_location(name, p)
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


P = load('publisher', R/'tools/ricochet/control-publisher.py')
C = load('commands', R/'tools/ricochet/production-commands.py')
A = load('accounting', R/'tools/ricochet/runtime-accounting.py')


class WriterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.h = pathlib.Path(self.tmp.name)
        self.o = self.h/'serial'
        self.o.mkdir()
        self.c = self.o/'continue.json'
        self.retained = self.h/'retained'
        self.retained.write_bytes(b'retained')

    def test_00_every_exact_transformed_api_prefix_and_actual_caller(self):
        manifest = json.loads((B/'producer-manifest.json').read_text())
        helper = R/'tools/ricochet/control-publisher.py'
        (self.h/helper.name).write_bytes(helper.read_bytes())
        for n in C.PRODUCERS:
            with self.subTest(producer=n):
                raw = (B/('api-'+n+'-command.json')).read_bytes()
                command = C.build(raw, manifest['sources'][n], manifest['helperSHA256'])
                self.assertEqual(command, json.loads((B/('bounded-api-'+n+'-command.json')).read_text()))
                source = shlex.split(command['argv'][-1])[-1]
                prefix = source.split(';end=time.monotonic()+30')[0]
                self.assertNotIn('p.write_text', source)
                path = pathlib.Path
                def mapped(value):
                    return self.h if value == C.ROOT else path(value)
                before = self.retained.read_bytes()
                with mock.patch.object(pathlib, 'Path', mapped):
                    exec(compile(prefix, '<exact-transformed-api-prefix>', 'exec'), {})
                self.assertTrue(self.c.is_file())
                self.assertEqual(self.c.stat().st_nlink, 1)
                original = shlex.split(json.loads(raw)['argv'][-1])[-1]
                assignment = next(n for n in ast.parse(original).body if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id == 'j')
                self.assertEqual(json.loads(self.c.read_bytes()), ast.literal_eval(assignment.value))
                self.assertEqual(self.retained.read_bytes(), before)
                self.assertLessEqual(resource.getrlimit(resource.RLIMIT_FSIZE)[1], P.LIMIT)
                self.c.unlink()
                exists = path.exists
                raced = []
                def racing_exists(target):
                    result = exists(target)
                    if target == self.c and not raced:
                        self.c.symlink_to(self.retained)
                        raced.append(True)
                    return result
                with mock.patch.object(pathlib, 'Path', mapped), mock.patch.object(path, 'exists', racing_exists), self.assertRaises(FileExistsError):
                    exec(compile(prefix, '<exact-transformed-api-prefix-attack>', 'exec'), {})
                self.assertEqual(raced, [True])
                self.assertEqual(self.retained.read_bytes(), before)
                self.c.unlink()
                # Test the real CLI's dispatch, intercepting process creation so
                # the actual production API argv cannot execute in source tests.
                with mock.patch.object(sys, 'argv', ['production-commands.py', n, '--bundle', str(B)]), mock.patch.object(subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)) as run:
                    with self.assertRaises(SystemExit) as result:
                        C.main()
                self.assertEqual(result.exception.code, 0)
                run.assert_called_once_with(command['argv'], check=False)

    def test_01_raced_symlink_does_not_modify_retained(self):
        real = ctypes.CDLL
        def library(*args, **kw):
            lib = real(*args, **kw)
            original = lib.linkat
            class Link:
                def __call__(inner, *argv):
                    self.c.symlink_to(self.retained)
                    return original(*argv)
            lib.linkat = Link()
            return lib
        with mock.patch.object(ctypes, 'CDLL', library), self.assertRaises(OSError):
            P.publish(self.o, {'id': 1})
        self.assertEqual(self.retained.read_bytes(), b'retained')
        self.assertTrue(self.c.is_symlink())

    def test_02_existing_regular_symlink_hardlink_and_terminal(self):
        for kind in ('regular', 'symlink', 'dangling', 'hardlink', 'terminal'):
            with self.subTest(kind=kind):
                target = self.o/'done.json' if kind == 'terminal' else self.c
                if kind in ('regular', 'terminal'):
                    target.write_text('old')
                elif kind == 'hardlink':
                    os.link(self.retained, target)
                else:
                    target.symlink_to(self.retained if kind == 'symlink' else self.h/'absent')
                with self.assertRaises(FileExistsError):
                    P.publish(self.o, {'id': 2})
                self.assertEqual(self.retained.read_bytes(), b'retained')
                target.unlink()

    def test_03_concurrent_publishers_one_outstanding(self):
        # Independent process writers do not inherit a fictitious serial.py cap.
        code = ('import importlib.util,sys;'
                's=importlib.util.spec_from_file_location("p",sys.argv[1]);'
                'm=importlib.util.module_from_spec(s);s.loader.exec_module(m);'
                'm.publish(sys.argv[2],{"id":int(sys.argv[3])})')
        children = []
        evidence = pathlib.Path(os.environ['RICOCHET_ACCEPT_OPS'])
        tag = 'concurrent-'+str(time.time_ns())
        commands = []
        for i in range(4):
            out = (evidence/(tag+'-%s.stdout'%i)).open('wb')
            err = (evidence/(tag+'-%s.stderr'%i)).open('wb')
            self.addCleanup(out.close)
            self.addCleanup(err.close)
            argv = [sys.executable, '-B', '-S', '-c', code, str(R/'tools/ricochet/control-publisher.py'), str(self.o), str(i)]
            child = subprocess.Popen(argv, stdout=out, stderr=err)
            commands.append(dict(argv=argv, pid=child.pid, stdout=out.name, stderr=err.name))
            children.append(child)
        exits = [c.wait(timeout=5) for c in children]
        (evidence/(tag+'.json')).write_text(json.dumps(dict(commands=commands, exits=exits, helperSHA256=hashlib.sha256((R/'tools/ricochet/control-publisher.py').read_bytes()).hexdigest(), inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ('RLIMIT_DATA','RLIMIT_AS','RLIMIT_FSIZE','RLIMIT_CPU')}, cleanup='all four waited'), indent=2))
        self.assertEqual(exits.count(0), 1)
        self.assertIn(json.loads(self.c.read_bytes())['id'], range(4))
        self.assertEqual(self.c.stat().st_nlink, 1)
        self.assertEqual(sorted(p.name for p in self.o.iterdir()), ['continue.json'])

    def test_04_oversize_stream_fails_with_no_partial_namespace(self):
        class Encoder:
            def iterencode(self, value):
                return iter(['x'*65536]*385)
        with mock.patch.object(json, 'JSONEncoder', Encoder), self.assertRaises((ValueError, OSError)):
            P.publish(self.o, {})
        self.assertEqual(list(self.o.iterdir()), [])

    def test_05_sparse_and_overallocated_inode_reject(self):
        for size, blocks in ((P.LIMIT+1, 0), (0, P.LIMIT//512+1)):
            with self.subTest(size=size, blocks=blocks):
                fake = types.SimpleNamespace(st_size=size, st_blocks=blocks, st_mode=0o100600)
                with self.assertRaises(ValueError):
                    P.bounded(fake)
        # Real sparse inode exceeds logical maximum without materializing it.
        # Keep the writer's existing FSIZE ceiling; test by opening a sparse
        # file pre-sized via a rejecting lower bound rather than raising limits.
        with (self.h/'sparse').open('wb') as f:
            f.truncate(P.LIMIT)
            s = os.fstat(f.fileno())
            self.assertEqual(s.st_size, P.LIMIT)
            self.assertLess(s.st_blocks*512, s.st_size)
            P.bounded(s)

    def test_06_partial_write_failure_cleans_unnamed_inode(self):
        real = os.write
        hits = []
        def write(fd, data):
            if hits:
                raise OSError(errno.ENOSPC, 'injected write failure')
            hits.append(True)
            return real(fd, data[:1])
        with mock.patch.object(os, 'write', write), self.assertRaises(OSError):
            P.publish(self.o, {'id': 1})
        self.assertEqual(list(self.o.iterdir()), [])

    def test_07_limit_set_before_encoding_and_write(self):
        real = json.JSONEncoder
        def encoder():
            soft, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
            self.assertLessEqual(soft, P.LIMIT)
            self.assertLessEqual(hard, P.LIMIT)
            return real()
        with mock.patch.object(json, 'JSONEncoder', encoder):
            receipt = P.publish(self.o, {'id': 1})
        self.assertLessEqual(receipt['allocated'], P.LIMIT)

    def test_08_final_regular_replacement_and_new_entry_failclosed(self):
        for initially_present in (True, False):
            if initially_present:
                self.c.write_text('{}')
            ledger = A.RuntimeAccounting([self.h], ephemeral_files={self.c:P.LIMIT}, ceiling=256*1048576)
            real = os.scandir
            hits = []
            def scan(fd):
                if isinstance(fd, int) and os.readlink('/proc/self/fd/'+str(fd)) == str(self.o):
                    hits.append(1)
                    if len(hits) == 2:
                        replacement = self.h/'replacement'
                        replacement.write_text('{"new":true}')
                        replacement.replace(self.c)
                return real(fd)
            with mock.patch.object(os, 'scandir', scan), self.assertRaises((A.AccountingError, OSError)):
                ledger.sample()
            self.assertIsNone(ledger.receipt['lastBytes'])
            self.c.unlink()

    def test_09_rejecting_writer_mutation_controls(self):
        source = (R/'tools/ricochet/control-publisher.py').read_text()
        mutant = types.ModuleType('mutant')
        exec(compile(source.replace('max(s.st_size, s.st_blocks * 512) > LIMIT', 'False'), '<unbounded-mutant>', 'exec'), mutant.__dict__)
        fake = types.SimpleNamespace(st_mode=0o100600, st_size=P.LIMIT+1, st_blocks=0)
        with self.assertRaises(ValueError):
            P.bounded(fake)
        self.assertIsNone(mutant.bounded(fake))

    def test_10_executable_staging_recipe_complete_production_entry(self):
        recipe = load('repair_recipe', B/'integrate.py')
        original = R/'docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools'
        for name in ('serial.py', 'remote-supervisor.py', 'trusted-supervisor.py'):
            (self.h/name).write_bytes((original/name).read_bytes())
        child = self.h/'remote-child.py'
        child.write_text('import sys;assert sys.argv[1]=="guest"\n')
        other = self.h.parent/(self.h.name+'-other')
        other.mkdir()
        self.addCleanup(other.rmdir)
        pins = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in (self.h/'serial.py', self.h/'trusted-supervisor.py', child)}
        result = recipe.prepare(self.h, pins, str(other))
        runner = self.h/'remote-supervisor.py'
        self.assertEqual(hashlib.sha256(runner.read_bytes()).hexdigest(), result['runnerSHA256'])
        with mock.patch.object(sys, 'argv', [str(runner), 'guest']), mock.patch.dict(os.environ), mock.patch.object(time, 'time', return_value=0):
            runpy.run_path(str(runner), run_name='__main__')
        receipt = json.loads((self.h/'guest/supervision.json').read_text())
        self.assertEqual(receipt['exit'], 0)
        self.assertIsNone(receipt['stopReason'])
        self.assertTrue(receipt['cleanupComplete'])
        self.assertGreaterEqual(receipt['accounting']['lastBytes'], P.LIMIT)

    def test_11_writer_limit_setup_failure_prevents_any_open(self):
        with mock.patch.object(resource, 'setrlimit', side_effect=ValueError('limit denied')), mock.patch.object(os, 'open') as opening:
            with self.assertRaises(ValueError):
                P.publish(self.o, {})
            opening.assert_not_called()

    def test_12_writer_limit_established_from_unlimited_and_lower_caps(self):
        for inherited, expected in (((-1, -1), (P.LIMIT, P.LIMIT)), ((1024, 2048), (1024, 2048))):
            with mock.patch.object(resource, 'getrlimit', return_value=inherited), mock.patch.object(resource, 'setrlimit') as setting:
                P.writer_limit()
                setting.assert_called_once_with(resource.RLIMIT_FSIZE, expected)

    def test_13_final_content_mutation_and_descriptor_cleanup(self):
        self.c.write_text('{}')
        baseline = len(list(pathlib.Path('/proc/self/fd').iterdir()))
        ledger = A.RuntimeAccounting([self.h], ephemeral_files={self.c:P.LIMIT}, ceiling=256*1048576)
        for _ in range(5):
            ledger.sample()
        real = os.scandir
        hits = []
        def scan(fd):
            if isinstance(fd, int) and os.readlink('/proc/self/fd/'+str(fd)) == str(self.o):
                hits.append(1)
                if len(hits) == 2:
                    self.c.write_text('{"changed":true}')
            return real(fd)
        with mock.patch.object(os, 'scandir', scan), self.assertRaises(A.AccountingError):
            ledger.sample()
        self.assertIsNone(ledger.receipt['lastBytes'])
        self.assertEqual(len(list(pathlib.Path('/proc/self/fd').iterdir())), baseline)

    def test_14_old_final_inventory_mutant_is_killed(self):
        source = (R/'tools/ricochet/runtime-accounting.py').read_text()
        start = source.index('                    else:\n                        q = p/entry.name', source.index('final_names = set()'))
        end = source.index('        finally:', start)
        mutant = types.ModuleType('old_final_inventory')
        exec(compile(source[:start]+source[end:], '<old-final-inventory-mutant>', 'exec'), mutant.__dict__)
        self.c.write_text('{}')
        ledger = mutant.RuntimeAccounting([self.h], ephemeral_files={self.c:P.LIMIT}, ceiling=256*1048576)
        real = os.scandir
        hits = []
        def scan(fd):
            if isinstance(fd, int) and os.readlink('/proc/self/fd/'+str(fd)) == str(self.o):
                hits.append(1)
                if len(hits) == 2:
                    self.c.unlink()
                    self.c.symlink_to(self.retained)
            return real(fd)
        with mock.patch.object(os, 'scandir', scan):
            accepted = ledger.sample()
        self.assertTrue(self.c.is_symlink())
        self.assertIsInstance(accepted, dict)  # Exact unsafe mutant observation.

    def test_15_committed_sync_failure_is_uncertain_and_never_removed(self):
        real = os.fsync
        hits = []
        def sync(fd):
            hits.append(fd)
            if len(hits) == 2:
                raise OSError(errno.EIO, 'injected directory sync failure')
            return real(fd)
        with mock.patch.object(os, 'fsync', sync), self.assertRaisesRegex(P.PublicationUncertain, 'no replay'):
            P.publish(self.o, {'id': 1})
        self.assertEqual(json.loads(self.c.read_bytes()), {'id': 1})
        self.assertEqual(self.c.stat().st_nlink, 1)
        with self.assertRaises(FileExistsError):
            P.publish(self.o, {'id': 2})


if __name__ == '__main__':
    unittest.main()

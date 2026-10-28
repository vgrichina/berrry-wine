#!/usr/bin/env python3
"""Owned tiny publication fixtures, including partial destructive cleanup."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(os.environ.get('GLTRON_SOURCE', Path(__file__).resolve().parents[1]/'tools/recovery/gltron-original-win32-recovery-oct28.py'))
spec = importlib.util.spec_from_file_location('recovery', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
NAMES = ('inventory.json', 'closure.json')

class CleanupTransaction(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def pair(self):
        return {n: (self.root/n).read_bytes() if (self.root/n).exists() else None for n in NAMES}

    def seed(self, existing):
        if existing:
            r.publish_analysis(self.root, {'generation': 'A'}, {'generation': 'A'})
        return self.pair()

    def test_cleanup_failure_restores_complete_prior_or_absence(self):
        cleanup = r.shutil.rmtree
        for existing in (False, True):
            for partial in ('none', 'one-backup', 'whole-stage'):
                with self.subTest(existing=existing, partial=partial):
                    for n in NAMES:
                        (self.root/n).unlink(missing_ok=True)
                    before = self.seed(existing)
                    observed = []
                    def deny(stage):
                        # Verify failure happens after BOTH new publications.
                        observed.append(self.pair())
                        self.assertTrue(all(b'"B"' in v for v in observed[-1].values()))
                        if partial == 'one-backup':
                            (Path(stage)/'inventory.json.old').unlink(missing_ok=True)
                        elif partial == 'whole-stage':
                            cleanup(stage)
                        raise PermissionError('cleanup denied after replacements')
                    with patch.object(r.shutil, 'rmtree', deny):
                        with self.assertRaisesRegex(PermissionError, 'cleanup denied') as caught:
                            r.publish_analysis(self.root, {'generation': 'B'}, {'generation': 'B'})
                    self.assertEqual(len(observed), 1)
                    self.assertEqual(self.pair(), before)
                    self.assertTrue(any('prior publication restored' in n for n in caught.exception.__notes__))
                    stages = list(self.root.glob('.analysis-pair-*'))
                    self.assertEqual(len(stages), 1)
                    if existing:
                        for n in NAMES:
                            self.assertEqual((stages[0]/(n+'.old')).read_bytes(), before[n])
                    cleanup(stages[0])

    def test_cleanup_then_restore_failure_retains_both_backups_and_cause(self):
        before = self.seed(True)
        replace = r.os.replace
        cleanup = r.shutil.rmtree
        def deny_cleanup(stage):
            cleanup(stage)  # even total deletion cannot discard recovery bytes
            raise PermissionError('causal cleanup denial')
        def deny_restore(src, dst):
            if Path(src).suffix == '.restore':
                raise OSError('restore denied')
            return replace(src, dst)
        with patch.object(r.shutil, 'rmtree', deny_cleanup), patch.object(r.os, 'replace', deny_restore):
            with self.assertRaisesRegex(RuntimeError, 'rollback failed; recovery in') as caught:
                r.publish_analysis(self.root, {'generation': 'B'}, {'generation': 'B'})
        self.assertIsInstance(caught.exception.__cause__, PermissionError)
        self.assertIn('causal cleanup denial', str(caught.exception.__cause__))
        stages = list(self.root.glob('.analysis-pair-*'))
        self.assertEqual(len(stages), 1)
        for n in NAMES:
            self.assertEqual((stages[0]/(n+'.old')).read_bytes(), before[n])
            replace(stages[0]/(n+'.old'), self.root/n)
        self.assertEqual(self.pair(), before)

    def test_absent_rollback_unlink_failure_is_explicit(self):
        unlink = Path.unlink
        def deny(path, *args, **kwargs):
            if path.parent == self.root and path.name in NAMES:
                raise OSError('rollback unlink denied')
            return unlink(path, *args, **kwargs)
        with patch.object(r.shutil, 'rmtree', side_effect=PermissionError('cleanup cause')), patch.object(Path, 'unlink', deny):
            with self.assertRaisesRegex(RuntimeError, 'rollback unlink denied') as caught:
                r.publish_analysis(self.root, {}, {})
        self.assertIsInstance(caught.exception.__cause__, PermissionError)
        self.assertEqual(len(list(self.root.glob('.analysis-pair-*'))), 1)

    def test_replace_and_cleanup_failure_keeps_original_cause(self):
        before = self.seed(True)
        replace = r.os.replace
        def deny_second(src, dst):
            if Path(src).name == 'closure.json':
                raise OSError('causal replacement denial')
            return replace(src, dst)
        with patch.object(r.os, 'replace', deny_second), patch.object(r.shutil, 'rmtree', side_effect=PermissionError('secondary cleanup denial')):
            with self.assertRaisesRegex(OSError, 'causal replacement denial') as caught:
                r.publish_analysis(self.root, {}, {})
        self.assertEqual(self.pair(), before)
        self.assertTrue(any('secondary cleanup denial' in n for n in caught.exception.__notes__))
        stage, = self.root.glob('.analysis-pair-*')
        for n in NAMES:
            self.assertEqual((stage/(n+'.old')).read_bytes(), before[n])

if __name__ == '__main__':
    unittest.main(verbosity=2)

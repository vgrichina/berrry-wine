#!/usr/bin/env python3
"""Tiny lexical-candidate checks; no Tcl, archive replay or runtime execution."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'tools/recovery/tuxracer-original-win32-recovery-oct28.py'
spec = importlib.util.spec_from_file_location('recovery', SOURCE)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class ParentLiteral(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def audit(self, expression, script='courses/common/moon.tcl', targets=(), tool=r):
        files = {script: 'source ' + expression + '\n'}
        files.update({p: '# leaf\n' for p in targets})
        for name, text in files.items():
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text)
        return tool.literal_sources(self.root, {'files': [{'path': p} for p in files]})

    def parent_checked(self, tool=r):
        result = self.audit('../common/walk.tcl', targets=['courses/common/walk.tcl'], tool=tool)
        self.assertEqual(result['checked'], [{'script': 'courses/common/moon.tcl',
                         'literal': '../common/walk.tcl',
                         'candidatesPresent': ['courses/common/walk.tcl']}])
        self.assertEqual(result['unknown'], [])
        self.assertIn('not runtime resolution', result['limitations'])

    def test_00_existing_parent_candidate(self):
        # Earliest changed boundary: exact production literal_sources.
        self.parent_checked()

    def test_01_missing_normalized_candidate(self):
        with self.assertRaisesRegex(r.Rejected, r'missing literal Tcl source: .* -> ../common/absent.tcl'):
            self.audit('../common/absent.tcl')

    def test_02_nested_normalization_and_root_base(self):
        for expression, script, target in [
            ('{../../common/./walk.tcl}', 'courses/hard/extra/moon.tcl', 'courses/common/walk.tcl'),
            ('"child/../walk.tcl"', 'courses/moon.tcl', 'courses/walk.tcl'),
            ('data/child/../../walk.tcl', 'courses/moon.tcl', 'walk.tcl'),
        ]:
            with self.subTest(expression=expression):
                row = self.audit(expression, script, [target])['checked'][0]
                self.assertEqual(row['candidatesPresent'], [target])

    def test_03_root_escape_never_opens_target(self):
        script = self.root / 'moon.tcl'
        script.write_text('source ../../outside.tcl\n')
        original = Path.read_text
        reads = []
        def read(path, *args, **kwargs):
            reads.append(path)
            self.assertEqual(path, script, 'audit accessed outside literal script')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'read_text', read):
            result = r.literal_sources(self.root, {'files': [{'path': 'moon.tcl'}]})
        self.assertEqual(reads, [script])
        self.assertEqual(result['checked'], [])
        self.assertIn('escape extraction root', result['unknown'][0]['reason'])
        # Do not allow a later .. to reenter after escaping the root.
        result = self.audit('../root/../outside.tcl', script='moon.tcl')
        self.assertIn('escape extraction root', result['unknown'][0]['reason'])

    def test_04_absolute_drive_and_backslash_unknown(self):
        for expression in ['/outside.tcl', 'C:/outside.tcl', 'C:outside.tcl', r'..\outside.tcl']:
            with self.subTest(expression=expression):
                result = self.audit(expression)
                self.assertEqual(result['checked'], [])
                self.assertEqual(len(result['unknown']), 1)

    def test_05_computed_forms_still_unknown(self):
        for expression in ['$tux_data_dir/common/walk.tcl', '"$tux_data_dir/common/walk.tcl"',
                           '[file join $tux_data_dir common walk.tcl]', '{$tux_data_dir/common/walk.tcl}']:
            with self.subTest(expression=expression):
                result = self.audit(expression)
                self.assertEqual(result['checked'], [])
                self.assertEqual(result['unknown'][0]['expression'], expression)

    def test_06_symlink_not_followed_by_candidate_lookup(self):
        # Inventory alone supplies candidate names; do not stat/open a target.
        script = self.root / 'courses/common/moon.tcl'
        script.parent.mkdir(parents=True)
        script.write_text('source ../common/walk.tcl\n')
        (script.parent / 'walk.tcl').symlink_to('/unretained/outside.tcl')
        with self.assertRaisesRegex(r.Rejected, 'missing literal Tcl source'):
            r.literal_sources(self.root, {'files': [{'path': 'courses/common/moon.tcl'}]})

    def test_07_reject_historical_exclusion_mutation(self):
        source = SOURCE.read_text()
        guard = "if not target or target.startswith('/') or ':' in target:"
        self.assertEqual(source.count(guard), 1)
        mutated = source.replace(guard, guard[:-1] + " or '..' in PurePosixPath(target).parts:")
        namespace = dict(r.__dict__)
        exec(compile(mutated, str(SOURCE) + ':historical-exclusion-mutant', 'exec'), namespace)
        from types import SimpleNamespace
        with self.assertRaises(AssertionError):
            self.parent_checked(SimpleNamespace(**namespace))
        # The mutant also silently accepts a missing parent literal as unknown.
        result = self.audit('../common/absent.tcl', tool=SimpleNamespace(**namespace))
        self.assertEqual(result['checked'], [])
        self.assertEqual(len(result['unknown']), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)

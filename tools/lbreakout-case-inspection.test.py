"""Execute the generated inspection with live and terminal case files."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'inspection', Path(__file__).with_name('lbreakout-case-inspection.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class InspectionTests(unittest.TestCase):
    def test_case_specific_generated_consumer(self):
        for case in ('fixture', 'original'):
            with self.subTest(case=case), tempfile.TemporaryDirectory() as root:
                run = Path(root) / 'run'
                out = run / case
                out.mkdir(parents=True)
                (out / 'latest.json').write_text('{"label":"startup"}')
                other = 'original' if case == 'fixture' else 'fixture'
                (run / (other + '.log')).write_text('foreign case')

                def inspect():
                    source = helper.inspection_source(root, 'run', case)
                    return json.loads(subprocess.check_output(
                        [sys.executable, '-c', source], text=True))

                live = inspect()
                self.assertFalse(live['logAvailable'])
                self.assertIsNone(live['output'])
                self.assertEqual(live['terminal'], {})
                self.assertEqual(live['latest']['label'], 'startup')
                (run / (case + '.log')).write_text('own case')
                self.assertEqual(inspect()['output'], 'own case')
                (run / (case + '.log')).unlink()
                (out / 'first-browser-failure.json').write_text('{"error":"stop"}')
                wait = 'fixture-launcher' if case == 'fixture' else 'launcher'
                (run / (wait + '-wait.json')).write_text('{"actualWait":true}')
                terminal = inspect()
                self.assertFalse(terminal['logAvailable'])
                self.assertEqual(terminal['terminal']['first-browser-failure.json']['error'], 'stop')
                self.assertTrue(terminal['terminal']['launcherWait']['actualWait'])

    def test_foreign_case_refused_before_generation(self):
        with self.assertRaises(ValueError):
            helper.inspection_source('/unused', 'run', '../other')


if __name__ == '__main__':
    unittest.main()

"""Caller-only controls; no browser, guest, input or second original."""
from pathlib import Path
import copy
import gzip
import hashlib
import json
import os
import runpy
import subprocess
import tempfile
import unittest

module = runpy.run_path(str(Path(__file__).with_name('q3-original-command-admission.py')))


class AdmissionTest(unittest.TestCase):
    def setUp(self):
        self.observation = dict(status='ready', capture=dict(label='startup'),
                                inputObservation=dict(active=True, state=dict(mode='pending-relative')))
        self.command = dict(id='single-player', label='single-player', action='click',
                            point=[.5, .34], holdMs=150, waitMs=2000, reviewRef='startup')

    def test_relative_point_refusal_precedes_sender(self):
        sent = []
        for mode in ['pending-relative', 'locked', 'UNKNOWN', None]:
            self.observation['inputObservation']['state']['mode'] = mode
            with self.subTest(mode=mode), self.assertRaisesRegex(AssertionError, 'absolute point'):
                sent.append(module['request'](self.observation, self.command, 'Reviewed full menu'))
        self.assertEqual(sent, [])
        for missing in [None, dict(active=False, state=dict(mode='absolute'))]:
            self.observation['inputObservation'] = missing
            with self.assertRaisesRegex(AssertionError, 'active captured input mode'):
                module['request'](self.observation, self.command, 'Reviewed full menu')

    def test_keyboard_keeps_exact_request_and_review(self):
        command = {**self.command, 'action': 'key', 'key': 'Enter'}
        del command['point']
        before = copy.deepcopy((self.observation, command))
        result = module['request'](self.observation, command, 'Reviewed full main menu; Enter')
        self.assertEqual(result, dict(command=command, review='Reviewed full main menu; Enter'))
        self.assertEqual((self.observation, command), before)
        self.assertIsNot(result['command'], command)

    def test_explicit_relative_and_absolute_routes(self):
        self.observation['inputObservation']['state']['mode'] = 'absolute'
        self.assertEqual(module['request'](self.observation, self.command, 'Full menu')['command'], self.command)
        relative = {**self.command, 'relativeCounts': [0, -94]}
        with self.assertRaisesRegex(AssertionError, 'Pointer Lock'):
            module['request'](self.observation, relative, 'Full menu')
        self.observation['inputObservation']['state']['mode'] = 'locked'
        self.assertEqual(module['request'](self.observation, relative, 'Full menu')['command'], relative)

    def test_wrong_image_and_missing_review_refuse(self):
        with self.assertRaisesRegex(AssertionError, 'observed image'):
            module['request'](self.observation, {**self.command, 'reviewRef': 'old'}, 'Full menu')
        for review in ['', {}, None]:
            with self.assertRaisesRegex(AssertionError, 'review text'):
                module['request'](self.observation, self.command, review)

    def test_actual_cli_refuses_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for name, value in [('image', self.observation), ('command', self.command)]:
                (base / name).write_text(json.dumps(value))
            (base / 'review').write_text('Personally reviewed full main menu')
            args = ['python3', '-B', str(Path(__file__).with_name('q3-original-command-admission.py')),
                    str(base / 'image'), str(base / 'command'), str(base / 'review')]
            result = subprocess.run(args, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stdout, b'')
            self.command.update(action='key', key='Enter')
            (base / 'command').write_text(json.dumps(self.command))
            result = subprocess.run(args, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)['command'], self.command)

    @unittest.skipUnless(os.environ.get('Q3_ACTUAL_RUN'), 'optional authenticated actual-run control')
    def test_actual_failed_command_is_refused(self):
        base = Path(os.environ['Q3_ACTUAL_RUN'])
        proof = json.loads(gzip.decompress((base / 'prepared/retrieval-before-stop.json.gz').read_bytes()))
        def retained(suffix):
            row, = [r for r in proof['records'] if r['path'].endswith(suffix)]
            data = gzip.decompress((base / row['local']).read_bytes())
            self.assertEqual(len(data), row['size'])
            self.assertEqual(hashlib.sha256(data).hexdigest(), row['sha256'])
            return json.loads(data)
        cap = retained('/runtime/startup-capture.json')
        observer = retained('/runtime/startup-observer.json')
        command = retained('/runtime/commands/0.json')
        self.assertEqual(observer['state']['mode'], 'pending-relative')
        self.assertEqual(command['point'], [.5, .34])
        with self.assertRaisesRegex(AssertionError, 'absolute point'):
            module['request'](dict(status='ready', capture=cap, inputObservation=observer), command,
                              'Personally reviewed full actual main menu')


if __name__ == '__main__':
    unittest.main()

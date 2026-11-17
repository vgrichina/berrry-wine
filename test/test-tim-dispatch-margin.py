"""Dispatch reserve tests; transport fixtures do not prove TIM gameplay."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('base_policy', ROOT / 'test/test-tim-smart-handle-controller.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
tim = base.tim


def native_margin(root):
    """Actual COM callbacks, only after explicit runtime/build/source release."""
    import os
    import subprocess
    import sys
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=False)
    for mode in ('unsent', 'writtenstale'):
        directory = root / mode
        directory.mkdir()
        env = {**os.environ, 'TIM_PROBE_MODE': mode, 'TIM_PROBE_DIR': str(directory)}
        # Reuse the real INT33 transport probe with a shorter real wait: the
        # refused capture is inside native's 5s limit but outside our reserve.
        # No clock override or game state exists in this COM diagnostic.
        code = (
            "import importlib.util,pathlib,os;"
            "s=importlib.util.spec_from_file_location('test','test/test-tim-smart-handle-controller.py');"
            "m=importlib.util.module_from_spec(s);s.loader.exec_module(m);"
            "source=m.NATIVE_JS.replace('setTimeout(resolve,6304)','setTimeout(resolve,4300)');"
            "source=source.replace(\"assert.equal(refusal.status,'REFUSED_UNSENT');\","
            "\"assert.equal(refusal.status,'REFUSED_UNSENT');assert(refusal.reviewAgeSeconds>4&&refusal.reviewAgeSeconds<5);assert.equal(refusal.minimumDispatchSeconds,1);\");"
            "source=source.replace(\"assert.equal(engine.result.status,'UNKNOWN');\\n  assert(!fs\","
            "\"assert.equal(engine.result.status,'UNKNOWN');await assert.rejects(engine.act(adapter),/review expired/);assert.equal(inputCalls.length,0);\\n  assert(!fs\");"
            "raise SystemExit(m.tim.supervise(['node','-e',m.tim.ENGINE_JS+source],"
            "pathlib.Path(os.environ['TIM_PROBE_DIR']),220))")
        child = subprocess.Popen([sys.executable, '-B', '-c', code], env=env,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        wait, stdout, stderr = tim.actual_wait(child, directory, 'supervisor-child')
        (directory / 'supervisor.log').write_bytes(stdout)
        (directory / 'supervisor.stderr').write_bytes(stderr)
        assert wait['exit'] == 0, (mode, wait, stderr.decode())
        for name in ('native-wait.json', 'deadline-watchdog-wait.json'):
            value = json.loads((directory / name).read_text())
            assert value['actualWait'] and value['stdoutEOF'] and value['stderrEOF']
        result = json.loads((directory / 'native-probe.json').read_text())
        if mode == 'unsent':
            zero = result['refusedZero']
            assert zero['actualNativeSteps'] == 200
            assert all(zero[k] == 0 for k in ('callbacks', 'queuedEvents', 'buttons', 'inputCalls'))
            assert 4 < zero['refusal']['reviewAgeSeconds'] < 5
        else:
            assert result['result']['status'] == 'UNKNOWN'
            assert list(directory.glob('command-*'))
            assert not list(directory.glob('unsent-confirmed-*'))
            assert not result['inputCalls']
        print('PASS dispatch margin native', mode, 'actual waits/bothEOF', flush=True)


class DispatchMarginTest(unittest.TestCase):
    setUp = base.PolicyTest.setUp
    admit = base.PolicyTest.admit

    def refused(self, now, age):
        with self.assertRaises(tim.UnsentReviewRefusal) as caught:
            self.admit(now)
        receipt = caught.exception.receipt
        self.assertEqual(receipt['status'], 'REFUSED_UNSENT')
        self.assertEqual(receipt['delivery'], 'NONE')
        self.assertEqual(receipt['minimumDispatchSeconds'], 1)
        self.assertAlmostEqual(receipt['reviewAgeSeconds'], age)
        self.assertFalse(list(self.root.glob('command-*')))
        self.assertFalse((self.root / 'UNKNOWN.json').exists())
        self.assertNotIn('action', receipt)
        self.assertEqual(json.loads((self.root / 'decision-one.json').read_text()), receipt)
        return receipt

    def test_prior_4992871ms_race_is_unsent(self):
        self.refused(204.992871, 4.992871)

    def test_game_one_second_boundary_and_just_beyond(self):
        self.assertTrue(self.admit(204)['nonce'])

    def test_game_less_than_one_second_refuses(self):
        self.refused(204.000001, 4.000001)

    def test_menu_one_second_boundary_is_admitted(self):
        self.review['mode'] = 'menu'
        self.assertTrue(self.admit(229)['nonce'])

    def test_menu_less_than_one_second_refuses(self):
        self.review['mode'] = 'menu'
        self.refused(229.000001, 29.000001)

    def test_quit_less_than_one_second_refuses_without_leaving_quit_phase(self):
        self.review.update(mode='quit', visibleQuitControl='visible Quit')
        self.refused(229.5, 29.5)
        self.assertTrue((self.root / 'quit-phase.json').exists())

    def test_time_resampled_after_capture_hashing_before_input_claim(self):
        # Real-time path must not reuse the entry timestamp after slow work.
        with patch.object(tim.time, 'time', side_effect=[202, 204.5]):
            with self.assertRaises(tim.UnsentReviewRefusal) as caught:
                self.p.admit(self.capture, self.review, self.action)
        self.assertAlmostEqual(caught.exception.receipt['reviewAgeSeconds'], 4.5)
        self.assertFalse(list(self.root.glob('command-*')))
        self.assertFalse((self.root / 'UNKNOWN.json').exists())

    def test_fresh_time_is_recorded_as_submission(self):
        with patch.object(tim.time, 'time', side_effect=[202, 203]):
            command = self.p.admit(self.capture, self.review, self.action)
        self.assertEqual(command['submittedAt'], 203)
        self.assertEqual(json.loads((self.root / 'decision-one.json').read_text())['at'], 203000)

    def test_existing_written_command_is_unknown_even_with_insufficient_margin(self):
        tim.exclusive(self.root / 'command-one.json', {'alreadyWritten': True})
        with self.assertRaisesRegex(AssertionError, 'command already written'):
            self.admit(204.992871)
        self.assertTrue((self.root / 'UNKNOWN.json').exists())
        self.assertFalse(list(self.root.glob('decision-*')))

    def test_original_requires_current_margin_native_qualification_before_intent(self):
        import subprocess
        import tempfile
        proof = dict(routeSHA256=tim.digest(tim.__file__),
                     testSHA256=tim.digest(ROOT / 'test/test-tim-smart-handle-controller.py'),
                     schemaTestSHA256=tim.digest(ROOT / 'test/test-tim-gesture-schema.py'),
                     fullLockedBuildExit=0, actualNativeCallbacks=True, directWaitsBothEOF=True,
                     schemaExactCLIAndNativeZeroDelivery=True,
                     nativeModes=['hover', 'click', 'right', 'drag', 'cancel', 'watchdog', 'parentdeath',
                                  'unsent', 'lateack', 'dropack', 'heldinput', 'writtenstale', 'quitreserve'])
        for fields in ({}, dict(marginTestSHA256='old', marginNativeZeroDeliveryAndWrittenUnknown=True),
                       dict(marginTestSHA256=tim.digest(__file__), marginNativeZeroDeliveryAndWrittenUnknown=False)):
            with self.subTest(fields=fields), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                tim.exclusive(root / 'route-qualified.json', {**proof, **fields})
                with patch.object(subprocess, 'Popen') as launch:
                    with self.assertRaises((AssertionError, KeyError)):
                        tim.start_original(root)
                    launch.assert_not_called()
                self.assertEqual([p.name for p in root.iterdir()], ['route-qualified.json'])


if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == '--native':
        native_margin(sys.argv[2])
    else:
        unittest.main()

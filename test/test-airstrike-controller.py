"""Fail-closed policy at the original game's manual-input boundary."""
import importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('airstrike', ROOT / 'tools/airstrike-controller.py')
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1000))
        a.c.save('controls-reviewed.json', dict(keys=sorted(a.COMBAT), unchanged=True))

    def tearDown(self):
        self.tmp.cleanup()

    def review(self, mode, route=None, **values):
        a.c.save('fresh-review.json', dict(mode=mode, quitRoute=route, **values))

    def test_unchanged_controls_and_no_ai_or_debug_keys(self):
        self.review('combat')
        with patch.object(a.time, 'time', return_value=800):
            for key in (188, 37, 39, 190, 32):
                a.policy(['keydown:' + str(key)], 'fresh', 'combat')
            for key in (17, 16, 9, 68, 70, 27, 13, 78):
                with self.assertRaisesRegex(AssertionError, 'original combat'):
                    a.policy(['keydown:' + str(key)], 'fresh', 'combat')

    def test_early_quit_is_irreversible_and_exact(self):
        self.review('quit', 'open-menu')
        with patch.object(a.time, 'time', return_value=800):
            a.policy(['keydown:27'], 'fresh', 'quit', 'open-menu')
            with self.assertRaisesRegex(AssertionError, 'ordinary reviewed'):
                a.policy(['keydown:39'], 'fresh', 'quit', 'open-menu')
        a.c.save('combat-review.json', dict(mode='combat'))
        with patch.object(a.time, 'time', return_value=801):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'):
                a.policy(['keydown:190'], 'combat', 'combat')

    def test_cutoff_rejects_before_arm(self):
        self.review('combat')
        with patch.object(a.time, 'time', return_value=843):
            with patch.object(a.c, 'pulse') as transport:
                with self.assertRaisesRegex(AssertionError, 'cutoff'):
                    a.pulse('late', ['keydown:190'], 120, 'fresh', 'reviewed', 'combat')
                transport.assert_not_called()

    def test_crossing_rechecked_before_each_down(self):
        self.review('combat')
        sent = []
        def native(command, timeout=10):
            sent.append(command)
        def transport(*args, **kwargs):
            self.assertEqual(kwargs['maxSceneAge'], 5)
            for at in (849, 851):
                with patch.object(a.time, 'time', return_value=at):
                    a.c.call(dict(action='guarded-input', guard={'deadline':999999}))
        with patch.object(a.time, 'time', return_value=800), patch.object(a.c, 'call', native), patch.object(a.c, 'pulse', transport):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'):
                a.pulse('cross', ['keydown:188', 'keydown:190'], 120, 'fresh', 'reviewed', 'combat')
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]['guard']['deadline'], 850000)
        self.assertTrue(a.c.read('quit-phase.json')['irreversible'])

    def test_quit_enter_requires_personally_visible_selection(self):
        self.review('quit', 'select-quit')
        with patch.object(a.time, 'time', return_value=900):
            with self.assertRaisesRegex(AssertionError, 'observed Quit'):
                a.policy(['keydown:13'], 'fresh', 'quit', 'select-quit')

    def test_bind_requires_actual_review_before_any_transport(self):
        a.c.save('scene.json', dict(at=800))
        a.c.save('scene-review.json', dict(at=800, observation='visible', submittedScene=False))
        with patch.object(a.time, 'time', return_value=801), patch.object(a.c, 'bind') as bound:
            with self.assertRaisesRegex(AssertionError, 'submitted scene'):
                a.bind('scene')
            bound.assert_not_called()

    def test_long_pulse_refused_before_any_arm_or_down(self):
        with patch.object(a.c, 'pulse') as transport:
            with self.assertRaisesRegex(AssertionError, 'reserve 250ms'):
                a.pulse('too-long', ['keydown:190'], 1600, 'fresh', 'reviewed', 'combat')
            transport.assert_not_called()

if __name__ == '__main__':
    unittest.main()

"""Light policy regressions; these do not establish native game delivery."""
import importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('quake2', ROOT / 'tools/quake2-controller.py')
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1300))
        a.c.save('native-pid.json', dict(pid=1, startToken='test'))
        a.c.save('bindings-reviewed.json', dict(attack='ENTER', ctrl='crouch', target=dict(pid=1, startToken='test')))
    def tearDown(self):
        self.tmp.cleanup()
    def review(self, mode='aim', route=None):
        a.c.save('scene-review.json', dict(mode=mode, quitRoute=route))
    def test_cutoff_before_arm(self):
        self.review()
        with patch.object(a.time, 'time', return_value=1113):
            with self.assertRaisesRegex(AssertionError, 'cutoff'):
                a.policy(['keydown:13'], 'scene', 'aim', beforeArm=True)
    def test_cutoff_is_permanent(self):
        self.review()
        with patch.object(a.time, 'time', return_value=1120):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'):
                a.policy(['keydown:13'], 'scene', 'aim')
        with patch.object(a.time, 'time', return_value=1000):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'):
                a.policy(['keydown:13'], 'scene', 'aim')
        self.assertEqual(a.c.read('quit-phase.json')['cutoff'], 1120)
    def test_quit_exact_review_no_relabel(self):
        self.review('quit', 'open-menu')
        with patch.object(a.time, 'time', return_value=900):
            a.policy(['keydown:27'], 'scene', 'quit', 'open-menu')
            with self.assertRaisesRegex(AssertionError, 'ordinary'):
                a.policy(['keydown:13'], 'scene', 'quit', 'open-menu')
            with self.assertRaisesRegex(AssertionError, 'exact'):
                a.policy(['keydown:89'], 'scene', 'quit', 'confirm-quit')
    def test_ctrl_mouse_and_console_are_not_admitted(self):
        self.review()
        with patch.object(a.time, 'time', return_value=900):
            for key in ('keydown:17', 'mousedown:320:240', 'keydown:192'):
                with self.assertRaisesRegex(AssertionError, 'documented'):
                    a.policy([key], 'scene', 'aim')
    def test_aim_requires_native_binding_review(self):
        self.review()
        (a.c.R / 'bindings-reviewed.json').unlink()
        with patch.object(a.time, 'time', return_value=900):
            with self.assertRaises(FileNotFoundError):
                a.policy(['keydown:13'], 'scene', 'aim')
    def test_guard_cutoff_crossing_and_aim_age(self):
        self.review()
        a.c.save('scene.json', dict(at=1118))
        sent = []
        def native(cmd, timeout=10):
            sent.append(cmd)
        def shared(*args, **kw):
            self.assertEqual(kw['maxSceneAge'], 5)
            with patch.object(a.time, 'time', return_value=1119):
                a.c.call(dict(action='guarded-input', guard={'deadline': 9999999}))
            with patch.object(a.time, 'time', return_value=1120):
                a.c.call(dict(action='guarded-input', guard={'deadline': 9999999}))
        with patch.object(a.time, 'time', return_value=900), patch.object(a.c, 'call', native), patch.object(a.c, 'pulse', shared):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'):
                a.pulse('attack', ['keydown:13'], 400, 'scene', 'reviewed', 'aim')
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]['guard']['deadline'], 1120000)
    def test_aim_expiry_clamps_actual_delivery_deadline(self):
        self.review()
        a.c.save('scene.json', dict(at=900))
        sent = []
        def native(cmd, timeout=10):
            sent.append(cmd)
        def shared(*args, **kw):
            a.c.call(dict(action='guarded-input', guard={'deadline': 9999999}))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'call', native), patch.object(a.c, 'pulse', shared):
            a.pulse('attack', ['keydown:13'], 400, 'scene', 'reviewed', 'aim')
        self.assertEqual(sent[0]['guard']['deadline'], 905000)
    def test_bind_refuses_missing_native_readiness(self):
        image = a.c.R / 'scene.png'
        image.write_bytes(b'fixture')
        sha = a.hashlib.sha256(image.read_bytes()).hexdigest()
        target = dict(pid=1, startToken='test')
        a.c.save('scene.json', dict(at=900, pngSHA256=sha, target=target))
        a.c.save('scene-review.json', dict(at=900, pngSHA256=sha, observation='fixture review'))
        a.c.save('scene-native.json', dict(nativeContext=False, submittedScene=True, presents=1, target=target, pngSHA256=sha))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'bind') as bind:
            with self.assertRaisesRegex(AssertionError, 'actual native GL'):
                a.bind('scene')
            bind.assert_not_called()

if __name__ == '__main__':
    unittest.main()

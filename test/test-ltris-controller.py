"""LTris policy regressions; no game execution or gameplay claims."""
import importlib.util, pathlib, tempfile, unittest, hashlib
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('ltris', ROOT / 'tools/ltris-controller.py')
a = importlib.util.module_from_spec(s); s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1300))
        a.c.save('native-pid.json', dict(pid=1, startToken='fixture'))
        a.c.save('controls-reviewed.json', dict(keys=sorted(a.PLAY), unchanged=True, target=a.c.read('native-pid.json')))
    def tearDown(self): self.tmp.cleanup()
    def review(self, mode='play', route=None, selected=False, back=False):
        a.c.save('scene-review.json', dict(mode=mode, quitRoute=route, selectedQuit=selected,
               selectedBack=back, at=900))
    def test_back_route_is_separate_and_nonfinal(self):
        self.review('quit', 'select-back', back=True)
        a.c.save('scene.json', dict(at=900))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'pulse', return_value='fixture') as p:
            a.pulse('back', ['keydown:13'], 400, 'scene', 'Back actually selected', 'quit', 'select-back')
            self.assertFalse(p.call_args.kwargs['final'])
            self.assertEqual(p.call_args.kwargs['maxSceneAge'], 30)
        self.assertTrue(a.c.read('quit-phase.json')['irreversible'])
    def test_back_missing_or_mislabeled_selection_refused(self):
        self.review('quit', 'select-back', selected=True)
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'pulse') as p:
            with self.assertRaisesRegex(AssertionError, 'Back'):
                a.pulse('back', ['keydown:13'], 400, 'scene', 'Quit label is not Back', 'quit', 'select-back')
            p.assert_not_called()
    def test_back_does_not_authorize_quit_or_wrong_key(self):
        self.review('quit', 'select-back', back=True)
        with patch.object(a.time, 'time', return_value=901):
            for key,route in [('keydown:38','select-back'), ('keydown:13','select-quit')]:
                with self.assertRaises(AssertionError): a.policy([key], 'scene', 'quit', route)
    def test_back_and_quit_cannot_share_selection_proof(self):
        self.review('quit', 'select-back', selected=True, back=True)
        with patch.object(a.time, 'time', return_value=901):
            with self.assertRaisesRegex(AssertionError, 'separate'):
                a.policy(['keydown:13'], 'scene', 'quit', 'select-back')
    def test_expired_back_review_refused_before_transport(self):
        self.review('quit', 'select-back', back=True)
        a.c.save('scene.json', dict(at=900))
        with patch.object(a.time, 'time', return_value=931), patch.object(a.c, 'pulse') as p:
            with self.assertRaisesRegex(AssertionError, 'expired'):
                a.pulse('back', ['keydown:13'], 400, 'scene', 'old Back', 'quit', 'select-back')
            p.assert_not_called()
    def test_back_after_cutoff_keeps_play_closed(self):
        self.review('quit', 'select-back', back=True)
        with patch.object(a.time, 'time', return_value=1121):
            a.policy(['keydown:13'], 'scene', 'quit', 'select-back')
        (a.c.R / 'scene-review.json').unlink(); self.review()
        with patch.object(a.time, 'time', return_value=1100):
            with self.assertRaisesRegex(AssertionError, 'irreversible'):
                a.policy(['keydown:80'], 'scene', 'play')
    def test_quit_requires_new_distinct_review_after_back(self):
        self.review('quit', 'select-back', back=True)
        a.c.save('scene.json', dict(at=900))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'pulse', return_value='fixture') as p:
            a.pulse('back', ['keydown:13'], 400, 'scene', 'Back selected', 'quit', 'select-back')
            with self.assertRaisesRegex(AssertionError, 'route'):
                a.pulse('quit', ['keydown:13'], 400, 'scene', 'same Back cannot be Quit', 'quit', 'select-quit')
            a.c.save('main.json', dict(at=901))
            a.c.save('main-review.json',dict(mode='quit',quitRoute='select-quit',selectedQuit=True,selectedBack=False,at=901))
            a.pulse('quit', ['keydown:13'], 400, 'main', 'new main menu Quit selected', 'quit', 'select-quit')
            self.assertTrue(p.call_args.kwargs['final'])
    def test_cutoff_is_permanent(self):
        self.review()
        for now in (1120, 900):
            with patch.object(a.time, 'time', return_value=now):
                with self.assertRaisesRegex(AssertionError, 'irreversible'): a.policy(['keydown:38'], 'scene', 'play')
        self.assertEqual(a.c.read('quit-phase.json')['cutoff'], 1120)
    def test_complete_window_before_arm(self):
        self.review()
        with patch.object(a.time, 'time', return_value=1113):
            with self.assertRaisesRegex(AssertionError, 'cutoff'): a.policy(['keydown:38'], 'scene', 'play', beforeArm=True)
    def test_quit_exact_and_visible_selection(self):
        self.review('quit', 'select-quit')
        with patch.object(a.time, 'time', return_value=900):
            with self.assertRaisesRegex(AssertionError, 'visible'): a.policy(['keydown:13'], 'scene', 'quit', 'select-quit')
            with self.assertRaisesRegex(AssertionError, 'route'): a.policy(['keydown:38'], 'scene', 'quit', 'select-quit')
    def test_no_unknown_controls_or_pair(self):
        self.review()
        with patch.object(a.time, 'time', return_value=900):
            for keys in (['keydown:17'], ['mousedown:1:1'], ['keydown:38', 'keydown:37']):
                with self.assertRaises(AssertionError): a.policy(keys, 'scene', 'play')
    def test_bind_requires_submitted_scene(self):
        a.c.save('scene.json', dict(at=900))
        a.c.save('scene-review.json', dict(observation='fixture', submittedScene=False))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'bind') as b:
            with self.assertRaisesRegex(AssertionError, 'submitted'): a.bind('scene')
            b.assert_not_called()
    def test_controls_identity_required(self):
        self.review(); (a.c.R / 'controls-reviewed.json').unlink()
        with patch.object(a.time, 'time', return_value=900):
            with self.assertRaises(FileNotFoundError): a.policy(['keydown:38'], 'scene', 'play')
    def test_delivery_deadline_is_five_seconds(self):
        self.review(); a.c.save('scene.json', dict(at=900)); sent=[]
        def transport(cmd, timeout=10): sent.append(cmd)
        def pulse(*args, **kw):
            self.assertEqual(kw['maxSceneAge'], 5)
            a.c.call(dict(action='guarded-input', guard=dict(deadline=99999999)))
        with patch.object(a.time, 'time', return_value=901), patch.object(a.c, 'call', transport), patch.object(a.c, 'pulse', pulse):
            a.pulse('fixture', ['keydown:38'], 120, 'scene', 'review', 'play')
        self.assertEqual(sent[0]['guard']['deadline'], 905000)
    def test_pulse_limit_before_transport(self):
        with patch.object(a.c, 'pulse') as p:
            with self.assertRaisesRegex(AssertionError, '1500'): a.pulse('fixture', ['keydown:38'], 1501, 'scene', 'review', 'play')
            p.assert_not_called()

if __name__ == '__main__': unittest.main()

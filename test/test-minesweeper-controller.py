"""Human-review policy boundaries; no game or board recognition."""
import importlib.util
import pathlib
import tempfile
import unittest
import hashlib
from unittest.mock import patch

s = importlib.util.spec_from_file_location('mine', pathlib.Path(__file__).resolve().parents[1] / 'tools/minesweeper-controller.py')
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)


class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1000))
        a.c.save('native-pid.json', dict(pid=123, startToken='actual'))
        self.clock = patch.object(a.time, 'time', return_value=500)
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.tmp.cleanup()

    def scene(self, name='fresh', mode='reveal', **changes):
        (a.c.R / (name + '.png')).write_bytes(b'fixture image; not native gameplay evidence')
        digest = hashlib.sha256((a.c.R / (name + '.png')).read_bytes()).hexdigest()
        a.c.save(name + '.json', dict(at=499, pngSHA256=digest, target=a.c.read('native-pid.json'), snapshot=dict(mainHwnd='0x1', eip='0x2')))
        review = dict(at=499, pngSHA256=digest, mode=mode, submittedScene=True, observation='fixture manual review', sceneType='board', defaultBoard=True,
                      visibleBoardDescription='synthetic covered board', button='left', buttonSemantics='left reveals a covered square',
                      choiceKind='guess', reason='no displayed number constrains this covered square', coveredSquare=True,
                      pixelGeometry=dict(source='current-full-scene', target=a.c.read('native-pid.json'), chosenCenter=[200,200]))
        a.c.save(name + '-review.json', {**review, **changes})

    def board(self):
        a.c.save('board-admitted.json', dict(scene='earlier-personally-reviewed-board'))

    def test_one_exact_left_click(self):
        self.scene(); self.board()
        a.policy(['mousedown:200:200'], 'fresh', 'reveal')
        for keys in (['mousedown:201:200'], ['keydown:13'], ['rmousedown:200:200'], ['mousedown:200:200', 'mousedown:220:220']):
            with self.assertRaises(AssertionError): a.policy(keys, 'fresh', 'reveal')

    def test_gameplay_requires_board_admission(self):
        self.scene()
        with self.assertRaisesRegex(AssertionError, 'actual board'): a.policy(['mousedown:200:200'], 'fresh', 'reveal')

    def test_bootstrap_cannot_be_called_board(self):
        self.scene(sceneType='bootstrap'); self.board()
        with self.assertRaises(AssertionError): a.policy(['mousedown:200:200'], 'fresh', 'reveal')

    def test_deduction_or_guess_reason_required(self):
        self.scene(reason=''); self.board()
        with self.assertRaisesRegex(AssertionError, 'deduction'): a.policy(['mousedown:200:200'], 'fresh', 'reveal')

    def test_covered_square_only(self):
        self.scene(coveredSquare=False); self.board()
        with self.assertRaisesRegex(AssertionError, 'smiley'): a.policy(['mousedown:200:200'], 'fresh', 'reveal')

    def test_natural_outcome_stops_gameplay(self):
        self.scene(); self.board(); a.c.save('natural-outcome.json', dict(outcome='loss'))
        with self.assertRaisesRegex(AssertionError, 'natural outcome'): a.policy(['mousedown:200:200'], 'fresh', 'reveal')

    def test_quit_irreversible(self):
        self.scene(mode='quit', quitRoute='open-game-menu', visibleQuitTarget=True)
        a.policy(['mousedown:200:200'], 'fresh', 'quit', 'open-game-menu')
        self.scene('next'); self.board()
        with self.assertRaisesRegex(AssertionError, 'irreversible'): a.policy(['mousedown:200:200'], 'next', 'reveal')

    def test_quit_confirmation_separately_reviewed(self):
        self.scene(mode='quit', quitRoute='confirm-exit', visibleQuitTarget=True)
        with self.assertRaisesRegex(AssertionError, 'confirmation'): a.policy(['mousedown:200:200'], 'fresh', 'quit', 'confirm-exit')

    def test_cutoff_before_arm(self):
        self.scene(); self.board()
        with patch.object(a.time, 'time', return_value=813), patch.object(a.c, 'pulse') as sent:
            with self.assertRaisesRegex(AssertionError, 'cutoff'): a.pulse('late', ['mousedown:200:200'], 400, 'fresh', 'review', 'reveal')
            sent.assert_not_called()

    def test_1500_bound(self):
        with patch.object(a.c, 'pulse') as sent:
            with self.assertRaises(AssertionError): a.pulse('long', ['mousedown:200:200'], 1501, 'fresh', 'review', 'reveal')
            sent.assert_not_called()

    def test_precision_server_deadline(self):
        self.scene(); self.board(); commands=[]
        def transport(*args, **kw):
            self.assertEqual(kw['maxSceneAge'], 5)
            a.c.call(dict(action='guarded-input', guard=dict(deadline=999999)))
            return 'fixture'
        with patch.object(a.c, 'call', lambda command, timeout=10: commands.append(command)), patch.object(a.c, 'pulse', transport):
            a.pulse('move', ['mousedown:200:200'], 400, 'fresh', 'review', 'reveal')
        self.assertEqual(commands[0]['guard']['deadline'], 504000)

    def test_bootstrap_binding_preserves_scene_type(self):
        self.scene(sceneType='bootstrap')
        with patch.object(a.c, 'bind') as bound: a.bind('fresh')
        bound.assert_called_once()
        self.assertEqual(a.c.read('binding-scene.json')['sceneType'], 'bootstrap')
        with self.assertRaises(AssertionError):
            with patch.object(a.c, 'lease'): a.admit_board('fresh')

    def test_board_admission_requires_five_second_review(self):
        self.scene()
        with patch.object(a.c, 'lease'), patch.object(a.time, 'time', return_value=505):
            with self.assertRaisesRegex(AssertionError, 'expired'): a.admit_board('fresh')
        with patch.object(a.c, 'lease'): a.admit_board('fresh')

    def test_start_once_and_never_after_board(self):
        self.scene(mode='start', sceneType='bootstrap', nativeStartTarget=True)
        a.c.save('binding-scene.json', dict(sceneType='bootstrap'))
        a.policy(['mousedown:200:200'], 'fresh', 'start')
        a.c.save('start-submitted.json', dict(name='started'))
        with self.assertRaisesRegex(AssertionError, 'one native Start'): a.policy(['mousedown:200:200'], 'fresh', 'start')

    def test_start_forbidden_after_board(self):
        self.scene(mode='start', sceneType='bootstrap', nativeStartTarget=True)
        a.c.save('binding-scene.json', dict(sceneType='bootstrap')); self.board()
        with self.assertRaisesRegex(AssertionError, 'after board'): a.policy(['mousedown:200:200'], 'fresh', 'start')

    def test_binding_rejects_changed_png_before_endpoint(self):
        self.scene(sceneType='bootstrap')
        (a.c.R / 'fresh.png').write_bytes(b'changed after review')
        with patch.object(a.c, 'bind') as bound:
            with self.assertRaises(AssertionError): a.bind('fresh')
            bound.assert_not_called()

    def test_menu_open_nonfinal_exit_final(self):
        for name, route, final in [('menu','open-game-menu',False), ('exit','select-exit',True)]:
            self.scene(name, mode='quit', quitRoute=route, visibleQuitTarget=True)
            with patch.object(a.c, 'pulse', return_value='fixture') as sent:
                a.pulse(name+'gesture', ['mousedown:200:200'], 400, name, 'review', 'quit', route)
                self.assertEqual(sent.call_args.kwargs['final'], final)
                self.assertEqual(sent.call_args.kwargs['maxSceneAge'], 30)

    def test_counter_cannot_declare_win_without_explicit_outcome_review(self):
        self.scene()
        with patch.object(a.c, 'lease'):
            with self.assertRaises(AssertionError): a.outcome('fresh')

    def test_outcome_requires_visible_evidence(self):
        self.scene(naturalOutcome='win', outcomeEvidence='')
        with patch.object(a.c, 'lease'):
            with self.assertRaisesRegex(AssertionError, 'counter alone'): a.outcome('fresh')


if __name__ == '__main__': unittest.main()

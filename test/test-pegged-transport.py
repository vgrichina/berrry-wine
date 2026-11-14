"""Released transport controls plus bootstrap/board policy at actual CLI.

--production is heavy and launches isolated Solitaire fixtures, no Pegged.
Instrumentation and synthetic review metadata are fixture-only.
"""
import importlib.util
import pathlib
import sys
import time
import unittest
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    s = importlib.util.spec_from_file_location(name, ROOT / path)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    return m


a = load('pegged', 'tools/pegged-controller.py')
b = load('released_transport_tests', 'test/test-barrage-transport.py')
c = a.c
b.c = c; b.r.c = c; b.r.b.control = c; b.t.c = c; b.t.base.control = c
b.p.c = c; b.p.p.c = c; b.p.b.control = c


class Production(b.Production):
    def test_bootstrap_binding_board_admission_and_left_pointer(self):
        native_bind = c.bind
        original_save = b.p.b.save
        def fixture_save(out, name, value):
            if name == 'recipe.json': value = {**value, 'seconds': 240}
            return original_save(out, name, value)
        def reviewed_bind():
            c.capture('bootstrap')
            c.save('bootstrap-review.json', dict(at=time.time(), pngSHA256=c.read('bootstrap.json')['pngSHA256'], submittedScene=True,
                   sceneType='bootstrap', observation='Isolated Solitaire fixture; synthetic bootstrap review, not Pegged proof'))
            with patch.object(c, 'bind', native_bind): a.bind('bootstrap')
        with patch.object(c, 'bind', reviewed_bind), patch.object(b.p.b, 'save', fixture_save): self.start('pegged-bootstrap-policy')
        try:
            self.assertEqual(c.read('binding-scene.json')['sceneType'], 'bootstrap')
            c.capture('startchoice')
            c.save('startchoice-review.json', dict(at=time.time(), pngSHA256=c.read('startchoice.json')['pngSHA256'], submittedScene=True,
                   sceneType='bootstrap', mode='start', nativeStartTarget=True, observation='Synthetic Start policy on isolated Solitaire fixture',
                   pixelGeometry=dict(source='current-full-scene', target=c.read('native-pid.json'), chosenCenter=[240,240])))
            a.pulse('startmanual', ['mousedown:240:240'], 400, 'startchoice', 'fixture Start policy', 'start')
            self.assertEqual(c.read('start-submitted.json')['name'], 'startmanual')
            self.assertEqual(c.read('startmanual-up.json')['state'], 'ACK')
            c.capture('board')
            c.save('board-review.json', dict(at=time.time(), pngSHA256=c.read('board.json')['pngSHA256'], submittedScene=True, sceneType='board',
                   defaultBoard=True, visibleBoardDescription='Synthetic board admission in actual Solitaire fixture', observation='Fixture-only policy metadata'))
            a.admit_board('board')
            c.capture('choice')
            c.save('choice-review.json', dict(at=time.time(), pngSHA256=c.read('choice.json')['pngSHA256'], submittedScene=True, sceneType='board', mode='select',
                   defaultBoard=True, observation='Fixture-only manually chosen native pointer', coveredSquare=True, button='left', buttonSemantics='native left pointer',
                   settledPaint=True, originalRulesUnchanged=True, sourcePeg='fixture-source', jumpedPeg='fixture-neighbor', emptyDestination='fixture-empty', legalReason='Synthetic fixture only', sourceOccupied=True, jumpedOccupied=True, destinationEmpty=True,
                   pixelGeometry=dict(source='current-full-scene', target=c.read('native-pid.json'), chosenCenter=[200,200])))
            a.pulse('manual', ['mousedown:200:200'], 400, 'choice', 'fixture pointer', 'select')
            self.assertTrue(c.read('manual-receipt.json')['consumed'])
            self.assertEqual(c.read('manual-up.json')['state'], 'ACK')
            c.capture('destination')
            review = c.read('choice-review.json')
            c.save('destination-review.json', {**review, 'at': time.time(), 'pngSHA256': c.read('destination.json')['pngSHA256'],
                   'mode': 'destination', 'selectionVisible': True, 'selectionAction': 'manual'})
            a.pulse('destmanual', ['mousedown:200:200'], 400, 'destination', 'synthetic destination policy only', 'destination')
            c.capture('consequence')
            c.save('consequence-review.json', {**review, 'at': time.time(), 'pngSHA256': c.read('consequence.json')['pngSHA256'],
                   'sourceNowEmpty': True, 'jumpedNowEmpty': True, 'destinationNowOccupied': True,
                   'remainingBefore': 32, 'remainingAfter': 31, 'removalEvidence': 'Synthetic fixture attestation; NOT actual Pegged removal'})
            a.resolve('destmanual', 'consequence')
            self.assertTrue(c.read('destmanual-resolution.json')['personallyViewed'])

        finally: self.finish()


if __name__ == '__main__':
    if '--production' in sys.argv:
        names = ['test_timely_ack_slow_parent_and_release_fsync'] + [n for cls in (b.p.Production, b.Production, Production) for n in cls.__dict__ if n.startswith('test_')]
        suite = unittest.TestSuite(Production(n) for n in names)
    else:
        suite = unittest.TestSuite([*(b.r.Refusal(n) for n in b.r.Refusal.__dict__ if n.startswith('test_')),
                                  *(b.t.Terminal(n) for n in b.t.Terminal.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

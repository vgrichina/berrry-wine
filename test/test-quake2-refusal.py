"""Production HTTP refusal fixtures; no game, original restart or guest progress."""
import importlib.util, pathlib, time, unittest, copy
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, path):
    s = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
b = load('refusal_baseline', ROOT / 'test/test-forsaken-controller.py')
c = load('quake2_refusal', ROOT / 'tools/quake2-guard.py')
b.control = c

class Refusal(b.Controller):
    def reviewed(self, name):
        c.capture(name)
        c.save(name + '-review.json', dict(at=time.time(), pngSHA256=c.read(name + '.json')['pngSHA256']))
    def case(self, name, *, pair=False, refuseIndex=0, corrupt=None, statusCorrupt=False, recover=False):
        self.start('q2-refusal-' + name)
        original = c.call
        sent = []
        def call(cmd, timeout=10):
            cmd = copy.deepcopy(cmd)
            if cmd.get('action') == 'guarded-input':
                index = len(sent); sent.append(copy.deepcopy(cmd))
                if index == refuseIndex:
                    # Host fixture only: expire before production guard prepares
                    # an effect. Never loaded by the original game recipe.
                    cmd['guard']['deadline'] = int(time.time() * 1000) - 1
                r = original(cmd, timeout)
                if index == refuseIndex and corrupt:
                    r.update(corrupt)
                return r
            r = original(cmd, timeout)
            if cmd.get('action') == 'guarded-status' and statusCorrupt:
                r['state'] = 'UNKNOWN'
            return r
        keys = ['keydown:40', 'keydown:39'] if pair else ['keydown:40']
        try:
            self.reviewed('fresh')
            with patch.object(c, 'call', call):
                if recover:
                    self.assertIn('NOT_SENT', c.pulse('refused', keys, 400, 'fresh', 'positive unconsumed production refusal', maxSceneAge=5))
                    self.assertFalse((self.out / 'terminal-input-failure.json').exists())
                    refusal = c.read('refused-rejection.json')
                    self.assertTrue(refusal['positivelyUnsent'])
                    self.assertEqual(c.read('refused-up.json')['state'], 'ACK')
                    self.assertTrue(c.read('refused-release-wait.json')['actualWait'])
                    self.assertEqual(len(sent), 1)  # Never resume an unsent tail.
                else:
                    with self.assertRaises(Exception):
                        c.pulse('refused', keys, 400, 'fresh', 'ambiguous or partially consumed refusal', maxSceneAge=5)
                    self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
                    with self.assertRaisesRegex(AssertionError, 'sticky'):
                        c.capture('blocked')
            if recover:
                owner = c.read('input-owner.json')
                nonce = c.read('refused-intent.json')['nonces'][0]
                status = original(dict(action='guarded-status', nonce=nonce))
                self.assertEqual(status['state'], 'CANCELLED'); self.assertIs(status['consumed'], False)
                with self.assertRaisesRegex(RuntimeError, 'nonce already used'):
                    original(sent[0])
                # Explicit new scene + new intent, same permanent binding.
                self.reviewed('different')
                c.pulse('fresh-action', ['keydown:39'], 400, 'different', 'new manual fixture intent after positive refusal', maxSceneAge=5)
                self.assertEqual(c.read('input-owner.json'), owner)
                self.assertNotIn(nonce, c.read('fresh-action-intent.json')['nonces'])
                self.assertEqual(c.read('fresh-action-down.json')[0]['state'], 'CONSUMED')
        finally:
            summary = self.finish()
        downs = [x for x in summary['effects'] if x['kind'] == 'DOWN']
        self.assertEqual(len(downs), 1 if recover or refuseIndex else 0)
        return summary
    def test_positive_all_unsent_then_fresh_intent(self):
        self.case('positive', recover=True)
    def test_refused_first_edge_never_sends_tail(self):
        self.case('unsent-tail', pair=True, recover=True)
    def test_partly_consumed_pair_stays_terminal(self):
        self.case('mixed', pair=True, refuseIndex=1)
    def test_unknown_stays_terminal(self):
        self.case('unknown', corrupt=dict(state='UNKNOWN'))
    def test_wrong_owner_stays_terminal(self):
        self.case('owner', corrupt=dict(owner='foreign'))
    def test_wrong_epoch_stays_terminal(self):
        self.case('epoch', corrupt=dict(epoch=999))
    def test_wrong_nonce_stays_terminal(self):
        self.case('nonce', corrupt=dict(nonce='foreign'))
    def test_status_unknown_stays_terminal(self):
        self.case('status', statusCorrupt=True)

if __name__ == '__main__':
    names = [n for n in Refusal.__dict__ if n.startswith('test_')]
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Refusal(n) for n in names)).wasSuccessful())

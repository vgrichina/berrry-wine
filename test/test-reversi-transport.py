"""Exercise the Reversi transport against HTTP fixtures and the actual CLI.

--production is heavy work. The actual CLI fixture is Solitaire, never another
Reversi deal. All instrumentation remains confined to fixtures.
"""
import importlib.util, pathlib, sys, unittest, time
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('reversi','tools/reversi-controller.py')
b=load('transport','test/test-barrage-transport.py')
c=a.c
b.c=c;b.r.c=c;b.r.b.control=c;b.t.c=c;b.t.base.control=c
b.p.c=c;b.p.p.c=c;b.p.b.control=c

class Production(b.Production):
    def test_reviewed_binding_and_reversi_policy_at_actual_endpoint(self):
        nativeBind=c.bind
        originalSave=b.p.b.save
        def fixtureSave(out,name,value):
            # Give this isolated fixture a real 180s reserve; it still exits
            # immediately in finish(), and the CLI itself retains its 40s cap.
            if name=='recipe.json':value={**value,'seconds':240}
            return originalSave(out,name,value)
        def reviewedBind():
            c.capture('submitted')
            c.save('submitted-review.json',dict(at=time.time(),pngSHA256=c.read('submitted.json')['pngSHA256'],
                   submittedScene=True,nativeBoard=True,observation='Actual Solitaire fixture canvas; no Reversi game claim'))
            with patch.object(c,'bind',nativeBind):a.bind('submitted')
        with patch.object(c,'bind',reviewedBind),patch.object(b.p.b,'save',fixtureSave):self.start('reversi-policy')
        try:
            c.capture('choice')
            c.save('choice-review.json',dict(at=time.time(),pngSHA256=c.read('choice.json')['pngSHA256'],mode='place',
                   observation='Fixture only: manually chosen native pointer click',originalRulesUnchanged=True,
                   opponentSettled=True,legalReason='Synthetic policy metadata in Solitaire fixture; no Reversi legality claim',
                   pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,200])))
            a.pulse('manual',['mousedown:200:200'],400,'choice','fixture pointer choice','place')
            self.assertTrue(c.read('manual-receipt.json')['consumed'])
            self.assertEqual(c.read('manual-up.json')['state'],'ACK')
        finally:self.finish()

if __name__=='__main__':
    if '--production' in sys.argv:
        names=['test_timely_ack_slow_parent_and_release_fsync']+[n for cls in (b.p.Production,b.Production,Production) for n in cls.__dict__ if n.startswith('test_')]
        suite=unittest.TestSuite(Production(n) for n in names)
    else:
        suite=unittest.TestSuite([*(b.r.Refusal(n) for n in b.r.Refusal.__dict__ if n.startswith('test_')),
                                *(b.t.Terminal(n) for n in b.t.Terminal.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

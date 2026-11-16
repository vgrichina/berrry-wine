"""Real endpoint/independent release checks; --production uses Solitaire only.

No fixture instrumentation is ever loaded in the original FreeCell game.
"""
import importlib.util, pathlib, sys, unittest, time
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path)
    m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('freecell','tools/freecell-controller.py')
b=load('transport','test/test-barrage-transport.py')
c=a.c
b.c=c;b.r.c=c;b.r.b.control=c;b.t.c=c;b.t.base.control=c
b.p.c=c;b.p.p.c=c;b.p.b.control=c

class Production(b.Production):
    def test_reviewed_bind_and_separate_clicks_at_actual_endpoint(self):
        nativeBind=c.bind;originalSave=b.p.b.save
        def fixtureSave(out,name,value):
            if name=='recipe.json':value={**value,'seconds':240}
            return originalSave(out,name,value)
        def reviewedBind():
            c.capture('submitted')
            c.save('submitted-review.json',dict(at=time.time(),pngSHA256=c.read('submitted.json')['pngSHA256'],
                   submittedScene=True,nativeBoard=True,observation='Actual Solitaire fixture canvas; no FreeCell game claim'))
            with patch.object(c,'bind',nativeBind):a.bind('submitted')
        with patch.object(c,'bind',reviewedBind),patch.object(b.p.b,'save',fixtureSave):self.start('freecell-policy')
        try:
            for mode in ('select','destination'):
                c.capture(mode+'-scene')
                r=dict(at=time.time(),pngSHA256=c.read(mode+'-scene.json')['pngSHA256'],mode=mode,
                       observation='Fixture pointer choice, no actual card legality claim',originalRulesUnchanged=True,
                       settledPaint=True,card='fixture-card',legalReason='Synthetic metadata; tests controller delivery only',
                       pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,200]))
                if mode=='destination':r.update(selectionVisible=True,selectionAction='select',destinationKind='free-cell')
                c.save(mode+'-scene-review.json',r)
                a.pulse(mode,['mousedown:200:200'],400,mode+'-scene',r['observation'],mode)
                self.assertTrue(c.read(mode+'-receipt.json')['consumed'])
                self.assertEqual(c.read(mode+'-up.json')['state'],'ACK')
        finally:self.finish()

if __name__=='__main__':
    if '--production' in sys.argv:
        names=['test_timely_ack_slow_parent_and_release_fsync']+[n for cls in (b.p.Production,b.Production,Production) for n in cls.__dict__ if n.startswith('test_')]
        suite=unittest.TestSuite(Production(n) for n in names)
    else:
        suite=unittest.TestSuite([*(b.r.Refusal(n) for n in b.r.Refusal.__dict__ if n.startswith('test_')),
                                *(b.t.Terminal(n) for n in b.t.Terminal.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

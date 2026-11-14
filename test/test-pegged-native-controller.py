"""Personal review boundaries. Synthetic metadata is never native-game proof."""
import pathlib, importlib.util, tempfile, unittest, hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('native',ROOT/'tools/pegged-native-controller.py')
n=importlib.util.module_from_spec(s);s.loader.exec_module(n)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();n.c.R=pathlib.Path(self.tmp.name)
        n.c.save('launch.json',dict(at=100,deadline=1000));n.c.save('native-pid.json',dict(pid=123,startToken='fixed'))
        n.c.save('board-admitted.json',dict(scene='board'))
        self.clock=patch.object(n.time,'time',return_value=500);self.clock.start()
    def tearDown(self):self.clock.stop();self.tmp.cleanup()
    def scene(self,name='scene',**changes):
        (n.c.R/(name+'.png')).write_bytes(b'fixture-not-original-evidence')
        sha=hashlib.sha256((n.c.R/(name+'.png')).read_bytes()).hexdigest()
        n.c.save(name+'.json',dict(at=499,target=n.c.read('native-pid.json'),pngSHA256=sha,snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
        review=dict(at=499,pngSHA256=sha,submittedScene=True,observation='synthetic review',mode='drag',sceneType='board',defaultBoard=True,originalRulesUnchanged=True,settledPaint=True,nativeSemantics='original-left-drag',sourcePeg='fixture-source',jumpedPeg='fixture-middle',emptyDestination='fixture-empty',legalReason='fixture-only legal attestation',sourceOccupied=True,jumpedOccupied=True,destinationEmpty=True,remainingBefore=6,pixelGeometry=dict(source='current-full-scene',target=n.c.read('native-pid.json'),sourceCenter=[200,240],destinationCenter=[200,120]))
        n.c.save(name+'-review.json',{**review,**changes})
    def test_one_fixed_drag(self):self.scene();n.policy('scene',500)
    def test_bounds(self):
        self.scene()
        for ms in (0,99,1501,True,500.0):
            with self.assertRaises(AssertionError):n.policy('scene',ms)
    def test_each_required_attestation(self):
        for k,v in [('sourceOccupied',False),('jumpedOccupied',False),('destinationEmpty',False),('settledPaint',False),('defaultBoard',False),('originalRulesUnchanged',False),('nativeSemantics','click-click'),('sourcePeg',''),('legalReason',''),('remainingBefore',1),('sceneType','bootstrap')]:
            name=k;self.scene(name,**{k:v})
            with self.assertRaises(AssertionError):n.policy(name,500)
    def test_image_tamper(self):
        self.scene();(n.c.R/'scene.png').write_bytes(b'changed')
        with self.assertRaises(AssertionError):n.policy('scene',500)
    def test_stale_scene(self):
        self.scene()
        with patch.object(n.time,'time',return_value=505):
            with self.assertRaises(AssertionError):n.policy('scene',500)
    def test_identity_change(self):
        self.scene();(n.c.R/'native-pid.json').unlink();n.c.save('native-pid.json',dict(pid=124,startToken='different'))
        with self.assertRaises(AssertionError):n.policy('scene',500)
    def test_exact_source_destination_geometry(self):
        for i,g in enumerate([dict(source='old',target=n.c.read('native-pid.json'),sourceCenter=[200,240],destinationCenter=[200,120]),dict(source='current-full-scene',target=n.c.read('native-pid.json'),sourceCenter=[200,240],destinationCenter=[200,240]),dict(source='current-full-scene',target=n.c.read('native-pid.json'),sourceCenter=[800,240],destinationCenter=[200,120])]):
            self.scene(str(i),pixelGeometry=g)
            with self.assertRaises(AssertionError):n.policy(str(i),500)
    def test_pending_gesture_blocks_next(self):
        self.scene();n.c.save('prior-drag-intent.json',dict(name='prior'))
        with self.assertRaisesRegex(AssertionError,'completed gesture'):n.policy('scene',500)
    def test_scene_single_use(self):
        self.scene();n.c.save('scene-used-by-prior',dict(name='prior'))
        with self.assertRaises(AssertionError):n.policy('scene',500)
    def test_quit_and_outcome_irreversible(self):
        self.scene();n.c.save('quit-phase.json',dict(at=500))
        with self.assertRaises(AssertionError):n.policy('scene',500)
        (n.c.R/'quit-phase.json').unlink();n.c.save('natural-outcome.json',dict(outcome='no-moves'))
        with self.assertRaises(AssertionError):n.policy('scene',500)
    def test_no_down_at_cutoff(self):
        self.scene()
        with patch.object(n.time,'time',return_value=813),patch.object(n.c,'call') as call:
            with self.assertRaises(AssertionError):n.drag('late','scene')
            call.assert_not_called()
    def test_receipt_identity_nonce_and_unknown(self):
        owner=dict(owner='owner',epoch=1);r=dict(owner='owner',epoch=1,nonce='n',state='CONSUMED',consumed=True,consumedAt=500000)
        self.assertTrue(n.consumed(r,owner,'n'))
        for changed in (dict(state='UNKNOWN'),dict(owner='other'),dict(epoch=2),dict(nonce='other'),dict(consumed=False)):
            self.assertFalse(n.consumed({**r,**changed},owner,'n'))
    def test_ack_cannot_prove_removal(self):
        self.scene();n.c.save('gesture-drag-intent.json',dict(review='scene'));n.c.save('gesture-completed.json',dict(actualRemovalClaim=False))
        self.scene('after',sourceNowEmpty=True,jumpedNowEmpty=True,destinationNowOccupied=True,remainingAfter=6,removalEvidence='synthetic unchanged')
        with patch.object(n.c,'lease'):
            with self.assertRaises(AssertionError):n.resolve('gesture','after')
        self.assertFalse((n.c.R/'gesture-resolution.json').exists())
    def test_outcome_acknowledgement_requires_actual_record_and_ok(self):
        self.scene(mode='dismiss-outcome',visibleOutcomeDismissal=True,dialogCaption='Game Over',dismissLabel='OK',pixelGeometry=dict(source='current-full-scene',target=n.c.read('native-pid.json'),chosenCenter=[300,300]))
        with patch.object(n.c,'pulse') as sent:
            with self.assertRaisesRegex(AssertionError,'natural outcome'):n.dismiss_outcome('ok','scene')
            sent.assert_not_called()
            n.c.save('natural-outcome.json',dict(outcome='no-moves'))
            n.dismiss_outcome('ok','scene')
            self.assertEqual(sent.call_args.args[1],['mousedown:300:300'])
        self.scene('restart',mode='dismiss-outcome',visibleOutcomeDismissal=True,dialogCaption='Game Over',dismissLabel='New Game',pixelGeometry=dict(source='current-full-scene',target=n.c.read('native-pid.json'),chosenCenter=[300,300]))
        with self.assertRaisesRegex(AssertionError,'OK button'):n.dismiss_outcome('restart','restart')

if __name__=='__main__':unittest.main()

"""Policy checks on synthetic metadata, never SkiFree gameplay proof."""
import importlib.util, pathlib, tempfile, unittest, time, hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('ski',ROOT/'tools/skifree-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1000));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='steer',**kw):
  data=b'synthetic fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic scene review',mode=mode,sceneType='slope',defaultCourse=True,skierVisible=True,underlyingSceneVisible=True,directionIntent='fixture left',obstacleReason='fixture only',skierDescription='fixture skier',hudDescription='fixture HUD',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240],insideSkiClient=True)),**kw}))
 def admitted(self):c.save('course-admitted.json',dict(fixture=True))
 def test_single_exact_move(self):
  self.scene();self.admitted();a.policy('mousemove:200:240','fresh','steer')
  for cmd in ('mousemove:201:240','mousemove:200:240,mousemove:100:100','keydown:37','keydown:113','keypress:102','keypress:116','keypress:120','keypress:121'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','steer')
 def test_admission_before_gameplay(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'actual skier'):a.policy('mousemove:200:240','fresh','steer')
 def test_bootstrap_not_slope(self):
  self.scene(sceneType='bootstrap');self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousemove:200:240','fresh','steer')
 def test_masked_pause_not_review(self):
  self.scene(underlyingSceneVisible=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousemove:200:240','fresh','steer')
 def test_native_f3_only(self):
  self.scene(mode='pause',nativePauseChoice='fixture pause');self.admitted();a.policy('keydown:114','fresh','pause')
  with self.assertRaises(AssertionError):a.policy('keydown:113','fresh','pause')
 def test_outside_client_rejected(self):
  self.scene(pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240],insideSkiClient=False));self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousemove:200:240','fresh','steer')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousemove:200:240','fresh','steer')
 def test_bootstrap_once(self):
  self.scene(mode='bootstrap',sceneType='bootstrap',nativeBootstrapTarget=True);a.policy('keydown:13','fresh','bootstrap')
  c.save('bootstrap-submitted.json',{})
  with self.assertRaisesRegex(AssertionError,'one bootstrap'):a.policy('keydown:13','fresh','bootstrap')
 def test_no_bootstrap_after_admission(self):
  self.scene(mode='bootstrap',sceneType='bootstrap',nativeBootstrapTarget=True);self.admitted()
  with self.assertRaises(AssertionError):a.policy('keydown:13','fresh','bootstrap')
 def test_quit_irreversible_and_reviewed(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('next');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousemove:200:240','next','steer')
 def test_confirmation_separate(self):
  self.scene(mode='quit',quitRoute='confirm-exit',visibleQuitTarget=True)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','quit','confirm-exit')
 def test_natural_outcome_ends_gameplay(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaises(AssertionError):a.policy('mousemove:200:240','fresh','steer')
 def test_no_replayed_scene(self):
  self.scene();self.admitted();c.save('fresh-used-by-prior',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):a.policy('mousemove:200:240','fresh','steer')
 def test_bind_checks_image_identity(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_bound_and_no_1500_midcapture(self):
  with self.assertRaises(AssertionError):a.action('bad','keydown:114','fresh','pause',1501)
  self.scene();self.admitted();rr,r,end=a.policy('mousemove:200:240','fresh','steer');self.assertEqual(end,504)
 def test_admission_requires_actual_skier(self):
  self.scene(skierVisible=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.admit('fresh')
if __name__=='__main__':unittest.main()

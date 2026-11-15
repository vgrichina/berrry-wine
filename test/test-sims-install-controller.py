"""Synthetic controller policy negatives; no original gameplay evidence."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib,json
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sims',ROOT/'tools/sims-install-controller.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a);c=a.c

class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='install',**extra):
  data=b'fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',screen=dict(w=800,h=600))))
  review=dict(at=499,pngSHA256=sha,submittedScene=True,rawCompleteScene=True,observation='synthetic only',
    mode=mode,sceneType='installer',ordinaryNativeUI=True,visibleLabel='Next',installRoute='next',
    serialRequired=False,mediaCheckBypassed=False,pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240]))
  review.update(extra);c.save(name+'-review.json',review)
 def invoke(self,scene='fresh',mode='install',route='next',command='mousedown:200:240'):
  return a.policy(command,scene,mode,route)
 def test_original_installer_next(self):self.scene();self.invoke()
 def test_serial_boundary(self):
  self.scene(serialRequired=True)
  with self.assertRaisesRegex(AssertionError,'serial boundary'):self.invoke()
 def test_no_media_bypass(self):
  self.scene(mediaCheckBypassed=True)
  with self.assertRaises(AssertionError):self.invoke()
 def test_no_synthetic_success_target(self):
  self.scene(ordinaryNativeUI=False)
  with self.assertRaises(AssertionError):self.invoke()
 def test_one_pointer_only(self):
  self.scene()
  for cmd in ('keydown:113','mousedown:200:240,mousedown:100:100','mousedown:201:240','click:200:240'):
   with self.subTest(cmd=cmd),self.assertRaises(AssertionError):self.invoke(command=cmd)
 def test_no_serial_or_executable_patch_route(self):
  self.scene()
  for route in ('serial','patch','bypass','next,next'):
   with self.subTest(route=route),self.assertRaises(AssertionError):self.invoke(route=route)
 def test_full_scene_required(self):
  self.scene(rawCompleteScene=False)
  with self.assertRaisesRegex(AssertionError,'complete scene'):self.invoke()
 def test_hash_integrity(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with self.assertRaises(AssertionError):self.invoke()
 def test_menu_expiry(self):
  self.scene()
  with patch.object(time,'time',return_value=529),self.assertRaisesRegex(AssertionError,'expired'):self.invoke()
 def test_gameplay_expiry(self):
  self.scene(mode='select',sceneType='household',chosenSim='fixture')
  c.save('household-reviewed.json',{})
  with patch.object(time,'time',return_value=504),self.assertRaisesRegex(AssertionError,'expired'):self.invoke(mode='select',route=None)
 def test_household_requires_loading(self):
  self.scene(mode='household',sceneType='neighborhood',chosenHousehold='fixture')
  with self.assertRaisesRegex(AssertionError,'loading separately'):self.invoke(mode='household',route=None)
 def test_selection_requires_household(self):
  self.scene(mode='select',sceneType='household',chosenSim='fixture')
  with self.assertRaisesRegex(AssertionError,'household separately'):self.invoke(mode='select',route=None)
 def test_action_requires_separate_selection(self):
  self.scene(mode='action',sceneType='household')
  with self.assertRaisesRegex(AssertionError,'selection separately'):self.invoke(mode='action',route=None)
 def test_one_personal_action_only(self):
  self.scene(mode='action',sceneType='action-menu',personallyChosenAction='Sit',visibleSelectedSim='Bob',liveHousehold=True)
  c.save('selection-reviewed.json',dict(review=dict(visibleSelectedSim='Bob')))
  self.invoke(mode='action',route=None);c.save('chosen-action.json',{})
  with self.assertRaisesRegex(AssertionError,'one visible action'):self.invoke(mode='action',route=None)
 def test_scene_cannot_be_replayed(self):
  self.scene();c.save('fresh-used-by-old',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):self.invoke()
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='titlebar-close',visibleQuitTarget=True)
  self.invoke(mode='quit',route='titlebar-close');self.scene('next')
  with self.assertRaisesRegex(AssertionError,'irreversible'):self.invoke(scene='next')
 def test_reserved_quit_time(self):
  self.scene()
  with patch.object(time,'time',return_value=1121),self.assertRaises(AssertionError):self.invoke()
  self.assertTrue((c.R/'quit-phase.json').exists())
 def test_short_or_long_hold_never_sent(self):
  for ms in (0,40,79,1501):
   with self.subTest(ms=ms),patch.object(c,'call') as call:
    with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','install',ms,'next')
    call.assert_not_called()
   self.assertFalse((c.R/'bad-intent.json').exists())
 def test_bootstrap_title_required(self):
  self.scene()
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_capture_refuses_pending_gesture(self):
  c.save('pending-intent.json',{})
  with patch.object(c,'opened'),patch.object(c,'call') as call:
   with self.assertRaisesRegex(AssertionError,'unresolved physical'):c.capture('capture')
   call.assert_not_called()
 def test_capture_after_completed_release_ignores_guard_summary(self):
  c.save('chosen-intent.json',dict(nonce='physical'))
  c.save('chosen-up.json',dict(state='ACK'));c.save('chosen-completed.json',{})
  c.save('last-intent.json',dict(nonces=['physical']))
  def call(command,timeout=10):
   if command.get('action')=='snapshot':return dict(mainHwnd='0x1')
   (c.R/'after.png').write_bytes(b'fixture');return 'fixture'
  with patch.object(c,'opened'),patch.object(c,'call',call):self.assertEqual(c.capture('after'),str(c.R/'after.png'))
 def test_result_must_be_separate_after_up(self):
  self.scene(mode='action',sceneType='result',checkpointEvidence='fixture only',visibleActionResult='sits',actionEvidenceSeparateFromACK=True)
  c.save('selection-reviewed.json',dict(at=498));c.save('chosen-action.json',dict(name='chosen'));c.save('chosen-up.json',dict(at=500))
  with patch.object(c,'lease'),self.assertRaisesRegex(AssertionError,'post-UP'):a.checkpoint('result','fresh')
 def test_distinct_household_scene(self):
  self.scene(sceneType='household',checkpointEvidence='fixture',liveHousehold=True,visibleHouseholdName='Newbie')
  c.save('loading-reviewed.json',dict(at=499))
  with patch.object(c,'lease'),self.assertRaisesRegex(AssertionError,'distinct later'):a.checkpoint('household','fresh')
 def test_ack_is_no_gameplay_result(self):
  self.scene(sceneType='result',checkpointEvidence='ACK',visibleActionResult='',actionEvidenceSeparateFromACK=False)
  c.save('selection-reviewed.json',dict(at=498));c.save('chosen-action.json',dict(name='chosen'));c.save('chosen-up.json',dict(at=498))
  with patch.object(c,'lease'),self.assertRaises(AssertionError):a.checkpoint('result','fresh')
if __name__=='__main__':unittest.main()


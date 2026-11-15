"""Synthetic policy metadata only; no original Chips gameplay evidence."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('chips',ROOT/'tools/chips-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='move',**kw):
  data=b'fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',focus='0x0',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic review',mode=mode,sceneType='board',defaultLesson1=True,settledPaint=True,completeBoard=True,visibleBoardDescription='fixture only',rulesEvidence='fixture static rules',legalReason='visible floor to right',chosenDirection='right',routeFromCurrentPixels=True,inputRoute='native-keyboard',keyboardConsumer='0x1',keyboardFocus='0x0',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def test_one_direction(self):
  self.scene();self.admitted();a.policy('keydown:39','fresh','move')
  for cmd in ('keydown:38','keydown:39,keyup:39','keydown:113','keydown:82','keydown:13','mousedown:200:240','post-cmd:1'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','move')
 def test_board_before_play(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'actual lesson board'):a.policy('keydown:39','fresh','move')
 def test_no_nondefault_lesson(self):
  self.scene(defaultLesson1=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('keydown:39','fresh','move')
 def test_visible_route(self):
  self.scene(routeFromCurrentPixels=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('keydown:39','fresh','move')
 def test_current_focus_required(self):
  self.scene(keyboardFocus='0x9');self.admitted()
  with self.assertRaises(AssertionError):a.policy('keydown:39','fresh','move')
 def test_actual_consumer_required(self):
  self.scene(keyboardConsumer='0x9');self.admitted()
  with self.assertRaisesRegex(AssertionError,'consumer'):a.policy('keydown:39','fresh','move')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('keydown:39','fresh','move')
 def test_overlay_enter_only(self):
  self.scene(mode='menu',sceneType='lesson-overlay',menuRoute='dismiss-lesson',visibleLabel='Lesson 1')
  a.policy('keydown:13','fresh','menu','dismiss-lesson')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','dismiss-lesson')
 def test_overlay_once(self):
  self.scene(mode='menu',sceneType='lesson-overlay',menuRoute='dismiss-lesson',visibleLabel='Lesson 1');c.save('lesson-dismiss-intent.json',{})
  with self.assertRaisesRegex(AssertionError,'only once'):a.policy('keydown:13','fresh','menu','dismiss-lesson')
 def test_no_selection_or_options(self):
  self.scene(mode='menu',menuRoute='level-select',visibleLabel='Level')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','level-select')
 def test_no_replay(self):
  self.scene();self.admitted();c.save('fresh-used-by-previous',{})
  with self.assertRaisesRegex(AssertionError,'no replay'):a.policy('keydown:39','fresh','move')
 def test_no_tampered_pixels(self):
  self.scene();self.admitted();(c.R/'fresh.png').write_bytes(b'changed')
  with self.assertRaises(AssertionError):a.policy('keydown:39','fresh','move')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True)
  a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('again');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('keydown:39','again','move')
 def test_quit_reserve_enforced(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=1120):
   with self.assertRaises(AssertionError):a.policy('keydown:39','fresh','move')
  self.assertTrue(c.read('quit-phase.json')['irreversible'])
 def test_menu_thirty_seconds(self):
  self.scene(mode='menu',menuRoute='open-help',visibleLabel='Help')
  with patch.object(time,'time',return_value=520):a.policy('mousedown:200:240','fresh','menu','open-help')
 def test_quit_label(self):
  self.scene(mode='quit',quitRoute='select-exit',visibleQuitTarget=True,visibleLabel='Restart')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','quit','select-exit')
 def test_bind_requires_bootstrap(self):
  self.scene(registeredOriginal=True)
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_binding_window_mismatch_closes(self):
  self.scene(registeredOriginal=True,completeBootstrapReviewed=True);c.save('lease-snapshot.json',{})
  with patch.object(c,'bind'):
   with self.assertRaisesRegex(AssertionError,'binding scene'):a.bind('fresh')
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_rebind_refused_before_http(self):
  c.save('input-owner.json',{})
  with patch.object(c,'opened'),patch.object(c,'call') as call:
   with self.assertRaisesRegex(AssertionError,'no rebind'):c.bind()
   call.assert_not_called()
 def test_consequence_requires_post_up(self):
  self.scene(visibleConsequence='chip-counter',consequenceEvidence='counter changed',beforeEvidence='fixture only',afterEvidence='chip gone counter 10');c.save('one-intent.json',dict(mode='move',target=c.read('native-pid.json'),scene='fresh'));c.save('one-completed.json',dict(actualCollectionClaim=False));c.save('one-up.json',dict(at=499.5))
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.consequence('one','fresh')
 def test_transport_not_collection(self):
  self.scene(visibleConsequence='chip-counter',consequenceEvidence='',beforeEvidence='fixture only',afterEvidence='something');c.save('one-intent.json',dict(mode='move',target=c.read('native-pid.json'),scene='fresh'));c.save('one-completed.json',dict(actualCollectionClaim=False));c.save('one-up.json',dict(at=498))
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.consequence('one','fresh')
 def test_personally_reviewed_counter_consequence(self):
  self.scene(visibleConsequence='chip-counter',consequenceEvidence='visible chip disappears and counter 11 to 10',beforeEvidence='fixture only',afterEvidence='chip gone counter 10');c.save('one-intent.json',dict(mode='move',target=c.read('native-pid.json'),scene='fresh'));c.save('one-completed.json',dict(actualCollectionClaim=False));c.save('one-up.json',dict(at=498))
  with patch.object(c,'lease'):a.consequence('one','fresh')
  self.assertEqual(c.read('one-consequence.json')['kind'],'chip-counter')
  self.assertFalse(c.read('one-consequence.json')['nativeCompletionClaim'])
 def test_unrelated_consequence_refused(self):
  self.scene(visibleConsequence='door-opened',consequenceEvidence='visible door gone',beforeEvidence='other board',afterEvidence='door gone');c.save('one-intent.json',dict(mode='move',target=c.read('native-pid.json'),scene='fresh'));c.save('one-completed.json',dict(actualCollectionClaim=False));c.save('one-up.json',dict(at=498))
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.consequence('one','fresh')
 def test_board_child_focus_refused(self):
  self.scene();self.admitted();rr=c.read('fresh.json');rr['snapshot']['focus']='0x2';(c.R/'fresh.json').write_text(__import__('json').dumps(rr))
  with self.assertRaisesRegex(AssertionError,'board child focus'):a.policy('keydown:39','fresh','move')
 def test_owner_exit_needs_actual_wait_and_both_eof(self):
  target=dict(pid=123,startToken='fixture',at=100);(c.R/'native-pid.json').write_text(__import__('json').dumps(target))
  c.save('native-wait.json',dict(**target,exit=0,actualWait=True,stdoutEOF=True,stderrEOF=False,drainErrors=[]))
  self.assertIsNone(c.exited_owner(target))
 def test_completed_lesson_disallows_movement(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaisesRegex(AssertionError,'lesson exit ends'):a.policy('keydown:39','fresh','move')
 def test_native_outcome_requires_visible_evidence(self):
  self.scene(nativeLessonExit=True,completionEvidence='')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_single_file_no_external_controller(self):
  source=(ROOT/'tools/chips-controller.py').read_text()
  self.assertNotIn('importlib',source);self.assertNotIn('barrage-guard.py',source)
if __name__=='__main__':unittest.main()

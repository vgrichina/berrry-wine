"""Policy controls use invented pixel metadata, never an original puzzle board."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib,json
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('klotski',ROOT/'tools/klotski-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a);c=a.c

def metadata(target,mode='move'):
 return dict(submittedScene=True,rawCompleteScene=True,observation='invented fixture review only',mode=mode,sceneType='board',defaultFirstPuzzle=True,defaultFirstPuzzleOnly=True,settledPaint=True,completeBoard=True,visibleBoardDescription='invented block and free floor',rulesEvidence='synthetic fixture',nativeCounter=0,nativeCounterEvidence='invented counter 0',chosenBlock='invented square',sourceEvidence='square at source',destinationEvidence='floor at destination',occupiedNeighbors='invented left neighbor',freeArea='invented floor below',legalReason='straight into free floor',nativePickEvidence='invented current hit proof',routeFromCurrentPixels=True,destinationFree=True,sourceOccupied=True,collisionFree=True,nativePickFromCurrentScene=True,pixelGeometry=dict(source='current-full-scene',target=target,chosenPoint=[200,240],destination=[200,260]))

class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self): self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='move',**kw):
  data=b'fixture';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',focus='0x2',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**metadata(c.read('native-pid.json'),mode),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def valid(self,**kw):self.scene(**kw);self.admitted()
 def test_one_drag(self):
  self.valid();a.policy('mousedown:200:240','fresh','move')
  for cmd in ('mousedown:201:240','mousedown:200:240,mouseup:200:260','keydown:39','post-cmd:1','mousemove:200:260'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','move')
 def test_complete_board_required(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'actual complete'):a.policy('mousedown:200:240','fresh','move')
 def test_no_nondefault(self):
  self.valid(defaultFirstPuzzle=False)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_missing_collision_review(self):
  self.valid(collisionFree=False)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_occupied_destination_refused(self):
  self.valid(destinationFree=False)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_old_pick_authority_refused(self):
  self.valid(nativePickFromCurrentScene=False)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_all_personal_fields_required(self):
  self.valid()
  original=c.read('fresh-review.json')
  for k in ('chosenBlock','sourceEvidence','destinationEvidence','occupiedNeighbors','freeArea','legalReason','nativePickEvidence','nativeCounterEvidence','visibleBoardDescription','rulesEvidence'):
   v={**original,k:''};(c.R/'fresh-review.json').write_text(json.dumps(v))
   with self.subTest(k=k),self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_diagonal_refused(self):
  self.valid();v=c.read('fresh-review.json');v['pixelGeometry']['destination']=[210,260];(c.R/'fresh-review.json').write_text(json.dumps(v))
  with self.assertRaisesRegex(AssertionError,'straight'):a.policy('mousedown:200:240','fresh','move')
 def test_outside_canvas_refused(self):
  self.valid();v=c.read('fresh-review.json');v['pixelGeometry']['destination']=[200,900];(c.R/'fresh-review.json').write_text(json.dumps(v))
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_fresh_five_seconds(self):
  self.valid()
  with patch.object(time,'time',return_value=504),self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','move')
 def test_no_reuse(self):
  self.valid();c.save('fresh-used-by-one',{})
  with self.assertRaisesRegex(AssertionError,'no replay'):a.policy('mousedown:200:240','fresh','move')
 def test_no_tampered_capture(self):
  self.valid();(c.R/'fresh.png').write_bytes(b'changed')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
 def test_no_next_before_consequence(self):
  self.valid();c.save('pending-placement.json',dict(action='previous'))
  with self.assertRaisesRegex(AssertionError,'persistent review'):a.policy('mousedown:200:240','fresh','move')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('again');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousedown:200:240','again','move')
 def test_quit_reserve(self):
  self.valid()
  with patch.object(time,'time',return_value=1120),self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','move')
  self.assertTrue(c.read('quit-phase.json')['irreversible'])
 def test_menu_thirty_seconds(self):
  self.scene(mode='menu',menuRoute='open-help',visibleLabel='Help')
  with patch.object(time,'time',return_value=520):a.policy('mousedown:200:240','fresh','menu','open-help')
 def test_no_puzzle_cycling(self):
  self.scene(mode='menu',menuRoute='first-level',visibleLabel='Level 1',bootstrapRequired=True);self.admitted()
  with self.assertRaisesRegex(AssertionError,'no puzzle cycling'):a.policy('mousedown:200:240','fresh','menu','first-level')
 def test_no_second_bootstrap(self):
  self.scene(mode='menu',menuRoute='first-level',visibleLabel='Level 1',bootstrapRequired=True);c.save('first-level-intent.json',{})
  with self.assertRaisesRegex(AssertionError,'one bootstrap'):a.policy('mousedown:200:240','fresh','menu','first-level')
 def test_no_other_level_disguised_as_bootstrap(self):
  self.scene(mode='menu',menuRoute='first-level',visibleLabel='Level 2',bootstrapRequired=True)
  with self.assertRaisesRegex(AssertionError,'only visible first'):a.policy('mousedown:200:240','fresh','menu','first-level')
 def test_puzzle_selection_needs_current_dialog(self):
  self.scene(mode='menu',menuRoute='first-puzzle-ok',visibleLabel='OK',bootstrapRequired=True)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','first-puzzle-ok')
 def test_unnecessary_bootstrap_refused(self):
  self.scene(mode='menu',menuRoute='welcome-ok',visibleLabel='OK')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','welcome-ok')
 def test_only_ordinary_name(self):
  self.scene(mode='menu',menuRoute='name-character',visibleLabel='Name',bootstrapRequired=True,nameFieldFocused=True,ordinaryNameOnly=True)
  a.policy('keydown:65','fresh','menu','name-character')
  with self.assertRaises(AssertionError):a.policy('keydown:113','fresh','menu','name-character')
 def test_quit_label(self):
  self.scene(mode='quit',quitRoute='select-exit',visibleQuitTarget=True,visibleLabel='Reset')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','quit','select-exit')
 def test_short_admission_before_intent_prearm_http(self):
  for ms in (0,39,40,79,1501):
   with self.subTest(ms=ms),patch.object(c,'call') as call,patch.object(a,'policy') as policy,patch.object(a.subprocess,'Popen') as child:
    with self.assertRaises(AssertionError):a.action('short','mousedown:200:240','fresh','move',ms)
    call.assert_not_called();policy.assert_not_called();child.assert_not_called();self.assertFalse((c.R/'short-intent.json').exists())
 def test_rebind_before_http(self):
  c.save('input-owner.json',{})
  with patch.object(c,'opened'),patch.object(c,'call') as call:
   with self.assertRaisesRegex(AssertionError,'no rebind'):c.bind()
   call.assert_not_called()
 def test_truthful_bootstrap_before_board(self):
  self.scene(sceneType='bootstrap',defaultFirstPuzzle=False,completeBoard=False,registeredOriginal=True,completeBootstrapReviewed=True,bootstrapState='welcome pending; no puzzle selected')
  c.save('lease-snapshot.json',{k:c.read('fresh.json')['snapshot'][k] for k in ('mainHwnd','screen')})
  with patch.object(c,'bind') as bound:a.bind('fresh')
  bound.assert_called_once();self.assertTrue((c.R/'binding-scene.json').exists())
 def test_no_capture_while_gesture_unresolved(self):
  c.save('held-intent.json',dict(name='held',gestureDeadline=501))
  with patch.object(c,'opened'),patch.object(c,'call') as call:
   with self.assertRaisesRegex(AssertionError,'no capture while'):c.capture('held-scene')
   call.assert_not_called()
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def placement(self,**kw):
  self.valid();c.save('one-intent.json',dict(mode='move',target=c.read('native-pid.json'),scene='fresh'));c.save('one-completed.json',dict(actualMovementClaim=False));c.save('one-up.json',dict(at=498,state='ACK'));c.save('pending-placement.json',dict(action='one'))
  self.scene('after',nativeCounter=1,visibleBoardDescription='square in destination source now floor',beforeEvidence='invented block and free floor',sourceVacant=True,destinationOccupied=True,neighborsPreserved=True,sourceVacancyEvidence='floor where square was',destinationOccupancyEvidence='square where floor was',collisionAcceptanceEvidence='neighbors remain',**kw)
 def test_ack_not_placement(self):
  self.placement();v=c.read('after-review.json');v['sourceVacant']=False;(c.R/'after-review.json').write_text(json.dumps(v))
  with patch.object(c,'lease'),self.assertRaises(AssertionError):a.consequence('one','after')
 def test_counter_must_advance(self):
  self.placement();v=c.read('after-review.json');v['nativeCounter']=0;(c.R/'after-review.json').write_text(json.dumps(v))
  with patch.object(c,'lease'),self.assertRaises(AssertionError):a.consequence('one','after')
 def test_post_up_required(self):
  self.placement();(c.R/'one-up.json').write_text(json.dumps(dict(at=499.5,state='ACK')))
  with patch.object(c,'lease'),self.assertRaises(AssertionError):a.consequence('one','after')
 def test_persistent_two_scenes(self):
  self.placement();(c.R/'one-up.json').write_text(json.dumps(dict(at=498,state='ACK')))
  with patch.object(c,'lease'):
   a.consequence('one','after');self.assertTrue((c.R/'pending-placement.json').exists())
   v=c.read('after-review.json');self.scene('later',**{k:v[k] for k in v if k not in ('at','pngSHA256','mode')})
   rr=c.read('later.json');rr['at']=500.5;(c.R/'later.json').write_text(json.dumps(rr))
   with patch.object(time,'time',return_value=501):a.consequence('one','later')
  self.assertTrue(c.read('one-consequence.json')['persistentPlacement']);self.assertFalse((c.R/'pending-placement.json').exists())
 def test_no_solver_dependency(self):
  source=(ROOT/'tools/klotski-controller.py').read_text();self.assertNotIn('importlib',source);self.assertNotIn('dump-mem',source)

if __name__=='__main__':unittest.main()

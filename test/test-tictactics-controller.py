"""Policy fixtures only: no native board or outcome claims."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('tictactics',ROOT/'tools/tictactics-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='place',**kw):
  data=b'fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic review',mode=mode,sceneType='board',defaultGame=True,settledPaint=True,originalRulesUnchanged=True,targetKind='board-cell',legalReason='fixture empty cell',completeBoard='fixture all empty',emptyTarget=True,opponentSettled=True,playerIdentityEvidence='fixture human red',playerToMoveEvidence='fixture red turn',visibleBoardDescription='fixture only',rulesEvidence='fixture static rules',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def test_single_click(self):
  self.scene();self.admitted();a.policy('mousedown:200:240','fresh','place')
  for cmd in ('mousedown:201:240','mousedown:200:240,mousedown:100:100','keydown:113','keydown:8','keypress:102'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','place')
 def test_board_before_move(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'complete native board'):a.policy('mousedown:200:240','fresh','place')
 def test_no_unknown_identity_turn_or_rules(self):
  self.admitted()
  for i,key in enumerate(('playerIdentityEvidence','playerToMoveEvidence','rulesEvidence','completeBoard','legalReason')):
   name='missing'+str(i);self.scene(name,**{key:''})
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
 def test_no_occupied_or_unsettled(self):
  self.admitted()
  for i,key in enumerate(('emptyTarget','opponentSettled','settledPaint','originalRulesUnchanged','defaultGame')):
   name='false'+str(i);self.scene(name,**{key:False})
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','place')
 def test_start_once(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'))
  a.policy('mousedown:200:240','fresh','start');c.save('start-submitted.json',{})
  with self.assertRaisesRegex(AssertionError,'one ordinary'):a.policy('mousedown:200:240','fresh','start')
 def test_no_start_after_auto_board(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'));self.admitted()
  with self.assertRaisesRegex(AssertionError,'no Start'):a.policy('mousedown:200:240','fresh','start')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('next');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousedown:200:240','next','place')
 def test_reserve_is_mechanical(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=1120):
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','place')
  self.assertTrue(c.read('quit-phase.json')['irreversible'])
 def test_native_outcome_only(self):
  self.scene(naturalOutcome='win',outcomeEvidence='fixture counter only')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_visible_draw(self):
  self.scene(naturalOutcome='draw',visibleNativeOutcome=True,outcomeEvidence='fixture native draw')
  with patch.object(c,'lease'):a.outcome('fresh')
  self.assertEqual(c.read('natural-outcome.json')['outcome'],'draw')
 def test_outcome_stops_play(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaisesRegex(AssertionError,'natural outcome'):a.policy('mousedown:200:240','fresh','place')
 def test_no_replayed_scene(self):
  self.scene();self.admitted();c.save('fresh-used-by-old',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):a.policy('mousedown:200:240','fresh','place')
 def test_bind_hash(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_bound_hold(self):
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','place',1501)
 def test_binding_matches_personally_reviewed_window(self):
  self.scene()
  def changed():c.save('lease-snapshot.json',dict(mainHwnd='0x2',screen=dict(w=800,h=600)))
  with patch.object(c,'bind',changed):
   with self.assertRaisesRegex(AssertionError,'window changed'):a.bind('fresh')
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_masked_scene(self):
  self.scene(rawCompleteScene=False);self.admitted()
  with self.assertRaisesRegex(AssertionError,'complete scene'):a.policy('mousedown:200:240','fresh','place')
 def test_no_new_menu_route(self):
  self.scene(mode='menu',menuRoute='new',visibleLabel='New',targetKind='menu')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','new')
 def test_admit_requires_rules(self):
  self.scene(rulesEvidence='')
  with patch.object(c,'lease'):
   with self.assertRaisesRegex(AssertionError,'rules'):a.admit('fresh')
if __name__=='__main__':unittest.main()

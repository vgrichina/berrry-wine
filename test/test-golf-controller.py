"""Synthetic policy metadata; never evidence of a real Golf removal."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('golf',ROOT/'tools/golf-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='remove',**kw):
  data=b'fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic review',mode=mode,sceneType='board',defaultDeal=True,settledPaint=True,originalRulesUnchanged=True,wasteRank='5',tableauRank='6',exposedTableauCard=True,targetKind='tableau',legalReason='synthetic adjacent ranks',visibleBoardDescription='fixture only',rulesEvidence='fixture static rules',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def test_single_click(self):
  self.scene();self.admitted();a.policy('mousedown:200:240','fresh','remove')
  for cmd in ('mousedown:201:240','mousedown:200:240,mousedown:100:100','keydown:113','keydown:8','keypress:102'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','remove')
 def test_board_before_remove(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'dealt board'):a.policy('mousedown:200:240','fresh','remove')
 def test_visible_card_required(self):
  self.scene(exposedTableauCard=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','remove')
 def test_stock_justification(self):
  self.scene(mode='draw',targetKind='stock',visibleStockAvailable=True);self.admitted()
  with self.assertRaisesRegex(AssertionError,'justify'):a.policy('mousedown:200:240','fresh','draw')
 def test_stock_available(self):
  self.scene(mode='draw',targetKind='stock',visibleStockAvailable=True,stockJustification='fixture visible no adjacent card');self.admitted();a.policy('mousedown:200:240','fresh','draw')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','remove')
 def test_start_once(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'))
  a.policy('mousedown:200:240','fresh','start');c.save('start-submitted.json',{})
  with self.assertRaisesRegex(AssertionError,'one ordinary'):a.policy('mousedown:200:240','fresh','start')
 def test_no_start_after_auto_deal(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'));self.admitted()
  with self.assertRaisesRegex(AssertionError,'no Start'):a.policy('mousedown:200:240','fresh','start')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('next');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousedown:200:240','next','remove')
 def test_native_outcome_only(self):
  self.scene(naturalOutcome='win',outcomeEvidence='fixture counter only')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_outcome_stops_play(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaisesRegex(AssertionError,'natural outcome'):a.policy('mousedown:200:240','fresh','remove')
 def test_no_replayed_scene(self):
  self.scene();self.admitted();c.save('fresh-used-by-old',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):a.policy('mousedown:200:240','fresh','remove')
 def test_bind_hash(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_bound_hold(self):
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','remove',1501)
 def test_masked_scene(self):
  self.scene(rawCompleteScene=False);self.admitted()
  with self.assertRaisesRegex(AssertionError,'complete scene'):a.policy('mousedown:200:240','fresh','remove')
 def test_no_new_menu_route(self):
  self.scene(mode='menu',menuRoute='new',visibleLabel='New',targetKind='menu')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','new')
 def test_admit_requires_rules(self):
  self.scene(rulesEvidence='')
  with patch.object(c,'lease'):
   with self.assertRaisesRegex(AssertionError,'rules'):a.admit('fresh')
if __name__=='__main__':unittest.main()

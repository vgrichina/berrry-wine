"""Synthetic policy metadata; never evidence of a real Tut’s Tomb removal."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('tutstomb',ROOT/'tools/tutstomb-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def scene(self,name='fresh',mode='select',**kw):
  data=b'fixture only';(c.R/(name+'.png')).write_bytes(data);sha=hashlib.sha256(data).hexdigest()
  c.save(name+'.json',dict(at=499,pngSHA256=sha,target=c.read('native-pid.json'),snapshot=dict(eip='0x1',mainHwnd='0x1',screen=dict(w=800,h=600))))
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic review',mode=mode,sceneType='board',defaultDeal=True,settledPaint=True,originalRulesUnchanged=True,visibleRank='6',rankValue=6,pairRole='first',currentSelection=None,visiblePartner='7 exposed',exposedCard=True,exposedEvidence='bottom row no covering cards',hoverBeforeClick='native-coordinate-press',targetKind='pyramid',legalReason='6+7=13',completePyramid=True,visibleBoardDescription='fixture only',rulesEvidence='fixture static rules',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def test_single_click(self):
  self.scene();self.admitted();a.policy('mousedown:200:240','fresh','select')
  for cmd in ('mousedown:201:240','mousedown:200:240,mousedown:100:100','keydown:113','keydown:8','keypress:102'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','select')
 def test_board_before_remove(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'dealt board'):a.policy('mousedown:200:240','fresh','select')
 def test_visible_card_required(self):
  self.scene(exposedCard=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','select')
 def test_stock_justification(self):
  self.scene(mode='draw',targetKind='stock',visibleStockAvailable=True);self.admitted()
  with self.assertRaisesRegex(AssertionError,'justify'):a.policy('mousedown:200:240','fresh','draw')
 def test_stock_available(self):
  self.scene(mode='draw',targetKind='stock',visibleStockAvailable=True,stockJustification='fixture visible no adjacent card');self.admitted();a.policy('mousedown:200:240','fresh','draw')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','select')
 def test_binding_requires_complete_pyramid(self):
  self.scene(completePyramid=False)
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_binding_scene_window_mismatch_closes(self):
  self.scene();c.save('lease-snapshot.json',dict(mainHwnd='0x9',screen=dict(w=800,h=600)))
  with patch.object(c,'bind'):
   with self.assertRaisesRegex(AssertionError,'binding scene'):a.bind('fresh')
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_second_requires_current_selection_review(self):
  self.scene(pairRole='second',currentSelection=None);self.admitted()
  with self.assertRaises((AssertionError,TypeError)):a.policy('mousedown:200:240','fresh','select')
 def second(self,**changes):
  c.save('first-intent.json',dict(target=c.read('native-pid.json'),createdAt=490,scene='before'))
  c.save('first-completed.json',dict(actualRemovalClaim=False))
  c.save('before-review.json',dict(pairRole='first',rankValue=6))
  selected=dict(visible=True,evidence='native inverted first card still visible',rankValue=6,reviewScene='fresh',firstAction='first')
  selected.update(changes)
  self.scene(rankValue=7,visibleRank='7',pairRole='second',currentSelection=selected);self.admitted()
 def test_current_second_pair_totals_thirteen(self):
  self.second();a.policy('mousedown:200:240','fresh','select')
 def test_non_thirteen_pair_refused(self):
  self.second(rankValue=5)
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','select')
 def test_historical_selection_review_refused(self):
  self.second(reviewScene='before')
  with self.assertRaisesRegex(AssertionError,'separate current'):a.policy('mousedown:200:240','fresh','select')
 def test_king_only_thirteen(self):
  self.scene(pairRole='king',rankValue=12);self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','select')
 def test_first_requires_visible_partner(self):
  self.scene(visiblePartner='');self.admitted()
  with self.assertRaisesRegex(AssertionError,'partner'):a.policy('mousedown:200:240','fresh','select')
 def test_hover_path_required(self):
  self.scene(hoverBeforeClick='raw');self.admitted()
  with self.assertRaisesRegex(AssertionError,'hover'):a.policy('mousedown:200:240','fresh','select')
 def test_no_recycle_without_rule(self):
  self.scene(mode='recycle',targetKind='stock',stockJustification='empty',visibleStockAvailable=True,visibleRecycleTarget=True,visibleDrawThreeRule=False);self.admitted()
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','recycle')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('next');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousedown:200:240','next','select')
 def test_native_outcome_only(self):
  self.scene(naturalOutcome='win',outcomeEvidence='fixture counter only')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_outcome_stops_play(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaisesRegex(AssertionError,'natural outcome'):a.policy('mousedown:200:240','fresh','select')
 def test_no_replayed_scene(self):
  self.scene();self.admitted();c.save('fresh-used-by-old',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):a.policy('mousedown:200:240','fresh','select')
 def test_bind_hash(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_bound_hold(self):
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','select',1501)
 def test_masked_scene(self):
  self.scene(rawCompleteScene=False);self.admitted()
  with self.assertRaisesRegex(AssertionError,'complete scene'):a.policy('mousedown:200:240','fresh','select')
 def test_no_new_menu_route(self):
  self.scene(mode='menu',menuRoute='new',visibleLabel='New',targetKind='menu')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','new')
 def test_admit_requires_rules(self):
  self.scene(rulesEvidence='')
  with patch.object(c,'lease'):
   with self.assertRaisesRegex(AssertionError,'rules'):a.admit('fresh')
if __name__=='__main__':unittest.main()

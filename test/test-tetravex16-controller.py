"""Synthetic attestation tests, never native placement evidence."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('tetravex',ROOT/'test/test-tetravex16-transport.py');t=importlib.util.module_from_spec(s);s.loader.exec_module(t)
a=t.a;c=a.c
class Policy(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
  c.save('launch.json',dict(at=100,deadline=1300));c.save('native-pid.json',dict(pid=123,startToken='fixture'))
  self.clock=patch.object(time,'time',return_value=500);self.clock.start()
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=499,pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
  with patch.object(c,'capture',capture):t.scene()
 def tearDown(self):self.clock.stop();self.tmp.cleanup()
 def change(self,**kw):
  p=c.R/'fresh-review.json';r=c.read(p.name);r.update(kw);p.write_text(__import__('json').dumps(r))
 def allowed(self):return a.policy('mousedown:200:240','fresh','place')
 def rejected(self,**kw):
  self.change(**kw)
  with self.assertRaises((AssertionError,KeyError)):self.allowed()
 def test_manual_drag(self):self.allowed()
 def test_mismatch(self):self.rejected(neighbors=[dict(side='left',visible=True,evidence='wrong',touchingEdge='5')])
 def test_no_assumed_route(self):self.rejected(inputRoute='vb-click')
 def test_no_hidden_neighbor(self):self.rejected(allAdjacentNeighborsReviewed=False)
 def test_no_occupied_slot(self):self.rejected(destinationEmpty=False)
 def test_no_partial_board(self):self.rejected(completeBoard=False)
 def test_no_second_puzzle(self):self.rejected(originalDefaultPuzzle=False)
 def test_edges_required(self):self.rejected(visibleEdges=dict(top='1'))
 def test_no_old_geometry(self):self.rejected(destinationGeometrySource='historical')
 def test_no_mask(self):self.rejected(rawCompleteScene=False)
 def test_five_seconds(self):
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):self.allowed()
 def test_one_gesture(self):
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240,mousemove:300:240','fresh','place')
 def test_geometry_bound(self):
  with self.assertRaises(AssertionError):a.policy('mousedown:201:240','fresh','place')
 def test_no_replay(self):
  c.save('fresh-used-by-old',{})
  with self.assertRaises(AssertionError):self.allowed()
 def test_hash(self):
  (c.R/'fresh.png').write_bytes(b'changed')
  with self.assertRaises(AssertionError):self.allowed()
 def test_quit_irreversible(self):
  self.change(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True)
  a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.change(mode='place')
  with self.assertRaisesRegex(AssertionError,'irreversible'):self.allowed()
 def test_no_new_menu(self):
  self.change(mode='menu',menuRoute='new',visibleLabel='New')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','menu','new')
 def test_native_completion_required(self):
  self.change(nativeCompletionUI=False,completionEvidence='all tiles moved')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_complete_binding(self):
  self.change(originalRegisteredTitle=False)
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_hold_bound(self):
  with self.assertRaises(AssertionError):a.action('long','mousedown:200:240','fresh','place',1501)
 def accepted_fixture(self,**kw):
  c.save('drag-intent.json',dict(destination=[300,240],target=c.read('native-pid.json'),scene='before'))
  c.save('before-review.json',c.read('fresh-review.json'))
  c.save('drag-completed.json',dict(actualPlacementClaim=False))
  c.save('drag-up.json',dict(at=498))
  self.change(nativePlacementAccepted=True,persistentPlacement=True,sourceNowEmpty=True,nativeAcceptanceEvidence='fixture snapped legal tile',**kw)
 def test_native_acceptance_separate(self):
  self.accepted_fixture()
  with patch.object(c,'lease'):a.acceptance('drag','fresh')
  self.assertFalse(c.read('drag-native-accepted.json')['nativeCompletionClaim'])
 def test_transport_not_acceptance(self):
  self.accepted_fixture(nativeCompletionUI=False)
  self.change(nativePlacementAccepted=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.acceptance('drag','fresh')
 def test_persistence_required(self):
  self.accepted_fixture();self.change(persistentPlacement=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.acceptance('drag','fresh')
 def test_source_vacancy_required(self):
  self.accepted_fixture();self.change(sourceNowEmpty=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.acceptance('drag','fresh')
 def test_visible_destination_edges_unchanged(self):
  self.accepted_fixture();self.change(visibleEdges=dict(top='1',right='7',bottom='3',left='4'))
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.acceptance('drag','fresh')
if __name__=='__main__':unittest.main()

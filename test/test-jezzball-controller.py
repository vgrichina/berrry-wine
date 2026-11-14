"""Personal review policy, with no game recognition or native outcome claims."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib,base64,struct
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('jezzball',ROOT/'tools/jezzball-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
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
  c.save(name+'-review.json',dict(at=499,pngSHA256=sha,**{**dict(submittedScene=True,rawCompleteScene=True,observation='synthetic review',mode=mode,sceneType='board',defaultGame=True,originalRulesUnchanged=True,targetKind='active-board',placementReason='fixture choice',completeBoard='fixture board',rulesEvidence='fixture static rules',activeBoard=True,level=1,noWallGrowing=True,visibleOrientation='vertical',personallyChosenOrientation='vertical',orientationEvidence='fixture arrow',areaPercent=0,score=0,lives=2,persistentWalls=0,partitionEvidence='fixture no walls',priorResultReviewed=True,modalVisible=False,pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])),**kw}))
 def admitted(self):c.save('board-admitted.json',dict(fixture=True))
 def test_single_left_only(self):
  self.scene();self.admitted();a.policy('mousedown:200:240','fresh','place')
  for cmd in ('mousedown:201:240','mousedown:200:240,mousedown:100:100','keydown:113','keydown:8','rightclick:200:240','mousedown:200:240:2','di-mousedown:2'):
   with self.assertRaises(AssertionError):a.policy(cmd,'fresh','place')
 def test_board_before_wall(self):
  self.scene()
  with self.assertRaisesRegex(AssertionError,'complete native board'):a.policy('mousedown:200:240','fresh','place')
 def test_no_missing_rules_or_orientation(self):
  self.admitted()
  for i,key in enumerate(('rulesEvidence','completeBoard','placementReason','orientationEvidence','partitionEvidence')):
   name='missing'+str(i);self.scene(name,**{key:''})
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
 def test_unsafe_scene(self):
  self.admitted()
  for i,values in enumerate((dict(noWallGrowing=False),dict(priorResultReviewed=False),dict(modalVisible=True),dict(level=2),dict(activeBoard=False),dict(defaultGame=False),dict(personallyChosenOrientation='horizontal'))):
   name='unsafe'+str(i);self.scene(name,**values)
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
 def test_five_second_precision(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','place')
 def test_start_once(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'))
  a.policy('mousedown:200:240','fresh','start');c.save('start-submitted.json',{})
  with self.assertRaisesRegex(AssertionError,'one ordinary'):a.policy('mousedown:200:240','fresh','start')
 def test_no_start_after_board(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True);c.save('binding-scene.json',dict(sceneType='bootstrap'));self.admitted()
  with self.assertRaisesRegex(AssertionError,'no Start'):a.policy('mousedown:200:240','fresh','start')
 def test_quit_irreversible(self):
  self.scene(mode='quit',quitRoute='open-game-menu',visibleQuitTarget=True);a.policy('mousedown:200:240','fresh','quit','open-game-menu')
  self.scene('next');self.admitted()
  with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy('mousedown:200:240','next','place')
 def test_reserve(self):
  self.scene();self.admitted()
  with patch.object(time,'time',return_value=1120):
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','place')
  self.assertTrue(c.read('quit-phase.json')['irreversible'])
 def test_area_is_not_outcome(self):
  self.scene(naturalOutcome='first-level-complete',areaPercent=90,outcomeEvidence='counter only')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_native_completion_modal(self):
  self.scene(naturalOutcome='first-level-complete',visibleNativeOutcome=True,outcomeEvidence='fixture native completion',nativeCompletionDialog=True,modalPreserved=True)
  with patch.object(c,'lease'):a.outcome('fresh')
  self.assertEqual(c.read('natural-outcome.json')['outcome'],'first-level-complete')
 def test_completion_must_remain_modal(self):
  self.scene(naturalOutcome='first-level-complete',visibleNativeOutcome=True,outcomeEvidence='fixture completion',nativeCompletionDialog=True,modalPreserved=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.outcome('fresh')
 def test_collision_is_distinct(self):
  self.scene(resultKind='collision',collisionEvidence='')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.progress('fresh')
 def test_visible_counters_required(self):
  self.admitted()
  for i,values in enumerate((dict(lives=None),dict(score=-1),dict(areaPercent=101),dict(persistentWalls=True))):
   name='counter'+str(i);self.scene(name,**values)
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
 def test_animation_is_not_wall(self):
  self.scene(resultKind='completed-wall',persistentPartition=False)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.progress('fresh')
 def test_persistent_wall_review(self):
  self.scene(resultKind='completed-wall',persistentPartition=True,completionEvidence='fixture permanent partition')
  with patch.object(c,'lease'):a.progress('fresh')
  self.assertTrue(c.read('fresh-progress-review.json')['review']['persistentPartition'])
 def test_outcome_stops_play(self):
  self.scene();self.admitted();c.save('natural-outcome.json',{})
  with self.assertRaisesRegex(AssertionError,'natural outcome'):a.policy('mousedown:200:240','fresh','place')
 def test_no_replay(self):
  self.scene();self.admitted();c.save('fresh-used-by-old',{})
  with self.assertRaisesRegex(AssertionError,'fresh scene'):a.policy('mousedown:200:240','fresh','place')
 def test_bind_hash(self):
  self.scene();(c.R/'fresh.png').write_bytes(b'changed')
  with patch.object(c,'bind') as bound:
   with self.assertRaises(AssertionError):a.bind('fresh')
   bound.assert_not_called()
 def test_bound_hold(self):
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','place',1501)
 def test_bind_window(self):
  self.scene()
  def changed():c.save('lease-snapshot.json',dict(mainHwnd='0x2',screen=dict(w=800,h=600)))
  with patch.object(c,'bind',changed):
   with self.assertRaisesRegex(AssertionError,'window changed'):a.bind('fresh')
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_masked_scene(self):
  self.scene(rawCompleteScene=False);self.admitted()
  with self.assertRaisesRegex(AssertionError,'complete scene'):a.policy('mousedown:200:240','fresh','place')
 def test_no_next_level_or_new(self):
  for i,route in enumerate(('new','next-level','demo','slow','fast')):
   name='menu'+str(i);self.scene(name,mode='menu',menuRoute=route,visibleLabel=route,targetKind='menu')
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'menu',route)
 def test_cannot_dismiss_completion(self):
  self.scene(mode='quit',quitRoute='dismiss-loss',visibleQuitTarget=True,nativeLossDialog=True);c.save('natural-outcome.json',dict(outcome='first-level-complete'))
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','quit','dismiss-loss')
 def test_public_cursor_capture_keeps_canvas(self):
  self.scene()
  original=(c.R/'fresh.png').read_bytes()
  # Synthetic 2x2 monochrome CUR: alternating opaque black/white pixels.
  dib=struct.pack('<IiiHHIIiiII',40,2,4,1,1,0,16,0,0,2,0)+bytes([0,0,0,0,255,255,255,0])+bytes([0x80,0,0,0,0x40,0,0,0])+bytes(8)
  cur=struct.pack('<HHHBBBBHHII',0,2,1,2,2,2,0,0,0,len(dib),22)+dib
  css='url(data:image/x-icon;base64,'+base64.b64encode(cur).decode()+') 0 0, default'
  with patch.object(c,'capture',return_value=str(c.R/'fresh.png')),patch.object(c,'call',return_value=css) as display:
   a.capture('fresh')
  display.assert_called_once_with(dict(action='eval',code=a.CURSOR_DISPLAY))
  self.assertEqual((c.R/'fresh.png').read_bytes(),original)
  record=c.read('fresh-cursor.json')
  self.assertEqual(record['nativeImageSHA256'],hashlib.sha256(cur).hexdigest())
  self.assertTrue((c.R/'fresh-cursor.png').read_bytes().startswith(b'\x89PNG'))
 def test_absent_cursor_remains_unknown(self):
  self.scene()
  with patch.object(c,'capture',return_value='fixture'),patch.object(c,'call',return_value='default'):a.capture('fresh')
  self.assertNotIn('image',c.read('fresh-cursor.json'))
  self.assertFalse((c.R/'fresh-cursor.png').exists())
 def test_hover_cannot_build_wall(self):
  self.scene(mode='hover',visibleOrientation=None,hoverReason='inspect current native cursor')
  a.policy('mousemove:200:240','fresh','hover')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','hover')
 def test_hover_is_five_seconds(self):
  self.scene(mode='hover',hoverReason='inspect current cursor')
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousemove:200:240','fresh','hover')
if __name__=='__main__':unittest.main()

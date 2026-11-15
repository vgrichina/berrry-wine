"""Personal review policy, with no game recognition or native outcome claims."""
import importlib.util,pathlib,tempfile,unittest,time,hashlib,base64,struct
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('jezzball',ROOT/'tools/jezzball-system-cursor-controller.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
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
  self.metadata(name)
 def metadata(self,name,css='ns-resize'):
  rr=c.read(name+'.json');r=c.read(name+'-review.json')
  qpath=c.R/'cursor-qualification.json'
  if not qpath.exists():
   (c.R/'proof.txt').write_text('synthetic qualification, no original claim')
   proof=dict(path=str(c.R/'proof.txt'),sha256=hashlib.sha256((c.R/'proof.txt').read_bytes()).hexdigest(),reviewed=True)
   c.save(qpath.name,dict(interpretationFrozen=True,personallyReviewed=True,mapping={'ew-resize':'horizontal','ns-resize':'vertical'},**{k:proof for k in ('nativeHelp','originalStaticRoute','actualNativeFarAPI','actualNativeCLIControls','lockedBuild','publication')}))
  c.save(name+'-cursor.json',dict(at=499,completedAt=499,scene=name,sceneSHA256=rr['pngSHA256'],target=rr['target'],window={k:rr['snapshot'][k] for k in ('mainHwnd','screen')},source='current-public-canvas-style-cursor',evidenceType='native-system-cursor-metadata',pointerImageCaptured=False,css=css,nativeOutput=dict(source='host.set_cursor',at=499,css=css)))
  c.save(name+'-intent.json',dict(mode='hover',command='mousemove:200:240',target=rr['target'],owner=dict(owner='fixture',epoch=1),nonce=name))
  c.save(name+'-receipt.json',dict(state='CONSUMED',consumed=True,owner='fixture',epoch=1,nonce=name,consumedAt=498000))
  c.save(name+'-completed.json',dict(actualBoardChangeClaim=False))
  c.save(name+'-up.json',dict(state='ACK',reason='consumed pulse',at=498))
  c.save(name+'-release-wait.json',dict(actualWait=True,stdoutEOF=True,stderrEOF=True,exit=0))
  r.update(orientationSource='native-system-cursor-metadata',nativeCursorMetadataReviewed=True,reviewedCursorCSS=css,cursorMetadataSHA256=hashlib.sha256((c.R/(name+'-cursor.json')).read_bytes()).hexdigest(),qualificationSHA256=hashlib.sha256(qpath.read_bytes()).hexdigest(),finiteHoverReviewed=True)
  (c.R/(name+'-review.json')).unlink();c.save(name+'-review.json',r)
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
 def test_start_always_refused(self):
  self.scene(mode='start',sceneType='bootstrap',nativeStartTarget=True)
  with self.assertRaisesRegex(AssertionError,'no New'):a.policy('mousedown:200:240','fresh','start')
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
 def test_public_metadata_capture_keeps_canvas(self):
  self.scene();(c.R/'fresh-cursor.json').unlink();original=(c.R/'fresh.png').read_bytes();rr=c.read('fresh.json')
  with patch.object(c,'capture',return_value='fixture'),patch.object(c,'opened'),patch.object(c,'call',side_effect=['ns-resize',dict(source='host.set_cursor',at=500,css='ns-resize'),rr['snapshot']]):a.capture('fresh')
  self.assertEqual((c.R/'fresh.png').read_bytes(),original)
  self.assertEqual(c.read('fresh-cursor.json')['css'],'ns-resize')
  self.assertIs(c.read('fresh-cursor.json')['pointerImageCaptured'],False)
  self.assertFalse((c.R/'fresh-cursor.png').exists())
 def test_hover_cannot_build_wall(self):
  self.scene(mode='hover',visibleOrientation=None,hoverReason='inspect current native cursor')
  a.policy('mousemove:200:240','fresh','hover')
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','hover')
 def test_hover_is_five_seconds(self):
  self.scene(mode='hover',hoverReason='inspect current cursor')
  with patch.object(time,'time',return_value=504):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousemove:200:240','fresh','hover')
 def test_refuse_arbitrary_cursor_and_metadata_tampering(self):
  self.admitted()
  for i,css in enumerate(('default','','auto','crosshair','url(data:image/png;base64,AA==) 0 0, default','NS-RESIZE')):
   name='unknown'+str(i);self.scene(name)
   path=c.R/(name+'-cursor.json');v=c.read(path.name);v['css']=css;path.unlink();c.save(path.name,v)
   r=c.read(name+'-review.json');r['cursorMetadataSHA256']=hashlib.sha256(path.read_bytes()).hexdigest();r['reviewedCursorCSS']=css
   (c.R/(name+'-review.json')).unlink();c.save(name+'-review.json',r)
   with self.assertRaisesRegex(AssertionError,'cursor refused'):a.policy('mousedown:200:240',name,'place')
 def test_output_orientation_mismatch(self):
  self.scene(visibleOrientation='horizontal',personallyChosenOrientation='horizontal');self.admitted()
  with self.assertRaisesRegex(AssertionError,'orientation differs'):a.policy('mousedown:200:240','fresh','place')
 def test_qualification_drift_refused(self):
  self.scene();self.admitted();(c.R/'proof.txt').write_text('changed')
  with self.assertRaisesRegex(AssertionError,'evidence drift'):a.policy('mousedown:200:240','fresh','place')
 def test_hover_unknown_not_orientation_evidence(self):
  self.scene();self.admitted();path=c.R/'fresh-up.json';path.unlink();c.save(path.name,dict(state='UNKNOWN',reason='fallback',at=498))
  with self.assertRaises(AssertionError):a.policy('mousedown:200:240','fresh','place')
 def test_every_wall_requires_hover(self):
  self.scene();self.admitted();(c.R/'fresh-intent.json').unlink()
  with self.assertRaises(FileNotFoundError):a.policy('mousedown:200:240','fresh','place')
 def test_previous_wall_requires_consequence(self):
  self.scene();self.admitted();c.save('earlier-intent.json',dict(mode='place',name='earlier',pngSHA256='prior'))
  with self.assertRaises(FileNotFoundError):a.policy('mousedown:200:240','fresh','place')
 def test_hover_point_cannot_be_reused_elsewhere(self):
  self.scene();self.admitted();path=c.R/'fresh-intent.json';v=c.read(path.name);v['command']='mousemove:20:20';path.unlink();c.save(path.name,v)
  with self.assertRaisesRegex(AssertionError,'chosen wall point'):a.policy('mousedown:200:240','fresh','place')
 def consequence_fixture(self):
  self.scene('before');self.scene('stable');self.scene('after',wallAction='wall',beforeSceneSHA256=c.read('before.json')['pngSHA256'],resultKind='completed-wall',consequenceEvidence='fixture persistent span',nativeOutcome='fixture active level 1',persistentPartition=True,completionEvidence='fixture two matching permanent partitions',persistentWalls=1,areaPercent=3,score=140,persistenceScene='stable',persistenceSceneSHA256=c.read('stable.json')['pngSHA256'],bothPersistentScenesReviewed=True)
  path=c.R/'after.json';v=c.read(path.name);v['at']=499.5;path.unlink();c.save(path.name,v)
  c.save('wall-intent.json',dict(mode='place',scene='before',target=c.read('native-pid.json'),pngSHA256=c.read('before.json')['pngSHA256']))
  c.save('wall-up.json',dict(state='ACK',at=498))
 def test_completed_wall_causal_consequence(self):
  self.consequence_fixture()
  with patch.object(c,'lease'):a.consequence('wall','after')
  self.assertEqual(c.read('wall-consequence.json')['after']['score'],140)
 def test_ack_alone_is_not_consequence(self):
  self.consequence_fixture();path=c.R/'after-review.json';v=c.read(path.name);v['areaPercent']=0;path.unlink();c.save(path.name,v)
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.consequence('wall','after')
  self.assertFalse((c.R/'wall-consequence.json').exists())
 def test_persistent_scene_hash_required(self):
  self.consequence_fixture();(c.R/'stable.png').write_bytes(b'changed')
  with patch.object(c,'lease'):
   with self.assertRaises(AssertionError):a.consequence('wall','after')
 def test_no_native_write_no_orientation(self):
  self.admitted()
  for i,output in enumerate((None,dict(source='host.set_cursor_image',at=499,css='ns-resize'),dict(source='host.set_cursor',at=499,css='ew-resize'),dict(source='host.set_cursor',at=490,css='ns-resize'),dict(source='host.set_cursor',at=497,css='ns-resize'))):
   name='nativeoutput'+str(i);self.scene(name);path=c.R/(name+'-cursor.json');v=c.read(path.name);v['nativeOutput']=output;path.unlink();c.save(path.name,v)
   review=c.R/(name+'-review.json');r=c.read(review.name);r['cursorMetadataSHA256']=hashlib.sha256(path.read_bytes()).hexdigest();review.unlink();c.save(review.name,r)
   with self.assertRaises(AssertionError):a.policy('mousedown:200:240',name,'place')
if __name__=='__main__':unittest.main()

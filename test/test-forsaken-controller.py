"""Production HTTP/guard controls; synthetic physical events are not game evidence."""
import unittest,pathlib,subprocess,sys,time,json,os
import importlib.util,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
control=load('forsaken_control',ROOT/'tools/forsaken-controller.py')
supervise=load('forsaken_supervise',ROOT/'tools/forsaken-supervisor.py')
save=supervise.save
R=pathlib.Path(os.environ.get('FORSAKEN_TEST_OUT') or tempfile.mkdtemp(prefix='forsaken-control-',dir=ROOT/'scratch/runs'))
R.mkdir(parents=True,exist_ok=True)
SUPERVISOR=ROOT/'tools/forsaken-supervisor.py'
FIXTURE=ROOT/'test/fixtures/forsaken-controller.cjs'
def waitfile(p,timeout=12):
 end=time.monotonic()+timeout
 while not p.exists() and time.monotonic()<end:time.sleep(.02)
 assert p.exists(),str(p)
 return json.loads(p.read_text())
class Controller(unittest.TestCase):
 def start(self,name):
  out=R/('test-bound-repaired-'+name);out.mkdir();self.out=out
  save(out,'recipe.json',dict(args=['node',str(FIXTURE)],cwd=str(out),seconds=35))
  self.p=subprocess.Popen([sys.executable,'-B',str(SUPERVISOR),'outerwait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  waitfile(out/'native-pid.json');waitfile(out/'launch.json')
  endpoint=waitfile(out/'fixture-endpoint.json');assert endpoint['pid']==json.loads((out/'native-pid.json').read_text())['pid']
  control.R=out;control.URL='http://127.0.0.1:'+str(endpoint['port'])+'/ctl'
  os.environ['FORSAKEN_CONTROL_OUT']=str(out);os.environ['FORSAKEN_CONTROL_URL']=control.URL
  for i in range(100):
   try:
    snap=control.call({'action':'snapshot'});assert snap['fixturePid']==control.read('native-pid.json')['pid'];break
   except Exception:time.sleep(.02)
  control.bind()
 def finish(self):
  control.call({'action':'quit'});a,b=self.p.communicate(timeout=10)
  save(self.out,'fixture-outer-wait.json',dict(exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
  assert self.p.returncode==0
  for n in ['native-wait.json','watchdog-wait.json','outer-child-wait.json']:
   v=waitfile(self.out/n);assert v['exit']==0 and v['stdoutEOF'] and v['stderrEOF']
  for p in self.out.glob('*.png'):p.unlink()
  line=next(x for x in (self.out/'native.stdout.log').read_text().splitlines() if x.endswith('CONTROL_SUMMARY'))
  return json.loads(line[:-len(' CONTROL_SUMMARY')])
 def test_delayed400ms(self):
  self.start('delayed60')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']));control.pulse('new',['keydown:40'],400,'fresh','new reviewed fixture')
   d=control.read('new-down.json')[0];arm=control.read('new-armed.json');up=control.read('new-release-fired.json')
   self.assertEqual(d['state'],'CONSUMED');self.assertLess(arm['deadline']-d['consumedAt']/1000,6)
   self.assertLess(arm['deadline']-arm.get('at',arm['deadline']-6),6.1)
   self.assertEqual(up['source'],'consumed-pulse');self.assertGreaterEqual(up['at']-d['consumedAt']/1000,.399)
   self.assertLess(up['at']-d['consumedAt']/1000,.65)
   self.assertGreater(control.read('new-progress.json')['postProgress']['batch'],control.read('new-progress.json')['afterRelease']['batch'])
  finally:s=self.finish()
  down=[v for v in s['effects'] if v['kind']=='DOWN'];self.assertEqual(len(down),1)
  request=next(v for v in s['requests'] if v['action']=='guarded-input')
  self.assertGreater(down[0]['at']-request['at'],100)
  self.assertLess(arm['at']*1000,request['at']);self.assertLess(arm['at']*1000,down[0]['at'])
  control.save('checks.json',dict(delayedTransportMilliseconds=down[0]['at']-request['at'],pulseMilliseconds=400,oneConsumedDown=True,normalUp=True,postReleaseProgress=True,reviewExpiryNoDown=False))
 def test_mouse(self):
  self.start('mouse')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   control.pulse('mouse',['mousedown:120:140'],120,'fresh','personally reviewed fixture mouse target')
   self.assertEqual(control.read('mouse-down.json')[0]['state'],'CONSUMED')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)
 def test_stale_review(self):
  self.start('stale-review')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time()-31,pngSHA256=control.read('fresh.json')['pngSHA256']))
   with self.assertRaisesRegex(AssertionError,'review age'):control.pulse('expired',['keydown:40'],60,'fresh','expired review fixture')
   self.assertFalse((self.out/'expired-armed.json').exists())
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])
 def test_stale_capture(self):
  self.start('stale-capture')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   p=self.out/'fresh.json';v=json.loads(p.read_text());v['at']=time.time()-31;p.write_text(json.dumps(v))
   self.assertIn('NOT_SENT',control.pulse('expired',['keydown:40'],60,'fresh','expired capture fixture'))
   self.assertFalse((self.out/'expired-armed.json').exists())
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])
 def test_dropped_ack_sticky(self):
  self.start('dropped-ack')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   with self.assertRaises(Exception):control.pulse('unknown',['keydown:32'],60,'fresh','reviewed dropped ACK fixture')
   self.assertTrue((self.out/'terminal-input-failure.json').exists())
   nonce=control.read('unknown-intent.json')['nonces'][0]
   self.assertEqual(control.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
   with self.assertRaisesRegex(AssertionError,'sticky'):control.pulse('blocked',['keydown:39'],60,'fresh','no replay')
   with self.assertRaisesRegex(AssertionError,'sticky'):control.capture('blocked-capture')
   self.assertFalse((self.out/'blocked-intent.json').exists())
   self.assertEqual(control.read('unknown-release-fired.json')['source'],'fallback')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)
 def test_real_deadline_and_independent_fallback(self):
  self.start('deadline')
  try:
   owner=control.read('input-owner.json');nonce='deadline-fresh'
   before=time.time();receipt=control.call({'action':'deadline-input','guard':{**owner,'nonce':nonce,'reviewed':True,'deadline':int((before+.1)*1000)}})
   self.assertEqual(receipt['state'],'CANCELLED');self.assertFalse(receipt['consumed'])
   time.sleep(.2)
   self.assertEqual(control.call({'action':'guarded-status','nonce':nonce})['state'],'CANCELLED')
   # Independently prearmed child works even with no DOWN and no parent scheduling.
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/forsaken-controller.py'),'release','fallback',owner['owner'],str(time.time()+.25)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   a,b=child.communicate(timeout=2);self.assertEqual(child.returncode,0)
   control.save('fallback-wait.json',dict(actualWait=True,exit=child.returncode,stdoutEOF=True,stderrEOF=True))
   self.assertEqual(control.read('fallback-release-fired.json')['source'],'fallback')
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind'] in ('DOWN','BAD_DOWN')])
 def test_oneuse(self):
  self.start('oneuse')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   control.pulse('one',['keydown:40'],60,'fresh','reviewed fixture')
   with self.assertRaisesRegex(AssertionError,'already reserved'):control.pulse('two',['keydown:40'],60,'fresh','reuse refused')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)
 def test_target_identity(self):
  self.start('target')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   p=self.out/'fresh.json';v=control.read('fresh.json');v['target']['startToken']='wrong';p.write_text(json.dumps(v))
   with self.assertRaisesRegex(AssertionError,'native identity'):control.pulse('wrong',['keydown:40'],60,'fresh','bad identity refused')
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])


class Extensions(Controller):
 def test_midpress2000(self):
  self.start('midpress2000-isolated')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   control.pulse('primary',['keydown:17'],2000,'fresh','reviewed fixture; independent release and actual midpress')
   d=control.read('primary-down.json')[0];m=control.read('primary-midpress.json');u=control.read('primary-release-fired.json')
   self.assertLess(d['consumedAt']/1000,m['at']);self.assertLess(m['completedAt'],u['at'])
   self.assertGreater(u['at']-d['consumedAt']/1000,1.5)
   self.assertLess(u['at']-d['consumedAt']/1000,2.01)
   self.assertTrue(control.read('primary-release-cap.json')['beforeFirstDown'])
   self.assertEqual(control.read('primary-up.json')['state'],'ACK')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)
 def test_suffix_collision_before_down(self):
  self.start('suffix-collision-isolated')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   control.save('pause-up.json',dict(state='ACK',preserved=True))
   with self.assertRaisesRegex(AssertionError,'collision before intent/DOWN'):
    control.pulse('pause-up',['keydown:38'],60,'fresh','fresh reviewed fixture collision rejected')
   self.assertFalse((self.out/'pause-up-intent.json').exists())
   self.assertFalse((self.out/'terminal-input-failure.json').exists())
   self.assertTrue(control.read('pause-up.json')['preserved'])
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])

class CompleteWindow(Controller):
 def test_insufficient_window_no_down(self):
  self.start('complete-window')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   p=self.out/'fresh.json';v=control.read('fresh.json');v['at']=time.time()-27.5;p.write_text(json.dumps(v))
   self.assertIn('NOT_SENT',control.pulse('incomplete',['keydown:13'],2000,'fresh','reviewed fixture must fit whole pulse before any arm or edge'))
   self.assertTrue(control.read('incomplete-rejection.json')['positivelyUnsent'])
   self.assertFalse((self.out/'incomplete-armed.json').exists())
   self.assertFalse((self.out/'terminal-input-failure.json').exists())
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])
 def test_aim_scene_age_no_down(self):
  self.start('aim-five-second')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   p=self.out/'fresh.json';v=control.read('fresh.json');v['at']=time.time()-5.1;p.write_text(json.dumps(v))
   self.assertIn('NOT_SENT',control.pulse('staleaim',['keydown:17'],2000,'fresh','old aim scene refused',maxSceneAge=5))
   self.assertFalse((self.out/'staleaim-armed.json').exists())
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])
 def test_foreign_socket_owner_no_capture_or_down(self):
  import os
  self.start('foreign-socket')
  try:
   p=self.out/'native-pid.json';stat=(control.pathlib.Path('/proc')/str(os.getpid())/'stat').read_text()
   p.write_text(json.dumps(dict(pid=os.getpid(),startToken=stat[stat.rindex(')')+2:].split()[19])))
   with self.assertRaisesRegex(AssertionError,'socket'):
    control.capture('wrong-process')
   self.assertFalse((self.out/'wrong-process.json').exists())
  finally:s=self.finish()
  self.assertFalse([v for v in s['effects'] if v['kind']=='DOWN'])
 def test_paired_thrust_fire_bounded(self):
  self.start('paired-thrust-fire')
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   control.pulse('paired',['keydown:65','keydown:17'],1800,'fresh','manual finite documented thrust and fire fixture')
   d=control.read('paired-down.json');u=control.read('paired-release-fired.json');m=control.read('paired-midpress.json')
   self.assertEqual(len(d),2)
   for v in d:
    self.assertTrue(v['consumed']);self.assertLess(u['at']-v['consumedAt']/1000,2)
    self.assertLess(v['consumedAt']/1000,m['at'])
   self.assertLess(m['completedAt'],u['at']);self.assertEqual(control.read('paired-up.json')['state'],'ACK')
   self.assertGreater(control.read('paired-progress.json')['postProgress']['batch'],control.read('paired-progress.json')['afterRelease']['batch'])
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),2)

class LateACK(Controller):
 def test_late_ack_bounded_up(self):
  self.start(os.environ.get('LATE_ACK_CASE','late-ack-red'))
  try:
   control.capture('fresh');control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
   with self.assertRaisesRegex(AssertionError,'ACK arrived too late'):
    control.pulse('late',['keydown:78'],80,'fresh','actual consumed edge with deliberately delayed known ACK')
   down=control.read('late-receipt.json');up=control.read('late-release-fired.json')
   self.assertEqual(down['state'],'CONSUMED');self.assertEqual(control.read('late-up.json')['state'],'ACK')
   self.assertTrue((self.out/'terminal-input-failure.json').exists())
   self.assertLess(up['at']-down['consumedAt']/1000,.5,'known late ACK must schedule immediate independent UP before closing')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)

class Physical(Controller):
 def reviewed(self):
  control.capture('fresh')
  control.save('fresh-review.json',dict(at=time.time(),pngSHA256=control.read('fresh.json')['pngSHA256']))
 def physical(self,summary):
  downs=[e for e in summary['effects'] if e['kind']=='DOWN']
  ups=[e for e in summary['effects'] if e['kind']=='UP']
  self.assertTrue(downs and ups)
  for down in downs:
   up=next(e for e in ups if e['at']>=down['at'])
   self.assertLess(up['at']-down['at'],2000)
  return downs,ups
 def test_busy_native_like_known_late_ack_is_terminal(self):
  self.start('busy-bounded')
  try:
   self.reviewed()
   with self.assertRaisesRegex(AssertionError,'ACK arrived too late'):
    control.pulse('busy',['keydown:80'],80,'fresh','busy synchronous endpoint, actual consumed edge')
   self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
   with self.assertRaisesRegex(AssertionError,'sticky'):control.capture('blocked')
  finally:s=self.finish()
  downs,ups=self.physical(s)
  self.assertGreater(ups[0]['at']-downs[0]['at'],250)
  # This remains terminal: physical UP did not complete in the requested 80ms.
  self.assertGreater(ups[0]['at']-downs[0]['at'],80)
 def test_menu_gesture_covers_observed_busy_ack(self):
  self.start('menu400')
  try:
   self.reviewed();control.pulse('menu',['keydown:80'],400,'fresh','reviewed finite menu gesture')
   self.assertFalse((self.out/'terminal-input-failure.json').exists())
   timing=control.read('menu-ack-timing-0.json')
   self.assertGreater(timing['transportAndHandlerMilliseconds'],250)
  finally:s=self.finish()
  self.physical(s)
 def test_long_busy_server_cannot_claim_physical_bound(self):
  self.start('busy-exceeded')
  try:
   self.reviewed()
   with self.assertRaises(Exception):
    control.pulse('busy',['keydown:89'],400,'fresh','busy endpoint prevents bounded physical release')
   self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
   self.assertEqual(control.read('busy-up.json')['state'],'ACK')
  finally:s=self.finish()
  down=next(e for e in s['effects'] if e['kind']=='DOWN')
  up=next(e for e in s['effects'] if e['kind']=='UP' and e['at']>=down['at'])
  self.assertGreater(up['at']-down['at'],2000)
  self.assertLess(control.read('busy-release-fired.json')['at']*1000,up['at'])
 def test_pre_down_cap_survives_parent_death(self):
  self.start('parent-death')
  try:
   self.reviewed()
   code="""import importlib.util,sys
s=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
c.pulse('dead',['keydown:40'],1800,'fresh','independent UP survives parent death')
"""
   p=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/forsaken-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   waitfile(self.out/'dead-release-cap.json');waitfile(self.out/'dead-receipt.json')
   arm=control.read('dead-armed.json');cap=control.read('dead-release-cap.json')
   p.kill();a,b=p.communicate(timeout=5)
   control.save('killed-parent-wait.json',dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
   self.assertEqual(p.returncode,-9)
   waitfile(self.out/'dead-up.json')
   self.assertTrue(cap['beforeFirstDown'])
   self.assertLess(cap['at']-2,control.read('dead-receipt.json')['consumedAt']/1000)
   self.assertLessEqual(control.read('dead-up.json')['at']-control.read('dead-receipt.json')['consumedAt']/1000,2)
   # The killed parent cannot supply a release-child wait. Keep that absence
   # explicit instead of manufacturing an actual wait for an orphan.
   self.assertFalse((self.out/'dead-release-wait.json').exists())
   control.save('orphan-release-status.json',dict(pid=arm['pid'],physicalUpACK=True,actualChildWait=False,parentKilled=True))
  finally:s=self.finish()
  self.physical(s)
 def test_dropped_ack_physical_up_within_cap(self):
  self.start('unknown-physical')
  try:
   self.reviewed()
   with self.assertRaises(Exception):control.pulse('lost',['keydown:32'],400,'fresh','dropped ACK physical release audit')
   self.assertEqual(control.call({'action':'guarded-status','nonce':control.read('lost-intent.json')['nonces'][0]})['state'],'UNKNOWN')
   self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
  finally:s=self.finish()
  self.physical(s)
 def test_combat_cannot_override_five_second_scene(self):
  self.start('combat-age')
  try:
   self.reviewed();p=self.out/'fresh.json';v=control.read('fresh.json');v['at']=time.time()-5.2;p.write_text(json.dumps(v))
   self.assertIn('NOT_SENT',control.pulse('stale',['keydown:65','keydown:17'],1800,'fresh','stale combat refused even with menu limit',maxSceneAge=30))
   self.assertFalse((self.out/'stale-armed.json').exists())
  finally:s=self.finish()
  self.assertFalse([e for e in s['effects'] if e['kind']=='DOWN'])
 def test_bind_never_calls_endpoint_twice(self):
  self.start('permanent-owner')
  owner=control.read('input-owner.json')
  try:
   with self.assertRaisesRegex(AssertionError,'no rebind'):control.bind()
   self.assertEqual(control.read('input-owner.json'),owner)
  finally:s=self.finish()
  self.assertEqual(len([r for r in s['requests'] if r['action']=='guarded-bind']),1)
 def test_late_pending_down_cannot_cross_pre_down_cap(self):
  self.start('pending-past-cap')
  try:
   self.reviewed()
   with self.assertRaises(Exception):control.pulse('pending',['keydown:37'],400,'fresh','pending delayed handler must expire before any physical edge')
   self.assertTrue(control.read('terminal-input-failure.json')['noReplay'])
   time.sleep(3.0)
  finally:s=self.finish()
  self.assertFalse([e for e in s['effects'] if e['kind']=='DOWN'])
  self.assertLessEqual(control.read('pending-up.json')['at'],control.read('pending-release-cap.json')['at']+.1)
 def test_release_child_waits_for_both_inherited_eofs(self):
  self.start('release-late-eof')
  original=subprocess.Popen
  def inherited(args,**kw):
   if len(args)>3 and args[3]=='release':
    code="""import os,time,sys,runpy
if os.fork()==0:
 time.sleep(.9);print('inherited-out',flush=True);time.sleep(.2);print('inherited-err',file=sys.stderr,flush=True);os._exit(0)
p=sys.argv[1];sys.argv=sys.argv[1:];runpy.run_path(p,run_name='__main__')
"""
    args=[sys.executable,'-B','-c',code,*args[2:]]
   return original(args,**kw)
  try:
   self.reviewed();control.subprocess.Popen=inherited
   start=time.time()
   control.pulse('finite',['keydown:40'],400,'fresh','release request and actual child exit precede late separate pipe EOFs')
   self.assertGreater(time.time()-start,1.1)
   wait=control.read('finite-release-wait.json')
   self.assertEqual(wait['exit'],0);self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'])
   self.assertIn('inherited-out',wait['stdout']);self.assertIn('inherited-err',wait['stderr'])
  finally:
   control.subprocess.Popen=original;s=self.finish()
  self.physical(s)

class ParentWait(unittest.TestCase):
 def test_true_parent_waits_for_both_late_inherited_eofs(self):
  out=R/'late-inherited-eof';out.mkdir()
  code="""import os,time,sys
if os.fork()==0:
 time.sleep(.5);print('late-out',flush=True);time.sleep(.3);print('late-err',file=sys.stderr,flush=True);os._exit(0)
print('parent-exit',flush=True)
"""
  save(out,'recipe.json',dict(args=[sys.executable,'-u','-c',code],cwd=str(out),seconds=3,watchdogGrace=.2))
  start=time.time()
  p=subprocess.Popen([sys.executable,'-B',str(SUPERVISOR),'outerwait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  a,b=p.communicate(timeout=8)
  save(out,'tool-wait.json',dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
  self.assertEqual(p.returncode,0);self.assertGreater(time.time()-start,.8)
  for name in ['native-wait.json','watchdog-wait.json','outer-child-wait.json']:
   v=waitfile(out/name);self.assertEqual(v['exit'],0);self.assertTrue(v['actualWait'] and v['stdoutEOF'] and v['stderrEOF'])
  self.assertEqual((out/'native.stdout.log').read_text(),'parent-exit\nlate-out\n')
  self.assertEqual((out/'native.stderr.log').read_text(),'late-err\n')

class Supervision(unittest.TestCase):
 def exercise(self,mode):
  import signal
  out=R/('supervision-'+mode);out.mkdir()
  code="import sys,time;print('native stdout',flush=True);print('native stderr',file=sys.stderr,flush=True);time.sleep("+('.5' if mode in ('normal','tool-loss') else '30')+")"
  save(out,'recipe.json',dict(args=[sys.executable,'-u','-c',code],cwd=str(R),seconds=.7 if mode=='deadline' else 5))
  launcher=subprocess.Popen([sys.executable,'-B',str(SUPERVISOR),'detach',str(out),*(['hold'] if mode=='tool-loss' else [])],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  detached=waitfile(out/'detached-parent.json');native=waitfile(out/'native-pid.json')
  if mode=='tool-loss':os.killpg(launcher.pid,signal.SIGKILL)
  a,b=launcher.communicate(timeout=3)
  save(out,'outer-tool-control-wait.json',dict(exit=launcher.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True))
  self.assertEqual(launcher.returncode,-9 if mode=='tool-loss' else 0)
  if mode=='parent-term':os.kill(detached['pid'],signal.SIGTERM)
  done=waitfile(out/'supervisor-complete.json')
  n=waitfile(out/'native-wait.json');w=waitfile(out/'watchdog-wait.json')
  self.assertEqual(n['exit'],0 if mode in ('normal','tool-loss') else -15)
  self.assertTrue(n['stdoutEOF'] and n['stderrEOF']);self.assertTrue(w['stdoutEOF'] and w['stderrEOF']);self.assertEqual(w['exit'],0)
  self.assertTrue(done['actualChildWaits'])
  self.assertLessEqual(waitfile(out/'watchdog-armed.json')['at'],native['at'])
  self.assertEqual(waitfile(out/'watchdog-exit.json')['reason'],'deadline-or-disk' if mode=='deadline' else 'actual-native-wait')
 def test_normal(self):self.exercise('normal')
 def test_outer_tool_loss(self):self.exercise('tool-loss')
 def test_parent_term(self):self.exercise('parent-term')
 def test_deadline(self):self.exercise('deadline')

if __name__=='__main__':
 suite=unittest.TestSuite()
 for cls in (Controller,Extensions,CompleteWindow,LateACK,Physical,ParentWait,Supervision):
  # Inherited base controls run once, not again for every extension class.
  for name in cls.__dict__:
   if name.startswith('test_'):suite.addTest(cls(name))
 result=unittest.TextTestRunner(verbosity=2).run(suite)
 raise SystemExit(not result.wasSuccessful())

"""Synthetic HTTP and real CLI controls. No original Klotski evidence."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
policy=load('policy','test/test-klotski-controller.py');a=policy.a;c=a.c

def scene(mode='move',name='fresh'):
 c.capture(name);rr=c.read(name+'.json')
 c.save(name+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],**policy.metadata(rr['target'],mode)))
 if not (c.R/'board-admitted.json').exists():c.save('board-admitted.json',dict(fixture=True))

class HTTP(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name);self.effects=[];self.fault=None;test=self
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    v=json.loads(self.rfile.read(int(self.headers['Content-Length'])));test.effects.append(dict(command=v,at=time.time()))
    if v['action']=='guarded-input':
     g=v['guard'];fault=test.fault if v['cmd'].startswith('mousedown') or test.fault=='destination' and v['cmd']=='mousemove:200:260' else None
     state={'cancel':'CANCELLED','unknown':'UNKNOWN','destination':'UNKNOWN'}.get(fault,'CONSUMED')
     r=dict(owner=g['owner'],epoch=g['epoch'],nonce=g['nonce'],state=state,consumed=state=='CONSUMED',consumedAt=time.time()*1000 if state=='CONSUMED' else None)
     if fault=='identity':r['epoch']+=1
     if fault=='mixed':r.update(state='CANCELLED',consumed=True,consumedAt=time.time()*1000)
     if fault=='late':time.sleep(.35)
    else:r=dict(released=True,owner=v['owner'])
    try:self.send_response(200);self.end_headers();self.wfile.write(json.dumps(dict(ok=True,value=r)).encode())
    except BrokenPipeError:pass
  self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);self.thread=threading.Thread(target=self.server.serve_forever);self.thread.start()
  c.URL='http://127.0.0.1:'+str(self.server.server_port)+'/ctl'
  self.env=patch.dict(os.environ,KLOTSKI_CONTROL_OUT=str(c.R),KLOTSKI_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+1200));self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',focus='0x2',eip='0x2',screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{'focus':'0x2'}));self.lease.start();scene()
 def tearDown(self):
  self.lease.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
 def test_move_down_destination_up(self):
  a.action('one','mousedown:200:240','fresh','move',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousemove:200:240','mousedown:200:240','mousemove:200:260',None])
  self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualMovementClaim'])
  self.assertLess(c.read('one-armed.json')['parentObservedAt'],c.read('one-source-receipt.json')['consumedAt']/1000)
  self.assertEqual(len({c.read('one-'+k+'receipt.json')['nonce'] for k in ('','source-','destination-')}),3)
  self.assertTrue((c.R/'pending-placement.json').exists())
 def rejected(self,fault):
  self.fault=fault
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','move',200)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_unknown_closes(self):self.rejected('unknown')
 def test_cancel_closes(self):self.rejected('cancel')
 def test_mixed_closes(self):self.rejected('mixed')
 def test_identity_closes(self):self.rejected('identity')
 def test_destination_unknown_closes(self):self.rejected('destination')
 def test_late_ack_closes(self):
  self.fault='late'
  with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:200:240','fresh','move',200)
  self.assertFalse(any(e['command'].get('cmd')=='mousemove:200:260' for e in self.effects))
 def test_audit_after_up(self):
  real=c.save;times=[]
  def slow(name,v):
   if name=='one-receipt.json':times.append(time.time());time.sleep(.1)
   return real(name,v)
  with patch.object(c,'save',slow):a.action('one','mousedown:200:240','fresh','move',400)
  self.assertGreater(times[0],self.effects[-1]['at'])
 def test_child_death_before_any_pointer(self):
  real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  with patch.object(subprocess,'Popen',died):
   with self.assertRaises(Exception):a.action('dead','mousedown:200:240','fresh','move',400)
  self.assertEqual(self.effects,[]);self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_short_no_intent_or_http(self):
  for ms in (40,79):
   with self.assertRaises(AssertionError):a.action('short','mousedown:200:240','fresh','move',ms)
  self.assertEqual(self.effects,[]);self.assertFalse((c.R/'short-intent.json').exists())
 def test_capture_collision_no_http_and_sticky(self):
  self.cap.stop()
  with patch.object(c,'opened'),patch.object(c,'call') as call:
   with self.assertRaisesRegex(AssertionError,'collision'):c.capture('fresh')
   call.assert_not_called()
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_occupied_destination_no_intent_or_http(self):
  r=c.read('fresh-review.json');r['destinationFree']=False;(c.R/'fresh-review.json').write_text(json.dumps(r))
  with patch.object(subprocess,'Popen') as child,self.assertRaises(AssertionError):a.action('collision','mousedown:200:240','fresh','move',400)
  child.assert_not_called();self.assertEqual(self.effects,[]);self.assertFalse((c.R/'collision-intent.json').exists())
 def test_parent_death_independent_release(self):
  code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
a.c.lease=lambda:({'owner':'owner','epoch':1},{'focus':'0x2'})
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','move',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/klotski-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not all((c.R/n).exists() for n in ('killed-up.json','terminal-input-failure.json')) and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousemove:200:240','mousedown:200:240',None])

os.environ.setdefault('FORSAKEN_TEST_OUT',str(ROOT/'scratch/runs/20261115-klotski-reviewed-block-progress/native-controls'))
p=load('prod','test/test-controller-production.py')
class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'klotski-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(process.env.KLOTSKI_TEST_FAULT!=='drop'||!command.cmd?.startsWith('mousedown:'))return pending;const injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':value={**value,'seconds':240,'args':[value['args'][0],'--require',str(fixture),*[arg.replace('--app=sol','--app=notepad') for arg in value['args'][1:]],'--trace-input-dispatch'],'env':{'KLOTSKI_TEST_FAULT':'drop' if name=='klotski-unknown' else 'none'}}
   return save(out,key,value)
  original=c.bind
  def bind():
   c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseMove','MOVE'],['handleMouseDown','DOWN'],['handleMouseUp','UP']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};const take=renderer.checkInput;renderer.checkInput=function(...args){const r=take.apply(this,args);if(r)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:r.msg,hwnd:r.hwnd,key:r.wParam,x:r.mouseX,y:r.mouseY}});return r};true"""))
   c.call(dict(action='eval',code="let previous=-1;const observe=setInterval(()=>{const hwnd=instance.exports.get_capture_hwnd();if(hwnd!==previous){persistenceEffects.push({kind:'CAPTURE',at:Date.now(),hwnd});previous=hwnd}},5);observe.unref();true"))
   c.capture('submitted');rr=c.read('submitted.json')
   c.save('submitted-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Notepad fixture only',registeredOriginal=True,defaultFirstPuzzleOnly=True,completeBootstrapReviewed=True,sceneType='bootstrap',bootstrapState='Synthetic fixture ready; no original puzzle selected'))
   with patch.object(c,'bind',original):a.bind('submitted')
  try:
   with patch.object(c,'bind',bind),patch.object(p.b,'save',recipe):super().start(name)
  except BaseException:
   if hasattr(self,'p'):
    try:c.call(dict(action='quit'),timeout=1)
    except Exception:
     if hasattr(self,'out') and not (self.out/'cancel-request.json').exists():p.b.save(self.out,'cancel-request.json',dict(fixtureBootstrapFailed=True))
    out,err=self.p.communicate(timeout=12)
    p.b.save(self.out,'bootstrap-failure-outer-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   raise
  os.environ['KLOTSKI_CONTROL_OUT']=str(c.R);os.environ['KLOTSKI_CONTROL_URL']=c.URL
 def fixture_scene(self,mode='move'):
  # Public native EDIT setup and layout are fixture-only. No original game
  # memory, puzzle file, hit arithmetic or game globals enter this control.
  c.call(dict(action='eval',code="const children=Object.values(renderer.windows).filter(w=>w.isChild&&w.visible);if(children.length!==1)throw Error('one EDIT required');instance.exports.set_focus(children[0].hwnd);true"))
  c.call(dict(cmd='set-focus-text-b64:YWJjZGVmZ2hpamtsbW5vcA==:fixture'))
  c.call(dict(cmd='set-focus-selection:0:0:fixture'))
  point=c.call(dict(action='eval',code="(()=>{const e=instance.exports,h=e.get_focus_hwnd(),w=renderer.windows[h];renderer._computeClientRect(w);return [w.clientRect.x+3,w.clientRect.y+6]})()"))
  scene(mode);r=c.read('fresh-review.json');r['pixelGeometry'].update(chosenPoint=point,destination=[point[0]+55,point[1]]);(c.R/'fresh-review.json').write_text(json.dumps(r));return point
 def test_actual_native_hit_hover_capture_drag(self):
  self.start('klotski-native-drag')
  try:
   point=self.fixture_scene();selection=lambda:c.call(dict(action='eval',code='instance.exports.send_message(instance.exports.get_focus_hwnd(),0xB0,0,0)>>>0'))
   before=selection()
   a.action('drag','mousedown:'+':'.join(map(str,point)),'fresh','move',500)
   after=selection();c.save('native-selection.json',dict(before=before,after=after,fixtureOnly=True))
   self.assertNotEqual(before,after)
   c.capture('after-up');self.assertTrue((c.R/'after-up.png').exists())
   self.assertEqual(c.read('after-up.json')['nativePublic']['captureHwnd'],0)
  finally:s=self.finish()
  edges=[v for v in s['effects'] if v['kind'] in ('MOVE','DOWN','UP')]
  kinds=[v['kind'] for v in edges];self.assertEqual(kinds[:3],['MOVE','DOWN','MOVE']);self.assertIn('UP',kinds[3:])
  d=next(v for v in edges if v['kind']=='DOWN');u=next(v for v in edges if v['kind']=='UP');self.assertLess(u['at']-d['at'],1500)
  captures=[v for v in s['effects'] if v['kind']=='CAPTURE'];self.assertTrue(any(v['hwnd']!=0 for v in captures));self.assertEqual(captures[-1]['hwnd'],0)
  native=(c.R/'native.stdout.log').read_text();self.assertRegex(native,r'\[dispatch-input\].*msg=0x20[012]')
 def test_actual_native_hover(self):
  self.start('klotski-hover')
  try:
   point=self.fixture_scene('hover');before=c.call(dict(action='eval',code='instance.exports.send_message(instance.exports.get_focus_hwnd(),0xB0,0,0)>>>0'))
   a.action('hover','mousemove:'+':'.join(map(str,point)),'fresh','hover',400)
   after=c.call(dict(action='eval',code='instance.exports.send_message(instance.exports.get_focus_hwnd(),0xB0,0,0)>>>0'));self.assertEqual(before,after)
  finally:s=self.finish()
  self.assertTrue(any(v['kind']=='DEQUEUE' and v['event']['msg']==0x200 for v in s['effects']));self.assertFalse(any(v['kind']=='DOWN' for v in s['effects']))
 def test_actual_occupied_destination_refused(self):
  self.start('klotski-collision')
  try:
   point=self.fixture_scene();r=c.read('fresh-review.json');r['destinationFree']=False;(c.R/'fresh-review.json').write_text(json.dumps(r))
   with self.assertRaises(AssertionError):a.action('collision','mousedown:'+':'.join(map(str,point)),'fresh','move',400)
   self.assertFalse((c.R/'collision-intent.json').exists())
  finally:s=self.finish()
  self.assertFalse(any(v['kind']=='DOWN' for v in s['effects']))
 def test_actual_late_ack(self):
  self.start('klotski-late');real=c.call
  def late(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('mousedown'):time.sleep(.45)
   return r
  try:
   self.fixture_scene();r=c.read('fresh-review.json');point=r['pixelGeometry']['chosenPoint']
   with patch.object(c,'call',late),self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:'+':'.join(map(str,point)),'fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_unknown_no_replay(self):
  self.start('klotski-unknown')
  try:
   point=self.fixture_scene()
   with self.assertRaises(Exception):a.action('lost','mousedown:'+':'.join(map(str,point)),'fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('no-retry')
  finally:s=self.finish()
  self.assertEqual(len([v for v in s['effects'] if v['kind']=='DOWN']),1)
 def test_actual_capture_collision_and_unique_names(self):
  self.start('klotski-capture-names')
  try:
   c.capture('unique-a');c.capture('unique-b')
   with self.assertRaisesRegex(AssertionError,'collision'):c.capture('unique-a')
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_parent_death_up(self):
  self.start('klotski-parent-death')
  try:
   point=self.fixture_scene()
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed',sys.argv[2],'fresh','move',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/klotski-controller.py'),'mousedown:'+':'.join(map(str,point))],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   up=p.b.waitfile(c.R/'killed-up.json');p.b.waitfile(c.R/'terminal-input-failure.json')
   end=time.monotonic()+5
   while pathlib.Path('/proc/'+str(up['releasePID'])).exists() and time.monotonic()<end:time.sleep(.01)
   c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True,pid=up['releasePID'],startToken=up['releaseStartToken'],pidAbsent=not pathlib.Path('/proc/'+str(up['releasePID'])).exists()))
  finally:s=self.finish()
  d=next(v for v in s['effects'] if v['kind']=='DOWN');u=next(v for v in s['effects'] if v['kind']=='UP');self.assertLess(u['at']-d['at'],1750)
 def test_actual_short_rejected_before_prearm(self):
  self.start('klotski-short')
  try:
   point=self.fixture_scene()
   for ms in (40,79):
    with self.assertRaises(AssertionError):a.action('short','mousedown:'+':'.join(map(str,point)),'fresh','move',ms)
   self.assertFalse((c.R/'short-intent.json').exists())
  finally:s=self.finish()
  self.assertFalse(any(v['kind']=='DOWN' for v in s['effects']))

if __name__=='__main__':
 cls=Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())

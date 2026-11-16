"""HTTP and real CLI fault controls; synthetic Solitaire is not Tetravex proof."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('tetravex16','tools/tetravex16-controller.py');c=a.c
p=load('prod','test/test-controller-production.py')
def scene(mode='place'):
 c.capture('fresh');rr=c.read('fresh.json')
 c.save('fresh-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Solitaire fixture only; no Tetravex acceptance claim',mode=mode,sceneType='board',originalDefaultPuzzle=True,completeBoard=True,settledPaint=True,rulesEvidence='fixture original drag authority',legalReason='fixture matching 4 left',inputRoute='original-help-drag',visibleEdges=dict(top='1',right='2',bottom='3',left='4'),sourceSlot='fixture source',destinationSlot='fixture destination',destinationEmpty=True,neighbors=[dict(side='left',visible=True,evidence='fixture right4',touchingEdge='4')],allAdjacentNeighborsReviewed=True,destinationGeometrySource='current-full-scene',destinationCenter=[300,240],pixelGeometry=dict(source='current-full-scene',target=rr['target'],chosenCenter=[200,240])))
 c.save('board-admitted.json',dict(fixture=True))
class HTTP(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name);self.effects=[];self.fault=None;test=self
  class Handler(BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    v=json.loads(self.rfile.read(int(self.headers['Content-Length'])));test.effects.append(dict(command=v,at=time.time()))
    if v['action']=='guarded-input':
     g=v['guard'];state={'cancel':'CANCELLED','unknown':'UNKNOWN'}.get(test.fault,'CONSUMED')
     r=dict(owner=g['owner'],epoch=g['epoch'],nonce=g['nonce'],state=state,consumed=state=='CONSUMED',consumedAt=time.time()*1000 if state=='CONSUMED' else None)
     if test.fault=='unknown-up' and v.get('cmd','').startswith('mouseup'):r.update(state='UNKNOWN',consumed=False,consumedAt=None)
     if test.fault=='identity':r['epoch']+=1
     if test.fault=='mixed':r.update(state='CANCELLED',consumed=True,consumedAt=time.time()*1000)
     if test.fault=='late' and v.get('cmd','').startswith('mousedown'):time.sleep(.35)
    else:r=dict(released=True,owner=v['owner'])
    try:self.send_response(200);self.end_headers();self.wfile.write(json.dumps(dict(ok=True,value=r)).encode())
    except BrokenPipeError:pass
  self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);self.thread=threading.Thread(target=self.server.serve_forever);self.thread.start()
  c.URL='http://127.0.0.1:'+str(self.server.server_port)+'/ctl'
  self.env=patch.dict(os.environ,FORSAKEN_CONTROL_OUT=str(c.R),FORSAKEN_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+900))
  self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{}));self.lease.start();scene()
 def tearDown(self):
  self.lease.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
 def test_single_move_and_prearm(self):
  a.action('one','mousedown:200:240','fresh','place',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240','mousemove:300:240','mouseup:300:240',None]);self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualPlacementClaim'])
 def test_unknown_cancel_identity_close(self):
  self.fault='unknown'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','place',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_cancel_closes(self):
  self.fault='cancel'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','place',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_mixed_receipt_closes(self):
  self.fault='mixed'
  with self.assertRaises(AssertionError):a.action('mixed','mousedown:200:240','fresh','place',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_identity_closes(self):
  self.fault='identity'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','place',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_late_ack_closes(self):
  self.fault='late'
  with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:200:240','fresh','place',200)
  self.assertLess(self.effects[-1]['at']-self.effects[0]['at'],.6)
 def test_audit_after_up(self):
  real=c.save;times=[]
  def slow(name,v):
   if name=='one-receipt.json':times.append(time.time());time.sleep(.3)
   return real(name,v)
  with patch.object(c,'save',slow):a.action('one','mousedown:200:240','fresh','place',400)
  self.assertGreater(times[0],self.effects[-1]['at'])
 def test_child_death_before_down(self):
  real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  with patch.object(subprocess,'Popen',died):
   with self.assertRaises(Exception):a.action('dead','mousedown:200:240','fresh','place',400)
  self.assertEqual(self.effects,[]);self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_parent_death_independent_release(self):
  code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
a.c.lease=lambda:({'owner':'owner','epoch':1},{})
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v['action']=='guarded-input':os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','place',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/tetravex16-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not all((c.R/n).exists() for n in ('killed-up.json','terminal-input-failure.json')) and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_no_capture_while_held(self):
  cap=c.capture
  def capture(name):
   if name=='one':self.assertEqual(c.read('one-up.json')['state'],'ACK')
   return cap(name)
  with patch.object(c,'capture',capture):a.action('one','mousedown:200:240','fresh','place',400)
 def test_destination_up_fault_still_cleans(self):
  real=c.call
  def fail_up(v,timeout=10):
   if v.get('cmd','').startswith('mouseup'):raise RuntimeError('fixture missing UP ACK')
   return real(v,timeout)
  # Release is a genuine child: inject the server fault instead of patching its code.
  self.fault='unknown-up'
  with self.assertRaises(AssertionError):a.action('badup','mousedown:200:240','fresh','place',400)
  self.assertEqual(self.effects[-1]['command']['action'],'guarded-release')
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])

class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'tetravex16-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(process.env.TETRAVEX16_TEST_FAULT!=='drop'||command.cmd!=='mousedown:200:240')return pending;const injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':value={**value,'seconds':240,'args':[value['args'][0],'--require',str(fixture),*value['args'][1:],'--trace-input-dispatch'],'env':{'TETRAVEX16_TEST_FAULT':'drop' if name=='tetravex16-unknown' else 'none'}}
   return save(out,key,value)
  original=c.bind
  def bind():
   c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseDown','DOWN'],['handleMouseUp','UP']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};const take=renderer.checkInput;renderer.checkInput=function(...args){const r=take.apply(this,args);if(r)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:r.msg,hwnd:r.hwnd,x:r.mouseX,y:r.mouseY}});return r};true"""))
   c.capture('submitted');rr=c.read('submitted.json')
   c.save('submitted-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Solitaire fixture canvas; no Tetravex claim',sceneType='board',originalRegisteredTitle=True,visibleBoardDescription='Synthetic Solitaire board fixture'))
   with patch.object(c,'bind',original):a.bind('submitted')
  with patch.object(c,'bind',bind),patch.object(p.b,'save',recipe):super().start(name)
 def test_actual_single_pointer(self):
  self.start('tetravex16-move')
  try:scene();a.action('one','mousedown:200:240','fresh','place',400)
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
  events=[e for e in summary['effects'] if e['kind']=='DEQUEUE'];move=next(e for e in events if e['event']['msg']==0x200);down=next(e for e in events if e['event']['msg']==0x201)
  self.assertLess(events.index(move),events.index(down));self.assertGreaterEqual(down['at']-move['at'],25)
  destMove=next(e for e in events if e['event']['msg']==0x200 and [e['event']['x'],e['event']['y']]==[300,240])
  destUp=next(e for e in events if e['event']['msg']==0x202 and [e['event']['x'],e['event']['y']]==[300,240])
  self.assertLess(events.index(down),events.index(destMove));self.assertLess(events.index(destMove),events.index(destUp))
  self.assertLess(destUp['at']-down['at'],1500)
 def test_actual_transport_cannot_claim_native_acceptance(self):
  self.start('tetravex16-native-acceptance')
  try:
   scene();a.action('one','mousedown:200:240','fresh','place',600)
   self.assertFalse(c.read('one-completed.json')['actualPlacementClaim'])
   rr=c.read('one.json')
   c.save('one-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,
       observation='Actual Solitaire fixture after finite gesture; native Tetravex placement is not established',
       completeBoard=True,nativePlacementAccepted=False,persistentPlacement=False))
   with self.assertRaises(AssertionError):a.acceptance('one','one')
   self.assertFalse((c.R/'one-native-accepted.json').exists())
   c.save('native-acceptance-refused.json',dict(transportConsumed=True,nativePlacementClaim=False,fixtureOnly=True))
  finally:self.finish()
 def test_actual_destination_up(self):
  self.start('tetravex16-stock')
  try:scene();a.action('pause','mousedown:200:240','fresh','place',400)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertEqual(d['args'][:2],[200,240]);self.assertEqual(u['args'][:2],[300,240]);self.assertLess(u['at']-d['at'],1500)
 def test_actual_native_menu_control(self):
  self.start('tetravex16-native-menu')
  try:
   # Native public menu geometry, restricted to this synthetic CLI fixture.
   point=c.call(dict(action='eval',code='(()=>{const e=instance.exports,h=e.get_main_hwnd();return [e.menu_bar_screen_x(h)+18,e.menu_bar_screen_y(h)+8]})()'))
   c.capture('menu');rr=c.read('menu.json')
   c.save('menu-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic fixture native menu control',mode='menu',menuRoute='open-help',targetKind='menu',visibleLabel='Fixture first native menu',pixelGeometry=dict(source='current-full-scene',target=rr['target'],chosenCenter=point)))
   a.action('openmenu','mousedown:'+':'.join(map(str,point)),'menu','menu',400,'open-help')
   opened=c.call(dict(action='eval',code='({hwnd:instance.exports.menu_open_hwnd(),top:instance.exports.menu_open_top()})'))
   c.save('native-menu-control.json',dict(opened=opened,point=point,fixtureOnly=True))
   self.assertNotEqual(opened['hwnd'],0);self.assertEqual(opened['top'],0)
  finally:self.finish()
 def test_actual_late_ack_closes(self):
  self.start('tetravex16-late');real=c.call
  def late(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('mousedown'):time.sleep(.45)
   return r
  try:
   scene()
   with patch.object(c,'call',late):
    with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_unknown_after_consumption(self):
  self.start('tetravex16-unknown')
  try:
   scene()
   with self.assertRaises(Exception):a.action('lost','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   nonce=c.read('lost-intent.json')['nonce']
   self.assertEqual(c.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
 def test_actual_release_child_death_before_down(self):
  self.start('tetravex16-child-death');real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  try:
   scene()
   with patch.object(subprocess,'Popen',died):
    with self.assertRaises(Exception):a.action('dead','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' for e in summary['effects']))
 def test_actual_cancel_closes(self):
  self.start('tetravex16-cancel')
  try:
   scene();c.call(dict(action='frozen',mode='on'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('cancel','mousedown:200:240','fresh','place',400)
   c.call(dict(action='frozen',mode='off'));self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' and e['args'][:2]==[200,240] for e in summary['effects']))
 def test_actual_window_identity_closes(self):
  self.start('tetravex16-identity')
  try:
   scene();c.call(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('changed','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_silent_parent_fallback(self):
  self.start('tetravex16-fallback')
  try:
   owner=c.read('input-owner.json');at=time.time()
   plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.500,nonce='fallback-one',milliseconds=400,final=False,destination=None)
   c.save('fallback-intent.json',plan)
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/tetravex16-controller.py'),'release','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='mousedown:200:240',guard={**owner,'nonce':plan['nonce'],'reviewed':True,'deadline':int((at+2)*1000)}));self.assertTrue(receipt['consumed'])
   child.wait(timeout=3);out,err=child.communicate()
   c.save('fallback-actual-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(child.returncode,0);self.assertEqual(c.read('fallback-up.json')['reason'],'fallback');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP')
  self.assertGreater(u['at']-d['at'],1500);self.assertLess(u['at']-d['at'],1800)
 def test_actual_no_capture_while_held(self):
  self.start('tetravex16-capture-order');real=c.capture
  def capture(name):
   if name=='pause':self.assertEqual(c.read('pause-up.json')['state'],'ACK')
   return real(name)
  try:
   scene()
   with patch.object(c,'capture',capture):a.action('pause','mousedown:200:240','fresh','place',500)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1500)
 def test_actual_parent_death_up(self):
  self.start('tetravex16-death')
  try:
   scene()
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','place',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/tetravex16-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   p.b.waitfile(c.R/'killed-up.json');self.assertTrue(c.read('terminal-input-failure.json')['noReplay']);c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True))
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1750)
if __name__=='__main__':
 cls=Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())


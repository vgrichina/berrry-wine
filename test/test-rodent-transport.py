"""HTTP and real CLI fault controls; synthetic Notepad is not Rodent proof."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('rodent','tools/rodent-controller.py');c=a.c
p=load('prod','test/test-controller-production.py')
def scene(mode='move'):
 c.capture('fresh');rr=c.read('fresh.json');snap=rr['snapshot']
 c.save('fresh-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Notepad fixture only, no original Rodent claim',mode=mode,sceneType='board',defaultLevel1=True,settledPaint=True,completeBoard=True,visibleBoardDescription='synthetic visible floor right',rulesEvidence='synthetic fixture',legalReason='one right press on visible floor',chosenDirection='right',routeFromCurrentPixels=True,inputRoute='native-keyboard',keyboardConsumer=snap['focus'],keyboardFocus=snap['focus']))
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
     if test.fault=='identity':r['epoch']+=1
     if test.fault=='mixed':r.update(state='CANCELLED',consumed=True,consumedAt=time.time()*1000)
     if test.fault=='late':time.sleep(.35)
    else:r=dict(released=True,owner=v['owner'])
    try:self.send_response(200);self.end_headers();self.wfile.write(json.dumps(dict(ok=True,value=r)).encode())
    except BrokenPipeError:pass
  self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);self.thread=threading.Thread(target=self.server.serve_forever);self.thread.start()
  c.URL='http://127.0.0.1:'+str(self.server.server_port)+'/ctl'
  self.env=patch.dict(os.environ,RODENT_CONTROL_OUT=str(c.R),RODENT_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+900))
  self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',focus='0x2',eip='0x2',windows=[dict(hwnd='0x2',isChild=True,visible=True)],screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{'focus':'0x2'}));self.lease.start();scene()
 def tearDown(self):
  self.lease.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
 def test_single_move_and_prearm(self):
  a.action('one','keydown:39','fresh','move',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['keydown:39',None]);self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualMovementClaim'])
 def test_unknown_cancel_identity_close(self):
  self.fault='unknown'
  with self.assertRaises(AssertionError):a.action('bad','keydown:39','fresh','move',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_cancel_closes(self):
  self.fault='cancel'
  with self.assertRaises(AssertionError):a.action('bad','keydown:39','fresh','move',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_mixed_receipt_closes(self):
  self.fault='mixed'
  with self.assertRaises(AssertionError):a.action('mixed','keydown:39','fresh','move',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_identity_closes(self):
  self.fault='identity'
  with self.assertRaises(AssertionError):a.action('bad','keydown:39','fresh','move',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_late_ack_closes(self):
  self.fault='late'
  with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','keydown:39','fresh','move',200)
  self.assertLess(self.effects[-1]['at']-self.effects[0]['at'],.6)
 def test_audit_after_up(self):
  real=c.save;times=[]
  def slow(name,v):
   if name=='one-receipt.json':times.append(time.time());time.sleep(.3)
   return real(name,v)
  with patch.object(c,'save',slow):a.action('one','keydown:39','fresh','move',400)
  self.assertGreater(times[0],self.effects[-1]['at'])
 def test_child_death_before_down(self):
  real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  with patch.object(subprocess,'Popen',died):
   with self.assertRaises(Exception):a.action('dead','keydown:39','fresh','move',400)
  self.assertEqual(self.effects,[]);self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_parent_death_independent_release(self):
  code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
a.c.lease=lambda:({'owner':'owner','epoch':1},{'focus':'0x2'})
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v['action']=='guarded-input':os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','keydown:39','fresh','move',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/rodent-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not all((c.R/n).exists() for n in ('killed-up.json','terminal-input-failure.json')) and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])

class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'rodent-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(process.env.RODENT_TEST_FAULT!=='drop'||command.cmd!=='keydown:39')return pending;const injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':value={**value,'seconds':240,'args':[value['args'][0],'--require',str(fixture),*[arg.replace('--app=sol','--app=notepad') for arg in value['args'][1:]],'--trace-input-dispatch'],'env':{'RODENT_TEST_FAULT':'drop' if name=='rodent-unknown' else 'none'}}
   return save(out,key,value)
  original=c.bind
  def bind():
   # Notepad leaves startup focus on its form here. Select its unique public
   # native EDIT child through SetFocus, only in this synthetic fixture.
   initial=c.call(dict(action='snapshot'));c.save('fixture-startup-focus.json',initial)
   c.call(dict(action='eval',code="const children=Object.values(renderer.windows).filter(w=>w.isChild&&w.visible);if(children.length!==1)throw Error('one Notepad EDIT child required');instance.exports.set_focus(children[0].hwnd);true"))
   end=time.monotonic()+4
   while True:
    snapshot=c.call(dict(action='snapshot'))
    if snapshot['focus'] not in ('0x0',snapshot['mainHwnd']) and any(w['hwnd']==snapshot['focus'] and w['isChild'] and w['visible'] for w in snapshot['windows']):break
    assert time.monotonic()<end,'native Notepad child focus never became ready'
    time.sleep(.02)
   c.call(dict(action='eval',code="""for(const [method,kind] of [['handleKeyDown','KEYDOWN'],['handleKeyUp','KEYUP'],['handleMouseDown','DOWN'],['handleMouseUp','UP']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};const take=renderer.checkInput;renderer.checkInput=function(...args){const r=take.apply(this,args);if(r)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:r.msg,hwnd:r.hwnd,key:r.wParam,x:r.mouseX,y:r.mouseY}});return r};true"""))
   c.capture('submitted');rr=c.read('submitted.json')
   c.save('submitted-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Notepad fixture canvas; no Rodent claim',sceneType='board',registeredOriginal=True,defaultLevel1=True,completeBootstrapReviewed=True,visibleBoardDescription='Synthetic Notepad board fixture'))
   with patch.object(c,'bind',original):a.bind('submitted')
  try:
   with patch.object(c,'bind',bind),patch.object(p.b,'save',recipe):super().start(name)
  except BaseException:
   if hasattr(self,'p'):
    # A fixture bootstrap failure must still drain its own native process.
    try:c.call(dict(action='quit'),timeout=1)
    except Exception:
     if hasattr(self,'out') and not (self.out/'cancel-request.json').exists():p.b.save(self.out,'cancel-request.json',dict(fixtureBootstrapFailed=True))
    out,err=self.p.communicate(timeout=12)
    p.b.save(self.out,'bootstrap-failure-outer-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   raise
  os.environ['RODENT_CONTROL_OUT']=str(c.R);os.environ['RODENT_CONTROL_URL']=c.URL
 def test_actual_native_keyboard_consumer(self):
  self.start('rodent-keyboard')
  try:
   # Public EDIT setup in the Notepad fixture only. The original Rodent
   # recipe has no preload, text/selection writes, or caret inspection.
   c.call(dict(cmd='set-focus-text-b64:YWJj:fixture'))
   c.call(dict(cmd='set-focus-selection:0:0:fixture'))
   caret=lambda:c.call(dict(action='eval',code='({hwnd:instance.exports.get_caret_hwnd(),x:instance.exports.get_caret_x(),y:instance.exports.get_caret_y()})'))
   before=caret();scene();a.action('one','keydown:39','fresh','move',400)
   after=caret();c.save('native-child-caret-consequence.json',dict(before=before,after=after,fixtureOnly=True))
   self.assertEqual(before['hwnd'],after['hwnd']);self.assertGreater(after['x'],before['x']);self.assertEqual(after['y'],before['y'])
  finally:summary=self.finish()
  downs=[e for e in summary['effects'] if e['kind']=='KEYDOWN' and e['args'][0]==39]
  ups=[e for e in summary['effects'] if e['kind']=='KEYUP' and e['args'][0]==39]
  self.assertEqual(len(downs),1);self.assertEqual(len(ups),1);self.assertLess(ups[0]['at']-downs[0]['at'],1500)
  native=(c.R/'native.stdout.log').read_text()
  focus=c.read('fresh.json')['snapshot']['focus']
  self.assertNotEqual(focus,c.read('fresh.json')['snapshot']['mainHwnd'])
  # Native EDIT handles DOWN through the real synchronous WAT SendMessage
  # path. Its caret change proves consumption; a second queued DOWN would
  # duplicate movement. UP still traverses the native message loop.
  self.assertNotRegex(native,r'\[input-dequeue\].*msg=0x100.*wParam=0x27')
  self.assertRegex(native,r'\[dispatch-input\].*hwnd='+focus+r'\b.*msg=0x101.*wParam=0x27')
 def test_actual_focus_change_refuses_before_down(self):
  self.start('rodent-focus')
  try:
   scene();snap=c.read('fresh.json')['snapshot'];changed='0x7' if snap['focus']!='0x7' else '0x8'
   c.call(dict(action='eval',code='instance.exports.set_focus_hwnd('+str(int(changed,16))+');true'))
   with self.assertRaisesRegex(AssertionError,'focus changed'):a.action('focus','keydown:39','fresh','move',400)
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='KEYDOWN' and e['args'][0]==39 for e in summary['effects']))
 def test_actual_native_menu_control(self):
  self.start('rodent-native-menu')
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
  self.start('rodent-late');real=c.call
  def late(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('keydown'):time.sleep(.45)
   return r
  try:
   scene()
   with patch.object(c,'call',late):
    with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','keydown:39','fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_unknown_after_consumption(self):
  self.start('rodent-unknown')
  try:
   scene()
   with self.assertRaises(Exception):a.action('lost','keydown:39','fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   nonce=c.read('lost-intent.json')['nonce']
   self.assertEqual(c.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='KEYDOWN' and e['args'][0]==39]),1)
 def test_actual_release_child_death_before_down(self):
  self.start('rodent-child-death');real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  try:
   scene()
   with patch.object(subprocess,'Popen',died):
    with self.assertRaises(Exception):a.action('dead','keydown:39','fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='KEYDOWN' for e in summary['effects']))
 def test_actual_cancel_closes(self):
  self.start('rodent-cancel')
  try:
   scene();c.call(dict(action='frozen',mode='on'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('cancel','keydown:39','fresh','move',400)
   c.call(dict(action='frozen',mode='off'));self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='KEYDOWN' and e['args'][0]==39 for e in summary['effects']))
 def test_actual_window_identity_closes(self):
  self.start('rodent-identity')
  try:
   scene();c.call(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('changed','keydown:39','fresh','move',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_silent_parent_fallback(self):
  self.start('rodent-fallback')
  try:
   owner=c.read('input-owner.json');at=time.time()
   plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.500,nonce='fallback-one',milliseconds=400,final=False)
   c.save('fallback-intent.json',plan)
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/rodent-controller.py'),'release','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='keydown:39',guard={**owner,'nonce':plan['nonce'],'reviewed':True,'deadline':int((at+2)*1000)}));self.assertTrue(receipt['consumed'])
   child.wait(timeout=3);out,err=child.communicate()
   c.save('fallback-actual-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(child.returncode,0);self.assertEqual(c.read('fallback-up.json')['reason'],'fallback');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='KEYDOWN');u=next(e for e in summary['effects'] if e['kind']=='KEYUP')
  self.assertGreater(u['at']-d['at'],1500);self.assertLess(u['at']-d['at'],1800)
 def test_actual_no_capture_while_held(self):
  self.start('rodent-capture-order');real=c.capture
  def capture(name):
   if name=='pause':self.assertEqual(c.read('pause-up.json')['state'],'ACK')
   return real(name)
  try:
   scene('move')
   a.action('pause','keydown:39','fresh','move',500)
   with patch.object(c,'capture',capture):c.capture('pause')
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='KEYDOWN');u=next(e for e in summary['effects'] if e['kind']=='KEYUP');self.assertLess(u['at']-d['at'],1500)
 def test_actual_parent_death_up(self):
  self.start('rodent-death')
  try:
   scene('move')
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('keydown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','keydown:39','fresh','move',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/rodent-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   p.b.waitfile(c.R/'killed-up.json');p.b.waitfile(c.R/'terminal-input-failure.json');self.assertTrue(c.read('terminal-input-failure.json')['noReplay']);c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True))
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='KEYDOWN');u=next(e for e in summary['effects'] if e['kind']=='KEYUP');self.assertLess(u['at']-d['at'],1750)
if __name__=='__main__':
 cls=Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())

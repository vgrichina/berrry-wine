"""HTTP and real CLI fault controls; synthetic Solitaire is not Sims proof."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('sims-install','tools/sims-install-controller.py');c=a.c
p=load('prod','test/test-controller-production.py')
def review(name, mode='select', point=None, **extra):
 rr=c.read(name+'.json')
 values=dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,
  observation='Synthetic native fixture only; no Sims gameplay claim',mode=mode,
  sceneType='household',ordinaryNativeUI=True,visibleLabel='fixture target',chosenSim='fixture Sim',
  visibleSelectedSim='fixture Sim',liveHousehold=True,personallyChosenAction='fixture pointer action',
  hoverOnly=True,pixelGeometry=dict(source='current-full-scene',target=rr['target'],chosenCenter=point or [200,240]))
 values.update(extra);c.save(name+'-review.json',values)
def scene(mode='select'):
 c.capture('fresh');review('fresh',mode)
 for key,value in [('household-reviewed.json',dict(fixture=True)),('selection-reviewed.json',dict(review=dict(visibleSelectedSim='fixture Sim')))]:
  if not (c.R/key).exists():c.save(key,value)

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
  self.env=patch.dict(os.environ,SIMS_CONTROL_OUT=str(c.R),SIMS_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+900))
  self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{}));self.lease.start();scene()
 def tearDown(self):
  self.lease.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
 def test_capture_deadline_stops_before_second_request(self):
  calls=[]
  def snapshot(command,timeout=10):calls.append(dict(command=command,timeout=timeout));return {}
  with patch.object(c,'opened'),patch.object(c,'call',snapshot),patch.object(time,'monotonic',side_effect=[0,0,3.001]):
   with self.assertRaisesRegex(AssertionError,'capture deadline expired after snapshot'):self.cap.temp_original('budget')
  self.assertEqual(len(calls),1);self.assertEqual(calls[0]['timeout'],3)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_three_second_review_deadline(self):
  at=c.read('fresh.json')['at']
  with patch.object(time,'time',return_value=at+3.001):
   with self.assertRaisesRegex(AssertionError,'expired'):a.policy('mousedown:200:240','fresh','select')
  self.assertEqual(self.effects,[])
 def test_single_move_and_prearm(self):
  a.action('one','mousedown:200:240','fresh','select',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None]);self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualGameplayClaim'])
 def test_hover_is_one_move_with_independent_release(self):
  r=c.read('fresh-review.json');r.update(mode='hover',hoverOnly=True);(c.R/'fresh-review.json').write_text(json.dumps(r))
  a.action('hover','mousemove:200:240','fresh','hover',120)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousemove:200:240',None])
  self.assertEqual(c.read('hover-up.json')['state'],'ACK');self.assertTrue(c.read('hover-release-wait.json')['actualWait'])
 def test_impossible_short_pulse_never_reaches_http(self):
  with self.assertRaises(AssertionError):a.action('short','mousedown:200:240','fresh','select',40)
  self.assertEqual(self.effects,[]);self.assertFalse((c.R/'short-intent.json').exists())
 def test_installer_cancel_is_final_without_post_choice_capture(self):
  review=c.read('fresh-review.json');review.update(mode='quit',sceneType='installer',quitRoute='cancel-installer',visibleQuitTarget=True)
  (c.R/'fresh-review.json').write_text(json.dumps(review))
  with patch.object(c,'capture') as capture:
   result=a.action('cancel-installer','mousedown:200:240','fresh','quit',120,'cancel-installer')
  capture.assert_not_called();self.assertTrue(c.read('cancel-installer-intent.json')['final'])
  self.assertEqual(c.read('cancel-installer-up.json')['state'],'ACK')
  self.assertIn('actual native wait',result)
 def test_unknown_cancel_identity_close(self):
  self.fault='unknown'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','select',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_cancel_closes(self):
  self.fault='cancel'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','select',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_mixed_receipt_closes(self):
  self.fault='mixed'
  with self.assertRaises(AssertionError):a.action('mixed','mousedown:200:240','fresh','select',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_identity_closes(self):
  self.fault='identity'
  with self.assertRaises(AssertionError):a.action('bad','mousedown:200:240','fresh','select',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_late_ack_closes(self):
  self.fault='late'
  with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:200:240','fresh','select',200)
  self.assertLess(self.effects[-1]['at']-self.effects[0]['at'],.6)
 def test_audit_after_up(self):
  real=c.save;times=[]
  def slow(name,v):
   if name=='one-receipt.json':times.append(time.time());time.sleep(.3)
   return real(name,v)
  with patch.object(c,'save',slow):a.action('one','mousedown:200:240','fresh','select',400)
  self.assertGreater(times[0],self.effects[-1]['at'])
 def test_child_death_before_down(self):
  real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  with patch.object(subprocess,'Popen',died):
   with self.assertRaises(Exception):a.action('dead','mousedown:200:240','fresh','select',400)
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
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','select',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/sims-install-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not all((c.R/n).exists() for n in ('killed-up.json','terminal-input-failure.json')) and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])

class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'sims-install-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(process.env.SIMS_TEST_FAULT!=='drop'||command.cmd!=='mousedown:200:240')return pending;const injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  quit_fixture=name=='sims-install-native-menu-quit'
  if quit_fixture:
   made=subprocess.run(['node',str(ROOT/'test/test-cli-native-menu-receipt.cjs'),'--make-fixture',str(p.b.R/'menu-quit.exe')],capture_output=True,timeout=10)
   self.assertEqual(made.returncode,0,made.stderr.decode())
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':value={**value,'seconds':240,'args':[value['args'][0],'--require',str(fixture),*[arg.replace('--app=sol','--exe='+str(p.b.R/'menu-quit.exe') if quit_fixture else '--app=notepad') for arg in value['args'][1:]],'--trace-input-dispatch'],'env':{'SIMS_TEST_FAULT':'drop' if name=='sims-install-unknown' else 'none'}}
   if key=='recipe.json' and quit_fixture:value['args'].append('--trace-api=ExitProcess,PostQuitMessage,SetTimer,KillTimer')
   return save(out,key,value)
  original=c.bind
  def bind():
   c.call(dict(action='eval',code="""const children=Object.values(renderer.windows).filter(w=>w.isChild&&w.visible);if(children.length===1)instance.exports.set_focus(children[0].hwnd);else if(!renderer.windows[instance.exports.get_main_hwnd()].title.includes('menu Quit fixture'))throw Error('one Notepad EDIT child required');for(const [method,kind] of [['handleMouseDown','DOWN'],['handleMouseUp','UP'],['handleMouseMove','MOVE']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};const take=renderer.checkInput;renderer.checkInput=function(...args){const r=take.apply(this,args);if(r)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:r.msg,hwnd:r.hwnd,key:r.wParam,x:r.mouseX,y:r.mouseY}});return r};true"""))
   c.capture('submitted');rr=c.read('submitted.json')
   review('submitted',sceneType='installer',exactReleaseReviewed=True,completeBootstrapReviewed=True,nativeTitle=next(w['title'] for w in rr['snapshot']['windows'] if w['hwnd']==rr['snapshot']['mainHwnd']))
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
  os.environ['SIMS_CONTROL_OUT']=str(c.R);os.environ['SIMS_CONTROL_URL']=c.URL
 def test_actual_native_hit_hover_selection(self):
  self.start('sims-install-native-hit-hover-selection')
  try:
   # Public EDIT fixture setup only; the original recipe has no preload or writes.
   c.call(dict(cmd='set-focus-text-b64:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=:fixture'))
   c.call(dict(cmd='set-focus-selection:0:0:fixture'))
   point=c.call(dict(action='eval',code='(()=>{const h=instance.exports.get_main_hwnd(),w=renderer.windows[h];renderer._computeClientRect(w);return [w.clientRect.x+72,w.clientRect.y+8]})()'))
   caret=lambda:c.call(dict(action='eval',code='({hwnd:instance.exports.get_caret_hwnd(),x:instance.exports.get_caret_x(),y:instance.exports.get_caret_y()})'))
   before=caret();focus=c.call(dict(action='snapshot'))['focus']
   def fresh(name,mode):
    c.capture(name);rr=c.read(name+'.json')
    review(name,mode,point)
   c.save('household-reviewed.json',dict(fixture=True));c.save('selection-reviewed.json',dict(review=dict(visibleSelectedSim='fixture Sim')));fresh('hover-before','hover')
   a.action('hover','mousemove:'+':'.join(map(str,point)),'hover-before','hover',120)
   hovered=caret();fresh('select-before','select')
   a.action('select','mousedown:'+':'.join(map(str,point)),'select-before','select',120)
   selected=caret();c.save('native-hit-hover-selection.json',dict(before=before,hovered=hovered,selected=selected,point=point,focus=focus,fixtureOnly=True))
   self.assertEqual(before,hovered);self.assertEqual(before['hwnd'],selected['hwnd']);self.assertGreater(selected['x'],before['x'])
  finally:summary=self.finish()
  moves=[e for e in summary['effects'] if e['kind']=='DEQUEUE' and e['event']['msg']==0x200]
  self.assertTrue(any(e['event']['hwnd']==int(focus,16) for e in moves),'native hover must reach focused EDIT child')
  native=(c.R/'native.stdout.log').read_text();self.assertIn('hwnd='+focus+' msg=0x201',native);self.assertIn('hwnd='+focus+' msg=0x202',native)
 def test_actual_capture_collision_no_second_observation(self):
  self.start('sims-install-collision')
  try:
   c.capture('unique-negative')
   real=c.call
   with patch.object(c,'call',wraps=real) as calls:
    with self.assertRaisesRegex(AssertionError,'collision'):c.capture('unique-negative')
    calls.assert_not_called()
   with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('fresh-after-collision')
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' for e in summary['effects']))
 def test_actual_native_menu_control(self):
  self.start('sims-install-native-menu')
  try:
   point=c.call(dict(action='eval',code='(()=>{const e=instance.exports,h=e.get_main_hwnd();return [e.menu_bar_screen_x(h)+18,e.menu_bar_screen_y(h)+8]})()'))
   c.capture('menu-before');rr=c.read('menu-before.json')
   review('menu-before','menu',point,sceneType='menu',menuRoute='start')
   a.action('menu-open','mousedown:'+':'.join(map(str,point)),'menu-before','menu',400,'start')
   receipt=c.read('menu-open-receipt.json');up=c.read('menu-open-up.json')
   self.assertEqual(receipt['receiptBoundary'],'native-menu-pointer-return')
   self.assertEqual(receipt['nativeMessage']['kind'],'menu-pointer')
   self.assertNotIn('msg',receipt['nativeMessage'])  # Menu tracking does not deliver client DOWN.
   self.assertEqual(up['state'],'ACK');self.assertEqual(up['reason'],'consumed pulse')
   opened=c.call(dict(action='eval',code='({hwnd:instance.exports.menu_open_hwnd(),top:instance.exports.menu_open_top()})'))
   c.save('native-menu-control.json',dict(opened=opened,point=point,fixtureOnly=True));self.assertNotEqual(opened['hwnd'],0);self.assertEqual(opened['top'],0)
  finally:self.finish()
 def test_actual_native_menu_quit(self):
  self.start('sims-install-native-menu-quit')
  try:
   point=c.call(dict(action='eval',code='(()=>{const e=instance.exports,h=e.get_main_hwnd();return [e.menu_bar_screen_x(h)+18,e.menu_bar_screen_y(h)+8]})()'))
   c.capture('quit-before');review('quit-before','quit',point,sceneType='menu',quitRoute='select-exit',visibleQuitTarget=True)
   a.action('native-quit','mousedown:'+':'.join(map(str,point)),'quit-before','quit',120,'select-exit')
   self.assertEqual(c.read('native-quit-receipt.json')['receiptBoundary'],'native-menu-pointer-return')
   self.assertEqual(c.read('native-quit-up.json')['state'],'ACK')
   out,err=self.p.communicate(timeout=10)
   c.save('fixture-outer-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(self.p.returncode,0)
   for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json'):
    wait=p.b.waitfile(self.out/name);self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF']);self.assertEqual(wait['exit'],0)
   self.assertFalse((c.R/'cancel-request.json').exists())
   log=(c.R/'native.stdout.log').read_text();self.assertIn('ExitProcess',log)
   c.save('native-quit-proof.json',dict(authoredFixtureOnly=True,normalGuestQuit=True,physicalUpACK=True,hostQuit=False))
  finally:
   if self.p.poll() is None:self.finish()  # Failure cleanup is never guest Quit proof.
   for image in self.out.glob('*.png'):image.unlink()
 def test_actual_single_pointer(self):
  self.start('sims-install-move')
  try:scene();a.action('one','mousedown:200:240','fresh','select',400)
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
 def test_actual_second_pointer_click_up(self):
  self.start('sims-install-pointer-up')
  try:scene('select');a.action('pause','mousedown:200:240','fresh','select',400)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertEqual(d['args'][:2],[200,240]);self.assertLess(u['at']-d['at'],1500)
 def test_actual_late_ack_closes(self):
  self.start('sims-install-late');real=c.call
  def late(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('mousedown'):time.sleep(.45)
   return r
  try:
   scene()
   with patch.object(c,'call',late):
    with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousedown:200:240','fresh','select',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_unknown_after_consumption(self):
  self.start('sims-install-unknown')
  try:
   scene()
   with self.assertRaises(Exception):a.action('lost','mousedown:200:240','fresh','select',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   nonce=c.read('lost-intent.json')['nonce']
   self.assertEqual(c.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
 def test_actual_release_child_death_before_down(self):
  self.start('sims-install-child-death');real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  try:
   scene()
   with patch.object(subprocess,'Popen',died):
    with self.assertRaises(Exception):a.action('dead','mousedown:200:240','fresh','select',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' for e in summary['effects']))
 def test_actual_cancel_closes(self):
  self.start('sims-install-cancel')
  try:
   scene();c.call(dict(action='frozen',mode='on'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('cancel','mousedown:200:240','fresh','select',400)
   c.call(dict(action='frozen',mode='off'));self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' and e['args'][:2]==[200,240] for e in summary['effects']))
 def test_actual_window_identity_closes(self):
  self.start('sims-install-identity')
  try:
   scene();c.call(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('changed','mousedown:200:240','fresh','select',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_silent_parent_fallback(self):
  self.start('sims-install-fallback')
  try:
   owner=c.read('input-owner.json');at=time.time()
   plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.500,nonce='fallback-one',milliseconds=400,final=False)
   c.save('fallback-intent.json',plan)
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/sims-install-controller.py'),'release','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='mousedown:200:240',guard={**owner,'nonce':plan['nonce'],'reviewed':True,'deadline':int((at+2)*1000)}));self.assertTrue(receipt['consumed'])
   child.wait(timeout=3);out,err=child.communicate()
   c.save('fallback-actual-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(child.returncode,0);self.assertEqual(c.read('fallback-up.json')['reason'],'fallback');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP')
  # The fallback is anchored before child startup/HTTP, not to native DOWN.
  # Slow admission shortens the physical hold; it must not move the fallback.
  fired=c.read('fallback-up.json')
  self.assertGreaterEqual(fired['firedAt'],plan['fallbackAt'])
  self.assertGreaterEqual(u['at'],plan['fallbackAt']*1000)
  self.assertLess(u['at']-d['at'],1750)
 def test_actual_no_capture_while_held(self):
  self.start('sims-install-capture-order');real=c.capture
  def capture(name):
   if name=='pause':self.assertEqual(c.read('pause-up.json')['state'],'ACK')
   return real(name)
  try:
   scene('select')
   with patch.object(c,'capture',capture):a.action('pause','mousedown:200:240','fresh','select',500)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1500)
 def test_actual_parent_death_up(self):
  self.start('sims-install-death')
  try:
   scene('select')
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','select',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/sims-install-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   p.b.waitfile(c.R/'killed-up.json');p.b.waitfile(c.R/'terminal-input-failure.json');self.assertTrue(c.read('terminal-input-failure.json')['noReplay']);c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True))
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1750)
FIXTURE_SOURCE = r"""
'use strict';
// Generated fixture only. Neither original proprietary image is loaded here.
const fs=require('fs'),path=require('path');
const {makeFixture}=require(process.cwd()+'/tools/kernel32-native-fixture');
const out=process.argv[2],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
const raw=r=>r-0x1000+0x200;
const exe=makeFixture();
exe.fill(0,raw(0x1a02),raw(0x1a02)+17);exe.write('ExitProcess\0',raw(0x1a02));
exe.set([0x6a,0,0xff,0x15,...u32(0x401900)],raw(0x2000));
const dll=makeFixture();dll.writeUInt16LE(0x210e,0x80+22);
dll.fill(0,raw(0x1900),raw(0x1b80));
let at=0x1a00;
for(const [i,name] of ['CreateFileA','ReadFile','CloseHandle'].entries()) {
  dll.writeUInt32LE(at,raw(0x1900+4*i));dll.write(name+'\0',raw(at+2));at+=name.length+3;
}
dll.write('c:\\windows\\system\\bootstrap.dat\0',raw(0x2500));
const code=[0x53,0x56,0x8b,0x5c,0x24,12]; // preserve EBX/ESI, actual incoming HMODULE
for(const arg of [0,0,3,0,1,0x80000000])code.push(0x68,...u32(arg));
code.push(0x8d,0x83,...u32(0x2500),0x50,0xff,0x93,...u32(0x1900),0x89,0xc6,
  0x83,0xf8,0xff,0x74,0);
const failureJump=code.length-1;
code.push(0x6a,0,0x8d,0x83,...u32(0x2604),0x50,0x6a,4,
  0x8d,0x83,...u32(0x2600),0x50,0x56,0xff,0x93,...u32(0x1904),
  0x81,0xbb,...u32(0x2600),...u32(0x314c534c),0x0f,0x94,0xc0,0x0f,0xb6,0xc0,
  0x50,0x56,0xff,0x93,...u32(0x1908),0x58,0x5e,0x5b,0xc2,12,0);
const failure=code.length;code.push(0x31,0xc0,0x5e,0x5b,0xc2,12,0);
code[failureJump]=failure-(failureJump+1);
dll.set(code,raw(0x2000));
fs.writeFileSync(path.join(out,'bootstrap.exe'),exe);
fs.writeFileSync(path.join(out,'bootstrap.dll'),dll);
fs.writeFileSync(path.join(out,'companion-input.dat'),Buffer.from('LSL1'));
console.log(JSON.stringify({fixtureOnly:true,originalExecuted:false,bytes:code.length}));
"""

class Bootstrap(unittest.TestCase):
 """Actual ordinary CLI DllMain file reads; generated inputs, no Sims execution."""
 def bootstrap(self, name, mount, data=b'LSL1'):
  out=p.b.R/('bootstrap-'+name);out.mkdir()
  generator=out/'fixture.cjs'
  generator.write_text(FIXTURE_SOURCE)
  made=subprocess.run(['node',str(generator),str(out)],cwd=ROOT,capture_output=True,timeout=10)
  self.assertEqual(made.returncode,0,made.stderr.decode())
  (out/'companion-input.dat').write_bytes(data)
  args=['node',str(ROOT/'test/run.js'),'--exe='+str(out/'bootstrap.exe'),
   '--dlls='+str(out/'bootstrap.dll'),'--wasm='+str(ROOT/'build/wine-assembly.wasm'),
   '--no-build','--real-ticks','--quiet-api','--quiet-blocks','--max-seconds=12']
  if mount:args.append('--vfs-mount='+str(out/'companion-input.dat')+'=C:\\Windows\\System\\bootstrap.dat')
  p.b.save(out,'recipe.json',dict(args=args,cwd=str(ROOT),seconds=15,watchdogGrace=2))
  child=subprocess.Popen([sys.executable,'-B',str(p.b.SUPERVISOR),'outerwait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  stdout,stderr=child.communicate(timeout=22)
  p.b.save(out,'bootstrap-outer-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=stdout.decode(),stderr=stderr.decode()))
  self.assertEqual(child.returncode,0,stderr.decode())
  waits={n:json.loads((out/n).read_text()) for n in ('native-wait.json','watchdog-wait.json','outer-child-wait.json')}
  self.assertTrue(all(all(v[k] is True for k in ('actualWait','stdoutEOF','stderrEOF')) for v in waits.values()))
  log=(out/'native.stdout.log').read_text()+(out/'native.stderr.log').read_text()
  p.b.save(out,'checks.json',dict(fixtureOnly=True,originalExecuted=False,mount=mount,expectedBytes=data.hex(),nativeExit=waits['native-wait.json']['exit']))
  return waits['native-wait.json']['exit'],log
 def test_explicit_companion_bytes_available_in_dllmain(self):
  rc,log=self.bootstrap('early-explicit',True)
  self.assertEqual(rc,0,log[-4000:]);self.assertNotIn('DLL initializer did not return',log)
 def test_missing_companion_dllmain_failure_stays_failure(self):
  rc,log=self.bootstrap('absent',False)
  self.assertNotEqual(rc,0,log[-4000:])
 def test_wrong_companion_bytes_dllmain_failure_stays_failure(self):
  rc,log=self.bootstrap('wrong-bytes',True,b'BAD!')
  self.assertNotEqual(rc,0,log[-4000:])

if __name__=='__main__':
 cls=Bootstrap if '--bootstrap' in sys.argv else Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())



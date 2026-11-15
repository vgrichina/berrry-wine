"""HTTP and real CLI fault controls; synthetic Solitaire is not JezzBall proof."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('jezzball','tools/jezzball-system-cursor-controller.py');c=a.c
p=load('prod','test/test-controller-production.py')
policy=load('system_policy','test/test-jezzball-system-cursor-controller.py');policy.c=c
def scene(mode='place'):
 c.capture('fresh');rr=c.read('fresh.json')
 c.save('fresh-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic fixture only, no native JezzBall claim',mode=mode,sceneType='board',defaultGame=True,originalRulesUnchanged=True,placementReason='synthetic metadata only',targetKind='active-board',completeBoard='fixture board',rulesEvidence='fixture rules',activeBoard=True,level=1,noWallGrowing=True,visibleOrientation='vertical',personallyChosenOrientation='vertical',orientationEvidence='fixture arrow',areaPercent=0,score=0,lives=2,persistentWalls=0,partitionEvidence='fixture no walls',priorResultReviewed=True,modalVisible=False,pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240])))
 c.save('board-admitted.json',dict(fixture=True))
 policy.Policy.metadata(None,'fresh')
 for suffix in ('-cursor.json','-up.json'):
  path=c.R/('fresh'+suffix);v=c.read(path.name)
  if suffix=='-cursor.json':v.update(at=rr['at'],completedAt=time.time(),nativeOutput=dict(source='host.set_cursor',at=rr['at'],css='ns-resize'))
  else:v['at']=rr['at']-.001
  path.unlink();c.save(path.name,v)
 path=c.R/'fresh-review.json';v=c.read(path.name);v['cursorMetadataSHA256']=hashlib.sha256((c.R/'fresh-cursor.json').read_bytes()).hexdigest();path.unlink();c.save(path.name,v)
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
  self.env=patch.dict(os.environ,JEZZBALL_CONTROL_OUT=str(c.R),JEZZBALL_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+900))
  self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.cursor=patch.object(a,'capture',capture);self.cursor.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{}));self.lease.start();scene()
 def tearDown(self):
  self.lease.stop();self.cursor.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
 def test_single_move_and_prearm(self):
  a.action('one','mousedown:200:240','fresh','place',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None]);self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualBoardChangeClaim'])
 def test_unsupported_right_has_no_effect(self):
  for cmd in ('rightclick:200:240','mousedown:200:240:2','di-mousedown:2'):
   with self.assertRaises(AssertionError):a.action('unsupported',cmd,'fresh','place',400)
  self.assertEqual(self.effects,[])
  self.assertFalse((c.R/'unsupported-intent.json').exists())
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
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/jezzball-system-cursor-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not (c.R/'terminal-input-failure.json').exists() and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])

NATIVE_CURSOR_PROOF="const fs=require('node:fs');\nconst {cursorFixture}=require(ROOT+'/test/helpers/ne-native-cursor-image');\nconst {createHostImports}=require(ROOT+'/lib/host-imports');\nconst moduleBytes=fs.readFileSync(ROOT+'/build/wine-assembly.wasm');\nglobalThis.nativeSystemCursorProof=(renderer,id)=>{\n const fixture=cursorFixture(),b=fixture.b;\n // Keep two original native loads and the first native SetCursor; end there.\n const third=b.readUInt16LE(0x1202+8*2+2);\n b[0x200+third+4+3]=0xeb;b[0x200+third+4+4]=0xfe;\n for(let p=0x200;p<0x200+third;p++)if(b[p]===0x68&&b.readUInt16LE(p+1)===0x7f84)b.writeUInt16LE(id,p+1);\n const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});\n const ctx={getMemory:()=>memory.buffer,renderer,resourceJson:{}};\n const imports=createHostImports(ctx);imports.host.memory=memory;\n const e=new WebAssembly.Instance(new WebAssembly.Module(moduleBytes),imports).exports;\n ctx.instance={exports:e};ctx.wasmMemory=memory;ctx.exports=e;\n new Uint8Array(memory.buffer).set(b,e.get_staging());if(!e.load_ne(b.length))throw Error('native fixture load');\n e.run(1000);\n return {css:renderer.canvas.style.cursor,nativeImportedSystemID:id,fixtureOnly:true};\n};\n"

class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'jezzball-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(process.env.TICTACTICS_TEST_FAULT!=='drop'||command.cmd!=='mousedown:200:240')return pending;const injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':
    cursor=out/'native-cursor-display.cjs';a.prepare_cursor(cursor)
    native=out/'native-system-cursor-proof.cjs'
    native.write_text('const ROOT='+json.dumps(str(ROOT))+';\n'+NATIVE_CURSOR_PROOF)
    value={**value,'seconds':240,'args':[value['args'][0],'--require',str(cursor),'--require',str(native),'--require',str(fixture),*value['args'][1:]],'env':{'TICTACTICS_TEST_FAULT':'drop' if name=='jezzball-unknown' else 'none'}}
   return save(out,key,value)
  original=c.bind
  def bind():
   os.environ['JEZZBALL_CONTROL_OUT']=str(c.R);os.environ['JEZZBALL_CONTROL_URL']=c.URL
   c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseDown','DOWN'],['handleMouseUp','UP']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};true"""))
   c.capture('submitted');rr=c.read('submitted.json')
   c.save('submitted-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Solitaire fixture canvas; no JezzBall claim',sceneType='bootstrap'))
   with patch.object(c,'bind',original):a.bind('submitted')
  with patch.object(c,'bind',bind),patch.object(p.b,'save',recipe):super().start(name)
  os.environ['JEZZBALL_CONTROL_OUT']=str(c.R);os.environ['JEZZBALL_CONTROL_URL']=c.URL
 def test_actual_single_pointer(self):
  self.start('jezzball-move')
  try:scene();a.action('one','mousedown:200:240','fresh','place',400)
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
 def test_actual_pointer_click_up(self):
  self.start('jezzball-stock')
  try:scene('place');a.action('pause','mousedown:200:240','fresh','place',400)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertEqual(d['args'][:2],[200,240]);self.assertLess(u['at']-d['at'],1500)
 def test_actual_late_ack_closes(self):
  self.start('jezzball-late');real=c.call
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
  self.start('jezzball-unknown')
  try:
   scene()
   with self.assertRaises(Exception):a.action('lost','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   nonce=c.read('lost-intent.json')['nonce']
   self.assertEqual(c.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN' and e['args'][:2]==[200,240]]),1)
 def test_actual_release_child_death_before_down(self):
  self.start('jezzball-child-death');real=subprocess.Popen
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
  self.start('jezzball-cancel')
  try:
   scene();c.call(dict(action='frozen',mode='on'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('cancel','mousedown:200:240','fresh','place',400)
   c.call(dict(action='frozen',mode='off'));self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' and e['args'][:2]==[200,240] for e in summary['effects']))
 def test_actual_window_identity_closes(self):
  self.start('jezzball-identity')
  try:
   scene();c.call(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('changed','mousedown:200:240','fresh','place',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_silent_parent_fallback(self):
  self.start('jezzball-fallback')
  try:
   owner=c.read('input-owner.json');at=time.time()
   plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.500,nonce='fallback-one',milliseconds=400,final=False)
   c.save('fallback-intent.json',plan)
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/jezzball-system-cursor-controller.py'),'release','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='mousedown:200:240',guard={**owner,'nonce':plan['nonce'],'reviewed':True,'deadline':int((at+2)*1000)}));self.assertTrue(receipt['consumed'])
   child.wait(timeout=3);out,err=child.communicate()
   c.save('fallback-actual-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(child.returncode,0);self.assertEqual(c.read('fallback-up.json')['reason'],'fallback');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP')
  self.assertGreater(u['at']-d['at'],1500);self.assertLess(u['at']-d['at'],1800)
 def test_actual_no_capture_while_held(self):
  self.start('jezzball-capture-order');real=c.capture
  def capture(name):
   if name=='pause':self.assertEqual(c.read('pause-up.json')['state'],'ACK')
   return real(name)
  try:
   scene('place')
   with patch.object(c,'capture',capture):a.action('pause','mousedown:200:240','fresh','place',500)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1500)
 def test_actual_parent_death_up(self):
  self.start('jezzball-death')
  try:
   scene('place')
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','place',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/jezzball-system-cursor-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   p.b.waitfile(c.R/'killed-up.json');p.b.waitfile(c.R/'terminal-input-failure.json');self.assertTrue(c.read('terminal-input-failure.json')['noReplay']);c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True))
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1750)
 def test_actual_native_system_cursor_output(self):
  self.start('jezzball-native-system-cursor')
  try:
   outputs=[]
   for css,system_id in [('ew-resize',0x7f84),('ns-resize',0x7f85)]:
    observed=c.call(dict(action='eval',code=f'globalThis.nativeSystemCursorProof(renderer,{system_id})'))
    self.assertEqual(observed['css'],css)
    a.capture('native'+css.replace('-',''))
    record=c.read('native'+css.replace('-','')+'-cursor.json')
    self.assertEqual(record['css'],css);self.assertFalse(record['pointerImageCaptured'])
    self.assertEqual(record['nativeOutput']['css'],css);self.assertEqual(record['nativeOutput']['source'],'host.set_cursor')
    outputs.append(observed)
   c.save('native-system-cursor-output.json',dict(actualNativeImportedFarCalls=True,fixtureOnly=True,originalGameProgress=False,outputs=outputs))
  finally:self.finish()
 def test_actual_hover_has_no_down(self):
  self.start('jezzball-hover')
  try:
   scene('hover');r=c.read('fresh-review.json')
   (c.R/'fresh-review.json').unlink()
   c.save('fresh-review.json',dict(**r,hoverReason='synthetic native pointer semantics'))
   a.action('hover','mousemove:200:240','fresh','hover',120)
   self.assertTrue(c.read('hover-receipt.json')['consumed'])
   self.assertEqual(c.read('hover-up.json')['state'],'ACK')
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='DOWN' for e in summary['effects']))
if __name__=='__main__':
 cls=Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())




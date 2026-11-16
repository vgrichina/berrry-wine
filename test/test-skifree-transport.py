"""HTTP and real CLI fault controls; synthetic Solitaire is not SkiFree proof."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
a=load('ski','tools/skifree-controller.py');c=a.c
p=load('prod','test/test-controller-production.py')
def scene(mode='steer'):
 c.capture('fresh');rr=c.read('fresh.json')
 c.save('fresh-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic fixture only, no native SkiFree claim',mode=mode,sceneType='slope',defaultCourse=True,skierVisible=True,underlyingSceneVisible=True,directionIntent='fixture left',obstacleReason='fixture only',nativePauseChoice='fixture ordinary pause',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[200,240],insideSkiClient=True)))
 c.save('course-admitted.json',dict(fixture=True))
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
     if test.fault=='late':time.sleep(.35)
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
  a.action('one','mousemove:200:240','fresh','steer',400)
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousemove:200:240',None]);self.assertTrue(c.read('one-release-wait.json')['stdoutEOF']);self.assertFalse(c.read('one-completed.json')['actualDirectionClaim'])
 def test_unknown_cancel_identity_close(self):
  self.fault='unknown'
  with self.assertRaises(AssertionError):a.action('bad','mousemove:200:240','fresh','steer',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_cancel_closes(self):
  self.fault='cancel'
  with self.assertRaises(AssertionError):a.action('bad','mousemove:200:240','fresh','steer',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_identity_closes(self):
  self.fault='identity'
  with self.assertRaises(AssertionError):a.action('bad','mousemove:200:240','fresh','steer',400)
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
 def test_late_ack_closes(self):
  self.fault='late'
  with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousemove:200:240','fresh','steer',200)
  self.assertLess(self.effects[-1]['at']-self.effects[0]['at'],.6)
 def test_audit_after_up(self):
  real=c.save;times=[]
  def slow(name,v):
   if name=='one-receipt.json':times.append(time.time());time.sleep(.3)
   return real(name,v)
  with patch.object(c,'save',slow):a.action('one','mousemove:200:240','fresh','steer',400)
  self.assertGreater(times[0],self.effects[-1]['at'])
 def test_child_death_before_down(self):
  real=subprocess.Popen
  def died(*args,**kw):
   child=real(*args,**kw);child.kill();child.wait();return child
  with patch.object(subprocess,'Popen',died):
   with self.assertRaises(Exception):a.action('dead','mousemove:200:240','fresh','steer',400)
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
a.c.call=killed;a.action('killed','mousemove:200:240','fresh','steer',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/skifree-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not (c.R/'killed-up.json').exists() and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])

class Production(p.Production):
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  original=c.bind
  def bind():
   c.call(dict(action='eval',code="""const m=renderer.handleMouseMove;renderer.handleMouseMove=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind:'MOVE',at:Date.now(),args});return r};true"""));original()
  with patch.object(c,'bind',bind):super().start(name)
  launch=c.read('launch.json');(c.R/'launch.json').unlink();c.save('launch.json',{**launch,'deadline':launch['at']+900})
 def test_actual_single_pointer(self):
  self.start('ski-move')
  try:scene();a.action('one','mousemove:200:240','fresh','steer',400)
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='MOVE' and e['args'][:2]==[200,240]]),1)
 def test_actual_f3_up(self):
  self.start('ski-f3')
  try:scene('pause');a.action('pause','keydown:114','fresh','pause',400)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertEqual(d['key'],114);self.assertLess(u['at']-d['at'],1500)
 def test_actual_late_ack_closes(self):
  self.start('ski-late');real=c.call
  def late(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('mousemove'):time.sleep(.45)
   return r
  try:
   scene()
   with patch.object(c,'call',late):
    with self.assertRaisesRegex(AssertionError,'late ACK'):a.action('late','mousemove:200:240','fresh','steer',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_unknown_after_consumption(self):
  self.start('ski-unknown');real=c.call
  def lost(v,timeout=10):
   r=real(v,timeout)
   if v.get('cmd','').startswith('mousemove'):raise TimeoutError('fixture dropped ACK')
   return r
  try:
   scene()
   with patch.object(c,'call',lost):
    with self.assertRaises(TimeoutError):a.action('lost','mousemove:200:240','fresh','steer',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertEqual(len([e for e in summary['effects'] if e['kind']=='MOVE' and e['args'][:2]==[200,240]]),1)
 def test_actual_cancel_closes(self):
  self.start('ski-cancel')
  try:
   scene();c.call(dict(action='frozen',mode='on'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('cancel','mousemove:200:240','fresh','steer',400)
   c.call(dict(action='frozen',mode='off'));self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  self.assertFalse(any(e['kind']=='MOVE' and e['args'][:2]==[200,240] for e in summary['effects']))
 def test_actual_window_identity_closes(self):
  self.start('ski-identity')
  try:
   scene();c.call(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
   with self.assertRaisesRegex(AssertionError,'input unresolved'):a.action('changed','mousemove:200:240','fresh','steer',400)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()
 def test_actual_silent_parent_fallback(self):
  self.start('ski-fallback')
  try:
   owner=c.read('input-owner.json');at=time.time()
   plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.500,nonce='fallback-one',milliseconds=400,final=False)
   c.save('fallback-intent.json',plan)
   child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/skifree-controller.py'),'release','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='keydown:114',guard={**owner,'nonce':plan['nonce'],'reviewed':True,'deadline':int((at+2)*1000)}));self.assertTrue(receipt['consumed'])
   child.wait(timeout=3);out,err=child.communicate()
   c.save('fallback-actual-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(child.returncode,0);self.assertEqual(c.read('fallback-up.json')['reason'],'fallback');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP')
  self.assertGreater(u['at']-d['at'],1500);self.assertLess(u['at']-d['at'],1800)
 def test_actual_no_capture_while_held(self):
  self.start('ski-capture-order');real=c.capture
  def capture(name):
   if name=='pause':self.assertEqual(c.read('pause-up.json')['state'],'ACK')
   return real(name)
  try:
   scene('pause')
   with patch.object(c,'capture',capture):a.action('pause','keydown:114','fresh','pause',500)
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1500)
 def test_actual_parent_death_up(self):
  self.start('ski-death')
  try:
   scene('pause')
   code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('keydown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','keydown:114','fresh','pause',400)
"""
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/skifree-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   p.b.waitfile(c.R/'killed-up.json');self.assertTrue(c.read('terminal-input-failure.json')['noReplay']);c.save('orphan-child-wait-unknown.json',dict(actualWait=False,parentKilled=True))
  finally:summary=self.finish()
  d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP');self.assertLess(u['at']-d['at'],1750)
if __name__=='__main__':
 cls=Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())

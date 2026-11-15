"""Synthetic HTTP and real CLI controls. No original Klotski evidence."""
import importlib.util,pathlib,tempfile,unittest,time,os,json,threading,subprocess,sys,hashlib,signal
from unittest.mock import patch
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parents[1]

def subreaper():
 # This test process owns these descendants. Reap an independent UP child
 # even when its immediate parent is deliberately killed by the control.
 import ctypes
 assert ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)==0

def reap_release(name):
 up=c.read(name+'-up.json');pid=up['releasePID'];end=time.monotonic()+5
 while True:
  found,status=os.waitpid(pid,os.WNOHANG)
  if found:break
  assert time.monotonic()<end,'independent release child wait deadline';time.sleep(.01)
 c.save(name+'-orphan-release-wait.json',dict(pid=pid,startToken=up['releaseStartToken'],
  exit=os.waitstatus_to_exitcode(status),actualWait=True,stdoutEOF=True,stderrEOF=True,
  pipesSharedWithKilledParent=True,at=time.time()))
 assert os.waitstatus_to_exitcode(status)==0


def native_modal_fixture(directory,repeat=False,bootstrap=False):
 """Small genuine NE program: STATIC parent, EDIT child, USER.1 MessageBox.

 The guest calls ordinary imported USER APIs. No engine patch, board state,
 test-only WASM export, or original game media is involved.
 """
 target=directory/'modal-user-fixture.exe'
 script=r"""
const fs=require('node:fs'),assert=require('node:assert/strict');
const {neLifecycleImage}=require('./test/helpers/ne-lifecycle-image');
const b=Buffer.alloc(0x1c00),n=0x80;neLifecycleImage().copy(b,0,0,0x200);
const word=(p,v)=>b.writeUInt16LE(v,p);
word(n+12,1);word(n+0x12,0x100);word(n+0x18,0xff00);word(n+0x1a,2);
word(n+0x1e,1);word(n+0x42,0x1000);word(n+0x44,0x100);word(n+0x46,0x1000);
word(n+0x48,0x180);word(n+0x4a,0x400);word(n+0x4e,0);
word(n+0x90,0);b[n+0xb0]=4;b.write('USER',n+0xb1);
const c=[],labels={},patches=[],relocs=[];
const emit=(...x)=>c.push(...x),w=x=>emit(x&255,x>>>8&255),push=x=>{emit(0x68);w(x);};
const label=n=>labels[n]=c.length;
const ptr=n=>{emit(0x0e,0x68);patches.push({at:c.length,n});w(0);};
const api=ordinal=>{emit(0x9a);const at=c.length;w(0xffff);w(0);relocs.push({at,ordinal});};
const from=o=>{emit(0xff,0x36);w(o);};
const store=o=>{emit(0xa3);w(o);};
const dword=x=>{push(x>>>16);push(x&65535);};
const msg=()=>{emit(0x1e);push(0x40);};
if(process.argv[3]==='bootstrap'){push(0);ptr('message');ptr('caption');push(0);api(1);}
ptr('static');ptr('parentTitle');dword(0x10cf0000);push(20);push(20);push(400);push(280);
push(0);push(0);emit(0x57);dword(0);api(41);store(0);
ptr('edit');ptr('contents');dword(0x50800000);push(10);push(10);push(250);push(70);
from(0);push(11);emit(0x57);dword(0);api(41);store(2);
from(0);api(124);
from(0);ptr('message');ptr('caption');push(0);api(1);store(4);
if(process.argv[2]==='repeat'){from(0);ptr('message');ptr('caption');push(0);api(1);store(4);}
label('pump');msg();push(0);push(0);push(0);api(108);
msg();api(113);msg();api(114);
emit(0xe9);const back=c.length;w(labels.pump-back-2);
for(const [name,text] of Object.entries({static:'STATIC',parentTitle:'Modal USER fixture',edit:'EDIT',contents:'abcdefghijklmnop',message:'Ordinary Win16 startup. No physical gesture.',caption:'Native Win16 MessageBox'})){
 label(name);emit(...Buffer.from(text+'\0'));
}
for(const q of patches){assert.notEqual(labels[q.n],undefined);c[q.at]=labels[q.n]&255;c[q.at+1]=labels[q.n]>>>8;}
assert(c.length<0x1000);b.set(c,0x200);word(0x1200,relocs.length);
relocs.forEach((r,i)=>{const p=0x1202+i*8;b[p]=3;b[p+1]=1;word(p+2,r.at);word(p+4,1);word(p+6,r.ordinal);});
fs.writeFileSync(process.argv[1],b);
"""
 subprocess.run(['node','-e',script,str(target),'repeat' if repeat else 'single','bootstrap' if bootstrap else 'parent'],cwd=ROOT,check=True,capture_output=True)
 return target

def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
policy=load('policy','test/test-klotski-modal-controller.py');a=policy.a;c=a.c

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
  self.env=patch.dict(os.environ,KLOTSKI_MODAL_CONTROL_OUT=str(c.R),KLOTSKI_MODAL_CONTROL_URL=c.URL);self.env.start()
  c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+1200));self.owner=dict(owner='owner',epoch=1)
  def capture(name):
   (c.R/(name+'.png')).write_bytes(b'fixture');c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),nativePublic=policy.public_fixture(),snapshot=dict(mainHwnd='0x1',focus='0x2',eip='0x2',screen=dict(w=800,h=600))))
   return str(c.R/(name+'.png'))
  self.cap=patch.object(c,'capture',capture);self.cap.start();self.lease=patch.object(c,'lease',return_value=(self.owner,{'focus':'0x2','nativePublic':policy.public_fixture()}));self.lease.start();scene()
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
  subreaper()
  code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
a.c.lease=lambda:({'owner':'owner','epoch':1},{'focus':'0x2','nativePublic':a.c.read('fresh.json')['nativePublic']})
real=a.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return r
a.c.call=killed;a.action('killed','mousedown:200:240','fresh','move',400)
"""
  child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/klotski-modal-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
  end=time.time()+2
  while not all((c.R/n).exists() for n in ('killed-up.json','terminal-input-failure.json')) and time.time()<end:time.sleep(.01)
  self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousemove:200:240','mousedown:200:240',None])
  reap_release('killed')

os.environ.setdefault('FORSAKEN_TEST_OUT',str(ROOT/'scratch/runs/20261115-klotski-modal-bootstrap/native-controls'))
p=load('prod','test/test-controller-production.py')
class Production(p.Production):
 def finish(self):
  # Retain only named result captures, never a fixture frame series.
  selected={image:image.read_bytes() for name in ('baseline.png','after-up.png','normal-parent.png')
            if (image:=c.R/name).exists()}
  result=super().finish()
  for image,data in selected.items():image.write_bytes(data)
  return result
 def start(self,name):
  p.c=c;p.p.c=c;p.b.control=c
  fixture=p.b.R/'klotski-drop-ack.cjs'
  if not fixture.exists():
   fixture.write_text("const transport=require("+json.dumps(str(ROOT/'lib/control-server'))+");const original=transport.startControlServer;transport.startControlServer=options=>original({...options,onCommand(command){const pending=options.onCommand(command);if(!command.cmd?.startsWith('mousedown:'))return pending;const fault=process.env.KLOTSKI_TEST_FAULT;let injected;if(fault==='drop')injected=Promise.resolve(pending).then(()=>new Promise(()=>{}));else if(fault==='mixed')injected=Promise.resolve(pending).then(r=>({...r,state:'CANCELLED',consumed:true}));else return pending;if(pending?.cancel)injected.cancel=pending.cancel.bind(pending);return injected}});\n")
  save=p.b.save
  def recipe(out,key,value):
   if key=='recipe.json':
    app='--exe='+str(native_modal_fixture(out,getattr(self,'repeatModal',False),getattr(self,'bootstrap',False))) if getattr(self,'modal',False) else '--app=notepad'
    value={**value,'seconds':240,'args':[value['args'][0],'--require',str(fixture),*[arg.replace('--app=sol',app) for arg in value['args'][1:]],'--trace-input-dispatch'],'env':{'KLOTSKI_TEST_FAULT':{'klotski-unknown':'drop','klotski-mixed':'mixed'}.get(name,'none')}}
   return save(out,key,value)
  original=c.bind
  def bind():
   c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseMove','MOVE'],['handleMouseDown','DOWN'],['handleMouseUp','UP']]){const m=renderer[method];renderer[method]=function(...args){const r=m.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return r}};const take=renderer.checkInput;renderer.checkInput=function(...args){const r=take.apply(this,args);if(r)persistenceEffects.push({kind:'DEQUEUE',at:Date.now(),event:{msg:r.msg,hwnd:r.hwnd,key:r.wParam,x:r.mouseX,y:r.mouseY}});return r};true"""))
   c.call(dict(action='eval',code="let previous=-1;const observe=setInterval(()=>{const hwnd=instance.exports.get_capture_hwnd();if(hwnd!==previous){persistenceEffects.push({kind:'CAPTURE',at:Date.now(),hwnd});previous=hwnd}},5);observe.unref();true"))
   if getattr(self,'modal',False):return
   c.capture('submitted');rr=c.read('submitted.json')
   c.save('submitted-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Synthetic Notepad fixture only',registeredOriginal=True,defaultFirstPuzzleOnly=True,completeBootstrapReviewed=True,sceneType='bootstrap',bootstrapState='Synthetic fixture ready; no original puzzle selected'))
   with patch.object(c,'bind',original):a.bind('submitted')
  try:
   with patch.object(c,'bind',bind),patch.object(p.b,'save',recipe):
    # The bootstrap fixture may have a modal before any application main
    # window exists. Readiness must preserve that observed state for testing.
    if getattr(self,'modal',False):
     import socket
     out=p.b.R/('actual-cli-'+name);out.mkdir();self.out=out
     with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
     args=['node','test/run.js','--app=sol','--no-build','--real-ticks','--screen=800x600','--max-seconds=40','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
     p.b.save(out,'recipe.json',dict(args=args,cwd=str(ROOT),seconds=42,watchdogGrace=2))
     self.p=subprocess.Popen([sys.executable,'-B',str(p.b.SUPERVISOR),'outerwait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
     p.b.waitfile(out/'native-pid.json');p.b.waitfile(out/'launch.json')
     c.R=out;c.URL='http://127.0.0.1:'+str(port)+'/ctl'
     end=time.monotonic()+15
     while True:
      try:
       snap=c.call(dict(action='snapshot'),timeout=1)
       visible=c.call(dict(action='eval',code='Object.values(renderer.windows).some(w=>w.visible&&!w.isChild)'),timeout=1)
       if snap['eip']!='0x0' and visible:break
      except Exception:pass
      assert time.monotonic()<end,'actual modal fixture readiness';time.sleep(.03)
     c.call(dict(action='eval',code='globalThis.persistenceEffects=[];true'));c.bind()
    else:super().start(name)
  except BaseException:
   if hasattr(self,'p'):
    try:c.call(dict(action='quit'),timeout=1)
    except Exception:
     if hasattr(self,'out') and not (self.out/'cancel-request.json').exists():p.b.save(self.out,'cancel-request.json',dict(fixtureBootstrapFailed=True))
    out,err=self.p.communicate(timeout=12)
    p.b.save(self.out,'bootstrap-failure-outer-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   raise
  os.environ['KLOTSKI_MODAL_CONTROL_OUT']=str(c.R);os.environ['KLOTSKI_MODAL_CONTROL_URL']=c.URL
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
 def test_actual_mixed_receipt_no_replay(self):
  self.start('klotski-mixed')
  try:
   point=self.fixture_scene()
   with self.assertRaises(AssertionError):a.action('mixed','mousedown:'+':'.join(map(str,point)),'fresh','move',400)
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
  subreaper()
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
   child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/klotski-modal-controller.py'),'mousedown:'+':'.join(map(str,point))],stdout=subprocess.PIPE,stderr=subprocess.PIPE);out,err=child.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()));self.assertEqual(child.returncode,-9)
   up=p.b.waitfile(c.R/'killed-up.json');p.b.waitfile(c.R/'terminal-input-failure.json')
   reap_release('killed')
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

class ModalProduction(Production):
 def start(self,name):
  self.modal=True;super().start(name)
  end=time.monotonic()+10
  while True:
   public=c.call(dict(action='eval',code=a.PUBLIC_WINDOW_OBSERVATION))
   if public['modal']['hwnd']:break
   assert time.monotonic()<end,'native MessageBox did not open';time.sleep(.02)
  c.save('modal-startup-public.json',dict(at=time.time(),target=c.read('native-pid.json'),value=public))
 def fixture_scene(self,name,point):
  # Qualification-only bypass of the predicate under test, for a generated
  # synthetic NE program. Public observations precede the PNG. Never original.
  snap=c.observation(name+'-fixture-snapshot.json',dict(action='snapshot'))
  public=c.observation(name+'-fixture-public.json',dict(action='eval',code=a.PUBLIC_WINDOW_OBSERVATION))
  target=c.R/(name+'.png');c.call(dict(cmd='png:'+str(target)))
  c.save(name+'.json',dict(at=time.time(),snapshot=snap,nativePublic=public,target=c.read('native-pid.json'),pngSHA256=hashlib.sha256(target.read_bytes()).hexdigest(),fixtureOnly=True))
  meta=policy.metadata(c.read('native-pid.json'),'menu')
  meta.update(sceneType='bootstrap',menuRoute='dismiss-menu',visibleLabel='synthetic modal fixture target')
  meta['pixelGeometry']['chosenPoint']=point
  c.save(name+'-review.json',dict(at=time.time(),pngSHA256=c.read(name+'.json')['pngSHA256'],**meta))
 def button_point(self):
  return c.call(dict(action='eval',code="""(()=>{const e=instance.exports,m=e.modal_dialog_hwnd();
   const buttons=[];let s=0;while((s=e.wnd_next_child_slot(m,s))!==-1){const h=e.wnd_slot_hwnd(s++);if(e.ctrl_get_id(h)===1)buttons.push(h);}
   if(buttons.length!==1)throw Error('one native modal IDOK required');const h=buttons[0];
   return [e.wnd_client_screen_x(h)+Math.floor((e.get_client_rect_r(h)-e.get_client_rect_l(h))/2),
     e.wnd_client_screen_y(h)+Math.floor((e.get_client_rect_b(h)-e.get_client_rect_t(h))/2)];})()"""))
 def pulse(self,name,point):
  self.fixture_scene(name+'-scene',point)
  return a.action(name,'mousedown:'+':'.join(map(str,point)),name+'-scene','menu',400,'dismiss-menu')
 def test_actual_modal_baseline_operand_qualification(self):
  self.start('modal-baseline')
  try:
   public=c.read('modal-startup-public.json')['value']
   c.save('baseline-predicates.json',dict(mainEquality=public['hwnd']==c.call(dict(action='snapshot'))['mainHwnd'],zeroCapture=public['captureHwnd']==0,physicalHeld=False,reason='no fixture pointer or key events have been sent'))
   c.capture('baseline')
  finally:self.finish()
 def test_actual_unowned_bootstrap_baseline_operands(self):
  self.bootstrap=True;self.start('modal-bootstrap-baseline')
  try:
   public=c.read('modal-startup-public.json')['value'];snap=c.observation('bootstrap-snapshot.json',dict(action='snapshot'))
   c.save('baseline-predicates.json',dict(mainEquality=public['hwnd']==snap['mainHwnd'],zeroCapture=public['captureHwnd']==0,physicalHeld=False,reason='no fixture input has been sent'))
   c.capture('baseline')
  finally:self.finish()
 def test_actual_modal_physical_hold_and_post_up_operands(self):
  self.start('modal-held');held=[];real=c.call
  try:
   c.bind()
   point=c.call(dict(action='eval',code='(()=>{const e=instance.exports,h=e.modal_dialog_hwnd();return [e.wnd_client_screen_x(h)+8,e.wnd_client_screen_y(h)+8]})()'))
   def sample(v,timeout=10):
    r=real(v,timeout)
    if v.get('cmd','').startswith('mousedown'):
     held.append(dict(at=time.time(),value=real(dict(action='eval',code=a.PUBLIC_WINDOW_OBSERVATION))))
    return r
   with patch.object(c,'call',sample):self.pulse('held',point)
   c.save('held-public.json',dict(samples=held,savedAfterUPAt=time.time(),physicalGestureFixtureOnly=True))
   self.assertTrue(any(v['state']&0x8000 for v in held[0]['value']['physicalButtons']))
   public=c.observation('post-up-public.json',dict(action='eval',code=a.PUBLIC_WINDOW_OBSERVATION))
   self.assertTrue(all(v['state']==0 for v in public['physicalButtons']))
   self.assertEqual(public['captureHwnd'],0)
   with self.assertRaisesRegex(AssertionError,'PUBLIC_PHYSICAL_BUTTON_HELD'):a.physical_up(held[0]['value'])
   a.physical_up(public)
   c.capture('after-up')
  finally:self.finish()
 def test_actual_outside_modal_refused_before_input(self):
  self.start('modal-outside')
  try:
   c.bind()
   with self.assertRaisesRegex(AssertionError,'PUBLIC_OUTSIDE_MODAL_INPUT'):self.pulse('outside',[1,1])
   self.assertFalse((c.R/'outside-intent.json').exists())
  finally:effects=self.finish()['effects']
  self.assertFalse(any(v['kind']=='DOWN' for v in effects))
 def test_actual_replaced_modal_lifetime_refused(self):
  self.repeatModal=True;self.start('modal-replacement')
  try:
   c.bind();old=c.read('modal-startup-public.json')['value'];w=next(w for w in old['windows'] if w['hwnd']==old['modal']['hwnd'])
   point=[w['x']+10,w['y']+30];self.fixture_scene('stale',point)
   self.pulse('dismiss',self.button_point())
   current=c.observation('replacement-public.json',dict(action='eval',code=a.PUBLIC_WINDOW_OBSERVATION))
   self.assertNotEqual(current['modal'],old['modal'])
   self.assertNotEqual(current['modal']['hwnd'],0)
   with self.assertRaisesRegex(AssertionError,'PUBLIC_MODAL_LIFETIME_CHANGED'):
    a.action('stale-choice','mousedown:'+':'.join(map(str,point)),'stale','menu',400,'dismiss-menu')
   self.assertFalse((c.R/'stale-choice-intent.json').exists())
  finally:effects=self.finish()['effects']
  self.assertEqual(len([v for v in effects if v['kind']=='DOWN']),1)
 def test_actual_stale_transport_owner_no_pointer(self):
  self.start('modal-stale-owner')
  try:
   c.bind();old=c.read('input-owner.json');replacement=c.call(dict(action='guarded-bind'))
   c.save('replaced-guard-owner.json',dict(old=old,replacement=replacement,at=time.time()))
   public=c.read('modal-startup-public.json')['value'];w=next(w for w in public['windows'] if w['hwnd']==public['modal']['hwnd'])
   with self.assertRaises(Exception):self.pulse('stale-owner',[w['x']+10,w['y']+30])
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:effects=self.finish()['effects']
  self.assertFalse(any(v['kind']=='DOWN' for v in effects))
 def test_actual_unresolved_own_gesture_no_capture(self):
  self.start('modal-unresolved')
  try:
   c.save('unresolved-intent.json',dict(name='unresolved',gestureDeadline=time.time()+1))
   with self.assertRaisesRegex(AssertionError,'no capture while gesture unresolved'):c.capture('refused')
   self.assertFalse((c.R/'refused.png').exists())
   self.assertFalse((c.R/'refused-snapshot-observation.json').exists())
  finally:self.finish()
 def test_actual_normal_win16_parent_child_drag_after_modal(self):
  self.start('modal-normal-parent')
  try:
   c.bind();self.pulse('dismiss',self.button_point())
   c.capture('normal-parent');public=c.read('normal-parent.json')['nativePublic']
   self.assertEqual(public['modal']['hwnd'],0)
   child=next(w for w in public['windows'] if w['isChild']);self.assertEqual(child['identity']['parent'],public['main']['hwnd'])
   point=Production.fixture_scene(self)
   selection=lambda:c.call(dict(action='eval',code='instance.exports.send_message(instance.exports.get_focus_hwnd(),0xB0,0,0)>>>0'))
   before=selection();a.action('drag','mousedown:'+':'.join(map(str,point)),'fresh','move',500);after=selection()
   c.save('native-selection.json',dict(before=before,after=after,fixtureOnly=True))
   self.assertNotEqual(before,after);c.capture('after-up')
   self.assertEqual(c.read('after-up.json')['nativePublic']['captureHwnd'],0)
  finally:self.finish()

if __name__=='__main__':
 cls=ModalProduction if '--modal-production' in sys.argv else Production if '--production' in sys.argv else HTTP
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in cls.__dict__ if n.startswith('test_'))).wasSuccessful())

"""Finite admission against real native USER/input and an independent UP child.

Solitaire is an authored fixture for this controller test, never an original
LMarbles attempt. Faults affect only this fixture's transport or guard envelope.
Requires an owned sealed module/source holder, not shared build outputs.
"""
import importlib.util,json,os,pathlib,socket,subprocess,sys,time,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('controller',ROOT/'tools/lmarbles-controller.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
OUT=pathlib.Path(os.environ['LMARBLES_ADMISSION_TEST_OUT']).resolve()

# Instrument the actual production HTTP entry, preserving the native renderer,
# real guarded consumption and child process release. No original game loaded.
BOOT=r"""
const fs=require('fs'),transport=require('./lib/control-server');
const original=transport.startControlServer;
transport.startControlServer=options=>original({...options,onCommand(command){
 fs.appendFileSync(process.env.LMARBLES_REQUEST_LOG,JSON.stringify({at:Date.now(),command})+'\n');
 if(command.action==='guarded-input' && process.env.LMARBLES_FAULT==='stale-consumption')
  return new Promise(resolve=>setTimeout(()=>resolve(options.onCommand(command)),Math.max(0,command.guard.deadline-Date.now()+20)));
 if(command.action==='guarded-bind' && process.env.LMARBLES_FAULT==='cross-expiry')
  options.onCommand({action:'eval',code:`(()=>{const old=renderer.handleKeyDown;
   renderer.handleKeyDown=function(k){const value=old.call(this,k);while(Date.now()<globalThis.crossExpiryDeadline){};return value};return true})()`});
 if(command.action==='guarded-input' && process.env.LMARBLES_FAULT==='cross-expiry')
  options.onCommand({action:'eval',code:`globalThis.crossExpiryDeadline=${command.guard.deadline+20}`});
 if(command.action==='guarded-input') {
  if(process.env.LMARBLES_FAULT==='focus') {
   const fault=options.onCommand({action:'eval',code:'({before:exports.get_focus_hwnd(),after:(exports.set_focus(0),exports.get_focus_hwnd())})'});
   fs.appendFileSync(process.env.LMARBLES_REQUEST_LOG,JSON.stringify({fault:'native-focus',value:fault})+'\n');
  }
  if(process.env.LMARBLES_FAULT==='owner') {
   const fault=options.onCommand({action:'eval',code:'(()=>{const h=exports.get_main_hwnd(),old=renderer.windows[h];renderer.windows[h]={...old};return {hwnd:h,ownerWindowReplaced:old!==renderer.windows[h]}})()'});
   fs.appendFileSync(process.env.LMARBLES_REQUEST_LOG,JSON.stringify({fault:'native-owner-window',value:fault})+'\n');
  }
 }
 const pending=options.onCommand(command);
 if(command.action==='guarded-input')Promise.resolve(pending).then(receipt=>
   fs.appendFileSync(process.env.LMARBLES_REQUEST_LOG,JSON.stringify({at:Date.now(),receipt})+'\n'),()=>{});
 if(command.action==='guarded-release' && process.env.LMARBLES_FAULT==='slow-up')
  return Promise.resolve(pending).then(v=>new Promise(resolve=>setTimeout(()=>resolve(v),650)));
 if(command.action==='guarded-input' && process.env.LMARBLES_FAULT==='late-up')
  setTimeout(()=>{
   const start=Date.now(),end=start+500;
   fs.appendFileSync(process.env.LMARBLES_REQUEST_LOG,JSON.stringify({fault:'native-event-loop-stall',start,end})+'\n');
   while(Date.now()<end){}
  },1400);
 if(command.action!=='guarded-input')return pending;
 if(process.env.LMARBLES_FAULT==='slow-ack') {
  const delayed=Promise.resolve(pending).then(v=>new Promise(resolve=>setTimeout(()=>resolve(v),650)));
  if(pending?.cancel)delayed.cancel=pending.cancel.bind(pending);return delayed;
 }
 if(process.env.LMARBLES_FAULT==='unknown') {
  const dropped=new Promise(()=>{});if(pending?.cancel)dropped.cancel=pending.cancel.bind(pending);return dropped;
 }
 return pending;
}});
process.argv=['node','test/run.js',...process.argv.slice(1)];require('./test/run.js');
"""

class Admission(unittest.TestCase):
 def start(self,name,fault=''):
  self.out=OUT/name;self.out.mkdir(parents=True);c.R=self.out
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  c.URL='http://127.0.0.1:'+str(port)+'/ctl'
  env=os.environ.copy();env.update(LMARBLES_CONTROL_OUT=str(self.out),LMARBLES_CONTROL_URL=c.URL,
      LMARBLES_REQUEST_LOG=str(self.out/'requests.jsonl'),LMARBLES_FAULT=fault,
      LMARBLES_SOURCE_OBSERVE=str(self.out))
  os.environ.update(LMARBLES_CONTROL_OUT=str(self.out),LMARBLES_CONTROL_URL=c.URL)
  args=['node','-e',BOOT,'--','--app=sol','--no-build','--threads','--real-ticks','--screen=1024x712',
        '--max-seconds=40','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
  c.save('recipe.json',dict(cwd=str(ROOT),args=args,seconds=340,reserveSeconds=300,watchdogGrace=2,nativeScene=True,
       inputPolicy=dict(confirmationMs=500,physicalUpMs=1750,observationMs=3000,gameFreshnessSeconds=5,menuFreshnessSeconds=30),
       moduleHolder=os.environ['LMARBLES_MODULE_HOLDER']))
  self.p=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/lmarbles-supervisor.py'),'durablewait',str(self.out)],
      env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  self.addCleanup(self.finish)
  end=time.monotonic()+20
  while True:
   try:
    s=c.call({'action':'snapshot'},1)
    if s['mainHwnd']!='0x0' and s['focusWindow']['live'] and s['physicalUp']:break
   except Exception:pass
   self.assertLess(time.monotonic(),end,'native fixture startup');time.sleep(.02)
  # Let the authored Solitaire fixture finish its initial deal before the one
  # permanent bind. This changes no production paint/review binding rule.
  time.sleep(2);c.capture('fresh');r=c.read('fresh.json')
  c.save('fresh-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],scene='game',
     observation='Automated native fixture review; no original or personal game review claim'))
  c.bind('fresh')
 def requests(self):
  return [v for l in (self.out/'requests.jsonl').read_text().splitlines() if 'command' in (v:=json.loads(l))]
 def finish(self):
  # Local host cleanup only: no HTTP after a terminal failure.
  c.save('cancel-request.json',dict(at=time.time(),reason='native fixture complete',nativeQuit=False))
  a,b=self.p.communicate(timeout=15)
  c.save('test-tool-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,
      stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
  self.assertEqual(self.p.returncode,0)
  for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
   w=c.read(name);self.assertEqual(w['exit'],0);self.assertTrue(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'])
 def pulse(self):return c.pulse('press',['keydown:40'],100,'fresh','automated native fixture finite intention')
 def closed(self):
  self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  before=len(self.requests())
  for fn in (lambda:c.capture('forbidden'),lambda:c.bind('fresh'),
             lambda:c.pulse('forbidden',['keydown:39'],100,'fresh','no retry')):
   with self.assertRaises(AssertionError):fn()
  self.assertEqual(len(self.requests()),before,'zero requests after permanent closure')
  c.save('closed-assertions.json',dict(noRebind=True,noReplay=True,noRetry=True,laterRequests=0))
 def test_native_enough(self):
  self.start('positive');self.pulse()
  down=c.read('press-down.json')[0];up=c.read('press-up.json');operation=c.read('press-operation.json')
  self.assertEqual(up['state'],'ACK');self.assertLess(up['at'],operation['deadline'])
  self.assertLessEqual(up['at']-down['consumedAt']/1000,1.75)
  self.assertLess(c.read('press-armed.json')['at'],down['consumedAt']/1000)
  self.assertEqual(c.read('press-release-wait.json')['exit'],0)
 def test_native_insufficient_before_prearm(self):
  self.start('insufficient')
  # Actual elapsed capture age reproduces the boundary; no timestamp refresh.
  while time.time()<c.read('fresh.json')['at']+5:time.sleep(.01)
  self.assertTrue(self.pulse().startswith('NOT_SENT'))
  self.assertEqual(c.read('press-rejection.json')['state'],'NOT_SENT')
  self.assertFalse((self.out/'press-armed.json').exists())
  self.assertFalse(any(r['command']['action']=='guarded-input' for r in self.requests() if 'action' in r['command']))
  self.assertFalse((self.out/'terminal-input-failure.json').exists())
  c.capture('renewed');r=c.read('renewed.json')
  c.save('renewed-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],scene='game',observation='New fixture capture after proven no effects'))
  c.pulse('new-intent',['keydown:40'],100,'renewed','fresh fixture intention after NOT_SENT')
  self.assertNotEqual(c.read('press-intent.json')['nonces'],c.read('new-intent-intent.json')['nonces'])
 def test_native_confirmation_reserve_before_prearm(self):
  self.start('confirmation-reserve')
  expiry=c.read('fresh.json')['at']+5
  while time.time()<expiry-.49:time.sleep(.002)
  self.assertTrue(self.pulse().startswith('NOT_SENT'))
  refusal=c.read('press-rejection.json')
  self.assertEqual(refusal['stage'],'before-prearm');self.assertEqual(refusal['domain'],'targeting')
  self.assertEqual(refusal['requiredSeconds'],.5)
  self.assertLess(refusal['at'],expiry,'fresh but insufficient confirmation room')
  self.assertFalse((self.out/'press-armed.json').exists())
  self.assertFalse(any(r['command'].get('action') in ('guarded-input','guarded-release') for r in self.requests()))
 def test_native_budget_spent_during_prearm(self):
  self.start('prearm')
  real=c.select.select
  def slow(*args):time.sleep(1);return real(*args)
  with patch.object(c.select,'select',slow):self.assertTrue(self.pulse().startswith('NOT_SENT'))
  self.assertEqual(c.read('press-rejection.json')['stage'],'after-prearm')
  self.assertEqual(c.read('press-release-skipped.json')['state'],'NOT_SENT')
  self.assertEqual(c.read('press-release-wait.json')['exit'],0)
  self.assertFalse(any(r['command'].get('action') in ('guarded-input','guarded-release') for r in self.requests()))
 def test_native_near_expiry_down_and_later_up(self):
  self.start('near-expiry')
  expiry=c.read('fresh.json')['at']+5
  while time.time()<expiry-.9:time.sleep(.002)
  c.pulse('press',['keydown:40'],800,'fresh','near expiry native fixture')
  down=c.read('press-down.json')[0];up=c.read('press-up.json');op=c.read('press-operation.json')
  self.assertLess(down['consumedAt']/1000,expiry)
  self.assertGreater(up['at'],expiry)
  self.assertLessEqual(up['at']-c.read('press-dispatch.json')['at'],1.75)
  self.assertEqual(op['deadline'],op['startedAt']+3)
  self.assertLess(c.read('press.json')['completedAt'],op['deadline'])
 def test_native_slow_operation(self):
  self.start('slow-operation');real=c.capture
  def slow(name,*args):
   time.sleep(1.8)
   return real(name,*args)
  with patch.object(c,'capture',slow),self.assertRaisesRegex(Exception,'3000ms operation'):
   self.pulse()
  self.assertEqual(c.read('press-up.json')['state'],'ACK');self.closed()
 def test_native_slow_physical_up(self):
  self.start('slow-physical-up','late-up');real=c.save
  def delayed(name,value):
   if name=='press-release-at.json':return # fixture: withhold early schedule; independent fallback remains
   return real(name,value)
  with patch.object(c,'save',delayed),self.assertRaisesRegex(Exception,'1750ms'):
   self.pulse()
  self.assertEqual(c.read('press-release-fired.json')['source'],'fallback');self.closed()
 def test_native_stale_at_consumption_with_spare_operation_time(self):
  self.start('stale-consumption','stale-consumption')
  expiry=c.read('fresh.json')['at']+5
  while time.time()<expiry-.4:time.sleep(.002)
  # Fixture-only admission fault: the native consumption fence must still
  # reject expiry when the controller's confirmation reserve is bypassed.
  with patch.object(c,'freshness_fits',return_value=True),self.assertRaises(Exception):self.pulse()
  receipt=c.read('press-receipt.json')
  self.assertEqual(receipt['state'],'CANCELLED');self.assertFalse(receipt['consumed'])
  self.assertGreater(c.read('press-operation.json')['deadline'],time.time())
  self.assertEqual(c.read('press-up.json')['state'],'ACK');self.closed()
 def test_native_effect_crosses_expiry(self):
  self.start('cross-expiry','cross-expiry')
  expiry=c.read('fresh.json')['at']+5
  while time.time()<expiry-.4:time.sleep(.002)
  # Bypass only the derived admission reserve in this authored fault fixture
  # to reach the independent receipt fence. Native expiry remains unchanged.
  with patch.object(c,'freshness_fits',return_value=True),self.assertRaisesRegex(Exception,'consumption exceeded targeting/admission deadline'):self.pulse()
  receipt=c.read('press-receipt.json')
  self.assertTrue(receipt['consumed'])
  self.assertEqual(receipt['deadline'],int(expiry*1000))
  self.assertGreaterEqual(receipt['consumedAt'],receipt['deadline'])
  self.assertGreater(c.read('press-operation.json')['deadline'],time.time())
  self.assertEqual(c.read('press-up.json')['state'],'ACK')
  self.assertEqual(c.read('press-release-wait.json')['exit'],0)
  self.closed()
 def test_native_budget_spent_before_dispatch(self):
  self.start('dispatch');real=c.policy;calls=[]
  def slow(*args,**kwargs):
   result=real(*args,**kwargs);calls.append(True)
   if len(calls)==3:time.sleep(1)
   return result
  with patch.object(c,'policy',slow):self.assertTrue(self.pulse().startswith('NOT_SENT'))
  self.assertEqual(c.read('press-rejection.json')['stage'],'before-dispatch')
  self.assertEqual(c.read('press-release-skipped.json')['state'],'NOT_SENT')
  self.assertFalse(any(r['command'].get('action') in ('guarded-input','guarded-release') for r in self.requests()))
 def fault(self,name):
  self.start(name,name)
  with self.assertRaises(Exception):self.pulse()
  self.assertEqual(c.read('press-release-wait.json')['exit'],0)
  self.assertEqual(c.read('press-up.json')['state'],'ACK')
  self.assertTrue(c.read('press-up.json')['reply']['released'])
  self.assertTrue((self.out/'press-release-fired.json').exists())
  if name in ('focus','owner'):
   receipts=[json.loads(l)['receipt'] for l in (self.out/'requests.jsonl').read_text().splitlines() if 'receipt' in json.loads(l)]
   self.assertFalse(any(r['consumed'] for r in receipts))
  self.closed()
 def test_native_slow_ack(self):self.fault('slow-ack')
 def test_native_unknown(self):self.fault('unknown')
 def test_native_slow_up_confirmation(self):
  self.start('slow-up','slow-up')
  with self.assertRaises(Exception):self.pulse()
  self.assertNotEqual(c.read('press-release-wait.json')['exit'],0)
  self.closed()
 def test_native_focus(self):self.fault('focus')
 def test_native_owner(self):self.fault('owner')

if __name__=='__main__':unittest.main(verbosity=2)

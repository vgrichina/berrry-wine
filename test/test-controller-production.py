"""Controller + actual run.js HTTP endpoint/renderer, isolated Solitaire fixture.

Run under the heavy lock. This is a controller regression, not original-game
progress. Fault injection is never loaded in the original LBreakout recipe.
"""
import importlib.util,pathlib,os,sys,json,time,socket,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('persistence',ROOT/'test/test-controller-persistence.py')
p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
b=p.baseline;c=p.c

class Production(p.Persistence):
 def start(self,name):
  out=b.R/('actual-cli-'+name);out.mkdir();self.out=out
  with socket.socket() as sock:
   sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  args=['node','--require',str(ROOT/'test/fixtures/controller-production.cjs'),'test/run.js','--app=sol','--no-build','--no-threads','--real-ticks','--screen=800x600','--max-seconds=40','--max-batches=10000000','--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
  b.save(out,'recipe.json',dict(args=args,cwd=str(ROOT),seconds=42,watchdogGrace=2))
  self.p=subprocess.Popen([sys.executable,'-B',str(b.SUPERVISOR),'outerwait',str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  b.waitfile(out/'native-pid.json');b.waitfile(out/'launch.json')
  c.R=out;c.URL='http://127.0.0.1:'+str(port)+'/ctl'
  os.environ['FORSAKEN_CONTROL_OUT']=str(out);os.environ['FORSAKEN_CONTROL_URL']=c.URL
  end=time.monotonic()+20
  while True:
   try:
    snap=c.call({'action':'snapshot'},timeout=1)
    visible=c.call(dict(action='eval',code='Object.values(renderer.windows).some(w=>w.visible&&!w.isChild)'),timeout=1)
    if snap['mainHwnd']!='0x0' and snap['eip']!='0x0' and visible:break
   except Exception:pass
   assert time.monotonic()<end,'actual CLI readiness deadline';time.sleep(.03)
  # Observe actual renderer calls before binding, preserving stable identities.
  c.call(dict(action='eval',code="""globalThis.persistenceEffects=[];
const down=renderer.handleKeyDown,up=renderer.handleKeyUp;
renderer.handleKeyDown=function(k){const v=down.call(this,k);persistenceEffects.push({kind:'DOWN',at:Date.now(),key:k});
 const busy=k===80?280:k===89?2250:0;if(busy){const end=Date.now()+busy;while(Date.now()<end){}}return v};
renderer.handleKeyUp=function(k){const v=up.call(this,k);persistenceEffects.push({kind:'UP',at:Date.now(),key:k});return v};true"""))
  c.bind()

 def finish(self):
  effects=c.call(dict(action='eval',code='persistenceEffects'))
  c.save('actual-renderer-effects.json',dict(effects=effects,fixture=True,originalGameProgress=False))
  c.call({'action':'quit'});out,err=self.p.communicate(timeout=10)
  c.save('fixture-outer-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
  self.assertEqual(self.p.returncode,0)
  for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json'):
   wait=b.waitfile(self.out/name);self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF']);self.assertEqual(wait['exit'],0)
  for image in self.out.glob('*.png'):image.unlink()
  return dict(effects=effects)

 def reviewed(self):
  c.capture('fresh');c.save('fresh-review.json',dict(at=time.time(),pngSHA256=c.read('fresh.json')['pngSHA256']))

 def test_normal_finite_pulse(self):
  self.start('normal')
  try:self.reviewed();c.pulse('finite',['keydown:40'],120,'fresh','actual CLI normal finite pulse')
  finally:summary=self.finish()
  down,up=summary['effects'][:2];self.assertEqual(down['kind'],'DOWN');self.assertEqual(up['kind'],'UP')
  self.assertGreaterEqual(up['at']-down['at'],110);self.assertLess(up['at']-down['at'],250)

 def test_actual_late_ack_stays_terminal(self):
  self.start('late-ack')
  try:
   self.reviewed()
   with self.assertRaisesRegex(AssertionError,'ACK arrived too late'):c.pulse('late',['keydown:78'],80,'fresh','actual transport late ACK negative')
   self.assertGreater(c.read('late-ack-timing-0.json')['transportAndHandlerMilliseconds'],150)
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:self.finish()

 def test_busy_server_exceeds_physical_bound(self):
  self.start('busy-server')
  try:
   self.reviewed()
   with self.assertRaises(Exception):c.pulse('busy',['keydown:89'],120,'fresh','actual renderer synchronous busy server')
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
  finally:summary=self.finish()
  down=next(v for v in summary['effects'] if v['kind']=='DOWN')
  up=next(v for v in summary['effects'] if v['kind']=='UP')
  self.assertGreater(up['at']-down['at'],2000)

 def test_dropped_ack_is_unknown_no_replay(self):
  self.start('dropped-ack')
  try:
   self.reviewed()
   with self.assertRaises(Exception):c.pulse('lost',['keydown:32'],120,'fresh','actual CLI dropped response after consumed DOWN')
   self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
   nonce=c.read('lost-intent.json')['nonces'][0]
   self.assertEqual(c.call({'action':'guarded-status','nonce':nonce})['state'],'UNKNOWN')
   with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('blocked')
  finally:summary=self.finish()
  self.assertEqual(len([v for v in summary['effects'] if v['kind']=='DOWN']),1)

if __name__=='__main__':
 names=[n for cls in (p.Persistence,Production) for n in cls.__dict__ if n.startswith('test_')]
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Production(n) for n in names)).wasSuccessful())

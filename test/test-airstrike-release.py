"""Airstrike derivative through actual production CLI and renderer; isolated sol."""
import importlib.util,pathlib,unittest,time,subprocess,sys,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,p):
 s=importlib.util.spec_from_file_location(name,ROOT/p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
c=load('airstrike','tools/airstrike-guard.py');p=load('production','test/test-controller-production.py')
p.c=c;p.p.c=c;p.b.control=c
class Keys(p.Production):
 def test_parent_kill_before_schedule_closes_pipe_without_replay(self):
  self.start('kill-before-schedule')
  try:
   c.capture('fresh');c.save('fresh-review.json',dict(at=time.time(),pngSHA256=c.read('fresh.json')['pngSHA256']))
   code="""import os,sys,json,signal,importlib.util
s=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
real=c.call
def killed(command,timeout=10):
 reply=real(command,timeout)
 if command.get('action')=='guarded-input':
  print(json.dumps({'actualACK':reply}),flush=True)
  os.kill(os.getpid(),signal.SIGKILL)
 return reply
c.call=killed
c.pulse('killed',['keydown:40'],120,'fresh','actual ACK then parent KILL before schedule')
"""
   parent=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/airstrike-guard.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   out,err=parent.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=parent.pid,exit=parent.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(parent.returncode,-9)
   ack=json.loads(out.decode().splitlines()[0])['actualACK'];self.assertTrue(ack['consumed'])
   p.b.waitfile(self.out/'killed-up.json')
   self.assertEqual(c.read('killed-up.json')['state'],'ACK')
   self.assertTrue(c.read('killed-release-fired.json')['channelEOF'])
   self.assertLessEqual(c.read('killed-up.json')['at']-ack['consumedAt']/1000,2)
   self.assertEqual(c.read('killed-release-cap.json')['fallbackMilliseconds'],1750)
   self.assertFalse((self.out/'killed-release-wait.json').exists())
   c.save('missing-release-wait.json',dict(actualWait=False,parentKilled=True,noReplay=True))
  finally:s=self.finish()
  down=next(e for e in s['effects'] if e['kind']=='DOWN');up=next(e for e in s['effects'] if e['kind']=='UP')
  self.assertLess(up['at']-down['at'],1800)
  c.save('killed-physical-timing.json',dict(down=down,up=up,holdMilliseconds=up['at']-down['at']))
 def test_original_punctuation(self):
  self.start('original-punctuation')
  try:
   for i,key in enumerate((188,190)):
    review='scene'+str(i);name='key'+str(i)
    c.capture(review);c.save(review+'-review.json',dict(at=time.time(),pngSHA256=c.read(review+'.json')['pngSHA256']))
    c.pulse(name,['keydown:'+str(key)],120,review,'actual renderer original punctuation',maxSceneAge=5)
  finally:s=self.finish()
  down=[e for e in s['effects'] if e['kind']=='DOWN'];self.assertEqual([e['key'] for e in down],[188,190])
  for d in down:
   u=next(e for e in s['effects'] if e['kind']=='UP' and e['key']==d['key'] and e['at']>=d['at'])
   self.assertGreaterEqual(u['at']-d['at'],110);self.assertLess(u['at']-d['at'],250)
if __name__=='__main__':
 names=list(dict.fromkeys(n for cls in (p.p.Persistence,p.Production,Keys) for n in cls.__dict__ if n.startswith('test_')))
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Keys(n) for n in names)).wasSuccessful())

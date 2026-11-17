"""Actual production transport and release child; slow real fsync, timely ACK.

The delay wraps the real fsync syscall, after it returns. It models a slow
durability boundary, never an HTTP/handler delay. No game or fixture is changed.
"""
import importlib.util, pathlib, os, sys, time, subprocess, json, unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('baseline', ROOT/'test/test-forsaken-controller.py')
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)
c = baseline.control

class Persistence(baseline.Controller):
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
c.pulse('killed',['keydown:40'],120,'fresh','KILL after actual ACK before schedule; retain independent cap')
"""
   p=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/forsaken-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   out,err=p.communicate(timeout=6)
   c.save('killed-parent-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(p.returncode,-9)
   ack=json.loads(out.decode().splitlines()[0])['actualACK'];self.assertTrue(ack['consumed'])
   baseline.waitfile(self.out/'killed-up.json')
   self.assertEqual(c.read('killed-up.json')['state'],'ACK')
   self.assertTrue(c.read('killed-release-fired.json')['channelEOF'])
   self.assertLessEqual(c.read('killed-up.json')['at']-ack['consumedAt']/1000,2)
   self.assertFalse((self.out/'killed-release-wait.json').exists())
   c.save('missing-release-wait.json',dict(actualWait=False,parentKilled=True,noReplay=True,reason='killed parent cannot supply orphan child wait'))
  finally:summary=self.finish()
  self.assertEqual(len([v for v in summary['effects'] if v['kind']=='DOWN']),1)

 def test_control_pipe_eof_keeps_immutable_fallback(self):
  self.start('channel-eof')
  try:
   owner=c.read('input-owner.json')['owner'];cap=time.time()+.8
   c.save('eof-release-cap.json',dict(at=cap,beforeFirstDown=True,maximumHoldMilliseconds=2000))
   p=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/forsaken-controller.py'),'release','eof',owner,str(time.time()+5),'channel'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   arm=json.loads(p.stdout.readline());self.assertTrue(arm['armed'])
   receipt=c.call(dict(action='guarded-input',cmd='keydown:40',guard={**c.read('input-owner.json'), 'nonce':'eof-unique','reviewed':True,'deadline':int(cap*1000)}))
   self.assertTrue(receipt['consumed'])
   p.stdin.close();p.stdin=None
   out,err=p.communicate(timeout=4)
   c.save('eof-child-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
   self.assertEqual(p.returncode,0)
   self.assertTrue(c.read('eof-release-fired.json')['channelEOF'])
   self.assertEqual(c.read('eof-release-fired.json')['source'],'fallback')
   self.assertLess(c.read('eof-up.json')['at'],cap+.15)
  finally:summary=self.finish()
  down=next(v for v in summary['effects'] if v['kind']=='DOWN')
  up=next(v for v in summary['effects'] if v['kind']=='UP' and v['at']>=down['at'])
  self.assertLess(up['at']-down['at'],2000)

 def test_timely_ack_slow_parent_and_release_fsync(self):
  self.start('slow-durable-timely-ack')
  real_fsync = os.fsync
  real_popen = subprocess.Popen
  delayed = []
  def slow(fd):
   name = pathlib.Path('/proc/self/fd/'+str(fd)).readlink().name
   real_fsync(fd)
   if name.startswith('finite-') and any(x in name for x in ('ack-timing','receipt','down.json','release-at')):
    start=time.time();time.sleep(.22)
    delayed.append(dict(file=name,start=start,end=time.time(),actualFsync=True))
  def child(args, **kw):
   if len(args)>3 and args[3]=='release':
    code="""import os,time,sys,runpy,pathlib
real=os.fsync
def slow(fd):
 name=pathlib.Path('/proc/self/fd/'+str(fd)).readlink().name
 real(fd)
 if '-release-fired.json' in name:time.sleep(.35)
os.fsync=slow
sys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')
"""
    args=[sys.executable,'-B','-c',code,*args[2:]]
   return real_popen(args, **kw)
  error=None
  try:
   c.capture('fresh');c.save('fresh-review.json',dict(at=time.time(),pngSHA256=c.read('fresh.json')['pngSHA256']))
   with patch.object(os,'fsync',slow), patch.object(subprocess,'Popen',child):
    try:c.pulse('finite',['keydown:40'],120,'fresh','timely ACK, genuinely slow durability, unchanged 120ms pulse')
    except BaseException as exc:error=exc
   c.save('fsync-injection.json',dict(calls=delayed,error=repr(error),latencyBoundary='real fsync; no ACK delay'))
  finally:summary=self.finish()
  down=next(v for v in summary['effects'] if v['kind']=='DOWN')
  up=next(v for v in summary['effects'] if v['kind']=='UP' and v['at']>=down['at'])
  c.save('physical-timing.json',dict(down=down,up=up,holdMilliseconds=up['at']-down['at']))
  self.assertLess(c.read('finite-ack-timing-0.json')['transportAndHandlerMilliseconds'],80)
  self.assertGreaterEqual(len(delayed),4)
  self.assertLess(up['at']-down['at'],250,'durability must not lengthen the 120ms pulse')
  self.assertGreaterEqual(up['at']-down['at'],110)
  self.assertIsNone(error,repr(error))
  self.assertFalse((self.out/'terminal-input-failure.json').exists())
  # Audit remains complete, and the release child is actually waited with EOF.
  for name in ('finite-receipt.json','finite-down.json','finite-release-at.json','finite-release-fired.json','finite-up.json'):
   self.assertTrue((self.out/name).exists(),name)
  wait=c.read('finite-release-wait.json')
  self.assertEqual(wait['exit'],0);self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF'])
  self.assertTrue(all(v['start']*1000>=up['at'] for v in delayed),'audit must follow physical release')

if __name__=='__main__':
 suite=unittest.TestSuite(Persistence(n) for n in Persistence.__dict__ if n.startswith('test_'))
 raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

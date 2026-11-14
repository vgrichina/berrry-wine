"""Barrage transport regressions. --production uses actual CLI Solitaire under heavy lock.

All fault injection belongs to fixtures; the original recipe never loads it.
"""
import importlib.util, pathlib, unittest, sys, subprocess, json, time
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, path):
    s=importlib.util.spec_from_file_location(name, ROOT/path)
    m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
c=load('barrage_guard', 'tools/barrage-guard.py')
r=load('refusal', 'test/test-quake2-refusal.py'); r.c=c; r.b.control=c
t=load('terminal', 'test/test-forsaken-terminal.py'); t.c=c; t.base.control=c
p=load('production', 'test/test-controller-production.py'); p.c=c; p.p.c=c; p.b.control=c

class Production(p.Production):
    def test_pipe_eof_retains_independent_cap_and_actual_wait(self):
        self.start('barrage-pipe-eof')
        try:
            owner=c.read('input-owner.json'); cap=time.time()+.8
            c.save('eof-release-cap.json',dict(at=cap,beforeFirstDown=True,maximumHoldMilliseconds=2000))
            child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/barrage-guard.py'),'release','eof',owner['owner'],str(time.time()+5),'channel'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
            receipt=c.call(dict(action='guarded-input',cmd='keydown:40',guard={**owner,'nonce':'fresh-eof','reviewed':True,'deadline':int(cap*1000)}))
            self.assertTrue(receipt['consumed']);child.stdin.close();child.stdin=None
            out,err=child.communicate(timeout=4)
            c.save('eof-child-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            self.assertEqual(child.returncode,0);self.assertTrue(c.read('eof-release-fired.json')['channelEOF'])
            self.assertLess(c.read('eof-up.json')['at'],cap+.15)
        finally:self.finish()
    def test_parent_kill_uses_1750ms_cap(self):
        self.start('barrage-kill-before-schedule')
        try:
            self.reviewed()
            code="""import os,sys,json,signal,importlib.util
s=importlib.util.spec_from_file_location('c',sys.argv[1]);c=importlib.util.module_from_spec(s);s.loader.exec_module(c)
real=c.call
def killed(command,timeout=10):
 reply=real(command,timeout)
 if command.get('action')=='guarded-input':
  print(json.dumps(reply),flush=True);os.kill(os.getpid(),signal.SIGKILL)
 return reply
c.call=killed
c.pulse('killed',['keydown:40'],120,'fresh','actual ACK then parent death before schedule')
"""
            parent=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/barrage-guard.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            out,err=parent.communicate(timeout=6)
            c.save('killed-parent-wait.json',dict(pid=parent.pid,exit=parent.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            self.assertEqual(parent.returncode,-9); ack=json.loads(out.decode().splitlines()[0]);self.assertTrue(ack['consumed'])
            p.b.waitfile(self.out/'killed-up.json')
            self.assertEqual(c.read('killed-release-cap.json')['fallbackMilliseconds'],1750)
            self.assertEqual(c.read('killed-up.json')['state'],'ACK')
            self.assertLess(c.read('killed-up.json')['at']-ack['consumedAt']/1000,2)
            self.assertTrue(c.read('killed-release-fired.json')['channelEOF'])
            c.save('orphan-wait-unavailable.json',dict(actualWait=False,parentKilled=True,noReplay=True))
        finally: summary=self.finish()
        d=next(e for e in summary['effects'] if e['kind']=='DOWN');u=next(e for e in summary['effects'] if e['kind']=='UP')
        self.assertLess(u['at']-d['at'],1800)
        c.save('physical-timing.json',dict(down=d,up=u,holdMilliseconds=u['at']-d['at']))
    def test_original_play_keys_and_1500ms(self):
        # Escape changes Solitaire's menu ownership. Each independent fixture
        # uses its own permanent binding; never rebind after that transition.
        for i,key in enumerate((17,13,27)):
            self.start('barrage-original-key'+str(key))
            try:
                name='key'+str(i);scene='scene'+str(i)
                c.capture(scene); c.save(scene+'-review.json',dict(at=time.time(),pngSHA256=c.read(scene+'.json')['pngSHA256']))
                c.pulse(name,['keydown:'+str(key)],1500 if key==13 else 400,scene,'actual renderer documented key',maxSceneAge=5)
            finally: summary=self.finish()
            downs=[e for e in summary['effects'] if e['kind']=='DOWN'];self.assertEqual(len(downs),1)
            for d in downs:
                u=next(e for e in summary['effects'] if e['kind']=='UP' and e['key']==d['key'] and e['at']>=d['at'])
                self.assertLess(u['at']-d['at'],1750)

    def test_original_pointer_and_ctrl_left(self):
        originalBind=c.bind
        def instrumentedBind():
            c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseDown','MOUSEDOWN'],['handleMouseUp','MOUSEUP'],['handleMouseMove','MOUSEMOVE']]){
const original=renderer[method];renderer[method]=function(...args){const value=original.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return value;}}true"""))
            originalBind()
        with patch.object(c,'bind',instrumentedBind):self.start('barrage-original-pointer')
        try:
            for i,keys in enumerate((['mousemove:200:200'],['mousedown:200:200'],['keydown:17','mousedown:220:220'])):
                scene='pointer-scene'+str(i);name='pointer'+str(i)
                c.capture(scene);c.save(scene+'-review.json',dict(at=time.time(),pngSHA256=c.read(scene+'.json')['pngSHA256']))
                c.pulse(name,keys,400,scene,'actual renderer finite manual pointer gesture',maxSceneAge=5)
        finally: summary=self.finish()
        effects=summary['effects'];downs=[e for e in effects if e['kind']=='MOUSEDOWN']
        self.assertEqual(len(downs),2)
        self.assertTrue(any(e['kind']=='MOUSEMOVE' for e in effects))
        for d in downs:
            u=next(e for e in effects if e['kind']=='MOUSEUP' and e['at']>=d['at'])
            self.assertLess(u['at']-d['at'],1750)

if __name__ == '__main__':
    if '--production' in sys.argv:
        names=['test_timely_ack_slow_parent_and_release_fsync']+[n for cls in (p.Production,Production) for n in cls.__dict__ if n.startswith('test_')]
        suite=unittest.TestSuite(Production(n) for n in names)
    else:
        suite=unittest.TestSuite([*(r.Refusal(n) for n in r.Refusal.__dict__ if n.startswith('test_')),
                                  *(t.Terminal(n) for n in t.Terminal.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

"""LTris transport regressions. --production uses actual CLI Solitaire under heavy lock.

All fault injection belongs to fixtures; the original recipe never loads it.
"""
import importlib.util, pathlib, unittest, sys, subprocess, json, time
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
def load(name, path):
    s=importlib.util.spec_from_file_location(name, ROOT/path)
    m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
c=load('ltris_guard', 'tools/ltris-guard.py')
a=load('ltris_controller', 'tools/ltris-controller.py'); a.c=c
r=load('refusal', 'test/test-quake2-refusal.py'); r.c=c; r.b.control=c
t=load('terminal', 'test/test-forsaken-terminal.py'); t.c=c; t.base.control=c
p=load('production', 'test/test-controller-production.py'); p.c=c; p.p.c=c; p.b.control=c

class BackTransport(r.Refusal):
    def end_game_case(self, ambiguous):
        self.start('ltris-end-game-'+('unknown' if ambiguous else 'consumed'))
        original=c.call
        def call(command,timeout=10):
            reply=original(command,timeout)
            if ambiguous and command.get('action')=='guarded-input':reply['state']='UNKNOWN'
            return reply
        try:
            c.capture('endscene')
            c.save('endscene-review.json',dict(at=time.time(),pngSHA256=c.read('endscene.json')['pngSHA256'],
                   mode='quit',quitRoute='confirm-end-game',endGamePrompt=True))
            with patch.object(c,'call',call),patch.object(a,'cutoff',return_value=time.time()+10):
                if ambiguous:
                    with self.assertRaises(Exception):a.pulse('end',['keydown:89'],400,'endscene','fixture End Game y/n','quit','confirm-end-game')
                    self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
                    with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('neverreplay')
                else:
                    a.pulse('end',['keydown:89'],400,'endscene','fixture End Game y/n','quit','confirm-end-game')
                    self.assertEqual(c.read('end-up.json')['state'],'ACK')
                    self.assertTrue((self.out/'end-progress.json').exists())
            self.assertFalse((self.out/'end-final-choice.json').exists())
        finally:self.finish()
    # The released HTTP fixture deliberately stalls key Y for 2250ms;
    # positive Y delivery belongs to the actual CLI fixture below.
    def test_end_game_unknown_stays_closed(self):self.end_game_case(True)
    def test_reviewed_back_is_consumed_nonfinal(self):
        self.start('ltris-back-consumed')
        try:
            c.capture('backscene')
            c.save('backscene-review.json',dict(at=time.time(),pngSHA256=c.read('backscene.json')['pngSHA256'],
                   mode='quit',quitRoute='select-back',selectedBack=True,selectedQuit=False))
            with patch.object(a,'cutoff',return_value=time.time()+10):
                a.pulse('back',['keydown:13'],400,'backscene','fixture selected Back','quit','select-back')
            self.assertEqual(c.read('back-down.json')[0]['state'],'CONSUMED')
            self.assertEqual(c.read('back-up.json')['state'],'ACK')
            self.assertTrue(c.read('back-release-wait.json')['actualWait'])
            self.assertTrue((self.out/'back-progress.json').exists())
            self.assertFalse((self.out/'back-final-choice.json').exists())
            self.assertTrue(c.read('quit-phase.json')['irreversible'])
        finally: summary=self.finish()
        self.assertEqual(len([e for e in summary['effects'] if e['kind']=='DOWN']),1)
    def test_reviewed_back_then_unknown_is_closed(self):
        self.start('ltris-back-unknown')
        original=c.call
        def unknown(command, timeout=10):
            reply=original(command, timeout)
            if command.get('action')=='guarded-input': reply['state']='UNKNOWN'
            return reply
        try:
            c.capture('backscene')
            c.save('backscene-review.json',dict(at=time.time(),pngSHA256=c.read('backscene.json')['pngSHA256'],
                   mode='quit',quitRoute='select-back',selectedBack=True,selectedQuit=False))
            # The synthetic transport fixture lives 35s; reserve policy has
            # separate 1200s policy tests. No game clock is changed here.
            with patch.object(c,'call',unknown), patch.object(a,'cutoff',return_value=time.time()+10):
                with self.assertRaises(Exception):
                    a.pulse('back',['keydown:13'],400,'backscene','fixture selected Back','quit','select-back')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            with self.assertRaisesRegex(AssertionError,'sticky'): c.capture('neverreplay')
            self.assertFalse((self.out/'back-final-choice.json').exists())
        finally: self.finish()

class Production(p.Production):
    def test_end_game_policy_uses_actual_cli_nonfinal_transport(self):
        bind=c.bind
        def bind_without_synthetic_y_stall():
            # The inherited busy-server negative deliberately stalls Y.
            # Install this positive fixture's observer BEFORE permanent bind,
            # preserving production renderer dispatch and all negative tests.
            self.assertTrue(c.call(dict(action='eval',code="""(() => {
const down=Object.getPrototypeOf(renderer).handleKeyDown;
if(typeof down!=='function') throw Error('renderer prototype key handler missing');
renderer.handleKeyDown=function(k){const v=down.call(this,k);persistenceEffects.push({kind:'DOWN',at:Date.now(),key:k});return v};
return true;
})()""")))
            bind()
        with patch.object(c,'bind',bind_without_synthetic_y_stall):
            self.start('ltris-end-game-policy-cli')
        try:
            c.capture('endscene')
            c.save('endscene-review.json',dict(at=time.time(),pngSHA256=c.read('endscene.json')['pngSHA256'],
                   mode='quit',quitRoute='confirm-end-game',endGamePrompt=True))
            with patch.object(a,'cutoff',return_value=time.time()+10):
                a.pulse('end',['keydown:89'],400,'endscene','synthetic End Game y/n review on actual CLI transport','quit','confirm-end-game')
            self.assertTrue((self.out/'end-progress.json').exists())
            self.assertFalse((self.out/'end-final-choice.json').exists())
            self.assertEqual(c.read('end-up.json')['state'],'ACK')
        finally:self.finish()
    def test_back_policy_uses_actual_cli_nonfinal_transport(self):
        self.start('ltris-back-policy-cli')
        try:
            c.capture('backscene')
            c.save('backscene-review.json',dict(at=time.time(),pngSHA256=c.read('backscene.json')['pngSHA256'],
                   mode='quit',quitRoute='select-back',selectedBack=True,selectedQuit=False))
            # Solitaire verifies delivery and lifecycle only. This fixture
            # assertion is not a claim that Solitaire displays LTris Back.
            with patch.object(a,'cutoff',return_value=time.time()+10):
                a.pulse('back',['keydown:13'],400,'backscene','synthetic Back review on actual CLI transport','quit','select-back')
            self.assertTrue((self.out/'back-progress.json').exists())
            self.assertFalse((self.out/'back-final-choice.json').exists())
            self.assertEqual(c.read('back-up.json')['state'],'ACK')
        finally: self.finish()
    def test_pipe_eof_retains_independent_cap_and_actual_wait(self):
        self.start('ltris-pipe-eof')
        try:
            owner=c.read('input-owner.json'); cap=time.time()+.8
            c.save('eof-release-cap.json',dict(at=cap,beforeFirstDown=True,maximumHoldMilliseconds=2000))
            child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/ltris-guard.py'),'release','eof',owner['owner'],str(time.time()+5),'channel'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
            receipt=c.call(dict(action='guarded-input',cmd='keydown:40',guard={**owner,'nonce':'fresh-eof','reviewed':True,'deadline':int(cap*1000)}))
            self.assertTrue(receipt['consumed']);child.stdin.close();child.stdin=None
            out,err=child.communicate(timeout=4)
            c.save('eof-child-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            self.assertEqual(child.returncode,0);self.assertTrue(c.read('eof-release-fired.json')['channelEOF'])
            self.assertLess(c.read('eof-up.json')['at'],cap+.15)
        finally:self.finish()
    def test_parent_kill_uses_1750ms_cap(self):
        self.start('ltris-kill-before-schedule')
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
            parent=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/ltris-guard.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
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
        self.start('ltris-original-keys')
        try:
            for i,key in enumerate((38,34,35,46,80,37,39,40)):
                name='key'+str(i);scene='scene'+str(i)
                c.capture(scene); c.save(scene+'-review.json',dict(at=time.time(),pngSHA256=c.read(scene+'.json')['pngSHA256']))
                c.pulse(name,['keydown:'+str(key)],1500 if key==40 else 400,scene,'actual renderer documented key',maxSceneAge=5)
        finally: summary=self.finish()
        downs=[e for e in summary['effects'] if e['kind']=='DOWN'];self.assertEqual(len(downs),8)
        for d in downs:
            u=next(e for e in summary['effects'] if e['kind']=='UP' and e['key']==d['key'] and e['at']>=d['at'])
            self.assertLess(u['at']-d['at'],1750)

if __name__ == '__main__':
    if '--production' in sys.argv:
        names=['test_timely_ack_slow_parent_and_release_fsync']+[n for cls in (p.Production,Production) for n in cls.__dict__ if n.startswith('test_')]
        suite=unittest.TestSuite(Production(n) for n in names)
    else:
        suite=unittest.TestSuite([*(r.Refusal(n) for n in r.Refusal.__dict__ if n.startswith('test_')),
                                  *(t.Terminal(n) for n in t.Terminal.__dict__ if n.startswith('test_')),
                                  *(BackTransport(n) for n in BackTransport.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

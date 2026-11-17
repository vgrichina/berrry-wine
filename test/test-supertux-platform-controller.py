"""Safety policy checks; no game, solver, or synthetic gameplay delivery."""
import importlib.util, pathlib, tempfile, unittest, sys, os, subprocess, json, time
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location('adapter', ROOT / 'tools/supertux-platform-controller.py')
a = importlib.util.module_from_spec(s); s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1300))
        a.c.save('play-review.json', dict(mode='play', floorReviewed=True, obstacleReviewed=True, launchMarginReviewed=True))
        a.c.save('quit-review.json', dict(mode='quit', quitRoute='select', selectedQuit='Abort Level'))
    def tearDown(self): self.tmp.cleanup()
    def test_before_arm_reserve(self):
        with patch.object(a.time, 'time', return_value=1113):
            with self.assertRaisesRegex(AssertionError, 'cutoff'): a.policy(['keydown:39'], 'play', 'play', beforeArm=True)
    def test_cutoff_permanently_closes_play(self):
        with patch.object(a.time, 'time', return_value=1120):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'): a.policy(['keydown:39'], 'play', 'play')
        self.assertEqual(a.c.read('quit-phase.json')['reserveSeconds'], 180)
        with patch.object(a.time, 'time', return_value=1100):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'): a.policy(['keydown:39'], 'play', 'play')
    def test_manual_quit_irreversible(self):
        with patch.object(a.time, 'time', return_value=1000):
            a.policy(['keydown:13'], 'quit', 'quit', 'select')
            with self.assertRaisesRegex(AssertionError, 'Quit phase'): a.policy(['keydown:32'], 'play', 'play')
            with self.assertRaisesRegex(AssertionError, 'ordinary'): a.policy(['keydown:39'], 'quit', 'quit', 'select')
    def test_jump_requires_margin_review(self):
        a.c.save('bad-review.json', dict(mode='play', floorReviewed=True, obstacleReviewed=True))
        with patch.object(a.time, 'time', return_value=1000):
            with self.assertRaisesRegex(AssertionError, 'launch margin'): a.policy(['keydown:32', 'keydown:39'], 'bad', 'play')
            a.policy(['keydown:32', 'keydown:39'], 'play', 'play')
    def test_pause_and_forbidden_controls(self):
        a.c.save('pause-review.json', dict(mode='pause'))
        with patch.object(a.time, 'time', return_value=1000):
            a.policy(['keydown:80'], 'pause', 'pause')
            with self.assertRaisesRegex(AssertionError, 'native P'): a.policy(['keydown:19'], 'pause', 'pause')
            with self.assertRaisesRegex(AssertionError, 'original'): a.policy(['keydown:78'], 'play', 'play')
    def test_guard_cutoff_rechecked_before_each_down(self):
        sent = []
        def shared(*args, **kwargs):
            self.assertEqual(kwargs['maxSceneAge'], 5)
            a.c.save('one-release-cap.json',dict(at=1121,maximumHoldMilliseconds=2000))
            with patch.object(a.time, 'time', return_value=1119): a.c.call(dict(action='guarded-input', guard={'deadline':9999999}))
            with patch.object(a.time, 'time', return_value=1121): a.c.call(dict(action='guarded-input', guard={'deadline':9999999}))
        with patch.object(a.time, 'time', return_value=1000), patch.object(a.c, 'call', lambda cmd, timeout=10: sent.append(cmd)), patch.object(a.c, 'pulse', shared):
            with self.assertRaisesRegex(AssertionError, 'Quit phase'): a.pulse('one', ['keydown:32'], 120, 'play', 'reviewed', 'play')
        self.assertEqual(len(sent), 1); self.assertEqual(sent[0]['guard']['deadline'], 1120000)
    def test_request_leaves_release_ack_margin(self):
        with self.assertRaisesRegex(AssertionError,'fallback acknowledgement margin'):
            a.pulse('long',['keydown:39'],1501,'play','reviewed','play')

if '--production' in sys.argv:
    sys.argv.remove('--production')
    spec = importlib.util.spec_from_file_location('production', ROOT/'test/test-controller-production.py')
    prod = importlib.util.module_from_spec(spec); spec.loader.exec_module(prod)
    class AdapterProduction(prod.Production):
        def start(self,name):
            original=prod.b.save
            def recipe(out,n,v):
                # Permit the real 180s adapter policy in a promptly Quit 40s
                # Solitaire fixture; no original game is launched here.
                if n=='recipe.json': v={**v,'seconds':1200}
                return original(out,n,v)
            with patch.object(prod.b,'save',recipe): super().start(name)
        def test_adapter_normal_two_key_pulse(self):
            self.start('adapter-normal-two-key')
            try:
                c=prod.c; a.c.R=c.R; a.c.URL=c.URL
                c.capture('fresh');c.save('fresh-review.json',dict(at=time.time(),pngSHA256=c.read('fresh.json')['pngSHA256'],mode='play'))
                a.pulse('finite',['keydown:17','keydown:39'],120,'fresh','reviewed original run plus right fixture','play')
                self.assertEqual(c.read('finite-release-cap.json')['maximumHoldMilliseconds'],1750)
                down=c.read('finite-down.json');self.assertEqual(len(down),2)
                cap=c.read('finite-release-cap.json')['at']
                self.assertTrue(all(r['deadline']<=cap*1000 for r in down))
                wait=c.read('finite-release-wait.json')
                self.assertTrue(wait['actualWait'] and wait['stdoutEOF'] and wait['stderrEOF']);self.assertEqual(wait['exit'],0)
            finally:summary=self.finish()
            for key in (17,39):
                d=next(v for v in summary['effects'] if v['kind']=='DOWN' and v['key']==key)
                u=next(v for v in summary['effects'] if v['kind']=='UP' and v['key']==key)
                self.assertGreaterEqual(u['at']-d['at'],110);self.assertLess(u['at']-d['at'],250)
        def test_adapter_parent_kill_before_schedule(self):
            self.start('adapter-kill-before-schedule')
            try:
                c = prod.c
                c.capture('fresh'); c.save('fresh-review.json', dict(at=time.time(), pngSHA256=c.read('fresh.json')['pngSHA256'], mode='play'))
                code = '''import os,sys,json,signal,importlib.util
s=importlib.util.spec_from_file_location('a',sys.argv[1]);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
real=a.c.call
def killed(command,timeout=10):
 reply=real(command,timeout)
 if command.get('action')=='guarded-input':
  print(json.dumps({'actualACK':reply}),flush=True)
  os.kill(os.getpid(),signal.SIGKILL)
 return reply
a.c.call=killed
a.pulse('killed',['keydown:39'],120,'fresh','manual fixture review','play')
'''
                p = subprocess.Popen([sys.executable, '-B', '-c', code, str(ROOT/'tools/supertux-platform-controller.py')], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                out,err = p.communicate(timeout=6)
                c.save('killed-parent-wait.json',dict(pid=p.pid,exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
                self.assertEqual(p.returncode,-9)
                ack=json.loads(out.decode().splitlines()[0])['actualACK'];self.assertTrue(ack['consumed'])
                prod.b.waitfile(self.out/'killed-up.json')
                up=c.read('killed-up.json');self.assertEqual(up['state'],'ACK')
                c.save('adapter-ack-bound.json',dict(milliseconds=(up['at']-ack['consumedAt']/1000)*1000))
                self.assertLess(up['at']-ack['consumedAt']/1000,2)
                self.assertTrue(c.read('killed-release-fired.json')['channelEOF'])
                self.assertFalse((self.out/'killed-release-wait.json').exists())
                c.save('missing-release-wait.json',dict(actualWait=False,parentKilled=True,noReplay=True))
            finally: summary=self.finish()
            down=next(v for v in summary['effects'] if v['kind']=='DOWN')
            up=next(v for v in summary['effects'] if v['kind']=='UP')
            self.assertLess(up['at']-down['at'],2000)
    if __name__ == '__main__':
        suite=unittest.TestSuite(AdapterProduction(n) for n in ('test_adapter_parent_kill_before_schedule','test_adapter_normal_two_key_pulse'))
        # Keep all unchanged actual-CLI failure controls. The shared parent-
        # death case is the retained red; its adapter replacement is above.
        suite.addTests(prod.Production(n) for n in ('test_control_pipe_eof_keeps_immutable_fallback','test_timely_ack_slow_parent_and_release_fsync','test_normal_finite_pulse','test_actual_late_ack_stays_terminal','test_busy_server_exceeds_physical_bound','test_dropped_ack_is_unknown_no_replay'))
        raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())
elif __name__ == '__main__': unittest.main()

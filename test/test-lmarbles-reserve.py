"""Real loopback production transport/guard and actual process release/wait tests.

All delays and short cutoffs belong to synthetic endpoints, never the game.
"""
import importlib.util,json,os,pathlib,signal,socket,subprocess,sys,tempfile,threading,time,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
c=load('lmarbles',ROOT/'tools/lmarbles-controller.py')
sup=ROOT/'tools/lmarbles-supervisor.py'
OUT=pathlib.Path(os.environ.get('LMARBLES_TEST_OUT') or tempfile.mkdtemp(prefix='lmarbles-reserve-',dir=ROOT/'scratch/runs'))
OUT.mkdir(parents=True,exist_ok=True)
OUT=OUT.resolve()
def waitfile(p,seconds=12):
    end=time.monotonic()+seconds
    while not p.exists() and time.monotonic()<end:time.sleep(.01)
    assert p.exists(),p
    return json.loads(p.read_text())
class Reserve(unittest.TestCase):
    def start(self,name,seconds=210,lateEOF=False):
        self.out=OUT/name;self.out.mkdir();c.R=self.out
        c.save('recipe.json',dict(args=['node',str(ROOT/'test/fixtures/lmarbles-reserve-endpoint.js')],cwd=str(self.out),seconds=seconds,watchdogGrace=2))
        env=os.environ.copy()
        if lateEOF:env['LMARBLES_LATE_EOF']='1'
        self.p=subprocess.Popen([sys.executable,'-B',str(sup),'durablewait',str(self.out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,start_new_session=True)
        waitfile(self.out/'native-pid.json');endpoint=waitfile(self.out/'fixture-endpoint.json')
        c.URL='http://127.0.0.1:'+str(endpoint['port'])+'/ctl'
        os.environ['LMARBLES_CONTROL_OUT']=str(self.out);os.environ['LMARBLES_CONTROL_URL']=c.URL
        c.opened();c.reserve()
        c.save('input-owner.json',c.call({'action':'guarded-bind'}));s=c.call({'action':'snapshot'});c.save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
    def fresh(self,name='fresh',route=None):
        c.capture(name);c.save(name+'-review.json',dict(at=time.time(),pngSHA256=c.read(name+'.json')['pngSHA256'],quitRoute=route))
    def finish(self,quit=True):
        if quit:c.call({'action':'quit'})
        a,b=self.p.communicate(timeout=15)
        c.save('test-tool-wait.json',dict(exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=a.decode(),stderr=b.decode()))
        for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
            w=waitfile(self.out/name);self.assertTrue(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'])
        lines=(self.out/'native.stdout.log').read_text().splitlines()
        summaries=[json.loads(x[:-len(' CONTROL_SUMMARY')]) for x in lines if x.endswith(' CONTROL_SUMMARY')]
        for p in self.out.glob('*.png'):p.unlink()
        return summaries[-1] if summaries else None
    def test_default_gameplay_and_40ms(self):
        self.start('gameplay40');self.fresh()
        try:
            c.pulse('press',['mousedown:120:140'],40,'fresh','personally reviewed synthetic target')
            self.assertEqual(c.read('press-intent.json')['intent'],'gameplay')
            self.assertEqual(c.read('press-up.json')['state'],'ACK')
            self.assertLess(c.read('press-armed.json')['at'],c.read('press-down.json')[0]['consumedAt']/1000)
            self.assertGreater(c.read('press-progress.json')['postProgress']['batch'],c.read('press-progress.json')['afterRelease']['batch'])
        finally:s=self.finish()
        down=next(x for x in s['effects'] if x['kind']=='DOWN');up=next(x for x in s['effects'] if x['kind']=='UP')
        self.assertGreaterEqual(up['at']-down['at'],39);self.assertLess(up['at']-down['at'],180)
    def test_crossing_cutoff_zero_down(self):
        self.start('crossing',180.8);self.fresh()
        try:
            # Cross the real recorded cutoff during the real production lease.
            lease=c.lease
            def crossing():
                result=lease()
                while time.time()<c.reserve():time.sleep(.01)
                return result
            c.lease=crossing
            try:
                with self.assertRaises(c.ReserveRejected):c.pulse('select',['mousedown:120:140'],40,'fresh','synthetic reviewed board')
            finally:c.lease=lease
            self.assertFalse((self.out/'select-armed.json').exists())
            self.assertTrue(c.read('quit-phase.json')['irreversible'])
            with self.assertRaises(c.ReserveRejected):c.pulse('slide',['keydown:39'],40,'fresh','default remains gameplay')
            self.assertFalse((self.out/'terminal-input-failure.json').exists())
        finally:s=self.finish()
        self.assertEqual([x for x in s['effects'] if x['kind']=='DOWN'],[])
        self.assertEqual([x for x in s['requests'] if x['action']=='guarded-input'],[])
    def test_quit_routes_irreversible_and_no_relabel(self):
        self.start('quit-routes');self.fresh(route='leave-game')
        try:
            for key in ('keydown:39','mousedown:120:140','mousemove:120:140'):
                with self.assertRaises(c.ReserveRejected):c.pulse('bad',[''+key],40,'fresh','cannot rename slide',intent='quit',route='leave-game')
            c.pulse('leave',['keydown:27'],100,'fresh','reviewed ordinary leave prompt',intent='quit',route='leave-game')
            with self.assertRaises(c.ReserveRejected):c.pulse('back',['keydown:39'],40,'leave','no return to gameplay')
            self.fresh('confirm','confirm-leave')
            c.pulse('yes',['keydown:89'],100,'confirm','reviewed ordinary affirmative leave',intent='quit',route='confirm-leave')
            self.fresh('unbound')
            with self.assertRaises(c.ReserveRejected):c.pulse('unbound',['keydown:27'],40,'unbound','route absent',intent='quit',route='exit-setup')
        finally:s=self.finish()
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='DOWN']),2)
    def test_quit_after_real_cutoff(self):
        self.start('after-cutoff',180.3)
        while time.time()<c.reserve():time.sleep(.01)
        self.fresh(route='exit-setup')
        try:c.pulse('quit',['keydown:27'],100,'fresh','fresh reviewed setup Quit',intent='quit',route='exit-setup')
        finally:s=self.finish()
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='DOWN']),1)
    def test_late_ack_independent_up_no_replay(self):
        self.start('late-ack');self.fresh()
        try:
            with self.assertRaisesRegex(AssertionError,'late ACK'):c.pulse('late',['keydown:78'],40,'fresh','synthetic late ACK')
            self.assertEqual(c.read('late-up.json')['state'],'ACK')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('blocked')
        finally:s=self.finish()
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='DOWN']),1)
    def test_unknown_independent_fallback_no_replay(self):
        self.start('unknown');self.fresh()
        try:
            with self.assertRaises(Exception):c.pulse('unknown',['keydown:32'],40,'fresh','synthetic lost ACK')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            self.assertEqual(c.read('unknown-release-fired.json')['source'],'fallback')
            self.assertEqual(c.read('unknown-release-wait.json')['exit'],0)
        finally:s=self.finish()
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='DOWN']),1)
    def terminal(self,mode):
        self.start('terminal-'+mode,lateEOF=mode=='late-eof');self.fresh(route='confirm-quit')
        errors=[]
        def end():
            try:
                waitfile(self.out/'final-receipt.json')
                if mode in ('normal','late-eof'):c.call({'action':'quit'})
                else:os.kill(c.read('native-pid.json')['pid'],signal.SIGTERM if mode=='term' else signal.SIGKILL)
            except BaseException as e:errors.append(repr(e))
        t=threading.Thread(target=end);t.start()
        try:
            if mode in ('normal','late-eof'):c.pulse('final',['keydown:89'],400,'fresh','reviewed final ordinary Quit',final=True,intent='quit',route='confirm-quit')
            else:
                with self.assertRaises(Exception):c.pulse('final',['keydown:89'],400,'fresh','reviewed final ordinary Quit',final=True,intent='quit',route='confirm-quit')
        finally:t.join(12);self.finish(False)
        self.assertFalse(errors,errors);self.assertFalse(t.is_alive())
        up=c.read('final-up.json');w=c.read('native-wait.json')
        self.assertEqual(w['startToken'],c.read('native-pid.json')['startToken'])
        self.assertNotEqual(up['state'],'ACK')
        if mode in ('normal','late-eof'):
            self.assertEqual(up['state'],'OWNER_EXITED');self.assertFalse(up['physicalUpACK']);self.assertFalse(c.read('terminal-owner-exited.json')['nativeQuitClaim'])
        else:self.assertEqual(up['state'],'UNKNOWN');self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
    def test_terminal_normal(self):self.terminal('normal')
    def test_terminal_term(self):self.terminal('term')
    def test_terminal_kill(self):self.terminal('kill')
    def test_terminal_late_eof(self):self.terminal('late-eof')
    def test_durable_wait_owner_term_and_invoker_kill(self):
        for mode in ('normal','term','invoker-kill'):
            out=OUT/('durable-'+mode);out.mkdir()
            (out/'recipe.json').write_text(json.dumps(dict(args=[sys.executable,'-u','-c',"import sys,time;print('out');print('err',file=sys.stderr);time.sleep(.5)"],cwd=str(ROOT),seconds=2,watchdogGrace=.2)))
            code="import subprocess,sys,time,json,pathlib; r=pathlib.Path(sys.argv[2]); a=(r/'owner.stdout.log').open('xb'); b=(r/'owner.stderr.log').open('xb'); p=subprocess.Popen([sys.executable,'-B',sys.argv[1],'durablewait',str(r)],stdin=subprocess.DEVNULL,stdout=a,stderr=b,start_new_session=True); (r/'owner.json').write_text(json.dumps({'pid':p.pid})); time.sleep(30 if sys.argv[3]=='invoker-kill' else 0)"
            p=subprocess.Popen([sys.executable,'-B','-c',code,str(sup),str(out),mode],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
            owner=waitfile(out/'owner.json');waitfile(out/'native-pid.json')
            if mode=='term':os.kill(owner['pid'],signal.SIGTERM)
            if mode=='invoker-kill':os.killpg(p.pid,signal.SIGKILL)
            a,b=p.communicate(timeout=5)
            (out/'tool-wait.json').write_text(json.dumps(dict(exit=p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True)))
            self.assertEqual(p.returncode,-9 if mode=='invoker-kill' else 0)
            for n in ('native-wait.json','watchdog-wait.json','outer-child-wait.json','outer-wait.json'):
                w=waitfile(out/n);self.assertEqual(w['exit'],0);self.assertTrue(w['actualWait'] and w['stdoutEOF'] and w['stderrEOF'])
            self.assertEqual((out/'native.stdout.log').read_text(),'out\n')
            self.assertEqual((out/'native.stderr.log').read_text(),'err\n')
class ActualCLI(Reserve):
    """Actual production test/run.js HTTP, renderer and independent UP child.

    The synthetic Solitaire session is separate from original LMarbles evidence.
    """
    def start(self,name,seconds=210,lateEOF=False):
        self.out=OUT/('actual-cli-'+name);self.out.mkdir();c.R=self.out
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        args=['node','--require',str(ROOT/'test/fixtures/lmarbles-reserve-endpoint.js'),
              'test/run.js','--app=sol','--no-build','--no-threads','--real-ticks',
              '--screen=1024x712','--max-seconds=45','--max-batches=10000000',
              '--control='+str(port),'--quiet-api','--quiet-blocks','--no-close']
        c.save('recipe.json',dict(args=args,cwd=str(ROOT),seconds=seconds,watchdogGrace=2))
        self.p=subprocess.Popen([sys.executable,'-B',str(sup),'durablewait',str(self.out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
        waitfile(self.out/'native-pid.json');waitfile(self.out/'launch.json')
        c.URL='http://127.0.0.1:'+str(port)+'/ctl'
        os.environ['LMARBLES_CONTROL_OUT']=str(self.out);os.environ['LMARBLES_CONTROL_URL']=c.URL
        end=time.monotonic()+20
        while True:
            try:
                s=c.call({'action':'snapshot'},timeout=1)
                visible=c.call(dict(action='eval',code='Object.values(renderer.windows).some(w=>w.visible&&!w.isChild)'),timeout=1)
                if s['mainHwnd']!='0x0' and s['eip']!='0x0' and visible:break
            except Exception:pass
            assert time.monotonic()<end,'actual CLI readiness';time.sleep(.03)
        c.call(dict(action='eval',code="""globalThis.reserveEffects=[];
const down=renderer.handleKeyDown,up=renderer.handleKeyUp;
renderer.handleKeyDown=function(k){const v=down.call(this,k);reserveEffects.push({kind:'DOWN',at:Date.now(),key:k});return v};
renderer.handleKeyUp=function(k){const v=up.call(this,k);reserveEffects.push({kind:'UP',at:Date.now(),key:k});return v};true"""))
        c.opened();c.reserve();c.save('input-owner.json',c.call({'action':'guarded-bind'}))
        s=c.call({'action':'snapshot'});c.save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
    def finish(self,quit=True):
        effects=c.call(dict(action='eval',code='reserveEffects'))
        c.save('actual-renderer-effects.json',dict(effects=effects,originalGameProgress=False))
        super().finish(quit)
        return dict(effects=effects)
    def test_actual_cli_40ms_then_cutoff_zero_down_and_fresh_quit(self):
        self.start('reserve');self.fresh()
        try:
            c.pulse('forty',['keydown:40'],40,'fresh','reviewed synthetic actual renderer')
            self.assertEqual(c.read('forty-up.json')['state'],'ACK')
            self.assertEqual(c.read('forty-release-wait.json')['exit'],0)
            self.assertGreater(c.read('forty-progress.json')['postProgress']['batch'],c.read('forty-progress.json')['afterRelease']['batch'])
            # Wait outside the fresh review; cross during the actual lease.
            while time.time()<c.reserve()-.3:time.sleep(.01)
            self.fresh('crossing')
            lease=c.lease
            def crossing():
                result=lease()
                while time.time()<c.reserve():time.sleep(.005)
                return result
            c.lease=crossing
            try:
                with self.assertRaises(c.ReserveRejected):c.pulse('blocked',['keydown:39'],40,'crossing','default gameplay crossing cutoff')
            finally:c.lease=lease
            self.assertFalse((self.out/'blocked-armed.json').exists())
            self.assertFalse((self.out/'blocked-down.json').exists())
            self.fresh('ordinary-quit','leave-game')
            c.pulse('quit',['keydown:27'],100,'ordinary-quit','fresh ordinary Quit route after cutoff',intent='quit',route='leave-game')
        finally:s=self.finish()
        downs=[x for x in s['effects'] if x['kind']=='DOWN']
        self.assertEqual([x['key'] for x in downs],[40,27])
        down=downs[0];up=next(x for x in s['effects'] if x['kind']=='UP' and x['key']==40)
        self.assertGreaterEqual(up['at']-down['at'],39);self.assertLess(up['at']-down['at'],180)
    def test_actual_cli_late_ack_independent_up(self):
        self.start('late');self.fresh()
        try:
            with self.assertRaisesRegex(AssertionError,'late ACK'):c.pulse('late',['keydown:78'],40,'fresh','synthetic actual CLI delayed response')
            self.assertEqual(c.read('late-up.json')['state'],'ACK')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            with self.assertRaisesRegex(AssertionError,'sticky'):c.capture('no-replay')
        finally:s=self.finish()
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='DOWN']),1)
        self.assertEqual(len([x for x in s['effects'] if x['kind']=='UP']),1)
if __name__=='__main__':
    cls=ActualCLI if os.environ.get('LMARBLES_ACTUAL_CLI') else Reserve
    names=[n for n in cls.__dict__ if n.startswith('test_')]
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(cls(n) for n in names)).wasSuccessful())

"""Fixed-drag transport controls; --production exercises actual CLI/renderer.

Synthetic scenes and injected faults belong only to isolated fixtures. They
are never native Pegged progress. No public input or runtime code is changed.
"""
import pathlib, importlib.util, unittest, tempfile, time, json, os, threading, sys, subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
    s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
n=load('native','tools/pegged-native-controller.py');c=n.c
p=load('baseproduction','test/test-controller-production.py')


def scene():
    c.capture('fresh');rr=c.read('fresh.json')
    c.save('fresh-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,observation='Synthetic fixture review only; no native Pegged claim',mode='drag',sceneType='board',defaultBoard=True,originalRulesUnchanged=True,settledPaint=True,nativeSemantics='original-left-drag',sourcePeg='fixture-source',jumpedPeg='fixture-midpoint',emptyDestination='fixture-empty',legalReason='Synthetic fixture only',sourceOccupied=True,jumpedOccupied=True,destinationEmpty=True,remainingBefore=6,pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),sourceCenter=[200,240],destinationCenter=[200,120])))
    c.save('board-admitted.json',dict(fixture=True))


class HTTP(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();c.R=pathlib.Path(self.tmp.name)
        self.effects=[];self.states={};self.fault=None
        test=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*a):pass
            def do_POST(self):
                v=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                test.effects.append(dict(command=v,at=time.time()))
                if v['action']=='guarded-input':
                    g=v['guard'];state='CONSUMED'
                    if test.fault=='cancel':state='CANCELLED'
                    if test.fault=='unknown':state='UNKNOWN'
                    r=dict(owner=g['owner'],epoch=g['epoch'],nonce=g['nonce'],state=state,consumed=state=='CONSUMED',consumedAt=int(time.time()*1000) if state=='CONSUMED' else None)
                    test.states[g['nonce']]=r
                    if test.fault=='late' and v['cmd'].startswith('mousedown'):time.sleep(.22)
                else:r=dict(released=True,owner=v['owner'])
                try:self.send_response(200);self.end_headers();self.wfile.write(json.dumps(dict(ok=True,value=r)).encode())
                except BrokenPipeError:pass
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.server.serve_forever);self.thread.start()
        c.URL='http://127.0.0.1:'+str(self.server.server_port)+'/ctl'
        self.env=patch.dict(os.environ,FORSAKEN_CONTROL_OUT=str(c.R),FORSAKEN_CONTROL_URL=c.URL);self.env.start()
        c.save('native-pid.json',dict(pid=123,startToken='fixture'));c.save('launch.json',dict(at=time.time(),deadline=time.time()+900))
        self.owner=dict(owner='owner',epoch=1,identity='fixture')
        def capture(name):
            (c.R/(name+'.png')).write_bytes(b'fixture')
            import hashlib
            c.save(name+'.json',dict(at=time.time(),pngSHA256=hashlib.sha256(b'fixture').hexdigest(),target=c.read('native-pid.json'),snapshot=dict(mainHwnd='0x1',eip='0x2',screen=dict(w=800,h=600))))
            return str(c.R/(name+'.png'))
        self.cap=patch.object(c,'capture',capture);self.cap.start()
        self.lease=patch.object(c,'lease',return_value=(self.owner,dict(fixture=True)));self.lease.start()
        scene()
    def tearDown(self):
        self.lease.stop();self.cap.stop();self.env.stop();self.server.shutdown();self.thread.join();self.server.server_close();self.tmp.cleanup()
    def test_fixed_edges_and_independent_arm(self):
        n.drag('one','fresh',350)
        self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240','mousemove:200:120','mouseup:200:120',None])
        self.assertTrue(c.read('one-armed.json')['armed'])
        self.assertTrue(c.read('one-release-wait.json')['stdoutEOF'])
        self.assertLess(self.effects[2]['at']-self.effects[0]['at'],.45)
        self.assertFalse(c.read('one-completed.json')['actualRemovalClaim'])
    def test_unknown_closes_without_move_or_destination(self):
        self.fault='unknown'
        with self.assertRaises(AssertionError):n.drag('unknown','fresh',350)
        self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None])
        self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
    def test_cancel_never_continues(self):
        self.fault='cancel'
        with self.assertRaises(AssertionError):n.drag('cancel','fresh',350)
        self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None])
    def test_late_ack_releases_without_move(self):
        self.fault='late'
        with self.assertRaisesRegex(AssertionError,'late DOWN'):n.drag('late','fresh',250)
        self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None])
        self.assertLess(self.effects[-1]['at']-self.effects[0]['at'],.5)
    def test_slow_persistence_occurs_after_physical_up(self):
        real=c.save;delays=[]
        def slow(name,value):
            if name=='slow-edges.json':
                delays.append(time.time());time.sleep(.3)
            return real(name,value)
        with patch.object(c,'save',slow):n.drag('slow','fresh',350)
        self.assertGreater(delays[0],self.effects[-1]['at'])
        self.assertLess(self.effects[2]['at']-self.effects[0]['at'],.45)
    def test_slow_intent_persistence_refuses_before_down(self):
        real=c.save
        def slow(name,value):
            result=real(name,value)
            if name=='slowprep-drag-intent.json':time.sleep(1.5)
            return result
        with patch.object(c,'save',slow):
            with self.assertRaisesRegex(AssertionError,'before DOWN'):n.drag('slowprep','fresh',350)
        self.assertFalse(any(e['command'].get('cmd','').startswith('mousedown') for e in self.effects))
        self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
    def test_no_capture_while_held(self):
        real=c.capture
        def capture(name):
            if name=='one':self.assertEqual(self.effects[-1]['command']['action'],'guarded-release')
            return real(name)
        with patch.object(c,'capture',capture):n.drag('one','fresh',350)
    def test_independent_1750_fallback_without_parent_schedule(self):
        start=time.time()
        plan=dict(owner=self.owner,target=c.read('native-pid.json'),fallbackAt=start+1.750,gestureDeadline=start+1.5,destination=[200,120],nonces=['d','m','u'],milliseconds=500)
        c.save('fallback-drag-intent.json',plan)
        child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/pegged-native-controller.py'),'release-drag','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        self.assertTrue(json.loads(child.stdout.readline())['armed'])
        child.wait(timeout=3);out,err=child.communicate()
        self.assertEqual(child.returncode,0,(out,err))
        self.assertEqual(self.effects[0]['command']['action'],'guarded-release')
        self.assertGreaterEqual(self.effects[0]['at'],plan['fallbackAt']-.01)
        self.assertLess(self.effects[0]['at'],plan['fallbackAt']+.15)
        self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
    def test_parent_death_releases_and_stays_closed(self):
        # Real subprocess death closes the prearmed child's pipe. It must never
        # submit a destination UP based on a parent that disappeared midprefix.
        code="""import importlib.util,sys,os,signal,json
s=importlib.util.spec_from_file_location('n',sys.argv[1]);n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
n.c.lease=lambda:({'owner':'owner','epoch':1,'identity':'fixture'}, {})
real=n.c.call
def killed(v,timeout=10):
 r=real(v,timeout)
 if v['action']=='guarded-input':os.kill(os.getpid(),signal.SIGKILL)
 return r
n.c.call=killed;n.drag('killed','fresh',350)
"""
        child=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/pegged-native-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        out,err=child.communicate(timeout=5);self.assertEqual(child.returncode,-9,(out,err))
        end=time.time()+2
        while not (c.R/'killed-up.json').exists() and time.time()<end:time.sleep(.01)
        self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF')
        self.assertEqual([e['command'].get('cmd') for e in self.effects],['mousedown:200:240',None])
        self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])


class Production(p.Production):
    def start(self,name):
        p.c=c;p.p.c=c;p.b.control=c
        original=c.bind
        def bind():
            c.call(dict(action='eval',code="""for(const [method,kind] of [['handleMouseDown','MOUSEDOWN'],['handleMouseMove','MOUSEMOVE'],['handleMouseUp','MOUSEUP']]){
const original=renderer[method];renderer[method]=function(...args){const result=original.apply(this,args);persistenceEffects.push({kind,at:Date.now(),args});return result;}}true"""))
            original()
        with patch.object(c,'bind',bind):super().start(name)
        # Only test fixture extends its duration metadata for 180s Quit reserve.
        launch=c.read('launch.json');(c.R/'launch.json').unlink();c.save('launch.json',{**launch,'deadline':launch['at']+900})
    def test_actual_fixed_drag(self):
        self.start('peg-native-drag')
        try:scene();n.drag('one','fresh',500)
        finally:summary=self.finish()
        es=[v for v in summary['effects'] if v['kind'].startswith('MOUSE')]
        down=next(v for v in es if v['kind']=='MOUSEDOWN')
        move=next(v for v in es if v['kind']=='MOUSEMOVE' and v['at']>=down['at'] and v['args'][:2]==[200,120])
        up=next(v for v in es if v['kind']=='MOUSEUP' and v['at']>=move['at'])
        self.assertEqual(up['args'][:2],[200,120]);self.assertLess(up['at']-down['at'],1500)
        c.save('physical-drag-timing.json',dict(down=down,move=move,up=up,holdMilliseconds=up['at']-down['at'],fixture=True))
    def test_actual_late_move_closes(self):
        self.start('peg-native-late-move')
        real=c.call
        def late(v,timeout=10):
            reply=real(v,timeout)
            if v.get('cmd','').startswith('mousemove'):time.sleep(.48)
            return reply
        try:
            scene()
            with patch.object(c,'call',late):
                with self.assertRaisesRegex(AssertionError,'late MOVE'):n.drag('late','fresh',500)
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        finally:summary=self.finish()
        es=summary['effects'];d=next(v for v in es if v['kind']=='MOUSEDOWN');u=next(v for v in es if v['kind']=='MOUSEUP' and v['at']>=d['at'])
        self.assertLess(u['at']-d['at'],1750);self.assertEqual(u['args'][:2],[200,240])

    def test_actual_queued_down_is_cancelled_without_move(self):
        self.start('peg-native-queued')
        try:
            scene();c.call(dict(action='frozen',mode='on'))
            with self.assertRaisesRegex(AssertionError,'DOWN unresolved'):n.drag('queued','fresh',500)
            c.call(dict(action='frozen',mode='off'))
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        finally:summary=self.finish()
        self.assertFalse(any(v['kind']=='MOUSEDOWN' for v in summary['effects']))
    def test_actual_identity_change_after_down_never_moves(self):
        self.start('peg-native-identity')
        real=c.call
        def changed(v,timeout=10):
            reply=real(v,timeout)
            if v.get('cmd','').startswith('mousedown'):
                real(dict(action='eval',code='const h=instance.exports.get_main_hwnd();renderer.windows[h]={...renderer.windows[h]};true'))
            return reply
        try:
            scene()
            with patch.object(c,'call',changed):
                with self.assertRaisesRegex(AssertionError,'MOVE unresolved'):n.drag('changed','fresh',500)
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        finally:summary=self.finish()
        d=next(v for v in summary['effects'] if v['kind']=='MOUSEDOWN')
        self.assertFalse(any(v['kind']=='MOUSEMOVE' and v['args'][:2]==[200,120] for v in summary['effects']))
        self.assertTrue(any(v['kind']=='MOUSEUP' and v['at']>=d['at'] for v in summary['effects']))
    def test_actual_unknown_down_closes(self):
        self.start('peg-native-unknown')
        real=c.call
        def lost(v,timeout=10):
            reply=real(v,timeout)
            if v.get('cmd','').startswith('mousedown'):raise TimeoutError('fixture dropped consumed DOWN acknowledgement')
            return reply
        try:
            scene()
            with patch.object(c,'call',lost):
                with self.assertRaises(TimeoutError):n.drag('lost','fresh',500)
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        finally:summary=self.finish()
        self.assertEqual(len([v for v in summary['effects'] if v['kind']=='MOUSEDOWN']),1)
        self.assertFalse(any(v['kind']=='MOUSEUP' and v['args'][:2]==[200,120] for v in summary['effects']))
    def test_actual_parent_death_releases_source(self):
        self.start('peg-native-death')
        try:
            scene()
            code="""import importlib.util,sys,os,signal
s=importlib.util.spec_from_file_location('n',sys.argv[1]);n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
real=n.c.call
def killed(v,timeout=10):
 reply=real(v,timeout)
 if v.get('cmd','').startswith('mousedown'):os.kill(os.getpid(),signal.SIGKILL)
 return reply
n.c.call=killed;n.drag('killed','fresh',500)
"""
            parent=subprocess.Popen([sys.executable,'-B','-c',code,str(ROOT/'tools/pegged-native-controller.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            out,err=parent.communicate(timeout=6)
            c.save('killed-parent-wait.json',dict(pid=parent.pid,exit=parent.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            self.assertEqual(parent.returncode,-9)
            p.b.waitfile(c.R/'killed-up.json')
            self.assertEqual(c.read('killed-up.json')['reason'],'parent EOF')
            self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
            c.save('orphan-release-wait-unavailable.json',dict(actualWait=False,parentKilled=True))
        finally:summary=self.finish()
        d=next(v for v in summary['effects'] if v['kind']=='MOUSEDOWN');u=next(v for v in summary['effects'] if v['kind']=='MOUSEUP' and v['at']>=d['at'])
        self.assertLess(u['at']-d['at'],1750);self.assertEqual(u['args'][:2],[200,240])
    def test_actual_slow_persistence_follows_up(self):
        self.start('peg-native-slow')
        real=c.save;delays=[]
        def slow(name,value):
            if name=='slow-edges.json':delays.append(time.time());time.sleep(.3)
            return real(name,value)
        try:
            scene()
            with patch.object(c,'save',slow):n.drag('slow','fresh',500)
        finally:summary=self.finish()
        d=next(v for v in summary['effects'] if v['kind']=='MOUSEDOWN');u=next(v for v in summary['effects'] if v['kind']=='MOUSEUP' and v['at']>=d['at'])
        self.assertLess(u['at']-d['at'],1500);self.assertGreater(delays[0]*1000,u['at'])
    def test_actual_fallback_independent_of_silent_parent(self):
        self.start('peg-native-fallback')
        try:
            owner=c.read('input-owner.json');at=time.time()
            plan=dict(owner=owner,target=c.read('native-pid.json'),fallbackAt=at+1.750,gestureDeadline=at+1.5,destination=[200,120],nonces=['fallback-d','fallback-m','fallback-u'],milliseconds=500)
            c.save('fallback-drag-intent.json',plan)
            child=subprocess.Popen([sys.executable,'-B',str(ROOT/'tools/pegged-native-controller.py'),'release-drag','fallback'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            arm=json.loads(child.stdout.readline());self.assertTrue(arm['armed'])
            down=c.call(dict(action='guarded-input',cmd='mousedown:200:240',guard={**owner,'nonce':'fallback-d','reviewed':True,'deadline':int((at+2)*1000)}))
            self.assertTrue(down['consumed'])
            child.wait(timeout=3);out,err=child.communicate()
            c.save('fallback-child-wait.json',dict(pid=child.pid,exit=child.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
            self.assertEqual(child.returncode,0);self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        finally:summary=self.finish()
        d=next(v for v in summary['effects'] if v['kind']=='MOUSEDOWN');u=next(v for v in summary['effects'] if v['kind']=='MOUSEUP' and v['at']>=d['at'])
        self.assertLess(u['at']-d['at'],1800);self.assertGreater(u['at']-d['at'],1500);self.assertEqual(u['args'][:2],[200,240])

if __name__=='__main__':
    cls=Production if '--production' in sys.argv else HTTP
    suite=unittest.TestSuite(cls(k) for k in cls.__dict__ if k.startswith('test_'))
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

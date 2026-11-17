"""Generated native USER transitions only; no original application or game reads."""
import importlib.util,pathlib,sys,time,json,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('native_error',ROOT/'test/test-sims-error-ok-native.py')
n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
a,c=n.a,n.c
BASELINE='--baseline' in sys.argv

class NativeSceneContext(n.NativeErrorOK):
    def test_focus_changed_before_consumption(self):
        rr=c.read('native-scene.json');c.bind(reviewedScene=dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256']))
        c.call(dict(action='frozen',mode='on'))
        owner=c.read('input-owner.json')
        queued=c.call(dict(action='guarded-input',cmd='mousedown:187:139',guard={**owner,'nonce':'focus-native-negative','reviewed':True,'deadline':int(time.time()*1000)+2000,'intent':rr['snapshot']}))
        self.assertFalse(queued['consumed'])
        c.call(dict(action='eval',code='instance.exports.set_focus(instance.exports.get_main_hwnd());true'))
        c.call(dict(action='step',n=1))
        receipt=c.call(dict(action='guarded-status',nonce='focus-native-negative'))
        self.assertFalse(receipt['consumed']);self.assertEqual(receipt['state'],'CANCELLED')
        self.assertEqual(receipt['reason'],'reviewed native scene changed')
        c.save('native-focus-refused.json',receipt);c.fail('fixture deliberately changed native focus; closed','negative')

    def test_transition(self):
        if BASELINE:a.bind('native-scene')
        else:
            rr=c.read('native-scene.json');c.bind(reviewedScene=dict(route='native-scene-v1',snapshot=rr['snapshot'],pngSHA256=rr['pngSHA256']))
        original_call=c.call
        current=[None]
        if not BASELINE:
            def call(command,timeout=10):
                if command.get('action')=='guarded-input':command={**command,'guard':{**command['guard'],'intent':current[0]}}
                return original_call(command,timeout)
            c.call=call
        try:
            for index in range(2):
                scene='choice'+str(index);c.capture(scene);rr=c.read(scene+'.json');current[0]=rr['snapshot']
                controls=c.call(dict(action='eval',code="""(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()"""))
                button=next(x for x in controls if x['id']==1);point=[button['x']+button['w']//2,button['y']+button['h']//2]
                final=index==1;mode='quit' if final else 'install';route='cancel-installer' if final else 'next'
                c.save(scene+'-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,rawCompleteScene=True,observation='Automated generated native USER fixture only; no personal/original review claim',mode=mode,sceneType='installer',ordinaryNativeUI=True,visibleLabel='OK',installRoute='next',serialRequired=False,mediaCheckBypassed=False,quitRoute=route,visibleQuitTarget=True,pixelGeometry=dict(source='current-full-scene',target=rr['target'],chosenCenter=point)))
                if BASELINE and index:
                    with self.assertRaises(AssertionError):a.action('press1','mousedown:'+':'.join(map(str,point)),scene,mode,400,route)
                    self.assertFalse(c.read('press1-receipt.json')['consumed'])
                    c.save('baseline-transition-refused.json',dict(firstModal=self.modal,secondModal=next(w for w in rr['snapshot']['windows'] if w['hwnd']==rr['snapshot']['modalHwnd']),noRebind=True))
                    return
                a.action('press'+str(index),'mousedown:'+':'.join(map(str,point)),scene,mode,400,route)
            end=time.monotonic()+5
            while not (self.out/'native-wait.json').exists() and time.monotonic()<end:time.sleep(.02)
            self.assertEqual(c.read('native-wait.json')['exit'],0)
            self.assertIn('[Exit] code=0',(self.out/'native.stdout.log').read_text())
        finally:c.call=original_call

    def tearDown(self):
        if not (self.out/'native-wait.json').exists():c.save('cancel-request.json',dict(fixtureOnly=True,hostStop=True))
        out,err=self.p.communicate(timeout=10)
        c.save('fixture-launcher-wait.json',dict(pid=self.p.pid,exit=self.p.returncode,actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
        for name in ['native-wait.json','watchdog-wait.json','outer-child-wait.json']:
            self.assertTrue(all(c.read(name).get(k) is True for k in ['actualWait','stdoutEOF','stderrEOF']))

if __name__=='__main__':
    n.n.m.NATIVE_OUT=pathlib.Path(sys.argv[1]).resolve();n.n.m.NATIVE_FIXTURE=pathlib.Path(sys.argv[2]).resolve()
    names=['test_transition'] if BASELINE else ['test_transition','test_focus_changed_before_consumption']
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([NativeSceneContext(name) for name in names])).wasSuccessful())

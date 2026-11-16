"""Exact generated NULL-owner MB_ICONHAND|MB_OK; fixture public USER only."""
import importlib.util, pathlib, sys, time, json, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('null_owner_controls',ROOT/'test/test-sims-null-owner-modal.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
a,c=n.a,n.c

class NativeErrorOK(n.NativeNullOwner):
    def test_native_cancel_exit(self):
        # Override inherited OKCANCEL test: this exact box has only IDOK.
        self.dismiss(False)

    def test_titlebar_close(self):
        self.dismiss(True)

    def dismiss(self,nonclient):
        a.bind('native-scene')
        controls=c.call(dict(action='eval',code="""(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];
for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({hwnd:c,id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()"""))
        c.save('native-read-controls.json',dict(controls=controls,fixtureOnly=True))
        self.assertEqual([x['id'] for x in controls if x['id'] in (1,2)],[1])
        button=next(x for x in controls if x['id']==1)
        # Exact native screen rect; titlebar inspection is independently
        # compared to result PNG before any product hit-testing change.
        if nonclient:
            rect=c.call(dict(action='eval',code="""(()=>{const e=instance.exports,h=e.modal_dialog_hwnd();return {x:e.wnd_window_screen_x(h),y:e.wnd_window_screen_y(h),w:e.wnd_screen_w(h),h:e.wnd_screen_h(h)}})()"""))
            point=[rect['x']+rect['w']-12,rect['y']+10]
        else: point=[button['x']+button['w']//2,button['y']+button['h']//2]
        if nonclient:
            # Read-only native/public renderer observations in this fixture.
            # Guarded input methods and source identities stay untouched.
            c.call(dict(action='eval',code="""(()=>{const e=instance.exports,h=e.modal_dialog_hwnd();
const w=renderer.windows[h];globalThis.fixtureNCTrace={hit:e.hittest_sync(h,%d,%d),
isDialog:!!w.isDialog,isAboutDialog:!!w.isAboutDialog,workerRoute:renderer._inputWasmRunsInGuestWorker(w.wasm||renderer.wasm)};
return globalThis.fixtureNCTrace})()"""%tuple(point)))
        c.capture('dismiss-scene');r=c.read('dismiss-scene.json')
        c.save('dismiss-scene-review.json',dict(at=time.time(),pngSHA256=r['pngSHA256'],submittedScene=True,
            rawCompleteScene=True,observation='Generated exact native error '+('titlebar X' if nonclient else 'OK'),
            mode='quit',sceneType='installer',ordinaryNativeUI=True,visibleLabel='X' if nonclient else 'OK',
            quitRoute='cancel-installer',visibleQuitTarget=True,
            pixelGeometry=dict(source='current-full-scene',target=r['target'],chosenCenter=point)))
        a.action('native-dismiss','mousedown:'+':'.join(map(str,point)),'dismiss-scene','quit',120,'cancel-installer')
        end=time.monotonic()+3
        while not (self.out/'native-wait.json').exists() and time.monotonic()<end: time.sleep(.02)
        if not (self.out/'native-wait.json').exists():
            c.capture('persisted-scene')
            after=c.read('persisted-scene.json')['snapshot']
            c.save('dismissal-diagnostic.json',dict(nativeExit=False,beforeModal=self.modal,
                afterModal=next((w for w in after['windows'] if w['hwnd']==after['modalHwnd']),None),
                physicalUP=c.read('native-dismiss-up.json'),consumption=c.read('native-dismiss-receipt.json'),
                nativeRoute=c.call(dict(action='eval',code="(()=>{const e=instance.exports;return {before:globalThis.fixtureNCTrace||null,drag:!!renderer._sysBtnDrag,queue:Array.from({length:e.post_queue_depth()},(_,i)=>[0,1,2,3].map(n=>e.post_queue_peek(i,n)))}})()"))))
        self.assertTrue((self.out/'native-wait.json').exists(),'consumption/UP did not prove dismissal; inspect native generation')
        self.assertEqual(c.read('native-wait.json')['exit'],0)
        self.assertIn('[Exit] code=0',(self.out/'native.stdout.log').read_text())
        self.assertFalse((self.out/'cancellation.json').exists())
        self.assertLessEqual(c.read('native-dismiss-up.json')['at']-c.read('native-dismiss-intent.json')['createdAt'],1.750)

if __name__=='__main__':
    assert len(sys.argv) in (3,4),'output directory, generated error-ok EXE, optional test name'
    n.m.NATIVE_OUT=pathlib.Path(sys.argv[1]).resolve();n.m.NATIVE_FIXTURE=pathlib.Path(sys.argv[2]).resolve()
    suite=(unittest.TestSuite([NativeErrorOK(sys.argv[3])]) if len(sys.argv)==4 else
           unittest.defaultTestLoader.loadTestsFromTestCase(NativeErrorOK))
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

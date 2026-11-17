"""Controller admission contracts. Synthetic records, no native UI proof.

Actual generated native untitled/owned-modal and finite Cancel controls
separately test the native endpoint and ordinary guest consequence.
"""
import copy, hashlib, importlib.util, json, pathlib, tempfile, time, unittest, sys, os, socket, subprocess
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sims_untitled', ROOT/'tools/sims-install-controller.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)

c = a.c


class UntitledModal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        c.R = pathlib.Path(self.tmp.name)
        self.clock = patch.object(time, 'time', return_value=500)
        self.clock.start()
        c.save('launch.json', dict(at=100, deadline=1300))
        c.save('native-pid.json', dict(pid=123, startToken='fixture'))
        pixels = b'synthetic complete scene only'
        (c.R/'scene.png').write_bytes(pixels)
        sha = hashlib.sha256(pixels).hexdigest()
        self.main = dict(hwnd='0x1', title='', visible=True, isChild=False,
                         processId=1, generation=7, owner='0x0', parent='0x0', live=True)
        self.modal = dict(hwnd='0x2', title='InstallShield', visible=True,
                          isChild=False, processId=1, generation=9, owner='0x1', parent='0x0', live=True)
        self.snapshot = dict(mainHwnd='0x1', eip='0x401000', screen=dict(w=800,h=600),
                             focus='0x2', capture='0x0', modalHwnd='0x2', windows=[self.main, self.modal],
                             physicalUp=True, nativeProcess=dict(pid=123, executable='C:\\Fixture.exe'))
        self.snapshot.update(focusTopLevel='0x2', focusWindow=dict(hwnd='0x2', live=True, generation=9, processId=1))
        self.review = dict(at=499, submittedScene=True, rawCompleteScene=True,
                           observation='Synthetic untitled splash and owned modal only',
                           pngSHA256=sha, sceneType='installer', exactReleaseReviewed=True,
                           completeBootstrapReviewed=True, nativeTitle='',
                           reviewedOwnedModal=copy.deepcopy(self.modal))
        self.record = dict(at=499, pngSHA256=sha, target=c.read('native-pid.json'), snapshot=self.snapshot)
        c.save('scene.json', self.record)
        c.save('scene-review.json', self.review)

    def tearDown(self):
        self.clock.stop()
        self.tmp.cleanup()

    def persist(self):
        (c.R/'scene.json').write_text(json.dumps(self.record))
        (c.R/'scene-review.json').write_text(json.dumps(self.review))

    def admitted(self):
        def endpoint(*args, **kwargs):
            c.save('lease-snapshot.json', {k:self.snapshot[k] for k in ('mainHwnd','screen')})
        with patch.object(c, 'bind', side_effect=endpoint) as bound:
            a.bind('scene')
            self.assertEqual(bound.call_count, 1)

    def refused(self):
        self.persist()
        with patch.object(c, 'bind') as bound:
            with self.assertRaises((AssertionError, KeyError, ValueError)):
                a.bind('scene')
            bound.assert_not_called()

    def test_untitled_main_with_exact_reviewed_owned_modal(self):
        self.admitted()

    def test_empty_main_without_reviewed_modal(self):
        self.review.pop('reviewedOwnedModal'); self.refused()

    def test_wrong_owner(self):
        self.modal['owner']='0x99'; self.refused()

    def test_sibling_is_not_reviewed_modal(self):
        self.snapshot['windows'][1]={**self.modal,'hwnd':'0x3'}; self.refused()

    def test_replacement_generation(self):
        self.modal['generation']+=1; self.refused()

    def test_unowned_modal(self):
        self.modal['owner']='0x0'; self.refused()

    def test_foreign_process_modal(self):
        self.modal['processId']=2; self.refused()

    def test_hidden_modal(self):
        self.modal['visible']=False; self.refused()

    def test_visible_sibling_is_not_native_modal(self):
        self.snapshot['modalHwnd']='0x3'; self.refused()

    def test_stale_scene(self):
        self.record['at']=460; self.refused()

    def test_capture_held(self):
        self.snapshot['capture']='0x2'; self.refused()

    def test_focus_outside_owned_modal(self):
        self.snapshot['focus']='0x99'; self.refused()

    def test_physical_button_held(self):
        self.snapshot['physicalUp']=False; self.refused()

    def test_dead_main(self):
        self.main['live']=False; self.refused()

    def test_dead_modal(self):
        self.modal['live']=False; self.refused()

    def test_foreign_native_pid(self):
        self.snapshot['nativeProcess']['pid']=124; self.refused()

    def test_painted_bytes_changed(self):
        (c.R/'scene.png').write_bytes(b'replaced scene'); self.refused()

    def test_current_nonempty_main_title_still_admitted(self):
        self.main['title']='Sims Setup'; self.review['nativeTitle']='Sims Setup'
        self.review.pop('reviewedOwnedModal'); self.persist(); self.admitted()


class NativeUntitled(unittest.TestCase):
    """Ordinary generated PE calls CreateWindowEx/MessageBox, actual HTTP guard.

    Diagnostic evals below touch only this generated fixture's public USER
    records/renderer. No eval or fault injection is used in the original run.
    """
    def setUp(self):
        self.out = NATIVE_OUT/self._testMethodName
        self.out.mkdir(parents=True)
        c.R = self.out
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
        c.URL = 'http://127.0.0.1:'+str(port)+'/ctl'
        os.environ.update(SIMS_CONTROL_OUT=str(self.out), SIMS_CONTROL_URL=c.URL)
        args = ['node', 'test/run.js', '--exe='+str(NATIVE_FIXTURE), '--no-build', '--real-ticks',
                '--screen=800x600', '--max-seconds=25', '--max-batches=100000000', '--stuck-after=0',
                '--control='+str(port), '--quiet-api', '--quiet-blocks', '--no-close']
        c.save('recipe.json', dict(args=args, cwd=str(ROOT), seconds=240, watchdogGrace=2))
        self.p = subprocess.Popen([sys.executable, '-B', str(ROOT/'tools/forsaken-supervisor.py'),
                                  'outerwait', str(self.out)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        end = time.monotonic()+15
        while True:
            try:
                s = c.call(dict(action='snapshot'), timeout=1)
                if s['modalHwnd'] != '0x0' and (self.out/'native-pid.json').exists(): break
            except (OSError, RuntimeError): pass
            assert time.monotonic()<end, 'native fixture readiness'
            time.sleep(.02)
        c.capture('native-scene')
        self.s = c.read('native-scene.json')['snapshot']
        self.main = next(w for w in self.s['windows'] if w['hwnd']==self.s['mainHwnd'])
        self.modal = next(w for w in self.s['windows'] if w['hwnd']==self.s['modalHwnd'])
        self.assertEqual(self.main['title'], '')
        c.save('native-scene-review.json', dict(at=time.time(), submittedScene=True, rawCompleteScene=True,
            observation='Generated native untitled main and owned InstallShield modal fixture',
            pngSHA256=c.read('native-scene.json')['pngSHA256'], sceneType='installer',
            exactReleaseReviewed=True, completeBootstrapReviewed=True, nativeTitle='', reviewedOwnedModal=self.modal))
        self.expected = dict(main=self.main, modal=self.modal, nativeProcess=self.s['nativeProcess'],
            screen=self.s['screen'], focus=self.s['focus'], focusWindow=self.s['focusWindow'],
            pngSHA256=c.read('native-scene.json')['pngSHA256'])

    def tearDown(self):
        if not (self.out/'native-wait.json').exists():
            try: c.call(dict(action='quit'), timeout=2)
            except Exception: c.save('cancel-request.json', dict(fixtureTeardown=True))
        out, err = self.p.communicate(timeout=10)
        c.save('fixture-launcher-wait.json', dict(pid=self.p.pid, exit=self.p.returncode,
            actualWait=True, stdoutEOF=True, stderrEOF=True, stdout=out.decode(), stderr=err.decode()))
        for name in ('native-wait.json','watchdog-wait.json','outer-child-wait.json'):
            w=c.read(name)
            self.assertTrue(all(w.get(k) is True for k in ('actualWait','stdoutEOF','stderrEOF')))
            self.assertEqual(w['exit'], 0)

    def endpoint_refused(self, expected):
        with self.assertRaises(RuntimeError): c.bind(reviewedScene=expected)
        self.assertTrue(c.read('terminal-input-failure.json')['noReplay'])
        with self.assertRaisesRegex(RuntimeError, 'permanent'): c.call(dict(action='guarded-bind'))
        self.assertFalse((self.out/'input-owner.json').exists())

    def test_native_cancel_exit(self):
        # The previously released policy refuses this *actual* native scene.
        old=subprocess.check_output(['git','show',os.environ.get('SIMS_BASELINE_HEAD','a30b71d01319966199754dc2812465f61d1a6e4d')+':tools/sims-install-controller.py'],cwd=ROOT,text=True)
        namespace={'__file__':str(ROOT/'tools/sims-install-controller.py'),'__name__':'baseline'}
        exec(compile(old, namespace['__file__'], 'exec'), namespace)
        namespace['c'].R=c.R
        with self.assertRaises(AssertionError): namespace['bind']('native-scene')
        a.bind('native-scene')
        controls=c.call(dict(action='eval',code="""(()=>{const e=instance.exports,h=e.modal_dialog_hwnd(),out=[];
for(let s=0;(s=e.wnd_next_child_slot(h,s))!==-1;s++){const c=e.wnd_slot_hwnd(s);out.push({hwnd:c,id:e.ctrl_get_id(c),x:e.wnd_window_screen_x(c),y:e.wnd_window_screen_y(c),w:e.wnd_screen_w(c),h:e.wnd_screen_h(c)})}return out})()"""))
        c.save('native-read-controls.json', dict(controls=controls, fixtureOnly=True))
        button=next(v for v in controls if v['id']==2)
        point=[button['x']+button['w']//2, button['y']+button['h']//2]
        c.capture('cancel-scene');rr=c.read('cancel-scene.json')
        c.save('cancel-scene-review.json',dict(at=time.time(),pngSHA256=rr['pngSHA256'],submittedScene=True,
            rawCompleteScene=True,observation='Generated native modal Cancel button',mode='quit',sceneType='installer',
            ordinaryNativeUI=True,visibleLabel='Cancel',quitRoute='cancel-installer',visibleQuitTarget=True,
            pixelGeometry=dict(source='current-full-scene',target=rr['target'],chosenCenter=point)))
        a.action('native-cancel','mousedown:'+':'.join(map(str,point)),'cancel-scene','quit',120,'cancel-installer')
        end=time.monotonic()+5
        while not (self.out/'native-wait.json').exists() and time.monotonic()<end: time.sleep(.02)
        self.assertEqual(c.read('native-wait.json')['exit'],0)
        self.assertIn('[Exit] code=0',(self.out/'native.stdout.log').read_text())
        self.assertFalse((self.out/'cancellation.json').exists())
        self.assertLessEqual(c.read('native-cancel-up.json')['at']-c.read('native-cancel-intent.json')['createdAt'],1.750)

    def test_wrong_owner(self):
        v=copy.deepcopy(self.expected);v['modal']['owner']='0x99';self.endpoint_refused(v)

    def test_sibling(self):
        v=copy.deepcopy(self.expected);v['modal']['hwnd']=self.main['hwnd'];self.endpoint_refused(v)

    def test_stale_generation(self):
        v=copy.deepcopy(self.expected);v['modal']['generation']='999999';self.endpoint_refused(v)

    def test_unowned_modal(self):
        v=copy.deepcopy(self.expected);v['modal']['owner']='0x0';self.endpoint_refused(v)

    def test_foreign_process(self):
        v=copy.deepcopy(self.expected);v['nativeProcess']['pid']+=1;self.endpoint_refused(v)

    def test_stale_paint(self):
        v=copy.deepcopy(self.expected);v['pngSHA256']='0'*64;self.endpoint_refused(v)

    def test_stale_review_before_binding(self):
        record=c.read('native-scene.json');record['at']-=40
        (self.out/'native-scene.json').write_text(json.dumps(record))
        with self.assertRaisesRegex(AssertionError,'expired'): a.bind('native-scene')
        self.assertFalse((self.out/'bind-intent.json').exists())

    def test_hidden_native_modal(self):
        c.call(dict(action='eval',code='renderer.windows[instance.exports.modal_dialog_hwnd()].visible=false;true'))
        self.endpoint_refused(self.expected)

    def test_changed_focus(self):
        c.call(dict(action='eval',code='instance.exports.set_focus(instance.exports.get_main_hwnd());true'))
        self.endpoint_refused(self.expected)

    def test_held_physical_input(self):
        c.call(dict(action='eval',code='renderer._mouseButtonsMask=1;true'))
        self.endpoint_refused(self.expected)
        c.call(dict(action='eval',code='renderer._mouseButtonsMask=0;true'))

    def test_native_replacement_after_binding(self):
        a.bind('native-scene')
        c.call(dict(action='frozen',mode='on'))
        owner=c.read('input-owner.json')
        ticket=c.call(dict(action='guarded-input',cmd='mousedown:200:200',guard={**owner,'nonce':'replacement','reviewed':True,'deadline':int(time.time()*1000)+2000}))
        self.assertFalse(ticket['consumed'])
        c.call(dict(action='eval',code='const h=instance.exports.modal_dialog_hwnd();instance.exports.wnd_destroy_tree(h);instance.exports.test_wnd_table_set(h,0xffff0001);true'))
        c.call(dict(action='step',n=1))
        status=c.call(dict(action='guarded-status',nonce='replacement'))
        self.assertFalse(status['consumed']);self.assertEqual(status['state'],'CANCELLED')
        c.call(dict(action='frozen',mode='off'))


if __name__ == '__main__':
    if '--native' in sys.argv:
        i=sys.argv.index('--native');NATIVE_OUT=pathlib.Path(sys.argv[i+1]).resolve();NATIVE_FIXTURE=pathlib.Path(sys.argv[i+2]).resolve()
        raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(NativeUntitled)).wasSuccessful())
    unittest.main(defaultTest='UntitledModal')

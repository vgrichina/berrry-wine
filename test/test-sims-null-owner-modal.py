"""Actual native ownerless MessageBox route; reuse qualified transport controls.

Fixture-only eval is restricted to public USER records/renderer diagnostics.
Original runs never use eval or synthesize HWND ownership.
"""
import copy, importlib.util, pathlib, sys, unittest, json
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('owned_modal_controls',ROOT/'test/test-sims-untitled-owned-modal.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a,c=m.a,m.c

class NullOwnerPolicy(m.UntitledModal):
    def setUp(self):
        super().setUp()
        self.main['threadId']=1;self.modal.update(threadId=1,owner='0x0')
        self.snapshot['focusWindow']['threadId']=1
        self.snapshot['nativeMessageBox']=dict(hwnd=self.modal['hwnd'],generation=self.modal['generation'],
            processId=1,threadId=1,controlClass=16)
        self.review.pop('reviewedOwnedModal')
        self.review['reviewedNativeMessageBox']=copy.deepcopy(self.modal)
        self.persist()

    def test_unowned_modal(self):
        self.review.pop('reviewedNativeMessageBox');self.refused()

    def test_empty_main_without_reviewed_modal(self):
        self.review.pop('reviewedNativeMessageBox');self.refused()

    def test_current_nonempty_main_title_still_admitted(self):
        self.main['title']='Sims Setup';self.review['nativeTitle']='Sims Setup'
        self.review.pop('reviewedNativeMessageBox');self.persist();self.admitted()

    def test_wrong_thread(self):
        self.modal['threadId']=2;self.refused()

    def test_not_native_message_box(self):
        self.snapshot['nativeMessageBox']['controlClass']=0;self.refused()

    def test_native_sibling(self):
        self.snapshot['nativeMessageBox']['hwnd']=self.main['hwnd'];self.refused()

    def test_native_foreign_process(self):
        self.snapshot['nativeMessageBox']['processId']=2;self.refused()

    def test_native_stale_generation(self):
        self.snapshot['nativeMessageBox']['generation']+=1;self.refused()

class NativeNullOwner(m.NativeUntitled):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.modal['owner'],'0x0')
        self.assertEqual(self.modal['threadId'],self.main['threadId'])
        self.assertEqual(self.s['nativeMessageBox']['hwnd'],self.modal['hwnd'])
        self.assertEqual(self.s['nativeMessageBox']['controlClass'],16)
        review=c.read('native-scene-review.json')
        review['reviewedNativeMessageBox']=review.pop('reviewedOwnedModal')
        review['observation']='Generated actual MessageBoxA(NULL) native modal, genuine owner zero'
        (self.out/'native-scene-review.json').write_text(json.dumps(review))
        self.expected.update(modalRoute='null-owner-message-box',nativeMessageBox=self.s['nativeMessageBox'])

    def test_unowned_modal(self):
        # Owner zero alone is never an authorization route.
        v=copy.deepcopy(self.expected);v.pop('modalRoute');v.pop('nativeMessageBox');self.endpoint_refused(v)

    def test_foreign_native_process_record(self):
        v=copy.deepcopy(self.expected);v['modal']['processId']+=1;self.endpoint_refused(v)

    def test_wrong_thread(self):
        v=copy.deepcopy(self.expected);v['modal']['threadId']+=1;self.endpoint_refused(v)

    def test_not_message_box(self):
        v=copy.deepcopy(self.expected);v['nativeMessageBox']['controlClass']=0;self.endpoint_refused(v)

    def test_inactive_sibling(self):
        v=copy.deepcopy(self.expected);v['nativeMessageBox']['hwnd']=self.main['hwnd'];self.endpoint_refused(v)

    def test_held_physical_key(self):
        c.call(dict(action='eval',code='renderer._physicalKeys={65:true};true'))
        self.endpoint_refused(self.expected)
        c.call(dict(action='eval',code='renderer._physicalKeys={};true'))

    def test_foreign_unowned_window(self):
        # A visible renderer entry cannot replace the real native active modal.
        c.call(dict(action='eval',code='const h=instance.exports.modal_dialog_hwnd();renderer.windows[h].wasm={exports:{...instance.exports,get_process_id:()=>999}};true'))
        self.endpoint_refused(self.expected)

if __name__=='__main__':
    if '--policy' in sys.argv:
        raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(NullOwnerPolicy)).wasSuccessful())
    assert len(sys.argv)==3,'output directory and generated application/task EXE required'
    m.NATIVE_OUT=pathlib.Path(sys.argv[1]).resolve();m.NATIVE_FIXTURE=pathlib.Path(sys.argv[2]).resolve()
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(NativeNullOwner)).wasSuccessful())

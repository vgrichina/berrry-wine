"""Manual review boundaries, without a FreeCell board model."""
import importlib.util, pathlib, tempfile, unittest, time
from unittest.mock import patch
s=importlib.util.spec_from_file_location('freecell',pathlib.Path(__file__).resolve().parents[1]/'tools/freecell-controller.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();a.c.R=pathlib.Path(self.tmp.name)
        a.c.save('launch.json',dict(at=100,deadline=1300))
        a.c.save('native-pid.json',dict(pid=123,startToken='actual'))
        self.clock=patch.object(a.time,'time',return_value=800);self.clock.start()
    def tearDown(self):self.clock.stop();self.tmp.cleanup()
    def review(self,name='fresh',mode='select',**kw):
        v=dict(mode=mode,observation='personally reviewed native pixels',originalRulesUnchanged=True,
               settledPaint=True,card='ace of clubs',legalReason='exposed card into empty free cell',
               pixelGeometry=dict(source='current-full-scene',target=a.c.read('native-pid.json'),chosenCenter=[200,200]))
        v.update(kw);a.c.save(name+'-review.json',v)
    def check(self,scene='fresh',mode='select',route=None,keys=None):
        return a.policy(keys or ['mousedown:200:200'],scene,mode,route)
    def selection(self):
        self.review('source');a.c.save('selected-intent.json',dict(review='source'))
        a.c.save('selected-up.json',dict(state='ACK'))
    def destination(self,**kw):
        self.selection();self.review(mode='destination',selectionVisible=True,selectionAction='selected',destinationKind='free-cell',**kw)
    def test_single_exact_click(self):
        self.review();self.check()
        for keys in (['mousedown:201:200'],['keydown:13'],['mousedown:200:200','mousedown:201:200']):
            with self.assertRaises(AssertionError):self.check(keys=keys)
    def test_current_geometry_and_identity(self):
        for i,g in enumerate((dict(source='historical-notes',target=a.c.read('native-pid.json'),chosenCenter=[200,200]),dict(source='current-full-scene',target={'pid':124},chosenCenter=[200,200]))):
            self.review(str(i),pixelGeometry=g)
            with self.assertRaises(AssertionError):self.check(str(i))
    def test_destination_separately_reviewed(self):
        self.destination();self.check(mode='destination')
    def test_destination_needs_visible_selection(self):
        self.selection();self.review(mode='destination',selectionVisible=False)
        with self.assertRaisesRegex(AssertionError,'highlighted'):self.check(mode='destination')
    def test_destination_matches_selected_card(self):
        self.destination(card='two of clubs')
        with self.assertRaises(AssertionError):self.check(mode='destination')
    def test_settled_consequence_before_next_choice(self):
        self.review(previousDestination='prior')
        a.c.save('prior-resolution.json',dict(personallyViewed=True,settledPaint=False,observation='animation incomplete'))
        with self.assertRaises(AssertionError):self.check()
    def test_native_paint_must_settle(self):
        self.review(settledPaint=False)
        with self.assertRaisesRegex(AssertionError,'animation'):self.check()
    def test_quit_navigation_nonfinal_and_irreversible(self):
        self.review(mode='quit',quitRoute='quit-navigation',visibleLabel='End Game',visibleQuitTarget=True)
        self.check(mode='quit',route='quit-navigation');self.review('next',mode='menu')
        with self.assertRaisesRegex(AssertionError,'irreversible'):self.check('next','menu')
    def test_endgame_cannot_be_labeled_exit(self):
        self.review(mode='quit',quitRoute='select-exit',visibleLabel='End Game',visibleQuitTarget=True)
        with self.assertRaisesRegex(AssertionError,'Exit label'):self.check(mode='quit',route='select-exit')
    def test_confirmation_requires_native_prompt(self):
        self.review(mode='quit',quitRoute='confirm-exit',visibleLabel='Yes',visibleQuitTarget=True)
        with self.assertRaises(AssertionError):self.check(mode='quit',route='confirm-exit')
    def test_cutoff_prevents_arm(self):
        self.review()
        with patch.object(a.time,'time',return_value=1113),patch.object(a.c,'pulse') as sent:
            with self.assertRaisesRegex(AssertionError,'cutoff'):a.pulse('late',['mousedown:200:200'],400,'fresh','scene','select')
            sent.assert_not_called()
    def test_bound_before_transport(self):
        with patch.object(a.c,'pulse') as sent:
            with self.assertRaises(AssertionError):a.pulse('long',['mousedown:200:200'],1501,'fresh','scene','select')
            sent.assert_not_called()
    def test_five_second_endpoint_deadline(self):
        self.review();a.c.save('fresh.json',dict(at=798));sent=[]
        def native(command,timeout=10):sent.append(command)
        def transport(*args,**kw):
            self.assertEqual(kw['maxSceneAge'],5)
            a.c.call(dict(action='guarded-input',guard=dict(deadline=999999)))
        with patch.object(a.c,'call',native),patch.object(a.c,'pulse',transport):a.pulse('move',['mousedown:200:200'],400,'fresh','scene','select')
        self.assertEqual(sent[0]['guard']['deadline'],803000)
    def test_binding_requires_submitted_board(self):
        self.review();a.c.save('fresh.json',dict(at=800))
        with patch.object(a.c,'bind') as bound:
            with self.assertRaisesRegex(AssertionError,'submitted original'):a.bind('fresh')
            bound.assert_not_called()

if __name__=='__main__':unittest.main()

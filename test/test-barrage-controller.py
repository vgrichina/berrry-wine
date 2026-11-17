"""Barrage manual choice, scene identity and irreversible native Quit policy."""
import importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('barrage',ROOT/'tools/barrage-controller.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();a.c.R=pathlib.Path(self.tmp.name)
        a.c.save('launch.json',dict(at=100,deadline=1000))
        a.c.save('native-pid.json',dict(pid=123,startToken='actual'))
        a.c.save('controls-reviewed.json',dict(bindings=a.CONTROLS,unchanged=True,target=a.c.read('native-pid.json')))
    def tearDown(self): self.tmp.cleanup()
    def review(self,mode,route=None,**values):
        a.c.save('fresh-review.json',dict(mode=mode,quitRoute=route,observation='personally reviewed',**values))
    def test_controls_are_original_and_finite(self):
        choices={'aim':['mousemove:200:200'],'large':['mousedown:200:200'],
                 'small':['keydown:17','mousedown:200:200'],'reload':['keydown:32'],'menu':['mousedown:300:300']}
        for mode,keys in choices.items():
            path=a.c.R/'fresh-review.json'
            if path.exists():path.unlink()
            self.review(mode)
            with patch.object(a.time,'time',return_value=800):
                a.policy(keys,'fresh',mode)
                with self.assertRaises(AssertionError):a.policy(['keydown:70'],'fresh',mode)
    def test_small_order_and_button_not_guessed(self):
        self.review('small')
        with patch.object(a.time,'time',return_value=800):
            for keys in (['mousedown:200:200','keydown:17'],['keydown:18','mousedown:200:200'],['mousedown:2:200:200']):
                with self.assertRaises(AssertionError):a.policy(keys,'fresh','small')
    def test_quit_is_early_irreversible(self):
        self.review('quit','escape')
        with patch.object(a.time,'time',return_value=700):a.policy(['keydown:27'],'fresh','quit','escape')
        a.c.save('next-review.json',dict(mode='large',observation='scene'))
        with patch.object(a.time,'time',return_value=701):
            with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy(['mousedown:2:2'],'next','large')
        self.assertEqual(a.c.read('quit-phase.json')['reserveSeconds'],180)
    def test_quit_click_requires_visible_selection(self):
        self.review('quit','click-quit')
        with patch.object(a.time,'time',return_value=800):
            with self.assertRaisesRegex(AssertionError,'visible Quit'):a.policy(['mousedown:300:400'],'fresh','quit','click-quit')
    def test_cutoff_refuses_before_arm(self):
        self.review('large')
        with patch.object(a.time,'time',return_value=813),patch.object(a.c,'pulse') as sent:
            with self.assertRaisesRegex(AssertionError,'cutoff'):a.pulse('late',['mousedown:2:2'],120,'fresh','scene','large')
            sent.assert_not_called()
    def test_native_identity_bound_to_controls(self):
        self.review('large');(a.c.R/'native-pid.json').unlink();a.c.save('native-pid.json',dict(pid=124,startToken='new'))
        with patch.object(a.time,'time',return_value=800):
            with self.assertRaisesRegex(AssertionError,'identity'):a.policy(['mousedown:2:2'],'fresh','large')
    def test_pulse_bound_and_precision_deadline(self):
        self.review('large');a.c.save('fresh.json',dict(at=798))
        sent=[]
        def native(command,timeout=10):sent.append(command)
        def transport(*args,**kwargs):
            self.assertEqual(kwargs['maxSceneAge'],5)
            a.c.call(dict(action='guarded-input',guard=dict(deadline=999999)))
        with patch.object(a.time,'time',return_value=800),patch.object(a.c,'call',native),patch.object(a.c,'pulse',transport):
            a.pulse('shot',['mousedown:2:2'],120,'fresh','scene','large')
            self.assertEqual(sent[0]['guard']['deadline'],803000)
            with self.assertRaisesRegex(AssertionError,'1500ms'):a.pulse('long',['mousedown:2:2'],1501,'fresh','scene','large')
    def test_no_bind_before_submitted_scene_review(self):
        a.c.save('fresh.json',dict(at=800));self.review('menu',submittedScene=False)
        with patch.object(a.time,'time',return_value=801),patch.object(a.c,'bind') as bound:
            with self.assertRaisesRegex(AssertionError,'submitted full scene'):a.bind('fresh')
            bound.assert_not_called()
if __name__=='__main__':unittest.main()

"""Manual policy boundaries; actual endpoint controls run separately."""
import importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('reversi',pathlib.Path(__file__).resolve().parents[1]/'tools/reversi-controller.py')
a=importlib.util.module_from_spec(s);s.loader.exec_module(a)

class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();a.c.R=pathlib.Path(self.tmp.name)
        a.c.save('launch.json',dict(at=100,deadline=1300))
        a.c.save('native-pid.json',dict(pid=123,startToken='actual'))
    def tearDown(self):self.tmp.cleanup()
    def review(self,mode='place',**kw):
        a.c.save('fresh-review.json',dict(mode=mode,observation='native pixels personally reviewed',originalRulesUnchanged=True,opponentSettled=True,legalReason='brackets one enemy disc',pixelGeometry=dict(source='current-full-scene',target=a.c.read('native-pid.json'),chosenCenter=[200,200]),**kw))
    def test_single_click_and_exact_personally_reviewed_pixels(self):
        self.review()
        with patch.object(a.time,'time',return_value=800):
            a.policy(['mousedown:200:200'],'fresh','place')
            for keys in (['mousedown:201:200'],['keydown:13'],['mousedown:200:200','mousedown:201:200']):
                with self.assertRaises(AssertionError):a.policy(keys,'fresh','place')
    def test_no_registry_geometry_or_rebound_identity(self):
        self.review();r=a.c.read('fresh-review.json')
        for change in ({'source':'registry-comment'},{'target':{'pid':124}}):
            with patch.object(a.c,'read',side_effect=lambda n: {**r,'pixelGeometry':{**r['pixelGeometry'],**change}} if n=='fresh-review.json' else {'deadline':1300,'at':100} if n=='launch.json' else {'pid':123,'startToken':'actual'}),patch.object(a.time,'time',return_value=800):
                with self.assertRaises(AssertionError):a.policy(['mousedown:200:200'],'fresh','place')
    def test_quit_irreversible_and_visible(self):
        self.review('quit',quitRoute='titlebar-close',visibleQuitTarget=True)
        with patch.object(a.time,'time',return_value=800):
            a.policy(['mousedown:300:30'],'fresh','quit','titlebar-close')
            a.c.save('next-review.json',dict(mode='menu',observation='fresh scene'))
            with self.assertRaisesRegex(AssertionError,'irreversible'):a.policy(['mousedown:200:200'],'next','menu')
    def test_cutoff_before_arm(self):
        self.review()
        with patch.object(a.time,'time',return_value=1113),patch.object(a.c,'pulse') as sent:
            with self.assertRaisesRegex(AssertionError,'cutoff'):a.pulse('late',['mousedown:200:200'],400,'fresh','scene','place')
            sent.assert_not_called()
    def test_native_exit_confirmation_is_separate(self):
        self.review('quit',quitRoute='confirm-exit',visibleQuitTarget=True)
        with patch.object(a.time,'time',return_value=800):
            with self.assertRaisesRegex(AssertionError,'confirmation'):a.policy(['mousedown:300:30'],'fresh','quit','confirm-exit')
        a.c.save('confirmed-review.json',dict(mode='quit',observation='native Yes button in Exit confirmation',quitRoute='confirm-exit',visibleQuitTarget=True,nativeExitConfirmation=True))
        with patch.object(a.time,'time',return_value=801):a.policy(['mousedown:300:30'],'confirmed','quit','confirm-exit')
    def test_1500_bound_before_transport(self):
        with patch.object(a.c,'pulse') as sent:
            with self.assertRaises(AssertionError):a.pulse('long',['mousedown:200:200'],1501,'fresh','scene','place')
            sent.assert_not_called()
    def test_five_second_server_deadline(self):
        self.review();a.c.save('fresh.json',dict(at=798))
        sent=[]
        def native(command,timeout=10):sent.append(command)
        def transport(*args,**kw):
            self.assertEqual(kw['maxSceneAge'],5)
            a.c.call(dict(action='guarded-input',guard=dict(deadline=999999)))
        with patch.object(a.time,'time',return_value=800),patch.object(a.c,'call',native),patch.object(a.c,'pulse',transport):
            a.pulse('move',['mousedown:200:200'],400,'fresh','scene','place')
        self.assertEqual(sent[0]['guard']['deadline'],803000)
    def test_binding_requires_submitted_original(self):
        self.review();a.c.save('fresh.json',dict(at=800))
        with patch.object(a.c,'bind') as bound:
            with self.assertRaisesRegex(AssertionError,'submitted original'):a.bind('fresh')
            bound.assert_not_called()

if __name__=='__main__':unittest.main()

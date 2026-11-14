"""Policy boundaries with synthetic metadata, no StarCraft world inspection."""
import importlib.util
import pathlib
import tempfile
import unittest
import hashlib
from unittest.mock import patch

s = importlib.util.spec_from_file_location('sc', pathlib.Path(__file__).resolve().parents[1] / 'tools/starcraft-controller.py')
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)


class Policy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        a.c.R = pathlib.Path(self.tmp.name)
        a.c.save('launch.json', dict(at=100, deadline=1300))
        a.c.save('native-pid.json', dict(pid=123, startToken='actual'))
        self.clock = patch.object(a.time, 'time', return_value=500)
        self.clock.start()

    def tearDown(self):
        self.clock.stop(); self.tmp.cleanup()

    def scene(self, name='fresh', mode='select', **changes):
        (a.c.R / (name + '.png')).write_bytes(b'fixture only')
        digest = hashlib.sha256((a.c.R / (name + '.png')).read_bytes()).hexdigest()
        a.c.save(name + '.json', dict(at=499, pngSHA256=digest, target=a.c.read('native-pid.json'), snapshot=dict(mainHwnd='0x1', eip='0x2')))
        a.c.save(name + '-review.json', dict(dict(at=499, pngSHA256=digest, mode=mode, submittedScene=True,
            observation='fixture human review', sceneType='mission', unobstructedMission=True,
            visibleMissionDescription='synthetic mission', visibleTarget='synthetic SCV', selectionIntent='select SCV',
            selectedUnitsEvidence='visible SCV portrait and selection circle', nativeCommandSemantics='visible Build icon',
            activeCommandEvidence='visible building placement outline',
            pixelGeometry=dict(source='current-full-scene', target=a.c.read('native-pid.json'), chosenCenter=[200,200])), **changes))

    def mission(self): a.c.save('mission-admitted.json', dict(scene='reviewed-earlier'))
    def click(self, mode='select', route=None): return a.policy(['mousedown:200:200'], 'fresh', mode, route)

    def test_exact_one_left_click(self):
        self.scene(); self.mission(); self.click()
        for keys in (['mousedown:201:200'], ['keydown:65'], ['rmousedown:200:200'], ['mousedown:200:200','mousedown:210:210']):
            with self.assertRaises(AssertionError): a.policy(keys, 'fresh', 'select')

    def test_no_gameplay_before_actual_mission(self):
        self.scene()
        with self.assertRaisesRegex(AssertionError, 'actual mission'): self.click()

    def test_bootstrap_cannot_be_mission(self):
        self.scene(sceneType='bootstrap'); self.mission()
        with self.assertRaises(AssertionError): self.click()

    def test_selection_requires_intent(self):
        self.scene(selectionIntent=''); self.mission()
        with self.assertRaises(AssertionError): self.click()

    def test_command_requires_selection(self):
        self.scene(mode='command', selectedUnitsEvidence=''); self.mission()
        with self.assertRaisesRegex(AssertionError, 'actual selection'): self.click('command')

    def test_command_requires_semantics(self):
        self.scene(mode='command', nativeCommandSemantics=''); self.mission()
        with self.assertRaisesRegex(AssertionError, 'semantics'): self.click('command')

    def test_target_requires_active_command(self):
        self.scene(mode='target', activeCommandEvidence=''); self.mission()
        with self.assertRaisesRegex(AssertionError, 'active command'): self.click('target')

    def test_gameplay_scene_expires_in_five_seconds(self):
        self.scene(); self.mission()
        with patch.object(a.time, 'time', return_value=505):
            with self.assertRaisesRegex(AssertionError, 'expired'): self.click()

    def test_menu_scene_thirty_seconds(self):
        self.scene(mode='menu', nativeMenuPurpose='pause')
        with patch.object(a.time, 'time', return_value=520): self.click('menu')
        with patch.object(a.time, 'time', return_value=530):
            with self.assertRaises(AssertionError): self.click('menu')

    def test_bootstrap_only_skip_start(self):
        self.scene(mode='bootstrap', sceneType='bootstrap', nativeSkipOrStart=True); self.click('bootstrap')
        self.mission()
        with self.assertRaisesRegex(AssertionError, 'after mission'): self.click('bootstrap')

    def test_bind_truthful_bootstrap(self):
        self.scene(sceneType='bootstrap',nativeTitleOrMenu=True)
        with patch.object(a.c, 'bind') as bound: a.bind('fresh')
        bound.assert_called_once(); self.assertEqual(a.c.read('binding-scene.json')['sceneType'], 'bootstrap')
        with patch.object(a.c, 'lease'):
            with self.assertRaises(AssertionError): a.admit_mission('fresh')

    def test_bind_rejects_changed_png(self):
        self.scene(); (a.c.R/'fresh.png').write_bytes(b'changed')
        with patch.object(a.c, 'bind') as bound:
            with self.assertRaises(AssertionError): a.bind('fresh')
            bound.assert_not_called()

    def test_splash_cannot_bind_as_title(self):
        self.scene(sceneType='bootstrap')
        with patch.object(a.c,'bind') as bound:
            with self.assertRaisesRegex(AssertionError,'title/menu'): a.bind('fresh')
            bound.assert_not_called()

    def test_admit_requires_current_mission(self):
        self.scene()
        with patch.object(a.c, 'lease'): a.admit_mission('fresh')
        self.assertTrue((a.c.R/'mission-admitted.json').exists())

    def test_quit_irreversible(self):
        self.scene(mode='quit', quitRoute='open-menu', visibleQuitTarget=True); self.click('quit','open-menu')
        self.scene('next'); self.mission()
        with self.assertRaisesRegex(AssertionError, 'irreversible'): a.policy(['mousedown:200:200'],'next','select')

    def test_quit_confirmation_separate(self):
        self.scene(mode='quit', quitRoute='confirm-abort', visibleQuitTarget=True)
        with self.assertRaisesRegex(AssertionError,'confirmation'): self.click('quit','confirm-abort')

    def test_cutoff_before_arming(self):
        self.scene(); self.mission()
        with patch.object(a.time,'time',return_value=1121), patch.object(a.c,'pulse') as sent:
            with self.assertRaises(AssertionError): a.pulse('late',['mousedown:200:200'],400,'fresh','fixture','select')
            sent.assert_not_called()
        self.assertTrue(a.c.read('quit-phase.json')['irreversible'])

    def test_precision_deadline(self):
        self.scene(); self.mission(); commands=[]
        def transport(*args, **kw):
            self.assertEqual(kw['maxSceneAge'],5)
            a.c.call(dict(action='guarded-input',guard=dict(deadline=999999)))
        with patch.object(a.c,'call',lambda command,timeout=10:commands.append(command)), patch.object(a.c,'pulse',transport):
            a.pulse('choice',['mousedown:200:200'],400,'fresh','fixture','select')
        self.assertEqual(commands[0]['guard']['deadline'],504000)

    def test_pulse_limit(self):
        with patch.object(a.c,'pulse') as sent:
            with self.assertRaises(AssertionError): a.pulse('long',['mousedown:200:200'],1501,'fresh','fixture','select')
            sent.assert_not_called()

    def test_menu_open_nonfinal_confirmation_final(self):
        self.scene(mode='quit',quitRoute='open-menu',visibleQuitTarget=True)
        with patch.object(a.c,'pulse',return_value='fixture') as sent:
            a.pulse('open',['mousedown:200:200'],400,'fresh','fixture','quit','open-menu')
            self.assertFalse(sent.call_args.kwargs['final'])
        self.scene('confirm',mode='quit',quitRoute='confirm-quit',visibleQuitTarget=True,nativeExitConfirmation=True)
        with patch.object(a.c,'pulse',return_value='fixture') as sent:
            a.pulse('exit',['mousedown:200:200'],400,'confirm','fixture','quit','confirm-quit')
            self.assertTrue(sent.call_args.kwargs['final'])


if __name__ == '__main__': unittest.main()

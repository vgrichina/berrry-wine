"""Actual endpoint and CLI child controls; fixtures never load in StarCraft."""
import importlib.util
import pathlib
import sys
import subprocess
import time
import unittest
from unittest.mock import patch
ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    s = importlib.util.spec_from_file_location(name, ROOT/path)
    m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


a = load('starcraft', 'tools/starcraft-combat-controller.py')
b = load('released_transport_tests', 'test/test-barrage-transport.py')
c = a.c
b.c = c; b.r.c = c; b.r.b.control = c; b.t.c = c; b.t.base.control = c
b.p.c = c; b.p.p.c = c; b.p.b.control = c


class Production(b.Production):
    def test_bootstrap_mission_selection_command_target_cli(self):
        native_bind = c.bind
        original_save = b.p.b.save
        def fixture_save(out, name, value):
            if name == 'recipe.json': value = {**value, 'seconds':240}
            return original_save(out,name,value)
        def reviewed_bind():
            c.capture('bootstrap')
            c.save('bootstrap-review.json',dict(at=time.time(),pngSHA256=c.read('bootstrap.json')['pngSHA256'],submittedScene=True,
                sceneType='bootstrap',nativeTitleOrMenu=True,observation='Synthetic title/menu binding metadata in isolated Solitaire CLI fixture'))
            with patch.object(c,'bind',native_bind): a.bind('bootstrap')
        with patch.object(c,'bind',reviewed_bind), patch.object(b.p.b,'save',fixture_save): self.start('starcraft-combat-policy')
        try:
            c.capture('skip')
            c.save('skip-review.json',dict(at=time.time(),pngSHA256=c.read('skip.json')['pngSHA256'],submittedScene=True,
                sceneType='bootstrap',mode='bootstrap',nativeSkipOrStart=True,observation='Synthetic native skip policy in Solitaire fixture',
                visibleTarget='fixture pixel',pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[240,240])))
            a.pulse('clickskip',['mousedown:240:240'],400,'skip','fixture bootstrap','bootstrap')
            c.capture('mission')
            c.save('mission-review.json',dict(at=time.time(),pngSHA256=c.read('mission.json')['pngSHA256'],submittedScene=True,
                sceneType='mission',unobstructedMission=True,visibleMissionDescription='Synthetic mission fixture; no StarCraft proof',observation='Fixture only'))
            a.admit_mission('mission')
            for mode in ('select','command','target'):
                c.capture(mode)
                c.save(mode+'-review.json',dict(at=time.time(),pngSHA256=c.read(mode+'.json')['pngSHA256'],submittedScene=True,
                    sceneType='mission',unobstructedMission=True,mode=mode,observation='Synthetic '+mode+' policy in Solitaire fixture',
                    visibleTarget='fixture pixel',selectionIntent='fixture selection',selectedUnitsEvidence='synthetic metadata',
                    nativeCommandSemantics='synthetic command',activeCommandEvidence='synthetic target mode',
                    commandKind='attack',armedUnitHUD='fixture Marine rifle',visibleAttackCommand='fixture Attack',
                    visibleEnemy='fixture enemy',attackCommandIntent='clickcommand',
                    pixelGeometry=dict(source='current-full-scene',target=c.read('native-pid.json'),chosenCenter=[240,240])))
                args=[sys.executable,'-B',str(ROOT/'tools/starcraft-combat-controller.py'),mode,'click'+mode,'mousedown:240:240','400',mode]
                child=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                out,err=child.communicate(timeout=12)
                c.save('click'+mode+'-controller-wait.json',dict(args=args,pid=child.pid,exit=child.returncode,
                    actualWait=True,stdoutEOF=True,stderrEOF=True,stdout=out.decode(),stderr=err.decode()))
                self.assertEqual(child.returncode,0,err.decode())
                self.assertTrue(c.read('click'+mode+'-receipt.json')['consumed'])
                self.assertEqual(c.read('click'+mode+'-up.json')['state'],'ACK')
        finally: self.finish()


if __name__ == '__main__':
    if '--production' in sys.argv:
        names = ['test_timely_ack_slow_parent_and_release_fsync'] + [n for cls in (b.p.Production,b.Production,Production) for n in cls.__dict__ if n.startswith('test_')]
        suite = unittest.TestSuite(Production(n) for n in names)
    else:
        suite = unittest.TestSuite([*(b.r.Refusal(n) for n in b.r.Refusal.__dict__ if n.startswith('test_')),
                                  *(b.t.Terminal(n) for n in b.t.Terminal.__dict__ if n.startswith('test_'))])
    raise SystemExit(not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful())

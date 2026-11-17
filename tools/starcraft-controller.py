"""One personally reviewed StarCraft left click, without game interpretation.

Released Barrage transport supplies permanent PID/window identity, nonces,
sticky UNKNOWN, and a prearmed independent 1750ms UP. No right-click route.
"""
import importlib.util
import pathlib
import hashlib
import re
import sys
import time

s = importlib.util.spec_from_file_location('starcraft_transport', pathlib.Path(__file__).with_name('barrage-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)
GAMEPLAY = ('select', 'command', 'target')


def cutoff():
    launch = c.read('launch.json')
    assert launch['deadline'] - launch['at'] > 180
    return launch['deadline'] - 180


def reviewed(scene, max_age=30):
    rr, r = c.read(scene + '.json'), c.read(scene + '-review.json')
    assert r.get('submittedScene') is True and r['observation'].strip(), 'personal complete scene review required'
    assert all(0 <= time.time() - x['at'] < max_age for x in (rr, r)), 'scene review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (scene + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0'
    return rr, r


def bind(scene):
    cutoff()
    rr, r = reviewed(scene)
    assert r.get('sceneType') in ('bootstrap', 'mission')
    if r['sceneType'] == 'bootstrap':
        assert r.get('nativeTitleOrMenu') is True, 'binding requires personally reviewed title/menu bootstrap'
    c.bind()
    c.save('binding-scene.json', dict(scene=scene, sceneType=r['sceneType'], target=rr['target'], at=time.time()))


def admit_mission(scene):
    assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
    c.lease()
    rr, r = reviewed(scene, 5)
    assert r.get('sceneType') == 'mission' and r.get('unobstructedMission') is True
    assert r.get('visibleMissionDescription', '').strip(), 'actual mission review required'
    c.save('mission-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], at=time.time()))


def policy(keys, scene, mode, route=None, before_arm=False):
    assert mode in ('bootstrap', 'menu', 'quit', *GAMEPLAY)
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    rr, r = reviewed(scene, 5 if mode in GAMEPLAY else 30)
    assert r['mode'] == mode
    assert len(keys) == 1 and re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', keys[0]), 'one left click; no action lists/right clicks'
    geometry = r['pixelGeometry']
    assert geometry['source'] == 'current-full-scene' and geometry['target'] == c.read('native-pid.json')
    assert [int(v) for v in keys[0].split(':')[1:]] == geometry['chosenCenter']
    assert r.get('visibleTarget', '').strip(), 'describe visible native target'
    if mode == 'quit':
        assert route in ('open-menu', 'abort-mission', 'confirm-abort', 'quit-game', 'confirm-quit') and r['quitRoute'] == route
        assert r.get('visibleQuitTarget') is True
        if route.startswith('confirm-'):
            assert r.get('nativeExitConfirmation') is True, 'separately reviewed native confirmation required'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert time.time() + (8 if before_arm else 0) < end, 'mechanical gameplay cutoff'
        if mode == 'bootstrap':
            assert not (c.R / 'mission-admitted.json').exists(), 'no bootstrap after mission admission'
            assert r.get('sceneType') == 'bootstrap' and r.get('nativeSkipOrStart') is True
        elif mode == 'menu':
            assert r.get('nativeMenuPurpose') in ('pause', 'resume', 'dismiss-tip'), 'native menu only'
        else:
            assert (c.R / 'mission-admitted.json').exists(), 'review actual mission before gameplay'
            assert r.get('sceneType') == 'mission' and r.get('unobstructedMission') is True
            if mode == 'select':
                assert r.get('selectionIntent', '').strip()
            else:
                assert r.get('selectedUnitsEvidence', '').strip(), 'personally confirm actual selection'
                assert r.get('nativeCommandSemantics', '').strip(), 'review native command semantics'
                if mode == 'target':
                    assert r.get('activeCommandEvidence', '').strip(), 'review active command before target'
    return end


def pulse(name, keys, ms, scene, observation, mode, route=None):
    assert 40 <= ms <= 1500
    policy(keys, scene, mode, route, True)
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, scene, mode, route)
            scene_end = c.read(scene + '.json')['at'] + (5 if mode in GAMEPLAY else 30)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int((scene_end if mode == 'quit' else min(scene_end, end)) * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, scene, observation,
                       final=mode == 'quit' and route in ('confirm-abort', 'quit-game', 'confirm-quit'),
                       maxSceneAge=5 if mode in GAMEPLAY else 30)
    finally:
        c.call = original


if __name__ == '__main__':
    if sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit-mission': admit_mission(sys.argv[2])
    else:
        _, mode, name, key, ms, scene, *route = sys.argv
        print(pulse(name, [key], int(ms), scene, c.read(scene + '-review.json')['observation'], mode, route[0] if route else None))

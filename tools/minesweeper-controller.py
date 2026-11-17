"""One personally reviewed native Minesweeper choice; no board interpretation.

Released Barrage provides permanent identity, nonces, sticky UNKNOWN and the
independently prearmed 1750ms release. Its pointer transport is LEFT only:
right flags/chording are deliberately refused, never emulated by guest writes.
"""
import importlib.util
import pathlib
import hashlib
import re
import sys
import time

s = importlib.util.spec_from_file_location('minesweeper_transport', pathlib.Path(__file__).with_name('barrage-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)


def cutoff():
    launch = c.read('launch.json')
    assert launch['deadline'] - launch['at'] > 180
    return launch['deadline'] - 180


def reviewed(scene, max_age=30):
    rr = c.read(scene + '.json')
    r = c.read(scene + '-review.json')
    assert r.get('submittedScene') is True and r['observation'].strip(), 'personal complete scene review required'
    assert all(0 <= time.time() - x['at'] < max_age for x in (rr, r)), 'scene review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (scene + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0'
    return rr, r


def bind(scene):
    cutoff()
    rr, r = reviewed(scene)
    assert r.get('sceneType') in ('bootstrap', 'board'), 'identify bootstrap separately from board'
    c.bind()
    c.save('binding-scene.json', dict(scene=scene, sceneType=r['sceneType'], target=rr['target'], at=time.time()))


def admit_board(scene):
    """Human attestation only; this function never reads or recognizes a square."""
    assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
    assert not (c.R / 'natural-outcome.json').exists(), 'natural outcome ends gameplay'
    c.lease()
    rr, r = reviewed(scene, 5)
    assert r.get('sceneType') == 'board' and r.get('defaultBoard') is True
    assert r.get('visibleBoardDescription', '').strip(), 'describe actual visible board'
    c.save('board-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], at=time.time()))


def outcome(scene):
    c.lease()
    rr, r = reviewed(scene)
    assert r.get('sceneType') == 'board' and r.get('naturalOutcome') in ('win', 'loss')
    assert r.get('outcomeEvidence', '').strip(), 'counter alone is not an outcome'
    c.save('natural-outcome.json', dict(scene=scene, outcome=r['naturalOutcome'], evidence=r['outcomeEvidence'], pngSHA256=rr['pngSHA256'], at=time.time()))


def policy(keys, scene, mode, route=None, before_arm=False):
    assert mode in ('start', 'reveal', 'quit'), 'only native Start, one left reveal, or Quit'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    r = c.read(scene + '-review.json')
    assert r['mode'] == mode and r.get('submittedScene') is True and r['observation'].strip()
    assert len(keys) == 1 and re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', keys[0]), 'single LEFT click only; no flag/chord/action list'
    geometry = r['pixelGeometry']
    assert geometry['source'] == 'current-full-scene' and geometry['target'] == c.read('native-pid.json')
    assert [int(v) for v in keys[0].split(':')[1:]] == geometry['chosenCenter'], 'click differs from reviewed pixels'
    if mode == 'quit':
        assert route in ('open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit') and r['quitRoute'] == route
        assert r.get('visibleQuitTarget') is True
        if route == 'confirm-exit':
            assert r.get('nativeExitConfirmation') is True, 'review actual native Exit confirmation'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert not (c.R / 'natural-outcome.json').exists(), 'natural outcome ends gameplay'
        assert time.time() + (8 if before_arm else 0) < end, 'mechanical gameplay cutoff'
        if mode == 'start':
            assert c.read('binding-scene.json')['sceneType'] == 'bootstrap'
            assert not (c.R / 'board-admitted.json').exists(), 'Start forbidden after board admission'
            assert r.get('sceneType') == 'bootstrap' and r.get('nativeStartTarget') is True
            assert not (c.R / 'start-submitted.json').exists(), 'one native Start only'
        else:
            assert (c.R / 'board-admitted.json').exists(), 'review actual board before square gameplay'
            assert r.get('sceneType') == 'board' and r.get('defaultBoard') is True
            assert r.get('button') == 'left' and r.get('buttonSemantics', '').strip()
            assert r.get('choiceKind') in ('deduction', 'guess') and r.get('reason', '').strip(), 'explain deduction or label guess'
            assert r.get('coveredSquare') is True, 'no smiley/reset/revealed-square chording'
    return end


def pulse(name, keys, ms, scene, observation, mode, route=None):
    assert 40 <= ms <= 1500
    policy(keys, scene, mode, route, True)
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, scene, mode, route)
            scene_end = c.read(scene + '.json')['at'] + (5 if mode == 'reveal' else 30)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int((scene_end if mode == 'quit' else min(scene_end, end)) * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        result = c.pulse(name, keys, ms, scene, observation,
                         final=mode == 'quit' and route in ('select-exit', 'titlebar-close', 'confirm-exit'),
                         maxSceneAge=5 if mode == 'reveal' else 30)
        if mode == 'start' and not result.startswith('NOT_SENT:'):
            c.save('start-submitted.json', dict(name=name, at=time.time()))
        return result
    finally:
        c.call = original


if __name__ == '__main__':
    if sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit-board': admit_board(sys.argv[2])
    elif sys.argv[1] == 'outcome': outcome(sys.argv[2])
    else:
        _, mode, name, key, ms, scene, *route = sys.argv
        print(pulse(name, [key], int(ms), scene, c.read(scene + '-review.json')['observation'], mode, route[0] if route else None))

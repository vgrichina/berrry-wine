"""One personally reviewed LTris gesture; no board analysis or move selection."""
import importlib.util, pathlib, sys, time, hashlib, re

s = importlib.util.spec_from_file_location('ltris_guard', pathlib.Path(__file__).with_name('ltris-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)
PLAY = {'keydown:' + str(k) for k in (37, 39, 38, 34, 40, 35, 46, 80)}
MENU = {'keydown:' + str(k) for k in (13, 27, 37, 38, 39, 40)}
QUIT = {'open-menu': 'keydown:27', 'menu-up': 'keydown:38',
        'menu-down': 'keydown:40', 'select-back': 'keydown:13', 'select-quit': 'keydown:13',
        'confirm-quit': 'keydown:13', 'confirm-end-game': 'keydown:89'}

def cutoff():
    launch = c.read('launch.json')
    end = launch['deadline'] - 180
    assert launch['at'] < end, 'immutable 180-second Quit reserve'
    return end

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('play', 'menu', 'quit'), 'explicit manual mode required'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    r = c.read(review + '-review.json')
    assert r['mode'] == mode, 'review mode changed'
    assert len(keys) == 1, 'one reviewed gesture only'
    if mode == 'quit':
        assert route in QUIT and keys == [QUIT[route]], 'ordinary Quit route only'
        assert r['quitRoute'] == route, 'exact reviewed Quit route required'
        if route == 'confirm-end-game':
            assert r.get('endGamePrompt') is True and not r.get('selectedQuit') and not r.get('selectedBack'), 'personally visible End Game y/n prompt required, separate from Back and Quit'
        if route == 'select-back':
            assert r.get('selectedBack') is True and not r.get('selectedQuit') and not r.get('endGamePrompt'), 'personally visible Back selection required, separate from End Game and Quit'
        if route in ('select-quit', 'confirm-quit'):
            assert r.get('selectedQuit') is True and not r.get('selectedBack') and not r.get('endGamePrompt'), 'personally visible Quit selection required, separate from End Game and Back'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert time.time() + (8 if beforeArm else 0) < end, 'gameplay cutoff'
        if mode == 'play':
            assert keys[0] in PLAY, 'documented original controls only'
            controls = c.read('controls-reviewed.json')
            assert controls['keys'] == sorted(PLAY) and controls['unchanged'] is True
            assert controls['target'] == c.read('native-pid.json'), 'controls native identity changed'
        else:
            assert keys[0] in MENU or re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', keys[0]), 'native menu gesture only'
    return end

def bind(review):
    cutoff()
    rr = c.read(review + '.json'); r = c.read(review + '-review.json')
    assert r['observation'].strip() and r.get('submittedScene') is True, 'actual submitted full scene review required'
    assert 0 <= time.time() - rr['at'] < 30 and 0 <= time.time() - r['at'] < 30, 'initial review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (review + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0', 'native window not submitted'
    c.bind()

def pulse(name, keys, ms, review, observation, mode, route=None):
    assert 40 <= ms <= 1500, '1500ms pulse maximum with 1750ms independent fallback'
    policy(keys, review, mode, route, True)
    if mode == 'quit' and route in ('select-back', 'confirm-end-game'):
        assert all(0 <= time.time() - record['at'] < 30 for record in
                   (c.read(review + '.json'), c.read(review + '-review.json'))), 'Back/End Game scene/review expired'
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            sceneEnd = c.read(review + '.json')['at'] + (5 if mode == 'play' else 30)
            allowedEnd = sceneEnd if mode == 'quit' else min(sceneEnd, end)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int(allowedEnd * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, review, observation,
                       final=mode == 'quit' and route in ('select-quit', 'confirm-quit'),
                       maxSceneAge=5 if mode == 'play' else 30)
    finally:
        c.call = original

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'capture':
        print(c.capture(sys.argv[2]))
    elif mode == 'bind':
        bind(sys.argv[2])
    elif mode in ('menu', 'play', 'quit'):
        _, _, name, key, ms, review, observation, *flags = sys.argv
        route = flags[0] if mode == 'quit' else None
        rr = c.read(review + '.json')
        c.save(review + '-review.json', dict(at=time.time(), pngSHA256=rr['pngSHA256'],
               observation=observation, mode=mode, quitRoute=route,
               selectedQuit='selected-quit' in flags, selectedBack='selected-back' in flags,
               endGamePrompt='end-game-prompt' in flags))
        print(pulse(name, key.split(','), int(ms), review, observation, mode, route))
    else:
        raise ValueError(mode)

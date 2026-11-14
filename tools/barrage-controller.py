"""One manually selected Barrage gesture, with immutable native Quit reserve.

No target detection, tracking, score reads, automatic aim or gameplay loop.
The original README establishes the buttons; actual submitted scenes establish
each finite choice. Shared released controllers remain read-only.
"""
import importlib.util, pathlib, sys, time, hashlib, re

s = importlib.util.spec_from_file_location('barrage_guard', pathlib.Path(__file__).with_name('barrage-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)
CONTROLS = {'aim': 'mouse motion', 'large': 'left', 'small': 'Ctrl-left or middle',
            'reload': 'Space or right', 'escape': 'Escape quits without highscore'}

def cutoff():
    launch = c.read('launch.json')
    end = launch['deadline'] - 180
    assert launch['at'] < end, 'immutable 180-second Quit reserve'
    return end

def pointer(key, kind):
    return re.fullmatch(kind + r':[0-9]{1,4}:[0-9]{1,4}', key) is not None

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('aim', 'large', 'small', 'reload', 'menu', 'quit'), 'explicit manual mode'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    r = c.read(review + '-review.json')
    assert r['mode'] == mode and r['observation'].strip(), 'exact personal review required'
    if mode == 'quit':
        assert r['quitRoute'] == route, 'exact reviewed Quit route'
        assert (route == 'escape' and keys == ['keydown:27']) or (route == 'click-quit' and len(keys) == 1 and pointer(keys[0], 'mousedown')), 'ordinary native Quit only'
        if route == 'click-quit':
            assert r.get('selectedQuit') is True, 'personally visible Quit required'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert time.time() + (8 if beforeArm else 0) < end, 'gameplay cutoff'
        controls = c.read('controls-reviewed.json')
        assert controls['bindings'] == CONTROLS and controls['unchanged'] is True, 'original README controls required'
        assert controls['target'] == c.read('native-pid.json'), 'native controls identity changed'
        if mode == 'aim':
            assert len(keys) == 1 and pointer(keys[0], 'mousemove'), 'manual mouse aim only'
        elif mode in ('large', 'menu'):
            assert len(keys) == 1 and pointer(keys[0], 'mousedown'), 'ordinary left click only'
        elif mode == 'small':
            assert len(keys) == 2 and keys[0] == 'keydown:17' and pointer(keys[1], 'mousedown'), 'documented Ctrl-left only'
        else:
            assert keys == ['keydown:32'], 'documented Space reload only'
    return end

def bind(review):
    cutoff()
    rr = c.read(review + '.json'); r = c.read(review + '-review.json')
    assert r['observation'].strip() and r.get('submittedScene') is True, 'actual submitted full scene review required'
    assert 0 <= time.time()-rr['at'] < 30 and 0 <= time.time()-r['at'] < 30, 'initial scene expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R/(review+'.png')).read_bytes()).hexdigest(), 'scene hash changed'
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0', 'native window not submitted'
    c.bind()

def pulse(name, keys, ms, review, observation, mode, route=None):
    assert 40 <= ms <= 1500, '1500ms pulse maximum with independent 1750ms fallback'
    policy(keys, review, mode, route, True)
    original = c.call
    precision = mode in ('aim', 'large', 'small', 'reload')
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            sceneEnd = c.read(review+'.json')['at'] + (5 if precision else 30)
            allowedEnd = sceneEnd if mode == 'quit' else min(sceneEnd, end)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int(allowedEnd*1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, review, observation, final=mode=='quit', maxSceneAge=5 if precision else 30)
    finally:
        c.call = original

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'capture': print(c.capture(sys.argv[2]))
    elif mode == 'bind': bind(sys.argv[2])
    else:
        _, _, name, key, ms, review, observation, *flags = sys.argv
        route = flags[0] if mode == 'quit' else None
        rr = c.read(review+'.json')
        c.save(review+'-review.json', dict(at=time.time(), pngSHA256=rr['pngSHA256'], observation=observation,
               mode=mode, quitRoute=route, selectedQuit='selected-quit' in flags))
        print(pulse(name, key.split(','), int(ms), review, observation, mode, route))

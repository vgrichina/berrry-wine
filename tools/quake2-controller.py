"""Scene-reviewed Quake II keyboard input with an irreversible Quit reserve.

The frozen controller derivative supplies permanent production ownership, nonce admission,
and independently prearmed releases. This adapter never selects a move or aim.
Arrow bindings come from the original pak default.cfg; Enter/Space/A bindings
come from the bundled first-launch config. Ctrl is deliberately not admitted.
"""
import importlib.util, pathlib, sys, time, hashlib

spec = importlib.util.spec_from_file_location('shared', pathlib.Path(__file__).with_name('quake2-guard.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
KEYS = {'keydown:' + str(k) for k in (13, 19, 27, 32, 34, 35, 37, 38, 39, 40, 46, 65, 67, 68, 83, 87, 112, 115)}
QUIT = {'open-menu': 'keydown:27', 'menu-down': 'keydown:40',
        'menu-up': 'keydown:38', 'select-quit': 'keydown:13',
        'confirm-quit': 'keydown:89', 'open-quit': 'keydown:121'}

def cutoff():
    launch = c.read('launch.json')
    end = launch['deadline'] - 180
    assert launch['at'] < end, '180-second reserve must precede launch'
    return end

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('menu', 'aim', 'quit'), 'explicit manual input mode required'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end,
                                         reserveSeconds=180, irreversible=True))
    reviewed = c.read(review + '-review.json')
    assert reviewed['mode'] == mode, 'review mode changed'
    if mode == 'quit':
        assert route in QUIT and keys == [QUIT[route]], 'ordinary reviewed Quit route only'
        assert reviewed['quitRoute'] == route, 'review must bind exact Quit route'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase; no gameplay'
        assert time.time() + (8 if beforeArm else 0) < end, 'gameplay cutoff; preserve Quit reserve'
        assert 1 <= len(keys) <= 2 and all(k in KEYS for k in keys), 'documented keyboard input only'
        if mode == 'aim':
            bindings = c.read('bindings-reviewed.json')
            assert bindings['attack'] == 'ENTER' and bindings['ctrl'] == 'crouch', 'native bindings must be personally confirmed before aim/attack'
            assert bindings['target'] == c.read('native-pid.json'), 'bindings review native identity changed'
        if mode == 'menu':
            assert len(keys) == 1 and keys[0] in {'keydown:' + str(k) for k in (13, 19, 27, 37, 38, 39, 40, 112, 115)}, 'menu keys only'
    return end

def bind(review):
    """Require actual native GL and a personally reviewed submitted scene first."""
    cutoff()
    rr = c.read(review + '.json')
    reviewed = c.read(review + '-review.json')
    assert reviewed['observation'].strip(), 'personal scene review required'
    assert 0 <= time.time() - rr['at'] < 30, 'initial scene expired'
    assert 0 <= time.time() - reviewed['at'] < 30, 'initial personal review expired'
    assert reviewed['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (review + '.png')).read_bytes()).hexdigest(), 'initial scene hash changed'
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    proof = c.read(review + '-native.json')
    assert proof['nativeContext'] and proof['submittedScene'] and proof['presents'] > 0, 'actual native GL and submitted scene required'
    assert proof['target'] == rr['target'] and proof['pngSHA256'] == rr['pngSHA256'], 'readiness must bind reviewed scene and native identity'
    c.bind()

def pulse(name, keys, ms, review, observation, mode, route=None):
    policy(keys, review, mode, route, True)
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            sceneEnd = c.read(review + '.json')['at'] + (5 if mode == 'aim' else 30)
            allowedEnd = min(sceneEnd, end) if mode != 'quit' else sceneEnd
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int(allowedEnd * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, review, observation,
                       final=mode == 'quit' and route == 'confirm-quit',
                       maxSceneAge=5 if mode == 'aim' else 30)
    finally:
        c.call = original

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'capture':
        print(c.capture(sys.argv[2]))
    elif mode == 'bind':
        bind(sys.argv[2])
    elif mode in ('menu', 'aim', 'quit'):
        _, _, name, key, ms, review, observation, *flags = sys.argv
        route = flags[0] if mode == 'quit' else None
        rr = c.read(review + '.json')
        c.save(review + '-review.json', dict(at=time.time(), pngSHA256=rr['pngSHA256'],
                                           observation=observation, mode=mode, quitRoute=route))
        print(pulse(name, key.split(','), int(ms), review, observation, mode, route))
    else:
        raise ValueError(mode)

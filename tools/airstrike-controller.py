"""Manual Airstrike policy; the tested transport is frozen after its owner releases.

No move selection, plane recognition, aiming, or gameplay loop lives here.
"""
import importlib.util, pathlib, sys, time, hashlib, re

spec = importlib.util.spec_from_file_location('transport', pathlib.Path(__file__).with_name('airstrike-guard.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

COMBAT = {'keydown:' + str(k) for k in (188, 37, 39, 190, 32)}
QUIT = {'open-menu': 'keydown:27', 'menu-up': 'keydown:38',
        'menu-down': 'keydown:40', 'select-quit': 'keydown:13'}

def cutoff():
    launch = c.read('launch.json')
    end = launch['deadline'] - 150
    assert launch['at'] < end, '150-second reserve must precede launch'
    return end

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('combat', 'menu', 'focus', 'quit'), 'explicit manual input mode required'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end,
                                         reserveSeconds=150, irreversible=True))
    reviewed = c.read(review + '-review.json')
    assert reviewed['mode'] == mode, 'review mode changed'
    if mode == 'quit':
        assert route in QUIT and keys == [QUIT[route]], 'ordinary reviewed Quit route only'
        assert reviewed['quitRoute'] == route, 'review must bind exact Quit route'
        if route == 'select-quit':
            assert reviewed.get('selectedQuit') is True, 'personally observed Quit selection required'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase; no gameplay'
        assert time.time() + (8 if beforeArm else 0) < end, 'gameplay cutoff; preserve Quit reserve'
        assert 1 <= len(keys) <= 2 and len(set(keys)) == len(keys), 'one finite distinct manual choice'
        if mode == 'combat':
            assert all(k in COMBAT for k in keys), 'unchanged original combat controls only'
            controls = c.read('controls-reviewed.json')
            assert controls['keys'] == sorted(COMBAT) and controls['unchanged'] is True, 'original controls must be reviewed first'
        elif mode == 'menu':
            assert keys == ['keydown:13'], 'startup Enter only; Quit requires irreversible route'
        else:
            assert all(re.fullmatch(r'(?:mousedown|mousemove):[0-9]{1,4}:[0-9]{1,4}', k) for k in keys), 'reviewed ordinary pointer focus only'
    return end

def bind(review):
    cutoff()
    rr = c.read(review + '.json')
    reviewed = c.read(review + '-review.json')
    assert reviewed['observation'].strip() and reviewed.get('submittedScene') is True, 'actual submitted scene must be personally reviewed before bind'
    assert 0 <= time.time() - rr['at'] < 30 and 0 <= time.time() - reviewed['at'] < 30, 'initial scene expired'
    assert reviewed['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (review + '.png')).read_bytes()).hexdigest(), 'initial scene hash changed'
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    c.bind()

def pulse(name, keys, ms, review, observation, mode, route=None):
    assert 40 <= ms <= 1500, 'original pulses reserve 250ms below the two-second physical limit'
    policy(keys, review, mode, route, True)
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            if mode != 'quit':
                command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int(end * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, review, observation,
                       final=mode == 'quit' and route == 'select-quit',
                       maxSceneAge=5 if mode == 'combat' else 30)
    finally:
        c.call = original

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'capture':
        print(c.capture(sys.argv[2]))
    elif mode == 'bind':
        bind(sys.argv[2])
    elif mode in ('menu', 'combat', 'focus', 'quit'):
        _, _, name, key, ms, review, observation, *flags = sys.argv
        route = flags[0] if mode == 'quit' else None
        rr = c.read(review + '.json')
        c.save(review + '-review.json', dict(at=time.time(), pngSHA256=rr['pngSHA256'],
                                           observation=observation, mode=mode, quitRoute=route,
                                           selectedQuit='selected-quit' in flags))
        print(pulse(name, key.split(','), int(ms), review, observation, mode, route))
    else:
        raise ValueError(mode)

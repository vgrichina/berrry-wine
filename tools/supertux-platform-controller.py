"""Manual SuperTux choices using the released control-before-fsync transport.

No route selection, player tracking, automatic jumps, or guest writes.
"""
import importlib.util, pathlib, sys, time

spec = importlib.util.spec_from_file_location('transport', pathlib.Path(__file__).with_name('forsaken-controller.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
ROUTES = {'open-menu': 'keydown:27', 'menu-up': 'keydown:38',
          'menu-down': 'keydown:40', 'select': 'keydown:13'}
PLAY = {'keydown:' + str(k) for k in (17, 32, 37, 39, 40)}
MENU = {'keydown:' + str(k) for k in (13, 27, 37, 38, 39, 40)}

def cutoff():
    launch = c.read('launch.json')
    end = launch['deadline'] - 180
    assert launch['at'] < end, '180-second reserve must precede launch'
    return end

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('play', 'menu', 'pause', 'quit'), 'explicit manual mode required'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end,
                                         reserveSeconds=180, irreversible=True))
    reviewed = c.read(review + '-review.json')
    assert reviewed['mode'] == mode, 'review mode changed'
    if mode == 'quit':
        assert route in ROUTES and keys == [ROUTES[route]], 'ordinary reviewed Quit route only'
        assert reviewed.get('quitRoute') == route, 'review must bind Quit route'
        if route == 'select':
            assert reviewed.get('selectedQuit') in ('Abort Level', 'Quit Game', 'Quit'), 'personally observed Quit selection required'
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase; no gameplay'
        assert time.time() + (8 if beforeArm else 0) < end, 'gameplay cutoff; preserve Quit reserve'
        assert 1 <= len(keys) <= 2 and len(set(keys)) == len(keys), 'one finite distinct manual choice'
        if mode == 'play':
            assert all(k in PLAY for k in keys), 'original movement/jump/run controls only'
            if 'keydown:32' in keys:
                assert all(reviewed.get(k) is True for k in ('floorReviewed', 'obstacleReviewed', 'launchMarginReviewed')), 'personal floor/obstacle/launch margin review required'
        elif mode == 'pause':
            assert keys == ['keydown:80'], 'documented native P only'
        else:
            assert len(keys) == 1 and keys[0] in MENU, 'ordinary startup/map menu only'
    return end

def pulse(name, keys, ms, review, observation, mode, route=None, final=False):
    assert 40 <= ms <= 1500, 'finite pulse bound with fallback acknowledgement margin'
    policy(keys, review, mode, route, True)
    original = c.call
    originalSave = c.save
    def boundedSave(n, value):
        if n == name + '-release-cap.json':
            # The released transport caps at 2s before DOWN. Leave 250ms for
            # the independent HTTP UP and ACK, including parent death before
            # it can communicate the consumed-time schedule. The child reads
            # this durable cap before any DOWN; the shared helper is unchanged.
            value = {**value, 'at': value['at'] - .25,
                     'maximumHoldMilliseconds': 1750,
                     'acknowledgementMarginMilliseconds': 250}
        return originalSave(n, value)
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            cap = c.read(name + '-release-cap.json')['at']
            assert time.time() + ms / 1000 + .1 < cap, 'complete pulse must fit shortened fallback before DOWN'
            bound = cap if mode == 'quit' else min(cap, end)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int(bound * 1000))}}
        return original(command, timeout)
    c.call = checked
    c.save = boundedSave
    try:
        return c.pulse(name, keys, ms, review, observation, final=final,
                       maxSceneAge=5 if mode in ('play', 'pause') else 30)
    finally:
        c.call = original
        c.save = originalSave

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'capture': print(c.capture(sys.argv[2]))
    elif mode == 'bind': cutoff(); c.bind()
    else:
        _, _, name, keys, ms, review, observation, *flags = sys.argv
        route = flags[0] if mode == 'quit' else None
        rr = c.read(review + '.json')
        c.save(review + '-review.json', dict(at=time.time(), pngSHA256=rr['pngSHA256'],
               observation=observation, mode=mode, quitRoute=route,
               selectedQuit=next((v for v in ('Abort Level', 'Quit Game', 'Quit') if v in flags), None),
               floorReviewed='floor' in flags, obstacleReviewed='obstacle' in flags,
               launchMarginReviewed='margin' in flags))
        print(pulse(name, keys.split(','), int(ms), review, observation, mode, route, 'final' in flags))

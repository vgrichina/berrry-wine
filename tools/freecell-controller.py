"""One personally chosen Win32 FreeCell click, with no card reader or solver.

Released Barrage transport remains read-only. Card identities, legal reasons
and settled consequences are supplied by the human/model reviewing pixels.
"""
import importlib.util, pathlib, time, hashlib, re, sys

s = importlib.util.spec_from_file_location('freecell_transport', pathlib.Path(__file__).with_name('barrage-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)

def cutoff():
    launch = c.read('launch.json')
    assert launch['deadline'] - launch['at'] > 180
    return launch['deadline'] - 180

def policy(keys, review, mode, route=None, beforeArm=False):
    assert mode in ('select', 'destination', 'menu', 'quit')
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    r = c.read(review + '-review.json')
    assert r['mode'] == mode and r['observation'].strip()
    assert len(keys) == 1 and re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', keys[0]), 'one native left click only'
    geometry = r['pixelGeometry']
    assert geometry['source'] == 'current-full-scene', 'current pixels required'
    assert geometry['target'] == c.read('native-pid.json'), 'geometry identity changed'
    _, x, y = keys[0].split(':')
    assert [int(x), int(y)] == geometry['chosenCenter'], 'click differs from reviewed pixels'
    if mode == 'quit':
        assert route in ('open-game-menu', 'select-exit', 'confirm-exit', 'quit-navigation', 'quit-confirmation')
        assert r['quitRoute'] == route and r['visibleLabel'].strip()
        assert r.get('visibleQuitTarget') is True, 'review actual visible quit route'
        if route == 'select-exit':
            assert r['visibleLabel'].replace('&', '').strip().lower() in ('exit', 'quit'), 'Exit label required'
        if route == 'confirm-exit':
            assert r.get('nativeExitConfirmation') is True
    else:
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert time.time() + (8 if beforeArm else 0) < end, 'mechanical gameplay cutoff'
    if mode in ('select', 'destination'):
        assert r.get('originalRulesUnchanged') is True
        assert r.get('settledPaint') is True, 'wait for native animation and paint'
        assert r['card'].strip() and r['legalReason'].strip(), 'personally identify card and legality'
        if mode == 'destination':
            assert r.get('selectionVisible') is True, 'review actual highlighted source'
            first = r['selectionAction']
            assert re.fullmatch(r'[a-zA-Z0-9-]+', first)
            previous = c.read(c.read(first + '-intent.json')['review'] + '-review.json')
            assert previous['mode'] == 'select' and previous['card'] == r['card']
            assert c.read(first + '-up.json')['state'] == 'ACK'
            assert r['destinationKind'] in ('tableau', 'free-cell', 'foundation')
        if r.get('previousDestination'):
            resolution = c.read(r['previousDestination'] + '-resolution.json')
            assert resolution['personallyViewed'] and resolution['settledPaint'] and resolution['observation'].strip()
    return end

def bind(review):
    cutoff()
    rr = c.read(review + '.json'); r = c.read(review + '-review.json')
    assert r.get('submittedScene') is True and r.get('nativeBoard') is True and r['observation'].strip(), 'submitted original native board required'
    assert all(0 <= time.time() - x['at'] < 30 for x in (rr, r)), 'binding review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (review + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json')
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0'
    c.bind()

def pulse(name, keys, ms, review, observation, mode, route=None):
    assert 40 <= ms <= 1500, 'finite <=1500ms; independently prearmed 1750ms UP'
    policy(keys, review, mode, route, True)
    original = c.call
    precision = mode in ('select', 'destination')
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, review, mode, route)
            sceneEnd = c.read(review + '.json')['at'] + (5 if precision else 30)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int((sceneEnd if mode == 'quit' else min(sceneEnd, end)) * 1000))}}
        return original(command, timeout)
    c.call = checked
    try:
        return c.pulse(name, keys, ms, review, observation,
                       final=mode == 'quit' and route in ('select-exit', 'confirm-exit'),
                       maxSceneAge=5 if precision else 30)
    finally:
        c.call = original

if __name__ == '__main__':
    if sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    else:
        _, mode, name, key, ms, review, *route = sys.argv
        r = c.read(review + '-review.json')
        print(pulse(name, [key], int(ms), review, r['observation'], mode, route[0] if route else None))

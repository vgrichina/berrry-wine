"""One personally chosen Tut’s Tomb click; no board reader, solver or move generator.

Released Barrage owns transport identity. Reviews are model attestations of
complete native pixels, never machine recognition or private-card inspection.
Each action prearms its own independent UP before one coordinate press.
The existing renderer supplies pointer arrival before DOWN; no hidden replay.
First/second card choices are personal attestations, never generated moves.
"""
import importlib.util
import pathlib
import time
import hashlib
import re
import sys
import os
import json
import select
import subprocess
import uuid

s = importlib.util.spec_from_file_location('tutstomb_transport', pathlib.Path(__file__).with_name('barrage-guard.py'))
c = importlib.util.module_from_spec(s)
s.loader.exec_module(c)


def cutoff():
    launch = c.read('launch.json')
    assert launch['deadline'] - launch['at'] > 180
    return launch['deadline'] - 180


def reviewed(scene, age):
    rr = c.read(scene + '.json'); r = c.read(scene + '-review.json')
    assert r.get('submittedScene') is True and r.get('observation', '').strip(), 'personal complete scene review required'
    assert all(0 <= time.time() - v['at'] < age for v in (rr, r)), 'scene review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (scene + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0'
    assert r.get('rawCompleteScene') is True, 'raw complete scene required'
    return rr, r


def bind(scene):
    cutoff(); rr, r = reviewed(scene, 30)
    assert r.get('sceneType') == 'board', 'complete actual default pyramid required before binding'
    assert r.get('completePyramid') is True and r.get('visibleBoardDescription', '').strip()
    c.bind()
    expected = {k: rr['snapshot'][k] for k in ('mainHwnd', 'screen')}
    if c.read('lease-snapshot.json') != expected:
        c.fail('binding scene differs from permanent native window', 'bind')
        raise AssertionError('binding scene differs from permanent native window')
    c.save('binding-scene.json', dict(scene=scene, sceneType=r['sceneType'], target=rr['target'], at=time.time()))


def admit(scene):
    c.lease(); rr, r = reviewed(scene, 5)
    assert not (c.R / 'quit-phase.json').exists()
    assert r.get('sceneType') == 'board' and r.get('defaultDeal') is True
    assert r.get('visibleBoardDescription', '').strip() and r.get('completePyramid') is True
    assert r.get('rulesEvidence', '').strip(), 'review original rules before choosing cards'
    c.save('board-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], at=time.time()))


def outcome(scene):
    c.lease(); rr, r = reviewed(scene, 30)
    assert r.get('naturalOutcome') in ('win', 'loss', 'deck-exhaustion')
    assert r.get('visibleNativeOutcome') is True and r.get('outcomeEvidence', '').strip()
    c.save('natural-outcome.json', dict(scene=scene, outcome=r['naturalOutcome'], evidence=r['outcomeEvidence'], pngSHA256=rr['pngSHA256'], at=time.time()))


def policy(command, scene, mode, route=None):
    assert mode in ('select', 'draw', 'recycle', 'menu', 'quit')
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), reserveSeconds=180, irreversible=True))
    rr, r = reviewed(scene, 5 if mode in ('select', 'draw', 'recycle') else 30)
    assert r['mode'] == mode
    assert re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', command), 'single LEFT click only; no key reset, undo, action list'
    if mode != 'quit':
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert not (c.R / 'natural-outcome.json').exists(), 'natural outcome ends gameplay'
        assert time.time() + 3 < end, 'gameplay cutoff'
    if mode in ('select', 'draw', 'recycle'):
        assert (c.R / 'board-admitted.json').exists(), 'personally reviewed dealt board required'
        assert r.get('sceneType') == 'board' and r.get('defaultDeal') is True
        assert r.get('settledPaint') is True and r.get('originalRulesUnchanged') is True
        assert r.get('legalReason', '').strip()
        assert r.get('hoverBeforeClick') == 'native-coordinate-press', 'supported hover path required'
        if mode == 'select':
            assert r.get('visibleRank', '').strip() and r.get('exposedCard') is True
            assert r.get('exposedEvidence', '').strip() and r.get('targetKind') in ('pyramid', 'waste')
            rank = r['rankValue']
            assert type(rank) is int and 1 <= rank <= 13
            assert r.get('pairRole') in ('first', 'second', 'king')
            if r['pairRole'] == 'king':
                assert rank == 13 and r.get('currentSelection') is None
            elif r['pairRole'] == 'second':
                selected = r['currentSelection']
                assert selected['visible'] is True and selected['evidence'].strip()
                assert type(selected['rankValue']) is int and selected['rankValue'] + rank == 13
                assert selected['reviewScene'] == scene, 'separate current review after first selection required'
                assert selected['firstAction'] != ''
                first = c.read(selected['firstAction'] + '-intent.json')
                assert first['target'] == rr['target'] and first['createdAt'] < rr['at']
                assert c.read(selected['firstAction'] + '-completed.json')['actualRemovalClaim'] is False
                firstReview = c.read(first['scene'] + '-review.json')
                assert firstReview['pairRole'] == 'first' and firstReview['rankValue'] == selected['rankValue']
            else:
                assert rank != 13 and r.get('currentSelection') is None
                assert r.get('visiblePartner', '').strip(), 'personally choose a visible legal partner before first selection'
        else:
            assert r.get('stockJustification', '').strip(), 'personally justify stock action'
            assert r.get('visibleStockAvailable') is True and r.get('targetKind') == 'stock'
            if mode == 'recycle':
                assert r.get('visibleRecycleTarget') is True and r.get('visibleDrawThreeRule') is True
    elif mode == 'menu':
        assert route in ('open-help', 'how-to-play', 'dismiss-help', 'dismiss-menu')
        assert r.get('menuRoute') == route and r.get('visibleLabel', '').strip()
        assert r.get('targetKind') == 'menu', 'no New/Backup/Options/record controls'
    else:
        assert route in ('open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit', 'dismiss-outcome')
        assert r.get('quitRoute') == route and r.get('visibleQuitTarget') is True
        if route == 'confirm-exit': assert r.get('nativeExitConfirmation') is True
        if route == 'dismiss-outcome': assert r.get('nativeOutcomeDialog') is True
        if route == 'select-exit': assert r.get('visibleLabel', '').replace('&', '').strip().lower() in ('exit', 'quit')
    g = r['pixelGeometry']
    assert g['source'] == 'current-full-scene' and g['target'] == rr['target']
    point = [int(v) for v in command.split(':')[1:]]
    assert point == g['chosenCenter'], 'pointer differs from reviewed pixels'
    assert 0 <= point[0] < rr['snapshot']['screen']['w'] and 0 <= point[1] < rr['snapshot']['screen']['h']
    assert not list(c.R.glob(scene + '-used-by-*')), 'fresh scene required; no replay'
    return rr, r, min(rr['at'] + (5 if mode in ('select', 'draw', 'recycle') else 30), c.read('launch.json')['deadline'] if mode == 'quit' else end)

def consumed(r, owner, nonce):
    return (r.get('state') == 'CONSUMED' and r.get('consumed') is True
            and r.get('owner') == owner['owner'] and r.get('epoch') == owner['epoch']
            and r.get('nonce') == nonce and type(r.get('consumedAt')) in (int, float))


def release(name):
    p = c.read(name + '-intent.json'); due = p['fallbackAt']; pending = b''; ack = None; reason = 'fallback'
    print(json.dumps(dict(armed=True, pid=os.getpid(), target=p['target'], fallbackAt=due)), flush=True)
    try:
        while time.time() < due:
            if select.select([sys.stdin.buffer], [], [], min(.005, max(0, due-time.time())))[0]:
                data = os.read(sys.stdin.fileno(), 4096)
                if not data: reason = 'parent EOF'; break
                pending += data
                if b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    assert ack is None and not pending, 'one schedule only'
                    v = json.loads(line); ack = v['receipt']
                    assert consumed(ack, p['owner'], p['nonce'])
                    assert v['at'] == ack['consumedAt']/1000 + p['milliseconds']/1000
                    assert v['at'] <= p['gestureDeadline']
                    due = v['at']; reason = 'consumed pulse'
    finally:
        fired = time.time()
        try:
            reply = c.call(dict(action='guarded-release', owner=p['owner']['owner']), timeout=.5)
            assert reply.get('released') is True and reply.get('owner') == p['owner']['owner']
            up = dict(state='ACK', reply=reply, at=time.time())
        except Exception as e:
            wait = c.exited_owner(p['target']) if p['final'] and ack is not None else None
            up = (dict(state='OWNER_EXITED', physicalUpACK=False, nativeWait=wait, at=time.time()) if wait
                  else dict(state='UNKNOWN', error=str(e), at=time.time()))
        c.save(name + '-up.json', dict(**up, firedAt=fired, reason=reason))
        if up['state'] == 'UNKNOWN' or reason != 'consumed pulse': c.fail('independent release unresolved: '+reason, name)


def action(name, command, scene, mode, milliseconds=400, route=None):
    assert name.replace('-', '').isalnum()
    assert type(milliseconds) is int and 40 <= milliseconds <= 1500
    for suffix in ('-intent.json', '-up.json', '-receipt.json', '-completed.json', '.png', '.json'):
        assert not (c.R / (name+suffix)).exists(), 'name already reserved'
    # A local policy refusal before reservation/transport has no input effect.
    rr, r, sceneEnd = policy(command, scene, mode, route)
    assert time.time()+milliseconds/1000+.7 < sceneEnd, 'insufficient fresh scene window; not sent'
    child = None; receipt = None; error = None; armed = None
    try:
        owner, before = c.lease()
        now = time.time()
        p = dict(name=name, command=command, scene=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], owner=owner,
                 nonce=str(uuid.uuid4()), noReplay=True, physicalGesture='native coordinate hover then one left DOWN then independent UP', milliseconds=milliseconds, createdAt=now,
                 gestureDeadline=now+1.500, fallbackAt=now+1.750,
                 final=mode=='quit' and route in ('select-exit', 'titlebar-close', 'confirm-exit'), sceneDeadline=sceneEnd)
        c.save(name+'-intent.json', p); c.save(scene+'-used-by-'+name, dict(name=name))
        child = subprocess.Popen([sys.executable, '-B', __file__, 'release', name], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        assert select.select([child.stdout], [], [], .5)[0], 'independent UP not armed'
        armed = json.loads(child.stdout.readline())
        assert armed['armed'] and armed['target'] == p['target'] and armed['fallbackAt'] == p['fallbackAt']
        assert child.poll() is None, 'independent UP child died before DOWN'
        assert time.time()+milliseconds/1000+.15 < p['gestureDeadline'], 'hold cannot fit before DOWN'
        assert time.time() < sceneEnd, 'scene expired before DOWN'
        os.set_blocking(child.stdin.fileno(), False)
        receipt = c.call(dict(action='guarded-input', cmd=command,
                         guard={**owner, 'nonce':p['nonce'], 'reviewed':True,
                                'deadline':int(min(sceneEnd,p['gestureDeadline'])*1000)}), timeout=.5)
        assert consumed(receipt, owner, p['nonce']), 'input unresolved; no replay'
        due = receipt['consumedAt']/1000 + milliseconds/1000
        payload = (json.dumps(dict(at=due, receipt=receipt))+'\n').encode()
        assert len(payload) < 4096 and os.write(child.stdin.fileno(), payload) == len(payload)
        assert time.time()+.04 < due <= p['gestureDeadline'], 'late ACK; closed after independent UP'
        # No capture, model call or persistence until independent physical UP.
        child.wait(timeout=3)
    except BaseException as e:
        error = e
    finally:
        if child is not None:
            out, err = child.communicate(timeout=5)
            c.save(name+'-release-wait.json', dict(pid=child.pid, exit=child.returncode, actualWait=True, stdoutEOF=True, stderrEOF=True, stdout=out.decode(), stderr=err.decode()))
        if armed is not None: c.save(name+'-armed.json', armed)
        if receipt is not None: c.save(name+'-receipt.json', receipt)
    try:
        if error: raise error
        assert child.returncode == 0, 'independent UP child failed'
        up = c.read(name+'-up.json')
        assert up['state'] in ('ACK', 'OWNER_EXITED') and up['reason'] == 'consumed pulse'
        assert up['firedAt'] <= p['fallbackAt'] and up['at']-receipt['consumedAt']/1000 <= 1.500, 'release exceeded bound'
        if up['state'] == 'OWNER_EXITED':
            assert p['final'] and c.exited_owner(p['target']) == up['nativeWait']
            c.save('terminal-owner-exited.json', dict(name=name, physicalUpACK=False, nativeQuitClaim=False, noReplay=True))
        else:
            old = c.R/'last-intent.json'
            if old.exists(): old.unlink()
            c.save('last-intent.json', dict(nonces=[p['nonce']]))
        c.save(name+'-completed.json', dict(at=time.time(), actualRemovalClaim=False, nativeQuitClaim=False, before=before))
        return 'Final choice; await actual native wait' if p['final'] else c.capture(name)
    except BaseException as e:
        c.fail(e, name); raise


if __name__ == '__main__':
    if sys.argv[1] == 'release': release(sys.argv[2])
    elif sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit': admit(sys.argv[2])
    elif sys.argv[1] == 'outcome': outcome(sys.argv[2])
    else:
        _, mode, name, command, scene, ms, *route = sys.argv
        print(action(name, command, scene, mode, int(ms), route[0] if route else None))


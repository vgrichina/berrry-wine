"""Personally reviewed original WEP3 Tetravex: one bounded gesture, no puzzle reader.
Transport receipts never assert native placement or matching acceptance.
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

s = importlib.util.spec_from_file_location('tetravex16_transport', pathlib.Path(__file__).with_name('barrage-guard.py'))
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
    assert r.get('sceneType') in ('title', 'board')
    assert r.get('originalRegisteredTitle') is True
    c.bind()
    if c.read('lease-snapshot.json') != {k: rr['snapshot'][k] for k in ('mainHwnd', 'screen')}:
        c.fail('binding scene differs from permanent native window', 'bind')
        raise AssertionError('binding scene differs from permanent native window')
    c.save('binding-scene.json', dict(scene=scene, target=rr['target'], at=time.time()))


def admit(scene):
    c.lease(); rr, r = reviewed(scene, 5)
    assert not (c.R / 'quit-phase.json').exists()
    assert r.get('sceneType') == 'board' and r.get('originalDefaultPuzzle') is True
    assert r.get('completeBoard') is True and r.get('visibleBoardDescription', '').strip()
    assert r.get('rulesEvidence', '').strip()
    c.save('board-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], at=time.time()))


def outcome(scene):
    c.lease(); rr, r = reviewed(scene, 30)
    assert r.get('nativeCompletionUI') is True and r.get('completionEvidence', '').strip()
    c.save('natural-outcome.json', dict(scene=scene, evidence=r['completionEvidence'], pngSHA256=rr['pngSHA256'], at=time.time()))


def acceptance(actionName, scene):
    """Only a personal review of persistent native pixels can count a placement."""
    c.lease(); rr, r = reviewed(scene, 5)
    intent = c.read(actionName+'-intent.json')
    assert intent['destination'] is not None and intent['target'] == rr['target']
    assert c.read(actionName+'-completed.json')['actualPlacementClaim'] is False
    assert rr['at'] > c.read(actionName+'-up.json')['at']
    assert r.get('nativePlacementAccepted') is True and r.get('persistentPlacement') is True
    assert r.get('sourceNowEmpty') is True and r.get('completeBoard') is True
    assert r.get('nativeAcceptanceEvidence', '').strip()
    prior = c.read(intent['scene']+'-review.json')
    assert r['destinationSlot'] == prior['destinationSlot'] and r['visibleEdges'] == prior['visibleEdges']
    assert r['neighbors'] == prior['neighbors'] and r.get('allAdjacentNeighborsReviewed') is True
    c.save(actionName+'-native-accepted.json', dict(scene=scene, at=time.time(), pngSHA256=rr['pngSHA256'],
        visibleEdges=r['visibleEdges'], destinationSlot=r['destinationSlot'], neighbors=r['neighbors'],
        evidence=r['nativeAcceptanceEvidence'], nativeCompletionClaim=False))


def policy(command, scene, mode, route=None):
    assert mode in ('place', 'menu', 'quit')
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), reserveSeconds=180, irreversible=True))
    rr, r = reviewed(scene, 5 if mode == 'place' else 30)
    assert r['mode'] == mode
    assert re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', command), 'one physical gesture only'
    if mode != 'quit':
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert not (c.R / 'natural-outcome.json').exists(), 'completion ends gameplay'
        assert time.time() + 3 < end, 'gameplay cutoff'
    if mode == 'place':
        assert (c.R / 'board-admitted.json').exists(), 'personally reviewed actual board required'
        assert r.get('sceneType') == 'board' and r.get('originalDefaultPuzzle') is True
        assert r.get('completeBoard') is True and r.get('settledPaint') is True
        assert r.get('rulesEvidence', '').strip() and r.get('legalReason', '').strip()
        assert r.get('inputRoute') == 'original-help-drag', 'original native input authority required'
        assert set(r['visibleEdges']) == {'top', 'right', 'bottom', 'left'}
        assert all(type(v) is str and v.strip() for v in r['visibleEdges'].values())
        assert r.get('sourceSlot', '').strip() and r.get('destinationSlot', '').strip()
        assert r.get('destinationEmpty') is True
        assert type(r['neighbors']) is list
        opposite = {'top':'bottom', 'bottom':'top', 'left':'right', 'right':'left'}
        for n in r['neighbors']:
            assert n['side'] in opposite and n['visible'] is True and n['evidence'].strip()
            assert n['touchingEdge'] == r['visibleEdges'][n['side']], 'adjacent edges must match'
        assert r.get('allAdjacentNeighborsReviewed') is True
        assert r.get('destinationGeometrySource') == 'current-full-scene'
        dest = r['destinationCenter']
        assert type(dest) is list and len(dest) == 2 and all(type(v) is int for v in dest)
        assert 0 <= dest[0] < rr['snapshot']['screen']['w'] and 0 <= dest[1] < rr['snapshot']['screen']['h']
    elif mode == 'menu':
        assert route in ('ordinary-start', 'open-help', 'how-to-play', 'dismiss-help', 'dismiss-menu')
        assert r.get('menuRoute') == route and r.get('visibleLabel', '').strip()
        if route == 'ordinary-start':
            assert r.get('startNeeded') is True and r.get('sceneType') == 'title'
            assert not (c.R/'board-admitted.json').exists() and not (c.R/'ordinary-start-intent.json').exists()
            assert r['visibleLabel'].replace('&','').strip().lower() in ('start','play','ok')
    else:
        assert route in ('open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit')
        assert r.get('quitRoute') == route and r.get('visibleQuitTarget') is True
        if route == 'confirm-exit': assert r.get('nativeExitConfirmation') is True
        if route == 'select-exit': assert r.get('visibleLabel', '').replace('&', '').strip().lower() in ('exit', 'quit')
    g = r['pixelGeometry']
    assert g['source'] == 'current-full-scene' and g['target'] == rr['target']
    point = [int(v) for v in command.split(':')[1:]]
    assert point == g['chosenCenter'], 'pointer differs from reviewed pixels'
    assert 0 <= point[0] < rr['snapshot']['screen']['w'] and 0 <= point[1] < rr['snapshot']['screen']['h']
    assert not list(c.R.glob(scene + '-used-by-*')), 'fresh scene required; no replay'
    return rr, r, min(rr['at'] + (5 if mode == 'place' else 30), c.read('launch.json')['deadline'] if mode == 'quit' else end)


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
            destinationError = None
            if p.get('destination') is not None and reason == 'consumed pulse':
                try:
                    upReceipt = c.call(dict(action='guarded-input', cmd='mouseup:'+':'.join(map(str,p['destination'])),
                        guard={**p['owner'], 'nonce':p['upNonce'], 'reviewed':True, 'deadline':int(p['gestureDeadline']*1000)}), timeout=.3)
                    assert consumed(upReceipt, p['owner'], p['upNonce']), 'destination UP unresolved'
                except Exception as e:
                    destinationError = e; upReceipt = None
            else: upReceipt = None
            reply = c.call(dict(action='guarded-release', owner=p['owner']['owner']), timeout=.5)
            assert reply.get('released') is True and reply.get('owner') == p['owner']['owner']
            if destinationError is not None: raise destinationError
            up = dict(state='ACK', reply=reply, destinationReceipt=upReceipt, at=time.time())
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
                 destination=r['destinationCenter'] if mode=='place' else None, upNonce=str(uuid.uuid4()), moveNonce=str(uuid.uuid4()), final=mode=='quit' and route in ('select-exit', 'titlebar-close', 'confirm-exit'), sceneDeadline=sceneEnd)
        if route == 'ordinary-start': c.save('ordinary-start-intent.json', dict(name=name, scene=scene))
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
        if p['destination'] is not None:
            # One predetermined physical trajectory, never capture or plan while held.
            time.sleep(.04)
            moved = c.call(dict(action='guarded-input', cmd='mousemove:'+':'.join(map(str,p['destination'])),
                       guard={**owner, 'nonce':p['moveNonce'], 'reviewed':True, 'deadline':int(p['gestureDeadline']*1000)}), timeout=.3)
            assert consumed(moved, owner, p['moveNonce']), 'move unresolved; no replay'
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
            c.save('last-intent.json', dict(nonces=[p['nonce']]+([p['moveNonce'],p['upNonce']] if p['destination'] is not None else [])))
        c.save(name+'-completed.json', dict(at=time.time(), actualPlacementClaim=False, nativeQuitClaim=False, before=before))
        return 'Final choice; await actual native wait' if p['final'] else c.capture(name)
    except BaseException as e:
        c.fail(e, name); raise


if __name__ == '__main__':
    if sys.argv[1] == 'release': release(sys.argv[2])
    elif sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit': admit(sys.argv[2])
    elif sys.argv[1] == 'outcome': outcome(sys.argv[2])
    elif sys.argv[1] == 'accept': acceptance(sys.argv[2], sys.argv[3])
    else:
        _, mode, name, command, scene, ms, *route = sys.argv
        print(action(name, command, scene, mode, int(ms), route[0] if route else None))


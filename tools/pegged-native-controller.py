"""Personally chosen original Pegged drag over supported guarded pointer edges.

No board recognition, move generation, guest state access or arbitrary action
list. The independent child is armed before DOWN. Normal release occurs at the
reviewed destination only after both DOWN and MOVE acknowledge consumption;
EOF, cancellation or uncertainty releases the original source and closes input.
"""
import importlib.util
import pathlib
import sys
import time
import os
import json
import select
import subprocess
import uuid

s = importlib.util.spec_from_file_location('released_pegged', pathlib.Path(__file__).with_name('pegged-controller.py'))
a = importlib.util.module_from_spec(s)
s.loader.exec_module(a)
c = a.c


def policy(scene, milliseconds):
    assert type(milliseconds) is int and 100 <= milliseconds <= 1500, 'finite gesture including movement'
    assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
    assert not (c.R / 'natural-outcome.json').exists(), 'natural outcome ends gameplay'
    assert time.time() + 8 < a.cutoff(), 'gameplay cutoff'
    assert (c.R / 'board-admitted.json').exists(), 'actual default board required'
    rr, r = a.reviewed(scene, 5)
    assert r.get('mode') == 'drag' and r.get('sceneType') == 'board'
    assert r.get('defaultBoard') is True and r.get('originalRulesUnchanged') is True
    assert r.get('settledPaint') is True and r.get('nativeSemantics') == 'original-left-drag'
    for k in ('sourcePeg', 'jumpedPeg', 'emptyDestination', 'legalReason'):
        assert r.get(k, '').strip(), 'personal source/midpoint/destination/legal reason required'
    assert all(r.get(k) is True for k in ('sourceOccupied', 'jumpedOccupied', 'destinationEmpty'))
    assert type(r.get('remainingBefore')) is int and r['remainingBefore'] > 1
    g = r['pixelGeometry']
    assert g['source'] == 'current-full-scene' and g['target'] == c.read('native-pid.json')
    for k in ('sourceCenter', 'destinationCenter'):
        assert type(g[k]) is list and len(g[k]) == 2
        assert all(type(x) is int for x in g[k])
        assert 0 <= g[k][0] < rr['snapshot']['screen']['w'] and 0 <= g[k][1] < rr['snapshot']['screen']['h']
    assert g['sourceCenter'] != g['destinationCenter']
    for p in c.R.glob('*-drag-intent.json'):
        name = c.read(p.name)['name']
        assert (c.R / (name + '-resolution.json')).exists(), 'personally review completed gesture before next drag'
    assert not list(c.R.glob(scene + '-used-by-*')), 'fresh complete scene required'
    return rr, r


def consumed(r, owner, nonce):
    return (r.get('state') == 'CONSUMED' and r.get('consumed') is True
            and r.get('owner') == owner['owner'] and r.get('epoch') == owner['epoch']
            and r.get('nonce') == nonce and isinstance(r.get('consumedAt'), (int, float)))


def release_child(name):
    p = c.read(name + '-drag-intent.json')
    owner = p['owner']; cap = p['fallbackAt']; due = cap
    print(json.dumps(dict(armed=True, pid=os.getpid(), fallbackAt=cap, target=p['target'])), flush=True)
    pending = b''; schedule = None; reason = 'fallback'; up = None
    try:
        while time.time() < due:
            if select.select([sys.stdin.buffer], [], [], min(.005, max(0, due-time.time())))[0]:
                data = os.read(sys.stdin.fileno(), 4096)
                if not data:
                    reason = 'parent EOF'; break
                pending += data
                if b'\n' in pending:
                    line, pending = pending.split(b'\n', 1)
                    assert schedule is None and not pending, 'one fixed gesture schedule only'
                    v = json.loads(line)
                    assert all(consumed(r, owner, n) for r, n in zip(v['receipts'], p['nonces'][:2])) and len(v['receipts']) == 2
                    downAt = v['receipts'][0]['consumedAt']/1000
                    assert v['at'] == downAt + p['milliseconds']/1000
                    assert v['at'] <= p['gestureDeadline'] <= cap
                    schedule = v; due = v['at']; reason = 'reviewed destination'
        if schedule and reason == 'reviewed destination' and time.time() < p['gestureDeadline']:
            x, y = p['destination']
            r = c.call(dict(action='guarded-input', cmd=f'mouseup:{x}:{y}',
                 guard={**owner, 'nonce':p['nonces'][2], 'reviewed':True,
                        'deadline':int(p['gestureDeadline']*1000)}), timeout=.25)
            assert consumed(r, owner, p['nonces'][2]), 'destination UP unresolved'
            up = r
    finally:
        # Physical cleanup precedes any durable audit, even on child exceptions.
        fired = time.time()
        try:
            reply = c.call(dict(action='guarded-release', owner=owner['owner']), timeout=.5)
            result = dict(state='ACK', reply=reply, at=time.time())
        except Exception as e:
            result = dict(state='UNKNOWN', error=str(e), at=time.time())
        c.save(name + '-up.json', dict(**result, destinationReceipt=up, reason=reason, firedAt=fired, schedule=schedule))
        if result['state'] != 'ACK' or up is None:
            c.fail('destination UP unproven: '+reason, name)
        assert result['state'] == 'ACK', 'independent release UNKNOWN'


def drag(name, scene, milliseconds=500):
    assert name.replace('-', '').isalnum()
    rr, r = policy(scene, milliseconds)
    owner, before = c.lease()
    for suffix in ('-drag-intent.json', '-up.json', '-resolution.json', '.png', '.json'):
        assert not (c.R/(name+suffix)).exists(), 'name already reserved'
    now = time.time()
    nonces = [str(uuid.uuid4()) for _ in range(3)]
    p = dict(name=name, review=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], owner=owner,
             source=r['pixelGeometry']['sourceCenter'], destination=r['pixelGeometry']['destinationCenter'],
             milliseconds=milliseconds, nonces=nonces, createdAt=now,
             fallbackAt=now+1.750, gestureDeadline=now+1.500,
             sceneDeadline=min(rr['at']+5, a.cutoff()))
    c.save(name+'-drag-intent.json', p)
    c.save(scene+'-used-by-'+name, dict(name=name))
    child = subprocess.Popen([sys.executable, '-B', __file__, 'release-drag', name],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    receipts = []; error = None; armed = None
    try:
        assert select.select([child.stdout], [], [], .5)[0], 'independent UP not armed'
        armed = json.loads(child.stdout.readline())
        assert armed['armed'] and armed['fallbackAt'] == p['fallbackAt'] and armed['target'] == p['target']
        assert time.time()+milliseconds/1000+.150 < p['gestureDeadline'], 'complete gesture cannot fit before DOWN'
        assert time.time() < p['sceneDeadline'] and time.time()-r['at'] < 5, 'review expired before DOWN'
        os.set_blocking(child.stdin.fileno(), False)
        # Fixed two-edge prefix. No model calls, capture, persistence or waypoints.
        x, y = p['source']
        down = c.call(dict(action='guarded-input', cmd=f'mousedown:{x}:{y}',
                      guard={**owner, 'nonce':nonces[0], 'reviewed':True,
                             'deadline':int(min(p['sceneDeadline'],p['gestureDeadline'])*1000)}), timeout=.25)
        receipts.append(down)
        assert consumed(down, owner, nonces[0]), 'DOWN unresolved; no replay'
        due = down['consumedAt']/1000 + milliseconds/1000
        assert time.time()+.1 < due <= p['gestureDeadline'], 'late DOWN ACK'
        x, y = p['destination']
        move = c.call(dict(action='guarded-input', cmd=f'mousemove:{x}:{y}',
                      guard={**owner, 'nonce':nonces[1], 'reviewed':True,
                             'deadline':int(min(due,p['sceneDeadline'])*1000)}), timeout=.25)
        receipts.append(move)
        assert consumed(move, owner, nonces[1]), 'MOVE unresolved; no replay'
        assert time.time()+.05 < due, 'late MOVE ACK'
        payload=(json.dumps(dict(at=due, receipts=receipts))+'\n').encode()
        assert len(payload)<4096 and os.write(child.stdin.fileno(),payload)==len(payload)
        # Keep control pipe open until physical release completes. EOF cancels.
        child.wait(timeout=3)
    except BaseException as e:
        error = e
    finally:
        try:
            out, err = child.communicate(timeout=5)
        except BaseException as e:
            c.fail(e,name); raise
        c.save(name+'-armed.json', armed)
        c.save(name+'-edges.json', receipts)
        c.save(name+'-release-wait.json', dict(pid=child.pid, exit=child.returncode, actualWait=True,
                    stdoutEOF=True, stderrEOF=True, stdout=out.decode(), stderr=err.decode()))
    try:
        if error: raise error
        assert child.returncode == 0
        up = c.read(name+'-up.json')
        assert up['state']=='ACK' and consumed(up['destinationReceipt'],owner,nonces[2])
        assert up['at'] <= p['fallbackAt'] and up['destinationReceipt']['consumedAt']/1000-down['consumedAt']/1000 <= 1.5
        old=c.R/'last-intent.json'
        if old.exists(): old.unlink()
        c.save('last-intent.json', dict(nonces=nonces))
        c.save(name+'-completed.json',dict(at=time.time(),before=before,actualRemovalClaim=False))
        return c.capture(name)
    except BaseException as e:
        c.fail(e,name); raise


def resolve(name, scene):
    c.lease()
    rr, r = a.reviewed(scene, 30)
    p = c.read(name+'-drag-intent.json'); prior=c.read(p['review']+'-review.json')
    assert (c.R/(name+'-completed.json')).exists()
    assert r.get('sceneType')=='board' and r.get('settledPaint') is True
    assert all(r.get(k) is True for k in ('sourceNowEmpty','jumpedNowEmpty','destinationNowOccupied'))
    assert all(r[k]==prior[k] for k in ('sourcePeg','jumpedPeg','emptyDestination'))
    assert type(r['remainingBefore']) is int and type(r['remainingAfter']) is int
    assert r['remainingBefore']==prior['remainingBefore'] and r['remainingAfter']==r['remainingBefore']-1
    assert r.get('removalEvidence','').strip()
    c.save(name+'-resolution.json',dict(personallyViewed=True,scene=scene,**r))


def dismiss_outcome(name, scene):
    """Acknowledge an actually reviewed native result dialog, never restart."""
    assert (c.R/'natural-outcome.json').exists(), 'record actual natural outcome first'
    rr, r = a.reviewed(scene, 30)
    assert r.get('mode') == 'dismiss-outcome' and r.get('visibleOutcomeDismissal') is True
    assert r.get('dialogCaption') in ('You Win!', 'Game Over')
    assert r.get('dismissLabel') == 'OK', 'only the native result OK button'
    g = r['pixelGeometry']
    assert g['source']=='current-full-scene' and g['target']==c.read('native-pid.json')
    x, y = g['chosenCenter']
    assert type(x) is int and type(y) is int and 0<=x<rr['snapshot']['screen']['w'] and 0<=y<rr['snapshot']['screen']['h']
    return c.pulse(name,[f'mousedown:{x}:{y}'],400,scene,r['observation'])


if __name__=='__main__':
    if sys.argv[1]=='release-drag': release_child(sys.argv[2])
    elif sys.argv[1]=='drag': print(drag(sys.argv[2],sys.argv[3],int(sys.argv[4])))
    elif sys.argv[1]=='dismiss-outcome': print(dismiss_outcome(sys.argv[2],sys.argv[3]))
    elif sys.argv[1]=='resolve': resolve(sys.argv[2],sys.argv[3])
    elif sys.argv[1]=='capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1]=='bind': a.bind(sys.argv[2])
    elif sys.argv[1]=='admit-board': a.admit_board(sys.argv[2])
    elif sys.argv[1]=='outcome': a.outcome(sys.argv[2])
    else:
        _,mode,name,key,ms,scene,*route=sys.argv
        assert int(ms)<1500, 'no capture while held'
        print(a.pulse(name,[key],int(ms),scene,c.read(scene+'-review.json')['observation'],mode,route[0] if route else None))

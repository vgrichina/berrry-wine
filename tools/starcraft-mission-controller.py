"""One personally reviewed native mission gesture; no game interpretation.

Human reviews are assertions, never pixel recognition or private-world reads.
The released transport owns permanent identity, nonces and independent UP.
"""
import hashlib
import importlib.util
import pathlib
import re
import sys
import time

spec = importlib.util.spec_from_file_location('sc_combat', pathlib.Path(__file__).with_name('starcraft-combat-controller.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
c = b.c
GAMEPLAY = b.GAMEPLAY
cutoff = b.cutoff
reviewed = b.reviewed
bind = b.bind


def world(r):
    assert r.get('completeWorldReview', '').strip(), 'personally review complete current world'
    assert r.get('visibleObjectives', '').strip(), 'read actual visible mission objectives'
    assert r.get('pauseState') in ('not-observed', 'observed-native-pause'), 'no assumed pause or frozen clock'
    if r['pauseState'] == 'observed-native-pause':
        assert r.get('nativePauseEvidence', '').strip(), 'native pause needs visible evidence'


def admit_mission(scene):
    _, r = reviewed(scene, 5)
    world(r)
    b.admit_mission(scene)


def policy(keys, scene, mode, route=None, before_arm=False):
    if mode not in ('command', 'target'):
        end = b.policy(keys, scene, mode, route, before_arm)
        if mode in GAMEPLAY:
            world(reviewed(scene, 5)[1])
        return end
    end = cutoff()
    if time.time() >= end and not (c.R/'quit-phase.json').exists():
        c.save('quit-phase.json', dict(at=time.time(), cutoff=end, reserveSeconds=180, irreversible=True))
    assert not (c.R/'quit-phase.json').exists(), 'irreversible Quit phase'
    assert time.time() + (8 if before_arm else 0) < end, 'mechanical gameplay cutoff'
    rr, r = reviewed(scene, 5)
    assert r['mode'] == mode
    assert len(keys) == 1 and re.fullmatch(r'mousedown:[0-9]{1,4}:[0-9]{1,4}', keys[0]), 'one finite left click'
    g = r['pixelGeometry']
    assert g['source'] == 'current-full-scene' and g['target'] == c.read('native-pid.json')
    assert [int(v) for v in keys[0].split(':')[1:]] == g['chosenCenter']
    assert r.get('visibleTarget', '').strip()
    assert (c.R/'mission-admitted.json').exists(), 'review actual mission before gameplay'
    assert r.get('sceneType') == 'mission' and r.get('unobstructedMission') is True
    world(r)
    assert r.get('selectedUnitsEvidence', '').strip(), 'actual selected unit/building HUD required'
    assert r.get('nativeCommandSemantics', '').strip(), 'visible native command required'
    kind = r.get('commandKind')
    assert kind in ('gather', 'train', 'build-menu', 'build', 'attack', 'move', 'stop', 'hold'), 'ordinary native orders only'
    if kind == 'attack':
        assert r.get('armedUnitHUD', '').strip() and r.get('visibleAttackCommand', '').strip()
    if kind == 'train':
        assert mode == 'command', 'training has no world target'
        assert r.get('selectedBuildingEvidence', '').strip()
        assert r.get('visibleTrainUnit', '').strip() and r.get('resourcesBefore', '').strip()
    if kind == 'gather':
        assert r.get('selectedWorkerEvidence', '').strip()
    if mode == 'target':
        assert kind in ('gather', 'build', 'attack', 'move')
        assert r.get('activeCommandEvidence', '').strip(), 'separate active command review'
        order = c.read(r['commandIntent']+'-mission-order.json')
        assert order['mode'] == 'command' and order['commandKind'] == kind
        assert order['target'] == rr['target'] and order['at'] <= rr['at'], 'target follows consumed command'
        assert not any(c.read(p.name)['at'] > order['at'] for p in c.R.glob('*-mission-order.json')), 'command superseded'
        if kind == 'gather':
            assert r.get('visibleResourceTarget', '').strip(), 'current mineral/gas target review'
        if kind == 'attack':
            assert r.get('visibleEnemy', '').strip()
    return end


def pulse(name, keys, ms, scene, observation, mode, route=None):
    # The inherited 1500ms route captures while held. Refuse it rather than
    # invoking that instrumentation; every permitted pulse ends before review.
    assert 80 <= ms < 1500, '80..1499ms; inherited 1500ms midpress capture refused'
    policy(keys, scene, mode, route, True)
    original = c.call
    def checked(command, timeout=10):
        if command.get('action') == 'guarded-input':
            end = policy(keys, scene, mode, route)
            scene_end = c.read(scene+'.json')['at'] + (5 if mode in GAMEPLAY else 30)
            command = {**command, 'guard': {**command['guard'], 'deadline': min(command['guard']['deadline'], int((scene_end if mode == 'quit' else min(scene_end, end))*1000))}}
        reply = original(command, timeout)
        if command.get('action') == 'guarded-input':
            assert all(reply.get(k) == command['guard'][k] for k in ('owner', 'epoch', 'nonce')), 'ACK identity mismatch; terminal'
        return reply
    c.call = checked
    try:
        result = c.pulse(name, keys, ms, scene, observation,
                         final=mode == 'quit' and route in ('confirm-abort', 'quit-game', 'confirm-quit'),
                         maxSceneAge=5 if mode in GAMEPLAY else 30)
        if mode in ('command', 'target') and (c.R/(name+'-receipt.json')).exists():
            receipt = c.read(name+'-receipt.json')
            if receipt.get('state') == 'CONSUMED' and receipt.get('consumed'):
                r = c.read(scene+'-review.json')
                c.save(name+'-mission-order.json', dict(mode=mode, commandKind=r['commandKind'],
                    scene=scene, pngSHA256=r['pngSHA256'], review=r,
                    target=c.read('native-pid.json'), at=receipt['consumedAt']/1000))
        return result
    finally:
        c.call = original


def attest_result(scene):
    c.lease()
    rr, r = reviewed(scene, 5)
    world(r)
    assert r.get('visibleResultEvidence', '').strip()
    assert r.get('attributionEvidence', '').strip()
    c.save(scene+'-result-observation.json', dict(scene=scene, pngSHA256=rr['pngSHA256'],
        target=rr['target'], review=r, at=time.time(), freshAtPersonalReview=True))


def record_result(name, before, after, persistent, intent):
    """Require three separately reviewed native scenes, never infer from ACK."""
    c.lease()
    ar, a = c.read(after+'.json'), c.read(after+'-review.json')
    attested = c.read(after+'-result-observation.json')
    assert attested['review'] == a and attested['target'] == ar['target']
    assert attested['pngSHA256'] == ar['pngSHA256'] == hashlib.sha256((c.R/(after+'.png')).read_bytes()).hexdigest()
    assert attested['freshAtPersonalReview'] is True and 0 <= attested['at'] - ar['at'] < 5
    pr, p = reviewed(persistent, 5)
    br = c.read(before+'.json')
    v = c.read(before+'-review.json')
    assert v.get('submittedScene') is True and v.get('observation', '').strip()
    assert v['pngSHA256'] == br['pngSHA256'] == hashlib.sha256((c.R/(before+'.png')).read_bytes()).hexdigest()
    order = c.read(intent+'-mission-order.json')
    assert br['target'] == order['target'] == ar['target'] == pr['target']
    assert br['at'] < order['at'] < ar['at'] < pr['at'], 'distinct before/order/after/persistent sequence'
    assert before == order['scene'], 'before is actual reviewed order scene'
    assert br['pngSHA256'] == order['pngSHA256'] and v == order['review'], 'before review must match consumed order'
    for r in (v, a, p):
        world(r)
        assert r.get('sceneType') == 'mission' and r.get('unobstructedMission') is True
    claim = p.get('resultKind')
    assert claim in ('gathering', 'production', 'objective-progress', 'unproven')
    for r in (a, p):
        assert r.get('resultKind') == claim
        assert r.get('visibleResultEvidence', '').strip()
        assert r.get('attributionEvidence', '').strip(), 'visible attributable result; no time/ACK inference'
    if claim != 'unproven':
        assert p.get('persistentResultEvidence', '').strip()
        assert p.get('confoundingChangesReviewed') is True
        if claim == 'gathering':
            assert order['mode'] == 'target' and order['commandKind'] == 'gather'
            assert p.get('visibleWorkerDelivery', '').strip() and p.get('resourcesBeforeAfter', '').strip()
        elif claim == 'production':
            assert order['mode'] == 'command' and order['commandKind'] == 'train'
            assert p.get('producedUnitIdentity', '').strip() and p.get('resourcesBeforeAfter', '').strip()
        else:
            assert p.get('nativeObjectiveProgressEvidence', '').strip(), 'incidental combat is not objective proof'
    c.save(name+'-mission-result.json', dict(before=before, after=after, persistent=persistent,
        intent=intent, resultKind=claim, proven=claim != 'unproven', review=p,
        target=pr['target'], at=time.time(), missionCompletionClaim=False))


def completion(name, scene):
    c.lease()
    rr, r = reviewed(scene, 5)
    assert r.get('nativeMissionCompletionEvidence', '').strip(), 'native victory/objective completion screen required'
    assert r.get('incidentalCombatOnly') is False
    c.save(name+'-completion-review.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], review=r,
        target=rr['target'], humanAttestation=True, at=time.time()))


if __name__ == '__main__':
    if sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit-mission': admit_mission(sys.argv[2])
    elif sys.argv[1] == 'result': record_result(*sys.argv[2:])
    elif sys.argv[1] == 'attest-result': attest_result(sys.argv[2])
    elif sys.argv[1] == 'completion': completion(*sys.argv[2:])
    else:
        _, mode, name, key, ms, scene, *route = sys.argv
        print(pulse(name, [key], int(ms), scene, c.read(scene+'-review.json')['observation'], mode, route[0] if route else None))

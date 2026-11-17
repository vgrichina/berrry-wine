"""One personally chosen JezzBall wall click; no tracking, prediction or solver.

Self-contained derivative of released Barrage/JezzBall transport identity.
Reviews attest complete native boards and qualified public cursor metadata,
never machine recognition, pointer-image capture or private-board inspection.
Each action prearms its own independent UP before sending one native click.
"""
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
import urllib.request
import urllib.parse

class Transport:
    R = pathlib.Path(os.environ.get('JEZZBALL_CONTROL_OUT', pathlib.Path(__file__).resolve().parent))
    URL = os.environ.get('JEZZBALL_CONTROL_URL', 'http://127.0.0.1:8667/ctl')
    @staticmethod
    def save(n,v):
        assert not (c.R/n).exists(),n
        pending=c.R/(n+'.pending')
        with pending.open('x') as f:json.dump(v,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
        os.rename(pending,c.R/n)
    @staticmethod
    def call(command,timeout=10):
        req=urllib.request.Request(c.URL,data=json.dumps(command).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=timeout) as f:r=json.load(f)
        if not r.get('ok'):raise RuntimeError(r)
        return r['value']
    @staticmethod
    def read(n):return json.loads((c.R/n).read_text())
    @staticmethod
    def endpoint_identity(info):
        parsed=urllib.parse.urlparse(c.URL)
        assert parsed.hostname=='127.0.0.1' and parsed.path=='/ctl','direct loopback endpoint only'
        sockets=set()
        for p in pathlib.Path('/proc/'+str(info['pid'])+'/fd').iterdir():
            try:target=str(p.readlink())
            except FileNotFoundError:continue  # A completed HTTP connection closed.
            if target.startswith('socket:'):sockets.add(target)
        inodes=[]
        for row in pathlib.Path('/proc/net/tcp').read_text().splitlines()[1:]:
            fields=row.split()
            if fields[1]=='0100007F:'+format(parsed.port,'04X') and fields[3]=='0A':inodes.append(fields[9])
        assert len(inodes)==1 and 'socket:['+inodes[0]+']' in sockets,'control socket is not exclusively owned by actual native PID'
    @staticmethod
    def opened():
        assert not (c.R/'terminal-input-failure.json').exists(),'sticky UNKNOWN/closed; no replay'
        assert not (c.R/'terminal-owner-exited.json').exists(),'native owner exited; no replay'
        assert not (c.R/'native-wait.json').exists(),'native terminal'
        assert time.time()+2<c.read('launch.json')['deadline'],'immutable runtime deadline'
        info=c.read('native-pid.json');s=pathlib.Path('/proc/'+str(info['pid'])+'/stat').read_text()
        assert s[s.rindex(')')+2:].split()[19]==info['startToken'],'native identity changed'
        c.endpoint_identity(info)
    @staticmethod
    def fail(error,name):
        if (c.R/'terminal-owner-exited.json').exists():return
        if not (c.R/'terminal-input-failure.json').exists():c.save('terminal-input-failure.json',dict(name=name,error=str(error),noReplay=True,at=time.time()))
    @staticmethod
    def bind():
        try:
            c.opened()
            # Reserve before HTTP evaluation: c.save(name, c.call(bind)) would rebind
            # first and only then notice that the permanent owner file exists.
            assert not (c.R/'input-owner.json').exists(),'permanent owner already bound; no rebind'
            c.save('bind-intent.json',dict(at=time.time(),permanent=True))
            c.save('input-owner.json',c.call({'action':'guarded-bind'}))
            s=c.call({'action':'snapshot'})
            c.save('lease-snapshot.json',{k:s[k] for k in ('mainHwnd','screen')})
        except BaseException as e:c.fail(e,'bind');raise
    @staticmethod
    def lease():
        c.opened();o=c.read('input-owner.json');s=c.call({'action':'snapshot'})
        assert not s['quit'] and s['eip']!='0x0','native owner unavailable'
        assert {k:s[k] for k in ('mainHwnd','screen')}==c.read('lease-snapshot.json'),'window/canvas lease changed'
        if (c.R/'last-intent.json').exists():
            for n in c.read('last-intent.json')['nonces']:
                r=c.call({'action':'guarded-status','nonce':n})
                assert r['owner']==o['owner'] and r['epoch']==o['epoch'],'guard ownership changed'
                assert r['state']!='UNKNOWN','sticky guard UNKNOWN'
                assert r['state'] in ('CONSUMED','CANCELLED') and r['consumed'],'prior intent unresolved'
                assert r['reason'] in (None,'immutable deadline expired','independent release'),'guard owner revoked'
        return o,s
    @staticmethod
    def capture(name):
        try:
            assert name.replace('-','').isalnum();c.opened()
            p=c.R/(name+'.png');assert not p.exists() and not (c.R/(name+'.json')).exists(),'capture name collision before observation'
            start=time.time();s=c.call({'action':'snapshot'});im=c.call({'cmd':'png:'+str(p)});end=time.time()
            c.save(name+'.json',dict(at=start,completedAt=end,snapshot=s,image=im,pngSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),target=c.read('native-pid.json')))
            return str(p)
        except BaseException as e:c.fail(e,name);raise
    @staticmethod
    def exited_owner(expected):
        """A successful actual harness wait, not a guest exit-code or physical UP claim."""
        try:
            info=c.read('native-pid.json');wait=c.read('native-wait.json')
        except (FileNotFoundError,ValueError):
            return None
        if any(info.get(k)!=expected.get(k) or wait.get(k)!=expected.get(k) for k in ('pid','startToken')):
            return None
        if not isinstance(expected.get('startToken'),str) or not expected['startToken']:
            return None
        if not all(wait.get(k) is True for k in ('actualWait','stdoutEOF','stderrEOF')):
            return None
        if wait.get('exit')!=0 or wait.get('drainErrors')!=[] or wait.get('at',0)<info['at']:
            return None
        return wait
    

c = Transport()

CURSOR_DISPLAY = "renderer.canvas.style?.cursor || 'default'"
CURSOR_NATIVE_OUTPUT = "globalThis.jezzballCursorOutput?.(renderer.canvas) || null"


def prepare_cursor(path):
    """Retain and observe actual host cursor output, without guest/input writes."""
    canvas = pathlib.Path(__file__).resolve().parents[1] / 'lib/canvas-compat.js'
    code = ("const surface = require("+json.dumps(str(canvas))+");\n"
            "const create = surface.createCanvas;\n"
            "surface.createCanvas = function(...args) {\n"
            "  const canvas = create(...args);\n"
            "  canvas.style ||= {};\n"
            "  return canvas;\n"
            "};\n"
            "const outputs = new WeakMap();\n"
            "globalThis.jezzballCursorOutput = canvas => outputs.get(canvas) || null;\n"
            "const host = require("+json.dumps(str(canvas.with_name('host-imports.js')))+");\n"
            "const make = host.createHostImports;\n"
            "host.createHostImports = function(ctx, ...rest) {\n"
            "  const imports = make(ctx, ...rest);\n"
            "  for (const name of ['set_cursor', 'set_cursor_image']) {\n"
            "    const original = imports.host[name];\n"
            "    imports.host[name] = function(...args) {\n"
            "      const result = original(...args);\n"
            "      const canvas = ctx.renderer?.canvas;\n"
            "      if (canvas) outputs.set(canvas, {source:'host.'+name, at:Date.now()/1000, css:canvas.style?.cursor || 'default'});\n"
            "      return result;\n"
            "    };\n"
            "  }\n"
            "  return imports;\n"
            "};\n")
    with pathlib.Path(path).open('x') as f: f.write(code)
    return hashlib.sha256(code.encode()).hexdigest()


def _capture(name):
    """Raw board and separate exact public CSS metadata; never pointer pixels."""
    path = c.capture(name)
    rr = c.read(name+'.json')
    c.opened()
    at = time.time()
    css = c.call(dict(action='eval', code=CURSOR_DISPLAY))
    native_output = c.call(dict(action='eval', code=CURSOR_NATIVE_OUTPUT))
    after = c.call(dict(action='snapshot'))
    c.opened()
    assert isinstance(css, str)
    assert all(after[k] == rr['snapshot'][k] for k in ('mainHwnd', 'screen')), 'cursor window changed'
    c.save(name+'-cursor.json', dict(at=at, completedAt=time.time(), scene=name,
           sceneSHA256=rr['pngSHA256'], target=rr['target'],
           window={k:after[k] for k in ('mainHwnd', 'screen')},
           source='current-public-canvas-style-cursor', evidenceType='native-system-cursor-metadata',
           css=css, nativeOutput=native_output, pointerImageCaptured=False))
    return path


def orientation_review(scene, rr, r, age):
    """Admit only the personally reviewed, qualified current native output."""
    assert r.get('orientationSource') == 'native-system-cursor-metadata', 'qualified system cursor required'
    assert r.get('nativeCursorMetadataReviewed') is True
    cursor_path = c.R/(scene+'-cursor.json')
    assert r.get('cursorMetadataSHA256') == hashlib.sha256(cursor_path.read_bytes()).hexdigest(), 'cursor metadata changed'
    cursor = c.read(cursor_path.name)
    assert cursor['source'] == 'current-public-canvas-style-cursor'
    assert cursor['evidenceType'] == 'native-system-cursor-metadata' and cursor['pointerImageCaptured'] is False
    assert cursor['target'] == rr['target'] and cursor['sceneSHA256'] == rr['pngSHA256']
    assert cursor['window'] == {k:rr['snapshot'][k] for k in ('mainHwnd', 'screen')}
    assert rr['at'] <= cursor['at'] <= cursor['completedAt'] <= time.time()
    assert time.time()-cursor['at'] < age, 'cursor metadata expired'
    assert cursor['css'] in ('ew-resize', 'ns-resize'), 'missing/default/unknown/custom cursor refused'
    output = cursor['nativeOutput']
    assert isinstance(output, dict) and output['source'] == 'host.set_cursor', 'actual native system output required'
    assert output['css'] == cursor['css'], 'CSS differs from actual native output'
    assert 0 <= time.time()-output['at'] < age, 'native output expired'
    assert r.get('reviewedCursorCSS') == cursor['css'], 'personal CSS review mismatch'
    qpath = c.R/'cursor-qualification.json'
    assert r.get('qualificationSHA256') == hashlib.sha256(qpath.read_bytes()).hexdigest()
    q = c.read(qpath.name)
    assert q['interpretationFrozen'] is True and q['personallyReviewed'] is True
    assert q['mapping'] == {'ew-resize':'horizontal', 'ns-resize':'vertical'}
    for key in ('nativeHelp', 'originalStaticRoute', 'actualNativeFarAPI', 'actualNativeCLIControls', 'lockedBuild', 'publication'):
        evidence = q[key]
        assert evidence['reviewed'] is True
        path = pathlib.Path(evidence['path'])
        assert path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == evidence['sha256'], 'qualification evidence drift'
    assert r['visibleOrientation'] == q['mapping'][cursor['css']], 'orientation differs from reviewed public output'
    # Only the actual post-UP capture from a fresh finite hover can authorize
    # a wall. The preceding complete scene and personal hover review remain linked.
    hover = c.read(scene+'-intent.json')
    assert hover.get('mode') == 'hover' and hover['command'].startswith('mousemove:')
    assert list(map(int, hover['command'].split(':')[1:])) == r['pixelGeometry']['chosenCenter'], 'hover must review the chosen wall point'
    assert hover['target'] == rr['target']
    assert consumed(c.read(scene+'-receipt.json'), hover['owner'], hover['nonce'])
    assert output['at'] >= c.read(scene+'-receipt.json')['consumedAt']/1000, 'hover requires current native SetCursor output'
    wait = c.read(scene+'-release-wait.json')
    assert wait['actualWait'] is True and wait['stdoutEOF'] is True and wait['stderrEOF'] is True and wait['exit'] == 0
    assert c.read(scene+'-completed.json')['actualBoardChangeClaim'] is False
    up = c.read(scene+'-up.json')
    assert up['state'] == 'ACK' and up['reason'] == 'consumed pulse' and up['at'] <= rr['at']
    assert r.get('finiteHoverReviewed') is True


def capture(name):
    try: return _capture(name)
    except BaseException as e:
        c.fail(e, name)
        raise


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
    assert r.get('sceneType') in ('bootstrap', 'board')
    c.bind()
    if c.read('lease-snapshot.json') != {k: rr['snapshot'][k] for k in ('mainHwnd', 'screen')}:
        c.fail('reviewed window changed during permanent binding', 'bind')
        raise AssertionError('reviewed window changed during permanent binding; no rebind')
    c.save('binding-scene.json', dict(scene=scene, sceneType=r['sceneType'], target=rr['target'], at=time.time()))


def board_review(r):
    assert r.get('sceneType') == 'board' and r.get('defaultGame') is True
    assert r.get('completeBoard', '').strip() and r.get('rulesEvidence', '').strip()
    assert r.get('visibleOrientation') in ('horizontal', 'vertical')
    assert r.get('orientationEvidence', '').strip()
    for key in ('areaPercent', 'score', 'lives', 'persistentWalls'):
        assert type(r.get(key)) is int and r[key] >= 0, 'visible native counters required'
    assert r['areaPercent'] <= 100
    assert r.get('partitionEvidence', '').strip()


def admit(scene):
    c.lease(); rr, r = reviewed(scene, 5)
    assert not (c.R / 'quit-phase.json').exists()
    board_review(r)
    orientation_review(scene, rr, r, 5)
    assert r.get('activeBoard') is True and r.get('level') == 1
    c.save('board-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], at=time.time()))


def progress(scene):
    c.lease(); rr, r = reviewed(scene, 5)
    board_review(r)
    assert r.get('resultKind') in ('completed-wall', 'collision', 'growing', 'unchanged')
    if r['resultKind'] == 'completed-wall':
        assert r.get('persistentPartition') is True
        assert r.get('completionEvidence', '').strip(), 'animation is not completion'
    if r['resultKind'] == 'collision':
        assert r.get('collisionEvidence', '').strip()
    c.save(scene+'-progress-review.json', dict(scene=scene, review=r, pngSHA256=rr['pngSHA256'], at=time.time()))


def consequence(action_name, scene):
    c.lease(); rr, r = reviewed(scene, 30)
    intent = c.read(action_name+'-intent.json')
    assert intent['mode'] == 'place' and intent['target'] == rr['target']
    assert c.read(action_name+'-up.json')['state'] == 'ACK'
    before = c.read(intent['scene']+'-review.json')
    assert before['pngSHA256'] == intent['pngSHA256'] == hashlib.sha256((c.R/(intent['scene']+'.png')).read_bytes()).hexdigest()
    assert r.get('wallAction') == action_name and r.get('beforeSceneSHA256') == intent['pngSHA256']
    assert r.get('resultKind') in ('completed-wall', 'collision', 'growing', 'unchanged')
    assert r.get('consequenceEvidence', '').strip() and r.get('nativeOutcome', '').strip()
    for key in ('areaPercent', 'score', 'level', 'persistentWalls', 'lives'):
        assert type(r.get(key)) is int and r[key] >= 0
    if r['resultKind'] == 'completed-wall':
        assert r.get('persistentPartition') is True and r.get('completionEvidence', '').strip()
        stable = c.read(r['persistenceScene']+'.json')
        assert stable['target'] == rr['target'] and c.read(action_name+'-up.json')['at'] <= stable['at'] < rr['at']
        assert stable['pngSHA256'] == r['persistenceSceneSHA256'] == hashlib.sha256((c.R/(r['persistenceScene']+'.png')).read_bytes()).hexdigest()
        assert r.get('bothPersistentScenesReviewed') is True
        assert r['persistentWalls'] > before['persistentWalls']
        assert r['areaPercent'] > before['areaPercent'] and r['score'] > before['score']
    c.save(action_name+'-consequence.json', dict(personallyReviewed=True, beforeScene=intent['scene'], afterScene=scene, beforeSceneSHA256=intent['pngSHA256'],
           afterSceneSHA256=rr['pngSHA256'], before=before, after=r, at=time.time()))


def outcome(scene):
    c.lease(); rr, r = reviewed(scene, 30)
    assert r.get('naturalOutcome') in ('first-level-complete', 'loss')
    assert r.get('visibleNativeOutcome') is True and r.get('outcomeEvidence', '').strip()
    if r['naturalOutcome'] == 'first-level-complete':
        assert r.get('nativeCompletionDialog') is True and r.get('modalPreserved') is True
    c.save('natural-outcome.json', dict(scene=scene, outcome=r['naturalOutcome'], evidence=r['outcomeEvidence'], pngSHA256=rr['pngSHA256'], at=time.time()))


def policy(command, scene, mode, route=None):
    assert mode in ('place', 'hover', 'menu', 'quit'), 'no New/start/restart/second game'
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), reserveSeconds=180, irreversible=True))
    rr, r = reviewed(scene, 5 if mode in ('place', 'hover') else 30)
    assert r['mode'] == mode
    edge = 'mousemove' if mode == 'hover' else 'mousedown'
    assert re.fullmatch(edge+r':[0-9]{1,4}:[0-9]{1,4}', command), 'one supported pointer event; LEFT click only, no reset or action list'
    if mode != 'quit':
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert not (c.R / 'natural-outcome.json').exists(), 'natural outcome ends gameplay'
        assert time.time() + 3 < end, 'gameplay cutoff'
    if mode in ('place',):
        assert (c.R / 'board-admitted.json').exists(), 'personally reviewed complete native board required'
        board_review(r)
        orientation_review(scene, rr, r, 5)
        assert r.get('activeBoard') is True and r.get('level') == 1
        assert r.get('originalRulesUnchanged') is True and r.get('noWallGrowing') is True
        assert r.get('placementReason', '').strip() and r.get('targetKind') == 'active-board'
        assert r.get('personallyChosenOrientation') == r['visibleOrientation'], 'no untested orientation event'
        assert r.get('priorResultReviewed') is True, 'personally verify last wall result before another'
        previous = sorted(c.R.glob('*-intent.json'))
        for intent in previous:
            value = c.read(intent.name)
            if value.get('mode') == 'place':
                result = c.read(value['name']+'-consequence.json')
                assert result['beforeSceneSHA256'] == value['pngSHA256'] and result['personallyReviewed'] is True
        assert r.get('modalVisible') is False, 'never click through a native completion modal'
    elif mode == 'hover':
        assert r.get('sceneType') == 'board' and r.get('defaultGame') is True
        assert r.get('completeBoard', '').strip() and r.get('rulesEvidence', '').strip()
        assert r.get('level') == 1 and r.get('modalVisible') is False
        assert r.get('targetKind') == 'active-board' and r.get('hoverReason', '').strip()
    elif mode == 'menu':
        assert route in ('open-help', 'how-to-play', 'dismiss-help', 'dismiss-menu')
        assert r.get('menuRoute') == route and r.get('visibleLabel', '').strip()
        assert r.get('targetKind') == 'menu', 'no New/Backup/Options/record controls'
    else:
        assert route in ('open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit', 'dismiss-loss')
        assert r.get('quitRoute') == route and r.get('visibleQuitTarget') is True
        if route == 'confirm-exit': assert r.get('nativeExitConfirmation') is True
        if route == 'dismiss-loss':
            assert r.get('nativeLossDialog') is True
            assert c.read('natural-outcome.json')['outcome'] == 'loss'
        if route == 'select-exit': assert r.get('visibleLabel', '').replace('&', '').strip().lower() in ('exit', 'quit')
    g = r['pixelGeometry']
    assert g['source'] == 'current-full-scene' and g['target'] == rr['target']
    point = [int(v) for v in command.split(':')[1:]]
    assert point == g['chosenCenter'], 'pointer differs from reviewed pixels'
    assert 0 <= point[0] < rr['snapshot']['screen']['w'] and 0 <= point[1] < rr['snapshot']['screen']['h']
    assert not list(c.R.glob(scene + '-used-by-*')), 'fresh scene required; no replay'
    return rr, r, min(rr['at'] + (5 if mode in ('place', 'hover') else 30), c.read('launch.json')['deadline'] if mode == 'quit' else end)

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
    # A 40 ms pulse cannot satisfy the unchanged >40 ms ACK headroom check.
    # Refuse that impossible plan before reservation, prearm or native input.
    assert type(milliseconds) is int and 80 <= milliseconds <= 1500
    for suffix in ('-intent.json', '-up.json', '-receipt.json', '-completed.json', '.png', '.json'):
        assert not (c.R / (name+suffix)).exists(), 'name already reserved'
    # A local policy refusal before reservation/transport has no input effect.
    rr, r, sceneEnd = policy(command, scene, mode, route)
    assert time.time()+milliseconds/1000+.7 < sceneEnd, 'insufficient fresh scene window; not sent'
    child = None; receipt = None; error = None; armed = None
    try:
        owner, before = c.lease()
        now = time.time()
        p = dict(name=name, mode=mode, command=command, scene=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], owner=owner,
                 nonce=str(uuid.uuid4()), noReplay=True, milliseconds=milliseconds, createdAt=now,
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
        c.save(name+'-completed.json', dict(at=time.time(), actualBoardChangeClaim=False, nativeQuitClaim=False, before=before))
        return 'Final choice; await actual native wait' if p['final'] else capture(name)
    except BaseException as e:
        c.fail(e, name); raise


if __name__ == '__main__':
    if sys.argv[1] == 'prepare-cursor': print(prepare_cursor(sys.argv[2]))
    elif sys.argv[1] == 'release': release(sys.argv[2])
    elif sys.argv[1] == 'capture': print(capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit': admit(sys.argv[2])
    elif sys.argv[1] == 'outcome': outcome(sys.argv[2])
    elif sys.argv[1] == 'progress': progress(sys.argv[2])
    elif sys.argv[1] == 'consequence': consequence(sys.argv[2], sys.argv[3])
    else:
        _, mode, name, command, scene, ms, *route = sys.argv
        print(action(name, command, scene, mode, int(ms), route[0] if route else None))




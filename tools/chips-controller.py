"""One personally chosen action in the original default Chips lesson.

Self-contained finite derivative of released Barrage/Tutstomb transport.
No board reader, action list, solver, replay, rebind or private game state.
Transport receipts never establish collection, opened doors or completion.
CHIPS_CONTROL_OUT and CHIPS_CONTROL_URL select the bounded run.
"""
import pathlib, json, time, sys, urllib.request, subprocess, os, uuid, hashlib
import select, re, urllib.parse

class Transport:
    R = pathlib.Path(os.environ.get('CHIPS_CONTROL_OUT', pathlib.Path(__file__).resolve().parent))
    URL = os.environ.get('CHIPS_CONTROL_URL', 'http://127.0.0.1:8519/ctl')
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


def cutoff():
    launch = c.read('launch.json')
    assert launch['deadline'] - launch['at'] > 180
    return launch['deadline'] - 180


def reviewed(scene, age):
    assert scene.replace('-', '').isalnum()
    rr = c.read(scene + '.json'); r = c.read(scene + '-review.json')
    assert r.get('submittedScene') is True and r.get('rawCompleteScene') is True
    assert r.get('observation', '').strip(), 'personal complete scene review required'
    assert all(0 <= time.time() - v['at'] < age for v in (rr, r)), 'scene review expired'
    assert r['pngSHA256'] == rr['pngSHA256'] == hashlib.sha256((c.R / (scene + '.png')).read_bytes()).hexdigest()
    assert rr['target'] == c.read('native-pid.json'), 'native identity changed'
    assert rr['snapshot']['mainHwnd'] != '0x0' and rr['snapshot']['eip'] != '0x0'
    return rr, r


def bind(scene):
    cutoff(); rr, r = reviewed(scene, 30)
    assert r.get('sceneType') in ('lesson-overlay', 'board')
    assert r.get('registeredOriginal') is True and r.get('defaultLesson1') is True
    assert r.get('completeBootstrapReviewed') is True
    c.bind()
    if c.read('lease-snapshot.json') != {k: rr['snapshot'][k] for k in ('mainHwnd', 'screen')}:
        c.fail('binding scene differs from permanent native window', 'bind')
        raise AssertionError('binding scene differs from permanent native window')
    c.save('binding-scene.json', dict(scene=scene, target=rr['target'], at=time.time()))


def admit(scene):
    c.lease(); rr, r = reviewed(scene, 5)
    assert not (c.R / 'quit-phase.json').exists()
    assert r.get('sceneType') == 'board' and r.get('defaultLesson1') is True
    assert r.get('completeBoard') is True and r.get('visibleBoardDescription', '').strip()
    assert r.get('rulesEvidence', '').strip()
    c.save('board-admitted.json', dict(scene=scene, pngSHA256=rr['pngSHA256'], at=time.time()))


def outcome(scene):
    c.lease(); rr, r = reviewed(scene, 30)
    assert r.get('nativeLessonExit') is True and r.get('completionEvidence', '').strip()
    c.save('natural-outcome.json', dict(scene=scene, evidence=r['completionEvidence'], pngSHA256=rr['pngSHA256'], at=time.time()))


def consequence(actionName, scene):
    """Record a personally reviewed causal change, never infer one from ACK."""
    c.lease(); rr, r = reviewed(scene, 5)
    intent = c.read(actionName + '-intent.json')
    assert intent['mode'] == 'move' and intent['target'] == rr['target']
    assert c.read(actionName + '-completed.json')['actualCollectionClaim'] is False
    assert rr['at'] > c.read(actionName + '-up.json')['at']
    assert r.get('completeBoard') is True and r.get('defaultLesson1') is True
    assert r.get('visibleConsequence') in ('chip-counter', 'key-inventory', 'door-opened', 'socket-opened', 'lesson-exit')
    assert r.get('consequenceEvidence', '').strip()
    before = c.read(intent['scene'] + '-review.json')
    assert r.get('beforeEvidence') == before.get('visibleBoardDescription')
    assert r.get('afterEvidence', '').strip()
    c.save(actionName + '-consequence.json', dict(scene=scene, kind=r['visibleConsequence'],
        evidence=r['consequenceEvidence'], before=r['beforeEvidence'], after=r['afterEvidence'],
        pngSHA256=rr['pngSHA256'], at=time.time(), nativeCompletionClaim=False))


def policy(command, scene, mode, route=None):
    assert mode in ('move', 'menu', 'quit')
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), reserveSeconds=180, irreversible=True))
    age = 5 if mode == 'move' else 30
    rr, r = reviewed(scene, age)
    assert r['mode'] == mode
    assert re.fullmatch(r'(?:keydown:(?:13|37|38|39|40)|mousedown:[0-9]{1,4}:[0-9]{1,4})', command), 'one finite physical press only'
    if mode != 'quit':
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert not (c.R / 'natural-outcome.json').exists(), 'lesson exit ends gameplay'
        assert time.time() + 3 < end, 'gameplay cutoff'
    if mode == 'move':
        assert (c.R / 'board-admitted.json').exists(), 'personally reviewed actual lesson board required'
        assert r.get('sceneType') == 'board' and r.get('defaultLesson1') is True
        assert r.get('completeBoard') is True and r.get('settledPaint') is True
        assert r.get('rulesEvidence', '').strip() and r.get('legalReason', '').strip()
        assert r.get('visibleBoardDescription', '').strip() and r.get('chosenDirection') in ('left', 'up', 'right', 'down')
        assert r.get('routeFromCurrentPixels') is True
        assert command == {'left':'keydown:37', 'up':'keydown:38', 'right':'keydown:39', 'down':'keydown:40'}[r['chosenDirection']], 'direction differs from reviewed choice'
        assert r.get('inputRoute') == 'native-keyboard', 'no unreviewed steering click'
    elif mode == 'menu':
        assert route in ('dismiss-lesson', 'open-help', 'how-to-play', 'dismiss-help', 'dismiss-menu')
        assert r.get('menuRoute') == route and r.get('visibleLabel', '').strip()
        if route == 'dismiss-lesson':
            assert command == 'keydown:13' and r.get('sceneType') == 'lesson-overlay'
            assert r.get('defaultLesson1') is True
            assert not (c.R / 'lesson-dismiss-intent.json').exists(), 'lesson overlay may be dismissed only once'
        else:
            assert command.startswith('mousedown:'), 'menu choice from current pixels required'
    else:
        assert route in ('open-game-menu', 'select-exit', 'confirm-exit', 'dismiss-outcome')
        assert command.startswith('mousedown:')
        assert r.get('quitRoute') == route and r.get('visibleQuitTarget') is True
        if route == 'confirm-exit': assert r.get('nativeExitConfirmation') is True
        if route == 'dismiss-outcome': assert r.get('nativeOutcomeDialog') is True
        if route == 'select-exit': assert r.get('visibleLabel', '').replace('&', '').strip().lower() in ('exit', 'quit')
    if command.startswith('keydown:'):
        assert r.get('keyboardConsumer') == rr['snapshot']['mainHwnd'], 'reviewed native main keyboard consumer required'
        assert rr['snapshot']['focus'] in ('0x0', rr['snapshot']['mainHwnd']), 'board child focus is not a verified keyboard route'
        assert r.get('keyboardFocus') == rr['snapshot']['focus']
    else:
        g = r['pixelGeometry']
        assert g['source'] == 'current-full-scene' and g['target'] == rr['target']
        point = [int(v) for v in command.split(':')[1:]]
        assert point == g['chosenCenter'], 'pointer differs from reviewed pixels'
        assert 0 <= point[0] < rr['snapshot']['screen']['w'] and 0 <= point[1] < rr['snapshot']['screen']['h']
    assert not list(c.R.glob(scene + '-used-by-*')), 'fresh scene required; no replay'
    return rr, r, min(rr['at'] + age, c.read('launch.json')['deadline'] if mode == 'quit' else end)



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
        if command.startswith('keydown:'):
            assert before['focus'] == rr['snapshot']['focus'], 'keyboard focus changed since review'
        now = time.time()
        p = dict(name=name, command=command, scene=scene, pngSHA256=rr['pngSHA256'], target=rr['target'], owner=owner,
                 nonce=str(uuid.uuid4()), noReplay=True, physicalGesture='one DOWN then independent UP', milliseconds=milliseconds, createdAt=now,
                 gestureDeadline=now+1.500, fallbackAt=now+1.750,
                 mode=mode, final=mode=='quit' and route in ('select-exit', 'confirm-exit'), sceneDeadline=sceneEnd)
        if route == 'dismiss-lesson': c.save('lesson-dismiss-intent.json', dict(name=name, scene=scene))
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
        c.save(name+'-completed.json', dict(at=time.time(), actualCollectionClaim=False, nativeQuitClaim=False, before=before))
        return 'Final choice; await actual native wait' if p['final'] else c.capture(name)
    except BaseException as e:
        c.fail(e, name); raise


if __name__ == '__main__':
    if sys.argv[1] == 'release': release(sys.argv[2])
    elif sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'admit': admit(sys.argv[2])
    elif sys.argv[1] == 'outcome': outcome(sys.argv[2])
    elif sys.argv[1] == 'consequence': consequence(sys.argv[2], sys.argv[3])
    else:
        _, mode, name, command, scene, ms, *route = sys.argv
        print(action(name, command, scene, mode, int(ms), route[0] if route else None))


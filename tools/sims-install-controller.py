"""Finite original Sims installer/game UI transport, derived from released TriPeaks.

No original executable changes, serial guesses, game-state reader, replay or rebind.
SIMS_CONTROL_OUT and SIMS_CONTROL_URL identify one supervised native consumer.
Personal full-scene reviews establish progress; ACK establishes only consumption.
"""
import pathlib, json, time, sys, urllib.request, subprocess, os, uuid, hashlib
import select, re, urllib.parse

class Transport:
    R = pathlib.Path(os.environ.get('SIMS_CONTROL_OUT', pathlib.Path(__file__).resolve().parent))
    URL = os.environ.get('SIMS_CONTROL_URL', 'http://127.0.0.1:8667/ctl')
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
    def bind(reviewedScene=None):
        try:
            c.opened()
            # Reserve before HTTP evaluation: c.save(name, c.call(bind)) would rebind
            # first and only then notice that the permanent owner file exists.
            assert not (c.R/'input-owner.json').exists(),'permanent owner already bound; no rebind'
            c.save('bind-intent.json',dict(at=time.time(),permanent=True))
            command = {'action':'guarded-bind'}
            if reviewedScene is not None: command['reviewedScene'] = reviewedScene
            c.save('input-owner.json',c.call(command))
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
            for intent in c.R.glob('*-intent.json'):
                if intent.name in ('bind-intent.json', 'last-intent.json'): continue
                stem = intent.name[:-len('-intent.json')]
                assert (c.R/(stem+'-up.json')).exists() and (c.R/(stem+'-completed.json')).exists(), 'unresolved physical gesture; no capture'
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
    assert scene.replace('-', '').isalnum(), 'local scene name only'
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
    assert r.get('sceneType') in ('installer', 'startup'), 'complete original bootstrap required'
    assert r.get('exactReleaseReviewed') is True and r.get('completeBootstrapReviewed') is True
    s = rr['snapshot']
    mains = [w for w in s.get('windows', []) if w['hwnd'] == s['mainHwnd']]
    assert len(mains) == 1
    main = mains[0]
    assert main.get('visible') is True and not main.get('isChild') and main.get('title') == r['nativeTitle']
    expected = None
    if not r['nativeTitle'].strip():
        modal = r['reviewedOwnedModal']
        assert modal in s['windows'] and modal['hwnd'] != main['hwnd']
        assert modal.get('visible') is True and not modal.get('isChild') and modal.get('title', '').strip()
        assert main.get('processId') and main.get('generation') not in (None, 0, '0')
        assert modal.get('generation') not in (None, 0, '0') and main.get('live') is True and modal.get('live') is True
        assert modal.get('processId') == main['processId'] and modal.get('owner') == main['hwnd']
        assert s.get('modalHwnd') == modal['hwnd']
        assert s.get('focusTopLevel') == modal['hwnd'] and s.get('capture') == '0x0' and s.get('physicalUp') is True
        focus = s['focusWindow']
        assert focus['hwnd'] == s['focus'] and focus['live'] is True
        assert focus['generation'] not in (None, 0, '0') and focus['processId'] == main['processId']
        assert s['nativeProcess']['pid'] == rr['target']['pid'] and s['nativeProcess']['executable']
        expected = dict(main=main, modal=modal, nativeProcess=s['nativeProcess'], screen=s['screen'],
                        focus=s['focus'], focusWindow=focus, pngSHA256=rr['pngSHA256'])
    c.bind(reviewedScene=expected) if expected else c.bind()
    assert c.read('lease-snapshot.json') == {k: rr['snapshot'][k] for k in ('mainHwnd', 'screen')}
    c.save('binding-scene.json', dict(scene=scene, nativeTitle=r['nativeTitle'],
           target=rr['target'], mainHwnd=rr['snapshot']['mainHwnd'], at=time.time()))


def checkpoint(kind, scene):
    """Separate personal observations; transport receipts establish no game state."""
    assert kind in ('loading', 'household', 'selection', 'result')
    c.lease(); rr, r = reviewed(scene, 5 if kind != 'loading' else 30)
    assert r.get('sceneType') == kind and r.get('checkpointEvidence', '').strip()
    prior = {'household': 'loading', 'selection': 'household', 'result': 'selection'}.get(kind)
    if prior:
        assert (c.R / (prior + '-reviewed.json')).exists(), 'prior scene separately reviewed'
        assert rr['at'] > c.read(prior + '-reviewed.json')['at'], 'distinct later scene required'
    if kind == 'household':
        assert r.get('liveHousehold') is True and r.get('visibleHouseholdName', '').strip()
    if kind == 'selection':
        assert r.get('visibleSelectedSim', '').strip() and r.get('selectionVisible') is True
    if kind == 'result':
        intent = c.read('chosen-action.json')
        assert rr['at'] > c.read(intent['name'] + '-up.json')['at'], 'post-UP result required'
        assert r.get('visibleActionResult', '').strip()
        assert r.get('actionEvidenceSeparateFromACK') is True
    c.save(kind + '-reviewed.json', dict(scene=scene, at=rr['at'], review=r, target=rr['target']))


def policy(command, scene, mode, route=None):
    assert mode in ('install', 'menu', 'household', 'select', 'action', 'hover', 'quit')
    end = cutoff()
    if mode == 'quit' or time.time() >= end:
        if not (c.R / 'quit-phase.json').exists():
            c.save('quit-phase.json', dict(at=time.time(), reserveSeconds=180, irreversible=True))
    age = 5 if mode in ('household', 'select', 'action', 'hover') else 30
    rr, r = reviewed(scene, age)
    assert r['mode'] == mode
    verb = 'mousemove' if mode == 'hover' else 'mousedown'
    assert re.fullmatch(verb + r':[0-9]{1,4}:[0-9]{1,4}', command), 'one finite pointer action only'
    assert r.get('visibleLabel', '').strip(), 'personally read visible target required'
    assert r.get('ordinaryNativeUI') is True, 'ordinary original UI required'
    if mode != 'quit':
        assert not (c.R / 'quit-phase.json').exists(), 'irreversible Quit phase'
        assert time.time() + 3 < end, 'gameplay cutoff'
    if mode == 'install':
        assert r.get('sceneType') == 'installer'
        assert r.get('installRoute') in ('next', 'accept-license', 'default-path', 'install', 'disc-prompt', 'finish')
        assert route == r['installRoute'], 'reviewed installer route required'
        assert r.get('serialRequired') is False, 'serial boundary; no guessed key or bypass'
        assert r.get('mediaCheckBypassed') is False
    elif mode == 'menu':
        assert r.get('sceneType') in ('startup', 'neighborhood', 'menu')
        assert route in ('dismiss-intro', 'start', 'choose-neighborhood', 'dismiss-menu')
        assert r.get('menuRoute') == route
    elif mode == 'household':
        assert (c.R / 'loading-reviewed.json').exists(), 'loading separately reviewed'
        assert r.get('sceneType') == 'neighborhood' and r.get('chosenHousehold', '').strip()
    elif mode == 'select':
        assert (c.R / 'household-reviewed.json').exists(), 'household separately reviewed'
        assert r.get('sceneType') == 'household' and r.get('chosenSim', '').strip()
    elif mode in ('action', 'hover'):
        assert (c.R / 'selection-reviewed.json').exists(), 'selection separately reviewed'
        assert r.get('sceneType') in ('household', 'action-menu')
        assert r.get('personallyChosenAction', '').strip()
        assert r.get('visibleSelectedSim') == c.read('selection-reviewed.json')['review']['visibleSelectedSim']
        assert r.get('liveHousehold') is True
        assert not (c.R / 'chosen-action.json').exists(), 'one visible action only'
        if mode == 'hover': assert r.get('hoverOnly') is True
    else:
        assert route in ('open-game-menu', 'select-exit', 'titlebar-close', 'confirm-exit', 'cancel-installer')
        assert r.get('quitRoute') == route and r.get('visibleQuitTarget') is True
        if route == 'confirm-exit': assert r.get('nativeExitConfirmation') is True
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
    # A 40 ms pulse cannot satisfy the strict >40 ms scheduling margin below.
    # Reject it locally rather than dispatching an inevitably terminal gesture.
    assert type(milliseconds) is int and 80 <= milliseconds <= 1400
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
                 final=mode=='quit' and route in ('select-exit', 'titlebar-close', 'confirm-exit', 'cancel-installer'), sceneDeadline=sceneEnd)
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
        c.save(name+'-completed.json', dict(at=time.time(), actualGameplayClaim=False, nativeQuitClaim=False, before=before))
        if mode == 'action': c.save('chosen-action.json', dict(name=name, scene=scene, at=time.time()))
        return 'Final choice; await actual native wait' if p['final'] else c.capture(name)
    except BaseException as e:
        c.fail(e, name); raise


if __name__ == '__main__':
    if sys.argv[1] == 'release': release(sys.argv[2])
    elif sys.argv[1] == 'capture': print(c.capture(sys.argv[2]))
    elif sys.argv[1] == 'bind': bind(sys.argv[2])
    elif sys.argv[1] == 'checkpoint': checkpoint(sys.argv[2], sys.argv[3])
    else:
        _, mode, name, command, scene, ms, *route = sys.argv
        print(action(name, command, scene, mode, int(ms), route[0] if route else None))


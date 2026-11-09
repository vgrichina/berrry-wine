"""Return Fire box custody. Offline-capable adapter; no browser or box creation.

arm DIR ADAPTER DEADLINE_EPOCH: prearm before allocation, print immutable UUID.
bind DIR UUID BOAT_CREATED_JSON: bind one newly allocated, delegated box.
complete DIR UUID MANIFEST: independently reread local/size/sha256 artifacts.
join DIR UUID: wait for supervisor's actual wait/EOF record (never infer it).
Adapter is the run's remote.py exposing t.access.api/sanitized, as in 1727.
"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import uuid


def read(p):
    return json.loads(p.read_bytes())


def put(p, value):
    # Records are write-once; a partially written JSON is never published.
    temp = p.with_name(p.name + '.' + str(os.getpid()) + '.tmp')
    with temp.open('x') as f:
        json.dump(value, f); f.flush(); os.fsync(f.fileno())
    try:
        os.link(temp, p)
    finally:
        temp.unlink()


def event(r, kind, **extra):
    with (r/'events.jsonl').open('a') as f:
        f.write(json.dumps(dict(kind=kind, at=time.time(), pid=os.getpid(), **extra))+'\n')
        f.flush(); os.fsync(f.fileno())


def proc(pid):
    fields = Path('/proc/'+str(pid)+'/stat').read_text().rsplit(')', 1)[1].split()
    if fields[0] == 'Z':
        raise ProcessLookupError('process is a zombie')
    return dict(pid=pid, startTicks=fields[19], sid=os.getsid(pid),
                boot=Path('/proc/sys/kernel/random/boot_id').read_text().strip())


def config(r, token):
    c = read(r/'deadline.json')
    if c['uuid'] != token:
        raise ValueError('wrong lifecycle UUID')
    ready = read(r/'watchdog-ready.json')
    if ready['sha256'] != hashlib.sha256((r/'deadline.json').read_bytes()).hexdigest():
        raise ValueError('immutable deadline mutation refused')
    return c


def await_file(p, seconds):
    due = time.monotonic()+seconds
    while not p.exists():
        if time.monotonic() >= due:
            raise TimeoutError(str(p))
        time.sleep(.02)
    return read(p)


def arm(r, adapter, deadline):
    r.mkdir(parents=True, exist_ok=True)
    now = time.time()
    if not now < deadline <= now+1500:
        raise ValueError('deadline must be in original <=25 minute window')
    c = dict(uuid=str(uuid.uuid4()), armedAt=now, deadlineEpoch=deadline,
             monotonicDeadline=time.monotonic()+deadline-now,
             adapter=str(Path(adapter).resolve()), shutdownDelegated=True)
    put(r/'deadline.json', c)
    with (r/'supervisor.stdout').open('xb') as out:
        p = subprocess.Popen([sys.executable, '-B', __file__, '_supervise', str(r)],
                             stdin=subprocess.DEVNULL, stdout=out, stderr=out,
                             start_new_session=True, close_fds=True)
    s = await_file(r/'supervisor-ready.json', 5)
    w = await_file(r/'watchdog-ready.json', 5)
    assert s['process']['pid'] == p.pid
    assert s['process']['sid'] != os.getsid(0)
    assert w['process']['sid'] != s['process']['sid']
    return c


def bind(r, token, source):
    c = config(r, token)
    ready = read(r/'watchdog-ready.json')
    if proc(ready['process']['pid']) != ready['process'] or (r/'watchdog-terminal.json').exists():
        raise ValueError('independent delegate no longer armed')
    a = read(Path(source))
    if (a.get('idempotencyKey') != token or a.get('shutdownDelegated') is not True
            or not re.fullmatch(r'bx_[a-z0-9_]+', a['box']['id'])
            or time.time() >= c['deadlineEpoch']):
        raise ValueError('new allocation UUID/delegation/deadline mismatch')
    expiry = a['box'].get('archiveAfter')
    put(r/'allocation.json', dict(uuid=token, boxId=a['box']['id'], archiveAfter=expiry))
    return await_file(r/'bound.json', 5)


def complete(r, token, manifest):
    config(r, token)
    v = read(Path(manifest))
    if v.get('allMatched') is not True or not v.get('artifacts'):
        raise ValueError('nonempty verified artifact manifest required')
    for x in v['artifacts']:
        p = (r/x['local']).resolve()
        if not p.is_relative_to(r) or not p.is_file():
            raise ValueError('artifact outside lifecycle directory')
        b = p.read_bytes()
        if len(b) != x['size'] or hashlib.sha256(b).hexdigest() != x['sha256']:
            raise ValueError('artifact hash/size mismatch')
    put(r/'normal-request.json', dict(uuid=token, verifiedAt=time.time(),
        artifacts=v['artifacts'], independentlyReadAllBytes=True))


def supervise(r):
    token = read(r/'deadline.json')['uuid']
    signals = []
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, lambda n, _: signals.append(n))
    p = subprocess.Popen([sys.executable, '-B', __file__, '_watch', str(r)],
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        start_new_session=True, close_fds=True)
    put(r/'supervisor-ready.json', dict(process=proc(os.getpid()), child=proc(p.pid)))
    # communicate observes both pipe EOFs and waitpid; signals never forward to
    # the independent delegate. SIGKILL cannot write a fictional reap record.
    out, err = p.communicate()
    put(r/'watchdog-reaped.json', dict(uuid=token,
        pid=p.pid, returnCode=p.returncode, actualWait=True, stdoutEOF=True,
        stderrEOF=True, stdout=out.decode(), stderr=err.decode(), at=time.time()))
    put(r/'supervisor-terminal.json', dict(at=time.time(), signals=signals,
        childReaped=True, watchdogTerminal=(r/'watchdog-terminal.json').exists()))


def watch(r):
    raw = (r/'deadline.json').read_bytes(); c = json.loads(raw)
    digest = hashlib.sha256(raw).hexdigest(); token = c['uuid']
    for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
        signal.signal(sig, lambda n, _: event(r, 'delegate-signal-retained', signal=n))
    put(r/'watchdog-ready.json', dict(uuid=token, sha256=digest,
        deadlineEpoch=c['deadlineEpoch'], monotonicDeadline=c['monotonicDeadline'],
        process=proc(os.getpid())))
    a = None; allocation_raw = None; mutation = False; outcome = 'FAILED'
    try:
        while True:
            if (r/'deadline.json').read_bytes() != raw and not mutation:
                mutation = True; event(r, 'immutable-mutation-refused', uuid=token)
            if a is None and (r/'allocation.json').exists():
                allocation_raw = (r/'allocation.json').read_bytes()
                candidate = json.loads(allocation_raw)
                if candidate['uuid'] != token:
                    raise ValueError('allocation UUID mismatch')
                a = candidate
                put(r/'bound.json', dict(**a, deadlineEpoch=c['deadlineEpoch']))
            if a and (r/'allocation.json').read_bytes() != allocation_raw and not mutation:
                mutation = True; event(r, 'immutable-binding-mutation-refused', uuid=token)
            expired = time.time() >= c['deadlineEpoch'] or time.monotonic() >= c['monotonicDeadline']
            request = None
            if (r/'normal-request.json').exists():
                candidate = read(r/'normal-request.json')
                if candidate.get('uuid') == token and candidate.get('independentlyReadAllBytes') is True:
                    request = candidate
                else:
                    event(r, 'normal-request-refused', uuid=token)
            if a and (expired or request):
                # Sole delegate plus durable write-once attempt: no retry after
                # uncertain API failure, and no concurrent expiry/normal POST.
                with (r/'stop.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    put(r/'stop-attempt.json', dict(uuid=token, boxId=a['boxId'],
                        forced=False, reason='deadline' if expired else 'verified completion', at=time.time()))
                    spec = importlib.util.spec_from_file_location('rf_run_remote', c['adapter'])
                    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
                    t = module.t
                    # Existing API transport has bounded HTTP timeouts. This
                    # process never invokes force-stop, resume or delete.
                    result = t.access.api('POST', 'sandboxes/'+a['boxId']+'/stop', {})
                    put(r/'stop-result.json', result)
                    for _ in range(100):
                        state = t.access.sanitized(t.access.api('GET', 'sandboxes/'+a['boxId']))
                        if str(state.get('state')).lower() in ('archived', 'stopped'):
                            put(r/'normal-stop-confirmed.json', dict(uuid=token, box=state, at=time.time()))
                            outcome = 'STOP_CONFIRMED'; return
                        time.sleep(.5)
                    raise RuntimeError('normal stop state unconfirmed')
            if expired and a is None:
                outcome = 'EXPIRED_UNBOUND'; return
            event(r, 'heartbeat', uuid=token, deadlineEpoch=c['deadlineEpoch'], bound=a is not None)
            time.sleep(.05)
    finally:
        put(r/'watchdog-terminal.json', dict(uuid=token, at=time.time(), outcome=outcome,
            deadlineEpoch=c['deadlineEpoch'], mutationRefused=mutation))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('action', choices=['arm','bind','complete','join','status','_supervise','_watch'])
    p.add_argument('directory', type=Path); p.add_argument('args', nargs='*')
    ns = p.parse_args(); r = ns.directory.resolve(); a = ns.args
    if ns.action == 'arm': result = arm(r, a[0], float(a[1]))
    elif ns.action == 'bind': result = bind(r, *a)
    elif ns.action == 'complete': complete(r, *a); result = dict(requested=True)
    elif ns.action == 'join':
        c = config(r, a[0]); result = await_file(r/'supervisor-terminal.json', max(5, c['deadlineEpoch']-time.time()+180))
        assert result['childReaped'] and result['watchdogTerminal']
        assert read(r/'watchdog-reaped.json')['returnCode'] == 0
        assert read(r/'watchdog-terminal.json')['outcome'] == 'STOP_CONFIRMED'
    elif ns.action == 'status':
        ready = read(r/'watchdog-ready.json')
        try: live = proc(ready['process']['pid']) == ready['process']
        except ProcessLookupError: live = False
        except FileNotFoundError: live = False
        result = dict(config=config(r, a[0]), ready=ready, observedAt=time.time(), processMatches=live,
                      terminal=read(r/'watchdog-terminal.json') if (r/'watchdog-terminal.json').exists() else None)
    elif ns.action == '_supervise': supervise(r); return
    else: watch(r); return
    print(json.dumps(result))


if __name__ == '__main__':
    main()

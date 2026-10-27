#!/usr/bin/env python3
"""Independent actual CLI fault challenges. No ACK producer or guest execution.

Late/partial/stale ACKs are explicit negative fault payloads written only after
our synthetic owner process has died or timed out. Historical request12 untouched.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/generally-loading-controller.py'
p = argparse.ArgumentParser()
p.add_argument('--evidence', required=True)
O = pathlib.Path(p.parse_args().evidence)
O.mkdir(parents=True, exist_ok=False)
children, commands, cases = [], [], []


def write(p, v):
    p.write_text(json.dumps(v))


def start(d, name, mailbox, state, timeout=38, deadline=10):
    cmd = [sys.executable, '-B', str(HELPER), '--mailbox', str(mailbox),
           '--state', str(state), '--receipt', str(d / (name + '.receipt')),
           '--total', '1', '--timeout-seconds', str(timeout),
           '--deadline-seconds', str(deadline)]
    with (d / (name + '.stdout')).open('wb') as out, (d / (name + '.stderr')).open('wb') as err:
        child = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=out, stderr=err)
    children.append(child)
    commands.append(dict(argv=cmd, pid=child.pid))
    return child


def reject(d, name, mailbox, state):
    req = mailbox / 'requests'
    before = {p.name: p.read_bytes() for p in req.iterdir()}
    cursor = state.read_bytes()
    journals = {p: p.read_bytes() for p in req.resolve().parent.glob('.generally-loading-*.journal')}
    c = start(d, name, mailbox, state)
    assert c.wait(timeout=3) == 1, name
    assert cursor == state.read_bytes(), (name, 'cursor advance')
    assert before == {p.name: p.read_bytes() for p in req.iterdir()}, (name, 'dispatch')
    assert journals == {p: p.read_bytes() for p in journals}, (name, 'journal reset')
    receipt = json.loads((d / (name + '.receipt')).read_text())
    assert not receipt['ok'] and not receipt['events']
    cases.append(dict(name=name, noDispatch=True, cursorUnchanged=True,
                      journalUnchanged=True, error=receipt['error']))


try:
    # Distinct real dead/timeout owners, with fault ACKs introduced afterward.
    for mode in ('dead-late-exact', 'dead-partial', 'timeout-stale'):
        d = O / mode
        d.mkdir()
        mailbox = d / 'mailbox'
        mailbox.mkdir()
        state = d / 'owner.cursor'
        write(state, dict(next=41, pending=False))
        c = start(d, 'owner', mailbox, state, timeout=.15 if mode.startswith('timeout') else 38)
        end = time.monotonic() + 3
        while not (mailbox / 'requests/0041.json').exists():
            assert c.poll() is None and time.monotonic() < end
            time.sleep(.005)
        if mode.startswith('dead'):
            c.terminate()
        c.wait(timeout=3)
        request = json.loads((mailbox / 'requests/0041.json').read_text())
        reply = dict(request=request, reply=dict(id=41, ok=True,
                     value=dict(batch=0, quit=False, yieldReason=0,
                                frozen=dict(frozen=True, credits=0))))
        if mode == 'dead-partial':
            (mailbox / 'replies/0041.json').write_text('{"request":')
        else:
            if mode == 'timeout-stale':
                reply['reply']['id'] = 40
            write(mailbox / 'replies/0041.json', reply)
        journal = next(mailbox.glob('.generally-loading-*.journal'))
        assert json.loads(journal.read_text())['status'] == ('poisoned' if mode.startswith('timeout') else 'pending')
        alternate = d / 'alternate.cursor'
        write(alternate, dict(next=42, pending=False))
        alias = d / 'root-alias'
        alias.symlink_to(mailbox, target_is_directory=True)
        reject(d, 'root-alias-after-ack', alias, alternate)
        other = d / 'requests-alias-root'
        other.mkdir()
        (other / 'requests').symlink_to(mailbox / 'requests', target_is_directory=True)
        (other / 'replies').symlink_to(mailbox / 'replies', target_is_directory=True)
        reject(d, 'requests-alias-after-ack', other, alternate)
        # Explicit reply filename alias cannot authorize recovery either.
        (mailbox / 'replies/41.json').symlink_to('0041.json')
        reject(d, 'noncanonical-reply-alias', mailbox, alternate)
        reject(d, 'same-uncertain-cursor', mailbox, state)
    # Active ownership can survive a process dying before its first request.
    # Construct an authentic active sidecar with candidate begin(), no dispatch.
    import importlib.util
    spec = importlib.util.spec_from_file_location('candidate', HELPER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    d = O / 'active-no-dispatch'
    d.mkdir()
    m = d / 'mailbox'
    m.mkdir()
    channel = module.Mailbox(m)
    channel.begin(dict(next=51, pending=False))
    channel.close()
    state = d / 'alternate.cursor'
    write(state, dict(next=51, pending=False))
    reject(d, 'active-with-no-requests', m, state)
    # Fresh endpoint inventory must be bounded and must not adopt JSON aliases.
    for mode in ('inventory8193', 'request-alias', 'reply-alias', 'oversize-journal', 'malformed-journal', 'history4097'):
        d = O / mode
        d.mkdir()
        m = d / 'mailbox'
        m.mkdir()
        channel = module.Mailbox(m)
        identity = {name: [path.stat().st_dev, path.stat().st_ino]
                    for name, path in [('requests', channel.requests), ('replies', channel.replies), ('terminalRoot', channel.root)]}
        if mode == 'inventory8193':
            for n in range(8193):
                (channel.requests / str(n)).touch()
        elif mode in ('request-alias', 'reply-alias'):
            target = channel.requests if mode == 'request-alias' else channel.replies
            write(target / '51.json', dict(id=51))
        elif mode == 'oversize-journal':
            channel.journal_path.write_bytes(b'x' * (1048576 + 1))
        elif mode == 'malformed-journal':
            channel.journal_path.write_text('{"status":"clean",')
        else:
            write(channel.journal_path, dict(version=1, identity=identity, status='clean', next=51,
                  history={f'{n:04}.json': {} for n in range(4097)}))
        channel.close()
        state = d / 'alternate.cursor'
        write(state, dict(next=51, pending=False))
        reject(d, mode, m, state)
finally:
    cleanup = []
    for child in children:
        if child.poll() is None:
            child.terminate()
        try:
            child.wait(timeout=2)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=2)
        cleanup.append(dict(pid=child.pid, exit=child.returncode, alive=child.poll() is None))
    write(O / 'cleanup.json', cleanup)
    write(O / 'commands.json', commands)
    write(O / 'cases.json', cases)
assert all(not c['alive'] for c in cleanup)
write(O / 'result.json', dict(pass_=True, cases=len(cases), helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest(),
                            guestInvocations=0, cleanupComplete=True,
                            faultACKs='explicit negative bytes after own synthetic owner death/timeout; no production completion claimed'))
print('PASS independent durable ownership and bounded inventory:', len(cases))

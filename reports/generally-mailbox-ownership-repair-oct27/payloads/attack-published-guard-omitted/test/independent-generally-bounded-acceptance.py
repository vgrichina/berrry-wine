#!/usr/bin/env python3
"""Actual CLI ownership contract. No guest, synthetic ACKs, or candidate edits.

Exit 1 means candidate REJECTED; retain evidence rather than weaken this oracle.
Run through the task's one-permit pool and trusted 128 MiB supervisor.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/generally-loading-controller.py'
PIN = 'b420b867efa99bcbb802a80138eb9c863bc3bb6eaf38acc643f7f4514b610568'


def atomic(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value))
    tmp.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', required=True)
    args = parser.parse_args()
    out = Path(args.evidence)
    out.mkdir(exist_ok=False, parents=True)
    assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == PIN
    mailbox = out / 'mailbox'
    mailbox.mkdir()
    processes = []
    commands = []
    observations = []
    failure = None

    def start(name, state):
        command = [sys.executable, '-B', str(HELPER), '--mailbox', str(mailbox),
                   '--state', str(state), '--receipt', str(out / (name + '.receipt.json')),
                   '--total', '2501', '--timeout-seconds', '38',
                   '--deadline-seconds', '20', '--after',
                   json.dumps([{'action': 'png', 'path': str(out / 'forbidden.png')},
                               {'action': 'input-message', 'hwnd': 1, 'msg': 256,
                                'wParam': 38, 'lParam': 0}])]
        with (out / (name + '.stdout')).open('wb') as stdout, (out / (name + '.stderr')).open('wb') as stderr:
            process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                                       stdout=stdout, stderr=stderr)
        processes.append((name, process))
        commands.append(dict(name=name, argv=command, pid=process.pid))
        return process

    def until(predicate, seconds=3):
        deadline = time.monotonic() + seconds
        while not predicate():
            if time.monotonic() >= deadline:
                raise AssertionError('bounded wait failed before contract observation')
            time.sleep(.005)

    state = out / 'cursor.json'
    alternate = out / 'alternate-cursor.json'
    atomic(state, dict(next=12, pending=False))
    atomic(alternate, dict(next=13, pending=False))
    try:
        first = start('owner', state)
        request12 = mailbox / 'requests/0012.json'
        until(request12.exists)
        before = state.read_bytes()
        assert first.poll() is None
        assert json.loads(before)['pending'] is True
        observations.append(dict(control='live owner has durable pending request12',
                                 request=json.loads(request12.read_text()),
                                 cursor=json.loads(before), pid=first.pid))

        # Guard-present control: same cursor must reject without another request.
        same = start('same-cursor', state)
        same.wait(timeout=3)
        assert same.returncode == 1
        assert sorted(p.name for p in (mailbox / 'requests').iterdir()) == ['0012.json']
        assert state.read_bytes() == before
        observations.append(dict(control='same cursor competing CLI correctly refuses',
                                 exit=same.returncode,
                                 receipt=json.loads((out / 'same-cursor.receipt.json').read_text())))

        # Exact same CLI/mailbox; ONLY cursor pathname/next available ID differs.
        # No ACK has been written or consumed. Owner is still alive and pending.
        second = start('alternate-cursor', alternate)
        request13 = mailbox / 'requests/0013.json'
        until(lambda: request13.exists() or second.poll() is not None)
        dispatched = request13.exists()
        observations.append(dict(challenge='alternate cursor competing CLI',
                                 firstStillAlive=first.poll() is None,
                                 firstCursorUnchanged=state.read_bytes() == before,
                                 secondDispatched=dispatched,
                                 request=json.loads(request13.read_text()) if dispatched else None,
                                 secondCursor=json.loads(alternate.read_text()),
                                 repliesWritten=0))
        assert first.poll() is None and state.read_bytes() == before
        if dispatched:
            failure = 'mailbox ownership violated: second CLI with alternate state dispatched id13 while first owner pending id12'
        else:
            assert second.returncode == 1
    finally:
        cleanup = []
        for name, process in processes:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
            cleanup.append(dict(name=name, pid=process.pid, exit=process.returncode,
                                alive=process.poll() is None))
        (out / 'cleanup.json').write_text(json.dumps(cleanup, indent=2))
        (out / 'commands.json').write_text(json.dumps(commands, indent=2))
        (out / 'observations.json').write_text(json.dumps(observations, indent=2))
    result = dict(candidate='e954f74d815795fbb715f54a312746f47f8e7157',
                  helperSHA256=PIN, accepted=failure is None, error=failure,
                  noACKsFabricated=True, guestInvocations=0,
                  oracle='one live owner per actual mailbox regardless of state pathname',
                  guardPresentControl='same cursor refused; no new mailbox request',
                  omittedGuardControl='alternate cursor bypasses state-only lock; oracle rejects',
                  cleanupComplete=all(not item['alive'] for item in cleanup))
    (out / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
    return 1 if failure else 0


if __name__ == '__main__':
    sys.exit(main())

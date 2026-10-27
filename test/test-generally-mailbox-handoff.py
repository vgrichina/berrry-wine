#!/usr/bin/env python3
"""Focused actual CLI + exact production-boundary fixture, no game/compiler.

Run under the shared one-permit pool and 768 MiB supervisor after Node startup.
Positive ACKs come only from the pinned production fixture. Fault controls
explicitly corrupt those ACK bytes; none assert guest delivery or consumption.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'tools/generally-loading-controller.py'
NODE = '/home/user/.nvm/versions/node/v24.18.1/bin/node'
FIXTURE = ROOT / 'test/fixtures/generally-loading-protocol.cjs'


def atomic(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value))
    tmp.replace(path)


def scenario(out, mode):
    out.mkdir()
    mailbox = out / 'mailbox'
    mailbox.mkdir()
    requests, replies = mailbox / 'requests', mailbox / 'replies'
    requests.mkdir()
    replies.mkdir()
    with (out / 'fixture.stderr').open('wb') as err:
        fixture = subprocess.Popen([NODE, '--max-old-space-size=512', str(FIXTURE),
                                    str(ROOT / 'test/run.js'), 'normal', str(out / 'fixture.jsonl')],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err)
    processes = [fixture]
    stop, errors, commands, wire = threading.Event(), [], [], []

    def forward():
        seen = set()
        try:
            while not stop.is_set():
                for path in sorted(requests.glob('*.json')):
                    if path.name in seen:
                        continue
                    seen.add(path.name)
                    fixture.stdin.write(path.read_bytes() + b'\n')
                    fixture.stdin.flush()
                stop.wait(.001)
        except (OSError, ValueError) as error:
            errors.append(str(error))

    def receive():
        try:
            for line in fixture.stdout:
                ack = json.loads(line[6:])
                request = json.loads((requests / f"{ack['id']:04}.json").read_text())
                wire.append(dict(request=request, originalACK=ack))
                # Faults are explicit corruption of real production responses.
                if request['action'] == 'step':
                    if mode == 'partial':
                        ack['value'].pop('steps')
                    elif mode == 'stale':
                        ack['id'] -= 1
                    elif mode == 'consumed-mutation':
                        prior = replies / '0012.json'
                        prior.write_bytes(prior.read_bytes() + b' ')
                atomic(replies / f"{request['id']:04}.json", dict(request=request, reply=ack))
        except (OSError, ValueError) as error:
            errors.append(str(error))

    threads = [threading.Thread(target=f, daemon=True) for f in (forward, receive)]
    for t in threads:
        t.start()

    def run(name, next_id):
        state = out / (name + '.cursor')
        atomic(state, dict(next=next_id, pending=False))
        command = [sys.executable, '-B', str(HELPER), '--mailbox', str(mailbox),
                   '--state', str(state), '--receipt', str(out / (name + '.receipt')),
                   '--total', '1', '--deadline-seconds', '10']
        with (out / (name + '.stdout')).open('wb') as stdout, (out / (name + '.stderr')).open('wb') as stderr:
            c = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr)
        processes.append(c)
        commands.append(dict(name=name, argv=command, pid=c.pid))
        code = c.wait(timeout=12)
        return code, json.loads((out / (name + '.receipt')).read_text()), state

    try:
        code, receipt, state = run('first', 12)
        journal_path = next(mailbox.glob('.generally-loading-*.journal'))
        journal = json.loads(journal_path.read_text())
        if mode in ('partial', 'stale', 'consumed-mutation'):
            assert code == 1 and receipt['ok'] is False
            assert journal['status'] == 'poisoned'
            before = {p.name: p.read_bytes() for p in requests.iterdir()}
            code, later, state = run('alternate-after-fault', 99)
            assert code == 1 and later['events'] == []
            assert {p.name: p.read_bytes() for p in requests.iterdir()} == before
            assert not any(json.loads(v)['action'] in ('png', 'input-message') for v in before.values())
        else:
            assert code == 0 and receipt['completed'] == 1
            assert journal['status'] == 'clean' and journal['next'] == 15
            before = journal_path.read_bytes()
            # Explicit clean handoff: alternate cursor must supply exact next.
            code, wrong, state = run('wrong-next', 13)
            assert code == 1 and 'exact mailbox next ID' in wrong['error']
            assert journal_path.read_bytes() == before
            assert sorted(p.name for p in requests.iterdir()) == ['0012.json', '0013.json', '0014.json']
            if mode == 'changed-history':
                path = replies / '0012.json'
                path.write_bytes(path.read_bytes() + b' ')
                code, rejected, state = run('changed-ack-handoff', 15)
                assert code == 1 and 'history changed' in rejected['error']
                assert len(list(requests.iterdir())) == 3
                assert journal_path.read_bytes() == before
            elif mode == 'different-terminal-root':
                other = out / 'other-root'
                other.mkdir()
                (other / 'requests').symlink_to(requests, target_is_directory=True)
                (other / 'replies').symlink_to(replies, target_is_directory=True)
                mailbox = other
                code, rejected, state = run('different-terminal-root', 15)
                assert code == 1 and 'mailbox ownership' in rejected['error']
                assert len(list(requests.iterdir())) == 3
                assert journal_path.read_bytes() == before
            elif mode == 'oversized-journal':
                journal_path.write_bytes(b' ' * (1024 * 1024 + 1))
                code, rejected, state = run('oversized-journal', 15)
                assert code == 1 and 'oversized mailbox journal' in rejected['error']
                assert len(list(requests.iterdir())) == 3
            else:
                code, accepted, state = run('clean-alternate', 15)
                assert code == 0 and accepted['batch'] == 2
                journal = json.loads(journal_path.read_text())
                assert journal['status'] == 'clean' and journal['next'] == 18
                assert [int(p.stem) for p in sorted(requests.iterdir())] == list(range(12, 18))
                assert [x['request']['id'] for x in wire] == list(range(12, 18))
                assert all(x['originalACK']['ok'] for x in wire)
                # Same clean cursor restart is also supported, with no IDs reused.
                command = commands[-1]['argv'].copy()
                command[command.index('--receipt')+1] = str(out / 'same-restart.receipt')
                with (out / 'same-restart.stdout').open('wb') as stdout, (out / 'same-restart.stderr').open('wb') as stderr:
                    c = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr)
                processes.append(c)
                commands.append(dict(name='same-clean-cursor', argv=command, pid=c.pid))
                assert c.wait(timeout=12) == 0
                assert [int(p.stem) for p in sorted(requests.iterdir())] == list(range(12, 21))
                assert json.loads(journal_path.read_text())['next'] == 21
    finally:
        stop.set()
        cleanup = []
        for child in processes:
            if child.poll() is None:
                child.terminate()
            try:
                child.wait(timeout=2)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=2)
            cleanup.append(dict(pid=child.pid, exit=child.returncode, alive=child.poll() is None))
        for t in threads:
            t.join(timeout=2)
        (out / 'cleanup.json').write_text(json.dumps(cleanup, indent=2))
        (out / 'commands.json').write_text(json.dumps(commands, indent=2))
        (out / 'bridge-errors.json').write_text(json.dumps(errors, indent=2))
        (out / 'wire.json').write_text(json.dumps(wire, indent=2))
    assert not errors and not any(t.is_alive() for t in threads)
    assert all(not x['alive'] for x in cleanup)
    (out / 'result.json').write_text(json.dumps(dict(pass_=True, mode=mode, cleanupComplete=True,
                                                   guestInvocations=0, helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest()), indent=2))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--evidence', required=True)
    out = Path(p.parse_args().evidence)
    out.mkdir(exist_ok=False, parents=True)
    for mode in ('clean', 'changed-history', 'partial', 'stale', 'consumed-mutation',
                 'different-terminal-root', 'oversized-journal'):
        scenario(out / mode, mode)
    print('PASS: clean exact-ID handoff/restart; changed-history, partial/stale ACK and consumed-mutation rejected')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Exact-production protocol fixture with independent history fault challenges.

Host observations and batch cost are stubs; no guest completion is established.
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
p = argparse.ArgumentParser()
p.add_argument('--evidence', required=True)
O = Path(p.parse_args().evidence)
O.mkdir(parents=True, exist_ok=False)


def write(p, v):
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(v))
    tmp.replace(p)


def scenario(mode):
    d = O / mode
    d.mkdir()
    mailbox = d / 'mailbox'
    mailbox.mkdir()
    requests, replies = mailbox / 'requests', mailbox / 'replies'
    requests.mkdir()
    replies.mkdir()
    children, commands, errors, wire, observations = [], [], [], [], []
    cmd = [NODE, '--max-old-space-size=512', str(ROOT / 'test/fixtures/generally-loading-protocol.cjs'),
           str(ROOT / 'test/run.js'), 'normal', str(d / 'fixture.jsonl')]
    with (d / 'fixture.stderr').open('wb') as err:
        fixture = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=err)
    children.append(fixture)
    commands.append(dict(argv=cmd, pid=fixture.pid))
    stop = threading.Event()

    def forward():
        seen = set()
        try:
            while not stop.is_set():
                for path in sorted(requests.glob('*.json')):
                    if path.name not in seen:
                        # Only canonical dispatch filenames go to fixture.
                        if path.name != f'{int(path.stem):04}.json':
                            continue
                        seen.add(path.name)
                        fixture.stdin.write(path.read_bytes() + b'\n')
                        fixture.stdin.flush()
                stop.wait(.002)
        except (OSError, ValueError) as e:
            errors.append(str(e))

    def receive():
        try:
            for line in fixture.stdout:
                ack = json.loads(line[6:])
                name = f"{ack['id']:04}.json"
                request = json.loads((requests / name).read_text())
                wire.append(dict(request=request, ack=ack))
                if request['action'] == 'step' and mode in ('consumed-reply', 'acknowledged-request'):
                    prior = (replies if mode == 'consumed-reply' else requests) / '0061.json'
                    prior.write_bytes(prior.read_bytes() + b' ')
                write(replies / name, dict(request=request, reply=ack))
        except (OSError, ValueError) as e:
            errors.append(str(e))

    threads = [threading.Thread(target=f, daemon=True) for f in (forward, receive)]
    for t in threads:
        t.start()

    def run(name, state, endpoint=mailbox, rejection=False):
        before = {q.name: q.read_bytes() for q in requests.iterdir()}
        cursor_before = state.read_bytes()
        journal = next(mailbox.glob('.generally-loading-*.journal'), None)
        journal_before = journal.read_bytes() if journal else None
        cmd = [sys.executable, '-B', str(HELPER), '--mailbox', str(endpoint), '--state', str(state),
               '--receipt', str(d / (name + '.receipt')), '--total', '2', '--deadline-seconds', '10']
        with (d / (name + '.stdout')).open('wb') as out, (d / (name + '.stderr')).open('wb') as err:
            c = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=out, stderr=err)
        children.append(c)
        commands.append(dict(argv=cmd, pid=c.pid))
        code = c.wait(timeout=12)
        receipt = json.loads((d / (name + '.receipt')).read_text())
        if rejection:
            assert code == 1 and not receipt['ok'] and receipt['events'] == [], name
            assert state.read_bytes() == cursor_before, name
            assert {q.name: q.read_bytes() for q in requests.iterdir()} == before, name
            assert journal.read_bytes() == journal_before, name
        observations.append(dict(name=name, exit=code, rejectedBeforeDispatch=rejection, error=receipt.get('error')))
        return code, receipt

    try:
        state = d / 'original.cursor'
        write(state, dict(next=61, pending=False))
        code, receipt = run('seed', state)
        journal = next(mailbox.glob('.generally-loading-*.journal'))
        if mode != 'clean':
            assert code == 1 and not receipt['ok']
            assert json.loads(journal.read_text())['status'] == 'poisoned'
            assert sorted(q.name for q in requests.iterdir()) == ['0061.json', '0062.json']
            assert json.loads(state.read_text())['pending'] is True
            alternate = d / 'alternate.cursor'
            write(alternate, dict(next=64, pending=False))
            run('cannot-handoff-after-mutation', alternate, rejection=True)
        else:
            assert code == 0 and receipt['completed'] == 2
            assert json.loads(journal.read_text())['next'] == 64
            alternate = d / 'alternate.cursor'
            write(alternate, dict(next=64, pending=False))
            for directory in (requests, replies):
                path = directory / '0061.json'
                original = path.read_bytes()
                path.write_bytes(original + b' ')
                run('changed-' + directory.name, alternate, rejection=True)
                path.write_bytes(original)
                alias = directory / '61.json'
                alias.symlink_to('0061.json')
                run('filename-alias-' + directory.name, alternate, rejection=True)
                alias.unlink()
            # Exact request/reply directory and terminal identities are all required.
            for endpoint_name in ('different-terminal', 'different-replies'):
                other = d / endpoint_name
                other.mkdir()
                (other / 'requests').symlink_to(requests, target_is_directory=True)
                if endpoint_name == 'different-terminal':
                    (other / 'replies').symlink_to(replies, target_is_directory=True)
                else:
                    (other / 'replies').mkdir()
                run(endpoint_name, alternate, endpoint=other, rejection=True)
            wrong = d / 'wrong.cursor'
            write(wrong, dict(next=63, pending=False))
            run('wrong-next', wrong, rejection=True)
            # Canonical root alias is the SAME terminal endpoint, so clean reuse works.
            root_alias = d / 'root-alias'
            root_alias.symlink_to(mailbox, target_is_directory=True)
            assert run('canonical-root-alternate-clean', alternate, endpoint=root_alias)[0] == 0
            assert run('same-state-clean-restart', alternate)[0] == 0
            assert [row['request']['id'] for row in wire] == list(range(61, 70))
            assert json.loads(journal.read_text())['next'] == 70
            assert json.loads(journal.read_text())['status'] == 'clean'
    finally:
        stop.set()
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
        for t in threads:
            t.join(timeout=2)
        for name, value in [('cleanup', cleanup), ('commands', commands), ('wire', wire), ('observations', observations), ('bridge-errors', errors)]:
            write(d / (name + '.json'), value)
    assert not errors and all(not t.is_alive() for t in threads) and all(not c['alive'] for c in cleanup)
    write(d / 'result.json', dict(pass_=True, mode=mode, guestInvocations=0, cleanupComplete=True))


for mode in ('clean', 'consumed-reply', 'acknowledged-request'):
    scenario(mode)
write(O / 'result.json', dict(pass_=True, modes=3, helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest(), guestInvocations=0))
print('PASS independent history mutation, alias rejection, canonical clean handoff and restart')

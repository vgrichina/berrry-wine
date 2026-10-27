#!/usr/bin/env python3
"""Actual trusted-local CLI mailbox ownership faults; no guest or ACK writers.

Run under the shared pool and 128 MiB trusted supervisor. Reproduction oracle
is separately retained unchanged in independent-generally-bounded-acceptance.py.
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


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--evidence', required=True)
    out = Path(p.parse_args().evidence)
    out.mkdir(parents=True, exist_ok=False)
    processes, commands, results = [], [], []

    def until(check):
        end = time.monotonic() + 3
        while not check():
            assert time.monotonic() < end, 'bounded observation wait'
            time.sleep(.005)

    def start(name, mailbox, state, *, deadline=20, timeout=38):
        cmd = [sys.executable, '-B', str(HELPER), '--mailbox', str(mailbox),
               '--state', str(state), '--receipt', str(out / (name + '.receipt')),
               '--total', '2501', '--timeout-seconds', str(timeout),
               '--deadline-seconds', str(deadline)]
        with (out / (name + '.stdout')).open('wb') as stdout, (out / (name + '.stderr')).open('wb') as stderr:
            child = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr)
        processes.append(child)
        commands.append(dict(name=name, argv=cmd, pid=child.pid))
        return child

    def cursor(name, next_id=13):
        path = out / (name + '.cursor')
        path.write_text(json.dumps(dict(next=next_id, pending=False)))
        return path

    def reject(name, mailbox, state, requests):
        before = sorted(x.name for x in requests.iterdir())
        state_before = state.read_bytes()
        child = start(name, mailbox, state)
        assert child.wait(timeout=3) == 1
        assert state.read_bytes() == state_before, 'rejection must not reset cursor'
        assert sorted(x.name for x in requests.iterdir()) == before == ['0012.json']
        receipt = json.loads((out / (name + '.receipt')).read_text())
        assert receipt['ok'] is False
        results.append(dict(name=name, refused=True, noRequest13=True, error=receipt['error']))

    try:
        mailbox = out / 'mailbox'
        mailbox.mkdir()
        owner_state = cursor('owner', 12)
        owner = start('owner', mailbox, owner_state)
        requests = mailbox / 'requests'
        until(lambda: (requests / '0012.json').exists())
        assert owner.poll() is None
        reject('same-state', mailbox, owner_state, requests)
        alias = out / 'mailbox-alias'
        alias.symlink_to(mailbox, target_is_directory=True)
        reject('symlink-root', alias, cursor('alias'), requests)
        linked = out / 'different-mailbox-root'
        linked.mkdir()
        (linked / 'requests').symlink_to(requests, target_is_directory=True)
        (linked / 'replies').symlink_to(mailbox / 'replies', target_is_directory=True)
        reject('symlink-requests', linked, cursor('linked'), requests)
        # Death releases flock, never authoritative pending transport state.
        owner.terminate()
        owner.wait(timeout=2)
        journal = next(mailbox.glob('.generally-loading-*.journal'))
        before = journal.read_bytes()
        assert json.loads(before)['status'] == 'pending'
        reject('dead-owner-new-cursor', alias, cursor('dead'), requests)
        assert journal.read_bytes() == before
        results.append(dict(name='death-remains-pending', status='pending', repliesWritten=0))

        timed = out / 'timed-mailbox'
        timed.mkdir()
        state = cursor('timed-owner', 12)
        child = start('timed-owner', timed, state, deadline=.2, timeout=.1)
        assert child.wait(timeout=3) == 1
        journal = next(timed.glob('.generally-loading-*.journal'))
        before = journal.read_bytes()
        record = json.loads(before)
        assert record['status'] == 'poisoned' and record['pending']['id'] == 12
        reject('timeout-new-cursor', timed, cursor('timeout-new'), timed / 'requests')
        assert journal.read_bytes() == before
        assert json.loads(state.read_text())['pending'] is True
        results.append(dict(name='timeout-remains-poisoned', pending=record['pending'], repliesWritten=0))
    finally:
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
        (out / 'cleanup.json').write_text(json.dumps(cleanup, indent=2))
        (out / 'commands.json').write_text(json.dumps(commands, indent=2))
        (out / 'observations.json').write_text(json.dumps(results, indent=2))
    assert all(not x['alive'] for x in cleanup)
    (out / 'result.json').write_text(json.dumps(dict(pass_=True, helperSHA256=hashlib.sha256(HELPER.read_bytes()).hexdigest(),
                                                   cases=len(results), ACKsWritten=0, guestInvocations=0,
                                                   cleanupComplete=True), indent=2))
    print('PASS: aliases, live exclusion, durable death/timeout; zero ACKs written')


if __name__ == '__main__':
    main()

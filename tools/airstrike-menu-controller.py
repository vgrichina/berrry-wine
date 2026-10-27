#!/usr/bin/env python3
"""Airstrike-only, observation-gated NDJSON bridge. See the companion recipe.

stdout commands are EXACT production --control-stdin objects. The caller must
forward them serially and feed back actual [ctl] payloads as {"ack": payload}.
No guest launch, screenshots, focus inference, retries or automatic cleanup.
"""
import json
import select
import sys
import time

ITEMS = ["Resume game", "Players setup", "Toggle fullscreen", "About the game",
         "Release notes", "Toggle debug mode", "Quit game"]
NEXT = ("Fresh unobscured desktop capture identifying Airstrike and its input "
        "focus, plus Airstrike menu header, all seven labels and selected '*' "
        "row after the last dispatched key release. ACKs are not observations.")


class Refusal(Exception):
    pass


class Terminal(Exception):
    def __init__(self, value):
        self.value = value


class Controller:
    def __init__(self, receive, send):
        self.receive, self.send = receive, send
        self.serial = 0
        self.after = None
        self.activated = False

    def read(self):
        value = self.receive()
        if not isinstance(value, dict):
            raise Refusal('missing/uncertain response; no further dispatch')
        if 'terminal' in value:
            # Terminal messages always stop dispatch. Validation is separate.
            raise Terminal(value['terminal'])
        return value

    def observe(self, expected=None):
        o = self.read().get('observation', {})
        if (o.get('after') != self.after or o.get('focus') != 'airstrike'
                or o.get('unobscured') is not True or not o.get('evidence')
                or o.get('keysReleased') is not True):
            raise Refusal('insufficient-observation: ' + NEXT)
        if o.get('state') == 'gameplay' and self.after is None:
            return None
        index = o.get('selected')
        if (o.get('state') != 'menu' or o.get('header') != 'Airstrike menu'
                or o.get('items') != ITEMS or type(index) is not int
                or not 0 <= index <= 6 or (expected is not None and index != expected)):
            raise Refusal('insufficient-observation: ' + NEXT)
        return index

    def key(self, action, vk):
        self.serial += 1
        self.after = 'airstrike-' + str(self.serial)
        cmd = f'{action}:{vk}'
        self.send({'id': self.after, 'cmd': cmd})
        a = self.read().get('ack', {})
        v = a.get('value', {})
        # Frozen queued ACK is insufficient: require the actual runner input log.
        logs = v.get('logs', [])
        prefix = f'[input] {action} vk={vk} at batch '
        if (a.get('id') != self.after or a.get('ok') is not True
                or v.get('queued') or type(v.get('batch')) is not int
                or not isinstance(logs, list)
                or not any(isinstance(s, str) and s.startswith(prefix) for s in logs)):
            raise Refusal('uncertain/rejected dispatch; no replay or further input')

    def press(self, vk):
        self.key('keydown', vk)
        self.key('keyup', vk)

    def run(self):
        index = self.observe()
        if index is None:
            self.press(27)
            index = self.observe(0)
        while index < 6:
            self.press(40)
            index = self.observe(index + 1)
        # Only a positively observed Quit row can reach Enter.
        self.activated = True
        try:
            self.press(13)
        except Terminal as end:
            # Enter may exit the game before its ACK or key release. Never send
            # a keyup into a dead/uncertain recipient. Require terminal proof.
            t = end.value
        else:
            t = self.receive()
            t = t.get('terminal', {}) if isinstance(t, dict) else {}
        if not isinstance(t, dict):
            raise Refusal('uncertain terminal response')
        log = t.get('runnerLog', '')
        if (not isinstance(log, str) or '[Exit] code=0' not in log.splitlines()
                or any(s in log for s in ('[max-seconds]', '*** CRASH', 'Fatal error:', '[eip-zero]'))
                or t.get('reason') != 'guest-exit' or t.get('guestExitCode') != 0
                or t.get('runnerExitCode') != 0 or t.get('signals') != []
                or t.get('cleanupComplete') is not True or not t.get('evidence')
                or t.get('timeout') is not False or t.get('controlQuit') is not False
                or t.get('wmClose') is not False or t.get('fault') is not False
                or t.get('hostExitObserved') is not True):
            raise Refusal('normal Quit unproven: need guest host-exit(0), full terminal log and cleanup; runner exit0 alone is insufficient')
        return {'status': 'normal-quit-observed', 'commands': self.serial}


def main():
    # Read one bounded line at a time; no buffered read-ahead obscuring deadlines.
    def receive():
        deadline = time.monotonic() + 10
        data = bytearray()
        while len(data) < 16384:
            if not select.select([sys.stdin.fileno()], [], [], max(0, deadline-time.monotonic()))[0]:
                raise Refusal('response timeout; no retry or further dispatch')
            import os
            b = os.read(sys.stdin.fileno(), 1)
            if not b:
                raise Refusal('EOF; no further dispatch')
            if b == b'\n':
                return json.loads(data)
            data.extend(b)
        raise Refusal('response too large')
    try:
        result = Controller(receive, lambda c: print(json.dumps(c), flush=True)).run()
    except Terminal:
        print(json.dumps({'status': 'refused', 'reason': 'terminal before observed Quit activation'}), file=sys.stderr)
        return 2
    except (Refusal, ValueError, TypeError, AttributeError, BrokenPipeError) as error:
        print(json.dumps({'status': 'refused', 'reason': str(error)}), file=sys.stderr)
        return 2
    print(json.dumps(result), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())

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


def console_target(observation, snapshot):
    """One reviewed startup Console, never a title-only or guessed target."""
    o, s = observation, snapshot
    if (o.get('state') != 'startup' or o.get('after') is not None
            or o.get('unobscured') is not False or o.get('keysReleased') is not True
            or o.get('startupPrompt') != 'Press any key to start'
            or not o.get('evidence') or not isinstance(s, dict)
            or type(s.get('batch')) is not int or s.get('quit') is not False
            or s.get('focus') != s.get('mainHwnd') or not s.get('mainHwnd')
            or s.get('frozen', {}).get('frozen') is not True
            or s['frozen'].get('credits') != 0):
        raise Refusal('unproven startup Console identity/frozen boundary')
    windows = s.get('windows', [])
    target = o.get('consoleMinimize')
    main = [w for w in windows if w.get('hwnd') == s['mainHwnd']]
    if (len(windows) != 2 or len(main) != 1
            or main[0].get('title') != 'Airstrike 1.0 pre6'
            or main[0].get('visible') is not True or main[0].get('isChild') is not False
            or not isinstance(target, dict) or target not in windows
            or target.get('hwnd') == s['mainHwnd'] or target.get('title') != 'Console'
            or target.get('visible') is not True or target.get('isChild') is not False
            or not isinstance(target.get('hwnd'), str)
            or not target['hwnd'].startswith('0x')
            or any(type(target.get(k)) is not int for k in ('x', 'y', 'w', 'h'))):
        raise Refusal('wrong/unknown reviewed Console target')
    try:
        hwnd = int(target['hwnd'], 16)
    except ValueError:
        raise Refusal('invalid Console handle')
    x, y = target['x'] + target['w'] - 46, target['y'] + 13
    screen = s.get('screen', {})
    if (hwnd <= 0 or target['hwnd'] != hex(hwnd) or target['w'] < 64
            or target['h'] < 32 or not 0 <= x < screen.get('w', 0)
            or not 0 <= y < screen.get('h', 0)):
        raise Refusal('unsafe Console caption geometry')
    return target


def execution_log(command, batch, snapshot=None):
    parts = command.split(':')
    if len(parts) == 3 and parts[0] == 'caption-click' and parts[2] == 'min':
        matches = [w for w in (snapshot or {}).get('windows', [])
                   if w.get('hwnd') == parts[1]]
        if len(matches) != 1:
            raise Refusal('missing unique caption execution target')
        w = matches[0]
        return (f'[input] caption-click min hwnd={parts[1]} at '
                f'{w["x"] + w["w"] - 46},{w["y"] + 13} at batch {batch}')
    action, vk = parts
    return f'[input] {action} vk={vk} at batch {batch}'


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

    def observe(self, expected=None, *, startup=False, gameplay=False):
        o = self.read().get('observation', {})
        if startup and self.after is None and 'consoleMinimize' in o:
            target = console_target(o, o.get('startupSnapshot'))
            self.dispatch('caption-click:' + target['hwnd'] + ':min', o['startupSnapshot'])
            # A minimize ACK says nothing about the next pixels or focus.
            return self.observe(startup=True, gameplay=True)
        if (o.get('after') != self.after or o.get('focus') != 'airstrike'
                or o.get('unobscured') is not True or not o.get('evidence')
                or o.get('keysReleased') is not True):
            raise Refusal('insufficient-observation: ' + NEXT)
        if o.get('state') == 'startup' and startup and o.get('startupPrompt') == 'Press any key to start':
            return 'startup'
        if o.get('state') == 'gameplay' and (self.after is None or gameplay):
            return None
        index = o.get('selected')
        if (o.get('state') != 'menu' or o.get('header') != 'Airstrike menu'
                or o.get('items') != ITEMS or type(index) is not int
                or not 0 <= index <= 6 or (expected is not None and index != expected)):
            raise Refusal('insufficient-observation: ' + NEXT)
        return index

    def key(self, action, vk):
        self.dispatch(f'{action}:{vk}')

    def dispatch(self, cmd, snapshot=None):
        self.serial += 1
        self.after = 'airstrike-' + str(self.serial)
        self.send({'id': self.after, 'cmd': cmd})
        response = self.read()
        a = response.get('ack', {})
        v = a.get('value', {})
        # A production queue receipt needs separate serial completion evidence.
        logs = v.get('logs', [])
        queued = v.get('queued')
        if queued is True:
            completion = response.get('completion', {})
            step = completion.get('step', {})
            completion_snapshot = completion.get('snapshot', {})
            done, state = step.get('value', {}), completion_snapshot.get('value', {})
            batch = v.get('batch')
            if (type(batch) is not int or completion.get('inputId') != self.after
                    or step.get('ok') is not True or completion_snapshot.get('ok') is not True
                    or not isinstance(step.get('id'), str)
                    or not isinstance(completion_snapshot.get('id'), str)
                    or len({self.after, step.get('id'), completion_snapshot.get('id')}) != 3
                    or done.get('ran') != 1 or done.get('steps') != 1
                    or done.get('frozen') is not True or done.get('batch') != batch+1
                    or state.get('batch') != batch+1
                    or state.get('frozen', {}).get('frozen') is not True
                    or state['frozen'].get('credits') != 0):
                raise Refusal('uncertain frozen completion; no replay or further input')
            logs = completion.get('logs', [])
            expected = execution_log(cmd, batch, snapshot)
            if not isinstance(logs, list) or logs.count(expected) != 1:
                raise Refusal('missing actual frozen input log; no further input')
        expected = execution_log(cmd, v.get('batch'), snapshot)
        if (a.get('id') != self.after or a.get('ok') is not True
                or (queued and queued is not True) or type(v.get('batch')) is not int
                or not isinstance(logs, list)
                or expected not in logs):
            raise Refusal('uncertain/rejected dispatch; no replay or further input')

    def press(self, vk):
        self.key('keydown', vk)
        self.key('keyup', vk)

    def run(self):
        index = self.observe(startup=True, gameplay=True)
        if index == 'startup':
            self.press(32)
            index = self.observe(gameplay=True)
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

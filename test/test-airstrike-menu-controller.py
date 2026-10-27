"""Tiny fake bridge driving the actual new executable; never starts a guest."""
import json
import pathlib
import subprocess
import sys
import unittest

ENTRY = pathlib.Path(__file__).resolve().parents[1] / 'tools/airstrike-menu-controller.py'
ITEMS = ['Resume game', 'Players setup', 'Toggle fullscreen', 'About the game',
         'Release notes', 'Toggle debug mode', 'Quit game']


def observation(after=None, selected=0, **changes):
    o = dict(after=after, selected=selected, focus='airstrike', unobscured=True,
             evidence='fixture-desktop-and-focus', keysReleased=True, state='menu',
             header='Airstrike menu', items=ITEMS)
    o.update(changes)
    return {'observation': o}


def ack(i, action, vk, **changes):
    a = dict(id=f'airstrike-{i}', ok=True,
             value={'batch': i, 'logs': [f'[input] {action} vk={vk} at batch {i}']})
    a.update(changes)
    return {'ack': a}


def terminal(**changes):
    t = dict(reason='guest-exit', guestExitCode=0, runnerExitCode=0, signals=[],
             cleanupComplete=True, evidence='fixture-terminal', timeout=False,
             controlQuit=False, wmClose=False, fault=False, hostExitObserved=True,
             runnerLog='[Exit] code=0\n')
    t.update(changes)
    return {'terminal': t}


def drive(messages):
    p = subprocess.run([sys.executable, str(ENTRY)], input=''.join(json.dumps(x)+'\n' for x in messages),
                       text=True, capture_output=True, timeout=12)
    return p.returncode, [json.loads(x) for x in p.stdout.splitlines()], json.loads(p.stderr)


class MenuTests(unittest.TestCase):
    def test_observed_gameplay_menu_each_row_and_quit(self):
        messages = [observation(state='gameplay')]
        expected = []
        i = 0
        for vk, selected in [(27, 0)] + [(40, n) for n in range(1, 7)] + [(13, None)]:
            for action in ('keydown', 'keyup'):
                i += 1
                messages.append(ack(i, action, vk))
                expected.append({'id': f'airstrike-{i}', 'cmd': f'{action}:{vk}'})
            if selected is not None:
                messages.append(observation(f'airstrike-{i}', selected))
        messages.append(terminal())
        rc, commands, result = drive(messages)
        self.assertEqual((rc, commands, result['status']), (0, expected, 'normal-quit-observed'))

    def test_observation_refusals_dispatch_nothing(self):
        for o in [dict(unobscured=False), dict(focus='console'), dict(evidence=''),
                  dict(state='unknown'), dict(items=['Quit game']), dict(keysReleased=False)]:
            with self.subTest(o=o):
                rc, commands, result = drive([observation(**o)])
                self.assertEqual((rc, commands, result['status']), (2, [], 'refused'))

    def test_ack_is_not_row_observation_and_wrong_row_stops(self):
        for next_message in [ack(2, 'keyup', 40), observation('airstrike-2', 4),
                             observation('stale', 6), observation('airstrike-2', 6, focus='console')]:
            rc, commands, _ = drive([observation(selected=5), ack(1, 'keydown', 40),
                                     ack(2, 'keyup', 40), next_message])
            self.assertEqual(rc, 2)
            self.assertEqual([c['cmd'] for c in commands], ['keydown:40', 'keyup:40'])

    def test_uncertain_or_terminal_halts_without_keyup_or_retry(self):
        for reply in [ack(1, 'keydown', 13, ok=False), ack(1, 'keydown', 13, id='wrong'),
                      ack(1, 'keydown', 13, value={'queued': True}), terminal(timeout=True), {}]:
            rc, commands, _ = drive([observation(selected=6), reply, ack(2, 'keyup', 13)])
            self.assertEqual((rc, len(commands)), (2, 1))
        rc, commands, result = drive([observation(selected=6), terminal()])
        self.assertEqual((rc, len(commands), result['status']), (0, 1, 'normal-quit-observed'))
        rc, commands, _ = drive([observation(selected=5), terminal()])
        self.assertEqual((rc, len(commands)), (2, 1))

    def test_timeout_controlquit_wmclose_and_exit0_are_not_normal_quit(self):
        for t in [terminal(timeout=True), terminal(controlQuit=True), terminal(wmClose=True),
                  terminal(runnerLog='[max-seconds] stopping after 115s\n[Exit] code=0\n'),
                  terminal(runnerLog=''), terminal(hostExitObserved=False),
                  terminal(signals=['TERM']), terminal(reason='runner-timeout')]:
            rc, commands, _ = drive([observation(selected=6), ack(1, 'keydown', 13), ack(2, 'keyup', 13), t])
            self.assertEqual((rc, len(commands)), (2, 2))


if __name__ == '__main__':
    unittest.main(verbosity=2)

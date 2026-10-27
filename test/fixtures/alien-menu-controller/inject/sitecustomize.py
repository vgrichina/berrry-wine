"""Fixture-only actual HTTP connection boundary failure injection."""
import http.client
import json
import os
from pathlib import Path
import signal
import time

config = json.loads(os.environ.get('ALIEN_BOUNDARY_INJECT', '{}'))
original = http.client.HTTPConnection.connect
calls = 0


def connect(self):
    global calls
    original(self)
    calls += 1
    if calls == (5 if config.get('mode') == 'cleanup' else 2):
        home = Path(config['home'])
        if config['mode'] == 'death':
            os.kill(json.loads((home / 'command.json').read_text())['pid'], signal.SIGKILL)
            # Observe real process death before the guard; no atomic-send claim.
            for _ in range(100):
                try:
                    state = Path('/proc/%d/stat' % json.loads((home / 'command.json').read_text())['pid']).read_text().rsplit(') ', 1)[1].split()[0]
                    if state == 'Z':
                        break
                except FileNotFoundError:
                    break
                time.sleep(.001)
        elif config['mode'] == 'terminal':
            (home / 'terminal.json').write_text('{"reason":"fixture terminal at dispatch"}')
        elif config['mode'] == 'crash':
            raise KeyboardInterrupt('fixture controller crash at pending input')
        elif config['mode'] in ('time','cleanup'):
            real = time.time
            offset = 106 if config['mode'] == 'cleanup' else 85
            time.time = lambda: real() + offset
        elif config['mode'] == 'budget':
            p = home / 'budget.json'
            value = json.loads(p.read_text())
            value.update(startedAt=time.time(), deadline=time.time()+120, captureLimit=99)
            p.write_text(json.dumps(value))


if config:
    http.client.HTTPConnection.connect = connect

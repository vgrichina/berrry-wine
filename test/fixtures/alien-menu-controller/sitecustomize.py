"""Offline subprocess clock and boundary injection. Never imported by production.

Only the fixture CLI subprocess gets this directory in PYTHONPATH. The production
controller has no fake-clock flag or environment branch.
"""
import json
import os
from pathlib import Path
import time

path = Path(os.environ['ALIEN_TEST_CLOCK'])


def now():
    return json.loads(path.read_text())['now']


time.time = now
time.monotonic = now
if os.environ.get('ALIEN_TEST_CONNECT'):
    import http.client
    original = http.client.HTTPConnection.connect
    count = 0

    def connect(self):
        global count
        original(self)
        count += 1
        # First connection confirms the reviewed frozen boundary. The second
        # is input: inject a supervisor event during socket establishment.
        if count == 2:
            config = json.loads(os.environ['ALIEN_TEST_CONNECT'])
            if 'now' in config:
                path.write_text(json.dumps(dict(now=config['now'])))
            if 'terminal' in config:
                Path(config['terminal']).write_text('{"returncode":0,"reason":"cutoff during connect"}')
    http.client.HTTPConnection.connect = connect

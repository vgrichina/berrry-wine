"""Exact production main + launched offline transport; fake review clock only.

The full PNG is read before a correlated decision becomes available. Delays
are the retained 640x480 frame transport measurements, not real guest evidence.
No controller/supervisor method is replaced or reconstructed.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
TOOL = HERE.parents[2]/'tools/enigma-supervised-gameplay.py'
DELAYS = (0, 0)
READ_SECONDS = float(os.environ.get('FRAME_READ_SECONDS', '2'))
CAPTURE_SECONDS = float(os.environ.get('FRAME_CAPTURE_SECONDS', '0'))
PERSIST_SECONDS = float(os.environ.get('FRAME_PERSIST_SECONDS', '0'))
PERSIST_TARGET = os.environ.get('FRAME_PERSIST_TARGET', 'menu-candidate.png.json')


def boundary(root, allowance, plan):
    root.mkdir(parents=True)
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    c = dict(command=[sys.executable, str(HERE/'child_server.py'), '--port', str(port),
                      '--root', str(root), '--fault', 'loading-review'],
        cwd=str(HERE), url=f'http://127.0.0.1:{port}/ctl', launch_dir=str(root/'launch'),
        cutoff_at=time.time()+150, duration_seconds=110, ready_seconds=2,
        limits=dict(cpu=20, wall=120, physical=100663296, file=25165824, output=2097152),
        controller=dict(max_batches=200000,checkpoint_batches=1,after_action_batches=1,
            cleanup_batches=1,max_captures=3,capture_bytes=700000,width=640,height=480,
            checkpoint_seconds=5,after_action_seconds=1,review_seconds=allowance,
            request_timeout=.15,cleanup_seconds=.5,decision_path=str(root/'decision.json'),
            progress=dict(max_checkpoints=2)))
    if plan is not None:
        c['controller']['review_plan'] = plan
    config=root/'launch.json'
    config.write_text(json.dumps(c))
    real_time, real_sleep = time.time, time.sleep
    real_open = urllib.request.OpenerDirector.open
    offset = 0
    pending = None
    reviews = []
    main_thread = threading.get_ident()
    def clock():
        return real_time()+offset
    def transport(opener, request, *args, **kwargs):
        nonlocal pending, offset
        response = real_open(opener, request, *args, **kwargs)
        cmd = json.loads(request.data)
        if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:
            if not reviews: offset += CAPTURE_SECONDS
            # Read the entire retained-shape image; never authorize from title,
            # thumbnail, partial image, or uncorrelated historical screenshot.
            raw = Path(cmd['path']).read_bytes()
            decision = json.loads((root/'decision.json').read_text())
            (root/'decision.json').unlink()
            assert decision['frameSHA256'] == hashlib.sha256(raw).hexdigest()
            assert raw[16:24] == (640).to_bytes(4,'big')+(480).to_bytes(4,'big')
            pending = (clock()+DELAYS[len(reviews)], decision)
            reviews.append(dict(bytes=len(raw), sha256=decision['frameSHA256'],
                                delay=DELAYS[len(reviews)], transferSeconds=READ_SECONDS if not reviews else 0, completed=False))
        return response
    def sleep(n):
        nonlocal offset, pending
        if (pending is None or threading.get_ident() != main_thread
                or (root/'launch/controller/outcome.json').exists()):
            real_sleep(n)
            return
        offset += n
        if clock() >= pending[0]:
            (root/'decision.json').write_text(json.dumps(pending[1]))
            reviews[-1]['completed'] = True
            pending = None
    real_replace = Path.replace
    def timed_replace(path, *args, **kwargs):
        nonlocal offset
        result = real_replace(path, *args, **kwargs)
        # save() writes a temporary sibling before the atomic replace.
        if path.name == PERSIST_TARGET + '.tmp':
            offset += PERSIST_SECONDS
        return result
    real_path_open = Path.open
    class TimedRead:
        def __init__(self, f): self.f = f
        def __enter__(self): self.f.__enter__(); return self
        def __exit__(self, *args): return self.f.__exit__(*args)
        def read(self, n=-1):
            nonlocal offset
            raw = self.f.read(n)
            if n == 700001:
                offset += READ_SECONDS
            return raw
        def __getattr__(self, name): return getattr(self.f, name)
    def timed_open(path, *args, **kwargs):
        f = real_path_open(path, *args, **kwargs)
        if path.name == 'menu-candidate.png' and args and args[0] == 'rb':
            return TimedRead(f)
        return f
    with patch.object(Path, 'replace', timed_replace), patch.object(Path, 'open', timed_open), patch.object(time,'time',clock), patch.object(time,'sleep',sleep), \
         patch.object(urllib.request.OpenerDirector,'open',transport):
        spec=importlib.util.spec_from_file_location('production_supervisor',TOOL)
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.object(sys,'argv',[str(TOOL),'--launch-config',str(config)]):
            code=module.main()
    outcome=root/'launch/controller/outcome.json'
    result=dict(exit=code, reviews=reviews,
        outcome=json.loads(outcome.read_text()) if outcome.exists() else None,
        childStarted=(root/'child.json').exists(),
        supervisor=json.loads((root/'launch/supervisor-outcome.json').read_text())
                   if (root/'launch/supervisor-outcome.json').exists() else None)
    (root/'boundary.json').write_text(json.dumps(result,indent=2)+'\n')
    return result


if __name__ == '__main__':
    assert sys.argv[1] == '--boundary'
    boundary(Path(sys.argv[2]), float(sys.argv[3]), json.loads(sys.argv[4]))

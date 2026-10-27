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
DELAYS = (14.54351074877195, 16.862725148908794)


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
        nonlocal pending
        response = real_open(opener, request, *args, **kwargs)
        cmd = json.loads(request.data)
        if cmd.get('action') == 'png' and 'menu-candidate' in cmd['path']:
            # Read the entire retained-shape image; never authorize from title,
            # thumbnail, partial image, or uncorrelated historical screenshot.
            raw = Path(cmd['path']).read_bytes()
            decision = json.loads((root/'decision.json').read_text())
            (root/'decision.json').unlink()
            assert decision['frameSHA256'] == hashlib.sha256(raw).hexdigest()
            assert raw[16:24] == (640).to_bytes(4,'big')+(480).to_bytes(4,'big')
            pending = (clock()+DELAYS[len(reviews)], decision)
            reviews.append(dict(bytes=len(raw), sha256=decision['frameSHA256'],
                                delay=DELAYS[len(reviews)], completed=False))
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
    with patch.object(time,'time',clock), patch.object(time,'sleep',sleep), \
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


class ReviewBudgetTests(unittest.TestCase):
    def case(self, name, allowance, plan=None):
        root=Path(os.environ.get('ENIGMA_REVIEW_EVIDENCE',tempfile.mkdtemp()))/name
        p=subprocess.run([sys.executable,str(Path(__file__)), '--boundary',str(root),
                          str(allowance),json.dumps(plan)],capture_output=True,timeout=20)
        root.parent.mkdir(parents=True,exist_ok=True)
        (root.parent/(name+'.stdout')).write_bytes(p.stdout)
        (root.parent/(name+'.stderr')).write_bytes(p.stderr)
        self.assertEqual(p.returncode,0,p.stderr.decode())
        return root,json.loads((root/'boundary.json').read_text())

    def test_original_measured_transport_exhausts_review_without_click(self):
        root,r=self.case('original',28)
        self.assertEqual(r['exit'],0,r)
        self.assertFalse(r['outcome']['clicked'])
        self.assertGreaterEqual(r['outcome']['reviewSecondsUsed'],28)
        self.assertEqual([x['completed'] for x in r['reviews']],[True,False])
        self.assertEqual(r['supervisor']['remainingOwnedLive'],[])


if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--boundary':
        boundary(Path(sys.argv[2]),float(sys.argv[3]),json.loads(sys.argv[4]))
    else:
        unittest.main()

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
PLAN = dict(checkpoint_seconds=[16,18], progress_seconds=45)


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

    def test_admitted_measured_transport_reviews_both_then_clicks_once(self):
        root,r=self.case('adequate',34,PLAN)
        self.assertEqual(r['exit'],0,r)
        self.assertTrue(r['outcome']['clicked'],r)
        self.assertEqual([x['completed'] for x in r['reviews']],[True,True])
        self.assertGreaterEqual(r['outcome']['reviewSecondsUsed'],sum(DELAYS))
        self.assertLessEqual(r['outcome']['reviewSecondsUsed'],34)
        wire=[json.loads(x) for x in (root/'wire.jsonl').read_text().splitlines()]
        clicks=[i for i,r in enumerate(wire) if 'cmd' in r['command']]
        self.assertEqual(len(clicks),1)
        self.assertEqual(wire[clicks[0]-1]['command'],dict(action='snapshot'))
        trace=[json.loads(x) for x in (root/'launch/controller/requests.jsonl').read_text().splitlines()]
        for i,row in enumerate(trace):
            if row['request'].get('action')=='step':
                ack=json.loads(row['originalResponse'])['value']
                self.assertEqual(ack['ran'],row['request']['n'])
                self.assertEqual(ack['steps'],row['request']['n'])
                snap=json.loads(trace[i+1]['originalResponse'])['value']
                self.assertEqual(snap['batch'],ack['batch'])
                self.assertEqual(snap['frozen']['credits'],0)
        self.assertEqual(wire[-1]['command'],dict(action='quit'))
        self.assertEqual(r['supervisor']['remainingOwnedLive'],[])

    def test_incompatible_plans_reject_at_production_entry_before_child(self):
        cases=[('review',28,PLAN,'insufficient-cumulative-review-allowance'),
               ('wall',34,dict(PLAN,progress_seconds=100),'insufficient-review-progress-action-wall-allowance'),
               ('ready',34,dict(PLAN,progress_seconds=73),'insufficient-initialization-review-progress-action-wall-allowance'),
               ('unknown',34,dict(PLAN,unknown=1),'invalid-review-plan-fields'),
               ('count',34,dict(PLAN,checkpoint_seconds=[16]),'invalid-review-plan-checkpoints'),
               ('nan',34,dict(PLAN,checkpoint_seconds=[float('nan'),18]),'Out of range float'),
               ('bool',34,dict(PLAN,progress_seconds=True),'invalid-review-plan-progress')]
        for name,allowance,plan,reason in cases:
            with self.subTest(name=name):
                root,r=self.case(name,allowance,plan)
                self.assertEqual(r['exit'],1,r)
                self.assertFalse(r['childStarted'])
                self.assertIsNone(r['outcome'])
                self.assertFalse((root/'launch').exists())
                self.assertEqual(r['reviews'],[])
                self.assertIn(reason,(root.parent/(name+'.stdout')).read_text())

    def test_proposed_runtime_budget_fits_unchanged_enforced_caps(self):
        # Preflight only. A fresh caller must explicitly admit these values;
        # this does not renew the exhausted run or execute a guest.
        spec=importlib.util.spec_from_file_location('runtime_preflight',TOOL)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with socket.socket() as s:
                s.bind(('127.0.0.1',0));port=s.getsockname()[1]
            c=dict(command=[sys.executable],cwd=str(root),url=f'http://127.0.0.1:{port}/ctl',
                launch_dir=str(root/'launch'),cutoff_at=time.time()+150,duration_seconds=110,
                ready_seconds=8,limits=dict(cpu=90,wall=120,physical=134217728,
                    file=25165824,output=2097152),
                controller=dict(max_batches=2000000,checkpoint_batches=1000000,
                    after_action_batches=500000,cleanup_batches=256,max_captures=4,
                    capture_bytes=700000,width=640,height=480,checkpoint_seconds=18,
                    after_action_seconds=20,review_seconds=36,request_timeout=1,
                    cleanup_seconds=12,decision_path=str(root/'decision.json'),
                    progress=dict(max_checkpoints=2,total_seconds=110,cpu_reserve=15,
                        api_bytes=1048576,capture_total_bytes=2800000),
                    review_plan=dict(checkpoint_seconds=[17,19],progress_seconds=36)))
            self.assertEqual(module.validate_launch(c),c)
            self.assertFalse((root/'launch').exists())
            c['controller']['progress']['capture_total_bytes']=1400000
            with self.assertRaisesRegex(module.controller.Refusal,'insufficient-planned-review-after-action-capture-bytes'):
                module.validate_launch(c)
            c['controller']['progress']['capture_total_bytes']=2800000
            c['controller']['request_timeout']=3
            with self.assertRaisesRegex(module.controller.Refusal,'insufficient-review-progress-action-wall-allowance'):
                module.validate_launch(c)

    def test_slow_first_frame_cannot_spend_later_review_reservation(self):
        root,r=self.case('first-slot-overrun',34,dict(PLAN,checkpoint_seconds=[1,33]))
        self.assertEqual(r['exit'],0,r)
        self.assertFalse(r['outcome']['clicked'])
        self.assertEqual(len(r['reviews']),1)
        self.assertFalse(r['reviews'][0]['completed'])
        self.assertLess(r['outcome']['reviewSecondsUsed'],1.1)
        self.assertEqual(r['supervisor']['remainingOwnedLive'],[])

    def test_plan_never_renews_cpu_api_captures_or_original_deadline(self):
        from test_controller import FakeProduction, scheduler_unit_controller
        for mode in ('cpu','api','capture','deadline'):
            with self.subTest(mode=mode), FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp)
                decision=root/'decision.json'
                config=fake.config(root,max_captures=3,checkpoint_batches=1,
                    decision_path=str(decision),review_seconds=34,
                    progress=dict(max_checkpoints=2),review_plan=PLAN)
                original=(config['started_at'],config['deadline_at'])
                def review(path,batch,raw):
                    decision.write_text(json.dumps(dict(reviewed=True,
                        frameSHA256=hashlib.sha256(raw).hexdigest(),batch=batch,
                        safeStartGame=True,x=343,y=213)))
                    if mode=='cpu':config['test_cpu_left']=1
                    if mode=='api':driver.api_bytes=driver.progress['api_bytes']-90000
                    if mode=='capture':driver.capture_bytes=driver.progress['capture_total_bytes']
                    if mode=='deadline':fake.now=config['deadline_at']-.1
                fake.on_capture=review
                driver=scheduler_unit_controller(config,clock=lambda:fake.now,
                    sleep=lambda n:setattr(fake,'now',fake.now+n))
                driver.run()
                self.assertTrue(driver.failed)
                self.assertFalse(driver.clicked)
                self.assertFalse(any('cmd' in cmd for cmd in fake.commands))
                self.assertEqual((driver.c['started_at'],driver.c['deadline_at']),original)

    def test_review_evidence_io_debits_the_same_slot_and_cumulative_guard(self):
        from test_controller import FakeProduction, scheduler_unit_controller
        for delay in (16.1,35):
            with self.subTest(delay=delay), FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);decision=root/'decision.json'
                config=fake.config(root,max_captures=3,checkpoint_batches=1,
                    decision_path=str(decision),review_seconds=34,
                    progress=dict(max_checkpoints=2),review_plan=PLAN)
                fake.on_capture=lambda path,batch,raw:decision.write_text(json.dumps(dict(
                    reviewed=True,frameSHA256=hashlib.sha256(raw).hexdigest(),batch=batch,
                    safeStartGame=True,x=343,y=213)))
                driver=scheduler_unit_controller(config,clock=lambda:fake.now,
                    sleep=lambda n:setattr(fake,'now',fake.now+n))
                save=driver.save
                def delayed_save(name,value):
                    save(name,value)
                    if name.startswith('review-'):
                        fake.now+=delay
                driver.save=delayed_save
                self.assertEqual(driver.run(),'exhausted-budget: review-reservation')
                self.assertTrue(driver.failed)
                self.assertFalse(any('cmd' in cmd for cmd in fake.commands))
                self.assertAlmostEqual(driver.review_used,delay,places=5)


if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--boundary':
        boundary(Path(sys.argv[2]),float(sys.argv[3]),json.loads(sys.argv[4]))
    else:
        unittest.main()

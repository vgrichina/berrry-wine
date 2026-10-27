"""Source-only production Python entry contract; controlled transport, no guest.

The unchanged pinned JS runner is checked in full. The real supervisor CLI
launches its own offline listener, not a historical reconstructed controller.
This does not establish an actual Enigma menu or runtime acceptance.
"""
import hashlib
import json
import unittest
import tempfile
from pathlib import Path
from test_supervised import SupervisedTests, HERE
from test_controller import FakeProduction, scheduler_unit_controller


class ProgressEntryTests(unittest.TestCase):
    # Reuse the production CLI fixture without rediscovering inherited tests.
    setUp = SupervisedTests.setUp
    cleanup = SupervisedTests.cleanup
    config = SupervisedTests.config
    launch = SupervisedTests.launch
    finish = SupervisedTests.finish
    wire = SupervisedTests.wire
    cleaned = SupervisedTests.cleaned
    def test_loading_to_menu_production_boundary(self):
        runner = HERE.parents[2]/'test/run.js'
        self.assertEqual(hashlib.sha256(runner.read_bytes()).hexdigest(),
                         '6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e')
        d,c = self.config(fault='loading-review', max_captures=3)
        result = self.finish(self.launch(d,c),d)
        self.assertEqual(result['exit'],0,result)
        wire = self.wire(d)
        clicks = [i for i,r in enumerate(wire) if 'cmd' in r['command']]
        self.assertEqual(len(clicks),1,wire)
        captures = [i for i,r in enumerate(wire) if r['command'].get('action') == 'png']
        self.assertEqual(len(captures),3,wire)
        self.assertLess(captures[1],clicks[0])
        self.assertGreater(wire[captures[1]]['batch'],wire[captures[0]]['batch'])
        self.assertEqual(wire[clicks[0]-1]['command'],{'action':'snapshot'})
        trace = [json.loads(x) for x in (d/'launch/controller/requests.jsonl').read_text().splitlines()]
        for i,row in enumerate(trace):
            if row['request'].get('action') == 'step':
                ack = json.loads(row['originalResponse'])['value']
                self.assertEqual(ack['ran'],row['request']['n'])
                self.assertEqual(ack['steps'],row['request']['n'])
                snap = json.loads(trace[i+1]['originalResponse'])['value']
                self.assertEqual(snap['batch'],ack['batch'])
                self.assertEqual(snap['frozen']['credits'],0)
        self.assertEqual(wire[-1]['command'],{'action':'quit'})
        self.cleaned(d)

    def test_never_ready_quits_with_after_capture_reserved(self):
        d,c = self.config(fault='never-ready', max_captures=4)
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],0)
        wire = self.wire(d)
        self.assertEqual(sum(r['command'].get('action') == 'png' for r in wire),3)
        self.assertFalse(any('cmd' in r['command'] for r in wire))
        self.assertEqual(wire[-1]['command'],{'action':'quit'})
        outcome=json.loads((d/'launch/controller/outcome.json').read_text())
        self.assertEqual(outcome['status'],'LOADING_REVIEWED_RESERVE_STOP_NO_INPUT')
        self.cleaned(d)

    def test_later_pending_step_stops_original_owner_no_replay(self):
        d,c = self.config(fault='loading-timeout', max_captures=3)
        self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
        wire=self.wire(d)
        last_capture=next(i for i,r in enumerate(wire) if r['command'].get('action') == 'png')
        self.assertEqual(sum(r['command'].get('action') == 'step' for r in wire[last_capture+1:]),1)
        self.assertEqual(wire[-1]['command']['action'],'step')
        self.assertFalse(any('cmd' in r['command'] for r in wire))
        outcome=json.loads((d/'launch/controller/outcome.json').read_text())
        self.assertTrue(outcome['pending'])
        self.cleaned(d)

    def test_invalid_progress_limits_reject_before_child(self):
        for i,p in enumerate(({'max_checkpoints':3}, {'total_seconds':13}, {'cpu_reserve':20},
                              {'api_bytes':1048577}, {'capture_total_bytes':1}, {'unknown':1})):
            with self.subTest(progress=p):
                d,c=self.config(name=str(i),progress=p)
                self.assertEqual(self.finish(self.launch(d,c),d)['exit'],1)
                self.assertFalse((d/'child.json').exists())
                self.assertFalse((d/'launch').exists())


class ProgressReserveTests(unittest.TestCase):
    def exercise(self, mode, **updates):
        with FakeProduction() as fake, tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            decision=root/'decision.json'
            config=fake.config(root, **dict(dict(max_captures=4, decision_path=str(decision)), **updates))
            frames=[]
            def review(path,batch,raw):
                frames.append(batch)
                row=dict(reviewed=True,frameSHA256=hashlib.sha256(raw).hexdigest(),batch=batch,
                         continueLoading=True)
                if mode=='stale' and len(frames)==2:
                    row['batch']=frames[0]
                    row.pop('continueLoading')
                    row['safeStartGame']=True
                if mode=='identity' and len(frames)==2:
                    driver.listener.verify=lambda: (_ for _ in ()).throw(RuntimeError('identity changed'))
                if mode=='conflict':
                    row['safeStartGame']=True
                if mode=='cpu':
                    config['test_cpu_left']=1
                if mode=='api':
                    driver.api_bytes=driver.progress['api_bytes']-100000
                if mode in ('cpu-start','api-start','bytes-start'):
                    row.pop('continueLoading')
                    row.update(safeStartGame=True,x=10,y=20)
                    if mode=='cpu-start':
                        config['test_cpu_left']=1
                    elif mode=='api-start':
                        driver.api_bytes=driver.progress['api_bytes']-90000
                    else:
                        driver.capture_bytes=driver.progress['capture_total_bytes']-config['capture_bytes']+1
                if mode=='wall':
                    fake.now=config['deadline_at']-.2
                if mode=='old-decision' and len(frames)==2:
                    return
                decision.write_text(json.dumps(row))
            fake.on_capture=review
            driver=scheduler_unit_controller(config,clock=lambda:fake.now,
                sleep=lambda n:setattr(fake,'now',fake.now+n))
            status=driver.run()
            self.assertFalse(any('cmd' in c for c in fake.commands), (status, fake.commands))
            return status, fake.commands, frames, driver

    def test_stale_second_review_and_listener_identity_refuse_input(self):
        for mode in ('stale','identity','conflict'):
            with self.subTest(mode=mode):
                status,commands,frames,driver=self.exercise(mode)
                self.assertTrue(driver.failed,status)
                self.assertNotEqual(commands[-1].get('action'),'quit')

    def test_reserves_stop_loading_with_quit_and_no_input(self):
        for mode,updates in (('cpu',{}),('api',{}),('count',{'max_captures':2}),
                             ('batch',{'max_batches':4355,'after_action_batches':256}),
                             ('bytes',{'progress':{'capture_total_bytes':4194304}})):
            with self.subTest(mode=mode):
                status,commands,frames,driver=self.exercise(mode,**updates)
                self.assertFalse(driver.failed,status)
                self.assertEqual(commands[-1],{'action':'quit'})
                self.assertEqual(len(frames),1)

    def test_old_loading_decision_is_not_reused_for_new_frame(self):
        status,commands,frames,driver=self.exercise('old-decision',review_seconds=.2)
        self.assertFalse(driver.failed,status)
        self.assertEqual(len(frames),2)
        self.assertLessEqual(driver.review_used,.201)
        self.assertEqual(commands[-1],{'action':'quit'})

    def test_reviewed_menu_still_requires_action_reserves(self):
        for mode in ('cpu-start','api-start','bytes-start'):
            with self.subTest(mode=mode):
                status,commands,frames,driver=self.exercise(mode)
                self.assertTrue(driver.failed,status)
                self.assertIn('exhausted-budget',status)
                self.assertEqual(len(frames),1)

    def test_exhausted_wall_during_review_closes_without_wire_cleanup(self):
        status,commands,frames,driver=self.exercise('wall')
        self.assertTrue(driver.failed,status)
        self.assertEqual(commands[-1]['action'],'png')


if __name__ == '__main__':
    unittest.main()

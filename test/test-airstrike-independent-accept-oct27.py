"""Independent source-only acceptance. Uses exact pinned production excerpts.

No guest, build, image recognition, or automatic factual menu approval. Faults
mutate transport/fixtures only; candidate implementation files remain unchanged.
Run via ops/independent.py under the trusted physical-RSS supervisor.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
BASE=Path(os.environ['INDEPENDENT_EVIDENCE'])
RUNNER=Path(os.environ['AIRSTRIKE_PRODUCTION_RUNNER'])
PIN='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
spec=importlib.util.spec_from_file_location('independent_bridge',ROOT/'tools/airstrike-observation-bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class Independent(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert hashlib.sha256(RUNNER.read_bytes()).hexdigest()==PIN
        BASE.mkdir(parents=True,exist_ok=True)
        cls.env=dict(os.environ,AIRSTRIKE_EXTRACTION_RECEIPT=str(BASE/'extracts.json'))
        cls.node=['/usr/bin/node','--max-old-space-size=32']
        # Match environment/executable/flags and bridge child preexec limits.
        startup="const fs=require('fs'),c=require('crypto');console.log(JSON.stringify({executable:process.execPath,version:process.version,flags:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),environmentSHA256:c.createHash('sha256').update(JSON.stringify(Object.entries(process.env).sort())).digest('hex')}))"
        cls.env['INDEPENDENT_COMMANDS']=str(BASE/'startup.commands')
        with (BASE/'startup.stdout').open('wb') as out,(BASE/'startup.stderr').open('wb') as err:
            p=subprocess.run(cls.node+['-e',startup],env=cls.env,stdout=out,stderr=err,preexec_fn=bridge.child_limits,timeout=5)
        assert p.returncode==0

    def exercise(self,mode,*,same=False):
        env=dict(self.env)
        # Keep exact startup environment across operations; command log is shared
        # but sliced per exercise, with immutable per-case copies retained.
        log=Path(env['INDEPENDENT_COMMANDS']);start=log.stat().st_size if log.exists() else 0
        b=bridge.Bridge(self.node+[str(ROOT/'test/fixtures/airstrike-independent-accept-oct27.cjs'),str(RUNNER),mode],ROOT/'tools/airstrike-menu-controller.py',BASE/mode,env=env,guest_seconds=2,wall_seconds=3)
        completed=[]
        def run():
            b.expected_focus=b.focus(b.request('snapshot'))
            b.reviewed_capture=('initial',b.capture('initial'))
            b.response_deadline=min(time.monotonic()+(.18 if mode=='late-step' else 1),b.guest_deadline)
            for action in (['keyup','keyup','keyup'] if same else ['keydown','keyup']):
                b.controller.key(action,27);completed.append(action)
            return dict(status='fixture-complete')
        b.controller.run=run
        result=b.run()
        received=log.read_bytes()[start:];(BASE/mode/'received.jsonl').write_bytes(received)
        commands=[json.loads(x) for x in received.splitlines()]
        self.assertTrue(result['cleanup']['complete'],result)
        self.assertNotEqual(result['status'],'normal-quit-observed')
        self.assertFalse(any(c.get('action') in ('frozen','quit') for c in commands))
        return b,result,commands,completed

    def test_00_independent_exact_completion_order_and_actual_log(self):
        b,result,commands,completed=self.exercise('normal')
        self.assertEqual(completed,['keydown','keyup'],result)
        events=b.events
        for i,e in enumerate(events):
            if e['kind']!='frozen-input-complete':continue
            inp=e['inputAck'];step=e['step'];snap=e['snapshot'];batch=inp['value']['batch']
            self.assertTrue(inp['value']['queued']);self.assertNotIn('logs',inp['value'])
            self.assertEqual((step['value']['ran'],step['value']['steps'],step['value']['batch']),(1,1,batch+1))
            self.assertEqual((snap['value']['batch'],snap['value']['frozen']),(batch+1,{'frozen':True,'credits':0,'tickMs':16,'recording':False}))
            cmd=next(c for c in commands if c['id']==e['inputId'])
            action,vk=cmd['cmd'].split(':')
            self.assertEqual(e['logs'],[f'[input] {action} vk={vk} at batch {batch}'])
            indices=[n for n,c in enumerate(commands) if c['id'] in (e['inputId'],step['id'],snap['id'])]
            self.assertEqual(indices,list(range(indices[0],indices[0]+3)))
            # Completion event must precede every subsequent input dispatch.
            later=[x for x in events[i+1:] if x['kind']=='dispatch' and 'cmd' in x['command']]
            if cmd['cmd'].startswith('keydown'):self.assertEqual(later[0]['command']['cmd'],'keyup:27')
        extracts=json.loads((BASE/'extracts.json').read_text())
        original=json.loads((BASE.parent/'first-boundary/extractions.json').read_text())
        self.assertEqual(extracts,original)

    def reject(self,mode,reason,*,same=False,completed_count=0):
        _,r,commands,done=self.exercise(mode,same=same)
        self.assertEqual(r['status'],'refused',r);self.assertIn(reason,r['reason'])
        self.assertEqual(len(done),completed_count,r)
        inputs=[c for c in commands if 'cmd' in c]
        self.assertEqual(len(inputs),completed_count+1)
        # No replay, unfreeze, following input, or overlapping second step.
        self.assertLessEqual(sum(c.get('action')=='step' for c in commands),completed_count+1)

    def test_duplicate_step_ack_rejected(self):self.reject('duplicate-step','unmatched/duplicate')
    def test_late_step_ack_rejected(self):self.reject('late-step','missing ACK')
    def test_wrong_batch_step_rejected(self):self.reject('wrong-step-batch','partial/unmatched')
    def test_prior_identical_action_snapshot_rejected(self):self.reject('prior-snapshot','frozen-zero snapshot',same=True,completed_count=1)
    def test_prior_identical_action_log_rejected(self):self.reject('prior-log','actual input execution log',same=True,completed_count=1)
    def test_terminal_during_input_rejected(self):self.reject('terminal-input','exited before ACK')
    def test_terminal_during_step_rejected(self):self.reject('terminal','exited before ACK')
    def test_terminal_during_snapshot_rejected(self):self.reject('terminal-snapshot','exited before ACK')
    def test_changed_focus_rejects_before_input(self):
        _,r,commands,done=self.exercise('focus-change')
        self.assertEqual(r['status'],'refused');self.assertEqual(done,[])
        self.assertFalse(any('cmd' in c for c in commands));self.assertIn('focus',r['reason'])
    def test_changed_image_rejects_before_input(self):
        _,r,commands,done=self.exercise('image-change')
        self.assertEqual(r['status'],'refused');self.assertEqual(done,[])
        self.assertFalse(any('cmd' in c for c in commands));self.assertIn('capture file/ACK mismatch',r['reason'])

if __name__=='__main__':unittest.main(verbosity=2)

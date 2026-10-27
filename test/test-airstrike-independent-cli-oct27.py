"""Actual executable CLI contract, frozen completion and rejecting mutations."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
BASE=Path(os.environ['INDEPENDENT_EVIDENCE']);BASE.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('cli_helpers',ROOT/'test/test-airstrike-menu-controller.py');helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)

def completion(i,action,vk):
    batch=11+i
    return dict(ack=dict(id=f'airstrike-{i}',ok=True,value=dict(queued=True,batch=batch)),completion=dict(inputId=f'airstrike-{i}',step=dict(id=f'bridge-step-{i}',ok=True,value=dict(ran=1,steps=1,batch=batch+1,frozen=True)),snapshot=dict(id=f'bridge-snapshot-{i}',ok=True,value=dict(batch=batch+1,frozen=dict(frozen=True,credits=0))),logs=[f'[input] {action} vk={vk} at batch {batch}']))

def drive(name,messages):
    d=BASE/name;d.mkdir()
    payload=''.join(json.dumps(x)+'\n' for x in messages);(d/'stdin.jsonl').write_text(payload)
    with (d/'stdout').open('wb') as out,(d/'stderr').open('wb') as err:
        p=subprocess.run([sys.executable,'-B',str(ROOT/'tools/airstrike-menu-controller.py')],input=payload.encode(),stdout=out,stderr=err,timeout=5)
    (d/'exit.json').write_text(json.dumps(dict(exit=p.returncode)))
    return p.returncode,[json.loads(x) for x in (d/'stdout').read_text().splitlines()],json.loads((d/'stderr').read_text())

class CLI(unittest.TestCase):
    def test_frozen_full16_cli(self):
        messages=[helpers.observation(state='gameplay')];expected=[];i=0
        for vk,selected in [(27,0)]+[(40,n) for n in range(1,7)]+[(13,None)]:
            for action in ('keydown','keyup'):
                i+=1;messages.append(completion(i,action,vk));expected.append(dict(id=f'airstrike-{i}',cmd=f'{action}:{vk}'))
            if selected is not None:messages.append(helpers.observation(f'airstrike-{i}',selected))
        messages.append(helpers.terminal())
        rc,commands,result=drive('full16-cli',messages)
        self.assertEqual((rc,commands,result['status']),(0,expected,'normal-quit-observed'))

    def test_rejecting_frozen_completion_mutations(self):
        original=completion(1,'keydown',27)
        variants={}
        for name in ('partial','steps','wrong-batch','unfrozen','credits','stale-snapshot','stale-log','missing-log','wrong-input','duplicate-id','step-reject','snapshot-reject'):
            m=copy.deepcopy(original);c=m['completion'];step=c['step'];snap=c['snapshot']
            if name=='partial':step['value']['ran']=0
            elif name=='steps':step['value']['steps']=2
            elif name=='wrong-batch':step['value']['batch']-=1
            elif name=='unfrozen':snap['value']['frozen']['frozen']=False
            elif name=='credits':snap['value']['frozen']['credits']=1
            elif name=='stale-snapshot':snap['value']['batch']-=1
            elif name=='stale-log':c['logs']=['[input] keydown vk=27 at batch 11']
            elif name=='missing-log':c['logs']=[]
            elif name=='wrong-input':c['inputId']='airstrike-old'
            elif name=='duplicate-id':snap['id']=step['id']
            elif name=='step-reject':step['ok']=False
            elif name=='snapshot-reject':snap['ok']=False
            rc,commands,result=drive(name,[helpers.observation(state='gameplay'),m,completion(2,'keyup',27)])
            self.assertEqual((rc,commands,result['status']),(2,[dict(id='airstrike-1',cmd='keydown:27')],'refused'),name)

    def test_quit_provenance_mutations(self):
        for name,change in [('cleanup-signal',dict(signals=['SIGTERM'])),('timeout',dict(timeout=True)),('controlquit',dict(controlQuit=True)),('wmclose',dict(wmClose=True)),('no-host-exit',dict(hostExitObserved=False))]:
            rc,commands,result=drive(name,[helpers.observation(selected=6),completion(1,'keydown',13),completion(2,'keyup',13),helpers.terminal(**change)])
            self.assertEqual((rc,len(commands),result['status']),(2,2,'refused'),name)

if __name__=='__main__':unittest.main(verbosity=2)

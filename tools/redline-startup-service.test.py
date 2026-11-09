"""Discriminate release storage, ptrace service and diagnostic stepping.

Real generated supervisor and shipped Node port consumer; no Chrome required.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bounded', ROOT/'redline-bounded-custody.py')
bounded = importlib.util.module_from_spec(spec); spec.loader.exec_module(bounded)
OUT = Path(os.environ['REDLINE_SERVICE_RUN']).resolve()


def load(cap):
    helper, source = bounded.published.load_providers()
    helper.Observer = bounded.bounded_observer(helper.Observer)
    generated = bounded.adapt(helper, source, enabled=True, max_records=cap)
    sys.modules['native_publication_observer'] = helper
    kernel = types.ModuleType('service_custody')
    exec(compile(generated, '<actual-redline-service-custody>', 'exec'), kernel.__dict__)
    return kernel


class Service(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUT.mkdir(parents=True)

    def test_actual_consumer_and_discriminating_service_controls(self):
        # Repeated worker creation requires real ownership admissions after the
        # observer budget has ended. The publisher names itself at actual waits.
        producer = """import os,ctypes,time
ctypes.CDLL(None).prctl(15,b'port-publisher',0,0,0)
for i in range(8):
 p=os.fork()
 if p==0:os.execl('/bin/true','true')
 os.waitpid(p,0)
open(os.environ['PORT_FILE'],'w').write('12345\\n/devtools/browser/service-control\\n')
time.sleep(.3)
"""
        consumer = """const {spawn}=require('node:child_process');
const {once}=require('node:events');const fs=require('node:fs');
const startup=require(process.argv[1]);
(async()=>{const child=spawn('/usr/bin/python3',['-c',process.argv[2]],{stdio:['ignore','pipe','pipe']});
const exit=once(child,'exit').then(([code,signal])=>({code,signal}));
const closed=once(child,'close');const evidence=startup.observeStartup(child,exit);
let outcome;try{outcome=await startup.portPublication({file:process.env.PORT_FILE,exit,evidence,
deadline:Number(process.env.SERVICE_DEADLINE),guard(){},save(n,v){fs.writeFileSync(process.env.SERVICE_RESULT,JSON.stringify(v));}});}catch(e){outcome={error:String(e)};}
await exit;await closed;fs.writeFileSync(process.env.SERVICE_RESULT+'.outcome',JSON.stringify(outcome));})();
"""
        reports=[]
        for name, cap, slow_sync, slow_ptrace in [('plain',2,0,0),('storage',2,.008,0),('ptrace',2,0,.004),('stepped',4096,0,0)]:
            kernel=load(cap); run=OUT/name; run.mkdir()
            sync=os.fsync; trace=kernel.ptrace
            def storage(fd):
                if slow_sync: time.sleep(slow_sync)
                return sync(fd)
            def ptrace(*args,**kwargs):
                if slow_ptrace: time.sleep(slow_ptrace)
                return trace(*args,**kwargs)
            begin=time.monotonic()
            with patch.dict(os.environ,PORT_FILE=str(run/'DevToolsActivePort'),SERVICE_RESULT=str(run/'consumer.json'),SERVICE_DEADLINE=str(int((time.time()+40)*1000))), patch.object(kernel.os,'fsync',storage), patch.object(kernel,'ptrace',ptrace):
                kernel.supervise(run,['node','-e',consumer,str(ROOT/'redline-chrome-startup.cjs'),producer],deadline=time.time()+40,cleanup_deadline=time.time()+45,journal_compression='gzip')
            service=json.loads((run/'startup-service.json').read_text());drain=json.loads((run/'kernel-drain.json').read_text())
            self.assertTrue(drain['complete']); self.assertEqual(len(drain['owned']),len(drain['reaped']))
            self.assertEqual(json.loads((run/'consumer.json').read_text())['outcome'],'published')
            roles=[r for r in service['rows'] if r['kind']=='role' and r.get('comm')=='port-publisher']
            self.assertTrue(roles);self.assertTrue(all(r['identityMatches'] for r in roles if 'identityMatches' in r))
            reports.append(dict(name=name,cap=cap,elapsed=time.monotonic()-begin,totals=service['totals'],dropped=service['dropped'],owned=len(drain['owned'])))
        (OUT/'causal-controls.json').write_text(json.dumps(reports,indent=2))
        plain,storage,ptrace,stepped=reports
        self.assertGreater(storage['totals']['fsync']['wallNs'],plain['totals']['fsync']['wallNs']+200_000_000)
        self.assertGreater(ptrace['totals']['ptrace']['wallNs'],plain['totals']['ptrace']['wallNs']+200_000_000)
        self.assertGreater(stepped['totals']['ptrace']['calls'],plain['totals']['ptrace']['calls']*5)

    def test_bounded_retention_and_errors_do_not_become_success(self):
        run=OUT/'bounds';run.mkdir()
        service=bounded.StartupService(run);service.MAX_RECORDS=2
        for i in range(10):service.call('test',lambda:None)
        self.assertEqual(len(service.rows),2);self.assertEqual(service.dropped,8)
        def fail():raise OSError('service failure')
        with self.assertRaisesRegex(OSError,'service failure'):service.call('failing',fail)
        self.assertEqual(service.totals['failing']['calls'],1)
        service.close()
        self.assertEqual(json.loads((run/'startup-service.json').read_text())['dropped'],9)


if __name__=='__main__':unittest.main(verbosity=2)

"""Execute the generated inspection with live and terminal case files."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location(
    'inspection', Path(__file__).with_name('lbreakout-case-inspection.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class InspectionTests(unittest.TestCase):
    def test_unobserved_paddle_pulses_refuse_before_any_effect(self):
        source = "const assert=require('node:assert/strict');\n" + helper.paddle_key_admission_source() + """
let effects=0;
function execute(c){assertPaddleCompletion(c);effects++;}
for(const key of ['ArrowLeft','ArrowRight']){
 for(const observe of [false,true]){
  assert.throws(()=>execute({action:'key',key,observe}),/guest-completion observer/);
  assert.equal(effects,0);
 }
}
for(const key of ['ArrowLeft','ArrowRight','Space']){
 assert.throws(()=>execute({action:'play',key}),/guest-completion observer/);
 assert.equal(effects,0);
}
for(const key of ['p','Space','Enter','ArrowDown','ArrowUp'])execute({action:'key',key});
execute({action:'capture'});execute({action:'quit'});assert.equal(effects,7);
for(const key of ['ArrowLeft','ArrowRight']){
 const c={id:'paddle',action:'key',key,observe:true,completion:'paddle',reviewRef:'ready',holdMs:100};
 execute(c);
 for(const bad of [{observe:false},{holdMs:0},{holdMs:301},{reviewRef:null},{id:null}])
  assert.throws(()=>execute({...c,...bad}),/guest-completion observer/);
}
assert.throws(()=>execute({action:'key',key:'Space',completion:'paddle'}),/one original direction/);
"""
        subprocess.run(['node', '-e', source], check=True, timeout=3)

    def test_pause_template_drift_is_offline_error(self):
        with self.assertRaisesRegex(ValueError, 'unsupported bound browser'):
            helper.pause_workflow_source('unrecognized caller')
        with self.assertRaisesRegex(ValueError, 'unsupported completion template'):
            helper.pause_completion_source('unrecognized caller')

    def test_generated_completion_preload_parses(self):
        subprocess.run(['node', '--check', '-'],
                       input=helper.pause_completion_preload_source(),
                       text=True, check=True, timeout=3)

    def test_generated_preload_preserves_native_unarmed_execution(self):
        source = """const assert=require('node:assert/strict');
let calls=0;const nativeRun=n=>{calls++;return n+7;};
const native={exports:{run:nativeRun,get_last_run_blocks:()=>3,get_last_run_halt:()=>1}};
const WebAssembly={instantiate:async()=>({instance:native,module:'same module'})};
""" + helper.pause_completion_preload_source() + """
(async()=>{
 const imports={host:{memory:{buffer:new ArrayBuffer(16)}}};
 const r=await WebAssembly.instantiate('same bytes',imports);
 assert.equal(r.module,'same module');assert.equal(r.instance.exports.run,nativeRun);
 assert.equal(r.instance.exports.run(11),18);assert.equal(calls,1);
 assert.equal(globalThis.__lbNative.instance,r.instance);
 assert.equal(globalThis.__lbObserver,undefined);
 assert.equal(r.instance.exports.set_trace_eip_range,undefined);
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        subprocess.run(['node', '-e', source], check=True, timeout=3)

    def test_completion_keeps_module_transfer_outside_presentation_budget(self):
        # Exercise the emitted functions, including arm-time full validation.
        template = "\n".join([
            "async function armObservation(){const s=await owningWorker();return evaluate('globalThis.__lbArm()',s);}",
            "if(c.observe){save('observer-arm-'+c.id+'.json',await armObservation());}",
            "     const k=require('./input.cjs').key('p'),{text,...release}=k;",
            "save:r=>save('input-'+c.id+'-'+phase+'.json',r)});",
            "   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});",
        ])
        emitted = helper.pause_completion_source(template).split("\nlet completionArm;")[0]
        source = """const assert=require('node:assert/strict');
const owner={instance:'immutable',endpointIdentity:'endpoint'},binding={exe:123};
const bound={WORKER_READ:'identity'},workers=new Map([['owner',{closed:false}]]);
let terminal=false,full=0,presented=false;const deadline=Date.now()+2000;
async function owningWorker(){assert.equal(++full,1,'redundant full-module service');return 'owner';}
async function evaluate(s){
 if(s==='identity')return owner;
 if(s.startsWith('globalThis.__lbArm('))return {armed:true,token:'test-pause',deadline,binding};
 if(s==='globalThis.__lbObserver.snapshot()')return {token:'test-pause',expected:20,binding,active:false,reason:'complete'};
 assert(s.startsWith('new Promise('));presented=true;return {presented:true};
}
function save(){}function fail(e){terminal=true;}async function wait(){}
""" + emitted + """
(async()=>{const a=await armObservation({id:'test',phase:'pause',expected:20});
 await completion(a);assert.equal(full,1);assert(presented);assert(!terminal);
 workers.get('owner').closed=true;presented=false;
 await assert.rejects(completion(a),/owner closed/);assert(terminal);assert(!presented);
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        subprocess.run(['node', '-e', source], check=True, timeout=3)

    def test_observer_selects_bound_owner_among_secondary_threads(self):
        source = """const assert=require('node:assert/strict');
const workers=new Map([['owner',{targetId:'main',url:'guest-worker.js'}],
 ['secondary-1',{targetId:'thread-1',url:'guest-worker.js'}],
 ['secondary-2',{targetId:'thread-2',url:'guest-worker.js'}]]);
const chain={readLive:async()=>({worker:{sessionId:'owner'},identity:{workerTarget:'main'}})};
""" + helper.owning_worker_source() + """
(async()=>{
 assert.equal(await owningWorker(),'owner');
 workers.get('owner').closed=true;
 await assert.rejects(owningWorker(),/live bound/);
 workers.get('owner').closed=false;workers.get('owner').targetId='foreign';
 await assert.rejects(owningWorker(),/bound owning Worker target/);
 workers.delete('owner');await assert.rejects(owningWorker(),/live bound/);
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        subprocess.run(['node', '-e', source], check=True, timeout=3)

    def test_separate_resume_requires_reviewed_pause_before_arming(self):
        template = "\n".join([
            "async function armObservation(){const s=await owningWorker();return evaluate('globalThis.__lbArm()',s);}",
            "if(c.observe){save('observer-arm-'+c.id+'.json',await armObservation());}",
            "     const k=require('./input.cjs').key('p'),{text,...release}=k;",
            "save:r=>save('input-'+c.id+'-'+phase+'.json',r)});",
            "   }else await pulse({down,up,deadline,onFailure:fail,holdMs:c.holdMs??100,save:r=>save('input-'+c.id+'-pulse.json',r)});",
        ])
        branch = helper.pause_completion_source(template).split(
            'let completionArm;')[1].split('     const a=await armObservation')[0]
        source = """const assert=require('node:assert/strict');
let arms=0;const latest={label:'visible-pause'};
async function armObservation(c){arms++;return c;}
async function run(c){let completionArm;
""" + branch + """
return completionArm;}
(async()=>{
 const c={action:'key',key:'p',expected:8};
 await assert.rejects(run(c),/reviewed visible pause/);assert.equal(arms,0);
 await assert.rejects(run({...c,pauseConfirmed:'foreign'}));assert.equal(arms,0);
 await assert.rejects(run({...c,expected:9}));assert.equal(arms,0);
 const resume=await run({...c,pauseConfirmed:'visible-pause'});
 assert.equal(resume.expected,8);assert.equal(arms,1);
 const pause=await run({action:'key',key:'p'});
 assert.equal(pause.expected,20);assert.equal(arms,2);
})().catch(e=>{console.error(e);process.exitCode=1});
"""
        subprocess.run(['node', '-e', source], check=True, timeout=3)

    def test_case_specific_generated_consumer(self):
        for case in ('fixture', 'original'):
            with self.subTest(case=case), tempfile.TemporaryDirectory() as root:
                run = Path(root) / 'run'
                out = run / case
                out.mkdir(parents=True)
                (out / 'latest.json').write_text('{"label":"startup"}')
                other = 'original' if case == 'fixture' else 'fixture'
                (run / (other + '.log')).write_text('foreign case')

                def inspect():
                    source = helper.inspection_source(root, 'run', case)
                    return json.loads(subprocess.check_output(
                        [sys.executable, '-c', source], text=True))

                live = inspect()
                self.assertFalse(live['logAvailable'])
                self.assertIsNone(live['output'])
                self.assertEqual(live['terminal'], {})
                self.assertEqual(live['latest']['label'], 'startup')
                (run / (case + '.log')).write_text('own case')
                self.assertEqual(inspect()['output'], 'own case')
                (run / (case + '.log')).unlink()
                (out / 'first-browser-failure.json').write_text('{"error":"stop"}')
                wait = 'fixture-launcher' if case == 'fixture' else 'launcher'
                (run / (wait + '-wait.json')).write_text('{"actualWait":true}')
                terminal = inspect()
                self.assertFalse(terminal['logAvailable'])
                self.assertEqual(terminal['terminal']['first-browser-failure.json']['error'], 'stop')
                self.assertTrue(terminal['terminal']['launcherWait']['actualWait'])

    def test_foreign_case_refused_before_generation(self):
        with self.assertRaises(ValueError):
            helper.inspection_source('/unused', 'run', '../other')


class HandoffTests(unittest.TestCase):
    def test_real_close_delayed_wait_and_separate_eof_before_original(self):
        with tempfile.TemporaryDirectory() as root:
            run = Path(root) / 'run'
            (run / 'fixture').mkdir(parents=True)
            # The real child receives close, then takes time to exit. A pipe
            # inheritor keeps stderr open even after the direct child exits.
            child = """import pathlib,time,subprocess,sys
r=pathlib.Path('run')
while not (r/'close-request').exists():time.sleep(.01)
(r/'fixture/cleanup.json').write_text('{"closed":true}')
time.sleep(.15)
subprocess.Popen([sys.executable,'-c','import time;time.sleep(.3)'],stdout=subprocess.DEVNULL)
"""
            parent = subprocess.Popen([sys.executable, '-c', helper.launcher_source(
                root, 'run', 'fixture', [sys.executable, '-c', child])])
            try:
                close = [sys.executable, '-c',
                         "from pathlib import Path;Path('run/close-request').touch()"]
                (run / 'lifecycle.json').write_text('{"browserDeadline":1794271910767}')
                original = "import os;from pathlib import Path;assert os.environ['BROWSER_DEADLINE']=='1794271910767';assert os.environ['CASE_TAG']=='original';Path('run/original-created').touch()"
                source = helper.original_workflow_source(root, 'run', [sys.executable,'-c',original], close, 3)
                gate = subprocess.Popen([sys.executable, '-c', source], stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, text=True)
                due = time.monotonic() + 3
                while not (run / 'fixture-launcher-wait.json').exists():
                    self.assertFalse((run / 'original-created').exists())
                    self.assertLess(time.monotonic(), due)
                    time.sleep(.01)
                self.assertFalse((run / 'fixture-launcher-stderr-eof.json').exists())
                self.assertFalse((run / 'original-created').exists())
                out, err = gate.communicate(timeout=4)
                self.assertEqual(gate.returncode, 0, err)
                self.assertTrue(json.loads(out)['separateEOF'])
                parent.wait(timeout=3)
                for _ in range(100):
                    if (run / 'original-created').exists():break
                    time.sleep(.01)
                self.assertTrue((run / 'original-created').exists())
                for _ in range(100):
                    if (run / 'launcher-stderr-eof.json').exists() and (run / 'launcher-wait.json').exists():break
                    time.sleep(.01)
                self.assertEqual(json.loads((run / 'launcher-wait.json').read_text())['code'],0)
                wait = json.loads((run / 'fixture-launcher-wait.json').read_text())
                for stream in ('stdout', 'stderr'):
                    eof = json.loads((run / ('fixture-launcher-'+stream+'-eof.json')).read_text())
                    self.assertEqual(eof['pid'], wait['pid'])
                    self.assertTrue(eof['eof'])
            finally:
                if parent.poll() is None:parent.kill();parent.wait()

    def test_full_generated_gate_negatives_never_create_original(self):
        negatives = ['cleanup-missing', 'wait-missing', 'wait-false', 'wait-failed',
                     'stdout-missing', 'stderr-missing', 'eof-false', 'eof-foreign-pid',
                     'cleanup-failed', 'browser-failure', 'transport-failure']
        for negative in negatives:
            with self.subTest(negative=negative), tempfile.TemporaryDirectory() as root:
                run = Path(root) / 'run'
                (run / 'fixture').mkdir(parents=True)
                def put(name, value):
                    (run / name).write_text(json.dumps(value))
                put('fixture/cleanup.json', {'closed':True})
                put('fixture-launcher-wait.json', {'pid':123,'actualWait':True,'code':0})
                for stream in ('stdout','stderr'):
                    put('fixture-launcher-'+stream+'-eof.json', {'pid':123,'eof':True,'stream':stream})
                missing = {'cleanup-missing':'fixture/cleanup.json',
                           'wait-missing':'fixture-launcher-wait.json',
                           'stdout-missing':'fixture-launcher-stdout-eof.json',
                           'stderr-missing':'fixture-launcher-stderr-eof.json'}
                if negative in missing:(run / missing[negative]).unlink()
                if negative == 'wait-false':put('fixture-launcher-wait.json', {'actualWait':False,'code':0})
                if negative == 'wait-failed':put('fixture-launcher-wait.json', {'actualWait':True,'code':7})
                if negative == 'eof-false':put('fixture-launcher-stderr-eof.json', {'pid':123,'eof':False,'stream':'stderr'})
                if negative == 'eof-foreign-pid':put('fixture-launcher-stderr-eof.json', {'pid':456,'eof':True,'stream':'stderr'})
                if negative == 'cleanup-failed':put('fixture/cleanup.json', {'closed':False})
                if negative == 'browser-failure':put('fixture/first-browser-failure.json', {'error':'dead'})
                if negative == 'transport-failure':put('fixture/first-failure.json', {'error':'refused'})
                source = helper.original_workflow_source(root, 'run',
                    [sys.executable,'-c',"from pathlib import Path;Path('run/original-created').touch()"], timeout=.1)
                p = subprocess.run([sys.executable, '-c', source], capture_output=True, text=True, timeout=3)
                self.assertNotEqual(p.returncode, 0)
                self.assertFalse((run / 'original-created').exists())
                self.assertFalse((run / 'original-parent.json').exists())

    def test_original_generated_parent_reports_actual_wait_and_eof(self):
        with tempfile.TemporaryDirectory() as root:
            run = Path(root) / 'run';run.mkdir()
            source = helper.launcher_source(root, 'run', 'original',
                [sys.executable, '-c', "import sys;print('out');print('err',file=sys.stderr)"])
            subprocess.run([sys.executable, '-c', source], check=True, timeout=3)
            self.assertEqual((run/'original.log').read_text(), 'out\n')
            self.assertEqual((run/'original-stderr.log').read_text(), 'err\n')
            self.assertEqual(json.loads((run/'launcher-wait.json').read_text())['code'], 0)
            for stream in ('stdout','stderr'):
                self.assertTrue(json.loads((run/('launcher-'+stream+'-eof.json')).read_text())['eof'])


if __name__ == '__main__':
    unittest.main()

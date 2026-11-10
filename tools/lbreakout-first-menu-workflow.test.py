"""Check the shipped title caller composes startup before reviewed gameplay."""
import importlib.util
import pathlib
import sys
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('inspection', ROOT / 'tools/lbreakout-case-inspection.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class FirstMenuWorkflow(unittest.TestCase):
    def test_deadline_retains_last_observation_without_later_protocol(self):
        source = (pathlib.Path(sys.argv[1]) / 'browser-corrected.cjs').read_text()
        start = source.index('async function completion(a)')
        end = source.index('async function bindReady()', start)
        control = r'''
const assert=require('node:assert/strict'),vm=require('node:vm');
let clock=0,reads=0,receipt;
const owner={instance:'original'},observation={token:'startup-startup',expected:0,binding:{generation:1},active:true,phase:'sdl-display-return',lastPC:0x6108fa};
const scope={assert,Date:{now:()=>clock},deadline:2000,terminal:false,
 workers:new Map([['owner',{closed:false}]]),bound:{WORKER_READ:'owner'},
 evaluate:async s=>{assert(!scope.terminal);reads++;return s==='owner'?owner:observation;},
 wait:async()=>{clock=2000;},save:(name,value)=>{receipt={name,value};},fail:()=>{scope.terminal=true;}};
vm.createContext(scope);
vm.runInContext(SOURCE+';globalThis.finish=completion;',scope);
(async()=>{
const arm={session:'owner',owner,token:observation.token,expected:0,binding:observation.binding,deadline:2000};
await assert.rejects(scope.finish(arm),/guest completion deadline/);
assert.equal(receipt.name,'completion-failure-startup-startup.json');
assert.equal(receipt.value.lastObservation,observation);
assert.equal(receipt.value.lastObservation.phase,'sdl-display-return');
assert.equal(reads,2);
await assert.rejects(scope.finish(arm),/terminal/);assert.equal(reads,2);
assert.equal(receipt.value.lastObservation,observation,'terminal reuse preserves first failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
'''
        import json
        subprocess.run(['node', '-e', 'const SOURCE=' + json.dumps(source[start:end]) + ';' + control], check=True)

    def test_actual_generated_caller(self):
        run = pathlib.Path(sys.argv[1])
        actual = (run / 'browser-corrected.cjs').read_text()
        base = (ROOT / 'scratch/runs/20261110-lbreakout-bound-owner-gameplay-0045/browser-corrected.cjs').read_text()
        base = helper.pause_workflow_source(base).replace(
            "await wait(3000);await capture('startup');",
            "await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({presented:true}))))');await capture('startup');")
        self.assertEqual(actual, helper.startup_workflow_source(base))
        arm = actual.index("phase:'startup',expected:0")
        self.assertLess(arm, actual.index("await completion(a);", arm))
        self.assertLess(arm, actual.index("await capture('startup')"))
        self.assertIn("c.completion==='level-start'", actual)
        self.assertIn('assertPaddleCompletion(c)', actual)
        self.assertIn('pauseConfirmed', actual)
        with self.assertRaises(ValueError):
            helper.startup_workflow_source(actual)


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]], verbosity=2)

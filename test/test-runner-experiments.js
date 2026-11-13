'use strict';

const assert = require('assert');
const { createRunnerExperiments } = require('./runner-experiments');

function config(args) {
  const env = {}, messages = [];
  const experiments = createRunnerExperiments({
    hasFlag: name => args.includes(`--${name}`),
    getArg: (name, fallback = null) => {
      const hit = args.find(arg => arg.startsWith(`--${name}=`));
      return hit ? hit.slice(name.length + 3) : fallback;
    }, env, log: (...args) => messages.push(args.join(' ')),
  });
  return { experiments, env, messages };
}

function settings(experiments, copySuperops = false) {
  const calls = [], inherited = {};
  const exports = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]) });
  experiments.applyMain({ exports }, { copySuperops });
  experiments.recordInherited((name, ...args) => { inherited[name] = args; },
    { copySuperops, verbose: false });
  return { calls, inherited };
}

// The x87 folds are the one default-on setting the runner writes explicitly
// (the module global defaults to 0); --no-x87-fusion leaves them untouched.
const defaults = config([]);
assert.deepStrictEqual(settings(defaults.experiments).calls,
  [['set_x87_pipeline4_fusion', 1], ['set_x87_affine_fusion', 1]]);
assert.deepStrictEqual(defaults.env, {});
assert.deepStrictEqual(settings(config(['--no-x87-fusion']).experiments).calls, []);
const flags = config(['--loop-superops', '--no-loop-superops', '--lut-superops', '--no-lut-superops',
  '--copy-superops', '--no-copy-superops', '--tree-fold', '--trace-tree-fold', '--trace-loopmatch=0x1234',
  '--block-exec-region-max=8', '--no-block-exec-regions', '--tree-fold-min-ops=0',
  '--page-desc-rg-reserve=0', '--x87-fusion', '--alu8-sib', '--implode-cmp-run']);
const result = settings(flags.experiments, true);
assert.strictEqual(flags.env.DBG_INV, '1');
assert.strictEqual(flags.messages.length, 1);
assert.match(flags.messages[0], /deprecated/);
for (const expected of [['set_loop_emit', 0], ['set_loop_lut_emit', 0], ['set_loop_copy_emit', 0],
  ['set_block_exec', 1], ['set_block_exec_regions', 0], ['set_tree_fold_min_ops', 0],
  ['set_page_desc_rg_reserve', 0], ['set_alu8_sib', 1], ['set_implode_cmp_run', 1],
  ['set_x87_pipeline4_fusion', 1], ['set_x87_affine_fusion', 1], ['set_loop_trace', 1, 0x1234]]) {
  assert.deepStrictEqual(result.calls.filter(call => call[0] === expected[0]).at(-1), expected);
  assert.deepStrictEqual(result.inherited[expected[0]], expected.slice(1));
}
// Optional exports allow older pinned artifacts to keep working.
flags.experiments.applyMain({ exports: {} }, { copySuperops: false });
flags.experiments.report({ exports: {} }, null, false, () => assert.fail('unexpected report'));

// Main and cooperative-worker counters must both be reported, preserving labels.
const reporting = config(['--loopmatch-stats']).experiments;
function loopExports(n) {
  return { get_loop_selfloop_blocks: () => n, get_loop_matched_blocks: () => 0 };
}
const lines = [];
reporting.report({ exports: loopExports(7) },
  { threads: new Map([[1, { tid: 1, instance: { exports: loopExports(11) } }]]) },
  false, (...args) => lines.push(args.join(' ')));
assert(lines.some(line => line.includes('M ') && line.includes('7')));
assert(lines.some(line => line.includes('T1') && line.includes('11')));
console.log('PASS runner experiments: defaults, overrides, worker inheritance, optional exports, per-thread reports');

(async()=>{
  for(const args of [[],['--no-x87-fusion'],['--no-uop-retry-ladder','--uop-icg-mega=3'],
    ['--loop-superops','--no-loop-superops','--tree-fold-min-ops=0','--no-rle-run']]){
    const sync=config(args).experiments,asyncConfig=config(args).experiments;
    const expected=[],actual=[];
    sync.applyMain({exports:new Proxy({}, {get:(_,name)=>(...values)=>expected.push([name,...values])})},
      {copySuperops:true,ctx:{}});
    await asyncConfig.applyMainOwned({supports:()=>true,call:async(name,...values)=>{
      await Promise.resolve();actual.push([name,...values]);
    }},{copySuperops:true,ctx:{}});
    assert.deepStrictEqual(actual,expected,'identical order and zero-valued overrides: '+args);
  }
  let resume;
  const calls=[];
  const pending=config([]).experiments.applyMainOwned({supports:()=>true,call:(name,...values)=>{
    calls.push([name,...values]);
    if(calls.length===1)return new Promise(resolve=>{resume=resolve;});
  }},{copySuperops:false});
  assert.strictEqual(calls.length,1,'second setting cannot overtake a pending first setting');
  resume();await pending;assert.strictEqual(calls.length,2);
  let attempts=0;
  const failing=config([]).experiments;
  await assert.rejects(failing.applyMainOwned({supports:()=>true,call:async()=>{
    attempts++;throw new Error('owner failed');
  }},{copySuperops:false,ctx:{}}),/owner failed/);
  assert.strictEqual(attempts,1,'failure prevents later settings');
  assert.doesNotThrow(()=>failing.report({exports:{}},null,false,()=>{}),
    'failed application does not publish enabled uop reporting state');
  await config([]).experiments.applyMainOwned({supports:()=>false,call:()=>assert.fail('absent optional export called')},
    {copySuperops:false,ctx:{}});
  await assert.rejects(config([]).experiments.applyMainOwned({
    supports:name=>name==='set_x87_pipeline4_fusion',call:()=>assert.fail('partial configuration before validation'),
  },{copySuperops:false}),/missing required experiment export: set_x87_affine_fusion/);
  console.log('PASS owned experiments: local parity, ordered awaits, absent exports and failure propagation');
})().catch(error=>{console.error(error);process.exitCode=1;});

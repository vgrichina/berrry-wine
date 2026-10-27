'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const watx = require('../tools/watx.js');
const {compileClosure} = require('../tools/watx-closure.js');
const {applyToVfs} = require('../lib/dispatch-trampoline.js');
const evidenceArg = process.argv.find(x => x.startsWith('--evidence='));
const fixtureArg = process.argv.find(x => x.startsWith('--frontend-fixture='));
// Preload the actual production entry point with a portable SMALL source closure.
// No transform/compiler/result is stubbed. CLI validation and file writes run.
if (require.main !== module && fixtureArg) {
  const fixture = JSON.parse(fs.readFileSync(fixtureArg.split('=')[1]));
  require('../tools/watx-closure.js').watxSourceClosure = () => ({...fixture, vfs:new Map(fixture.vfs)});
  if (fixture.noReuse) process.env.WINE_WAT_FRONTEND_REUSE = '0';
  const create = watx.createFrontendReuse;
  watx.createFrontendReuse = () => {
    const reuse = create();
    process.on('exit', () => fs.writeFileSync(fixture.stats, JSON.stringify(reuse.stats())));
    return reuse;
  };
} else if (require.main === module) {
  const out = evidenceArg ? path.resolve(evidenceArg.slice(11)) : fs.mkdtempSync('/tmp/watx-reuse-');
  fs.mkdirSync(out,{recursive:true});
  const {spawnSync} = require('child_process');
  // Existing fixture syntax: macro-body, production, and regions suites; the
  // minimal trampoline closure retains every real production transform anchor.
  const files = {
    'common.wat': '(type $handler_t (func (param i32)))\n(table 1 funcref)\n(memory 1)\n(region.declare-fixed $A (base 0x1000) (size 64))\n(func $value (export "value") (result i32) (i32.const 11))',
    '04-cache.wat': '(defmacro (dispatch-next)\n(return_call_indirect (type $handler_t) (local.get $nx_op) (local.get $nx_fn)))\n  (func $next\n    (local $nx_fn i32) (local $nx_op i32)\n    (dispatch-next))\n',
    '13-exports.wat': '(func $run (call $next)\n)\n(func $run2 (call $next)\n)',
    '07c-block-exec.wat': '(func $block (param $imm i32) (param $a i32)\n(call_indirect (type $handler_t)\n                (local.get $imm) (local.get $a))\n(call_indirect (type $handler_t)\n                (local.get $imm) (local.get $a)))',
  };
  const closure = {entry:'fixture.watx',source:Object.keys(files).map(f=>`(include "${f}")`).join('\n'),vfs:new Map()};
  for (const [f,text] of Object.entries(files)) for (const alias of [f,`src/${f}`,`./${f}`]) closure.vfs.set(alias,text);
  // Byte-exact banner fixture from watx-compiler-production.test.js, decoded
  // through the real source boundary before either compile mode sees it.
  closure.source += '\n' + watx.sourceTextFromBytes(Buffer.from(
    ';; ══ banner ══\n(func $f (export "f") (result i32) (effects) (i32.const 7))\n', 'utf8'));
  const portable = {...closure,vfs:[...closure.vfs]};
  fs.writeFileSync(path.join(out,'fixture.json'), JSON.stringify(portable,null,2));
  function cli(label, noReuse, extraSource = '') {
    const config = path.join(out,`${label}.fixture.json`), stem=path.join(out,label);
    fs.writeFileSync(config,JSON.stringify({...portable,source:closure.source+extraSource,noReuse,stats:stem+'.stats.json'}));
    const r=spawnSync(process.execPath,['--max-old-space-size=512','--require',__filename,path.join(ROOT,'tools/build-compile-wat.js'),`--frontend-fixture=${config}`,`--out=${stem}.wasm`,'--names'],{cwd:ROOT,encoding:'utf8',maxBuffer:1024*1024});
    fs.writeFileSync(stem+'.stdout',r.stdout||'');fs.writeFileSync(stem+'.stderr',r.stderr||'');
    fs.writeFileSync(stem+'.status.json',JSON.stringify({status:r.status,signal:r.signal,error:r.error?.message}));
    return r;
  }
  // FIRST behavioral checkpoint is the real CLI, with independent mode compile,
  // actual compatibility overlay, layout stamp, names and native validation.
  const a=cli('baseline',true), b=cli('candidate',false);
  assert.strictEqual(a.status,0,a.stderr);assert.strictEqual(b.status,0,b.stderr);
  for(const suffix of ['.wasm','.compat.wasm','.named.wasm']) assert.deepStrictEqual(fs.readFileSync(path.join(out,'baseline'+suffix)),fs.readFileSync(path.join(out,'candidate'+suffix)));
  const ea=cli('baseline-error',true,'\n(include "missing.wat")'),eb=cli('candidate-error',false,'\n(include "missing.wat")');
  assert.strictEqual(ea.status,1);assert.strictEqual(eb.status,1);assert.strictEqual(ea.stderr,eb.stderr);
  const compat={...closure,vfs:applyToVfs(new Map(closure.vfs))};
  assert.notStrictEqual(compat.vfs.get('04-cache.wat'),closure.vfs.get('04-cache.wat'));
  const reuse=watx.createFrontendReuse();
  let checks=0;
  function compare(c,options={}) {
    const base=compileClosure(c,options), candidate=compileClosure(c,{...options,frontendReuse:reuse});
    assert.deepStrictEqual(candidate,base);checks++;
    return candidate;
  }
  for(const tailCalls of [true,false,false,true,true,false]) compare(tailCalls?closure:compat,{tailCalls});
  const statsBefore=reuse.stats();
  for(const tailCalls of [false,true]) compare(tailCalls?closure:compat,{tailCalls});
  assert.strictEqual(reuse.stats().scans,statsBefore.scans);assert(reuse.stats().hits>statsBefore.hits);
  for(const nameSection of [undefined,'fixture']) for(const regionShake of [undefined,'reverse']) for(const tailCalls of [false,true]) compare(tailCalls?closure:compat,{tailCalls,nameSection,regionShake});
  const cases=[
    ['changed include',{source:'(include "common.wat")',vfs:new Map([['common.wat',files['common.wat'].replace('11','12')]])}],
    ['alias',{source:'(include "./common.wat")',vfs:closure.vfs}],
    ['independent alias text',{source:'(include "src/common.wat")',vfs:new Map([['src/common.wat','(func $different)']])}],
    ['missing include',{source:'\n(include "absent")',vfs:new Map()}],
    ['duplicate',{source:'\n(func $dup)\n(func $dup)',vfs:new Map()}],
    ['macro',{source:'(global $g (mut i32) (i32.const 0))\n(defmacro (bump) (global.set $g (i32.const 1)) (global.set $g (i32.const 11)))\n(func $f (bump))',vfs:new Map()}],
    ['syntax',{source:'(include "broken")',vfs:new Map([['broken','\n(func $x']])}],
    ['same bad text different filename',{source:'(include "other")',vfs:new Map([['other','\n(func $x']])}],
    ['location after comment',{source:'(include "broken")',vfs:new Map([['broken',';; moved\n\n(func $x']])}],
    ['type error',{source:'\n(func $bad (call $missing))',vfs:new Map()}],
  ];
  for(const [label,c] of [...cases,...cases.slice().reverse()]) for(const tailCalls of [false,true]) compare(c,{tailCalls});
  const mutable={source:'(include "mutable")',vfs:new Map()};
  for(const text of [null,'(func $before)','(func $after)',null,'(func $before)']) {
    if(text===null) mutable.vfs.delete('mutable'); else mutable.vfs.set('mutable',text);
    for(const tailCalls of [true,false]) compare(mutable,{tailCalls});
  }
  // Equal text under distinct include aliases still participates twice in
  // declaration checking; cached lexical ranges cannot deduplicate includes.
  for(const tailCalls of [true,false]) compare({source:'(include "common.wat")\n(include "./common.wat")',vfs:closure.vfs},{tailCalls});
  // Rejecting control: filename-only reuse loses the newly added second form.
  const unsafe=new Map();const bad={index(source,filename){if(!unsafe.has(filename))unsafe.set(filename,watx.createFrontendReuse().index(source,filename));return unsafe.get(filename);}};
  const first={source:'(func $one)',vfs:new Map()},changed={source:'(func $one)\n(func $two)',vfs:new Map()};
  compileClosure(first,{frontendReuse:bad});
  assert.throws(()=>assert.deepStrictEqual(compileClosure(changed,{frontendReuse:bad}),compileClosure(changed)),assert.AssertionError);
  const frozen=reuse.index('(func $frozen)','freeze');assert(Object.isFrozen(frozen)&&Object.isFrozen(frozen[0]));assert.throws(()=>{frozen[0].start=99;},TypeError);
  // Same actual scanner stage: fresh per-call scopes vs one shared scope.
  const workload=[closure,compat,compat,closure];let coldScans=0,coldUnits=0;
  for(const c of workload){const cold=watx.createFrontendReuse();compileClosure(c,{tailCalls:c===closure,frontendReuse:cold});coldScans+=cold.stats().scans;coldUnits+=cold.stats().codeUnits;}
  const warm=watx.createFrontendReuse();for(const c of workload)compileClosure(c,{tailCalls:c===closure,frontendReuse:warm});
  assert(warm.stats().scans<coldScans&&warm.stats().codeUnits<coldUnits);
  const bench=[];
  for(const enabled of [false,true,true,false]){
    const before=process.cpuUsage(),start=process.hrtime.bigint(),scope=enabled?watx.createFrontendReuse():null;
    for(let i=0;i<12;i++)for(const c of [closure,compat])compileClosure(c,{tailCalls:c===closure,frontendReuse:scope});
    bench.push({enabled,cpu:process.cpuUsage(before),wallMs:Number(process.hrtime.bigint()-start)/1e6,memory:process.memoryUsage(),maxRSSKiB:process.resourceUsage().maxRSS});
  }
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({checks,cli:'exact bytes tail/compat/names + exact failure stderr',cases:cases.map(x=>x[0]),work:{coldScans,coldUnits,warm:warm.stats()},bench,limitations:'Tiny fixtures only; in-process memory samples/cumulative peak; no full build savings established.'},null,2));
  console.log(JSON.stringify({pass:true,checks,work:{coldScans,coldUnits,warm:warm.stats()}}));
}

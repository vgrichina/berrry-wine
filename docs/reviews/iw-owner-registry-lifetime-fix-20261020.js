'use strict';
// Replays the pinned 89 checks / five rejecting controls and all 67
// independent checks. Only fixture linkage changes for the new exports and
// shared region; the six defect oracles now require the accepted result.
const fs = require('fs'), cp = require('child_process'), path = require('path'), assert = require('assert/strict');
const repo = path.resolve(process.argv[2] || '.');
const candidate = 'ac72debe7522d4d57034627712b8ec000f8e1d92';
const review = 'a56f9b6014a939fdf08c22e9dfd877f734e6d9fb';
const object = (rev, file) => cp.execFileSync('git', ['show', rev + ':' + file], {cwd: repo, encoding: 'utf8'});
let original = object(candidate, 'docs/reviews/iw-lookup-lifecycle-corrections-20261020.js');
function replace(from, to) {
  assert(original.includes(from), 'fixture linkage anchor ' + from);
  original = original.replace(from, to);
}
replace("'wnd_slot_reset','wnd_table_remove','wnd_lookup_live','wnd_lookup_retire'",
  "'wnd_slot_reset','wnd_table_remove','wnd_lookup_live','wnd_lookup_retire','wnd_lookup_generation'");
replace("if (n==='zero_memory' || n==='win16_h16_forget_window') argc=2;",
  "if (n==='zero_memory' || n==='win16_h16_forget_window' || n==='host_set_window_class') argc=2;");
replace("'wnd_lookup_live','wnd_lookup_retire','wnd_lookup_retired','wnd_lookup_slot'",
  "'wnd_lookup_live','wnd_lookup_retire','wnd_lookup_retired','wnd_lookup_slot','wnd_lookup_generation','wnd_lookup_class','wnd_lookup_class_wide','wnd_lookup_title'");
original = original.replaceAll(
  '(region.declare-fixed $WND_LOOKUP_RETIRED (base 8448) (size 256) (align 16))',
  '(region.declare-fixed $WND_LOOKUP_RETIRED (base 8448) (size 256) (align 16))\n' +
  '(region.declare-fixed $WND_LOOKUP_GENERATIONS (base 16000) (size 2056) (align 8))');
replace("const reset = fn(table, 'wnd_slot_reset').split('\\n')[1];",
  "const reset = fn(table, 'wnd_slot_reset').split('(call $wnd_z_reset_slot')[0].split('\\n').slice(1).join('\\n');");
replace('function lifetimeFixture(mutation = false)', 'function lifetimeFixture(mutation = false, notify = null)');
replace("trace.push([n,...args]);", "trace.push([n,...args]); if(n==='host_set_window_class' && notify) notify(...args);");
replace("function fixture(mutation = '')", "let registryHostModule;\nfunction fixture(mutation = '')");
replace("const hostModule = {exports: {}};", "const sharedRegistry = mutation.startsWith('registry');\n  const hostModule = sharedRegistry && registryHostModule || {exports: {}};");
replace("vm.runInNewContext(hostText, {module: hostModule, console: {log() {}}, process: {env: {}}});", `
  if (mutation === 'registry-disabled') hostText = hostText.replace('if (c.renderer === ctx.renderer)', 'if (false)');
  if (mutation === 'no-generation') hostText = hostText.replace(
    'life.owner.wnd_lookup_generation(w.hwnd) === life.generation', 'true');
  if (mutation === 'no-invalidation') hostText = hostText.replace(
    'win._lookupLifetime = {owner, generation, invalid: true};', 'void owner;');
  if (!sharedRegistry || !registryHostModule) vm.runInNewContext(hostText,
    {module: hostModule, console: {log() {}}, process: {env: {}}});
  if (sharedRegistry) registryHostModule = hostModule;`);
let independent = object(review, 'docs/reviews/iw-lifecycle-repair-acceptance-20261020.js');
independent = independent.slice(independent.indexOf('function independent(){'), independent.indexOf('\nconst run='));
independent = independent.replace(
  "assert.notEqual(actual,expected,label+' must reproduce');defects.push({label,actual,expected});",
  "assert.equal(actual,expected,label+' must be corrected');defects.push({label,actual,expected,corrected:true});");
independent = independent.replace("['CLASS_NAME_WIDE','WND_LOOKUP_RETIRED']", "['CLASS_NAME_WIDE','WND_LOOKUP_GENERATIONS','WND_LOOKUP_RETIRED']");
independent = independent.replace("eq('candidate layout hash',current.LAYOUT_HASH,'466744875737f2d2');",
  "eq('generation region size',current.REGIONS.WND_LOOKUP_GENERATIONS.size,2056);");
function focused() {
  const start = results.length;
  function registryCase(mutation) {
    registryHostModule = null;
    const a = fixture(mutation), b = fixture(mutation);
    a.ctx.renderer = b.ctx.renderer;
    b.add(810, 'HiddenParent', 0, false, 1);
    b.add(811, 'HiddenWideChild', 810, false, 1);
    a.add(820, 'CallerTop', 0, false);
    assert.equal(a.ex.find(0, 0, a.put('HiddenParent'), 0, 0), 810);
    assert.equal(a.ex.find(810, 0, a.put('HiddenWideChild', true), a.put('Title', true), 1), 811);
    assert.equal(a.ex.find(810, 0, a.put('Wrong'), 0, 0), 0);
    const order = f => {
      const out = [];
      for (let h = f.ex.find(0, 0, 0, 0, 0); h; h = f.ex.find(0, h, 0, 0, 0)) {
        assert(!out.includes(h), 'ordering terminates'); out.push(h);
      }
      return out;
    };
    assert.deepEqual(order(a), order(b));
    return {a,b};
  }
  const {a,b} = registryCase('registry');
  results.push({label:'registry enumerates entirely unpublished foreign tree, UTF16 class/title, consistent caller-independent desktop order'});
  reject('reject disabled owner context registry', () => registryCase('registry-disabled'));
  for (const [kind, atom] of [[1,0x80],[2,0x81],[3,0x82],[4,0x83],[7,0x84],[5,0x85]]) {
    const h = b.ex.child(810, kind, 1, 0, 0, 40, 20, 0, 0);
    eq('foreign native class mapping '+kind, a.ex.find(810,0,atom,0,0),h);
  }
  function lifecycle(mutation, bind, notify) {
    const f=fixture(mutation);
    const life=lifetimeFixture(false, notify ? (...args)=>f.host.set_window_class(...args) : null);
    f.add(901,'OldMetadata');
    life.ex.wnd_table_set(901,1);
    f.ctx.exports=life.ex;
    f.ctx.renderer.windows[901].wasm={exports:life.ex};
    f.ctx.renderer.windows[901].wasmMemory=life.memory;
    if (bind) assert.equal(f.ex.find(0,0,f.put('OldMetadata'),0,0),901);
    life.ex.wnd_table_remove(901);
    const afterRemove=f.ex.find(0,0,f.put('OldMetadata'),0,0);
    assert.equal(afterRemove,0,'removed metadata');
    life.ex.wnd_table_set(901,2);
    assert.equal(f.ex.find(0,0,f.put('OldMetadata'),0,0),0,'new generation cannot reuse old metadata');
    return {f,life};
  }
  const fresh=lifecycle('',false,true);
  results.push({label:'actual removal import invalidates never-queried renderer metadata before same HWND reuse'});
  reject('reject removed persistent invalidation',()=>lifecycle('no-invalidation',false,true));
  lifecycle('',true,false);
  results.push({label:'captured allocation generation independently rejects old metadata after reuse'});
  reject('reject disabled generation comparison',()=>lifecycle('no-generation',true,false));
  // Explicit new class publication can bind a new lifetime, even when a host
  // deliberately reuses its renderer object.
  fresh.f.host.set_window_class(901,fresh.f.put('NewMetadata'));
  eq('new publication binds new generation',fresh.f.ex.find(0,0,fresh.f.put('NewMetadata'),0,0),901);
  eq('new publication cannot match old class',fresh.f.ex.find(0,0,fresh.f.put('OldMetadata'),0,0),0);
  {
    const caller=fixture(), owner=fixture();
    const life=lifetimeFixture(false,(...args)=>caller.host.set_window_class(...args));
    caller.add(930,'Caller'); owner.add(930,'Foreign');
    life.ex.wnd_table_set(930,1);caller.ctx.exports=life.ex;
    caller.ctx.renderer.windows[930]=owner.ctx.renderer.windows[930];
    life.ex.wnd_table_remove(930);
    eq('actual remove notification preserves foreign colliding publication',
      caller.ex.find(0,0,caller.put('Foreign'),0,0),930);
    eq('actual remove notification preserves foreign WND',owner.ex.wnd_lookup_live(930),1);
  }
  {
    const f=fixture(); f.add(940,'Caller');
    f.ctx.renderer.windows[940]={hwnd:940,title:'HostOnly',className:'HostOnly',zOrder:1};
    f.ex.wnd_lookup_retire(940);
    eq('unowned renderer-only record does not borrow colliding caller lifetime',
      f.ex.find(0,0,f.put('HostOnly'),0,0),940);
  }
  {
    const f=fixture(), other=fixture();
    f.add(950,'Caller');other.add(950,'Owner');
    f.ctx.recordWindowText(950,'Wrong caller title');
    f.ctx.renderer.windows[950]=other.ctx.renderer.windows[950];
    eq('published foreign title ignores caller text cache collision',
      f.ex.find(0,0,f.put('Owner'),f.put('Title'),0),950);
  }
  {
    const f=fixture();f.add(951,'OldSurface');
    eq('old surface initially bound',f.ex.find(0,0,f.put('OldSurface'),0,0),951);
    f.host.set_window_class(951,-2);
    const fresh=f.register('FreshNative');
    f.row(951).slot=fresh.slot;
    f.ex.reset_lookup(0); // Actual allocation reset/token expression.
    eq('new native lifetime is not hidden by old invalid surface',
      f.ex.find(0,0,f.put('FreshNative'),0,0),951);
    eq('new native lifetime cannot inherit old surface name',
      f.ex.find(0,0,f.put('OldSurface'),0,0),0);
  }
  {
    const f=fixture();
    let life, observed=false;
    life=lifetimeFixture(false,(h,ptr)=>{
      eq('removal notification still has original row',life.ex.wnd_lookup_generation(h)>0n,true);
      eq('row retired before host callback',life.ex.wnd_lookup_live(h),0);
      f.host.set_window_class(h,ptr >>> 0); // RPC transports may carry unsigned words.
      eq('nested lookup during removal cannot revive publication',
        f.ex.find(0,0,f.put('NeverQueried'),0,0),0);
      observed=true;
    });
    f.add(960,'NeverQueried');life.ex.wnd_table_set(960,1);
    f.ctx.exports=life.ex;f.ctx.renderer.windows[960].wasm={exports:life.ex};
    life.ex.wnd_table_remove(960);
    eq('actual removal ran owner invalidation boundary',observed,true);
    life.ex.wnd_table_set(960,2);
    eq('removed publication remains invalid after unqueried reuse',
      f.ex.find(0,0,f.put('NeverQueried'),0,0),0);
  }
  {
    const actual=sourceModule('lib/region-map.generated.js');
    const old=eval('('+cp.execFileSync('git',['show','ac72debe7522d4d57034627712b8ec000f8e1d92:lib/region-map.generated.js'],
      {cwd:repo,encoding:'utf8'}).match(/const REGIONS = ([\s\S]*?);/)[1]+')');
    for (const [name,descriptor] of Object.entries(old)) assert.deepEqual(actual.REGIONS[name],descriptor,name);
    results.push({label:'all full-candidate region descriptors preserved',count:Object.keys(old).length});
  }
  sourceModule('tools/check-region-decls.js');
  results.push({label:'region declaration/global mirror gate'});
  sourceModule('tools/check-silent-stubs.js');
  results.push({label:'silent stub gate'});
  return results.slice(start);
}
const run = new Function('require', 'process', original + '\n' + independent +
  '\nconst accepted=independent(); accepted.focused=(' + focused.toString() + ')(); return accepted;');
const output = run(require, {...process, argv: ['node', 'replay', repo, ...process.argv.filter(x => x === '--generate-map')]});
if (process.argv[3] && !process.argv[3].startsWith('--')) {
  const s = fs.statfsSync(repo);
  assert(s.bavail * s.bsize >= 2277507072, 'CAPACITY BLOCKER');
  fs.writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + '\n');
}
console.log(JSON.stringify({replay: output.replay, independentChecks: output.independentChecks,
  focusedChecks: output.focused.length, focusedControls: output.focused.filter(x=>x.rejected).length,
  modules: output.modules.length, corrected: output.defects}));

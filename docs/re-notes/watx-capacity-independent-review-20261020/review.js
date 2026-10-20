'use strict';
const fs = require('fs'), vm = require('vm'), cp = require('child_process');
const assert = require('assert/strict'), crypto = require('crypto'), path = require('path');
const root = '/home/user/wine-assembly';
const out = process.argv[2] || __dirname;
const pre = JSON.parse(fs.readFileSync(path.join(out, 'preflight.json')));
const git = (...args) => cp.execFileSync('git', ['-C', root, '-c', 'branch.autoSetupMerge=false',
  '-c', 'push.autoSetupRemote=false', ...args], {encoding:'utf8'});
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const files = ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'];
const checks = [];
const identities = {};
function context(ref, parserOnly = false, mutate = x => x) {
  const ctx = vm.createContext({TextEncoder,TextDecoder,console:{log(){},warn(){},error(){}},
    setTimeout,clearTimeout,setImmediate});
  for (const f of parserOnly ? files.slice(0,1) : files) {
    const p = 'tools/watx-src/'+f, text = git('show', ref+':'+p);
    identities[ref+':'+p] = {blob:git('rev-parse',ref+':'+p).trim(),sha256:sha(text)};
    vm.runInContext(f === files[0] ? mutate(text) : text, ctx, {filename:p});
  }
  return ctx;
}
function check(name, fn) {
  try { const detail=fn(); checks.push({name,pass:true,detail}); }
  catch(e) {checks.push({name,pass:false,error:e.stack});}
}
function registry(ctx) {
  ctx.assert = assert;
  vm.runInContext(`
    const B=4194304;
    assert.equal(WATX_LOC_MAX_FILES,256);
    assert.equal(WATX_LOC_FILE_BASE,B);
    const snap=()=>JSON.stringify([WATX_LOCATION_FILES,WATX_LOCATION_SOURCES,
      [...WATX_LOCATION_FILE_IDS]]);
    let before=snap();
    assert.throws(()=>parseSource(' '.repeat(B),'rejected'),/location-offset limit/);
    assert.equal(snap(),before);
    for(let i=0;i<255;i++) {
      const node=parseSource('\\n  (nop)','f'+i)[0];
      assert.equal(node[0],i*B+3);
      assert.equal(watxNodeFile(node),'f'+i);
      assert.equal(watxNodeLine(node),2);
      assert.equal(watxNodeCol(node),3);
    }
    // Non-ASCII comment exercises code-unit, rather than byte, accounting.
    const text=';;'+'é'.repeat(B-9)+'\\n(nop)';
    assert.equal(text.length,B-1);
    const last=parseSource(text,'f255')[0];
    assert.equal(last[0],255*B+B-6);
    assert.equal(watxNodeFile(last),'f255');
    assert.equal(watxNodeLine(last),2);
    assert.equal(watxNodeCol(last),1);
    assert.equal(packWatxLocBase(255*B,B-1),1073741823);
    assert.equal(watxLocFile(1073741823),'f255');
    assert.equal(watxLocLine(1073741823),2);
    assert.equal(watxLocCol(1073741823),6);
    assert.equal(watxFileId('f255',text),255);
    before=snap();
    assert.throws(()=>parseSource('(nop)','f256'),/source files.*f256.*257/);
    assert.equal(snap(),before);
    assert.throws(()=>parseSource(' '.repeat(B),'f255'),/location-offset limit/);
    assert.equal(snap(),before);
    assert.throws(()=>parseSource(' '.repeat(B+1),'new'),/location-offset limit/);
    assert.equal(snap(),before);
    assert.equal(watxNodeLine(last),2);
  `,ctx);
}
check('candidate registry: 256 IDs, UTF-16 offset edge, max Smi, full transactional snapshots',
  ()=>registry(context(pre.ref,true)));
check('pre-fix registry control rejects same contract',()=>{
  assert.throws(()=>registry(context(pre.baseline,true)),/128 !== 256/);
});
check('baseline oversized new source demonstrably consumes a slot',()=>{
  const c=context(pre.baseline,true); c.assert=assert;
  vm.runInContext(`assert.throws(()=>watxFileId('bad',' '.repeat(WATX_LOC_FILE_BASE)),/limit/);
    assert.equal(WATX_LOCATION_FILES.length,1);
    assert.equal(WATX_LOCATION_FILE_IDS.get('bad'),0);
    assert.equal(WATX_LOCATION_SOURCES.length,0);`,c);
});
check('removed size guard mutation rejected by independent registry test',()=>{
  const c=context(pre.ref,true,s=>s.replace(/  if \(source.length >= WATX_LOC_FILE_BASE\) \{[\s\S]*?\n  \}/,''));
  assert.throws(()=>registry(c),/Missing expected exception/);
});
check('removed file-count guard mutation rejected by independent registry test',()=>{
  const c=context(pre.ref,true,s=>s.replace(/    if \(id >= WATX_LOC_MAX_FILES\) \{[\s\S]*?\n    \}/,''));
  assert.throws(()=>registry(c),/Missing expected exception/);
});
function includes(ref,n,streaming,missing=false) {
  const c=context(ref), sources=new Map();
  for(let i=0;i<n;i++) sources.set('p'+i+'.watx',
    `(func $f${i} (export "f${i}") (result i32) (effects) (i32.const ${i*3+7}))`);
  const input=[...sources.keys()].map(p=>`(include "${p}")`).join('\n');
  if(missing)sources.delete('p130.watx');
  const result=c.compile(input,sources,{mode:'production',runtimeBuiltins:false,streaming});
  return result;
}
for(const streaming of [false,true]) {
  for(const n of [127,128,150,255]) check(`includes ${n}+root streaming=${streaming}`,()=>{
    const r=includes(pre.ref,n,streaming);
    assert.equal(r.success,true,r.error);
    const ex=new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary)).exports;
    assert.equal(Object.keys(ex).length,n+1);
    assert.ok(ex.memory instanceof WebAssembly.Memory);
    assert.equal(Object.keys(ex).filter(k=>/^f\d+$/.test(k)).length,n);
    for(let i=0;i<n;i++)assert.equal(ex['f'+i](),i*3+7);
    if(n===127) {
      const b=includes(pre.baseline,n,streaming);
      assert.equal(b.success,true,b.error);
      assert.deepEqual(Buffer.from(r.wasmBinary),Buffer.from(b.wasmBinary));
    }
    return {exports:n,sha256:sha(Buffer.from(r.wasmBinary))};
  });
  check(`baseline 129-source rejection streaming=${streaming}`,()=>{
    const r=includes(pre.baseline,128,streaming);
    assert.equal(r.success,false); assert.match(r.error,/128 source files/); return r.error;
  });
  check(`257-source rejection streaming=${streaming}`,()=>{
    const r=includes(pre.ref,256,streaming);
    assert.equal(r.success,false); assert.match(r.error,/256 source files/); return r.error;
  });
  check(`missing include negative streaming=${streaming}`,()=>{
    const r=includes(pre.ref,150,streaming,true);
    assert.equal(r.success,false); assert.match(r.error,/p130/); return r.error;
  });
}
check('fix and reviewed compiler/test/provenance bytes identical',()=>{
  assert.equal(git('diff',pre.fix,pre.ref,'--','tools/watx-src','test/watx-compiler-production.test.js'),'');
});
for(const p of ['test/watx-compiler-production.test.js','tools/check-watx-provenance.js']) {
  check('shipped '+p,()=>{
    const r=cp.spawnSync(process.execPath,[p],{cwd:pre.wt,encoding:'utf8',timeout:60000});
    fs.writeFileSync(path.join(out,path.basename(p)+'.log'),r.stdout+r.stderr);
    assert.equal(r.status,0,r.stderr);
    return {status:r.status,sha256:sha(fs.readFileSync(path.join(pre.wt,p)))};
  });
}
fs.writeFileSync(path.join(out,'tests.json'),JSON.stringify({node:process.version,checks,identities},null,2));
console.log(JSON.stringify(checks,null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;

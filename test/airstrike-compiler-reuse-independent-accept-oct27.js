'use strict';
// Small closures only. Baseline recovery: git archive 0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110 tools lib/dispatch-trampoline.js lib/wat-manifest.js
// Extract in an owned directory; pass --baseline=DIR --evidence=DIR.
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const baseline=path.resolve(arg('baseline')),out=path.resolve(arg('evidence'));
fs.mkdirSync(out,{recursive:true});
const candidate=require('../tools/watx.js'),base=require(path.join(baseline,'tools/watx.js'));
const cc=require('../tools/watx-closure.js').compileClosure,bc=require(path.join(baseline,'tools/watx-closure.js')).compileClosure;
const transform=require('../lib/dispatch-trampoline.js').applyToVfs;
function norm(x){
  if(x===undefined)return {$undefined:true};
  if(ArrayBuffer.isView(x))return {type:x.constructor.name,values:Array.from(x)};
  if(Array.isArray(x))return Array.from(x,norm);
  if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,norm(x[k])]));
  return x;
}
const results=[],scope=candidate.createFrontendReuse();
// A post-comparison harness incident may resume only the identical completed cases.
const reused=arg('reuse-comparisons')?JSON.parse(fs.readFileSync(arg('reuse-comparisons'))).completed:[];
process.on('uncaughtException',e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,completed:results},null,2));console.error(e);process.exitCode=1;});
function compare(label,closure,options={}){
  const recorded=reused[results.length];
  if(recorded){assert.deepStrictEqual(JSON.parse(JSON.stringify({label,options,closure:{...closure,vfs:[...closure.vfs]}})),{label:recorded.label,options:recorded.options,closure:recorded.closure});results.push(recorded);return structuredClone(recorded.result);}
  const a=bc(closure,options),b=cc(closure,{...options,frontendReuse:scope}),c=cc(closure,options);
  assert.deepStrictEqual(norm(b),norm(a),label+' baseline');assert.deepStrictEqual(norm(c),norm(a),label+' no reuse');
  results.push({label,options,closure:{...closure,vfs:[...closure.vfs]},result:norm(b)});return b;
}
const closure=(source,files={})=>({source,vfs:new Map(Object.entries(files))});
const cases=[
  ['empty',closure(';; empty\n')],['trailing atoms',closure('(func $f) trailing 77')],
  ['quoted parens',closure('(memory 1) (data (i32.const 0) "(;)\\\"x")')],
  ['comment head',closure('(;; head\n func $f) ;; )\n')],['empty form',closure('()')],
  ['trailing close',closure('(func $f)\n)')],['trailing open',closure('(func $f)\n(')],
  ['trailing string',closure('(func $f)\n"unfinished')],
  ['include before malformed',closure('(include "missing")\n(')],
  ['include before type',closure('(include "missing")\n(func $f (call $absent))')],
  ['malformed first include',closure('(include "a")\n(include "b")',{a:'\n(func $bad',b:')'})],
  ['reversed malformed',closure('(include "b")\n(include "a")',{a:'\n(func $bad',b:')'})],
  ['cycle dedup',closure('(include "a")',{a:'(include "b") (func $a)',b:'(include "a") (func $b)'})],
  ['different aliases',closure('(include "a") (include "./a")',{a:'(func $x)','./a':'(func $x)'})],
  ['repeated exact alias',closure('(include "a") (include "a")',{a:'(func $x)'})],
  ['macro one',closure('(defmacro (v) (i32.const 3)) (func $f (result i32) (v))')],
  ['macro two same use',closure('(defmacro (v) (i32.const 8)) (func $f (result i32) (v))')],
  ['macro missing after cached',closure('(func $f (result i32) (v))')],
  ['header macro',closure('(defmacro (sig) (param $x i32)) (func $f (sig) (drop (local.get $x)))')],
  ['multi form macro',closure('(global $g (mut i32) (i32.const 0)) (defmacro (m) (global.set $g (i32.const 1)) (global.set $g (i32.const 2))) (func $f (m))')],
  ['region one',closure('(memory 1) (region.declare $A (size 32)) (func $f (result i32) (i32.const $A))')],
  ['region two',closure('(memory 1) (region.declare $A (size 64)) (func $f (result i32) (i32.const $A))')],
  ['type scope one',closure('(type $t (func (param i32))) (func $f (param i32))')],
  ['type scope two',closure('(type $t (func (param i64))) (func $f (param i64))')],
];
for(const [label,c] of [...cases,...cases.slice().reverse()])for(const tailCalls of [true,false])compare(label,c,{tailCalls});
const mutable=closure('(include "vary")');
for(const value of ['(func $a)','(func $b)',null,'(func $a)','\n(func $f (call $absent))']){
  if(value===null)mutable.vfs.delete('vary');else mutable.vfs.set('vary',value);
  compare('in-place VFS '+value,mutable,{tailCalls:true});
}
// Identical successful lexical input with filename-sensitive semantic failure.
const bad=';; moved\n\n(func $f (call $absent))';
for(const f of ['first.wat','second.wat','first.wat'])compare('semantic filename '+f,closure(`(include "${f}")`,{[f]:bad}));
for(const f of ['bad1','bad2','bad1'])compare('lexical filename '+f,closure(`(include "${f}")`,{[f]:';; moved\n\n(func $f'}));
const portable=JSON.parse(fs.readFileSync(arg('fixture')||path.join(out,'../production-first/fixture.json')));
const original={...portable,vfs:new Map(portable.vfs)},compat={...original,vfs:transform(new Map(original.vfs))};
assert.notStrictEqual(original.vfs.get('04-cache.wat'),compat.vfs.get('04-cache.wat'));
for(const c of [compat,original,original,compat])for(const nameSection of [undefined,'independent'])for(const regionShake of [undefined,'reverse'])compare('real transform/options',c,{tailCalls:c===original,nameSection,regionShake});
// Mutate all caller-visible result containers, then compile identical source.
const prior=compare('before result mutation',original,{tailCalls:true});
function corrupt(x){if(!x||typeof x!=='object')return;for(const k of Object.keys(x)){if(x[k]&&typeof x[k]==='object')corrupt(x[k]);else try{x[k]=0;}catch{}}}
corrupt(prior);compare('after result mutation',original,{tailCalls:true});
const ranges=scope.index('(func $f)','one');assert(Object.isFrozen(scope)&&Object.isFrozen(ranges)&&Object.isFrozen(ranges[0]));
assert.deepStrictEqual(Object.keys(ranges[0]).sort(),['end','head','start']);
assert.throws(()=>{ranges.push({});},e=>e.name==='TypeError');assert.throws(()=>{ranges[0].head='include';},e=>e.name==='TypeError');
assert.strictEqual(scope.index('(func $f)','two'),ranges);
const errors=candidate.createFrontendReuse();for(const f of ['one','two'])assert.throws(()=>errors.index('(',f));
assert.strictEqual(errors.stats().entries,0);assert.strictEqual(errors.stats().scans,2);
const only=candidate.createFrontendReuse();only.index(';;one','one');only.index(';;one','two');only.index(';;two','one');
assert.deepStrictEqual(norm(only.stats()),{scans:2,hits:1,codeUnits:10,entries:2});
// A source-loss mutation must be rejected by the very same full-result oracle.
let mutationDetected=false;
const unsafe={index(text,file){return scope.index(text.split('\n')[0],file);}};
const changed=closure('(func $one)\n(func $two)');
try{assert.deepStrictEqual(norm(cc(changed,{frontendReuse:unsafe})),norm(bc(changed)));}catch(e){if(e instanceof assert.AssertionError)mutationDetected=true;else throw e;}
assert(mutationDetected);
// Instrument unmodified production sources to observe successful scanner side effects,
// context identity and actual stage work. This is additional evidence, not CLI replacement.
const ctx={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Float32Array,Float64Array,Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
vm.createContext(ctx);for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])vm.runInContext(fs.readFileSync(path.join(root,'tools/watx-src',f),'utf8'),ctx,{filename:f});
const observed=vm.runInContext(`(()=>{
 const reuse=createFrontendReuse(),before=WATX_LOCATION_FILES.length;
 reuse.index('(func $trace)','new-file');const after=WATX_LOCATION_FILES.length;
 const seen=new Set(),old=createParseContext;let contexts=0,duplicates=0,scans=0,heads=0;
 createParseContext=function(...a){const c=old(...a);contexts++;if(seen.has(c))duplicates++;seen.add(c);return c;};
 const scan=scanWatxTopLevelForms,head=watxTopLevelHead;
 scanWatxTopLevelForms=function(...a){scans++;return scan(...a);};watxTopLevelHead=function(...a){heads++;return head(...a);};
 const s='(func $fresh)';const opts={mode:'production',standardWat:true,runtimeBuiltins:false,strictDeclarations:true,frontendReuse:reuse};
 compile(s,new Map(),opts);const first={scans,heads,contexts};compile(s,new Map(),opts);const second={scans,heads,contexts};
 return {before,after,first,second,duplicates};
})()`,ctx);
assert.strictEqual(observed.before,observed.after);assert.strictEqual(observed.first.scans,observed.second.scans);
// Header parsing still calls the same head helper. Only lexical indexing is reused.
assert(observed.second.heads-observed.first.heads<observed.first.heads);assert(observed.second.contexts>observed.first.contexts);assert.strictEqual(observed.duplicates,0);
fs.writeFileSync(path.join(out,'comparisons.json'),JSON.stringify(results,null,2));
fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({pass:true,comparisons:results.length,mutationDetected,scope:scope.stats(),observed:norm(observed),limitations:'Small fixtures; no full module, instantiation or full-tree savings claim.'},null,2));
console.log(JSON.stringify({pass:true,comparisons:results.length,mutationDetected,observed:norm(observed)}));

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const {createExactLoader,preflightModule}=require('../tools/gltron-qualified-run-loader.cjs');
const root=path.resolve(__dirname,'..'),run=root+'/scratch-fixture-new',old=root+'/scratch-fixture-closed';
const descriptor=source=>({source,sha256:crypto.createHash('sha256').update(source).digest('hex'),identity:'exact fixture'});
test('old relative routing fails; actual compiled lazy absolute pin executes its body',()=>{
  const pin="globalThis.__glPinBody=(globalThis.__glPinBody||0)+1;module.exports={createNativeEquivalence:()=>({actual:true})};";
  const sources=new Map([[run+'/pin.cjs',descriptor(pin)],
    [old+'/browser.cjs',descriptor("module.exports=()=>require('./pin.cjs').createNativeEquivalence();")],
    [run+'/browser.cjs',descriptor('module.exports=()=>require('+JSON.stringify(run+'/pin.cjs')+').createNativeEquivalence();')]]);
  const loader=createExactLoader({root,sources}),before=globalThis.__glPinBody||0;
  assert.throws(()=>loader.load(old+'/browser.cjs')(),/absent exact qualified dependency/);
  assert.equal(globalThis.__glPinBody||0,before);
  assert.deepEqual(loader.load(run+'/browser.cjs')(),{actual:true});
  assert.equal(globalThis.__glPinBody,before+1);
  assert.equal(loader.compiled.find(r=>r.filename===run+'/pin.cjs').sha256,descriptor(pin).sha256);
  delete globalThis.__glPinBody;
});
test('absent, wrong-path, extensionless and corrupted dependencies fail closed',()=>{
  for(const request of ['./absent.cjs','../scratch-fixture-closed/pin.cjs','./pin','../../../outside.cjs']){
    const loader=createExactLoader({root,sources:new Map([[run+'/entry.cjs',descriptor('module.exports=()=>require('+JSON.stringify(request)+');')],
      [run+'/pin.cjs',descriptor('module.exports=true;')]])});
    assert.throws(()=>loader.load(run+'/entry.cjs')(),/absent exact qualified dependency|outside exact qualified closure/);
  }
  assert.throws(()=>createExactLoader({root,sources:new Map([[run+'/pin.cjs',{...descriptor('module.exports=1;'),source:'module.exports=2;'}]])}),/qualified source identity/);
});
test('failed lazy dependency cannot leave a successful cached partial module',()=>{
  const loader=createExactLoader({root,sources:new Map([[run+'/pin.cjs',descriptor("require('./absent.cjs');module.exports=true;")]])});
  for(let i=0;i<2;i++)assert.throws(()=>loader.load(run+'/pin.cjs'),/absent exact/);
  assert.equal(loader.compiled.length,0);
});
test('preflight rejects a missing startup helper inside a lazy body before any execution',()=>{
  const sources=new Map([[run+'/browser.cjs',descriptor("module.exports=async()=>{require('./readiness.cjs');require('./pin.cjs');};")],
    [run+'/pin.cjs',descriptor('module.exports=true;')]]);
  const incomplete=createExactLoader({root,sources});
  assert.throws(()=>incomplete.preflight([run+'/browser.cjs']),/absent exact qualified dependency.*readiness/);
  assert.equal(incomplete.compiled.length,0,'preflight never starts browser code');
  sources.set(run+'/readiness.cjs',descriptor('module.exports=()=>true;'));
  const complete=createExactLoader({root,sources});
  assert.equal(complete.preflight([run+'/browser.cjs']).length,3);
  assert.equal(complete.compiled.length,0);
});
test('compiled module ABI preflight rejects missing and wrong-kind native exports',()=>{
  // A real compiled module exporting f() as a function. No runtime or fixture
  // returns can turn an absent authoritative-capture export into a capability.
  const bytes=Buffer.from('0061736d0100000001040160000003020100070501016600000a040102000b','hex');
  const proof=preflightModule(bytes,[{name:'f',kind:'function'}]);
  assert.equal(proof.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
  assert.equal(proof.bytes,bytes.length);
  assert.throws(()=>preflightModule(bytes,[{name:'f',kind:'global'}]),/f:global/);
  assert.throws(()=>preflightModule(bytes,[{name:'get_authoritative_capture_hwnd',kind:'function'}]),/get_authoritative_capture_hwnd:function/);
  assert.throws(()=>preflightModule(bytes,[]),/explicit native module exports/);
});

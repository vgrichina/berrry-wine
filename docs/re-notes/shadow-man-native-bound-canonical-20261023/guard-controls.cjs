'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const Native = WebAssembly.Module;
const { guardConstructor, LIMIT } = require('./native-module-bound.cjs');
const Guard = WebAssembly.Module;
const small = Uint8Array.from([0,97,115,109,1,0,0,0]);
function error(C, b, options) { try { new C(b,options); } catch(e) { return {constructor:e.constructor, message:e.message}; } throw Error('expected native rejection'); }
function custom(size) {
  // Section body = empty name (one byte) + zero-filled payload; 4-byte LEB.
  const b = new Uint8Array(size); b.set(small); b[8]=0;
  let n=size-13, p=9;
  do { const v=n&127;n=Math.floor(n/128);b[p++]=v|(n?128:0); } while(n);
  assert.equal(p,13);return b;
}
let calls=0, last;
const Spy = new Proxy(Native,{construct(t,args,nt){calls++;last={args,nt};return Reflect.construct(t,args,nt);}});
const Checked=guardConstructor(Spy);
const results=[];
function test(name, f) {f();results.push(name);}
test('genuine small native module',()=>assert(new Guard(small) instanceof Native));
test('native prototype/static properties/call semantics',()=>{
  assert.equal(Guard.prototype,Native.prototype);
  for(const k of Reflect.ownKeys(Native)) assert.deepEqual(Object.getOwnPropertyDescriptor(Guard,k),Object.getOwnPropertyDescriptor(Native,k));
  assert.deepEqual(error(Guard,new Uint8Array([0])),error(Native,new Uint8Array([0])));
  let a,b;try{Native(small);}catch(e){a=e;}try{Guard(small);}catch(e){b=e;}
  assert.equal(a.constructor,b.constructor);assert.equal(a.message,b.message);
  class Derived extends Guard {} assert.equal(Object.getPrototypeOf(new Derived(small)),Derived.prototype);
});
test('view offsets/options/identity forwarded exactly',()=>{
  const backing=new Uint8Array(32);backing.set(small,7);
  for(const b of [backing.subarray(7,15),new DataView(backing.buffer,7,8)]){
    const options={};const start=calls;
    // Installed V8 rejects DataView although it is a BufferSource; retain
    // that native rejection, as well as successful typed-array construction.
    if(b instanceof DataView) assert.deepEqual(error(Checked,b,options),error(Native,b,options));
    else new Checked(b,options);
    assert.equal(calls,start+1);
    assert.equal(last.args[0],b);assert.equal(last.args[1],options);assert.equal(last.nt,Checked);
  }
});
test('Buffer and cross-realm fixed ArrayBuffer',()=>{
  new Guard(Buffer.from(small));
  new Guard(vm.runInNewContext('Uint8Array.from([0,97,115,109,1,0,0,0]).buffer'));
});
test('unknown/proxy/spoofed forms rejected before native',()=>{
  for(const b of [{byteLength:8},new Proxy(small,{}),null,undefined]){
    const start=calls;assert.throws(()=>new Checked(b),/native-module-bound/);assert.equal(calls,start);
  }
});
test('mutable-length forms fail closed before native',()=>{
  for(const b of [new ArrayBuffer(8,{maxByteLength:LIMIT+1}),new Uint8Array(new ArrayBuffer(8,{maxByteLength:LIMIT+1})),new SharedArrayBuffer(8,{maxByteLength:LIMIT+1})]){
    const start=calls;assert.throws(()=>new Checked(b),/native-module-bound/);assert.equal(calls,start);
  }
});
if (process.argv.includes('--large')) {
  test('valid exactly 8MiB admitted once',()=>{const start=calls;new Checked(custom(LIMIT));assert.equal(calls,start+1);});
  test('valid 8MiB+1 rejected before native spy',()=>{const start=calls;assert.throws(()=>new Checked(custom(LIMIT+1)),/exceeds 8388608/);assert.equal(calls,start);});
  test('rejecting guard-removal mutation (no native oversized control)',()=>{
    // Sentinel proves the same ordering assertion catches removal, without
    // submitting the forbidden oversized buffer to native validation.
    let touched=0;function Sentinel(){touched++;return {};}
    const b=custom(LIMIT+1);
    function check(C){const start=touched;assert.throws(()=>new C(b),/native-module-bound/);assert.equal(touched,start);}
    check(guardConstructor(Sentinel));assert.throws(()=>check(Sentinel),assert.AssertionError);assert.equal(touched,1);
  });
}
console.log(JSON.stringify({results,large:process.argv.includes('--large'),nativeCalls:calls,limit:LIMIT,Memory:false,Instance:false}));

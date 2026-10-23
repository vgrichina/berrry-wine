'use strict';
// Small independent mutation/bypass control: no oversized native input.
const assert=require('node:assert/strict');
const Native=WebAssembly.Module;
const {guardConstructor,LIMIT}=require(process.argv[2]);
const Guard=WebAssembly.Module;
const header=Uint8Array.from([0,97,115,109,1,0,0,0]);
const backing=new Uint8Array(24);backing.set(header,7);
const view=backing.subarray(7,15),options={};
const moduleUnderBound=new Guard(view,options);
assert(moduleUnderBound instanceof Native);
assert.equal(Guard.prototype,Native.prototype);
assert.deepEqual(WebAssembly.Module.exports(moduleUnderBound),[]);
let entered=0;
function Sentinel(){entered++;return {};}
const Checked=guardConstructor(Sentinel);
// User properties lie about both size and mutability. Intrinsic brand getters
// must detect the resizable backing before entering the constructor. Only 8
// bytes are committed; maxByteLength is a virtual reservation, not a module.
const changing=new ArrayBuffer(8,{maxByteLength:LIMIT+1});
Object.defineProperties(changing,{byteLength:{value:0},resizable:{value:false}});
const input=new Uint8Array(changing);
Object.defineProperty(input,'byteLength',{value:0});
function oracle(Constructor){
 const before=entered;
 assert.throws(()=>new Constructor(input,options),/native-module-bound: resizable storage is not admitted/);
 assert.equal(entered,before,'native sentinel must not be reached');
}
oracle(Checked);
// Mutation sensitivity: removing the constructor guard makes this same oracle
// fail. The mutant reaches only a JS sentinel, never native validation.
assert.throws(()=>oracle(Sentinel),assert.AssertionError);
assert.equal(entered,1);
console.log(JSON.stringify({result:'PASS',underBoundNativeModules:1,viewOffset:7,viewBytes:8,
 mutation:'removed guard caught by same oracle',shadowedResizableAndLengthRejected:true,
 sentinelCalls:entered,nativeOversizedCalls:0,Memory:false,Instance:false,LIMIT}));

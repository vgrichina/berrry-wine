'use strict';
// Fail closed: synthetic primitive coverage is necessary, but cannot certify
// original native-COM continuation delivery or callback execution by itself.
const fs=require('fs'),assert=require('assert/strict');
function validate(x){assert.equal(x.actualOriginalModule,true);assert.equal(x.originalLayout,true);assert.equal(x.nativeComReturn,true);assert.equal(x.callbackEntry,true);assert.equal(x.returnRegisterSnapshots,true);assert.equal(x.syntheticOnly,false);return true;}
if(require.main===module){
 const synthetic={actualOriginalModule:true,originalLayout:false,nativeComReturn:false,callbackEntry:false,returnRegisterSnapshots:false,syntheticOnly:true};
 assert.throws(()=>validate(synthetic));
 console.log(JSON.stringify({pass:true,guestRunAuthorized:false,missing:['original native COM return/callback coverage demonstration','exact original boundary register snapshots'],syntheticPrimitiveRejected:true}));
}
module.exports=validate;

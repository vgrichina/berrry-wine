'use strict';
const assert=require('assert');
process.argv.push('--guard-selftest');
require('./compile-guard.cjs');
assert.throws(()=>require('../tools/watx-closure.js'),/forbidden source compiler/);
assert.throws(()=>require('../lib/compile-wat'),/forbidden source compiler/);
assert.throws(()=>require('../tools/region-layout.js'),/forbidden source compiler/);
(async()=>{
 await assert.rejects(WebAssembly.compile(Buffer.from([0,97,115,109,1,0,0,0])),/noncanonical/);
 await assert.rejects(WebAssembly.instantiate(Buffer.from([0,97,115,109,1,0,0,0]),{}),/noncanonical/);
 console.log(JSON.stringify({pass:true,rejectingControls:5,sourceCompilationAttempts:0,guestInstances:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});

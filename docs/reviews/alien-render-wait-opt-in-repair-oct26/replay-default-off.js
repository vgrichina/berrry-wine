'use strict';
// Preserve the rejecting program byte-for-byte. Relocate only its absolute
// source root and exact extraction anchor, whose initializer this repair changes.
// The runner string and the extracted/executed production bytes are unmodified.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../repo');
const oldRoot='/tmp/alien-render-wait-accepted-main-integration-oct26/integration-source';
const oldAnchor='  const renderWaitAttribution = createRenderWaitAttribution();';
const newAnchor="  const renderWaitAttribution = hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null;";
const runner=fs.readFileSync(root+'/test/run.js','utf8');
assert.equal(runner.split(newAnchor).length,2);
const sandbox={console,setTimeout,require(name){
 if(name==='fs')return {...fs,readFileSync(p,...rest){return fs.readFileSync(typeof p==='string'?p.replace(oldRoot,root):p,...rest)}};
 return require(name.replace(oldRoot,root));
},oldAnchor,newAnchor};
vm.createContext(sandbox);
vm.runInContext(`for (const name of ['split','indexOf']) {const original=String.prototype[name];String.prototype[name]=function(needle,...rest){return original.call(this,needle===oldAnchor?newAnchor:needle,...rest);};}`,sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/default-off-contract.js','utf8'),sandbox,{filename:'unchanged-default-off-contract.js'});

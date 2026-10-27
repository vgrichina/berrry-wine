'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const out=process.argv.find(x=>x.startsWith('--evidence=')).slice(11);fs.mkdirSync(out,{recursive:true});
const root=path.resolve(__dirname,'../tools/watx-src');
const ctx={console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Float32Array,Float64Array,Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN};
vm.createContext(ctx);for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const result=vm.runInContext(`(()=>{
 const cache=createFrontendReuse(),text=';; first\\n\\n(func $f)';
 function prepare(file,s=text){return prepareStreamingModule('(include "'+file+'")',new Map([[file,s]]),cache);}
 const first=prepare('alpha'),second=prepare('beta');
 const positions=[first,second].map(m=>[watxNodeFile(m.forms[0]),watxNodeLine(m.forms[0]),watxNodeCol(m.forms[0])]);
 const fresh=first.forms!==second.forms&&first.forms[0]!==second.forms[0];
 first.forms[0][1]='damaged';const third=prepare('alpha');
 const mutationIsolated=third.forms[0][1]==='func';
 const bad=';; first\\n\\n(func $f';const errors=[];
 for(const file of ['broken-alpha','broken-beta','broken-alpha']){
   try{cache.index(bad,file);}catch(e){errors.push({message:e.message,file:e.file,line:e.line,col:e.col});}
 }
 const before=cache.stats().entries;
 try{cache.index(bad,'broken-after-hit');}catch{}
 const errorsNotRetained=cache.stats().entries===before;
 const moved=prepare('alpha',';; moved\\n\\n\\n(func $f)');
 const movedPosition=[watxNodeFile(moved.forms[0]),watxNodeLine(moved.forms[0]),watxNodeCol(moved.forms[0])];
 const decoded=watxSourceTextFromBytes(new TextEncoder().encode(';; banner \\u2550\\n(func $f)'));
 return {positions,fresh,mutationIsolated,errors,errorsNotRetained,movedPosition,primitiveDecoded:typeof decoded,stats:cache.stats()};
})()`,ctx);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.positions)),[['alpha',3,1],['beta',3,1]]);
assert(result.fresh&&result.mutationIsolated&&result.errorsNotRetained);
assert.strictEqual(result.primitiveDecoded,'string');
for(const [i,file] of ['broken-alpha','broken-beta','broken-alpha'].entries())assert.deepStrictEqual({...result.errors[i]},{message:'Unmatched ( at end of input',file,line:3,col:1});
assert.deepStrictEqual(Array.from(result.movedPosition),['alpha',4,1]);
fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({pass:true,result},null,2));console.log(JSON.stringify({pass:true,positions:result.positions,filenameFailures:result.errors.length}));

'use strict';
// Static only. No WebAssembly API is invoked or installed.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const donor='/tmp/seh-current-canonical-qualifier-oct25';
const file=donor+'/repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs';
const q=require(file),c=JSON.parse(fs.readFileSync(donor+'/ops/contract.json'));
assert.equal(q.sha(fs.readFileSync(file)),'c46880319a64721493daff2d45437be3a7f329045f2203194dbc3f25ba8a80a6');
const binding=JSON.parse(fs.readFileSync(c.sourceBinding.path));
binding.sourceFilesVerified=0;
binding.closureSHA256='0'.repeat(64);binding.compilerSHA256='0'.repeat(64);
binding.compilerPath='/nonexistent/compiler';binding.passed=true;
const forged=path.join(__dirname,'forged-source-binding.json');
fs.writeFileSync(forged,JSON.stringify(binding,null,2)+'\n');
c.sourceBinding={path:forged,sha256:q.sha(fs.readFileSync(forged))};
const contract=path.join(__dirname,'forged-contract.json');
fs.writeFileSync(contract,JSON.stringify(c,null,2)+'\n');
const accepted=q.load(contract);
const checks=[];
for(const row of accepted.c.allowed){
 q.select(accepted.c,row.path,row.sha256);
 const b=fs.readFileSync(row.path);q.byteHash(b,row);
 q.metadata(q.parse(b),accepted.expected,accepted.statics.outputs.find(x=>x.file===row.path));
 checks.push({path:row.path,allPreconstructorStaticChecksPassed:true});
}
const result={verdict:'REJECT',reason:'Supplied contract can replace the source trust anchor with a self-hashed false receipt; load and all binary static checks accept it.',candidate:c.candidate,qualifierSHA256:q.sha(fs.readFileSync(file)),forgedSourceFilesVerified:0,forgedClosureSHA256:binding.closureSHA256,forgedCompilerSHA256:binding.compilerSHA256,checks,nativeModuleCalls:0,WebAssemblyAPIsUsed:false,sourceAndBinariesChanged:false};
fs.writeFileSync(path.join(__dirname,'reproducer-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

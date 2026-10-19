'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const source=process.argv[3]||'1a251aafcdd57e27be9971d58808cb112fdb1552';
const code=fs.readFileSync(require.resolve('./runner-boot-assets'),'utf8');
const normal=require('./runner-boot-assets').auditBoot(root,source);
assert.equal(normal.files.length,27);
for(const [target,missing] of [['test/binaries/tlbs/stdole2.tlb',true],['fonts/System.fon',true],['fonts/subset/tahoma.ttf',true],['fonts/substitutions.json',false],['lib/font-substitutions.js',false]]) {
  const fake=Object.create(fs);fake.readFileSync=(p,...args)=>{
    if(p===path.join(root,target)){if(missing)throw Object.assign(Error('missing '+target),{code:'ENOENT'});return Buffer.from('changed');}
    return fs.readFileSync(p,...args);
  };
  const m={exports:{}};const req=n=>n==='node:fs'?fake:require(n);req.main=null;
  vm.runInNewContext(code,{require:req,module:m,process:{argv:[]}});
  assert.throws(()=>m.exports.auditBoot(root,source),undefined,target);
}
console.log('PASS boot closure27 assets; missing typelib/bitmap/subset and changed manifest/producer source refused.');

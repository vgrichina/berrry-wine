'use strict';
// Preparation only: ordinary guest MessageBoxA(NULL,...) with a visible
// untitled main. Keep the existing genuine-owned fixture byte-identical.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {untitledModal}=require('./test-sims-child-mount-native.cjs');
function image(taskModal=false){
  const b=untitledModal(),raw=r=>r-0x1000+0x200;
  const needle=Buffer.from([0x68,1,0,0,0,0x68,0x40,0x25,0x40,0,0x68,0x80,0x25,0x40,0,0x56,0xff,0x15,0x4c,0x19,0x40,0]);
  const at=b.indexOf(needle,raw(0x2000));assert(at>=0);assert.equal(b.indexOf(needle,at+1),-1);
  const end=raw(0x2500),code=Buffer.concat([b.subarray(at,at+15),Buffer.from([0x6a,0]),b.subarray(at+16,end-1)]);
  code.copy(b,at);if(taskModal)b.writeUInt32LE(0x2001,at+1);
  b.write('Native NULL-owner modal. Cancel exits this fixture.\0',raw(0x2580));
  return b;
}
module.exports={image};
if(require.main===module){const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
  for(const [name,task]of [['application',false],['task',true]])fs.writeFileSync(path.join(out,name+'.exe'),image(task),{flag:'wx'});
  console.log(JSON.stringify({fixtureOnly:true,nativeExecution:false,out}));}

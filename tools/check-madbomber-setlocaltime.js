'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('./run-madbomber-setlocaltime'),'utf8');
const sample={command:{argv:['test/run.js','--exe=${PACKET_ROOT}/original.exe','--png=${OUTPUT}/final.png']}};
const testExports={};const sandbox={module:{exports:testExports},exports:testExports,__dirname:'/candidate/tools',process:{argv:[],cwd:()=>'/candidate'},
 require:n=>n==='node:fs'?{readFileSync:()=>JSON.stringify(sample)}:n==='./run-lockfile-native'?{ADMIT:2852126720}:require(n)};
sandbox.require.main={};vm.runInNewContext(source,sandbox);
assert.deepEqual(Array.from(sandbox.module.exports.argv('/out')),['test/run.js','--exe=/candidate/original.exe','--png=/out/final.png']);
for(const n of [0,2852126719,2852126720])assert.throws(()=>sandbox.module.exports.admit(()=>n),/fresh admission refused/);
let reads=0;assert.equal(sandbox.module.exports.admit(()=>{reads++;return 2852126721;}).freeBytes,2852126721);assert.equal(reads,1);
assert(source.includes("verifyQualification(qualification, root)"));
assert(source.includes("assert.equal(qualification.plan.source, builtCommit)"));
assert(source.includes("assert.deepEqual([m.guestSeconds, m.quitSeconds, m.hardSeconds], [10, 15, 25])"));
assert(source.includes('b2fdf52732a3046c1b26468a335a6a9b32ea16fcda5d4f111977306be9729541'));
console.log('MadBomber SetLocalTime source argv/admission/qualification control PASS; no original run');

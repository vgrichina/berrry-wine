'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const plan=require('./army-men-directory-validation-plan');
const runtime=process.argv[2];assert(runtime,'runtime path required');
const source=fs.readFileSync(path.join(runtime,'test/run.js'),'utf8');
assert(source.includes("const [name, arg, len] = spec.split(':')"));
assert(source.includes("getArg('trace-host', null)"));
assert(source.includes("hasFlag('trace-fs')"));
assert.equal(plan.flags.filter(x=>x.startsWith('--trace-at=')).length,1);
assert(plan.flags.includes('--trace-at-limit=8'));
assert(!plan.flags.some(x=>/skip|patch|break|input|paused/.test(x)));
for(const x of plan.memorySpecs){const [name,index,length]=x.split(':');assert(plan.apiNames.includes(name));assert.equal(+index,0);assert.equal(+length,128);}
const f=fs.readFileSync(path.join(runtime,'lib/filesystem.js'),'utf8');
for(const name of plan.hostNames)assert(f.includes(name+':'));
console.log('PASS bounded directory validation plan and existing API/host protocol source checks; no guest');

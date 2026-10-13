#!/usr/bin/env node
'use strict';
// Run the existing state/trace differential fuzzer against the isolated
// two-operation matcher candidate. No shipping test/source is rewritten.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert');
const file=path.resolve(__dirname,'../test/test-x87-island-predecode.js');
let source=fs.readFileSync(file,'utf8');
const length='const n = 3 + ri(ri(3) === 0 ? 60 : 14);';
assert.equal(source.split(length).length,2);
source=source.replace(length,'const n = 2;');
const child=new Module(file,module);child.filename=file;child.paths=Module._nodeModulePaths(path.dirname(file));
const original=child.require.bind(child);
child.require=id=>{
  if(id!=='./compile-src')return original(id);
  const real=original(id);
  return {compileSrcWasm:(transform,options)=>real.compileSrcWasm((name,text)=>{
    if(name==='07b-loop-match.wat') {
      const begin=text.indexOf('(func $x87_island_fuse_block'),end=text.indexOf('(func ',begin+6);
      const from='(if (i32.ge_u (local.get $count) (i32.const 3))';
      const body=text.slice(begin,end);assert.equal(body.split(from).length,2);
      text=text.slice(0,begin)+body.replace(from,'(if (i32.ge_u (local.get $count) (i32.const 2))')+text.slice(end);
    }
    return transform(name,text);
  },options)};
};
child._compile(source,file);

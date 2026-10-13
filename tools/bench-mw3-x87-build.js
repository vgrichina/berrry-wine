#!/usr/bin/env node
'use strict';
// Isolated experiment: reuse the existing x87 island evaluator for two-op
// islands. No source or canonical artifact is edited. Baseline must reproduce.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {watxSourceClosure,compileClosure}=require('./watx-closure');
const {layoutHash,appendSection}=require('./region-layout-hash');
const baseline=process.argv[2],out=process.argv[3];
assert(baseline&&out,'usage: bench-mw3-x87-build.js BASELINE.wasm NEW.wasm');
assert(!fs.existsSync(out),'Use a fresh output');
const closure=watxSourceClosure();
const compile=c=>{const r=compileClosure(c,{tailCalls:true});assert(r.success,r.error);
  const b=appendSection(Buffer.from(r.wasmBinary),layoutHash(r.regions.regions));
  assert(WebAssembly.validate(b));return b;};
assert(compile(closure).equals(fs.readFileSync(baseline)),'Frozen source does not reproduce baseline');
const needle='(if (i32.ge_u (local.get $count) (i32.const 3))';
for(const [name,text]of closure.vfs)if(path.basename(name)==='07b-loop-match.wat') {
  const s=String(text),begin=s.indexOf('(func $x87_island_fuse_block'),end=s.indexOf('(func ',begin+6);
  const body=s.slice(begin,end);assert.equal(body.split(needle).length,2);
  closure.vfs.set(name,s.slice(0,begin)+body.replace(needle,'(if (i32.ge_u (local.get $count) (i32.const 2))')+s.slice(end));
}
const bytes=compile(closure);fs.writeFileSync(out,bytes);
console.log(JSON.stringify({baseline,out,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),change:'x87 island minimum 3 -> 2'}));

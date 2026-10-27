'use strict';
const fs=require('fs'),Module=require('module'),assert=require('assert/strict');
const fixturePath='/tmp/gta2-raw-exit-independent-accept-oct27/repo/test/test-api-exit-observer.js';
const fixture=fs.readFileSync(fixturePath,'utf8');
const m=new Module(fixturePath,module);m.filename=fixturePath;
m.paths=Module._nodeModulePaths(require('path').dirname(fixturePath));
m._compile(fixture.slice(0,fixture.indexOf('console.log(JSON.stringify({ sourcePath,'))+
  '\nmodule.exports={host,apiTable};',fixturePath);
const {host,apiTable}=m.exports;
const entry=apiTable.find(e=>e.name==='GetClientRect');
assert.equal(entry.ret,'BOOL');assert(entry.args[1].out);
const f=host();const dv=new DataView(f.memory.buffer);
dv.setUint32(516,0x1234,true);dv.setUint32(520,1024,true);
f.enter(entry.name);
// Replace both stack location and pointer argument after entry. Decode original
// output pointee, whose content has legitimately changed during the API call.
f.state.esp=768;dv.setUint32(776,2048,true);dv.setUint32(520,3072,true);
for(const [i,v] of [10,20,30,40].entries())dv.setInt32(1024+i*4,v,true);
for(const [i,v] of [91,92,93,94].entries())dv.setInt32(2048+i*4,v,true);
f.h.log_i32(0);f.h.log_i32(-1);
assert.equal(f.logs.filter(l=>/^\s*=>/.test(l)).length,0);
const before=Buffer.from(f.memory.buffer);f.state.eax=1;f.h.log_api_exit();
assert.deepEqual(f.logs.filter(l=>/^\s*=>/.test(l)),['  => TRUE']);
const out=f.logs.filter(l=>l.startsWith('   out:'));
assert.equal(out.length,1);assert.match(out[0],/10.*20.*30.*40/);assert(!out[0].includes('91'));
assert.equal(f.reads.eax,1);assert.deepEqual(Buffer.from(f.memory.buffer),before);
const logs=[...f.logs],reads={...f.reads};f.state.eax=0;f.h.log_api_exit();
assert.deepEqual(f.logs,logs);assert.deepEqual(f.reads,reads);
console.log(JSON.stringify({case:'actual GetClientRect BOOL/LPRECT pointer and ESP churn',entry,logs,reads,unchangedGuestMemory:true,duplicateExitNoReads:true}));

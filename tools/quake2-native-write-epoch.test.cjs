'use strict';
// Extend accepted original native conversion/startup/later-use controls. Keep
// all existing PATHHASH controls and their fixtures unchanged.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const {hash}=require('./quake2-owning-load-witness.cjs');
const fixturePath=path.join(__dirname,'quake2-owner-continuity.test.cjs');
let script=fs.readFileSync(fixturePath,'utf8');
assert.equal(hash(script),'f186d5c958549f0b97e6ed326d1dcda82caf4e698288789ec8b8659e699f996d');
script=script.slice(0,script.lastIndexOf('(async()=>{'));
const marker="source+='\\nmodule.exports={fixture,cpu,exe,bsp};';";
assert.equal(script.split(marker).length,2);
// This code runs after the accepted fixture transformations, before compiling
// its fixture function. Only authored caller instructions get new stores.
const additions=String.raw`
assert.equal(source.split('hash(mem.subarray(0x12000,0x8000000))').length,3);
source=source.replaceAll('hash(mem.subarray(0x12000,0x8000000))',
  "hash(Buffer.concat(['GUEST_BASE','GUEST_HEAP_BASE','GUEST_STACK','GUEST_FIXED_POOL_A','GUEST_FIXED_POOL_B','GUEST_FIXED_POOL_C','GUEST_FIXED_POOL_D'].map(k=>{const r=require('../lib/region-map.generated').REGIONS[k];return mem.subarray(r.base,r.end);})))");
replace('endpointIdentity:2346,quake2LoadObservation:enabled','endpointIdentity:2346,quake2LoadObservation:enabled,quake2NativeWriteObservation:enabled');
replace('endpointIdentity:2347,quake2LoadObservation:enabled','endpointIdentity:2347,quake2LoadObservation:enabled,quake2NativeWriteObservation:enabled');
replace("await exported('run',['resetPending','sourceReplace'].includes(scenario)?1000:100000)",
  "await exported('run',['resetPending','sourceReplace'].includes(scenario)?1000:scenario==='hiddenSameBytes'?100001:100000)");
replace("if(enabled){assert.equal(retired.ownerContinuity.certified,false);",
  "if(enabled){const fresh=(await command({t:'quake2LoadObservation'})).observation.nativeStores;assert.equal(fresh.status,'NOT_ARMED');assert.notEqual(fresh.instanceIdentity,retired.nativeStores.instanceIdentity);assert.equal(retired.nativeStores.status,'INVALID');assert.equal(retired.ownerContinuity.certified,false);");
replace("    const hiddenLoop=at+code.length+5;",
  "    if(scenario.startsWith('native')) {\n"+
  "      const table=scenario.includes('Table'),target=table?0x47b554+21*4:0x6d7da0+20*40+36;\n"+
  "      const value=table?0x6d7da0+20*40:bsp.readUInt32LE(bsp.readUInt32LE(8+13*8)+20*48+36);\n"+
  "      if(scenario.includes('Restore'))emit(0xc7,0x05,...u32(target),...u32(value^123));\n"+
  "      emit(0xc7,0x05,...u32(target),...u32(value));\n"+
  "    }\n    const hiddenLoop=at+code.length+5;");
replace("      const c=observation.ownerContinuity;",
  "      const c=observation.ownerContinuity;\n"+
  "      assert(observation.nativeStores,'real CPU store observer attached');\n"+
  "      if(!['traceGap','resetGap','ownerReplacement'].includes(scenario)) {\n"+
  "        assert(c.conversion,JSON.stringify(observation));\n"+
  "        const now=observation.nativeStores,baseline=c.conversion.nativeStores;\n"+
  "        assert.equal(now.status,'OBSERVING');assert.equal(now.models.host,0);assert.equal(now.table.host,0);\n"+
  "        assert.equal(now.allWriters,'UNKNOWN');assert.equal(now.edictABA,'UNKNOWN');\n"+
  "        if(scenario.startsWith('native')) {\n"+
  "          const range=scenario.includes('Table')?'table':'models',base=range==='table'?c.startup.nativeStores:baseline;\n"+
  "          assert.equal(now[range].epoch-base[range].epoch,scenario.includes('Restore')?2:1);\n"+
  "          assert(now[range].pc>=caller && now[range].pc<caller+4096,'actual authored store PC');\n"+
  "          assert.equal(now[range].width,4);\n"+
  "          assert(c.laterUses[0].reasons.includes(range+' native stores since '+(range==='models'?'conversion':'startup')));\n"+
  "        } else if(scenario==='free'||scenario==='hiddenSameBytes') {\n"+
  "          assert.equal(now.models.epoch,baseline.models.epoch);\n"+
  "          assert.equal(now.table.epoch,c.startup.nativeStores.table.epoch);\n"+
  "        }\n"+
  "        assert.equal(observation.sourceLifetime.sources[0].state,'REVOKED','source release stays revoked independently');\n"+
  "      } else assert.equal(observation.nativeStores.status,'INVALID');");
`;
// ownerReplacement reinitializes using a second endpoint. Preserve enabled
// native observation there too; the old receipt must remain retired/invalid.
script=script.replace(marker,additions+'\n'+marker);
script+='\nmodule.exports=fixtureModule.exports;';
const m=new Module(fixturePath,module);m.filename=fixturePath;m.paths=module.paths;m._compile(script,fixturePath);
(async()=>{
 const results=[];
 for(const scenario of (process.argv.slice(2).length?process.argv.slice(2):['free','nativeSameModel','nativeRestoreModel','nativeSameTable','nativeRestoreTable','hiddenSameBytes','reload','traceGap','resetGap','ownerReplacement'])) {
   const off=await m.exports.fixture(false,scenario),on=await m.exports.fixture(true,scenario);
   assert.deepEqual(on.state,off.state,scenario+' architecture/lazy flags');assert.equal(on.guestHash,off.guestHash,scenario+' full direct guest memory');
   assert.equal(on.sourceMemoryHash,off.sourceMemoryHash);assert.equal(on.source,off.source);assert.equal(on.reuse,off.reuse);
   assert.equal(on.lifecycle.terminationAwaited,true);assert.equal(off.lifecycle.terminationAwaited,true);
   results.push({scenario,off,on});
 }
 console.log(JSON.stringify({pass:true,testSHA:hash(fs.readFileSync(__filename)),fixtureSHA:hash(fs.readFileSync(fixturePath)),cpuSHA:hash(m.exports.cpu),exeSHA:hash(m.exports.exe.buf),bspSHA:hash(m.exports.bsp),results}));
})().catch(e=>{console.error(e);process.exitCode=1;});

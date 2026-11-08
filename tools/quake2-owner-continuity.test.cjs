'use strict';
// Extend the published native allocator/free fixture without changing its
// accepted PATHHASH tests or retained original2205 driver. Exact replacements
// and the fixture hash make drift fail closed. No caller coverage flags.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const Module=require('node:module');
const {hash}=require('./quake2-owning-load-witness.cjs');
const fixturePath=path.join(__dirname,'quake2-source-lifetime.test.cjs');
let source=fs.readFileSync(fixturePath,'utf8');
assert.equal(hash(source),'3a6727ec908b272508f5a31c59be749c3d02687e66e0890672c9b73a5ef0797e');
source=source.slice(0,source.indexOf('(async()=>{'));
function replace(from,to) {assert.equal(source.split(from).length,2,from);source=source.replace(from,to);}
replace("endpointIdentity:2335","endpointIdentity:2346");
replace('let seq=0,pending,failure;','let seq=0,pending,failure,termination;');
replace('void w.terminate();','termination=w.terminate();');
replace('await w.terminate();','await (termination||w.terminate());');
replace("scenario==='resetPending'?1000:100000","['resetPending','sourceReplace'].includes(scenario)?1000:100000");
replace("    emit(0xe9,...u32(stop-(at+code.length+5)));copy(at,code);",`
    // Authored formatting boundary: names are prefilled, formatter returns.
    // The original startup loop, inline lookup, stores and headnode use run.
    for(let i=1;i<35;i++)copy(0x47c1d4+(i-1)*64,Buffer.from('*'+i+'\\0'));
    copy(0x4235b0,[0xc3]);
    put(0x1001000+0xf8,3);put(0x1001000+0x28,21);
    if(scenario==='missedStartup')emit(0xc7,0x05,...u32(0x47b554+21*4),...u32(0x6d7da0+20*40));
    else emit(0xe9,...u32(0x42b0e4-(at+code.length+5)));
    const continuation=at+code.length;
    copy(0x42b128,[0xe9,...u32(continuation-0x42b128-5)]);
    if(scenario==='reload') {
      emit(0x68,...u32(out),0x6a,0,0x68,...u32(name));call(0x4117b0);emit(0x83,0xc4,12);
    }
    if(['traceGap','resetGap','ownerReplacement'].includes(scenario)) {
      // Stop at an actual native spin before later use. Resume only through
      // the production export facade, which must retain sticky rejection.
      emit(0xe9,...u32(0x1006000-(at+code.length+5)));
      copy(0x1006000,[0xeb,0xfe]);
    }
    if(scenario==='tableReplace')emit(0xc7,0x05,...u32(0x47b554+21*4),...u32(0x6d7da0+19*40));
    if(scenario==='modelReplace')emit(0xc7,0x05,...u32(0x6d7da0+20*40+36),...u32(12345));
    const hiddenLoop=at+code.length+5;
    if(scenario==='hiddenSameBytes')emit(0xb9,...u32(1000000),0x49,0x75,0xfd);
    const useContinuation=at+code.length;
    emit(0x68,...u32(0x1001000));call(0x42f0b0);emit(0x83,0xc4,4,0xa3,...u32(out+4));
    emit(0xe9,...u32(stop-(at+code.length+5)));copy(at,code);`);
replace("await exported('set_trace_esp',1,0x4117b0,stop-1);","await exported('set_trace_esp',1,scenario==='missedConversion'?0x4117b0:0x410e50,stop-1);");
replace("    let current,iterations=0,runError=null;","    let current,iterations=0,runError=null,intervened=false;");
replace("      current=await state();assert(++iterations<10000,JSON.stringify(current));",`
      current=await state();assert(++iterations<10000,JSON.stringify(current));
      if(!intervened && scenario==='sourceReplace' && current.get_eip>=0x419a30 && current.get_eip<0x41a2a0) {
        intervened=true;
        const source=get(sourceSlot),sourceW=(await exported('guest_to_wasm',source)).value;
        const mo=bsp.readUInt32LE(8+13*8);
        dv.setUint32(sourceW+mo+20*48+36,12345,true); // raw shared-memory writer
      }
      if(!intervened && scenario==='hiddenSameBytes' && current.get_eip===hiddenLoop) {
        intervened=true;
        const old=Buffer.from(mem.subarray(wa(0x6d7da0),wa(0x6d7da0+35*40)));
        mem.set(old,wa(0x6d7da0));
        put(0x1001000+0x28,20);put(0x1001000+0x28,21); // unobserved edict ABA
      }
      if(!intervened && current.get_eip===0x1006000) {
        intervened=true;
        if(scenario==='ownerReplacement') {
          await command({t:'init',module:await WebAssembly.compile(cpu),memory,sigs,slot:0,endpointIdentity:2347,quake2LoadObservation:enabled});
          // Replacement retires the old observation before any new execution.
          const retired=(await command({t:'quake2LoadObservation'})).retiredObservation;
          if(enabled){assert.equal(retired.ownerContinuity.certified,false);assert.equal(retired.ownerContinuity.status,'REJECTED');assert.equal(retired.validPointObservations,false);}
          return {scenario,retired,lifecycle,state:await state(true),guestHash:hash(mem.subarray(0x12000,0x8000000))};
        }
        if(scenario==='resetGap') {await exported('init_thread',0,0x400000,caller,caller+0x1000,0,0,0,0);await exported('set_esp',sp);await exported('set_eip',current.get_eip);}
        if(scenario==='traceGap')await exported('set_trace_esp',0,0,0);
        // Patch only the authored spin, never the original native windows.
        const spin=current.get_eip;
        copy(spin,[0xe9,...u32(useContinuation-spin-5)]);
        await exported('invalidate_code_range',spin,5);
        if(scenario==='traceGap') {
          // Execute a real cached native reload while callbacks are disabled.
          // Its identical tables and source bytes cannot repair the gap.
          const reloadPC=0x1007000,afterReload=0x1007020;
          const reloadCode=[0x68,...u32(out),0x6a,0,0x68,...u32(name),0xe8,...u32(0x4117b0-(reloadPC+17)),0x83,0xc4,12];
          reloadCode.push(0xe9,...u32(afterReload-(reloadPC+reloadCode.length+5)));
          copy(reloadPC,reloadCode);copy(afterReload,[0xeb,0xfe]);
          await exported('set_eip',reloadPC);
          let reloadState,reloadRuns=0;
          do {await exported('run',100000);reloadState=await state();assert(++reloadRuns<100);}while(reloadState.get_eip!==afterReload);
          assert.equal(get(out),0xbfd75753);
          await exported('set_eip',useContinuation);
          await exported('set_trace_esp',1,0x410e50,stop-1);
        }
      }`);
// These controls all reach a genuine release. Retain the fixture's independent
// conversion comparisons except the intentional converted-storage corruption.
replace("else if(scenario!=='resetPending') {","else if(scenario!=='resetPending' && !['modelReplace','sourceReplace'].includes(scenario)) {");
replace("    const observation=await snapshot(),source=get(sourceSlot),reuse=get(recycled);",`
    const observation=await snapshot(),source=get(sourceSlot),reuse=get(recycled);
    if(enabled) {
      const c=observation.ownerContinuity;
      assert.equal(c.status,'REJECTED');assert.equal(c.certified,false);
      assert.equal(c.allWriters,'UNKNOWN');assert.equal(c.edictABA,'UNKNOWN');
      if(['traceGap','resetGap'].includes(scenario)) {
        assert.equal(observation.validPointObservations,false);assert.equal(c.laterUses.length,1);assert(c.laterUses[0].reasons.some(r=>r.includes('interrupted')));
      } else {
        assert.equal(c.laterUses.length,1,JSON.stringify(c));
        const use=c.laterUses[0];assert.equal(use.pc,0x42f0da);assert.equal(use.sp,use.entry.sp-4);
        assert.equal(use.status,'REJECTED');assert.equal(use.certified,false);
        assert(use.reasons.some(r=>r.includes('UNKNOWN')));
        if(['missedConversion','sourceReplace'].includes(scenario)) {assert(use.reasons.includes('conversion generation missing/replaced'));if(scenario==='sourceReplace')assert(c.faults.includes('acquired source replaced before conversion'));}
        else {
          assert(c.conversion,JSON.stringify(c));assert.equal(c.conversion.count,35);
          assert.equal(c.conversion.returnSP,c.conversion.entrySP+4);
          if(scenario==='missedStartup') {assert.equal(c.startup,null);assert(use.reasons.includes('startup generation/completion missing'));}
          else {assert.equal(c.startup.stores,34);assert.equal(c.startup.complete,true);}
          if(scenario==='reload')assert(use.reasons.includes('conversion generation missing/replaced'));
          else assert(use.reasons.includes('source lifetime REVOKED or unobserved'));
          if(scenario==='tableReplace')assert(use.reasons.includes('collision-table owner replaced'));
          if(scenario==='modelReplace')assert(use.reasons.includes('converted model storage replaced'));
          if(['free','reuseSame','hiddenSameBytes'].includes(scenario))assert.deepEqual(c.faults,['import: log','import: log_api_exit']);
        }
      }
    }`);
replace('    const before=await snapshot();',"    if(scenario==='hiddenSameBytes')assert(intervened,'same-byte writer/edict ABA executed before later use');\n    const before=await snapshot();");
replace("assert.equal(lifetime.sources[0].revokedAt,0x416ef0);","assert.equal(lifetime.sources[0].revokedAt,scenario==='sourceReplace'?0x410e50:0x416ef0);");
replace("assert.equal(lifetime.events[0].reason,'native release entered');","assert.equal(lifetime.events[0].reason,scenario==='sourceReplace'?'source bytes changed before conversion':'native release entered');");
replace('    const sourceMemoryHash=',`    const mo=bsp.readUInt32LE(8+13*8),ordinal=scenario==='tableReplace'?19:20;
    const expectedHeadnode=['modelReplace','sourceReplace'].includes(scenario)?12345:bsp.readUInt32LE(mo+ordinal*48+36);
    assert.equal(get(out+4),expectedHeadnode,'original native headnode return');
    if(enabled)assert.equal(observation.ownerContinuity.laterUses[0].candidateHeadnode,expectedHeadnode);
    const sourceMemoryHash=`);
source+='\nmodule.exports={fixture,cpu,exe,bsp};';
const fixtureModule=new Module(fixturePath,module);fixtureModule.filename=fixturePath;fixtureModule.paths=module.paths;
fixtureModule._compile(source,fixturePath);
(async()=>{
 const results=[];
 for(const scenario of (process.argv.slice(2).length?process.argv.slice(2):['free','reuseSame','sourceReplace','missedConversion','missedStartup','reload','tableReplace','modelReplace','traceGap','resetGap','ownerReplacement','hiddenSameBytes'])) {
   const off=await fixtureModule.exports.fixture(false,scenario),on=await fixtureModule.exports.fixture(true,scenario);
   assert.deepEqual(on.state,off.state);assert.equal(on.guestHash,off.guestHash);assert.equal(on.sourceMemoryHash,off.sourceMemoryHash);
   assert.equal(on.source,off.source);assert.equal(on.reuse,off.reuse);
   assert.equal(on.lifecycle.terminationAwaited,true);assert.equal(off.lifecycle.terminationAwaited,true);
   results.push({scenario,off,on});
 }
 console.log(JSON.stringify({pass:true,fixtureSHA:hash(fs.readFileSync(fixturePath)),testSHA:hash(fs.readFileSync(__filename)),witnessSHA:hash(fs.readFileSync(path.join(__dirname,'quake2-owning-load-witness.cjs'))),cpu:{path:'build/wine-assembly.wasm',sha256:hash(fixtureModule.exports.cpu)},exeSHA:hash(fixtureModule.exports.exe.buf),bspSHA:hash(fixtureModule.exports.bsp),originalDriver:{path:'scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs',sha256:'e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186'},results}));
})().catch(e=>{console.error(e);process.exitCode=1;});

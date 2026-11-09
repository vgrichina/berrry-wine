'use strict';
// Authored offline controls of the actual serialized production page reader.
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const passive=require('./quake2-passive-attack.cjs');
const fs=require('node:fs');
const {fixture,setMotion}=require('./quake2-passive-attack.test.cjs');
const offset=va=>va-0x400000+0x12000;
function frame(f,number,health,blend=[0,0,0,0],kick=[0,0,0]){
 setMotion(f,{frameNumber:number});const at=offset(0xa9ce98),v=f.view;
 v.setInt16(at+0xaa,health,true);
 blend.forEach((x,i)=>v.setFloat32(at+0x90+i*4,x,true));
 kick.forEach((x,i)=>v.setFloat32(at+0x64+i*4,x,true));
 new Uint8Array(f.memory.buffer,offset(0xa9cf8c+(number&15)*240),240).set(new Uint8Array(f.memory.buffer,at,240));
}
async function main(){
 const core=require('../lib/quake2-owning-load-core'),exe=fs.readFileSync(core.EXE);
 assert.equal(core.hash(exe),core.EXE_SHA);
 const pe=require('../lib/pe').readPE(exe),raw=(va,n)=>exe.subarray(pe.va2off(va),pe.va2off(va)+n);
 assert.equal(raw(0x446fc4,5).toString('ascii'),'hnum\0','shipped HUD health token');
 assert.equal(raw(0x40d4a5,7).toString('hex'),'0fbf3d42cfa900','HUD signed health stats[1]');
 assert.equal(raw(0x40328d,3).toString('hex'),'8d7d78','parser stats at playerstate+120');
 assert.equal(raw(0x4032b1,3).toString('hex'),'83fe20','exact 32-stat bound');
 assert.equal(raw(0x4031f2,3).toString('hex'),'d95d60','parser blend at playerstate+96');
 assert.equal(raw(0x4030b1,3).toString('hex'),'d95d34','parser kick at playerstate+52');
 const f=fixture();frame(f,16,100);frame(f,17,98,[1,0,0,0.25],[-2,1,0]);
 const row=f.read(),d=row.damageFeedback;
 assert.equal(d?.status,'SNAPSHOT','production reader must expose bounded damage feedback');
 assert.equal(d.current.health,98);assert.deepEqual(Array.from(d.current.blend),[1,0,0,0.25]);
 assert.deepEqual(Array.from(d.current.kickAngles),[-2,1,0]);
 assert.equal(d.current.pmFlags,0x45);assert.equal(d.current.frameNumber,17);
 assert.equal(d.history.length,2);assert.equal(d.observedHealthDecreases.length,1);
 assert.equal(d.observedHealthDecreases[0].fromHealth,100);assert.equal(d.observedHealthDecreases[0].toHealth,98);
 assert.equal(d.cause,'UNKNOWN');assert.match(d.limits,/attacker.*environment.*contact/);
 const hash=()=>crypto.createHash('sha256').update(new Uint8Array(f.memory.buffer)).digest('hex');
 const before=hash();f.read();assert.equal(hash(),before,'no guest writes');
 const unknown=label=>{const d=f.read().damageFeedback;assert.equal(d.status,'UNKNOWN',label);assert.equal(d.current,undefined,label);};
 // Current and prior publication races cannot become causal observations.
 const peek=f.renderer.peekKeyDownState;
 for(const address of [0xa9ce98+0xaa,0xa9cf8c+0xaa,0xa9cf8c+0x90]){
  frame(f,16,100);frame(f,17,98);let changed=false;
  f.renderer.peekKeyDownState=()=>{if(!changed){changed=true;const at=offset(address);f.view.setUint8(at,f.view.getUint8(at)^1);}return 0;};
  unknown('torn current/history '+address.toString(16));f.renderer.peekKeyDownState=peek;
 }
 frame(f,17,98,[NaN,0,0,0]);unknown('nonfinite feedback');
 frame(f,17,98,[2,0,0,0]);unknown('malformed blend');
 frame(f,17,98,[0,0,0,0],[Infinity,0,0]);unknown('nonfinite kick');
 frame(f,17,98);f.wine.running=false;unknown('retired owner');f.wine.running=true;
 const g=fixture();frame(g,1,100);frame(g,3,98);
 assert.equal(g.read().damageFeedback.observedHealthDecreases.length,0,'gaps cannot establish adjacent transition');
 for(let i=4;i<=35;i++)frame(g,i,98);
 assert.equal(g.read().damageFeedback.history.length,16,'bounded ring only');
 frame(g,36,-1,[0,0,1,0.5]);
 assert.equal(g.read().damageFeedback.current.health,-1,'signed HUD health retained');
 assert.equal(g.read().damageFeedback.cause,'UNKNOWN','blue blend does not establish environment causality');
 frame(g,36,98);
 const chain=passive.createChain({createChain:()=>({capture:async()=>({capture:{identity:g.identity},after:{}}),progress:async()=>({})})},{evaluate:async e=>vm.runInContext(e,g.context)});
 assert.equal((await chain.capture('offline')).after.attackInput.damageFeedback.current.health,98);
 frame(g,36,96);
 assert.equal((await chain.progress(g.identity)).attackInput.damageFeedback.current.health,96,'fresh progress path');
 console.log('PASS actual serialized capture/progress health/blend/kick/raw flags, bounded16 history, adjacent HP transitions, gaps, races, malformed values, owner rejection, zero writes; attribution UNKNOWN');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

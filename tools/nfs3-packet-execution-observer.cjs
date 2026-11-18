'use strict';

// Opt-in reader of the compiled module's existing block-entry log_eip hook.
// Arming debug tracing changes execution strategy (disables chaining/uops),
// so compiled native on/off controls are required before an original run.
const {install} = require('./nfs3-game-control-observer.cjs');
const points = [0x431140,0x43116a,0x431172,0x4311c3,0x4311d9,0x4311ef,
  0x48e125,0x48e155,0x48e171,0x48e180,0x48e191,
  0x48e4f0,0x48e4fd,0x48e50a,0x48e513,0x48e51c,0x48e525,0x48e528,
  0x48e532,0x48e53e,0x48e554,0x48e558,0x48e56a,0x48e574,
  0x4bb500,0x4bb50f,0x4bb880,0x4bb898,0x4bb8a8,0x4bb8b7,0x4bb8c2,0x4bb8cc,
  0x4c3280,0x4c32e0,0x4c32ee,0x4c32f9,0x4c3301,0x4c330a,0x4c3310,
  0x4c3320,0x4c3325,0x4c332d,0x4c3332,0x4c3375,0x4c33f4,
  0x4c349b,0x4c34ad,0x4c34b4,0x4c34be,0x4c3735,0x4c3743,
  0x4c3781,0x4c37d2,0x4c37d9,0x4c37ea,0x4c37f6,
  0x4c3aa0,0x4c3ab9,0x4c3ac2,0x4c3acf,0x4c3bf6,0x4c3bf8,
  0x4c4a30,0x4c4a57,0x4c4a69,0x4c4a70,0x4c4a74,0x4c4a7e,
  0x4c4a96,0x4c4ac4,0x4c4aea,0x4c4b08,0x4c4b24,0x4c4b8f,0x4c4b94,
  0x4c4ca0,0x4c4cbc,0x4c4cc6,0x4c4cd7,0x4c4d0f,0x4c4d12,0x4c4d2d,
  0x4c4d33,0x4c4d40,0x4c4fe0];
const fields = [0x6fb3a0,0x6fb3b0,0x6fb4f4,0x6fb50c,0x6fb514,0x55e814,
  0x55e818,0x79a4ac,0x7d1684,0x7d1688,0x7d1698,0x7d169c,0x7d16a0,
  0x7d16a8,0x7d16ac,0x7d16b0,0x7d3714,0x7cba58,0x7a02dc];

function createObserver({translate, capacity=4096, importantCapacity=2048,
  addresses=points, lo=0x431140, hi=0x4c5130, game=true, now=Date.now}={}) {
  for (const n of [capacity,importantCapacity])
    if (!Number.isInteger(n)||n<1||n>16384) throw Error('capacity');
  if (typeof translate!=='function') throw Error('translate');
  const wanted=new Set(addresses), ring=new Array(capacity), important=new Array(importantCapacity);
  const totals={}, errors=[], hosts=[];
  let count=0, importantCount=0, callbacks=0;
  const fail=error=>{if(errors.length<16)errors.push(String(error));};
  function wrapImports(imports) {
    const h=imports.host;if(!h?.memory)return ()=>{};
    let e,armed=false;const id=hosts.length+1, state={id,armed:false};hosts.push(state);
    const read=(p,n)=>{
      if(!Number.isInteger(n)||n<0||n>256)throw Error('read bound');
      const a=translate(p>>>0,e.get_image_base(),h.memory.buffer);
      if(!Number.isInteger(a)||a<0||a+n>h.memory.buffer.byteLength)throw Error('mapping bound');
      return Array.from(new Uint8Array(h.memory.buffer,a,n));
    };
    const u=p=>{const b=read(p,4);return(b[0]|b[1]<<8|b[2]<<16|b[3]<<24)>>>0;};
    const car=p=>{
      if(p<0x400000||p>0x7ffff000)return {ptr:p,valid:false};
      return {ptr:p,valid:true,index:u(p+0x1f4),flags:u(p+0x200),
        controls:read(p+0x504,16),callback:u(p+0x5fc),apply:u(p+0x600)};
    };
    const log=h.log;
    if(typeof log==='function')h.log=function(...args){
      if(e&&!armed)try{
        e.set_trace_eip_range(1,lo,hi);armed=true;state.armed=true;
      }catch(error){fail(error);}
      return Reflect.apply(log,this,args);
    };
    const original=h.log_eip;
    h.log_eip=function(pc){
      callbacks++;
      if(e&&wanted.has(pc>>>0))try{
        const regs={};for(const r of ['eax','ebx','ecx','edx','esi','edi','esp','ebp'])regs[r]=e['get_'+r]()>>>0;
        const row={at:now(),pc:pc>>>0,instance:id,thread:e.get_current_thread_id(),
          process:e.get_process_id(),boundary:'native-block-entry',regs};
        if(game){
          row.fields=fields.map(a=>[a,u(a)]);
          row.scans=[1,0x48,0x4b,0x4d].map(s=>[s,read(0x562f28+s,1)[0]]);
          row.packet=read(0x79a338,4);row.simulationPacket=read(0x79a4a8,4);
          row.simulation=read(0x7d16f0,16);
          row.sequence=Array.from({length:4},(_,p)=>u(0x7d3718+p*4));
          row.commands=read(0x79a2b8,128);
          const selector=u(0x6fb4f4);row.selected=selector<4?car(u(0x5eda48+selector*4)):null;
          row.currentCar=[0x431140,0x4bb880].includes(pc>>>0)?car(regs.eax):null;
          if((pc>>>0)>=0x4c4a30&&(pc>>>0)<=0x4c4b94){
            const player=(pc>>>0)===0x4c4a30?regs.eax:regs.ebx;
            if(player<4){const index=row.sequence[player]&127,slot=0x7d1714+player*512+index*4;
              row.queue={player,index,slot,bytes:read(slot,4),occupied:u(slot+4096)};}
          }
          if((pc>>>0)===0x4c4a30){
            row.admission={player:regs.eax,source:regs.edx};
            if(regs.eax<4){const q=0x7d1714+regs.eax*512+(row.sequence[regs.eax]&127)*4;
              row.admission.bytes=read(regs.edx,4);row.admission.slot=q;
              row.admission.before=read(q,4);row.admission.occupied=u(q+4096);}
          }
        }
        const key=id+':'+row.thread+':'+row.pc;
        const t=totals[key]||={count:0,firstAt:row.at,lastAt:row.at};t.count++;t.lastAt=row.at;
        ring[count++%capacity]=row;
        if(game&&(row.scans.some(x=>x[1])||row.packet.some(x=>x)||row.simulationPacket.some(x=>x)||row.simulation.some(x=>x)))
          important[importantCount++%importantCapacity]=row;
      }catch(error){fail(error);}
      if(original)return Reflect.apply(original,this,arguments);
    };
    return instance=>{e=instance.exports;};
  }
  const rows=(a,n,c)=>Array.from({length:Math.min(n,c)},(_,i)=>a[(Math.max(0,n-c)+i)%c]);
  return {wrapImports,report(){return {boundary:'native-block-entry',guestWrites:0,extraGuestPolls:0,
    debugStrategyChanged:true,capacity,count,overwritten:Math.max(0,count-capacity),callbacks,
    importantCount,importantOverwritten:Math.max(0,importantCount-importantCapacity),hosts,errors,totals,
    rows:rows(ring,count,capacity),important:rows(important,importantCount,importantCapacity)};}};
}
module.exports={createObserver,points,fields};
if(process.env.NFS_PACKET_EXECUTION_TRACE){
  const observer=createObserver({translate:require('../lib/mem-utils').g2w,
    game:process.env.NFS_PACKET_EXECUTION_GAME==='1',
    ...(process.env.NFS_PACKET_EXECUTION_CONTROL?{lo:0x401000,hi:0x408000,
      addresses:JSON.parse(process.env.NFS_PACKET_EXECUTION_CONTROL)}:{})});
  install(observer);globalThis.nfs3PacketExecutionReport=()=>observer.report();
  const {threadId}=require('node:worker_threads');
  process.once('exit',()=>require('node:fs').writeFileSync(
    `${process.env.NFS_PACKET_EXECUTION_TRACE}.${process.pid}-${threadId}.json`,JSON.stringify(observer.report())));
}

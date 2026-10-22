'use strict';
const fs=require('fs'),assert=require('assert');
const O='/home/user/shadow-man-child-transport-sized-oct22';
let called=0;
WebAssembly.instantiate=async()=>({instance:{exports:{get_image_base:()=>0x400000,get_esp:()=>0x401000,get_eax:()=>33}}});
require(O+'/observer.cjs');
(async()=>{
 const memory=new WebAssembly.Memory({initial:2});
 const args=[0x100,0,0,0,0,0,1];
 const h={memory,log(){},log_api_exit(){},process_spawn(...a){assert.deepStrictEqual(a,args);called++;return 33;}};
 await WebAssembly.instantiate(null,{host:h});
 assert.equal(h.process_spawn(...args),33);assert.equal(called,1);
 const sp=0x13000;const d=new DataView(memory.buffer);d.setUint32(sp,0x405b1f,true);
 const name=Buffer.from('WinExec');new Uint8Array(memory.buffer,0x500,name.length).set(name);
 h.log(0x500,name.length);h.log_api_exit();
 assert(!fs.existsSync(O+'/stop-request.json'));
 console.log(JSON.stringify({pass:true,scope:'offline mock host callbacks; no PE or guest',spawnCalledOnce:true,normalReturnPreserved:true,parentWinExecReturnNotForcedStop:true}));
})();

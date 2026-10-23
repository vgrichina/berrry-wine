
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=__dirname,runner="/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23/test/run.js",mode=process.env.CASE;
process.argv[1]=runner;process.env.SHADOW_NULL_PID=String(process.pid);
const trace=x=>fs.appendFileSync(path.join(E,'selection-'+mode+'.trace'),JSON.stringify(x)+'\n');
const sync=fs.fsyncSync;fs.fsyncSync=function(fd){sync(fd);const text=fs.readFileSync(process.env.SHADOW_NULL_OUTPUT,'utf8').trim();const row=JSON.parse(text.split('\n').at(-1));trace({phase:'persisted',row});};
if(mode!=='nohook')require("/home/user/wine-assembly-shadow-man-fresh-selection-repair-oct23/tools/shadow-man-null-preload.cjs");
(async()=>{
 let hwnd=8194,cmd=0,route=mode.includes('parent')?'parent':mode.includes('slot')?'slot':'modal';
 const imports={host:{log_eip:()=>{}},probe:{modal:()=>{trace({phase:'resolve-modal',cmd,hwnd});return route==='modal'?hwnd:0;},parent:h=>{trace({phase:'parent',h});return h===hwnd+1?hwnd:0;},slot:s=>route!=='none'&&s===255?hwnd:0}};
 const m=await WebAssembly.compile(fs.readFileSync(process.argv.find(x=>x.startsWith('--wasm=')).slice(7)));
 const instance=await WebAssembly.instantiate(m,imports),we=instance.exports;
 new DataView(we.memory.buffer).setUint32(16,0x600000,true);we.set_eip(0x402000);
 const context={instance,process,__filename:runner,globalThis,Symbol,logs:[],diagnosticActionSequence:0,batch:17,scheduledInput:[],renderer:null};
 const code=fs.readFileSync(path.join(E,'runner-extract.js'),'utf8');
 for(let n=0;n<3;n++){
  cmd=[1024,1,3][n];context.batch=17+n;
  if(n===2){hwnd=require('node:crypto').randomInt(12000,60000);context.batch=require('node:crypto').randomInt(20,30);trace({phase:'acquired-after-OK',hwnd,batch:context.batch});}
  if(n===2&&mode==='wrong-cmd')cmd=1;
  if(n===2&&mode==='absent'){route='none';}
  if(n===2&&mode.includes('env-update')){
   process.env.SHADOW_NULL_SELECTION=JSON.stringify({actionSequence:3,batch:context.batch,cmdId:3,hwnd});
   trace({phase:'env-update-with-fresh-values',selection:process.env.SHADOW_NULL_SELECTION});
  }
  context.renderer=route==='parent'?{windows:{[hwnd]:{hwnd,visible:true,isDialog:true,zOrder:1},[hwnd+1]:{hwnd:hwnd+1,visible:true,isDialog:true,zOrder:2}}}:null;
  context.scheduledInput.push({batch:17+n,action:'dlg-cmd',cmdId:cmd});
  trace({phase:'before-dequeue',batch:context.batch,sequence:context.diagnosticActionSequence,count:we.null_diag_field(8)});
  try{vm.runInNewContext(code,context,{timeout:1000});}
  catch(e){trace({phase:'rejected',message:e.message,logs:context.logs,count:we.null_diag_field(8)});throw e;}
  trace({phase:'returned',cmd,logs:context.logs.slice(),count:we.null_diag_field(8)});
 }
 if(['absent','nohook'].includes(mode)){trace({phase:'off-complete',count:we.null_diag_field(8)});return;}throw Error('CONTINUED');
})();

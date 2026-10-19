'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=process.argv[2];assert(root,'source root required');
const source=fs.readFileSync(path.join(root,'test/run.js'),'utf8');
const predicate=source.slice(source.indexOf('  apiLogOff = QUIET_API &&'),source.indexOf('  h.log = (ptr, len) =>'));
const logStart=source.indexOf('  h.log = (ptr, len) =>'),logEnd=source.indexOf('    // Check API breakpoints',logStart);
const markerStart=source.indexOf('  h.log_i32 = val =>'),markerEnd=source.indexOf('    // Win16 API dispatch marker',markerStart);
const toggleStart=source.indexOf("    if (cmd.action === 'trace-api') {"),toggleEnd=source.indexOf("    if (cmd.action === 'eval')",toggleStart);
function fixture(extra={}){
  let enabled=1,watCount=0;const memory={buffer:new ArrayBuffer(4096)},dv=new DataView(memory.buffer);
  new Uint8Array(memory.buffer,16,6).set(Buffer.from('<ord>\0'));dv.setUint32(132,512,true);dv.setUint32(512,0x12345678,true);
  const c={QUIET_API:true,TRACE_API:true,TRACE_API_PAUSED:true,TRACE_API_COUNTS:false,TRACE_CRITICAL:false,TRACE_INPUT_DISPATCH:false,ESP_DELTA:false,ESP_AUDIT:false,breakApis:[],TRACE_API_MEM:[{name:'IDirectDrawSurface_Blt',arg:0,len:4}],apiLogOff:false,h:{},apiNameCache:new Map(),memory,pendingComApiId:-1,apiTable:[{id:0,name:'IDirectDrawSurface_Blt'}],apiCount:0,apiCounts:null,logs:[],hex:v=>'0x'+(v>>>0).toString(16),translateGuest:v=>v,apiWatSeen:0,threadManager:null,inheritWasm:()=>{},tickState:{batch:7},...extra};
  c.instance={exports:{get_esp:()=>128,get_image_base:()=>0,get_api_calls:()=>watCount,set_api_log:v=>{enabled=v;}}};
  vm.createContext(c);vm.runInContext(predicate,c);
  vm.runInContext(source.slice(logStart,logEnd)+'\n};\n'+source.slice(markerStart,markerEnd)+'\n};',c);
  if(c.apiLogOff)c.instance.exports.set_api_log(0);
  return {c,call(){watCount++;if(enabled){c.h.log_i32(0xc0de0000);c.h.log(16,5);}},toggle(on){c.cmd={action:'trace-api',on};return vm.runInContext('(function(){'+source.slice(toggleStart,toggleEnd)+'})()',c);}};
}
const f=fixture();assert.equal(f.c.apiLogOff,true);f.call();assert.equal(f.c.logs.length,0);
f.toggle(true);f.call();assert(f.c.logs.some(s=>s.includes('[api-mem] IDirectDrawSurface_Blt')));assert(f.c.logs.some(s=>s.includes('78 56 34 12')));assert.equal(f.c.pendingComApiId,-1);
f.toggle(false);const n=f.c.logs.length;f.call();assert.equal(f.c.logs.length,n);
for(const extra of [{TRACE_API_PAUSED:false},{TRACE_API:false},{TRACE_API_COUNTS:true},{TRACE_CRITICAL:true},{TRACE_INPUT_DISPATCH:true},{ESP_DELTA:true},{ESP_AUDIT:true},{breakApis:['Blt']}]){
  const x=fixture(extra);assert.equal(x.c.apiLogOff,false,JSON.stringify(extra));
  if(extra.TRACE_API===false){x.call();assert(x.c.logs.some(s=>s.includes('[api-mem]')));assert.throws(()=>x.toggle(true),/needs --trace-api/);}
}
console.log('PASS production initial predicate, COM marker/name/memory path, on/off control and independent consumers; synthetic dispatch only, no WASM');

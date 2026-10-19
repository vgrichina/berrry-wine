'use strict';
// Exercise extracted production w handler + activation + first-write detector.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(process.argv[2]+'/test/run.js','utf8');
const activation=source.slice(source.indexOf('const activateWatchpoint = () =>'),source.indexOf('if (!WATCH_START_BATCH) activateWatchpoint();'));
const check=source.slice(source.indexOf('const checkWatchpoint = (batch) =>'),source.indexOf('const debugPrompt = async'));
const begin=source.indexOf("if (cmd.startsWith('w'))");
const handler=source.slice(begin,source.indexOf('    stepping = true;',begin));
function make(size,jsOnly=false,legacy=false){
 let value=0x43,wasmValue=0,wasmSize=4;const calls=[],lines=[];
 const h=legacy?handler.replace('activateWatchpoint();','instance.exports.set_watchpoint(addr); watchPrevVal = instance.exports.get_watch_val();'):handler;
 const code=`let watchAddr=0,watchPrevVal=0,watchActive=false; const watchSize=${size}; ${activation} ${check}
 function arm(cmd){${h}}; ({arm,checkWatchpoint,state:()=>({watchAddr,watchPrevVal,watchActive})})`;
 const api=vm.runInNewContext(code,{WATCH_JS_ONLY:jsOnly,WATCH_START_BATCH:999,watchFilterVal:null,extraWatchAddrs:[],readGuestSized:()=>value,
 instance:{exports:{set_watchpoint_size:n=>{wasmSize=n;calls.push(['size',n]);},set_watchpoint:a=>{calls.push(['arm',a]);wasmValue=value;},get_watch_val:()=>wasmValue,get_eip:()=>0x1234,get_dbg_prev_eip:()=>0x1200}},
 console:{log:l=>lines.push(l)},hex:x=>'0x'+x.toString(16),regs:()=>'',ebpChain:()=>'',hasFlag:()=>false,reason:'Break',debugPrompt:()=>{}});
 return{api,calls,lines,size:()=>wasmSize,write:v=>{value=v;wasmValue=v;}};
}
for(const size of [1,2,4]){
 const t=make(size);t.api.arm('w 0x3000');assert.equal(t.api.state().watchActive,true);assert.equal(t.size(),size);assert.equal(t.api.state().watchPrevVal,0x43);
 t.write(0);assert.equal(t.api.checkWatchpoint(1),true);assert(t.lines.some(l=>l.includes('Old: 0x43  New: 0x0')));
 const bad=make(size);bad.api.arm('w nonsense');bad.api.arm('w 0');assert.equal(bad.api.state().watchActive,false);assert.equal(bad.calls.length,0);
}
const sampled=make(1,true);sampled.api.arm('w 0x3000');sampled.write(0);assert.equal(sampled.api.checkWatchpoint(1),true);assert.equal(sampled.calls.length,0);
const old=make(1,false,true);old.api.arm('w 0x3000');old.write(0);assert.equal(old.api.state().watchActive,false);assert.equal(old.api.checkWatchpoint(1),false);
console.log('PASS production debugger w activation: byte/word/dword, immediate despite delay, JS-sampled, invalid address, old-handler negative control; no guest');

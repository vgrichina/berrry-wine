'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const plan=require('./army-men-path-watch-plan');
const source=fs.readFileSync(process.argv[2]+'/test/run.js','utf8');
const start=source.indexOf('const checkWatchpoint = (batch) =>');
const end=source.indexOf('const debugPrompt = async',start);assert(start>=0&&end>start);
const lines=[];let value=0;
const fn=vm.runInNewContext('let watchPrevVal=0;'+source.slice(start,end)+'\ncheckWatchpoint;',{
 watchAddr:plan.watchedAddress,watchActive:true,watchFilterVal:0,WATCH_JS_ONLY:false,
 instance:{exports:{get_watch_val:()=>value,get_eip:()=>0x1234,get_dbg_prev_eip:()=>0x1200}},
 extraWatchAddrs:[],console:{log:x=>lines.push(x)},hex:x=>'0x'+x.toString(16),regs:()=>'',ebpChain:()=>'',hasFlag:()=>true,dumpStack:()=>lines.push('STACK')
});
value=0x43;assert.equal(fn(1),false);assert.equal(lines.length,0);
value=0;assert.equal(fn(2),true);assert(lines.some(l=>l.includes('Old: 0x43  New: 0x0')));assert(lines.includes('STACK'));
assert.equal(fn(3),false);
assert(plan.flags.includes('--watch-log'));assert.equal(plan.flags.filter(x=>x.startsWith('--watch-byte=')).length,1);
console.log('PASS actual watcher retains filtered C transition and reports later NUL with stack; no guest executed');

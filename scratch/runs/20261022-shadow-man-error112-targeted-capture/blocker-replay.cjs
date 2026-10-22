// Minimal offline replay of the observed observer failure, not a guest retry.
'use strict';
const fs=require('fs'),assert=require('assert/strict'),vm=require('vm');
const {makeObserver}=require('./sealed/observer.cjs');
const events=fs.readFileSync(__dirname+'/raw/observer.jsonl','utf8').trim().split('\n').map(JSON.parse);
const event=events.at(-1);assert.equal(event.name,'ReadFile');assert.equal(event.kind,'entry');assert.equal(event.caller,0x401736);assert.equal(event.args[2],493016);
const memory={buffer:new ArrayBuffer(0x200000)},translate=a=>((a-0x400000+0x12000)>>>0)&0x1fffff,dv=new DataView(memory.buffer);
const put=(a,v)=>dv.setUint32(translate(a),v,true),esp=event.regs.esp;
put(esp,event.caller);event.args.forEach((v,i)=>put(esp+4+i*4,v));
let eax=0,rows=[];
const obs=makeObserver({memory,exports:{get_image_base:()=>0x400000,get_eax:()=>eax,get_esp:()=>esp,get_ebp:()=>0,get_eip:()=>0x401725},translate,emit:r=>rows.push(r),stop:()=>{},findFile:()=>null});
obs.entry('ReadFile');put(event.args[3],493016);eax=1;
assert.throws(()=>obs.exit(),/^Error: observer buffer bound$/);
assert.equal(rows.length,1);assert.equal(rows[0].args[2],493016);
// Test the proposed *capture scope*, without changing the sealed observer:
// metadata for all selected calls; buffer hashes only at extractor disk sites.
const hashScope=(name,caller)=>name==='ReadFile'&&caller===0x404583||name==='WriteFile'&&caller===0x404779;
assert.equal(hashScope(event.name,event.caller),false);
assert.equal(hashScope('ReadFile',0x404583),true);assert.equal(hashScope('WriteFile',0x404779),true);
// Exact historical VirtualFS, read in place. Same unused region-map require
// stub as accepted host fixture. Demonstrates why createFile hook saw no VFS.
const filename='/home/user/wine-assembly-shadow-man-error112-cause-oct22/local/historical-filesystem.js';
const source=fs.readFileSync(filename,'utf8');assert.equal(require('crypto').createHash('sha256').update(source).digest('hex'),'4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e');
const context={module:{exports:{}},require:()=>({}),console,TextEncoder,TextDecoder};vm.runInNewContext(source,context,{filename});
const V=context.module.exports.VirtualFS,old=V.prototype.createFile;let oldHook=0;
V.prototype.createFile=function(...a){oldHook++;return old.apply(this,a);};
const vfs=new V(),opened=vfs.createFileResult('C:\\probe',0xc0000000,2);assert(opened.handle);assert.equal(oldHook,0);
const oldResult=V.prototype.createFileResult;let resultHook=0;
V.prototype.createFileResult=function(...a){resultHook++;return oldResult.apply(this,a);};
assert(vfs.createFileResult('C:\\probe2',0xc0000000,2).handle);assert.equal(resultHook,1);
console.log(JSON.stringify({pass:true,scope:'offline replay, no original executable',actualCaller:'0x401736',actualRequest:493016,observerHashBound:65536,rejected:'observer buffer bound',successfulGuestReturnBeforeObserver:{eax:1,actual:493016},noFalseReturnEmitted:rows.length===1,proposedScopeChecks:3,oldVfsHookMisses:true,resultHookSeesActualPath:true,productionRepair:false,guestAttempts:0}));

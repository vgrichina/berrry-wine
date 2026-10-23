'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCapture,createSelectedSend}=require('../../../tools/shadow-man-null-capture.cjs');
const results=[];
for(const fault of ['retain','bp','trace','arm']){
 const events=[],regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi','eip'];
 const record=x=>{events.push(x);if(x===fault)throw Error('INDEPENDENT '+fault);};
 const exports=Object.fromEntries(regs.map(n=>['get_'+n,()=>n==='esp'?0x600000:0x402000]));
 Object.assign(exports,{guest_read8:()=>0,set_bp:()=>record('bp'),set_trace_eip_range:()=>record('trace'),set_null_diag:()=>record('arm'),null_diag_field:()=>0,null_diag_token:()=>1n,null_diag_root:()=>1n});
 let retained;const capture=createCapture({metadata:{test:'independent'},untilZero:true,retain:r=>{retained=r;record('retain');},stop:()=>record('stop')}),instance={exports},selection={mode:'selected-action',actionSequence:5,cmdId:3};
 const hook=createSelectedSend({instance,capture,selection,runner:'runner'});selection.actionSequence=999;selection.cmdId=1;
 const c={instance,pid:process.pid,runner:'runner',action:'dlg-cmd',actionSequence:5,batch:41,cmdId:3,hwnd:100001,resolution:'modal'};
 assert.throws(()=>hook(c,()=>record('send')));assert(!events.includes('send'));
 const before=events.length;assert.throws(()=>hook(c,()=>record('send')),/duplicate or late arm/);assert.equal(events.length,before);
 assert(!events.includes('send'));assert(!capture.records.length);
 assert(Object.isFrozen(retained.receipt.selection.intent));assert(Object.isFrozen(retained.receipt.selection.priorActions));
 c.hwnd=1;c.batch=999;assert.equal(retained.receipt.selection.hwnd,100001);assert.equal(retained.receipt.selection.batch,41);assert.equal(retained.receipt.selection.intent.actionSequence,5);
 assert.equal(retained.sha256,crypto.createHash('sha256').update(JSON.stringify(retained.receipt)).digest('hex'));
 results.push({fault,events,noRearm:true,noSend:true,privateCopy:true,deepFrozen:true});
}
fs.writeFileSync(path.join(__dirname,'failure-unit-results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({exit:0,faults:results.map(x=>x.fault)}));

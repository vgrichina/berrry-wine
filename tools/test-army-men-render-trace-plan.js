'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const plan=require('./army-men-render-trace-plan');
const runtime=process.argv[2];assert(runtime,'historical runtime required');
const source=fs.readFileSync(path.join(runtime,'test/run.js'),'utf8');
(async()=>{
  assert(plan.flags.includes('--trace-api-paused'));
  assert(!plan.flags.some(f=>/trace-dx|trace-host|trace-fs|dump-ddraw/.test(f)));
  const table=JSON.parse(fs.readFileSync(path.join(runtime,'src/api_table.json')));
  for(const name of plan.apiNames.filter(n=>n!=='<ord>'))assert(table.some(e=>e.name===name),name);
  const a=source.indexOf('const TRACE_API_MEM ='),b=source.indexOf('\nconst WATCH_SPEC',a);
  const parsed=vm.runInNewContext(source.slice(a,b)+'\nTRACE_API_MEM;',{getArg:n=>n==='trace-api-mem'?plan.memorySpecs.join(','):null});
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)),plan.memorySpecs.map(s=>{const [name,arg,len]=s.split(':');return {name,arg:+arg,len:+len}}));
  const start=source.indexOf("    if (cmd.action === 'trace-api') {"),end=source.indexOf("    if (cmd.action === 'eval')",start);
  const calls=[],context={TRACE_API:true,TRACE_API_PAUSED:true,instance:{exports:{get_api_calls:()=>19,set_api_log:n=>calls.push(n)}},threadManager:null,apiCount:0,apiLogOff:true,apiWatSeen:0,inheritWasm:()=>{},logs:[],tickState:{batch:23},cmd:{action:'trace-api',on:true}};
  const toggle='(function(){'+source.slice(start,end)+'})()';
  assert.equal(vm.runInNewContext(toggle,context).traceApi,true);context.cmd.on=false;
  assert.equal(vm.runInNewContext(toggle,context).traceApi,false);assert.deepEqual(calls,[1,0]);
  for(const fail of [null,'enable','down','wait','up','disable']){
    const events=[];const send=async(c,a)=>{events.push([c,a]);if((fail==='enable'&&c==='trace'&&a)||(fail==='disable'&&c==='trace'&&!a)||(fail==='down'&&a==='keydown:102')||(fail==='up'&&a==='keyup:102'))throw Error(fail);};
    const run=plan.observeMovement(send,async ms=>{assert.equal(ms,250);if(fail==='wait')throw Error(fail);},()=>{},'turn');
    if(fail)await assert.rejects(run);else await run;
    assert(events.some(([c,a])=>c==='trace'&&a===false));
    if(fail!=='enable')assert(events.some(([,a])=>a==='keyup:102'));
    if(!fail)assert.deepEqual(events,[['png','turn-before.png'],['trace',true],['cmd','keydown:102'],['cmd','keyup:102'],['trace',false],['png','turn-after.png'],['snapshot',undefined]]);
  }
  console.log('PASS actual API memory parser/control toggle and bounded trace+turn cleanup protocol; pure JS only');
})().catch(e=>{console.error(e);process.exitCode=1;});

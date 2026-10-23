'use strict';
// Enforce the admitted one-arena route without changing guest imports/exports.
const fs=require('node:fs'),wt=require('node:worker_threads'),cp=require('node:child_process');
const out='/home/user/shadow-man-original-null-capture-oct23/fixed/resource-events.jsonl';
function emit(r){const fd=fs.openSync(out,'a',0o600);fs.writeSync(fd,JSON.stringify({pid:process.pid,...r})+'\n');fs.fsyncSync(fd);fs.closeSync(fd);}
let memories=0;
WebAssembly.Memory=new Proxy(WebAssembly.Memory,{construct(target,args){
 const d=args[0];if(++memories!==1||d.initial!==8192||d.maximum!==8192||d.shared!==true)throw Error('resource-policy: unadmitted memory');
 emit({event:'fixed-arena',initial:d.initial,maximum:d.maximum,shared:d.shared,bytes:536870912});return Reflect.construct(target,args);
}});
wt.Worker=new Proxy(wt.Worker,{construct(){emit({event:'rejected-worker'});throw Error('resource-policy: unadmitted Worker; original dependency requires coordinator admission');}});
cp.fork=function(){emit({event:'rejected-child'});throw Error('resource-policy: unadmitted child arena');};
emit({event:'actual-node-entry',argv:process.argv,execArgv:process.execArgv,workerAllowance:0,childArenaAllowance:0});

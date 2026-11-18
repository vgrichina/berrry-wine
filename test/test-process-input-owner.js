'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const {PROCESS_READ,FIELDS,sameProcess}=require('../tools/process-input-owner.cjs');
const canvas={},wine={running:true,processId:1000,renderer:{},guestWorker:{link:{endpointIdentity:1,worker:{},module:{}}}};
function context(){return vm.createContext({crypto,document:{getElementById:()=>canvas},runningApps:[{name:'fixture',wine}]});}
const ctx=context(),read=()=>vm.runInContext(PROCESS_READ,ctx).apps[0],before=read();
sameProcess(before,read());
// Accessing any compositor/GL state is a regression, including a diagnostic
// read in the physical-release path. The transition may have no bridge yet.
Object.defineProperty(wine,'_renderWorkerManager',{get(){throw Error('GL owner is in transition');},configurable:true});
Object.defineProperty(wine,'hostCtx',{get(){throw Error('GL bridge is in transition');},configurable:true});
sameProcess(before,read());
for(const k of FIELDS)assert.throws(()=>sameProcess(before,{...read(),[k]:'replacement'}),new RegExp(k));
const old=ctx.runningApps[0].wine;ctx.runningApps[0].wine={...old,guestWorker:{link:{endpointIdentity:2,worker:{},module:{}}}};
assert.throws(()=>sameProcess(before,read()),/owner changed/);ctx.runningApps[0].wine=old;
assert.throws(()=>sameProcess(before,vm.runInContext(PROCESS_READ,context()).apps[0]),/owner changed/);
for(const changes of [{running:false},{stopped:true},{guestWorker:false}])assert.throws(()=>sameProcess(before,{...before,...changes}),/retired/);
console.log('process input owner: render transition allowed; document/process/endpoint replacements and retired owner refused');

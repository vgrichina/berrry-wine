'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const T=require('./mdk2-drawup-stage-trace.cjs');
const rows=new SharedArrayBuffer(T.bytes),blob=new SharedArrayBuffer(T.blobBytes),control=new Int32Array(new SharedArrayBuffer(4));control[0]=1;
let returned=0,observed;
const nativeExports=Object.freeze({d3d_software_step(){if(!control[0]){returned++;return 0;}observed=T.read(rows);assert(observed.rows.some(r=>r.kind===3&&r.id>=100));assert(observed.rows.at(-1).kind===3);assert.equal(T.command(blob).data.seq,17);returned++;return 0;}});
class Device{exports(){return nativeExports;}draw(){return this.exports().d3d_software_step();}}
class Executor{constructor(){this.bound=[];this.res=new Map();this.layouts=new Map();this.shaders=new Map();this.consts=[];this.vconsts=[];this.clip={mask:0,planes:[]};}execute(){return new Device().draw();}}
const context={SharedArrayBuffer,Int32Array,Uint8Array,Atomics,TextEncoder,performance,console:{info(){}},addEventListener(){},GpuStreamSoftware:{Executor},D3D9SoftwareBackend:{Device}};
vm.runInNewContext('('+T.workerBootstrap.toString()+')()',context);
context.__mdk2Stage.configure({rows,blob,control:control.buffer,identity:9});
const ex=new Executor(),rec={op:21,seq:17,ring:{addr:32},fields:{},raw:new Uint8Array(56),refs:[]};
assert.equal(ex.execute(rec),0);assert.equal(returned,1);assert.equal(T.command(blob).data.raw.length,56);
const result=T.read(rows);assert(result.rows.some(r=>r.kind===2&&r.seq===17));assert(result.rows.some(r=>r.kind===4&&r.id>=100));assert.equal(result.lost,0);
control[0]=0;const end=result.end;ex.execute(rec);assert.equal(T.read(rows).end,end);
// A writer publishing the other slot cannot hide the last complete command.
const b=new Int32Array(blob),slot=b[0]-1,span=(blob.byteLength-16)/2;
const inactive=new Int32Array(blob,16+(1-slot)*span,4);inactive[0]=-2;b[3]=18;
assert.equal(T.command(blob).data.seq,17);assert.equal(T.command(blob).activeSeq,18);
const active=new Int32Array(blob,16+slot*span,4);active[0]=-1;assert.equal(T.command(blob).stable,false);active[0]=1;active[1]=T.blobBytes;assert.equal(T.command(blob).stable,false);
const torn=new SharedArrayBuffer(T.bytes),v=new Int32Array(torn);v[0]=1;v[T.header]=1;assert.equal(T.read(torn).incomplete,true);
v[0]=T.capacity+10;assert.equal(T.read(torn).lost,10);
console.log('PASS preinstalled exact native entry/return, blocked-call command capture, frozen exports facade, OFF no rows, torn/overflow bounds');

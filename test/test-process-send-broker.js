'use strict';
const assert = require('node:assert/strict');
const {ProcessSendBroker} = require('../lib/process-send-broker');
const turn = () => new Promise(resolve => setImmediate(resolve));
const deadline = setTimeout(() => {console.error('Process-send broker test stalled');process.exit(1);},30000);

(async () => {
  const broker = new ProcessSendBroker();
  const a = broker.register(1000, {dispatch: async () => ({done:true,result:7})});
  let ready = false, calls = 0;
  const b = broker.register(1001, {dispatch: async () => {
    calls++; return ready ? {done:true,result:0} : {deferred:true};
  }});
  let resolved = false;
  const pending = broker.send(a,b,{hwnd:0x20001,msg:0x400}).then(v => {resolved=true;return v;});
  await turn(); await turn();
  assert.equal(resolved,false); assert.equal(calls,1,'no busy retry while receiver runs ordinary code');
  ready=true;broker.notifyReady(b);
  assert.equal(await pending,0,'zero is a valid completed LRESULT');
  let deferReply;
  b.adapter.dispatch=()=>new Promise(resolve=>{deferReply=resolve;});
  const raced=broker.send(a,b,{});await turn();
  b.adapter.dispatch=async()=>({done:true,result:3});
  broker.notifyReady(b);deferReply({deferred:true});
  assert.equal(await raced,3,'ready notification racing an in-flight deferral is not lost');

  let release, entered=0;
  const first = new Promise(resolve => {release=resolve;});
  b.adapter.dispatch = async m => {entered++;if(m.order===1)await first;return {done:true,result:m.order};};
  const one=broker.send(a,b,{order:1}),two=broker.send(a,b,{order:2});
  await turn();assert.equal(entered,1,'independent sends cannot share receiver callback state');
  release();assert.deepEqual(await Promise.all([one,two]),[1,2]);

  let savedContext;
  a.adapter.dispatch = async () => ({done:true,result:0x1234});
  b.adapter.dispatch = async (m,context) => {
    savedContext=context;
    return {done:true,result:(await broker.send(b,a,{nested:true},context))+1};
  };
  assert.equal(await broker.send(a,b,{}),0x1235,'nested B -> A reply returns through original send');
  await assert.rejects(broker.send(a,b,{},savedContext),{code:'stale-send-context'});

  // A second nested call returns to an endpoint already on the same chain.
  a.adapter.dispatch = async (m,c) => ({done:true,result:await broker.send(a,b,{leaf:true},c)});
  b.adapter.dispatch = async (m,c) => m.leaf ? {done:true,result:99}
    : {done:true,result:await broker.send(b,a,{},c)};
  assert.equal(await broker.send(a,b,{}),99,'B -> A -> B can reenter its own chain');
  let firstLeafRelease, leaves=0;
  const leafGate=new Promise(resolve=>{firstLeafRelease=resolve;});
  a.adapter.dispatch=async(m,c)=>({done:true,result:(await Promise.all([
    broker.send(a,b,{leaf:1},c),broker.send(a,b,{leaf:2},c)])).reduce((x,y)=>x+y,0)});
  b.adapter.dispatch=async(m,c)=>{
    if(!m.leaf)return {done:true,result:await broker.send(b,a,{},c)};
    leaves++;if(m.leaf===1)await leafGate;return {done:true,result:m.leaf};
  };
  const siblings=broker.send(a,b,{});await turn();
  assert.equal(leaves,1,'same-chain sibling callbacks cannot overlap receiver frames');
  firstLeafRelease();assert.equal(await siblings,3);

  b.adapter.dispatch = async () => ({deferred:true});
  const gone=broker.send(a,b,{});const rejected=assert.rejects(gone,{code:'receiver-gone'});
  await turn();broker.retire(b);await rejected;
  const replacement=broker.register(1001,{dispatch:async()=>({done:true,result:8})});
  await assert.rejects(broker.send(a,b,{}),{code:'receiver-gone'});
  assert.equal(await broker.send(a,replacement,{}),8,'PID reuse does not resurrect old receiver');

  let finish;
  replacement.adapter.dispatch=()=>new Promise(resolve=>{finish=resolve;});
  const orphan=broker.send(a,replacement,{});const orphanRejected=assert.rejects(orphan,{code:'sender-gone'});
  await turn();broker.retire(a);await orphanRejected;
  const newcomer=broker.register(1002,{dispatch:async()=>({done:true,result:1})});
  let nextEntered=false;
  replacement.adapter.dispatch=async()=>{nextEntered=true;return {done:true,result:10};};
  const next=broker.send(newcomer,replacement,{});await turn();assert.equal(nextEntered,false);
  finish({done:true,result:88});assert.equal(await next,10,'sender exit does not steal receiver frame');
  replacement.adapter.dispatch=async()=>({});
  await assert.rejects(broker.send(newcomer,replacement,{}),{code:'invalid-send-reply'});
  console.log('PASS process-send request ownership, deferral, nesting, retirement and PID reuse');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(deadline));

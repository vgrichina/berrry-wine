'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {generate} = require('./kknd-driver-deadline.cjs');
const template = `let command={seconds:45};
capture('power-on');const until=Date.now()+1800000;
try {
  for(let index=0;Date.now()<until;index++){
    const target=10,deadline=Date.now()+1000*(command.seconds||8);
    observed.push({until,deadline}); advance();
  }
} finally{put('diagnostic-history.json',{});}`;
function execute(now, hard, reserve, steps) {
  const outputs = {}, observed = [];
  const source = generate(template, hard, reserve, now);
  vm.runInNewContext(source, {Date:{now:()=>now}, capture:()=>{},
    put:(key,value)=>{outputs[key]=value;}, observed,
    advance:()=>{now += steps.shift() || 1000;}});
  return {source, outputs, observed};
}
test('fixed prearmed deadline survives staging delay and the old thirty minute boundary', () => {
  const start = 2000000000000, hard = start + 55*60*1000;
  const {source,outputs,observed} = execute(start+120000, hard, 180000, [1800000,1200000]);
  assert.equal(outputs['deadline.json'].driverUntilMs, hard-180000);
  assert.equal(observed.length, 2);
  assert.equal(observed[1].until, hard-180000);
  assert.equal(outputs['deadline-terminal.json'].deadlineReached, true);
  assert.ok(!source.includes('1800000'));
});
test('an in-flight ordinary wait cannot pass the recovery boundary', () => {
  const now = 2000000000000, hard = now+180100;
  const {observed} = execute(now, hard, 180000, [100]);
  assert.equal(observed[0].deadline, now+100);
});
test('late launch refuses instead of starting a new relative clock', () => {
  const now=2000000000000, source=generate(template,now+200000,180000,now);
  assert.throws(()=>vm.runInNewContext(source,{Date:{now:()=>now+20001},capture:()=>{},put:()=>{}}), /elapsed/);
});
test('expired, unsafe and changed templates fail closed', () => {
  assert.throws(()=>generate(template,2000000,180000,2000000), /no gameplay/);
  assert.throws(()=>generate(template,Infinity,180000,1), /invalid/);
  assert.throws(()=>generate(template+'\n'+template,2000000,180000,1), /template changed/);
  assert.throws(()=>generate(template.replace('command.seconds','command.duration'),2000000,180000,1), /template changed/);
});

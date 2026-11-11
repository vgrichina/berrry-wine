'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const retained = root+'/scratch/runs/20261111-mw3-complete-helper-cockpit-0500';
const {prepare} = require('./mw3-readiness-install.cjs');
const {install} = require('./mw3-key-action-review.cjs');
const transport = require('./mw3-run-transport.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('prepared ordinary Enter routes reviewed cockpit cycling and pilot entry before native dispatch', async t => {
  const dir = fs.mkdtempSync('/dev/shm/mw3-key-review-');
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  prepare(retained, dir);
  const source = fs.readFileSync(dir+'/browser.cjs', 'utf8');
  assert.throws(() => install(source), /exact ordinary pilot key guard/);
  const start = source.indexOf('async function execute(');
  const end = source.indexOf('\n(async()=>{', start);
  assert(start >= 0 && end > start);
  const cockpit = {scene:'cockpit',fullImageReviewed:true,selectedWeapon:'ER Laser(L)',
    cockpitControls:['weapons','speed']};
  const pilot = {scene:'pilot-entry',fullImageReviewed:true,dialogTitle:'Pilot Entry',
    dialogControls:['Accept','Cancel']};
  const cases = [
    {name:'cockpit',review:cockpit,command:{cockpitAction:'cycle-weapon'},pass:true},
    {name:'pilot',review:pilot,command:{pilotDialog:true},pass:true},
    {name:'bare-enter-in-cockpit',review:cockpit,command:{},error:/Pilot Entry/},
    {name:'cockpit-command-in-pilot',review:pilot,command:{cockpitAction:'cycle-weapon'},error:/full cockpit/},
    {name:'unreviewed',review:{...cockpit,fullImageReviewed:false},command:{cockpitAction:'cycle-weapon'},error:/full cockpit/},
    {name:'no-selection',review:{...cockpit,selectedWeapon:''},command:{cockpitAction:'cycle-weapon'},error:/weapon selection/},
    {name:'no-speed-control',review:{...cockpit,cockpitControls:['weapons']},command:{cockpitAction:'cycle-weapon'},error:/speed controls/},
    {name:'ambiguous-purpose',review:cockpit,command:{cockpitAction:'cycle-weapon',pilotDialog:true},error:/explicit cockpit/},
    {name:'wrong-key',review:cockpit,command:{key:'a',cockpitAction:'cycle-weapon'},error:/explicit cockpit/},
    {name:'unknown-purpose',review:cockpit,command:{cockpitAction:'skip'},error:/explicit cockpit/},
    {name:'pilot-still-needs-controls',review:{...pilot,dialogControls:[]},command:{pilotDialog:true},error:/Pilot Entry dialog controls/},
  ];
  for (const row of cases) {
    const out=dir+'/'+row.name;fs.mkdirSync(out);fs.mkdirSync(out+'/commands');
    const events=[], admitted=[];let captures=0;
    const sha=require(retained+'/bound-input.cjs').sha;
    const image=Buffer.from('labelled synthetic reviewed image; no original');
    const latest={label:'reviewed',sha256:sha(image)};
    fs.writeFileSync(out+'/reviewed.png',image);
    fs.writeFileSync(out+'/reviewed-review.json',JSON.stringify(row.review));
    const endTime=Date.now()+60000;
    fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(endTime).toISOString()}));
    const command={id:row.name,action:'key',key:'Enter',holdMs:100,waitMs:0,label:row.name,
      reviewRef:'reviewed',timing:{workEnd:Date.now()+8000,ackEnd:Date.now()+10000,runEnd:endTime},...row.command};
    fs.writeFileSync(out+'/commands/0.json',JSON.stringify(command));
    // Exact prepared execute and production transport/pulse/key mapping. Only
    // the reviewed image, identity admission and native CDP sink are fixtures.
    const context=vm.createContext({assert,root,out,fs,sha,latest,wait,Date,
      process:{env:{}},deadline:endTime,commandWorkEnd:Infinity,preInputObserved:true,
      require:n=>require(n.startsWith('.')?path.resolve(retained,n):n),
      chain:{admit:async(review,run)=>{admitted.push(review);return run({live:{identity:{fixture:true}}});}},
      ordinary:require(retained+'/input.cjs'),send:async(method,params)=>{events.push({method,params});return {};},
      pageSession:'synthetic-page',save:(name,value)=>fs.writeFileSync(out+'/'+name,JSON.stringify(value)),
      capture:async()=>{captures++;}});
    vm.runInContext(source.slice(start,end),context);
    const execute=vm.runInContext('execute',context);
    if (row.pass) {
      await transport.consume(out,0,execute);
      assert.equal(admitted.length,1,row.name);assert.equal(captures,1,row.name);
      assert.deepEqual(events.map(e=>[e.method,e.params.type,e.params.code,e.params.windowsVirtualKeyCode]),
        [['Input.dispatchKeyEvent','keyDown','Enter',13],['Input.dispatchKeyEvent','keyUp','Enter',13]],row.name);
      assert(fs.existsSync(out+'/input-'+row.name+'-pulse.json'));
    } else {
      await assert.rejects(()=>transport.consume(out,0,execute),row.error,row.name);
      assert.equal(events.length,0,row.name);assert.equal(admitted.length,0,row.name);assert.equal(captures,0,row.name);
      await assert.rejects(()=>transport.request(out,'later',{action:'capture',waitMs:0}));
      await assert.rejects(()=>transport.consume(out,0,()=>assert.fail('no replay')));
      assert.equal(events.length,0,row.name);
    }
  }
});

'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {admission}=require('./ut-menu-admission.cjs');
function control({ready=true,bound=false,terminal=false,refuse=null}={}){
 const calls=[],scene=[1,1000,65537,65537,0,0,1,0,1,0];
 const g={snapshot(){calls.push('snapshot');return {ready,bound,terminal,scene,slot:0,readiness:{predicates:{fresh:ready}}};},
  release(){calls.push('release');if(refuse==='release')throw Error('foreign owner');bound=false;},
  bind(){calls.push('bind');if(refuse==='bind'||bound||terminal)throw Error('browser native owner unavailable or already bound');bound=true;return {owner:'task',scene,slot:0};},
  prepare(i){calls.push('prepare');if(refuse==='prepare')throw Error('wrong generation');assert.equal(i.owner,'task');return {state:'PREPARED'};}};
 const context={window:{fixtureWine:{running:true,_browserNativeInput:g,renderer:{windows:{}}},__binding:{owner:'task'},__lastNonce:'prior'},
  document:{hasFocus:()=>true,visibilityState:'visible'},performance:{timeOrigin:0,now:()=>1},Date};
 return {calls,run:args=>vm.runInNewContext('('+admission.toString()+')(args)',{...context,args})};
}
let c=control({ready:false}),r=c.run();assert.equal(r.state,'WAIT');assert.deepEqual(c.calls,['snapshot']);
c=control({ready:false,bound:true});r=c.run({bound:true});assert.equal(r.state,'WAIT');assert.equal(r.bound,false);assert.deepEqual(c.calls,['snapshot','release','snapshot']);
c=control();r=c.run({intent:{nonce:'next'}});assert.equal(r.state,'PREPARED');assert.deepEqual(c.calls,['snapshot','bind','snapshot','prepare']);
for(const variant of [{bound:true},{terminal:true},{refuse:'bind'},{refuse:'prepare'},{bound:true,refuse:'release'}]){
 c=control(variant);r=c.run({intent:{nonce:'next'},bound:variant.refuse==='release'});assert.equal(r.state,'UNKNOWN');
 assert(r.observations.length);assert(!c.calls.slice(c.calls.indexOf(r.stage)+1).includes('snapshot'),'no read after refusal');
}
c=control({ready:false,refuse:'bind'});r=c.run({wait:false});assert.equal(r.state,'UNKNOWN');assert.equal(r.observations[0].guard.ready,false);
console.log('PASS passive same-request snapshots; stale waits; release once; terminal/already-bound/foreign/generation refusals retain exact pre-state and zero later reads');

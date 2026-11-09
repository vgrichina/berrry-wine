'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const publication=require('./redline-current-publication.cjs');
const generated=publication.prebrowserSource(fs.readFileSync(__dirname+'/redline-browser-run.cjs','utf8'));
// Execute the actual composed callback with live/past-terminal socket states.
const prefix='closeBrowser:onError=>{',start=generated.indexOf(prefix)+prefix.length;
const end=generated.indexOf('\n  finalize:',start);
const body=generated.slice(start,end).replace(/},\s*$/,'');
for(const failed of [false,true]){
 const sent=[];const scope={firstFailure:failed?Error('terminal'):undefined,ws:{readyState:1,send:b=>sent.push(JSON.parse(b))},id:0,JSON,Error};
 vm.runInNewContext('(()=>{'+body+'})()',scope);
 assert.equal(sent.length,failed?0:1);
 if(!failed)assert.equal(sent[0].method,'Browser.close');
}
const fixture=publication.fixtureSource(publication.version,'redline-startup-3e491c08-v1','a'.repeat(64));
new vm.Script(fixture);
const marker="while(!fs.existsSync(out+'/'+capture.label+'-review.json'))";
const gateStart=fixture.indexOf(marker),gateEnd=fixture.indexOf('\n   const ack=',gateStart);
assert(gateStart>0&&gateEnd>gateStart);
const gate=fixture.slice(gateStart,gateEnd);
(async()=>{
 for(const mode of ['missing','wrong','reviewed']){
  let checks=0,reads=0;const scope={out:'/fixture',capture:{label:'startup',sha256:'expected'},assert,
   fs:{existsSync(){return mode!=='missing';},readFileSync(){reads++;return JSON.stringify({sha256:mode==='wrong'?'wrong':'expected',review:'Separately reviewed returned image'});}},
   check(){checks++;throw Error('terminal while waiting');},wait:async()=>{}};
  const invoke=()=>vm.runInNewContext('(async()=>{'+gate+'})()',scope);
  if(mode==='missing'){await assert.rejects(invoke,/terminal while waiting/);assert.equal(reads,0);assert.equal(checks,1);}
  else if(mode==='wrong')await assert.rejects(invoke,/reviewed exact returned image/);
  else await invoke();
 }
 console.log('PASS actual composed terminal close callback and external exact-image review gate');
})().catch(e=>{console.error(e);process.exitCode=1;});

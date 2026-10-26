'use strict';
const assert=require('assert/strict');const {boundary,checkpoint}=require('./challenge');
async function main(){
 await assert.rejects(()=>boundary(s=>s.replace('ctx.waitD3DRender(token)','Promise.resolve()')),assert.AssertionError);
 checkpoint('wrapper-forwarding-negative-control',{omittedBridgeWait:'rejected'},[]);
 console.log('PASS independent production boundary rejects omitted host-wrapper bridge wait forwarding');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

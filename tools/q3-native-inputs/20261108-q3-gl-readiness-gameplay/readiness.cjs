'use strict';
const assert=require('node:assert/strict');
function expression(app){return `!!(typeof runningApps!=='undefined'&&runningApps.find(a=>a.name===${JSON.stringify(app)})?.wine?.guestWorker)`;}
async function ready(evaluate,app,{attempts=150,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  for(let n=0;n<attempts;n++){
    const value=await evaluate(expression(app));
    assert.equal(typeof value,'boolean','CDP readiness must be boolean');
    if(value)return {ready:true,attempts:n+1,expression:expression(app)};
    await wait(100);
  }
  throw Error('guest Worker readiness timed out: '+app);
}
module.exports={expression,ready};

'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {guardNativeCommands}=require('./native-start-boundary.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stronghold-integration-'));
 try{
 fs.mkdirSync(path.join(dir,'browser'));fs.mkdirSync(path.join(dir,'reviews'));fs.writeFileSync(path.join(dir,'observe-browser.js'),'');
 let source=fs.readFileSync(__dirname+'/browser-driver.cjs','utf8').split('main().catch')[0];
 source+='\nglobalThis.test={dispatch,personalReview,set:(p,d)=>{page=p;nativeDriver=d;guarded=guardNativeCommands(d,command);deadline=Date.now()+10000;}};';
 const ctx={require:n=>n==='./native-start-boundary.cjs'?require(n):n==='./evidence-boundary.cjs'?require(n):require(n),__dirname:dir,process:{cwd:()=>dir},setTimeout,clearTimeout,console};vm.runInNewContext(source,ctx);
 let inputs=0;const driver={phase:'scenario-required',requireWorld:async()=>{throw Error('world controls locked');},start:async()=>{driver.phase='failed';throw Error('fixture unchanged scene');}};
 ctx.test.set({mouse:{click:async()=>inputs++},evaluate:async()=>({inputQueue:[],mouseButtonsMask:0})},driver);
 await assert.rejects(ctx.test.dispatch({action:'click',x:1,y:1,reviewRef:'x'},0),/reviewed balanced gesture/);assert.equal(inputs,0);
 await assert.rejects(ctx.test.dispatch({action:'gesture',x:1,y:1},0),/locked/);assert.equal(inputs,0);driver.phase='scenario-required';
 await assert.rejects(ctx.test.dispatch({action:'native-start'},1),/unchanged/);
 await assert.rejects(ctx.test.dispatch({action:'step',n:64},2),/first native/);
 await ctx.test.dispatch({action:'state',name:'after-failure'},3);
 let settled=false;const cap={sha256:'fixture-sha',scene:'scenario'};const review=ctx.test.personalReview(cap).then(v=>{settled=true;return v;});
 await new Promise(r=>setTimeout(r,200));assert(!settled,'review must not auto echo');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'browser/review-required.json'))).sha256,cap.sha256);
 fs.writeFileSync(path.join(dir,'reviews/fixture-sha.json'),JSON.stringify({...cap,personallyViewed:true,observation:'explicit test fixture acknowledgement'}));
 assert.equal((await review).scene,'scenario');
 assert(source.includes('return boundary.run(()=>guarded?guarded(c,i):command(c,i))'));
 console.log(JSON.stringify({pass:true,actualIntegratedQueue:true,noInputBeforeWorld:true,terminalFailure:true,readOnlyAfterFailure:true,personalReviewDoesNotAutoEcho:true}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('fs'),vm=require('vm'),assert=require('assert');const src=fs.readFileSync(__dirname+'/game-observer.cjs','utf8');
const wrapper=src.slice(src.indexOf('cp.fork=function'),src.indexOf('// Both actual CreateProcess'));
let calls=[],events=[];const opts={stdio:['ignore','pipe','pipe','ipc']},cp={execFileSync:()=> '51234\n'},fork=(f,a,o)=>{calls.push({f,a,o});return {pid:123,on(){return this}}};
vm.runInNewContext(wrapper,{cp,fork,emit:r=>events.push(r),process:{execArgv:['--require','observer.cjs']},fs:{statSync:()=>({size:1}),readFileSync:()=>Buffer.from('fixture')},sha:()=> 'fixturehash'});
const args=['--exe=/original','--exe-guest-path=c:\\original\\D3DConfigUtility.exe','--wasm=/module','--real-ticks','--pipe-child-args=--real-ticks'];
cp.fork('/runner',args,opts);assert.equal(calls.length,1);assert.strictEqual(calls[0].o,opts);assert(calls[0].a.includes('--real-ticks'));assert(calls[0].a.includes('--pipe-child-args=--real-ticks'));assert.equal(calls[0].a.at(-1),'--control=51234');assert(!args.some(x=>x.startsWith('--control=')));
assert.throws(()=>cp.fork('/runner',args.filter(x=>x!=='--real-ticks'),opts),/missing/);assert.throws(()=>cp.fork('/runner',[...args,'--control=12'],opts),/inherited/);
assert(src.includes("require('worker_threads').isMainThread"));assert(src.includes("ve.saveVfsToHost=function"));console.log(JSON.stringify({pass:true,assertions:10,syntheticOnly:true,realTicksForwarded:true,controlNotRecursive:true,stdioUnchanged:true}));

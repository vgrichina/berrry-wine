'use strict';
// Small ordinary PE substitution only. Browser, CDP, startup, identity admission,
// input, captures, numbered ACKs and shutdown belong to redline-browser-run.cjs.
const {pe}=require('../test/test-dll-lifecycle-real-pe');
function images(){
const U=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];let code=[];
const emit=(...v)=>code.push(...v.flat()),push=n=>emit(0x68,U(n)),store=n=>emit(0xa3,U(n));
const com=(obj,slot,args)=>{for(const a of args.slice().reverse())push(a);emit(0xff,0x35,U(obj),0xa1,U(obj),0x8b,0x00,0xff,0x90,U(slot*4));};
for(const x of [0,0x401400,0x700,0x400000])push(x);emit(0xff,0x15,U(0x401900));store(0x401408);
com(0x401400,3,[0x401100,0x401404,0]);store(0x40140c);
com(0x401404,11,[0x401200]);store(0x401410);com(0x401404,7,[]);store(0x401414);
com(0x401400,3,[0x401110,0x401430,0]);store(0x401434);
com(0x401430,11,[0x401300]);store(0x401438);com(0x401430,7,[]);store(0x40143c);
const loop=code.length;
com(0x401404,9,[16,0x401500]);store(0x401418);
emit(0xa1,U(0x401500),0x01,0x05,U(0x401520),0xa1,U(0x401504),0x01,0x05,U(0x401524));
com(0x401430,9,[256,0x401600]);store(0x401440);
// Keep the last two native scan-code results and count high reads in guest code.
for(const [scan,dest] of [[0x33,0x401450],[0x34,0x401454]]){
 emit(0x0f,0xb6,0x05,U(0x401600+scan),0xa3,U(dest),0x25,U(0x80),0x01,0x05,U(dest+8));
}
emit(0xff,0x05,U(0x40141c),0xe9,U(loop-(code.length+11)));
const image=pe([[0x2000,code]]),raw=n=>n-0x1000+0x200;
image.fill(0,raw(0x1900),raw(0x1e00));image.writeUInt32LE(0x1a00,raw(0x1900));image.write('DirectInputCreateA\0',raw(0x1a02));
for(const [base,guid] of [[0x1100,0x6f1d2b60],[0x1110,0x6f1d2b61]])[guid,0x11cfd5a0,0x4544c7bf,0x00005453].forEach((v,i)=>image.writeUInt32LE(v,raw(base+i*4)));
[24,16,2,16,7,0x401240].forEach((v,i)=>image.writeUInt32LE(v,raw(0x1200+i*4)));
for(let i=0;i<7;i++)[0,i<3?i*4:i+9,i<3?0xffff03:0xffff0c,0].forEach((v,j)=>image.writeUInt32LE(v,raw(0x1240+i*16+j*4)));
[24,16,2,256,2,0x401340].forEach((v,i)=>image.writeUInt32LE(v,raw(0x1300+i*4)));
for(const [i,scan] of [0x33,0x34].entries())[0,scan,(scan<<8)|0x0c,0].forEach((v,j)=>image.writeUInt32LE(v,raw(0x1340+i*16+j*4)));
const dll=pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true);
return {image,dll};
}
async function prepare(evaluate){const {image,dll}=images();
return evaluate(`(()=>{globalThis.fixtureEntry={exe:false,dll:false,cpu:false};shell.launchApp=async name=>{if(name!=='redline_demo')throw Error('fixture selection');const c=document.getElementById('screen'),w=globalThis.fixture=new WineAssembly();w.renderer=new Win98Renderer(c);await w.init(c);fixtureEntry.exe=true;await w.loadExe('native-fixture.exe',{bytes:Uint8Array.from(${JSON.stringify([...image])})});fixtureEntry.dll=true;await w.guestWorker.loadDlls([{name:'normal.dll',bytes:Uint8Array.from(${JSON.stringify([...dll])})}],Uint8Array.from(${JSON.stringify([...image])}));w.running=true;runningApps.push({name,wine:w});browserInput.wireCanvasInput(c,w.renderer,{runningApps:[{wine:w,relativeMouse:true}],debugMode:true});c.tabIndex=0;c.focus();c.addEventListener('mousedown',()=>c.requestPointerLock(),{once:true});};return true;})()`);
}
async function ready(evaluate,deadline){
 return evaluate(`(async()=>{while(!__redlineLaunch.settled&&Date.now()<${deadline})await new Promise(r=>setTimeout(r,10));if(!__redlineLaunch.settled||__redlineLaunch.error)throw Error(__redlineLaunch.error||'fixture launch deadline');return true;})()`);
}
async function poll(evaluate){
return evaluate(`(async()=>{fixtureEntry.cpu=true;const w=fixture,s=await w.guestWorker.slice(50),e=w.instance.exports;return {at:Date.now(),endpoint:w.guestWorker.link.endpointIdentity,slot:w.guestWorker.link.slot,results:[0x401408,0x40140c,0x401410,0x401414,0x401434,0x401438,0x40143c,0x401440].map(a=>e.guest_read32(a)>>>0),keys:[e.guest_read32(0x401450),e.guest_read32(0x401454)],counts:[e.guest_read32(0x401458),e.guest_read32(0x40145c)],sums:[e.guest_read32(0x401520)|0,e.guest_read32(0x401524)|0],slice:s};})()`);
}
module.exports={prepare,ready,poll};

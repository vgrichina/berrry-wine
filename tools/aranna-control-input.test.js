'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const {pe} = require('../test/test-dll-lifecycle-real-pe');
const {messageOnly} = require('./aranna-control-input');
const U = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const M = {cursor:0x401400, sampleX:0x401408, sampleY:0x40140c, uiX:0x401410, uiY:0x401414};
// These are the generated control's polling instructions, before correction.
const poll = `a.load(M.cursor).store(M.sampleX).e(0x2d, U(400), 0x01, 0x05, U(M.uiX));
  a.load(M.cursor + 4).store(M.sampleY).e(0x2d, U(300), 0x01, 0x05, U(M.uiY));`;
class Code {
  constructor(){this.b=[];this.failures=[];}
  e(...v){this.b.push(...v.flat());return this;}
  load(p){return this.e(0xa1,U(p));}
  store(p){return this.e(0xa3,U(p));}
  set(p,v){return this.e(0xc7,0x05,U(p),U(v));}
  check(p,v){this.load(p).e(0x3d,U(v),0x0f,0x85);this.failures.push(this.b.length);return this.e(0,0,0,0);}
  exit(v){return this.e(0x68,U(v),0xff,0x15,U(0x401900+9*4));}
}
function fixture(){
  const a=new Code();let scenario=0;
  for(const corrected of [false,true])for(const order of ['poll-first','message-first']){
    scenario++;
    a.set(M.uiX,397).set(M.uiY,300).set(M.cursor,402).set(M.cursor+4,155);
    const sample=()=>{vm.runInNewContext(corrected?messageOnly(poll):poll,{a,M,U});a.set(M.cursor,400).set(M.cursor+4,300);};
    // The queued lParam is an immutable snapshot of the physical movement,
    // even if periodic SetCursorPos has since restored the host cursor.
    const message=(x,y)=>a.e(0xb8,U(x),0x2d,U(400),0x01,0x05,U(M.uiX),0xb8,U(y),0x2d,U(300),0x01,0x05,U(M.uiY)).set(M.cursor,400).set(M.cursor+4,300);
    if(order==='poll-first'){sample();message(402,155);}else{message(402,155);sample();}
    const expected=corrected||order==='message-first'?[399,155]:[401,10];
    a.check(M.uiX,expected[0]).check(M.uiY,expected[1]);
    // More idle polling and neutral DOWN/UP must contribute no displacement.
    sample();message(400,300);message(400,300);sample();
    a.check(M.uiX,expected[0]).check(M.uiY,expected[1]);
  }
  a.exit(0);
  for(const [i,at] of a.failures.entries()){
    const target=a.b.length; a.exit(101+i);
    a.b.splice(at,4,...U(target-at-4));
  }
  return pe([[0x2000,a.b]]);
}
test('generated native PE reproduces schedule-dependent double consumption and seals single consumption',()=>{
  const out=path.resolve(process.env.ARANNA_INPUT_TEST_OUT||'scratch/aranna-control-input-test');
  fs.mkdirSync(out,{recursive:true});const exe=path.join(out,'consumer.exe');fs.writeFileSync(exe,fixture());
  const r=cp.spawnSync(process.execPath,['test/run.js','--exe='+exe,'--no-build','--max-seconds=30','--quiet-api','--quiet-blocks'],{encoding:'utf8',timeout:45000,maxBuffer:1024*1024});
  const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,'consumer.log'),output);
  assert.equal(r.status,0,output.slice(-3000));assert.match(output,/\[Exit\] code=0\b/);
});
test('transformation refuses missing, duplicate and already corrected inputs',()=>{
  for(const s of ['',poll+poll,messageOnly(poll)])assert.throws(()=>messageOnly(s),/anchor/);
});

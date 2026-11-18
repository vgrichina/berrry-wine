'use strict';
// Authored PE only: ordinary console -> game top-level, hide, SetCapture.
// No original media, state patch, host focus or capture manipulation.
const assert=require('node:assert/strict');
function fixture(){
  const b=require('./gltron-current-native-capture.cjs').fixture({messageDriven:true});
  const base=0x400000,raw=r=>r-0x1000+0x400,u=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  for(const [thunk,r,name] of [[0x1208,0x1e00,'GetTickCount'],[0x1324,0x1e20,'ShowWindow'],[0x1328,0x1e40,'SetCapture']]){
    b.writeUInt32LE(r,raw(thunk));b.writeUInt16LE(0,raw(r));b.write(name+'\0',raw(r+2));
  }
  b.write('Authored console\0',raw(0x30b0));
  const code=[],emit=(...v)=>code.push(...v),push=n=>emit(0x68,...u(n)),call=a=>emit(0xff,0x15,...u(base+a));
  // The class is registered by the original prefix before this insertion.
  for(const n of [0,base,0,0,360,480,40,40,0x90000000,base+0x30b0,base+0x3000,0])push(n);
  call(0x1304);emit(0xa3,...u(base+0x3620),0x50);call(0x1308);
  const delay=()=>{call(0x1208);emit(0x89,0xc3);const loop=code.length;call(0x1208);emit(0x29,0xd8,0x3d,...u(1500),0x72);emit((loop-(code.length+1))&255);};
  delay();
  const start=raw(0x2000),registration=11;
  assert.equal(b[start],0x68);assert.equal(b[start+5],0xff);
  let end=start+0x780;while(b[end-1]===0)end--;
  const old=Buffer.from(b.subarray(start,end));
  const focusPattern=Buffer.from([0xa3,...u(base+0x3600),0x50,0xff,0x15,...u(base+0x1308)]);
  const focus=old.indexOf(focusPattern);assert(focus>registration);
  const afterFocus=focus+focusPattern.length,prefix=Buffer.from(code);
  code.length=0;delay();push(0);emit(0xff,0x35,...u(base+0x3620));call(0x1324);
  emit(0xff,0x35,...u(base+0x3600));call(0x1328);
  const extra=Buffer.from(code),result=Buffer.concat([old.subarray(0,registration),prefix,
    old.subarray(registration,afterFocus),extra,old.subarray(afterFocus)]);
  assert(result.length<0x800);b.fill(0,start,start+0x800);result.copy(b,start);
  return b;
}
module.exports={fixture};
if(require.main===module)require('node:fs').writeFileSync(process.argv[2],fixture(),{flag:'wx'});

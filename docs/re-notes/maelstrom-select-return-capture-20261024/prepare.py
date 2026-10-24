from work import *
P=pathlib.Path('/tmp/maelstrom-poststart-phase-capture-oct24');R=H/'repo';(R/'tools').mkdir(exist_ok=True)
# Flatten only this checkout's alternates, never donors or refs.
seen=set();ordered=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));ordered.append(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
for line in (R/'.git/objects/info/alternates').read_text().splitlines():visit(line)
(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n')
for n in ['stage.py','capture.cjs','preflight.py','validate-tree.cjs','supervise.py']:
 s=(P/n).read_text().replace(str(P),str(H)).replace('bx_wc4mkcn9','bx_ktknkc9m')
 if n=='supervise.py':
  s=s.replace('1792829290','1792831320').replace('latest start08:08:10UTC','latest start08:42UTC').replace('524288','131072').replace('>90:', '>60:').replace('wall=90','wall=60').replace('shutdown08:15UTC','shutdown08:47UTC').replace('2026-10-24T08:20:57.580Z','2026-10-24T08:53:24.080Z')
 if n=='validate-tree.cjs':s=s.replace("'--trace-at'", "'--trace-at'")
 (H/n).write_text(s)
observer=r'''const assert=require('assert');
function createObserver(emit) {
 let start=null,done=false,bytes=0;
 function sample(batch,e,memory,g2w,tick) {
  const counts=Array.from({length:6},(_,i)=>e.get_count(i)>>>0);
  if(!counts[4]||done)return;
  const eip=e.get_eip()>>>0;
  if(start===null) {if(eip!==0x75040f8)return;start=batch;}
  if(batch!==start && batch!==start+10 && batch!==start+20 && batch!==41999)return;
  const esp=e.get_esp()>>>0,dv=new DataView(memory.buffer);
  const read=(a,n)=> {assert(n<=260);return Array.from(new Uint8Array(memory.buffer,g2w(a),n));};
  const frame=Array.from({length:6},(_,i)=>dv.getUint32(g2w(esp+i*4),true));
  const row={batch,offset:batch-start,eip,esp,counts,tick:{...tick},yield:e.get_yield_reason()|0};
  if(eip===0x75040f8) {
   assert.equal(frame[0],0x7a3362,'authentic select return');
   row.frame=frame;row.timeval=frame[5]?read(frame[5],8):null;
   row.fdsets=frame.slice(2,5).map(a=>a?read(a,Math.min(260,4+dv.getUint32(g2w(a),true)*4)):null);
  }
  const line=JSON.stringify(row);bytes+=Buffer.byteLength(line)+1;assert(bytes<=8192,'diagnostic output guard');emit(line);
  if(batch===41999)done=true;
 }
 return sample;
}
module.exports={createObserver};
'''
(R/'tools/maelstrom-select-observer.cjs').write_text(observer);(H/'observer.cjs').write_text(observer)
preload=r'''const fs=require('fs'),Module=require('module'),crypto=require('crypto'),assert=require('assert');
const root=__dirname,original=Module.prototype._compile;
Module.prototype._compile=function(source,file) {
 if(file===root+'/runner/test/run.js') {
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
  const anchor='    // Handle COM DLL loading yield (yield_reason=3). The pump itself is shared';
  assert.equal(source.split(anchor).length,2);
  const hook=`    globalThis.__maelstromObserver ??= require(${JSON.stringify(root+'/observer.cjs')}).createObserver(line=>console.log('[SELECT-OBS] '+line));
    globalThis.__maelstromObserver(batch,instance.exports,memory,g2w,tickState);
`;
  source=source.replace(anchor,hook+anchor);
 }
 return original.call(this,source,file);
};
require('./capture.cjs');
'''
(H/'preload.cjs').write_text(preload)
a=json.load(open(H/'guest-args.json'));a[2]='--require='+str(H/'preload.cjs');save('guest-args.json',a)
# Test the exact observer entry reachability and all nonmutating reads with a local fixture.
fixture=r'''const {createObserver}=require('./observer.cjs'),assert=require('assert');
const memory={buffer:new ArrayBuffer(4096)},dv=new DataView(memory.buffer);let counts=[0,0,0,0,0,0],eip=0x75040f8;
[0x7a3362,4,200,0,0,240].forEach((x,i)=>dv.setUint32(100+i*4,x,true));dv.setUint32(200,1,true);dv.setUint32(204,42,true);dv.setUint32(240,1,true);
const e=Object.freeze({get_count:i=>counts[i],get_eip:()=>eip,get_esp:()=>100,get_yield_reason:()=>8});let rows=[];const obs=createObserver(x=>rows.push(JSON.parse(x))),before=Buffer.from(memory.buffer).toString('hex');
obs(30000,e,memory,x=>x,{batch:30000,lastTick:6000000});assert.equal(rows.length,0);
counts=[4,0,1,1,1,1];obs(36000,e,memory,x=>x,{batch:36000,lastTick:7200000});
counts=[4,1,1,1,1,10];obs(36010,e,memory,x=>x,{batch:36010,lastTick:7202000});assert.equal(rows.length,2);assert.equal(rows[1].counts[1],1);assert.equal(rows[1].tick.lastTick,7202000);assert.equal(rows[0].frame[0],0x7a3362);assert.equal(before,Buffer.from(memory.buffer).toString('hex'));
assert.throws(()=>createObserver(()=>{})(36000,{...e,get_esp:()=>999999},memory,x=>x,{}));dv.setUint32(100,0xdead,true);assert.throws(()=>createObserver(()=>{})(36000,e,memory,x=>x,{}),/authentic select return/);
console.log(JSON.stringify({pass:true,reachable:true,phaseGate:true,completedReturnControl:true,badPointerRejected:true,wrongReturnRejected:true,readOnly:true,rows}));
'''
(H/'observer-test.cjs').write_text(fixture)
print('prepared')

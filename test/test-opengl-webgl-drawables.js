'use strict';
const assert=require('assert'),vm=require('vm'),fs=require('fs');
const {WebGLBackend}=require('../lib/gpu-backend');
const {Bridge}=require('../lib/gl-render-host');
const Stream=require('../lib/gl-command-stream');
// Shared device contexts restore independent state, and deleting one frontend
// cannot release another frontend's resources or the drawable's attachments.
const device=Object.create(WebGLBackend.prototype),calls=[],deleted=[];
device.gl={deleteBuffer:x=>deleted.push(x),deleteTexture:x=>deleted.push(x),deleteProgram:x=>deleted.push(x)};
device._buffers=new Set();device._textures=new Set();device._programs=new Set();device._boundTextures=new Map();
let next=0;
for(const name of ['createBuffer','createTexture','createProgram'])device[name]=()=>{
  const value=name==='createProgram'?{handle:++next}:{id:++next};
  device[name==='createBuffer'?'_buffers':name==='createTexture'?'_textures':'_programs'].add(value.handle||value);return value;
};
for(const name of ['setViewport','setScissor','setDepthFunc','setDepthMask','setColorMask','setStencilMask','setStencilFunc',
  'setStencilOp','setDepthRange','setPolygonOffset','setBlendFunc','setCullFace','setFrontFace','setLineWidth','setCapability'])device[name]=(...args)=>calls.push([name,...args]);
const a=device.createContextBackend(8,9),b=device.createContextBackend(11,12);
const ab=a.createBuffer(),bb=b.createBuffer(),at=a.createTexture(),bt=b.createTexture(),ap=a.createProgram(),bp=b.createProgram();
a.setViewport(1,2,3,4);a.setColorMask(true,false,false,true);a.setCapability(0xbe2,true);
b.activate();assert(calls.some(v=>JSON.stringify(v)===JSON.stringify(['setViewport',0,0,11,12])));
calls.length=0;a.activate();assert(calls.some(v=>JSON.stringify(v)===JSON.stringify(['setViewport',1,2,3,4])));
assert(calls.some(v=>JSON.stringify(v)===JSON.stringify(['setColorMask',true,false,false,true])));
assert(calls.some(v=>JSON.stringify(v)===JSON.stringify(['setCapability',0xbe2,true])));
a.destroy();assert.deepStrictEqual(deleted,[ab,at,ap.handle]);assert(device._buffers.has(bb));assert(device._textures.has(bt));assert(device._programs.has(bp.handle));b.destroy();
// Stable HWND/geometry is insufficient: replacing its window object is a new
// drawable identity even when it happens between two stream submissions.
const windows={8:{hwnd:8,w:2,h:2}},host=new Bridge({renderer:{windows}});
const first=host._snapshotWindows()[0].descriptor;
assert.strictEqual(host._snapshotWindows()[0].descriptor.generation,first.generation);
windows[8]={...windows[8]};assert.notStrictEqual(host._snapshotWindows()[0].descriptor.generation,first.generation);
const released=[];
class FakeBridge {
  constructor(){this.contexts=new Map();this.currentByOwner=new Map();}
  replay(){return 0;}
  releaseDrawable(id){released.push(id);}
  destroy(){this.destroyed=true;}
}
const context={OpenGLCompat:{OpenGLHostBridge:FakeBridge},GLCommandStream:Stream,Uint8ClampedArray};
vm.runInNewContext(fs.readFileSync(require.resolve('../lib/gl-render-worker'),'utf8'),context);
const endpoint=context.GLRenderWorker.create({instance:{exports:{}},memory:{buffer:new ArrayBuffer(64)},backend:'webgl',sendFrame(){}});
const send=windows=>endpoint.execute({memoryOffset:0,bytes:0,windows});
send([{hwnd:8,generation:1}]);send([{hwnd:8,generation:1}]);assert.deepStrictEqual(released,[]);
send([{hwnd:8,generation:2}]);assert.deepStrictEqual(released,[8]);send([]);assert.deepStrictEqual(released,[8,8]);endpoint.destroy();
console.log('PASS shared GL device context state/resource isolation and worker drawable destruction/reuse');

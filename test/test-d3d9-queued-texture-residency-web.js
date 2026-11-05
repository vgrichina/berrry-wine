#!/usr/bin/env node
'use strict';
// Definitions belong to the ordered draw packet, including levels its shader
// does not sample. Exercise the real receiver/executor on an OS render Worker.
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer');
const Stream=require('../lib/d3d-command-stream');
const {createServer}=require('../tools/dev-server');

async function main(){
  const server=createServer({quiet:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/opt/google/chrome/chrome',
      args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    for(const version of [1,2]){
      const page=await browser.newPage();await page.goto(origin+'/index.html?debug');
      const result=await page.evaluate(async({origin,version,op,streamVersion})=>{
        const files=['gpu-backend','d3d-shader-ir','d3d9-shader','d3d9-fixed','render-clear',
          'd3d9-backend','d3d-command-stream','d3d-geometry-batches','d3d9-software-backend','d3d9-render-worker'];
        const source=`importScripts(${files.map(f=>JSON.stringify(origin+'/lib/'+f+'.js')).join(',')});
          const devices=[];
          const adapter=D3D9RenderWorker.create({backend:'webgl',options:{GPUDevice:class extends D3D9Backend.Device{
            constructor(canvas){super(canvas,{webglVersion:${version}});devices.push(this);}
          }}});
          const receive=D3DCommandStream.createCommandReceiver(adapter,m=>postMessage(m));
          onmessage=e=>{
            if(e.data.inspect){postMessage({inspect:e.data.inspect,devices:devices.map(d=>({version:d.gpu.version,
              resident:[...d.residentPixels.keys()],compositions:d.keyedTextures.size}))});return;}
            receive(e.data);
          };postMessage({ready:true});`;
        const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
        const worker=new Worker(url),messages=[],waiters=[];
        worker.onmessage=e=>{messages.push(e.data);for(const poll of [...waiters])poll();};
        const until=predicate=>new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('queued residency deadline')),15000);
          const poll=()=>{const value=messages.find(predicate);if(value){clearTimeout(timer);waiters.splice(waiters.indexOf(poll),1);resolve(value);}};
          waiters.push(poll);poll();
        });
        const sequences=new Map();
        const send=(id,opcode,payload)=>{
          const sequence=(sequences.get(id)||0)+1;sequences.set(id,sequence);
          worker.postMessage({t:'d3d-command',command:{version:streamVersion,deviceId:id,generation:1,sequence,opcode,payload,resources:[],byteLength:32}});
          return {id,sequence};
        };
        const done=({id,sequence})=>until(m=>m.deviceId===id&&m.sequence===sequence&&['completed','failed'].includes(m.phase));
        const inspect=async label=>{worker.postMessage({inspect:label});return (await until(m=>m.inspect===label)).devices;};
        const level=(key,rgba)=>({width:1,height:1,key,...(rgba?{pixels:new Uint8Array(rgba)}:{})});
        const draw=(image,sampled=true)=>{
          const vertices=new Uint8Array(72),v=new DataView(vertices.buffer);
          [[-1,1],[3,1],[-1,-3]].forEach(([x,y],i)=>{
            [x,y,.5].forEach((c,k)=>v.setFloat32(i*24+k*4,c,true));vertices.set([255,255,255,255],i*24+12);
            v.setFloat32(i*24+16,.5,true);v.setFloat32(i*24+20,.5,true);
          });
          return {primitive:4,primitiveCount:1,stride:24,vertices,
            attributes:[{register:0,usage:0,usageIndex:0,type:2,offset:0},{register:1,usage:10,usageIndex:0,type:4,offset:12},{register:2,usage:5,usageIndex:0,type:1,offset:16}],
            vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]),
            pixelShader:sampled?new Uint32Array([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]):new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]),
            textures:[{...image,sampler:{min:1,mag:1,mip:0,addressU:3,addressV:3}}],state:{zenable:false,cull:1}};
        };
        const read=async id=>{
          const result=await done(send(id,op.READBACK,{}));
          return {phase:result.phase,error:result.error,pixel:result.value?.pixels?Array.from(result.value.pixels.slice(144,148)):null};
        };
        try{
          await until(m=>m.ready);
          await done(send(7,op.RESOURCE_CREATE,{kind:'device',width:8,height:8}));
          // Both packets are published before completion. Changing the caller's
          // array after posting must not change the retained definition.
          const offered=level('dormant',[40,80,120,255]);
          const first=send(7,op.DRAW,draw(offered,false));offered.pixels.fill(0);
          const second=send(7,op.DRAW,draw(level('dormant')));
          const initial=[await done(first),await done(second)],initialPixel=await read(7);
          const replacement=draw(level('dormant',[160,80,40,255]),false);
          replacement.textureReleases=['dormant'];
          const replace=send(7,op.DRAW,replacement),reuse=send(7,op.DRAW,draw(level('dormant')));
          const replaced=[await done(replace),await done(reuse)],replacementPixel=await read(7);
          // A later LOD composition needs bytes from a previously unused mip.
          const top={width:2,height:2,key:'top',pixels:new Uint8Array(16).fill(255)};
          const bottom=level('bottom',[20,100,200,255]);
          const mipOffer=send(7,op.DRAW,draw({...top,levels:[top,bottom]},false));
          const mipUse=send(7,op.DRAW,draw({...level('bottom'),levels:[level('bottom')]}));
          const mips=[await done(mipOffer),await done(mipUse)],mipPixel=await read(7);
          await done(send(7,op.DRAW,draw(level('never-sampled',[1,2,3,255]),false)));
          const beforeReset=await inspect('before-reset');
          await done(send(7,op.RESOURCE_UPDATE,{kind:'reset',width:8,height:8}));
          const afterReset=await inspect('after-reset');
          const missing=await done(send(7,op.DRAW,draw(level('never-sampled'))));
          await done(send(8,op.RESOURCE_CREATE,{kind:'device',width:8,height:8}));
          await done(send(8,op.DRAW,draw(level('other-device',[10,30,50,255]))));
          const otherPixel=await read(8);
          await done(send(9,op.RESOURCE_CREATE,{kind:'device',width:8,height:8}));
          const malformed=await done(send(9,op.DRAW,draw(level('bad-definition',[1,2,3]),false)));
          return {initial,initialPixel,replaced,replacementPixel,mips,mipPixel,beforeReset,afterReset,missing,otherPixel,malformed};
        }finally{worker.terminate();URL.revokeObjectURL(url);}
      },{origin,version,op:Stream.OPCODES,streamVersion:Stream.VERSION});
      await page.close();
      for(const r of [...result.initial,...result.replaced,...result.mips])assert.equal(r.phase,'completed',`WebGL${version}: ${r.error?.message}`);
      assert.deepEqual(result.initialPixel.pixel,[120,80,40,255],'unused-stage definition survives queue copies');
      assert.deepEqual(result.replacementPixel.pixel,[40,80,160,255],'release precedes same-key redefinition');
      assert.deepEqual(result.mipPixel.pixel,[200,100,20,255],'an unused lower mip survives composition changes');
      assert(result.beforeReset[0].resident.includes('never-sampled'));
      assert.equal(result.beforeReset[0].version,version);
      assert.deepEqual(result.afterReset[0].resident,[],'reset retires definitions without GL compositions too');
      assert.equal(result.afterReset[0].compositions,0);
      assert.equal(result.missing.phase,'failed');assert.match(result.missing.error.message,/texture not resident/);
      assert.deepEqual(result.otherPixel.pixel,[50,30,10,255],'other device still renders after the expected refusal');
      assert.equal(result.malformed.phase,'failed');assert.match(result.malformed.error.message,/invalid mip level/);
    }
    console.log('PASS queued WebGL1/2 texture definitions: unused stages/mips, snapshot ownership, ordered release/redefinition, reset and device isolation');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

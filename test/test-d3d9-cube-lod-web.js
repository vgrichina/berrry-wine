#!/usr/bin/env node
'use strict';
// Real pixels: each face, level and texel carries different data. The oracle
// applies the native reference's face-local quad footprint and filter policy.
const assert=require('assert'),path=require('path');
let puppeteer;try{puppeteer=require('puppeteer');}catch(e){puppeteer=require('puppeteer-core');}
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage(),root=process.env.D3D9_SOURCE_ROOT||path.join(__dirname,'..');
  for(const file of ['gpu-backend.js','d3d9-shader.js','d3d9-fixed.js','render-clear.js','d3d9-backend.js'])
   await page.addScriptTag({path:path.join(root,'lib',file)});
  const results=await page.evaluate(()=>{
   const results=[],identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
   const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,
    1,0xe00f0000,0x90e40002,1,0xe00f0001,0x90e40002,0xffff]);
   const texel=(f,l,x,y)=>[20+30*f+7*l,15+45*l+7*x,10+11*y+3*f,255];
   const uv=(d,f)=>{const [x,y,z]=d;return (f<2?[f===0?-z:z,-y,Math.abs(x)]:
    f<4?[x,f===2?z:-z,Math.abs(y)]:[f===4?x:-x,-y,Math.abs(z)]).slice(0,2)
     .map(v=>.5*(v/(f<2?Math.abs(x):f<4?Math.abs(y):Math.abs(z))+1));};
   const face=d=>{const a=d.map(Math.abs);return a[0]>=a[1]&&a[0]>=a[2]?(d[0]<0?1:0):a[1]>=a[2]?(d[1]<0?3:2):(d[2]<0?5:4);};
   const add=(d,g,k)=>d.map((v,i)=>v+g[i]*k);
   const sample=(d,gx,gy,x,y,s,base,count)=>{
    const f=face(d),p=uv(d,f),nx=uv(add(d,gx,x%2?-1:1),f),ny=uv(add(d,gy,y%2?-1:1),f);
    const rho=Math.max(...[nx,ny].map(q=>q.reduce((sum,v,i)=>sum+(16*(v-p[i]))**2,0)));
    const lambda=.5*Math.log2(Math.max(1e-30,Math.min(1e30,rho)))+s.lodBias;
    const filter=lambda<=0?s.mag:s.min,lo=Math.min(base+count-1,Math.max(base,s.maxMipLevel));
    let level=s.mip===0?lo:Math.min(base+count-1,Math.max(lo,lambda));
    if(s.mip===1)level=Math.floor(level+.5);
    const at=l=>{const size=Math.max(1,16>>l),q=p.map(v=>Math.min(1,Math.max(0,v))*size);
     const tap=(x,y)=>texel(f,l,Math.max(0,Math.min(size-1,x)),Math.max(0,Math.min(size-1,y)));
     if(filter===1)return tap(...q.map(Math.floor));
     const z=q.map(v=>v-.5),a=z.map(Math.floor),t=z.map((v,i)=>v-a[i]);
     const c=[tap(a[0],a[1]),tap(a[0]+1,a[1]),tap(a[0],a[1]+1),tap(a[0]+1,a[1]+1)];
     return c[0].map((v,i)=>(v*(1-t[0])+c[1][i]*t[0])*(1-t[1])+(c[2][i]*(1-t[0])+c[3][i]*t[0])*t[1]);};
    const a=at(Math.floor(level));if(s.mip!==2)return a;
    const b=at(Math.ceil(level)),t=level%1;return a.map((v,i)=>v*(1-t)+b[i]*t);
   };
   for(const version of [1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
    const device=new D3D9Backend.Device(canvas,{webglVersion:version}),gpu=device.gpu,gl=gpu.gl;
    try{
     const run=(label,d,gx,gy,s,base,count,stage,programmed,keyed=false,resources=false)=>{
      const faces=Array.from({length:6},(_,f)=>({levels:Array.from({length:count},(_,i)=>{
       const l=base+i,size=16>>l,pixels=new Uint8Array(size*size*4);
       for(let y=0;y<size;y++)for(let x=0;x<size;x++)pixels.set(texel(f,l,x,y),(y*size+x)*4);
       const level={width:size,height:size,pixels};
       if(resources){
        const resource={id:100+f*12+l,width:size,height:size,format:21},bgra=pixels.slice();
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
         const src=(y*size+x)*4,dst=src;
         bgra[dst]=pixels[src+2];bgra[dst+1]=pixels[src+1];bgra[dst+2]=pixels[src];bgra[dst+3]=pixels[src+3];
        }
        if(device.colorTargets.has(resource.id))device.updateColor(resource,bgra,size*4);
        else device.createColor(resource,bgra,size*4);
        level.resource=resource;delete level.pixels;
       }
       if(keyed){level.key=`cube-${base}-${count}-${f}-${l}`;device.residentPixels.set(level.key,pixels);delete level.pixels;}
       return level;
      })}));
      const cube={width:16>>base,height:16>>base,faces,sampler:{addressU:3,addressV:3,...s},
       baseLOD:base,originalWidth:16,originalHeight:16};
      const vertices=new Float32Array([[-1,-1,0,0],[3,-1,16,0],[-1,3,0,16]].flatMap(([x,y,u,v])=>
       [x,y,.5,1,1,1,1,1,...d.map((a,i)=>a+gx[i]*u+gy[i]*v),1]));
      const t=0xb0000000|stage,ps=new Uint32Array([0xffff0101,66,(t|0xf0000)>>>0,1,0x800f0000,(t|0xe40000)>>>0,0xffff]);
      const sampleStage={colorOp:2,colorArg1:2,alphaOp:2,alphaArg1:2,texCoordIndex:stage,transformFlags:0};
      const draw={primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),vertexShader:vs,
       pixelShader:programmed?ps:null,attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},
        {register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:3,offset:32}],
       textures:stage?[null,cube]:[cube],state:{cull:1,zenable:false},fixedFunction:{lighting:false,fog:false,specular:false,
        world:identity,view:identity,projection:identity,stages:stage?[{...sampleStage,colorArg1:0,alphaArg1:0},sampleStage,{colorOp:1}]:[sampleStage,{colorOp:1}]}};
      device.draw(draw);
      for(const [x,y] of [[2,2],[3,3],[4,4],[5,5]]){
       const direction=add(add(d,gx,x),gy,y+1),expected=sample(direction,gx,gy,x,y,s,base,count);
       const pixel=Array.from(gpu.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
       results.push({version,label,base,count,stage,programmed,keyed,s,x,y,pixel,expected,error:gpu.getError()});
      }
     };
     for(const stage of [0,1])for(const programmed of [false,true])for(let f=0;f<6;f++){
      const d=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]][f];
      const tangent=f<2?2:0,gx=[0,0,0],gy=[0,0,0];gx[tangent]=.23;gy[f<2?1:f<4?2:1]=.117;
      for(const bias of [-1.5,-.5,0,.5,1.5])for(const mip of [0,1,2])for(const max of [0,2,99])
       run(`face${f}`,d,gx,gy,{min:2,mag:1,mip,lodBias:bias,maxMipLevel:max},0,5,stage,programmed);
     }
     // Partial chains, residency, keyed reuse and differing min/mag filters.
     for(const base of [0,1,2])for(const count of [1,3-base])for(const min of [1,2])for(const mag of [1,2])
      run('resident/partial',[1,.12,-.13],[0,0,.04],[0,.03,0],{min,mag,mip:2,lodBias:-.5,maxMipLevel:1},base,count,0,true,true);
     for(let repeat=0;repeat<2;repeat++)for(const bias of [-.5,1.5])
      run('GPU resource faces',[1,.12,-.13],[0,0,.04],[0,.03,0],
       {min:2,mag:1,mip:2,lodBias:bias,maxMipLevel:1},0,3,0,true,false,true);
     // Adjacent lanes choose different faces. Same-face helper projection must
     // prevent a discontinuity in LOD at the +X/+Z boundary.
     for(const bias of [-.5,.5])run('face edge',[1,.1,.3],[0,0,.16],[0,.02,0],
      {min:2,mag:2,mip:2,lodBias:bias,maxMipLevel:0},0,5,1,true);
     const bad={width:16,height:16,faces:Array.from({length:6},()=>({width:16,height:16,pixels:new Uint8Array(1024)})),
      sampler:{addressU:3,addressV:3,lodBias:-.5,min:1,mag:2}};
     for(const change of [{sampler:{...bad.sampler,addressU:1}},{faces:bad.faces.slice(1)},
      {sampler:{...bad.sampler,lodBias:NaN}},{sampler:{...bad.sampler,maxMipLevel:-1}},
      {faces:bad.faces.map((f,i)=>i?f:{...f,width:8})}]){
      let caught=false;try{device.uploadTexture(0,{...bad,...change},true);}catch(e){caught=true;}
      if(!caught)throw Error('unsupported/invalid cube metadata accepted');
     }
    }finally{device.destroy();}
   }
   return results;
  });
  for(const r of results){assert.strictEqual(r.error,0,JSON.stringify(r));assert(r.pixel.every((v,i)=>Math.abs(v-r.expected[i])<=2),JSON.stringify(r));}
  assert(results.length>7000);console.log(`PASS cube LOD ${results.length} WebGL1/2 pixel checks: six faces, fixed/programmed PS, stages, bias, MAXMIPLEVEL, point/linear/no mip, min/mag, residency, partial chains, keys and face-edge derivatives`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

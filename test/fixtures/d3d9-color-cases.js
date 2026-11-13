(function(root){'use strict';
 const draw=(resource,depth,z=.5)=>({primitive:4,primitiveCount:1,stride:16,
  vertices:new Uint8Array(new Float32Array([-1,-1,z,1,31,-1,z,1,-1,31,z,1]).buffer),
  attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0}],vertexShader:null,pixelShader:null,textures:[],
  colorAttachment:resource,depthAttachment:depth,state:{zenable:!!depth,zwrite:true,zfunc:2,cull:1},
  fixedFunction:{lighting:false,specular:false,fog:false,textureFactor:0xffffffff,
   stages:[{colorOp:2,colorArg1:6,colorArg2:1,alphaOp:2,alphaArg1:6,alphaArg2:1,constant:0x40ff0000,texCoordIndex:0,transformFlags:0},{colorOp:1}]}});
 async function run(api){
  let checked=0;const check=(condition,label)=>{if(!condition)throw Error(label);checked++;};
  const solid=(frame,rgba,label)=>{const expected=[rgba[2],rgba[1],rgba[0],rgba[3]];
   check(frame.pixels.every((v,i)=>Math.abs(v-expected[i%4])<=1),label+' '+Array.from(frame.pixels.slice(0,4)));};
  const a={id:101,width:4,height:3,format:21},b={id:102,width:6,height:5,format:22},depth={id:103,width:8,height:8,format:75};
  await api.clear([0,0,1,1],1,1,null,null,0);await api.create(a);await api.create(b);
  await api.clear([0,1,0,.5],1,1,null,null,0,a);await api.clear([1,1,0,.25],1,1,null,null,0,b);
  solid(await api.read(a),[0,255,0,128],'A retains independent green');solid(await api.read(b),[255,255,0,255],'B X8 forces alpha');
  await api.draw(draw(a,null));solid(await api.read(a),[255,0,0,64],'draw selects smaller A');solid(await api.read(b),[255,255,0,255],'drawing A preserves B');
  solid(await api.present(),[0,0,255,255],'Present remains implicit while A bound');
  const upload=new Uint8Array(a.height*24);for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)upload.set([y*30,x*40,70,100],y*24+x*4);
  await api.update(a,upload,24);const frame=await api.read(a);
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)check(Array.from(frame.pixels.slice((y*a.width+x)*4,(y*a.width+x+1)*4)).join()===Array.from(upload.slice(y*24+x*4,y*24+x*4+4)).join(),'upload/readback pitch and orientation');
  // Upload a pitched subrectangle over a backend-owned draw. Outside pixels
  // must survive; no stale CPU shadow is authoritative after rendering.
  await api.draw(draw(a,null));
  const patch=new Uint8Array([10,20,30,40,50,60,70,80,99,99,99,99,90,100,110,120,130,140,150,160,99,99,99,99]);
  await api.update(a,patch,12,{x:1,y:1,width:2,height:2});
  const patched=await api.read(a);
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
   const want=x>=1&&x<3&&y>=1?Array.from(patch.slice((y-1)*12+(x-1)*4,(y-1)*12+x*4)):[0,0,255,64];
   check(Array.from(patched.pixels.slice((y*a.width+x)*4,(y*a.width+x+1)*4)).join()===want.join(),'rect upload preserves draw/orientation '+x+','+y);
  }
  await api.update(b,new Uint8Array([1,2,3,4]),4,{x:5,y:0,width:1,height:1});
  check(Array.from((await api.read(b)).pixels.slice(20,24)).join()==='1,2,3,255','rect upload X8 alpha and top edge');
  await api.clear([0,0,1,.25],1,1,null,null,0);
  await api.update(null,new Uint8Array([9,8,7,6,5,4,3,2]),4,{x:7,y:0,width:1,height:2});
  const back=await api.present();
  check(Array.from(back.pixels.slice(28,32)).join()==='9,8,7,255','implicit top-right upload');
  check(Array.from(back.pixels.slice(60,64)).join()==='5,4,3,255','implicit second row upload');
  check(Array.from((await api.read(null)).pixels.slice(0,4)).join()==='255,0,0,64','implicit outside pixels including alpha survive');
  check((await api.read(a)).pixels.every((v,i)=>v===patched.pixels[i]),'implicit upload preserves explicit target');
  const sourcePixels=new Uint8Array(a.width*a.height*4);
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)sourcePixels.set([x*40+y*10,y*60,x*50,40+x*20+y*30],(y*a.width+x)*4);
  await api.update(a,sourcePixels,a.width*4);
  for(const [sr,dr]of [
    [{x:1,y:0,width:2,height:3},{x:2,y:1,width:3,height:3}],
    [{x:0,y:0,width:4,height:3},{x:1,y:1,width:2,height:2}],
    [{x:3,y:2,width:1,height:1},{x:0,y:0,width:6,height:5}],
  ]){
  for(const filter of[0,1,2]){
    await api.clear([0,0,1,1],1,1,null,null,0,b);
    await api.copy({source:a,destination:b,sourceRect:sr,destinationRect:dr,filter});
    const copied=await api.read(b);
    for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)for(let c=0;c<4;c++){
      let want=c===0||c===3?255:0;
      if(x>=dr.x&&x<dr.x+dr.width&&y>=dr.y&&y<dr.y+dr.height){
        const px=(x-dr.x+.5)*sr.width/dr.width,py=(y-dr.y+.5)*sr.height/dr.height;
        const at=(sx,sy)=>sourcePixels[((sy+sr.y)*a.width+sx+sr.x)*4+c];
        if(filter===2){
          const fx=Math.max(0,Math.min(sr.width-1,px-.5)),fy=Math.max(0,Math.min(sr.height-1,py-.5));
          const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(sr.width-1,x0+1),y1=Math.min(sr.height-1,y0+1);
          const wx=fx-x0,wy=fy-y0;
          want=Math.round(at(x0,y0)*(1-wx)*(1-wy)+at(x1,y0)*wx*(1-wy)+at(x0,y1)*(1-wx)*wy+at(x1,y1)*wx*wy);
        }else want=at(Math.floor(px),Math.floor(py));
        if(c===3)want=255;
      }
      check(Math.abs(copied.pixels[(y*b.width+x)*4+c]-want)<=1,'copy pixel/filter '+[filter,x,y,c,want,copied.pixels[(y*b.width+x)*4+c]]);
    }
  }
  }
  await api.copy({source:a,destination:null,sourceRect:{x:0,y:0,width:4,height:3},destinationRect:{x:1,y:2,width:4,height:3},filter:1});
  await api.copy({source:null,destination:a,sourceRect:{x:1,y:2,width:4,height:3},destinationRect:{x:0,y:0,width:4,height:3},filter:1});
  const roundtrip=await api.read(a);
  check(roundtrip.pixels.every((v,i)=>v===sourcePixels[i]),'explicit/implicit copy orientation and A8 alpha');
  await api.clear([0,0,1,1],1,1,null,null,0);
  await api.clear([0,0,0,1],7,1,null,depth,0,a);await api.draw(draw(a,depth,.25));
  await api.clear([0,1,0,1],1,1,null,depth,0,b);await api.draw(draw(b,depth,.75));
  const shared=await api.read(b);check(shared.pixels[1]===255&&shared.pixels[2]===0,'same depth identity rejects B behind A');
  const lower=(4*b.width+5)*4;check(shared.pixels[lower+2]===255,'B outside A extent uses untouched shared depth');
  solid(await api.read(a),[255,0,0,64],'shared depth switch preserves A color');
  await api.release(a.id);check((await api.read(b)).pixels.every((v,i)=>v===shared.pixels[i]),'release A preserves B');
  await api.release(b.id);solid(await api.present(),[0,0,255,255],'released colors never become backbuffer');
  return checked;
 }
 const api={draw,run};if(typeof module!=='undefined')module.exports=api;else root.D3D9ColorCases=api;
})(typeof globalThis!=='undefined'?globalThis:this);

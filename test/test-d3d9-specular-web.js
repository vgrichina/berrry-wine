'use strict';
const assert=require('assert'),path=require('path');
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
// The software compiler must still refuse specular before allocating anything.
const SoftwareDevice=require('../lib/d3d9-software-backend').Device;
assert.throws(()=>SoftwareDevice.prototype.fixedPrograms.call({},
 {fixedFunction:{specular:true,stages:[{colorOp:1}]}},null,null),/not implemented: specular/);
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  for(const file of['lib/gpu-backend.js','lib/d3d9-shader.js','lib/render-clear.js','lib/d3d9-backend.js','test/fixtures/d3d9-lighting-cases.js'])
   await page.addScriptTag({path:path.join(__dirname,'..',file)});
  const results=await page.evaluate(()=>{
   const f=a=>new Float32Array(a),out=[];
   const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const l=Math.sqrt(dot(a,a));return l>0?a.map(v=>v/l):[0,0,0];};
   for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
    const device=new D3D9Backend.Device(canvas,{webglVersion:version}),g=device.gpu,gl=g.gl;
    try{
     const cases=[];
     const add=(name,edit=()=>{})=>{
      const d=D3D9LightingCases.draw(),s=d.fixedFunction;
      s.specular=true;s.localViewer=false;s.specularMaterialSource=0;s.material.power=4;
      s.material.diffuse=f([0,0,0,.75]);s.material.specular=f([.5,.25,.125,.01]);
      s.lights[0].diffuse.fill(0);s.lights[0].specular=f([1,1,1,.01]);
      edit(d,s);cases.push({name,d});
     };
     add('directional');
     for(const power of[0,1,2,20])add('oblique power '+power,(d,s)=>{s.material.power=power;s.lights[0].direction=f([1,0,-1]);});
     add('disabled',(d,s)=>s.specular=false);
     for(const source of[0,1,2])add('material source '+source,(d,s)=>s.specularMaterialSource=source);
     for(const source of[1,2])add('missing source '+source,(d,s)=>{s.specularMaterialSource=source;d.attributes=d.attributes.filter(a=>a.usage!==10||a.usageIndex!==source-1);});
     add('COLORVERTEX off',(d,s)=>{s.specularMaterialSource=2;s.colorVertex=false;});
     add('default COLOR2 source',(d,s)=>delete s.specularMaterialSource);
     add('light color',(d,s)=>s.lights[0].specular=f([.25,.5,1,1]));
     add('sum then clamp',(d,s)=>{s.material.specular.fill(1);s.lights=Array.from({length:8},()=>({...s.lights[0],specular:f([.2,.1,.05,1])}));});
     add('backface',(d,s)=>s.lights[0].direction=f([0,0,1]));
     add('backface with positive half dot',(d,s)=>s.lights[0].direction=f([1,0,1]));
     add('zero direction power zero',(d,s)=>{s.material.power=0;s.lights[0].direction.fill(0);});
     add('missing normal power zero',(d,s)=>{s.material.power=0;d.attributes=d.attributes.filter(a=>a.usage!==3);});
     add('perpendicular power zero',(d,s)=>{s.material.power=0;s.lights[0].direction=f([1,0,0]);});
     add('missing normal',(d,s)=>d.attributes=d.attributes.filter(a=>a.usage!==3));
     add('zero normal power zero',(d,s)=>{s.material.power=0;const v=new Float32Array(d.vertices.buffer);for(let i=0;i<3;i++)v[i*15+5]=0;});
     add('finite viewer zero at one vertex',(d,s)=>{s.localViewer=true;const v=new Float32Array(d.vertices.buffer);
      [[0,0,0],[-4,4,.5],[4,4,.5]].forEach((p,i)=>v.set(p,i*15));});
     for(const normalize of[false,true])add('inverse transpose '+normalize,(d,s)=>{s.world[10]=2;s.projection[10]=.5;s.normalizeNormals=normalize;});
     add('view normal transform',(d,s)=>{s.view[10]=2;s.projection[10]=.5;});
     add('local viewer',(d,s)=>{s.localViewer=true;s.lights[0].direction=f([1,0,-1]);});
     add('translated local viewer',(d,s)=>{s.localViewer=true;s.world[12]=.25;s.view[13]=.125;s.lights[0].direction=f([1,0,-1]);});
     for(const type of[1,2])for(const kind of['constant','linear','quadratic','range','cone','penumbra','coincident'])add('light '+type+' '+kind,(d,s)=>{
      s.lights=[{...s.lights[0],type,position:f([0,0,10]),direction:f([0,0,-1]),range:100,
       attenuation0:2,attenuation1:0,attenuation2:0,theta:.2,phi:1.2,falloff:2}];
      const l=s.lights[0];if(kind==='linear'){l.attenuation0=0;l.attenuation1=.2;}
      if(kind==='quadratic'){l.attenuation0=0;l.attenuation2=.02;}
      if(kind==='range')l.range=1;
      if(kind==='cone')l.direction=f([0,0,1]);
      if(kind==='penumbra')l.direction=f([.3,0,-1]);
      if(kind==='coincident'){l.position=f([-1,1,.5]);s.material.power=0;}
     });
     add('post texture RGB and alpha',(d,s)=>{
      d.textures=[{width:1,height:1,pixels:new Uint8Array([0,0,0,64]),sampler:{min:1,mag:1,addressU:3,addressV:3}}];
      s.stages[0].colorArg1=s.stages[0].alphaArg1=2;
     });
     // Independent scalar reference: evaluate at each vertex, clamp there,
     // then interpolate at GL pixel (1,2), including the D3D pixel bias.
     for(const {name,d}of cases){
      const s=d.fixedFunction,v=new Float32Array(d.vertices.buffer);
      const colors=[0,1,2].map(i=>{
       const p=Array.from(v.slice(i*15,i*15+3)).map((x,j)=>(x*s.world[j*5]+s.world[12+j])*s.view[j*5]+s.view[12+j]);
       let n=d.attributes.some(a=>a.usage===3)?Array.from(v.slice(i*15+3,i*15+6)).map((x,j)=>x/(s.world[j*5]*s.view[j*5])):[0,0,0];
       if(s.normalizeNormals)n=norm(n);
       const eye=s.localViewer?norm(p.map(x=>-x)):[0,0,1],sum=[0,0,0];
       for(const l of s.lights){
        let L,atten=1;
        if(l.type===3)L=norm(Array.from(l.direction).map((x,j)=>-x*s.view[j*5]));
        else{
         const delta=Array.from(l.position).map((x,j)=>x*s.view[j*5]-p[j]),distance=Math.sqrt(dot(delta,delta));L=norm(delta);
         atten=distance>l.range?0:1/(l.attenuation0+l.attenuation1*distance+l.attenuation2*distance*distance);
         if(l.type===2){const rho=dot(L.map(x=>-x),norm(Array.from(l.direction))),inner=Math.cos(l.theta/2),outer=Math.cos(l.phi/2);
          atten*=rho>=inner?1:rho<=outer?0:Math.pow((rho-outer)/(inner-outer),l.falloff);}
        }
        const nh=Math.max(dot(n,norm(eye.map((x,j)=>x+L[j]))),0);
        if(dot(n,L)>0&&dot(eye,eye)>0&&nh>0)for(let j=0;j<3;j++)sum[j]+=l.specular[j]*Math.pow(nh,s.material.power)*atten;
       }
       const source=s.specularMaterialSource??2,a=d.attributes.find(a=>a.usage===10&&a.usageIndex===source-1);
       const material=s.colorVertex!==false&&source&&a?Array.from(v.slice(i*15+a.offset/4,i*15+a.offset/4+4)):s.material.specular;
       return sum.map((x,j)=>s.specular?Math.max(0,Math.min(1,x*material[j])):0);
      });
      const screen=[0,1,2].map(i=>[0,1].map(j=>{
       const camera=(v[i*15+j]*s.world[j*5]+s.world[12+j])*s.view[j*5]+s.view[12+j];
       return 2+(j===0?2:-2)*camera*s.projection[j*5]+.4375;
      }));
      const [a,b,c]=screen,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
      const wa=((b[1]-c[1])*(1.5-c[0])+(c[0]-b[0])*(1.5-c[1]))/area;
      const wb=((c[1]-a[1])*(1.5-c[0])+(a[0]-c[0])*(1.5-c[1]))/area;
      const weights=[wa,wb,1-wa-wb];
      const expected=[0,1,2].map(j=>255*colors.reduce((sum,c,i)=>sum+c[j]*weights[i],0));expected.push(d.textures.length?64:191.25);
      device.clear([0,0,0,0],1);device.draw(d);
      out.push({version,name,expected,pixel:Array.from(g.readPixels(1,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))),error:g.getError()});
     }
     const mixed=cases[0].d;mixed.pixelShader=new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]);
     let rejected=false;try{device.draw(mixed);}catch(e){rejected=/programmed pixel post-specular/.test(e.message);}if(!rejected)throw Error('mixed PS guard lost');
    }finally{device.destroy();}
   }return out;
  });
  for(const r of results){assert.strictEqual(r.error,0,JSON.stringify(r));r.pixel.forEach((v,i)=>assert(Math.abs(v-r.expected[i])<=2,JSON.stringify(r)));}
  console.log(JSON.stringify(results,null,2));console.log('PASS WebGL1/2 specular '+results.length+' actual pixel cases');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

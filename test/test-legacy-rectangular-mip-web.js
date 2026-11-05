#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),vm=require('node:vm');
const ROOT=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const formats=[{name:'16x4',width:16,height:4,pf:[32,0x40,0,32,0xff0000,0xff00,255,0]},
  {name:'4x16',width:4,height:16,pf:[32,0x40,0,32,0xff0000,0xff00,255,0]}];

// Independent public-coordinate reference, without renderer helper calls.
// For a right triangle, A=offset*Q + span*q_i*(coordinate/32).
// Differentiate rational A/Q before address mapping, then scale each axis
// by its own base image extent. See documentation in the accompanying note.
function oracle(colors,state,sample){
  const {x,y}=sample,q=state.q||[1,1,1],n=state.span;
  const Q=q[0]+(q[1]-q[0])*x/32+(q[2]-q[0])*y/32;
  const U=n[0]*q[1]*x/32,V=n[1]*q[2]*y/32;
  const Qx=(q[1]-q[0])/32,Qy=(q[2]-q[0])/32;
  const ux=(n[0]*q[1]/32*Q-U*Qx)/(Q*Q),uy=-U*Qy/(Q*Q);
  const vx=-V*Qx/(Q*Q),vy=(n[1]*q[2]/32*Q-V*Qy)/(Q*Q);
  const width=colors[0][0].length,height=colors[0].length;
  const rho=Math.sqrt(Math.max((width*ux)**2+(height*vx)**2,(width*uy)**2+(height*vy)**2));
  const lod=Math.max(0,Math.min(colors.length-1,Math.log2(rho)));
  const u=state.offset[0]+U/Q,v=state.offset[1]+V/Q;
  const exact=a=>Object.assign(a,{bounds:a.map(c=>[c,c])});
  // Same pre-existing one 8-bit filter fraction / byte-rounding envelope.
  const mix=(a,b,t)=>{
    const out=a.map((c,i)=>c*(1-t)+b[i]*t);
    out.bounds=a.map((c,i)=>{
      const aa=a.bounds[i],bb=b.bounds[i];
      if(aa[0]===aa[1]&&bb[0]===bb[1]&&aa[0]===bb[0])return aa.slice();
      const values=[];
      for(const x of aa)for(const y of bb)for(const w of [Math.max(0,t-1/256),Math.min(1,t+1/256)])values.push(x*(1-w)+y*w);
      return [Math.max(0,Math.min(...values)-1),Math.min(255,Math.max(...values)+1)];
    });return out;
  };
  const at=level=>{
    const grid=colors[level],h=grid.length,w=grid[0].length;
    const index=(i,d,mode)=>mode===3?Math.max(0,Math.min(d-1,i)):((i%d)+d)%d;
    const tap=(x,y)=>exact([...grid[index(y,h,state.address[1])][index(x,w,state.address[0])].rgb,255]);
    if((rho<=1?state.mag:state.min)===1)return tap(Math.floor(u*w),Math.floor(v*h));
    const sx=u*w-.5,sy=v*h-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    return mix(mix(tap(ix,iy),tap(ix+1,iy),fx),mix(tap(ix,iy+1),tap(ix+1,iy+1),fx),fy);
  };
  let rgba;
  if(state.mip===1)rgba=at(0);
  else if(state.mip===2)rgba=at(Math.floor(lod+.5));
  else {const lo=Math.floor(lod);rgba=mix(at(lo),at(Math.min(colors.length-1,lo+1)),lod-lo);}
  const rgb=rgba.slice(0,3);rgb.bounds=rgba.bounds.slice(0,3);rgb.alpha=255;rgb.alphaBounds=[255,255];
  rgb.projection={u,v,rho,lod,ux,uy,vx,vy,Q};return rgb;
}

// A second, finite-quad construction of the affine homogeneous planes.
// This never finite-differences the already divided texture coordinates.
function finiteQuad(state,sample,width,height){
  const q=state.q||[1,1,1],plane=(x,y)=>{
    const Q=q[0]*(1-x/32-y/32)+q[1]*x/32+q[2]*y/32;
    return [state.offset[0]*Q+state.span[0]*q[1]*x/32,
      state.offset[1]*Q+state.span[1]*q[2]*y/32,Q];
  };
  const x0=2*Math.floor(sample.x/2),y0=2*Math.floor(sample.y/2);
  const a=plane(x0,y0),b=plane(x0+1,y0),c=plane(x0,y0+1),p=plane(sample.x,sample.y);
  const uv=[p[0]/p[2],p[1]/p[2]];
  const derivative=t=>[width*((t[0]-a[0])-uv[0]*(t[2]-a[2]))/p[2],
    height*((t[1]-a[1])-uv[1]*(t[2]-a[2]))/p[2]];
  const dx=derivative(b),dy=derivative(c);
  return {uv,dx,dy,rho:Math.sqrt(Math.max(dx[0]**2+dx[1]**2,dy[0]**2+dy[1]**2))};
}
function safe(colors,state,sample){
  for(const bias of [0,1/16]){
    const p=oracle(colors,state,{x:sample.x+bias,y:sample.y+bias}).projection;
    if(state.mip===2&&Math.abs(p.lod-Math.floor(p.lod)-.5)<.07)return false;
    if([p.u,p.v].some(c=>Math.abs(c-Math.round(c))<.04))return false;
    const levels=state.mip===1?[0]:state.mip===2?[Math.floor(p.lod+.5)]:[Math.floor(p.lod),Math.min(4,Math.ceil(p.lod))];
    if((p.rho<=1?state.mag:state.min)===1)for(const level of levels){
      const dims=[colors[level][0].length,colors[level].length];
      if([p.u,p.v].some((c,i)=>dims[i]>1&&Math.abs(c*dims[i]-Math.round(c*dims[i]))<.08))return false;
    }
  }return true;
}
function plan(format=formats[0]){
  const {width,height}=format;
  const colors=Array.from({length:5},(_,l)=>Array.from({length:Math.max(1,height>>l)},(_,y)=>
    Array.from({length:Math.max(1,width>>l)},(_,x)=>{
      const rgb=[29+l*31+(x%2)*71,37+l*23+(y%2)*79,19+l*29+((x+2*y)%3)*37];
      return {rgb,raw:(rgb[0]<<16)|(rgb[1]<<8)|rgb[2],keyRaw:0};
    })));
  const states=[],add=(label,span,options={})=>states.push({label,span,offset:[.137,.193],address:[1,1],min:1,mag:1,mip:2,key:false,test:0,blend:false,...options});
  add('unequal MAG point',[.4,.7]);add('unequal MAG linear',[.4,.7],{mag:2});
  add('unequal U dominant point',[12.8,1.6]);
  add('unequal U dominant bilinear',[12.8,1.6],{min:2});
  add('unequal V dominant point',[1.6,12.8]);
  add('unequal V dominant trilinear',[1.6,12.8],{min:2,mip:3});
  add('point mip transition',[7.1,3.7],{min:2});
  add('linear mip transition',[7.1,3.7],{min:2,mip:3});
  add('point mip restored',[7.1,3.7],{min:2});
  for(const [label,address] of [['WRAP both',[1,1]],['CLAMP U',[3,1]],['CLAMP V',[1,3]],['CLAMP both',[3,3]],['WRAP restored',[1,1]]])
    add(label,[2.3,5.7],{offset:[-.817,1.319],address,min:2,mip:3});
  add('perspective U unequal point',[11.3,2.9],{q:[1,.375,.625]});
  add('perspective U unequal trilinear',[11.3,2.9],{q:[1,.375,.625],min:2,mip:3});
  add('perspective V unequal point',[2.7,19.3],{q:[1,.625,.25]});
  add('perspective V unequal trilinear',[2.7,19.3],{q:[1,.625,.25],min:2,mip:3});
  add('MIP NONE restored',[11.3,2.9],{q:[1,.375,.625],min:2,mip:1});
  add('one-dimensional tail',width>height?[18.1,5.7]:[5.7,18.1],{min:2});
  add('last mip clamp',[65536,32768],{min:2});
  for(const state of states){
    // Deterministic authored-coordinate guard, independent of observed pixels.
    const candidates=[];for(const y of [3,5,7])for(const x of [3,7,11,15,19,23])if(x+y<29&&safe(colors,state,{x,y}))candidates.push({x,y});
    assert(candidates.length>=2,'two safe interior samples '+format.name+' '+state.label);
    state.samples=state.q?[candidates[0],candidates[Math.floor(candidates.length/2)],candidates.at(-1)]:[candidates[0],candidates.at(-1)];
  }
  return {format,colors,keys:Array(5).fill(0),states,tolerance:2,spatial:true,queuedPairs:[[6,7],[9,12],[12,13],[14,15]],update:null};
}
function fixtureSource(){
  let s=require(path.join(ROOT,'test/test-d3dim-keyed-mip-formats-web')).fixtureSource();
  const replace=(a,b)=>{assert.equal(s.split(a).length,2,'unique rectangular seam '+a.slice(0,100));s=s.replace(a,b);};
  const block=(a,b,replacement)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert(start>=0&&end>start,a);replace(s.slice(start,end),replacement);};
  replace('texture=await surface(16,16,0x401008,5);','texture=await surface(config.format.width,config.format.height,0x401008,5);');
  block('      const l=await lock(obj),dimension=16>>level;', '      await unlock(obj);evidence.levelLocks.push',`      const l=await lock(obj),width=Math.max(1,config.format.width>>level),height=Math.max(1,config.format.height>>level);
      eq(await read(lockDesc.p+8),height,'public rectangular mip height');
      eq(await read(lockDesc.p+12),width,'public rectangular mip width');
      eq(l.pitch,width*4,'public rectangular mip pitch');
      const image=new Uint8Array(l.pitch*height);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const pixel=config.colors[level][y][x].raw;
        for(let byte=0;byte<4;byte++)image[y*l.pitch+x*4+byte]=(pixel>>>(8*byte))&255;
      }
      await bytes(l.pointer,image);
`);
  replace('{level,dimension,...l}','{level,width:Math.max(1,config.format.width>>level),height:Math.max(1,config.format.height>>level),...l}');
  replace('bits((state.offset||[0,0])[0]+(i===1?state.n:0))','bits(state.offset[0]+(i===1?state.span[0]:0))');
  replace('bits((state.offset||[0,0])[1]+(i===2?state.n:0))','bits(state.offset[1]+(i===2?state.span[1]:0))');
  replace('[13,1],[14,1]','[13,state.address[0]],[14,state.address[1]]');
  replace('const expectedAddress=[1,1];','const expectedAddress=state.address;');
  replace("    const vertices=await alloc(96)",`    for(const mask of evidence.advertised.textureCaps){
      check((mask&2)!==0,'advertised power-of-two textures');
      eq(mask&0x20,0,'SQUAREONLY not advertised');
    }
    const vertices=await alloc(96)`);
  replace("        await draw();await until(()=>held.length>0,'held production batch');",`        await draw();await until(()=>heldPackets.length>0,'held production batch');
        const packet=heldPackets.at(-1),buffer=queueBuffers[packet.index],header=Array.from(new Uint32Array(buffer,0,8));
        eq(packet.commands,1,'one queued public draw');eq(header[1],device,'owning device');
        eq(header[5],4096,'captured public state bytes');eq(header[7],0,'draw record offset');
        heldRecord.packet={sequence:packet.seq,index:packet.index,header};
        heldRecord.completedBefore=Atomics.load(queueControl,1);
        check(heldRecord.completedBefore<packet.seq,'actual Worker has not consumed held batch');`);
  replace('        await setState(next);heldRecord.liveChangedBeforeDrain=true;',`        await setState(next);heldRecord.liveChangedBeforeDrain=true;
        heldRecord.completedAfterLiveChanges=Atomics.load(queueControl,1);
        eq(heldRecord.completedAfterLiveChanges,heldRecord.completedBefore,'live state did not drain captured packet');`);
  replace("        holding=false;for(const send of held.splice(0))send();\n        await observe('queued '+old.label,old.samples[0],old);", "        holding=false;for(const send of held.splice(0))send();heldPackets.length=0;\n        await observe('queued '+old.label,old.samples[0],old);");
  replace("        await observe('queued '+old.label,old.samples[0],old);",`        await observe('queued '+old.label,old.samples[0],old);
        heldRecord.completedAfterDrain=Atomics.load(queueControl,1);
        check(heldRecord.completedAfterDrain>=heldRecord.packet.sequence,'actual owning Worker drained packet');`);
  return s;
}
function config(){
  const pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  return {...plan(),thunkBase:require(path.join(ROOT,'lib/region-map.generated')).BASE.THUNK_BASE,
    factoryId:require(path.join(ROOT,'src/api_table.json')).find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
}
function controls(){
  const report=[];
  const handState={span:[8,2],q:[1,.5,.75],offset:[.137,.193],address:[1,1],min:1,mag:1,mip:2};
  const hand=oracle(plan().colors,handState,{x:4,y:4}).projection;
  for(const [key,value] of Object.entries({u:.137+16/29,v:.193+6/29,ux:124/841,uy:4/841,vx:3/841,vy:45/841}))
    assert(Math.abs(hand[key]-value)<1e-12,'hand-derived unequal-axis quotient '+key);
  assert(Math.abs(hand.rho-Math.sqrt(1984**2+12**2)/841)<1e-12,'16x4 hand footprint');
  assert.deepEqual(Array.from(oracle(plan().colors,handState,{x:4,y:4})),[131,60,122],'hand-selected child1 texel(5,0)');
  for(const format of formats){
    const p=plan(format);let observations=0;
    for(const state of p.states)for(const sample of state.samples){
      assert(sample.x>=3&&sample.y>=3&&sample.x+sample.y<29,'triangle interior');
      assert(safe(p.colors,state,sample),'address and point tie margins');
      for(const bias of [0,1/16]){
        const s={x:sample.x+bias,y:sample.y+bias};
        const analytic=oracle(p.colors,state,s).projection,quad=finiteQuad(state,s,format.width,format.height);
        assert(Math.abs(analytic.u-quad.uv[0])<1e-10&&Math.abs(analytic.v-quad.uv[1])<1e-10);
        assert(Math.abs(analytic.rho-quad.rho)<1e-8*Math.max(1,analytic.rho),'finite homogeneous quad agrees with quotient derivative');
      }observations++;
    }
    for(const index of [19,20])for(const sample of p.states[index].samples){
      const lod=oracle(p.colors,p.states[index],sample).projection.lod;
      assert.equal(Math.floor(lod+.5),index===19?3:4,'explicit 1D tail and last-image selection');
    }
    for(const [a,b] of [[0,1],[2,3],[6,7],[9,10],[9,11],[9,12]]){
      const s=p.states[a].samples[0],left=oracle(p.colors,p.states[a],s),right=oracle(p.colors,p.states[b],s);
      assert(left.some((c,i)=>Math.abs(c-right[i])>4),'discriminating state pair '+format.name+' '+a+'/'+b);
    }
    let swappedRejected=0;
    for(const state of p.states)for(const sample of state.samples){
      const a=oracle(p.colors,state,sample).projection;
      const wrongRho=Math.sqrt(Math.max((format.height*a.ux)**2+(format.width*a.vx)**2,
        (format.height*a.uy)**2+(format.width*a.vy)**2));
      const wrongLOD=Math.max(0,Math.min(4,Math.log2(wrongRho)));
      if(Math.abs(a.lod-wrongLOD)>.25)swappedRejected++;
    }
    assert(swappedRejected>0,'swapped U/V extents produce discriminating LODs');
    report.push({name:format.name,dimensions:p.colors.map(c=>[c[0].length,c.length]),states:p.states.length,observations,swappedRejected});
  }
  const source=fixtureSource();new vm.Script('('+source+')');
  assert(!/mip_seed|mip_surface|mip_draw|fixedLOD/.test(source));
  return {status:'SOURCE/ORACLE ONLY; no rendered coverage',report};
}

async function runtime(){
  controls();
  const dir=process.env.RECTANGULAR_MIP_EVIDENCE,moduleDir=process.env.RECTANGULAR_MIP_MODULE_DIR||path.join(ROOT,'build');
  assert(dir,'RECTANGULAR_MIP_EVIDENCE required');fs.mkdirSync(dir,{recursive:true});
  const result={status:'RUNNING',startedAt:new Date().toISOString(),source:process.env.RECTANGULAR_MIP_SOURCE||null,
    fixtureSha256:sha(fs.readFileSync(__filename)),adaptedFixtureSha256:sha(fixtureSource()),
    publicFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-texture-rendered-contract.js'))),
    mipFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-public-mip-webgl.js'))),
    calcSha256:sha(fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))),
    renderSourceHashes:Object.fromEntries(['d3dim-gpu','d3d9-shader','d3d9-backend','d3d9-fixed'].map(n=>[n,sha(fs.readFileSync(path.join(ROOT,'lib',n+'.js')))])),
    inheritedAdapterSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-d3dim-keyed-mip-formats-web.js'))),
    node:process.version,plan:formats.map(plan),modules:[],results:[],failures:[],physicalGPU:false};
  const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');
  const fixture=Function('return ('+fixtureSource()+')')();
  let wasm,server,browser,page,deadline;
  const deadlineMs=180000;
  deadline=setTimeout(()=>{result.deadlineExceeded=true;if(browser)browser.close().catch(()=>{});},deadlineMs);
  try{
    const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host',
      'render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
    server=await require(path.join(ROOT,'test/static-server')).startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/legacy-render-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    result.serverPort=server.address().port;
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm'].filter(n=>!process.env.RECTANGULAR_MIP_ONLY_MODULE||n===process.env.RECTANGULAR_MIP_ONLY_MODULE)){
      wasm=fs.readFileSync(path.join(moduleDir,name));result.modules.push({name,sha256:sha(wasm),bytes:wasm.length});
      for(const mode of ['software','webgl','worker'].filter(m=>!process.env.RECTANGULAR_MIP_ONLY_MODE||m===process.env.RECTANGULAR_MIP_ONLY_MODE))for(const webglVersion of mode==='software'?[null]:[1,2])for(const format of formats.filter(f=>!process.env.RECTANGULAR_MIP_ONLY_FORMAT||f.name===process.env.RECTANGULAR_MIP_ONLY_FORMAT)){
        try{
          const cfg={...config(),...plan(format),webglVersion,expectedModuleSha256:sha(wasm)};let row;
          // Small representative GPU subset, fuller software matrix.
          if(mode!=='software'){const selected=[0,1,6,7,9,10,11,12,13,14,15,16,17,19,20];
            cfg.states=selected.map(i=>cfg.states[i]);cfg.queuedPairs=[[2,3],[4,7],[7,8],[9,10]];}
          if(mode==='software'){
            cfg.noPreview=true;
            const context=vm.createContext({WebAssembly,performance,setTimeout,crypto:crypto.webcrypto,fetch:async url=>{
              const file=url==='/legacy-render.wasm'?wasm:fs.readFileSync(path.join(ROOT,url));
              return {arrayBuffer:async()=>Uint8Array.from(file).buffer,json:async()=>JSON.parse(file)};
            }});
            try{row=await vm.runInContext('('+fixtureSource()+')',context)(mode,cfg,oracle.toString(),process.env.RECTANGULAR_MIP_NEGATIVE||null);}
            catch(error){error.partial=context.legacyTextureEvidence;throw error;}
          }else{
            if(!browser){browser=await require('puppeteer').launch({userDataDir:path.join(dir,'chrome-profile'),headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});result.browser=await browser.version();result.browserPid=browser.process().pid;result.browserArgs=browser.process().spawnargs;browser.process().once('exit',(code,signal)=>{result.browserExit={code,signal};});}
            page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/legacy-render-fixture');
            row=await page.evaluate(fixture,mode,cfg,oracle.toString(),process.env.RECTANGULAR_MIP_NEGATIVE||null);
            if(row.status==='PASS')await page.screenshot({path:path.join(dir,name+'-'+format.name+'-'+mode+'-'+webglVersion+'.png')});
            await page.close();page=null;
          }
          result.results.push({module:name,format:format.name,webglVersion,...row});save();
          if(row.status.startsWith('UNADVERTISED')){console.log('SKIP',name,format.name,mode,webglVersion,row.status);continue;}
          assert.equal(row.status,'PASS');
          // Native-size captures are saved from the actual 32x32 target bytes.
          const {PNG}=require('pngjs');
          for(const [i,observation] of row.observations.entries()){
            const png=new PNG({width:32,height:32});png.data.set(observation.dibRGBA);
            fs.writeFileSync(path.join(dir,name+'-'+format.name+'-'+mode+'-'+webglVersion+'-'+i+'.png'),PNG.sync.write(png));
          }
          console.log('PASS',name,format.name,mode,webglVersion,row.observations.length);
        }catch(error){
          const partial=error.partial||(page?await page.evaluate(()=>globalThis.legacyTextureEvidence).catch(()=>null):null);
          result.failures.push({module:name,mode,format:format.name,webglVersion,phase:partial?.pendingCall?.label==='CreateSurface'||partial?.calls?.some(c=>c.label==='CreateSurface'&&c.result!==0)?'ADVERTISED FORMAT CREATION':'RENDER OR ABI',error:String(error),partial});save();
          if(page){await page.close();page=null;}
          throw error;
        }
      }
    }
    if(!process.env.RECTANGULAR_MIP_ONLY_MODULE&&!process.env.RECTANGULAR_MIP_ONLY_MODE&&!process.env.RECTANGULAR_MIP_ONLY_FORMAT)assert.equal(result.results.length,20);
    result.coverage={renderedRoutes:result.results.filter(r=>r.status==='PASS').length,unadvertisedRoutes:result.results.filter(r=>r.status.startsWith('UNADVERTISED')).length,observations:result.results.reduce((n,r)=>n+(r.observations?.length||0),0)};
    result.status='PASS';
  }catch(error){result.status='FAIL';result.error=error.stack;throw error;}
  finally{
    clearTimeout(deadline);
    if(browser){await browser.close();result.browserCloseResolved=true;
      result.browserProcessAbsent=!fs.existsSync('/proc/'+result.browserPid);
      assert(result.browserProcessAbsent,'own browser PID absent after close');
      fs.rmSync(path.join(dir,'chrome-profile'),{recursive:true,force:true});
    }
    if(server)await require(path.join(ROOT,'test/static-server')).closeServer(server);
    result.finishedAt=new Date().toISOString();save();
  }
}
if(require.main===module){
  if(process.argv.includes('--plan'))console.log(JSON.stringify(controls()));
  else runtime().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={oracle,plan,fixtureSource,controls,finiteQuad,formats};

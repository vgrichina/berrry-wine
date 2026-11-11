#!/usr/bin/env node
'use strict';
// Public COM regression for NFS-style integer edges and half-texel UVs.
// Both shipped modules; no synthetic descriptor or test Wasm exports.
// ROOF_EDGE_EVIDENCE retains full native pixels, API calls and module hashes.
async function roofFixture(c,targetName) {
  const {negative,evidence,eq,read,alloc,write,words,guard,guid,com,ok,acquire,dd,hal,unlock,bits,countDraw}=c;
  const pf={rgb565:[0x40,16,0xf800,0x7e0,31,0],x1:[0x40,16,0x7c00,0x3e0,31,0],
    a1:[0x41,16,0x7c00,0x3e0,31,0x8000],a4:[0x41,16,0xf00,0xf0,15,0xf000],
    rgb:[0x40,32,0xff0000,0xff00,255,0]}[targetName];
  const widths=pf.slice(2).map(m=>{let n=0;while(m){n+=m&1;m>>>=1;}return n;});
  const shifts=pf.slice(2).map(m=>{let n=0;while(m&&!(m&1)){n++;m>>>=1;}return n;});
  const encode=rgba=>rgba.reduce((p,b,i)=>p|(((b>>>(8-widths[i]))<<shifts[i])&pf[i+2]),0)>>>0;
  const decode=p=>widths.map((n,i)=>{if(!n)return 255;const b=(p&pf[i+2])>>>shifts[i];
    return n===1?b*255:n===4?b*17:n===5?b*8+(b>>2):n===6?b*4+(b>>4):b;});
  const make=async(w,h,format,caps)=>{
    const d=await guard(124);await words(d.p,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,h],[12,w],[72,32],[104,caps],
      ...format.map((v,i)=>[[76,84,88,92,96,100][i],v])])await write(d.p+off,v);
    const obj=await acquire(out=>com('CreateSurface7 roof',dd,6,d.p,out,0));await d.check();return obj;
  };
  const lock=async(obj,format)=>{
    const d=await guard(124);await words(d.p,Array(31).fill(0));await write(d.p,124);
    await ok(com('Lock7 roof',obj,25,0,d.p,1,0));await d.check();
    for(const [i,off] of [76,84,88,92,96,100].entries())eq(await read(d.p+off),format[i],'public Lock format');
    return {pointer:await read(d.p+36),pitch:await read(d.p+16)};
  };
  const iid=await guid([0xf5049e77,0x11d24861,0xa00007a4,0xa82906c9]);
  const d3d=await acquire(out=>com('QI D3D7 roof',dd,0,iid,out));
  const rt=await make(8,8,pf,0x2840),texturePF=[0x41,32,0xff0000,0xff00,255,0xff000000];
  const texture=await make(4,4,texturePF,0x1800);
  const device=await acquire(out=>com('CreateDevice7 roof',d3d,4,hal,rt,out));
  const viewport=await alloc(24);await words(viewport,[0,0,8,8,bits(0),bits(1)]);
  await ok(com('SetViewport7 roof',device,13,viewport));
  for(const [id,v] of [[7,0],[9,1],[14,0],[15,0],[19,5],[20,6],[22,1],[27,1],[28,0],[41,0],[137,0]])
    await ok(com('SetRenderState7 roof '+id,device,20,id,v));
  await ok(com('SetTexture7 roof',device,35,0,texture));
  for(const [id,v] of [[1,4],[2,negative==='diffuse'?0:2],[3,0],[4,4],[5,2],[6,0],
    [13,1],[14,1],[16,1],[17,1],[18,0]])
  {
    await ok(com('SetTextureStageState7 roof '+id,device,37,0,id,v));
    const out=await guard(4);await ok(com('GetTextureStageState7 roof '+id,device,36,0,id,out.p));
    await out.check();eq(await read(out.p),v,'public stage state round trip');
  }
  await ok(com('Disable stage1 roof',device,37,1,1,1));
  const vertices=await alloc(192),report=evidence.roof={target:targetName,cases:[]};
  for(const alpha of [0,85,170,255])for(const shape of ['diagonal','other-diagonal','offset']) {
    const ox=shape==='offset'?2:0,oy=ox;
    const tl=await lock(texture,texturePF);
    // Row zero is the roof; other rows are transparent. Color discriminates
    // a missing texture selector from the white diffuse color.
    const color=alpha===255?[0,0,0]:[51,153,204];
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)await write(tl.pointer+y*tl.pitch+x*4,
      y===0?((alpha*0x1000000)+(color[0]<<16)+(color[1]<<8)+color[2])>>>0:0);
    await unlock(texture);
    let l=await lock(rt,pf);const white=encode([255,255,255,255]);
    for(let y=0;y<8;y++)for(let x=0;x<8;x+=32/pf[1])await write(l.pointer+y*l.pitch+x*pf[1]/8,
      pf[1]===16?white|(white<<16):white);
    await unlock(rt);
    const corners=[[0,0],[4,0],[4,4],[0,4]],order=shape==='other-diagonal'?[0,1,3,1,2,3]:[0,1,2,0,2,3];
    for(const [i,k] of order.entries()) {const [x,y]=corners[k];
      await words(vertices+i*32,[bits(x+ox),bits(y+oy),bits(.5),bits(1),0xffffffff,0,bits((x+.5)/4),bits((y+.5)/4)]);}
    await ok(com('BeginScene7 roof',device,5));
    await ok(com('DrawPrimitive7 roof',device,25,4,0x1c4,vertices,6,0));countDraw();
    await ok(com('EndScene7 roof',device,6));
    // Integer samples inside [origin,origin+4) select texel row y-origin.
    // S*As + D*(1-As), followed by the declared native component bits.
    const product=[...color,alpha].map(v=>(v*alpha+255*(255-alpha))/255);
    const lo=encode(product.map(Math.floor)),hi=encode(product.map(Math.ceil));
    eq(lo,hi,'oracle independent of framebuffer byte rounding');
    const expected=[],actual=[],rgba=[],storedPixels=[];l=await lock(rt,pf);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
      const value=await read(l.pointer+y*l.pitch+(pf[1]===16?(x&~1)*2:x*4));
      const raw=pf[1]===16?(value>>>(x%2*16))&65535:value;
      storedPixels.push(raw);
      // X8 is not an alpha component. Preserve its bytes as evidence, but
      // compare only declared components across software and GPU targets.
      actual.push(pf[1]===32?raw&0xffffff:raw);rgba.push(...decode(raw));
      expected.push(x>=ox&&x<ox+4&&y===oy?lo:white);
    }
    await unlock(rt);
    report.cases.push({alpha,shape,origin:[ox,oy],actual,expected,rgba,storedPixels,blendBeforeStorage:product});
    eq(actual,expected,'ROOF PIXEL ORACLE '+targetName+'/'+alpha+'/'+shape);
  }
  report.renderer=c.rendererInfo();
  await ok(com('Unbind roof texture',device,35,0,0));
  for(const [name,obj] of Object.entries({device,texture,rt,d3d}))await com('Release roof '+name,obj,2);
}

async function runtime() {
  const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
  const assert=require('assert/strict'),puppeteer=require('puppeteer'),base=require('./test-legacy-texture-rendered-contract');
  const root=path.resolve(__dirname,'..'),out=process.env.ROOF_EDGE_EVIDENCE;
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  if(out)fs.mkdirSync(out,{recursive:true});
  const pe=fs.readFileSync(path.join(root,'test/binaries/calc.exe'));
  const config={...base.plan(),immediate:true,noPreview:true,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker',
    'gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  const evidence={startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    fixture:hash(fs.readFileSync(__filename)),calc:hash(pe),results:[],controls:[],
    productionJS:Object.fromEntries(scripts.map(n=>['lib/'+n+'.js',hash(fs.readFileSync(path.join(root,'lib',n+'.js')))]))};
  let wasm,server,browser,page,timer,browserClosed;
  try {
    server=await require('./static-server').startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
      if(req.url==='/legacy-render.wasm'){res.setHeader('Content-Type','application/wasm');res.end(wasm);return true;}
      if(req.url==='/roof-fixture'){res.setHeader('Content-Type','text/html');res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;
    }});
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||puppeteer.executablePath(),
      args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    evidence.browser=await browser.version();const child=browser.process();evidence.process={pid:child.pid};
    child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
    browserClosed=new Promise(resolve=>child.once('close',(code,signal)=>{
      evidence.process.close={code,signal};resolve();
    }));
    for(const name of ['stdout','stderr'])if(child[name]) {
      child[name].once('end',()=>{evidence.process[name+'EOF']=true;});child[name].resume();
    }
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},120000);
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']) {
      wasm=fs.readFileSync(path.join(root,'build',name));
      for(const target of (process.env.ROOF_EDGE_TARGETS||'rgb565,x1,a1,a4,rgb').split(',')) {
        config.immediateSource='async function(c){return ('+roofFixture.toString()+')(c,'+JSON.stringify(target)+');}';
        for(const mode of (process.env.ROOF_EDGE_MODES||'software,webgl,worker').split(','))for(const negative of [null,...(target==='rgb565'?['diffuse']:[])]) {
          page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/roof-fixture');
          let result,error;try{result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString(),negative);}catch(e){error=String(e);}
          const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence):null;
          const row={name,moduleHash:hash(wasm),target,mode,negative,result,error,partial};
          (negative?evidence.controls:evidence.results).push(row);await page.close();page=null;
          if(negative){assert(error?.includes('ROOF PIXEL ORACLE'),'diffuse-only selector must fail rendered pixel oracle');
            assert(partial.calls.some(c=>c.label==='DrawPrimitive7 roof'&&c.result===0),'control reaches public draw');}
          else assert(!error,error);
          console.log(JSON.stringify({name,target,mode,negative,error,cases:result?.roof.cases.length}));
        }
      }
    }
    for(const a of evidence.results)for(const b of evidence.results)if(a.target===b.target)
      for(let i=0;i<a.result.roof.cases.length;i++) {
        const x=a.result.roof.cases[i],y=b.result.roof.cases[i];
        assert.deepEqual(x.actual,y.actual,'exact declared pixels across modules and renderer routes');
        assert.deepEqual(x.rgba,y.rgba,'exact decoded channels across modules and renderer routes');
        if(a.target!=='rgb')assert.deepEqual(x.storedPixels,y.storedPixels,'byte-exact native16 storage across routes');
      }
    evidence.status='PASS';
  } catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e;}
  finally {
    clearTimeout(timer);if(page)await page.close();if(browser){await browser.close();await browserClosed;}
    if(server)await require('./static-server').closeServer(server);
    evidence.finishedAt=new Date().toISOString();
    if(out)fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify(evidence,null,2)+'\n');
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'normal browser exit');
  }
}
if(require.main===module)runtime().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={roofFixture,runtime};

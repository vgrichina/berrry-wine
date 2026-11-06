#!/usr/bin/env node
'use strict';
// Generated helper/descriptor checks use actual WebGL1 and WebGL2.
// POINT_PUBLIC_EVIDENCE selects ordinary x86 public-COM checks in both shipped
// modules, including the owning queued Worker. No native Windows/game claim.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const puppeteer = require('puppeteer');
const extraWat = String.raw`
  (func (export "point_storage") (result i32)
    (call $g2w (call $heap_alloc (i32.const 4096))))
  (func (export "point_setup") (param $dib i32) (param $bpp i32) (param $fmt i32)
    (param $pitch i32) (param $clip i32) (param $l i32) (param $t i32) (param $r i32) (param $b i32)
    (store.field DxObject width (global.get $DX_OBJECTS) (i32.const 8))
    (store.field DxObject height (global.get $DX_OBJECTS) (i32.const 8))
    (store.field DxObject bpp (global.get $DX_OBJECTS) (local.get $bpp))
    (store.field DxObject pitch (global.get $DX_OBJECTS) (local.get $pitch))
    (store.field DxObject misc1 (global.get $DX_OBJECTS) (local.get $dib))
    (call $dx_surf_fmt_set (global.get $DX_OBJECTS) (local.get $fmt))
    (global.set $d3dim_clip_on (local.get $clip))
    (global.set $d3dim_clip_x0 (local.get $l)) (global.set $d3dim_clip_y0 (local.get $t))
    (global.set $d3dim_clip_x1 (local.get $r)) (global.set $d3dim_clip_y1 (local.get $b)))
  (func (export "point_software") (param $x f32) (param $y f32) (param $color i32)
    (call $viewport_fill_rect_rgba (global.get $DX_OBJECTS)
      (call $d3dim_coord_i (local.get $x)) (call $d3dim_coord_i (local.get $y))
      (i32.const 2) (i32.const 2) (local.get $color)))
`;
const points = [[-.51, 1.49, 0x00123456], [-.5, -.5, 0x804a92d3],
  [2.4999998, 3.5, 0xffd78129], [6.5, 6.5, 0x00336699],
  [2, 3, 0x00abcdef], [4, 0, 0x7f4a92d3], [4, 2, 0x804a92d3], ['NaN', 5, 0x00e13277], ['Infinity', 0, 0xff123456],
  [-1000001, -1000001, 0xff123456], [1000001, 1000001, 0xff123456]];
function nativePointOracle(c) {
  const bytes=Uint8Array.from(c.initial),view=new DataView(bytes.buffer);
  const masks=c.format===1?[0xf800,0x7e0,31,0]:c.format===2?[0x7c00,0x3e0,31,0]:[0x7c00,0x3e0,31,0x8000];
  const coord=value=>{const f=Math.fround(Number(value));
    return Number.isNaN(f)?0:Math.floor(Math.fround(Math.max(-1000000,Math.min(1000000,f))+.5));};
  for(const [x,y,color] of c.points){
    const left=coord(x),top=coord(y);
    let packed=color>>>0;
    if(c.bpp===16)packed=masks.reduce((p,mask,i)=>{
      let m=mask,shift=0,width=0;while(m&&!(m&1)){shift++;m>>>=1;}while(m){width+=m&1;m>>>=1;}
      const channel=(color>>>[16,8,0,24][i])&255;
      return p|(((channel>>>(8-width))<<shift)&mask);
    },0);
    for(let py=0;py<8;py++)for(let px=0;px<8;px++){
      if(px<left||px>=left+2||py<top||py>=top+2)continue;
      if(c.clip&&(px<c.clip[0]||py<c.clip[1]||px>=c.clip[2]||py>=c.clip[3]))continue;
      const offset=py*c.pitch+px*c.bpp/8;
      if(c.bpp===16)view.setUint16(offset,packed,true);else view.setUint32(offset,packed,true);
    }
  }
  return Array.from(bytes);
}

const cases = [];
for (const format of [1, 2, 3, 6]) for (const clip of [null, [1, 2, 7, 6]])
  for (const batchDraws of [false, true]) cases.push({ format, bpp: format === 6 ? 32 : 16,
    clip, batchDraws, points: points.map(([x,y,c]) => [x,y, format === 6 ? (c | 0xff000000) >>> 0 : c]) });
cases.push(...cases.filter(c => c.format === 1).map(c => ({ ...c, boundedReadback: false })));

if (process.env.POINT_PUBLIC_EVIDENCE) runPublicPoints().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
else (async () => {
  const native = await bootRenderHarness({ extraWat, fonts: 'none' });
  const wat = native.exports, dib = wat.point_storage(), all = new Uint8Array(native.memory.buffer);
  for (const c of cases) {
    c.pitch = 8 * c.bpp / 8 + 8; // Preserve row padding as well as untouched alpha.
    c.initial = Array.from({ length: c.pitch * 8 }, (_, i) => (i * 37 + 11) & 255);
    all.set(c.initial, dib);
    wat.point_setup(dib, c.bpp, c.format, c.pitch, c.clip ? 1 : 0, ...(c.clip || [0,0,8,8]));
    for (const [x, y, color] of c.points) wat.point_software(Number(x), Number(y), color);
    c.expected = Array.from(all.slice(dib, dib + c.pitch * 8));
    c.nativeExpected = nativePointOracle(c);
  }
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const evidence = { browser: await browser.version(), cases, versions: [] };
    const page = await browser.newPage();
    for (const name of ['gpu-backend', 'd3d9-shader', 'd3d9-fixed', 'render-clear','d3d9-backend', 'd3dim-gpu'])
      await page.addScriptTag({ path: path.join(__dirname, '../lib', name + '.js') });
    for (const version of [1, 2]) {
      const results = await page.evaluate(({ cases, version }) => cases.map(c => {
        const memory = new ArrayBuffer(65536), dv = new DataView(memory), u8 = new Uint8Array(memory);
        const desc = 4096, vertices = 8192, call = 12288, dib = 32768;
        const fields = [16384, 8, 8, c.bpp, c.pitch, dib, c.format,
          24576, 2, 2, 32, 8, 28672, 1, 0, 0, 1, 1, 1, 1, 5, 6, 4, 4, 1, 1, 1, 3, 1, 1, 255, 1, 0xff654321, 3,
          c.clip ? 1 : 0, ...(c.clip || [0,0,8,8])];
        fields.forEach((v, i) => dv.setUint32(desc + i * 4, v, true));
        u8.set(c.initial, dib);
        const errors = [], contexts = [];
        const gpu = new D3DIMGpu.D3DIMGpu({ getMemory: () => memory, batchDraws: c.batchDraws,
          boundedReadback: c.boundedReadback !== false,
          getExports: () => ({ d3dim_gpu_describe: () => desc, guest_to_wasm: a => a,
            d3dim_gpu_decode_texture: () => { throw new Error('POINTLIST decoded an ignored texture'); } }),
          createCanvas: (w,h) => {
            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
            const get = canvas.getContext.bind(canvas);
            canvas.getContext = (kind, ...args) => {
              if (version === 1 && kind === 'webgl2') return null;
              const gl = get(kind, ...args); if (gl) contexts.push(gl); return gl;
            };
            return canvas;
          }, onError: e => errors.push(e) });
        const accepted = [];
        // Multi-point call plus single-point calls exercise independent draw
        // order, batching, and guest buffer reuse before the final fence.
        const draw = points => {
          [1,1,3,vertices,points.length].forEach((v,i) => dv.setUint32(call+i*4,v,true));
          points.forEach(([x,y,color],i) => {
            const p = vertices + i * 32;
            [Number(x),Number(y),NaN,-1].forEach((v,j) => dv.setFloat32(p+j*4,v,true));
            dv.setUint32(p+16,color,true);
          });
          accepted.push(gpu.call(D3DIMGpu.OPCODES.DRAW, call));
        };
        draw(c.points.slice(0,2));
        c.points.slice(2).forEach(p => draw([p]));
        u8.fill(255, vertices, vertices + 64);
        gpu.fence();
        const actual = Array.from(u8.slice(dib, dib + c.pitch * 8));
        const glErrors = contexts.map(gl => gl.getError());
        const actualVersion = contexts[0].getParameter(contexts[0].VERSION);
        const stats = gpu.snapshot(); gpu.stop();
        return { actual, accepted, errors, glErrors, actualVersion, stats };
      }), { cases, version });
      if (process.env.POINTLIST_EVIDENCE)
        fs.writeFileSync(process.env.POINTLIST_EVIDENCE, JSON.stringify({ ...evidence, version, results }, null, 2) + '\n');
      results.forEach((r, i) => {
        assert.deepEqual(r.errors, []); assert(r.accepted.every(v => v === 1));
        assert(r.glErrors.every(v => v === 0));
        assert(r.actualVersion.includes(`WebGL ${version}.0`), r.actualVersion);
        assert.deepEqual(r.actual, cases[i].nativeExpected, `WebGL${version} case${i} format${cases[i].format} independent native bytes`);
        if (!process.env.POINTLIST_BASELINE)
          assert.deepEqual(cases[i].expected, cases[i].nativeExpected, `WAT case${i} format${cases[i].format} independent native bytes`);
        assert.equal(r.stats.points, points.length);
      });
      const transitions = await page.evaluate(version => {
        const memory = new ArrayBuffer(65536), dv = new DataView(memory);
        const desc = 4096, vertices = 8192, call = 12288, dib = 32768;
        const set = (i,v) => dv.setUint32(desc + i * 4, v, true);
        [16384,8,8,16,16,dib,1].forEach((v,i) => set(i,v));
        set(16,1); set(17,2); set(18,1); set(20,5); set(21,6); set(27,1); set(28,2);
        const gpu = new D3DIMGpu.D3DIMGpu({ getMemory: () => memory,
          getExports: () => ({ d3dim_gpu_describe: () => desc, guest_to_wasm: a => a }),
          createCanvas: (w,h) => {
            const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
            const get = canvas.getContext.bind(canvas);
            canvas.getContext = (kind,...args) => version === 1 && kind === 'webgl2' ? null : get(kind,...args);
            return canvas;
          }, onError: e => { throw new Error(e); } });
        const draw = (primitive,color,z) => {
          const xy = primitive === 1 ? [[2,2]] : [[-10,-10],[30,-10],[-10,30]];
          [1,primitive,3,vertices,xy.length].forEach((v,i) => dv.setUint32(call+i*4,v,true));
          xy.forEach(([x,y],i) => {
            const p=vertices+i*32; [x,y,z,1].forEach((v,j)=>dv.setFloat32(p+j*4,v,true));
            dv.setUint32(p+16,color,true);
          });
          if (gpu.call(D3DIMGpu.OPCODES.DRAW,call) !== 1) throw new Error('transition draw rejected');
        };
        draw(4,0xffff0000,.25); // Establish near red geometry and its depth.
        draw(1,0xff0000ff,0); // Points ignore depth test/write: overwrite blue.
        draw(4,0xff00ff00,.5); // Far green still fails against original .25.
        gpu.fence(); const retained = dv.getUint16(dib+2*16+2*2,true);
        draw(4,0xff00ff00,.1); // Near green wins: depth state restored after point.
        gpu.fence(); const replaced = dv.getUint16(dib+2*16+2*2,true);
        set(16,0); set(18,0); set(19,1);
        draw(1,0x00ff0000,1); // Alpha zero still overwrites red, no blending.
        draw(4,0x000000ff,0); // Alpha-zero triangle must retain that red.
        gpu.fence(); const blendRestored = dv.getUint16(dib+2*16+2*2,true);
        const gl = gpu.targets.get(16384).device.gpu.gl, error = gl.getError();
        gpu.stop(); return { retained, replaced, blendRestored, error };
      }, version);
      assert.deepEqual(transitions, { retained: 31, replaced: 2016, blendRestored: 63488, error: 0 },
        `WebGL${version} points preserve depth and restore subsequent triangle blend/depth state`);
      evidence.versions.push({ version, results, transitions });
      if (process.env.POINTLIST_EVIDENCE)
        fs.writeFileSync(process.env.POINTLIST_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
      console.log(`${process.env.POINTLIST_BASELINE ? 'BASELINE' : 'PASS'} WebGL${version}: ${results.length} independent native point pixel cases; texture/depth/blend/fog/alpha ignored, clipping, overlap, batching, padding and neighboring alpha`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

async function pointPublicFixture(c,targetName,baseline=false) {
  const {mode,evidence,check,eq,read,alloc,write,words,guard,guid,com,ok,acquire,
    dd,hal,unlock,bits,use,initial,countDraw}=c;
  const pf={a1:[0x41,16,0x7c00,0x3e0,31,0x8000],a4:[0x41,16,0xf00,0xf0,15,0xf000],
    x1:[0x40,16,0x7c00,0x3e0,31,0],rgb565:[0x40,16,0xf800,0x7e0,31,0]}[targetName];
  const masks=pf.slice(2),shifts=masks.map(m=>{let n=0;while(m&&!(m&1)){m>>>=1;n++;}return n;}),
    widths=masks.map(m=>{let n=0;while(m){n+=m&1;m>>>=1;}return n;});
  const encode=color=>masks.reduce((p,m,i)=>p|(((((color>>>[16,8,0,24][i])&255) >>>(8-widths[i]))<<shifts[i])&m),0);
  const rgba=p=>masks.map((m,i)=>{if(!m)return 255;const n=widths[i],v=(p&m)>>>shifts[i];
    return n===1?v*255:n===4?v*17:n===5?v*8+Math.floor(v/4):v*4+Math.floor(v/16);});
  const report=evidence.pointStorage={target:targetName,format:pf,cases:[],mismatches:[],
    oracle:'Independent native component-mask high-bit storage; generated x86 public COM; no native Windows claim'};
  const iid=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
  const d3d=await acquire(out=>com('QI IDirect3D3 point',dd,0,iid,out));
  const desc=await alloc(124);await words(desc,Array(31).fill(0));
  for(const [off,v] of [[0,124],[4,0x1007],[8,8],[12,8],[72,32],...pf.map((v,i)=>[[76,84,88,92,96,100][i],v]),[104,0x2840]])await write(desc+off,v);
  const rt=await acquire(out=>com('CreateSurface point',dd,6,desc,out,0));
  const device=await acquire(out=>com('CreateDevice3 point',d3d,8,hal,rt,out,0));
  const viewport=await acquire(out=>com('CreateViewport3 point',d3d,6,out,0));
  const vp=await alloc(44);await ok(com('AddViewport3 point',device,5,viewport));
  const clip=async rect=>{await words(vp,[44,...rect,bits(-1),bits(1),bits(2),bits(2),bits(0),bits(1)]);
    await ok(com('SetViewport2 point',viewport,17,vp));await ok(com('SetCurrentViewport3 point',device,12,viewport));};
  await clip([0,0,8,8]);
  const rs=(id,v)=>ok(com('SetRenderState3 point '+id,device,22,id,v));
  for(const [id,v] of [[1,0],[7,0],[14,0],[15,0],[22,1],[26,0],[27,0],[28,0],[41,0],[137,0]])await rs(id,v);
  const lock=async()=>{const d=await guard(124);await words(d.p,Array(31).fill(0));await write(d.p,124);
    await ok(com('Lock Surface7 point',rt,25,0,d.p,1,0));await d.check();
    for(const [i,v] of pf.entries())eq(await read(d.p+[76,84,88,92,96,100][i]),v,'point native public format');
    return {pointer:await read(d.p+36),pitch:await read(d.p+16)};};
  const vertices=await alloc(96),indices=await alloc(4);await write(indices,0);
  const geometry=async(xy,color,z)=>{for(const [i,[x,y]] of xy.entries())
    await words(vertices+i*32,[bits(x),bits(y),bits(z),bits(1),color,0,0,0]);};
  const draw=async(primitive,indexed,color,z=.5,xy=[[2,2]])=>{
    await geometry(xy,color,z);await ok(com('BeginScene3 point',device,9));
    await ok(indexed?com('DrawIndexedPrimitive3 point',device,29,primitive,0x1c4,vertices,xy.length,indices,xy.length,0):
      com('DrawPrimitive3 point',device,28,primitive,0x1c4,vertices,xy.length,0));
    countDraw();await ok(com('EndScene3 point',device,10));};
  const seed=async()=>{const l=await lock(),pixels=Array.from({length:64},(_,i)=>(i*7919+0x1213)&65535);
    for(let y=0;y<8;y++)for(let x=0;x<8;x+=2)await write(l.pointer+y*l.pitch+x*2,pixels[y*8+x]|pixels[y*8+x+1]<<16);
    await unlock(rt);return pixels;};
  const observe=async(label,expected)=>{const l=await lock(),actual=[];
    for(let y=0;y<8;y++)for(let x=0;x<8;x+=2){const p=await read(l.pointer+y*l.pitch+x*2);actual.push(p&65535,p>>>16);}
    await unlock(rt);const row={label,actual,expected};report.cases.push(row);evidence.observations.push(row);
    if(JSON.stringify(actual)!==JSON.stringify(expected))report.mismatches.push(row);
    const fig=document.createElement('figure'),caption=document.createElement('figcaption');
    caption.textContent=targetName+' '+label+'; RGB tile + stored alpha tile; mismatches '+actual.filter((v,i)=>v!==expected[i]).length;
    fig.append(caption);
    for(const alpha of [false,true]){const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
      canvas.style.cssText='width:128px;height:128px;image-rendering:pixelated;margin:4px';
      const pixels=actual.flatMap(p=>{const [r,g,b,a]=rgba(p);return alpha?[a,a,a,255]:[r,g,b,255];});
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),8,8),0,0);fig.append(canvas);}
    document.body.append(fig);if(!baseline)eq(actual,expected,'POINT NATIVE ORACLE '+label);
  };
  const fill=(pixels,rect,color)=>{const v=encode(color);for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++)pixels[y*8+x]=v;};
  use({device,rt});
  for(const indexed of [false,true])for(const alpha of [0,127,128,255]){
    const expected=await seed(),color=((alpha*0x1000000)|0x004a92d3)>>>0;
    await draw(1,indexed,color);fill(expected,[2,2,4,4],color);await observe((indexed?'indexed':'direct')+' alpha '+alpha,expected);
  }
  // Existing 2x2 point footprint and viewport intersection are intentional
  // compatibility behavior, not a historical-hardware rasterization claim.
  let expected=await seed();
  await rs(15,1);await rs(25,1);await rs(24,255);await rs(27,1);await rs(19,5);await rs(20,6);
  await draw(1,true,0x00123456);fill(expected,[2,2,4,4],0x00123456);
  await observe('point alpha zero ignores NEVER alpha test and blending',expected);
  await rs(15,0);await rs(27,0);
  expected=await seed();await clip([3,3,2,2]);await draw(1,false,0x00123456);
  fill(expected,[3,3,4,4],0x00123456);await observe('viewport intersection retains all other words',expected);await clip([0,0,8,8]);
  // Near triangle creates depth, zero-alpha point overwrites without changing
  // depth, farther triangle must fail. Then a closer triangle proves restore.
  await seed();await rs(7,1);await rs(14,1);await rs(23,2);await rs(27,0);await rs(9,1);
  await ok(com('Clear2 point initial depth',viewport,20,0,0,2,0,bits(1),0));
  const triangle=[[-8,-8],[24,-8],[-8,24]];
  await draw(4,false,0xffff0000,.25,triangle);await draw(1,false,0x000000ff,.75);
  await draw(4,false,0xff00ff00,.5,triangle);expected=Array(64).fill(encode(0xffff0000));fill(expected,[2,2,4,4],0x000000ff);
  await observe('point leaves near triangle depth intact',expected);
  await draw(4,false,0xff00ff00,.1,triangle);await observe('next near triangle depth restored',Array(64).fill(encode(0xff00ff00)));
  await rs(7,0);await rs(14,0);await rs(27,1);await rs(19,5);await rs(20,6);
  await draw(1,true,0x00ff0000);await draw(4,false,0x000000ff,.5,triangle);
  expected=Array(64).fill(encode(0xff00ff00));fill(expected,[2,2,4,4],0x00ff0000);
  await observe('zero-alpha triangle blend restored after point overwrite',expected);
  report.renderer=c.rendererInfo();
  await com('Release point viewport',viewport,2);await com('Release point device',device,2);
  await com('Release point target',rt,2);await com('Release point D3D3',d3d,2);use(initial);
}

async function runPublicPoints() {
  const crypto=require('node:crypto'),cp=require('node:child_process');
  const ROOT=path.resolve(__dirname,'..'),base=require('./test-legacy-texture-rendered-contract');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

  const out=process.env.POINT_PUBLIC_EVIDENCE;assert(out);fs.mkdirSync(out,{recursive:true});
  const pe=fs.readFileSync(ROOT+'/test/binaries/calc.exe');
  const config={...base.plan(),immediate:true,imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52),
    thunkBase:require(ROOT+'/lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require(ROOT+'/src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id};
  const scripts=['region-map.generated','gl-command-stream','d3d-command-stream','guest-rpc','guest-thread-host','render-worker','gpu-backend','d3d9-shader','d3d-shader-ir','d3d9-fixed','d3d9-texture','render-clear','d3d9-backend','d3dim-gpu'];
  const evidence={startedAt:new Date().toISOString(),source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    generated:true,nativeWindows:false,media:{path:'test/binaries/calc.exe',sha256:sha(pe)},results:[],status:'RUNNING'};
  let wasm,server,browser,page,timer;
  try{
    server=await require(ROOT+'/test/static-server').startStaticServer({root:ROOT,crossOriginIsolated:true,handleRequest(req,res){
      res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
      if(req.url==='/legacy-render.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}
      if(req.url==='/point-native-fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(scripts.map(n=>'<script src="/lib/'+n+'.js"></script>').join('\n'));return true;}
      return false;}});evidence.server=server.address();
    browser=await puppeteer.launch({headless:true,
      executablePath:process.env.CHROME||await puppeteer.executablePath(),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],protocolTimeout:120000});
    evidence.browser=await browser.version();evidence.endpoint=browser.wsEndpoint();
    const child=browser.process();evidence.process={pid:child.pid,profile:child.spawnargs.find(s=>s.startsWith('--user-data-dir='))?.slice(16)};
    child.once('exit',(code,signal)=>evidence.process.exit={code,signal});
    fs.writeFileSync(path.join(out,'live.json'),JSON.stringify(evidence,null,2)+'\n');
    timer=setTimeout(()=>{evidence.deadlineExceeded=true;browser.close().catch(()=>{});},300000);
    for(const name of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
      wasm=fs.readFileSync(ROOT+'/build/'+name);
      // A4 POINTLIST remains explicitly unsupported by the GPU adapter. Its
      // ordinary software COM route still must retain the four alpha bits.
      for(const target of (process.env.POINT_PUBLIC_TARGETS||'a1,a4,x1,rgb565').split(','))for(const mode of (target==='a4'?['software']:['software','webgl','worker'])){
        config.immediateSource='async function(c){return ('+pointPublicFixture.toString()+')(c,'+JSON.stringify(target)+','+!!process.env.POINT_PUBLIC_BASELINE+');}';
        page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/point-native-fixture');
        let result,error;try{result=await page.evaluate(base.browserFixture,mode,config,base.oracle.toString());}catch(e){error=String(e);}
        const partial=error?await page.evaluate(()=>globalThis.legacyTextureEvidence||null):null;
        const capture=name+'-'+target+'-'+mode+'.png';await page.screenshot({path:path.join(out,capture),fullPage:true});await page.close();page=null;
        evidence.results.push({name,moduleHash:sha(wasm),target,mode,result,error,partial,capture});
        console.log(JSON.stringify({name,target,mode,error,mismatches:(result||partial)?.pointStorage?.mismatches?.length}));
        if(!process.env.POINT_PUBLIC_BASELINE)assert(!error,error);
      }
    }evidence.status=process.env.POINT_PUBLIC_BASELINE?'BASELINE OBSERVATIONS':'PASS';
  }catch(e){evidence.status='FAIL';evidence.error=e.stack;throw e;}
  finally{if(timer)clearTimeout(timer);if(page)await page.close();if(browser)await browser.close();if(server)await require(ROOT+'/test/static-server').closeServer(server);
    evidence.cleanupAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(evidence,null,2)+'\n');
    if(browser&&!evidence.deadlineExceeded)assert.deepEqual(evidence.process.exit,{code:0,signal:null},'normal browser closure');}
}

'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=require(path.join(root,'test/test-legacy-texture-rendered-contract'));
const base=require(path.join(root,'test/test-legacy-projected-webgl'));
function plan(){return ['device7','clear2','clear'].flatMap(method=>[false,true].flatMap(owned=>[1,2,3].map(flags=>({method,owned,flags}))));}
function body(){return `
    const fv=new DataView(new ArrayBuffer(4)),bits=n=>{fv.setFloat32(0,n,true);return fv.getUint32(0,true);};
    const zdesc=await guard(124);await words(zdesc.p,Array(31).fill(0));
    for(const [off,v] of [[0,124],[4,0x1007],[8,32],[12,32],[72,32],[76,0x400],[84,16],[104,0x20000]])await write(zdesc.p+off,v);
    const depth=await acquire(out=>com('Create depth Surface7',dd,6,zdesc.p,out,0));await zdesc.check();
    await ok(com('AddAttachedSurface7',rt,3,depth));
    const lockDepth=async()=>{await words(lockDesc.p,Array(31).fill(0));await write(lockDesc.p,124);
      await ok(com('Lock D16 Surface7',depth,25,0,lockDesc.p,1,0));await lockDesc.check();eq(await read(lockDesc.p+84),16,'public D16 format');
      return {pointer:await read(lockDesc.p+36),pitch:await read(lockDesc.p+16)};};
    let vp,dev3,d3d3;
    if(config.scene.method!=='device7'){
      const iid=await guid([0xbb223240,0x11d0e72b,0xaa00b4a9,0x3e99c000]);
      d3d3=await acquire(out=>com('QI D3D3',dd,0,iid,out));
      dev3=await acquire(out=>com('CreateDevice3',d3d3,8,hal,rt,out,0));
      vp=await acquire(out=>com('CreateViewport3',d3d3,6,out,0));await ok(com('AddViewport3',dev3,5,vp));
    }
    const viewport=await alloc(44),verts=await alloc(128);
    const setViewport=async rect=>{
      await words(viewport,[...rect,0,bits(1)]);await ok(com('SetViewport7',device,13,viewport));
      if(vp){await words(viewport,[44,...rect,bits(-1),bits(1),bits(2),bits(2),0,bits(1)]);
        await ok(com('SetViewport2',vp,17,viewport));await ok(com('SetCurrentViewport3',dev3,12,vp));}
    };
    const C=0xff0b1621,K=0xff445566,G=0xff20c050;
    const draw=async(color,z,degenerate=false)=>{
      for(const [id,v] of [[7,1],[14,1],[23,2],[22,1],[27,0],[28,0],[137,0]])await ok(com('SetRenderState7',device,20,id,v));
      await ok(com('unbind texture',device,35,0,0));
      for(const [id,v] of [[1,2],[2,0],[4,2],[5,0]])await ok(com('SetTextureStageState7',device,37,0,id,v));
      for(const [i,[x,y]] of [[0,0],[32,0],[0,32],[32,32]].entries())await words(verts+i*32,[bits(degenerate?16:x),bits(degenerate?16:y),bits(z),bits(1),color,0,0,0]);
      await ok(com('BeginScene7',device,5));await ok(com('DrawPrimitive7',device,25,5,0x1c4,verts,4,0));await ok(com('EndScene7',device,6));
    };
    const observe=async label=>{
      evidence.phase=label;
      const l=await lock(rt),pixels=[];for(let y=0;y<32;y++)for(let x=0;x<32;x++)pixels.push(await read(l.pointer+y*l.pitch+x*4));await unlock(rt);
      const d=await lockDepth(),depthWords=[],dv=new DataView(memory.buffer);for(let y=0;y<32;y++)for(let x=0;x<32;x++)depthWords.push(dv.getUint16(await wa(d.pointer+y*d.pitch+x*2),true));await unlock(depth);
      evidence.observations.push({label,pixels,depthWords});
    };
    await setViewport([0,0,32,32]);
    await ok(com('Clear7 initial CPU',device,10,0,0,3,C,bits(.25),0));
    if(config.scene.owned){
      await draw(C,.25);
      // Establish identical full depth through the already-owned public path.
      await ok(com('Clear7 initial owned',device,10,0,0,3,C,bits(.25),0));
    }
    await observe('initial');
    await setViewport([7,5,18,20]);
    evidence.phase='inset clear';
    if(config.scene.method==='device7')await ok(com('Clear7 inset',device,10,0,0,config.scene.flags,K,bits(.75),0));
    else if(config.scene.method==='clear2')await ok(com('Clear2 inset',vp,20,0,0,config.scene.flags,K,bits(.75),0));
    else await ok(com('Clear inset',vp,12,0,0,config.scene.flags));
    // Z-only clear can remain queued when color is clean. A zero-area public
    // draw makes Lock fence the stream, without touching any color/depth pixel.
    if(config.scene.owned)await draw(C,.5,true);
    await observe('after clear');
    await setViewport([0,0,32,32]);await draw(G,.5);await observe('after geometry');
    evidence.stats={drawCalls:await raw('d3dim_gps_stat',0),fallbacks:await raw('d3dim_gps_stat',1),declined:await raw('d3dim_gps_stat',14)};
    if(vp){await com('DeleteViewport3',dev3,6,vp);await com('Release viewport',vp,2);await com('Release dev3',dev3,2);await com('Release d3d3',d3d3,2);}
    for(const obj of [device,depth,texture,rt,padding,d3d,dd])await com('Release',obj,2);
    evidence.status='PASS';return evidence;
`;}
function source(){let s=fixture.browserFixture.toString().replace('surface(8,8,0x2840)','surface(32,32,0x2840)');const i=s.indexOf('    const texLock='),j=s.indexOf('  }finally{',i);assert(i>0&&j>i);return s.slice(0,i)+body()+s.slice(j);}
async function run(wasm,scene){
  const raw=fs.readFileSync(wasm),bytes=wasm.endsWith('.gz')?zlib.gunzipSync(raw):raw,context=fixture.offlineContext(bytes);
  const GS=require(path.join(root,'lib/gpu-stream')),Base=require(path.join(root,'lib/gpu-stream-software')).Executor,records=[],depthRecords=[];
  context.GpuStreamSoftware={Executor:class extends Base{execute(rec){
    const result=super.execute(rec),label=context.legacyTextureEvidence.phase;
    records.push({label,name:rec.name,fields:{...rec.fields}});
    if(rec.op===GS.OP.READBACK&&this.res.get(rec.fields.rt)?.kind===GS.KIND.RT){this.native.idle();const ds=[...this.native.depthSurfaces.values()];assert(ds.length<=1);
      depthRecords.push({label,words:ds[0]?Array.from(new Float32Array(this.native.memory(),ds[0].wa,1024),v=>Math.round(v*65535)):null});}
    return result;
  }}};
  let error=null;try{await vm.runInContext('('+source()+')',context)('gps',{...base.config(),scene},'()=>null');}catch(e){error=e.stack;}
  return {scene,wasmSHA256:sha(bytes),sourceSHA256:sha(source()),error,records,depthRecords,...JSON.parse(JSON.stringify(context.legacyTextureEvidence))};
}
function inspect(r){
  const failures=[],diagnostics=[];if(r.error)return {scene:r.scene,error:r.error,failures:[{error:r.error}]};
  assert.equal(r.status,'PASS');assert.equal(r.stats.fallbacks,0);assert.equal(r.stats.declined,0);
  const {method,owned,flags}=r.scene,C=0xff0b1621,K=method==='clear'?0xffffffff:0xff445566,G=0xff20c050;
  for(const o of r.observations){
    const b=r.depthRecords.find(d=>d.label===o.label),initial=o.label==='initial',geometry=o.label==='after geometry';
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const i=y*32+x,inside=x>=7&&x<25&&y>=5&&y<25;
      const expectedDepth=!initial&&inside&&(flags&2)?method==='clear'?65535:49151:owned?16384:16383;
      let color=!initial&&inside&&(flags&1)?K:C;
      if(geometry&&owned&&inside&&(flags&2))color=G;
      // The separate GPU depth attachment is initialized at 1 on first draw;
      // CPU-to-GPU depth import is a distinct pre-existing limitation.
      if(geometry&&!owned)color=G;
      if(o.pixels[i]!==color)failures.push({label:o.label,kind:'color',x,y,want:color,got:o.pixels[i]});
      if(!owned&&!geometry&&o.depthWords[i]!==expectedDepth)failures.push({label:o.label,kind:'CPU D16',x,y,want:expectedDepth,got:o.depthWords[i]});
      if(owned){assert(b?.words,'backend depth after public color readback');const want=geometry&&inside&&(flags&2)?32768:expectedDepth;
        if(b.words[i]!==want)failures.push({label:o.label,kind:'backend D16',x,y,want,got:b.words[i]});}
    }
    if(geometry&&!owned)diagnostics.push('First GPU draw uses a separate initially-far depth attachment; CPU D16 import is outside this fix.');
  }
  return {scene:r.scene,colorGuards:3072,depthGuards:owned?3072:2048,failures,diagnostics};
}
async function main(){const wasm=process.argv.find(a=>a.startsWith('--wasm='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6),summary=[];
  for(const f of wasm?[wasm]:['build/wine-assembly.wasm','build/wine-assembly.compat.wasm'])for(const scene of plan()){
    const r=await run(f,scene),v=inspect(r);if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,path.basename(f)+'-'+scene.method+'-'+scene.owned+'-'+scene.flags+'.json.gz'),zlib.gzipSync(JSON.stringify(r)));}
    summary.push(v);console.log(JSON.stringify({...v,failures:v.failures.length,examples:v.failures.slice(0,2)}));}
  if(out)fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));if(summary.some(v=>v.failures.length))process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});module.exports={plan,source,run,inspect};

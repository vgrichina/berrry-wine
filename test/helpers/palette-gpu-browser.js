'use strict';

// Runs inside the browser with the complete, unmodified source closure plus
// test exports. All unexpected host calls fail; no decoder/export replacement.
globalThis.runPaletteGpu = async function (version) {
  const diagnostics = [];
  const observations = [];
  const evidence = globalThis.paletteGpuEvidence = {version,diagnostics,observations};
  const eq = (a, b, label) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      evidence.failedAssertion={label,actual:a,expected:b};
      throw Error(`${label}: actual=${JSON.stringify(a)} expected=${JSON.stringify(b)}`);
    }
  };
  const check = (value, label) => { if (!value) throw Error(label); };
  const module = await WebAssembly.compile(await (await fetch('/fixture.wasm')).arrayBuffer());
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {};
  for (const i of WebAssembly.Module.imports(module)) {
    imports[i.module] ||= {};
    if (i.kind === 'memory') imports[i.module][i.name] = memory;
    else {
      check(i.kind === 'function', `unsupported import ${i.module}.${i.name}`);
      imports[i.module][i.name] = () => { throw Error(`unexpected host call ${i.module}.${i.name}`); };
    }
  }
  for (const name of ['log', 'log_i32', 'log_api_exit', 'log_block', 'log_eip'])
    imports.host[name] = () => {};
  imports.host.get_ticks = imports.host.real_time_ms = () => 0;
  // Production surface creation emits this diagnostic-only, void import.
  // Preserve its arguments as evidence; all behavioral imports remain strict.
  imports.host.dx_trace = (...args) => diagnostics.push(args);
  let gpu, gpuRouteEnabled=true, softwareDrawProbes=0;
  imports.host.gpu_gl_call = (op, p) => {
    if(!gpuRouteEnabled){
      // Nonindexed Worker routing probes DRAW directly: return0 selects the
      // software rasterizer (d3dim_worker_try_draw). Never invoke the executor.
      check(op===0x20000||op===0x20002||op===0x20001,'unexpected GPU operation in software phase');
      if(op===0x20000)softwareDrawProbes++;
      return 0;
    }
    check(gpu, 'GPU host call before executor initialization');
    return gpu.call(op, p);
  };
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  e.heap_init(0x2000000);
  const alloc = n => { const p = e.pa_alloc(n) >>> 0; check(p, 'allocation'); return p; };
  const stack = alloc(4096) + 2048;
  const call = (fn, ...args) => { e.pa_stack(stack); return fn(...args) >>> 0; };
  e.pa_seed(alloc(1024));
  const dd = e.pa_ddraw(), desc = alloc(128), out = alloc(16), entries = alloc(1024);
  const surface = (bpp, caps) => {
    for (let i = 0; i < 128; i += 4) e.guest_write32(desc + i, 0);
    for (const [off, value] of [[0,108],[4,0x1007],[8,4],[12,4],[72,32],
      [76,bpp === 8 ? 0x60 : 0x40],[84,bpp],[104,caps]]) e.guest_write32(desc + off, value);
    if (bpp === 32) for (const [off, value] of [[88,0xff0000],[92,0xff00],[96,0xff]])
      e.guest_write32(desc + off, value);
    eq(call(e.pa_surface, dd, desc, out), 0, 'CreateSurface');
    return e.guest_read32(out) >>> 0;
  };
  const texture = surface(8, 0x1000), rt = surface(32, 0x2040);
  eq(call(e.pa_device, rt, out), 0, 'CreateDevice');
  const device = e.guest_read32(out) >>> 0;
  const rgb = [64,128,192];
  const entry = a => rgb[0] | rgb[1] << 8 | rgb[2] << 16 | a << 24;
  for (let i = 0; i < 256; i++) e.guest_write32(entries + i*4, entry(255));
  [0,128,255].forEach((a,i) => e.guest_write32(entries + (7+i)*4, entry(a)));
  const palette = caps => {
    alloc(8192);
    eq(call(e.pa_palette, dd, caps, entries, out), 0, 'CreatePalette');
    const p = e.guest_read32(out) >>> 0; alloc(8192); return p;
  };
  const alpha = palette(0x404), ordinary = palette(4);
  const paletteBytes = p => Array.from(new Uint8Array(memory.buffer, e.pa_palette_data(p), 1024));
  eq(paletteBytes(alpha), paletteBytes(ordinary), 'equal-byte palettes');
  const contexts = [];
  gpu = new D3DIMGpu.D3DIMGpu({ getExports: () => e, getMemory: () => memory.buffer,
    batchDraws: true, onError: error => { throw Error(error); },
    createCanvas: (w,h) => {
      const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
      const get = canvas.getContext.bind(canvas);
      canvas.getContext = (kind, ...args) => {
        if (version === 1 && kind === 'webgl2') return null;
        const gl = get(kind, ...args); if (gl) contexts.push(gl); return gl;
      };
      return canvas;
    } });
  e.d3dim_gpu_enable(1);
  e.set_page_watch_audit(0);
  e.pa_bind(device, 0, texture);
  eq(call(e.pa_attach, texture, alpha), 0, 'SetPalette');
  gpu._view();
  const d = gpu._describe(device);
  check(d && d.texBpp === 8 && !d.keyed, 'real unkeyed indexed descriptor');
  const dib = e.pa_w2g(d.texDib) >>> 0;
  for (let y=0; y<4; y++) for (let x=0; x<4; x++)
    e.guest_write8(dib+y*d.texPitch+x, 7+Math.min(x,2));
  // Scratch allocation precedes acquiring the palette page lease.
  check(e.d3dim_gpu_decode_texture(d.texture, 0), 'decoder scratch');
  const vertices = alloc(6*32), fv = new DataView(new ArrayBuffer(4));
  const float = (p,v) => { fv.setFloat32(0,v,true); e.guest_write32(p,fv.getUint32(0,true)); };
  const rs = (id,value) => e.pa_rs(device,id,value);
  const tss = (id,value) => e.pa_tss(device,0,id,value);
  for (const [id,value] of [[7,0],[14,0],[15,0],[22,1],[27,0],[28,0],[41,0]]) rs(id,value);
  // SELECTARG1(TEXTURE), including alpha, with point sampling and clamp.
  for (const [id,value] of [[1,2],[2,2],[4,2],[5,2],[13,3],[14,3],[16,1],[17,1]]) tss(id,value);
  e.pa_tss(device,1,1,1);
  const draw = (z=.5, color=0xffffffff, uv=null, expectGpu=true) => {
    [[-.5,-.5,0,0],[3.5,-.5,1,0],[-.5,3.5,0,1],
      [3.5,-.5,1,0],[3.5,3.5,1,1],[-.5,3.5,0,1]].forEach(([x,y,u,v],i) => {
      const p=vertices+i*32;
      [x,y,z,1].forEach((n,j)=>float(p+j*4,n));
      e.guest_write32(p+16,color); e.guest_write32(p+20,0);
      float(p+24,uv ? uv[0] : u); float(p+28,uv ? uv[1] : v);
    });
    const before = gpu.stats.drawCalls;
    const probesBefore=softwareDrawProbes;
    e.pa_draw(device,4,3,vertices,6);
    if (expectGpu) check(gpu.stats.drawCalls > before, 'draw must use actual GPU, no software fallback');
    else {
      eq(softwareDrawProbes,probesBefore+1,'software draw declined exactly one Worker probe');
      eq(gpu.stats.drawCalls,before,'software draw must not use GPU');
    }
  };
  const read = () => {
    gpu.fence();
    const target = gpu.targets.get(d.rt), g = target.device.gpu, gl = g.gl;
    evidence.actualVersion=gl.getParameter(gl.VERSION);
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    evidence.renderer=gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    evidence.stats=gpu.snapshot();
    g.bindImplicitTarget();
    const bytes = new Uint8Array(4*4*4);
    gl.readPixels(0,0,4,4,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    eq(gl.getError(),0,'WebGL readback');
    // Rows are identical; examine an interior row away from raster edges.
    return [0,1,2].map(x=>Array.from(bytes.slice((4+x)*4,(5+x)*4)));
  };
  const record = (label, expected) => { const actual=read(); eq(actual,expected,label); observations.push({label,actual}); };
  const rgba = (a, colors=[rgb,rgb,rgb]) => a.map((v,i)=>[...colors[i],v]);
  const clear = tex => eq(e.pa_clear(d.rt,1,0xff000000,1,0,0,4,4,tex),1,'real WAT clear descriptor accepted');
  const matrix = (label, alphas, colors) => {
    rs(15,0); rs(27,0); draw(); record(`${label} draw RGBA`,rgba(alphas,colors));
    clear(d.texture); record(`${label} textured clear RGBA`,rgba(alphas,colors));
    check(gpu.textures.get(d.texture).watch,'actual texture page lease');
    if (gpu._describe(device).palette) check(gpu.textures.get(d.texture).paletteWatch,'actual palette page lease');
  };
  matrix('alpha 0/128/255',[0,128,255]);
  const setFlags = (pal,values) => {
    const before = paletteBytes(pal);
    values.forEach((a,i)=>e.guest_write32(entries+i*4,entry(a)));
    eq(call(e.pa_entries,pal,7,3,entries),0,'SetEntries');
    const after=paletteBytes(pal);
    eq(before.flatMap((v,i)=>v===after[i]?[]:[i]),[31,35,39],'alpha-only mutation');
  };
  setFlags(alpha,[255,0,128]); matrix('watched alpha edit',[255,0,128]);
  setFlags(alpha,[0,128,255]); matrix('watched alpha restore',[0,128,255]);
  eq(paletteBytes(alpha),paletteBytes(ordinary),'equal bytes before mode switch');
  eq(call(e.pa_attach,texture,ordinary),0,'ordinary attach'); matrix('ordinary peFlags opaque',[255,255,255]);
  eq(call(e.pa_attach,texture,alpha),0,'alpha reattach'); matrix('alpha reattach',[0,128,255]);
  eq(call(e.pa_attach,texture,0),0,'detach');
  eq(e.get_dx_primary_pal_wa(),0,'grayscale fallback requires no primary palette');
  matrix('detach grayscale',[255,255,255],[[7,7,7],[8,8,8],[9,9,9]]);
  eq(call(e.pa_attach,texture,ordinary),0,'ordinary reattach');
  setFlags(ordinary,[255,0,128]); matrix('ordinary watched flags ignored',[255,255,255]);
  eq(call(e.pa_attach,texture,alpha),0,'alpha for application tests');
  clear(0); rs(15,1); rs(24,127); rs(25,5); // GREATER than 127/255
  draw(); record('application alpha test',[[0,0,0,255],[...rgb,128],[...rgb,255]]);
  rs(15,0); clear(0); rs(27,1); rs(19,5); rs(20,6); // SRCALPHA / INVSRCALPHA
  draw(); record('application alpha blend',[[0,0,0,255],[32,64,96,191],[...rgb,255]]);
  rs(27,0); rs(7,1); rs(14,1); rs(23,2); rs(15,1);
  eq(e.pa_clear(d.rt,3,0xff000000,1,0,0,4,4,0),1,'color/depth clear');
  draw(.1); // Alpha-zero fragment must write neither color nor near depth.
  rs(15,0); e.pa_bind(device,0,0); // Untextured diffuse, green and opaque.
  draw(.5,0xff00ff00);
  record('alpha rejection preserves depth',[[0,255,0,255],[...rgb,128],[...rgb,255]]);

  // Explicit DX7 key blending, ordinary palette only. Duplicate RGB entries
  // 7/8/9 distinguish native membership from comparing expanded colors.
  e.pa_bind(device,0,texture); eq(call(e.pa_attach,texture,ordinary),0,'key ordinary attach');
  e.guest_write32(out,7); e.guest_write32(out+4,7);
  eq(call(e.pa_key,texture,out),0,'SetColorKey native index 7');
  rs(7,0); rs(14,0); rs(15,0); rs(27,0); rs(41,1); rs(144,1);
  eq(gpu._describe(device).keyBlend,1,'state144 descriptor');
  clear(0); draw(); record('explicit key writes zero RGBA',[[0,0,0,0],[...rgb,255],[...rgb,255]]);
  const blendKey=gpu.textures.get(d.texture).key;
  rs(144,0); clear(0); draw();
  record('FALSE legacy key rejection',[[0,0,0,255],[...rgb,255],[...rgb,255]]);
  check(gpu.textures.get(d.texture).key!==blendKey,'key mode invalidates identical texture cache');
  rs(144,1); clear(0); draw();
  record('TRUE restored with same palette and bytes',[[0,0,0,0],[...rgb,255],[...rgb,255]]);
  rs(41,0); clear(0); draw(); record('state144 alone unkeyed',rgba([255,255,255]));
  rs(41,1);
  const uniform = color => [color,color,color];
  for (const filter of [1,2]) {
    tss(16,filter); tss(17,filter);
    clear(0); draw(.5,0xffffffff,[.125,.5]);
    record(`filter${filter} all-key zero`,uniform([0,0,0,0]));
    clear(0); draw(.5,0xffffffff,[.375,.5]);
    record(`filter${filter} duplicate nonkey zero-weight key`,uniform([...rgb,255]));
  }
  clear(0); draw(.5,0xffffffff,[.25,.5]);
  record('mixed taps zero RGB before linear filtering',uniform([32,64,96,128]));
  // GREATER 127 keeps the half-coverage fragment, GREATER 128 rejects it.
  rs(15,1); rs(25,5); rs(24,127); clear(0); draw(.5,0xffffffff,[.25,.5]);
  record('mixed app alpha pass',uniform([32,64,96,128]));
  rs(24,128); clear(0); draw(.5,0xffffffff,[.25,.5]);
  record('mixed app alpha reject',uniform([0,0,0,255]));
  rs(15,0); rs(27,1); rs(19,5); rs(20,6); clear(0); draw(.5,0xffffffff,[.125,.5]);
  record('key app blend preserves destination',uniform([0,0,0,255]));
  rs(27,0); rs(7,1); rs(14,1); rs(23,2); rs(15,1); rs(24,0);
  eq(e.pa_clear(d.rt,3,0xff000000,1,0,0,4,4,0),1,'key color/depth clear');
  draw(.1,0xffffffff,[.125,.5]);
  rs(15,0); e.pa_bind(device,0,0); draw(.5,0xff00ff00);
  record('key app rejection preserves depth',uniform([0,255,0,255]));
  // Without an application rejection, transparent black is still a fragment
  // and must occlude a later, farther opaque draw.
  e.pa_bind(device,0,texture);
  eq(e.pa_clear(d.rt,3,0xff0000ff,1,0,0,4,4,0),1,'key positive depth clear');
  draw(.1,0xffffffff,[.125,.5]);
  e.pa_bind(device,0,0); draw(.5,0xff00ff00);
  record('key zero alpha writes depth without app test',uniform([0,0,0,0]));
  // Alpha testing consumes the stage result, not the substituted texel alpha.
  e.pa_bind(device,0,texture); tss(4,3); tss(6,0); // SELECTARG2(DIFFUSE)
  rs(15,1); rs(24,0); rs(25,5);
  eq(e.pa_clear(d.rt,3,0xff0000ff,1,0,0,4,4,0),1,'key stage alpha depth clear');
  draw(.1,0xffffffff,[.125,.5]);
  rs(15,0); e.pa_bind(device,0,0); draw(.5,0xff00ff00);
  record('opaque diffuse alpha passes test and writes depth',uniform([0,0,0,255]));
  tss(4,2); rs(7,0); rs(14,0);

  const noKeyTexture=surface(8,0x1000);
  eq(call(e.pa_attach,noKeyTexture,alpha),0,'alpha palette on surface without key');
  e.pa_bind(device,0,noKeyTexture);
  const noKeyDesc=gpu._describe(device), noKeyDib=e.pa_w2g(noKeyDesc.texDib)>>>0;
  for(let y=0;y<4;y++) for(let x=0;x<4;x++)
    e.guest_write8(noKeyDib+y*noKeyDesc.texPitch+x,8);
  check(!noKeyDesc.keyed,'no attached key positive control');
  clear(0); draw(.5,0xffffffff,[.375,.5]);
  record('alpha palette state144 TRUE without attached key',uniform([...rgb,128]));
  // The unresolved combination must fail visibly rather than select precedence.
  e.pa_bind(device,0,texture); eq(call(e.pa_attach,texture,alpha),0,'unknown key alpha attach');
  rs(41,0); clear(0); draw(.5,0xffffffff,[.375,.5]);
  record('alpha palette state144 TRUE with COLORKEYENABLE FALSE',uniform([...rgb,128]));
  rs(41,1);
  let unresolved=false;
  try { draw(.5,0xffffffff,[.125,.5]); }
  catch (error) { unresolved=String(error).includes('precedence unresolved'); }
  check(unresolved,'actual GPU draw of explicit alpha palette/key combination fails fast');
  rs(41,0); rs(144,0); e.pa_bind(device,0,0);
  const stats = gpu.snapshot();
  check(stats.pageChecks>0 && stats.textureClears>0,'watch and clear routes exercised');
  eq(stats.textureByteChecks,0,'no byte-shadow cache fallback');
  eq(stats.dirtyAuditMisses,0,'no watch misses');
  eq(stats.fallbacks,0,'no renderer fallback');
  const gl=contexts[0], actualVersion=gl.getParameter(gl.VERSION);
  check(actualVersion.includes(`WebGL ${version}.0`),actualVersion);
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const result={actualVersion,renderer:gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),observations,stats,diagnostics};
  gpu.stop();
  gpuRouteEnabled=false;
  // Run the same ordinary indexed samples through the real software draw.
  // Fixed-point software filtering truncates alpha to127 at half coverage;
  // GPU RGBA8 readback rounds it to128. RGB is exact in both paths.
  e.d3dim_gpu_enable(0);
  e.pa_bind(device,0,texture); eq(call(e.pa_attach,texture,ordinary),0,'software ordinary attach');
  rs(7,0); rs(14,0); rs(15,0); rs(27,0); rs(41,1); rs(144,1);
  tss(16,2); tss(17,2);
  const rtGuest=e.pa_w2g(d.dib)>>>0;
  const softwareRecord = (label,u,expected) => {
    for(let y=0;y<4;y++) for(let x=0;x<4;x++) e.guest_write32(rtGuest+y*d.pitch+x*4,0xff0000ff);
    draw(.5,0xffffffff,[u,.5],false);
    const packed=e.guest_read32(rtGuest+d.pitch+4)>>>0;
    const actual=[packed>>>16&255,packed>>>8&255,packed&255,packed>>>24];
    observations.push({label,actual,expected}); eq(actual.slice(0,expected.length),expected,label);
  };
  softwareRecord('software indexed all-key RGBA',.125,[0,0,0,0]);
  softwareRecord('software indexed duplicate RGB nonkey',.375,[...rgb,255]);
  softwareRecord('software indexed mixed prefilter zero',.25,[32,64,96,127]);
  rs(15,1); rs(24,0); rs(25,5);
  softwareRecord('software indexed application rejection',.125,[0,0,255,255]);
  rs(15,0); rs(27,1); rs(19,5); rs(20,6);
  // This XRGB target has no alpha mask. Preserve all four raw bytes as
  // evidence, but constrain destination RGB only: X is not an alpha contract.
  softwareRecord('software indexed application blend (DIB X unconstrained)',.125,[0,0,255]);
  rs(27,0); rs(15,1); tss(4,3); tss(6,0);
  softwareRecord('software opaque diffuse alpha passes application test',.125,[0,0,0,255]);
  rs(15,0); tss(4,2);
  eq(call(e.pa_attach,texture,alpha),0,'software keyed alpha attach');
  rs(41,0);
  softwareRecord('software alpha palette state144 TRUE key disabled',.375,[...rgb,128]);
  rs(41,1); e.pa_bind(device,0,noKeyTexture);
  softwareRecord('software alpha palette state144 TRUE no attached key',.375,[...rgb,128]);
  e.pa_bind(device,0,texture);
  let softwareUnresolved=false;
  try { draw(.5,0xffffffff,[.125,.5],false); }
  catch (error) { softwareUnresolved=error instanceof WebAssembly.RuntimeError; }
  check(softwareUnresolved,'actual software draw of explicit alpha palette/key combination traps');
  result.softwareDrawProbes=softwareDrawProbes;
  return result;
};

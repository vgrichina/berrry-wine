#!/usr/bin/env node
'use strict';
const assert = require('assert');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { compile } = require('../lib/d3d9-shader');
const NativeIR = require('../lib/d3d-shader-ir');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    const page = await browser.newPage();
    for (const file of ['gpu-backend.js', 'd3d-shader-ir.js', 'd3d9-shader.js', 'd3d9-fixed.js', 'd3d9-backend.js'])
      await page.addScriptTag({ path: path.join(__dirname, '../lib', file) });
    const webglVersion = Number(process.env.D3D9_WEBGL_VERSION || 2);
    assert([1,2].includes(webglVersion), 'D3D9_WEBGL_VERSION must be 1 or 2');
    await page.evaluate(version => {
      // Puppeteer arguments cross JSON, not structured clone. Restore the
      // native byte payload at this test transport boundary. Ordinary cases
      // still run the production serialized-IR/profile checks, not compileIR.
      const compileNative=D3D9Shader.compileNativeIR;
      window.restoreShaderBytes=shader=>({...shader,
        nativeBytes:Uint8Array.from(Object.values(shader.nativeBytes))});
      D3D9Shader.compileNativeIR=(shader,options)=>compileNative(restoreShaderBytes(shader),options);
      const Device = D3D9Backend.Device;
      D3D9Backend.Device = class extends Device {
        constructor(canvas, options = {}) {
          super(canvas, {...options, webglVersion:version});
          if (this.gpu.version !== version) throw new Error('incorrect WebGL test context');
        }
      };
    }, webglVersion);
    if (process.env.D3D9_SHADER_CORPUS) {
      const shaders = [];
      for (const file of fs.readdirSync(process.env.D3D9_SHADER_CORPUS)) {
        if (!file.endsWith('.sdv')) continue;
        const bytes = fs.readFileSync(path.join(process.env.D3D9_SHADER_CORPUS, file));
        for (let offset = 0; offset + 4 <= bytes.length; ++offset) {
          const version = bytes.readUInt32LE(offset);
          if (version !== 0xffff0101 && version !== 0xfffe0101) continue;
          const words = new Uint32Array(Math.floor((bytes.length - offset) / 4));
          for (let i = 0; i < words.length; ++i) words[i] = bytes.readUInt32LE(offset + i * 4);
          try {
            const shader = compile(words);
            shaders.push({ name: `${file}+${offset.toString(16)}`, stage: shader.stage, source: shader.source });
            offset += shader.length * 4 - 1;
          } catch (_) { /* Header candidates inside metadata are not shaders. */ }
        }
      }
      assert.ok(shaders.length > 0, 'corpus must contain supported shader streams');
      const errors = await page.evaluate(shaders => {
        const gl = document.createElement('canvas').getContext('webgl');
        const errors = [];
        for (const s of shaders) {
          const shader = gl.createShader(s.stage === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
          gl.shaderSource(shader, s.source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) errors.push(`${s.name}: ${gl.getShaderInfoLog(shader)}`);
          gl.deleteShader(shader);
        }
        return errors;
      }, shaders);
      assert.deepStrictEqual(errors, []);
      console.log(`PASS ${shaders.length} translated corpus shaders compile on GPU (not gameplay coverage)`);
    }
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
      const gpu = new GpuBackend.WebGLBackend(canvas), gl = gpu.gl;
      const vs = D3D9Shader.compile(new Uint32Array([0xfffe0101,
        1, 0xc00f0000, 0x90e40000, // mov oPos, v0
        1, 0xd00f0000, 0x90e40001, // mov oD0, v1
        1, 0xe00f0000, 0x90e40002, // mov oT0, v2
        0xffff]));
      const ps = D3D9Shader.compile(new Uint32Array([0xffff0101,
        66, 0xb00f0000, // tex t0
        5, 0x800f0000, 0xb0e40000, 0x90e40000, // mul r0, t0, v0
        0xffff]));
      const program = gpu.createProgram(vs.source, ps.source, vs.attributes, ps.uniforms);
      const buffer = gpu.createBuffer();
      const vertices = [];
      for (const [x, y] of [[-1,-1], [3,-1], [-1,3]])
        vertices.push(x, y, 0.5, 1, 0.5, 0.25, 1, 1, 0.5, 0.5, 0, 1);
      gpu.updateBuffer(buffer, gl.ARRAY_BUFFER, new Float32Array(vertices));
      const texture = gpu.createTexture();
      gpu.uploadTexture2D(texture, { width: 1, height: 1, internalFormat: gl.RGBA,
        format: gl.RGBA, type: gl.UNSIGNED_BYTE, pixels: new Uint8Array([200, 160, 80, 255]) });
      gpu.setTextureParameter(texture, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gpu.setTextureParameter(texture, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gpu.bindTexture(texture, 0); gpu.setUniform(program, 'd3d_s0', '1i', 0);
      gpu.setViewport(0, 0, 16, 16);
      gpu.clear([0, 0, 0, 1], gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gpu.draw({ program, vertexBuffer: buffer, mode: gl.TRIANGLES, count: 3, stride: 48,
        attributes: vs.attributes.map((name, index) => ({ name, size: 4, offset: index * 16 })) });
      const pixels = new Uint8Array(4);
      gpu.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const error = gpu.getError(); gpu.destroy();
      return { pixels: Array.from(pixels), error };
    });
    assert.strictEqual(result.error, 0);
    for (const [i, value] of [100, 40, 80, 255].entries())
      assert.ok(Math.abs(result.pixels[i] - value) <= 1, `channel ${i}: ${result.pixels}`);
    console.log('PASS D3D9 VS/PS 1.1 bytecode: real GPU textured/modulated triangle', result.pixels);
    const lit = await page.evaluate(() => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const gpu=new GpuBackend.WebGLBackend(canvas),gl=gpu.gl;
      const vs=D3D9Shader.compile(new Uint32Array([0xfffe0101,
        1,0xc00f0000,0x90e40000,16,0xd00f0000,0xa0e40000,0xffff]));
      const ps=D3D9Shader.compile(new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]));
      const program=gpu.createProgram(vs.source,ps.source,vs.attributes,vs.uniforms);
      const buffer=gpu.createBuffer();
      gpu.updateBuffer(buffer,gl.ARRAY_BUFFER,new Float32Array([-1,-1,.5,1,3,-1,.5,1,-1,3,.5,1]));
      gpu.setViewport(0,0,4,4);
      const results=[];
      for(const values of [[1,0,0,-2],[1,-1,0,-2],[1,.5,0,2]]) {
        gpu.setUniform(program,'d3d_vs_c0','4f',values);
        gpu.draw({program,vertexBuffer:buffer,mode:gl.TRIANGLES,count:3,stride:16,
          attributes:[{name:'d3d_v0',size:4,offset:0}]});
        results.push(Array.from(gpu.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
      }
      const error=gpu.getError();gpu.destroy();return {results,error};
    });
    assert.strictEqual(lit.error,0);
    assert.deepStrictEqual(lit.results[0],[255,255,0,255],'LIT zero half-vector must not evaluate pow(0,negative)');
    assert.deepStrictEqual(lit.results[1],[255,255,0,255],'LIT negative half-vector is unlit');
    assert(Math.abs(lit.results[2][2]-64)<=1,'LIT positive half-vector lighting');
    console.log('PASS native-spec LIT branch behavior on real GPU');
    const dependent = await page.evaluate(() => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const vs=new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
        1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40001,0xffff]);
      const shader=opcode=>new Uint32Array([0xffff0101,66,0xb00f0000,opcode,0xb00f0001,0xb0e40000,
        1,0x800f0000,0xb0e40001,0xffff]);
      const sampler={addressU:3,addressV:3,min:1,mag:1,mip:0};
      const draw={vertexShader:vs,pixelShader:shader(67),primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,.5,1,3,-1,.5,1,-1,3,.5,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],vertexConstants:new Float32Array([.5,.5,0,1,.5,.5,0,1]),
        textures:[{width:1,height:1,format:62,pixels:new Uint8Array([128,128,0,0]),sampler},
          {width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),sampler}],
        state:{cull:1,zenable:false}};
      const errors=[];
      for(const bad of [undefined,[[],[0,0,0,0,0]], [[],[0,0,Infinity,0,0,0]]]) {
        draw.bumpStates=bad;try{device.draw(draw);errors.push('success');}catch(e){errors.push(e.message);}
      }
      draw.bumpStates=[null,new Float32Array([0,.25,.25,0,.5,.25])];
      const read=()=>Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const results=[];
      for(const opcode of [67,68]) {
        draw.pixelShader=shader(opcode);const pixels=[];
        for(const bytes of [[128,128,0,0],[128,127,85,0],[127,128,170,0],[127,127,255,0]]) {
          draw.textures[0].pixels=new Uint8Array(bytes);device.draw(draw);pixels.push(read());
        }
        results.push(pixels);
      }
      const cached=device.programs.size;
      draw.bumpStates[1]=new Float32Array([0,0,0,0,0,.5]);device.draw(draw);
      const changed=read(),sameCache=cached===device.programs.size;
      // Also copy sampled alpha into RGB to independently observe TEXBEML's
      // alpha scaling, regardless of presentation-canvas alpha policy.
      draw.pixelShader=shader(68);draw.pixelShader[8]=0xb0ff0001;
      device.draw(draw);const luminanceAlpha=read();
      draw.pixelShader=shader(70);delete draw.bumpStates;
      draw.textures[0]={width:1,height:1,pixels:new Uint8Array([77,64,192,255]),sampler};
      device.draw(draw);const gb=read();
      // Average opposite signed bytes BEFORE filtering; target's center is gray.
      draw.pixelShader=shader(67);draw.bumpStates=[null,new Float32Array([.25,0,0,.25,0,0])];
      draw.textures[0]={width:2,height:1,format:62,pixels:new Uint8Array([128,127,0,0,127,128,255,0]),
        sampler:{...sampler,min:2,mag:2}};
      draw.textures[1].sampler={...sampler,min:2,mag:2};
      let linear=null,linearError=null;
      try{device.draw(draw);linear=read();}catch(e){linearError=e.message;}
      const error=g.getError();device.destroy();return {results,errors,changed,sameCache,luminanceAlpha,gb,linear,linearError,error};
    });
    assert.strictEqual(dependent.error,0);
    assert(dependent.errors.every(e=>/bump metadata/.test(e)),'missing/invalid bump metadata cannot silently use GL zeros');
    const colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]];
    for(let opcode=0;opcode<2;opcode++) for(let lane=0;lane<4;lane++) for(let c=0;c<4;c++)
      assert(Math.abs(dependent.results[opcode][lane][c]-colors[lane][c]*(opcode?lane/6+.25:1))<=1,
        `dependent sample ${opcode}/${lane}/${c}: ${JSON.stringify(dependent.results)}`);
    assert(dependent.sameCache,'bump coefficient updates must not compile another variant');
    assert(dependent.changed.every(v=>Math.abs(v-128)<=1),'cached program receives updated matrix/luminance uniforms');
    assert(dependent.luminanceAlpha.slice(0,3).every(v=>Math.abs(v-128)<=1),'TEXBEML scales texture alpha');
    assert.deepStrictEqual(dependent.gb,[0,0,255,255]);
    if(dependent.linear) for(const [i,v] of dependent.linear.entries()) assert(Math.abs(v-(i===3?255:128))<=1);
    else assert.match(dependent.linearError,/float sampling\/filtering extensions/);
    console.log('PASS real GPU TEXREG2GB/TEXBEM/TEXBEML, signed decode, metadata validation, cache-safe uniforms',
      {linear:dependent.linear,linearUnsupported:dependent.linearError});
    // Compile the matrix fixtures through the real native validator, then send
    // its normalized IR view to the GPU lowerer (no guest token reparsing).
    const native=await bootRenderHarness({fonts:'none',extraWat:'(export "test_scan14" (func $d3d_ir_scan14))'}),wasm=native.exports;
    const allocation=wasm.guest_alloc(512)>>>0,sourcePointer=wasm.guest_to_wasm(allocation)>>>0;
    function nativeShader(tokens) {
      new Uint32Array(native.memory.buffer,sourcePointer,tokens.length).set(tokens);
      const p=wasm.d3d_shader_ir_compile(sourcePointer,tokens.length)>>>0;
      assert(p,`native matrix shader error ${wasm.d3d_shader_ir_error()}`);
      const result=NativeIR.read(native.memory.buffer,p);wasm.d3d_shader_ir_free(p);return result;
    }
    const pointVS=nativeShader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xc00f0002,0xa0aa0000,65535]);
    const pointPS=nativeShader([0xffff0101,1,0x800f0000,0xa0e40000,65535]);
    const pointGPU=await page.evaluate(({vs,ps})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
      const gpu=new GpuBackend.WebGLBackend(canvas),gl=gpu.gl;
      const v=D3D9Shader.compileIR(vs),p=D3D9Shader.compileIR(ps);
      const program=gpu.createProgram(v.source,p.source,v.attributes,[...v.uniforms,...p.uniforms]);
      const buffer=gpu.createBuffer();gpu.updateBuffer(buffer,gl.ARRAY_BUFFER,new Float32Array([0,0,.5,1]));gpu.setViewport(0,0,8,8);
      const counts=[];
      for(const size of [2,4]) {
        gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
        gpu.setUniform(program,'d3d_vs_c0','4f',[99,77,size,55]);gpu.setUniform(program,'d3d_ps_c0','4f',[1,0,0,1]);
        gpu.draw({program,vertexBuffer:buffer,mode:gl.POINTS,count:1,stride:16,attributes:[{name:'d3d_v0',size:4,offset:0}]});
        const pixels=gpu.readPixels(0,0,8,8,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256));
        counts.push(Array.from(pixels).filter((v,i)=>i%4===0&&v===255).length);
      }
      const error=gpu.getError();gpu.destroy();return{counts,error};
    },{vs:pointVS,ps:pointPS});
    assert.deepStrictEqual(pointGPU,{counts:[4,16],error:0},'native scalar oPts lowers to actual GPU point size, source z swizzle not source x');
    // PS1.4 through the production GPU path (public since D3D9-PUBLIC-PS14).
    const ps14Allocation=wasm.guest_alloc(16384)>>>0,ps14Pointer=wasm.guest_to_wasm(ps14Allocation)>>>0;
    function native14(body){
      const tokens=[0xffff0104,...body,65535];
      new Uint32Array(native.memory.buffer,sourcePointer,tokens.length).set(tokens);
      const count=wasm.test_scan14(sourcePointer,tokens.length,0);
      assert(count>=0,`native PS1.4 error ${wasm.d3d_shader_ir_error()} at ${wasm.d3d_shader_ir_error_offset()}`);
      new Uint8Array(native.memory.buffer,ps14Pointer,32+128*count).fill(0);
      new Uint32Array(native.memory.buffer,ps14Pointer,8).set([0x44534952,1,1,0xffff0104,count,tokens.length,32+128*count,0]);
      assert.strictEqual(wasm.test_scan14(sourcePointer,tokens.length,ps14Pointer),count);
      return NativeIR.read(native.memory.buffer,ps14Pointer);
    }
    const ps14VS=nativeShader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0005,0xa0e40000,65535]);
    const ps14Shaders={
      sample:native14([66,0x800f0005,0xb0e40005,1,0x800f0000,0x80e40005]),
      project:native14([66,0x800f0005,0xbaf40005,1,0x800f0000,0x80e40005]),
      dependent:native14([64,0x80070005,0xb0e40005,65533,66,0x800f0000,0x89e40005]),
      bump:native14([64,0x80070005,0xb0e40005,89,0x80030005,0x80e40005,0xa0e40000,65533,66,0x800f0000,0x80e40005]),
      depth:native14([64,0x80070005,0xb0e40005,65533,87,0x800f0005,1,0x800f0000,0xa0e40000]),
      cnd:native14([1,0x800f0001,0xa0e40001,80,0x800f0000,0xa0e40000,0x80e40001,0xa0e40002]),
      kill:native14([64,0x80070005,0xb0e40005,65533,65,0x800f0005,1,0x800f0000,0xa0e40000]),
    };
    const ps14GPU=await page.evaluate(({vs,shaders})=>{
      // ps_1_4 is public (D3D9-PUBLIC-PS14): the production compileNativeIR
      // lowers these from their serialized native IR, no adapter.
      {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const texture={width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}};
      const draw={vertexShader:vs,pixelShader:shaders.sample,primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,.75,1,3,-1,.75,1,-1,3,.75,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],state:{cull:1,zenable:false},
        vertexConstants:new Float32Array([.25,.75,1,1]),pixelConstants:new Float32Array([1,0,0,1]),
        textures:[texture,null,null,null,null,texture]};
      const read=()=>Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const run=(name,coords)=>{draw.pixelShader=shaders[name];if(coords)draw.vertexConstants.set(coords);device.clear([0,0,0,1],1);device.draw(draw);return read();};
      const sample=run('sample'),project=run('project',[.5,1.5,9,2]),zero=run('project',[.5,.5,9,0]);
      const dependent=run('dependent',[1.5,.5,2,1]);
      draw.pixelConstants=new Float32Array([.5,0,0,0]);draw.bumpStates=[];draw.bumpStates[5]=[1,0,0,1,0,0];
      const bump=run('bump',[.25,.25,1,1]);draw.bumpStates[5][0]=-1;const bumpChanged=run('bump');
      draw.pixelConstants=new Float32Array([.6,.5,-1,1,1,0,0,1,0,0,1,1]);const cnd=run('cnd');
      draw.pixelConstants=new Float32Array([1,0,0,1]);const killed=run('kill',[-.25,.5,1,1]),alive=run('kill',[.25,.5,1,1]);
      const depthAttachment={id:0x1400,width:4,height:4,format:75};draw.depthAttachment=depthAttachment;
      draw.state={cull:1,zenable:true,zwrite:true,zfunc:2};
      const depth=[];for(const value of [.25,.75]){
        draw.pixelShader=shaders.depth;draw.vertexConstants.set([value,1,0,1]);device.clear([0,0,0,1],3,.5,null,depthAttachment);device.draw(draw);depth.push(read());
      }
      const error=g.getError();device.destroy();return{sample,project,zero,dependent,bump,bumpChanged,cnd,killed,alive,depth,error};
      }
    },{vs:ps14VS,shaders:ps14Shaders});
    assert.deepStrictEqual(ps14GPU,{sample:[0,0,255,255],project:[0,0,255,255],zero:[255,255,255,255],
      dependent:[0,255,0,255],bump:[0,255,0,255],bumpChanged:[255,0,0,255],cnd:[255,0,255,255],
      killed:[0,0,0,255],alive:[255,0,0,255],depth:[[255,0,0,255],[0,0,0,255]],error:0});
    console.log('PASS staged native PS1.4 IR -> GPU six-stage TEXLD, projective/dependent reads, BEM uniforms, component CND, KILL and depth');
    const matrixVS=nativeShader([0xfffe0101,1,0xc00f0000,0x90e40000,
      1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40001,1,0xe00f0002,0xa0e40002,0xffff]);
    const matrixTokens=(mod,output=2)=>[0xffff0101,64,0xb00f0000,
      1,0xb00f0001,0xa0e40000,1,0xb00f0002,0xa0e40000,
      71,0xb00f0001,(0xb0e40000|mod<<24)>>>0,72,0xb00f0002,(0xb0e40000|mod<<24)>>>0,
      1,0x800f0000,(0xb0e40000|output)>>>0,0xffff];
    const matrixPS=[0,4].map(mod=>nativeShader(matrixTokens(mod))),matrixAlias=nativeShader(matrixTokens(0,1));
    const matrix=await page.evaluate(({vs,shaders,alias})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const draw={vertexShader:vs,pixelShader:shaders[0],primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],state:{cull:1,zenable:false},
        vertexConstants:new Float32Array([.25,.25,.75,1,1,0,0,99,0,1,0,99]),
        pixelConstants:new Float32Array([.2,.4,.6,1]),
        textures:[null,null,{width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),
          sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}]};
      const results=[],read=()=>Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      for(let modifier=0;modifier<2;modifier++) {
        draw.pixelShader=shaders[modifier];const pixels=[];
        for(const [u,v] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]) {
          draw.vertexConstants[0]=modifier?(u+1)/2:u;draw.vertexConstants[1]=modifier?(v+1)/2:v;
          device.draw(draw);pixels.push(read());
        }
        results.push(pixels);
      }
      draw.pixelShader=alias;device.draw(draw);const padRegister=read();
      const lowered=D3D9Shader.compileIR(shaders[0]),errors=[];
      for(const instructions of [shaders[0].instructions.slice(0,4),
        shaders[0].instructions.filter(ins=>ins.opcode!==71),
        [...shaders[0].instructions.slice(0,4),{opcode:0,args:[],offset:99},...shaders[0].instructions.slice(4)]]) {
        try{D3D9Shader.compileIR({...shaders[0],instructions});errors.push('success');}catch(e){errors.push(e.message);}
      }
      const error=g.getError();device.destroy();return {results,padRegister,errors,uniforms:lowered.uniforms,error};
    },{vs:matrixVS,shaders:matrixPS,alias:matrixAlias});
    assert.strictEqual(matrix.error,0);
    assert.deepStrictEqual(matrix.results,[colors,colors],'native IR rows use original destination UVW, including bx2');
    assert.deepStrictEqual(matrix.padRegister,[51,102,153,255],'PAD does not overwrite t1');
    assert.deepStrictEqual(matrix.uniforms.filter(n=>/^d3d_s/.test(n)),['d3d_s2'],'PAD stage needs no bound sampler');
    assert(matrix.errors.every(e=>/texm3x2/.test(e)),'incomplete/interrupted macros reject');
    console.log('PASS native IR -> real GPU TEXM3x2 pair: original UVW, hidden PAD, bx2, no PAD sampler, malformed pairs');
    const cubeVS=nativeShader([0xfffe0101,1,0xc00f0000,0x90e40000,
      1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40001,
      1,0xe00f0002,0xa0e40002,1,0xe00f0003,0xa0e40003,0xffff]);
    const cubeTokens=mod=>[0xffff0101,64,0xb00f0000,
      73,0xb00f0001,(0xb0e40000|mod<<24)>>>0,73,0xb00f0002,(0xb0e40000|mod<<24)>>>0,
      74,0xb00f0003,(0xb0e40000|mod<<24)>>>0,1,0x800f0000,0xb0e40003,0xffff];
    const cubePS=[0,4].map(mod=>nativeShader(cubeTokens(mod)));
    const cubeSpec=[75,76].flatMap(opcode=>[0,4].map(mod=>{
      const s=(0xb0e40000|mod<<24)>>>0;
      return nativeShader([0xffff0101,64,0xb00f0000,1,0xb00f0001,0xa0e40001,1,0xb00f0002,0xa0e40001,
        73,0xb00f0001,s,73,0xb00f0002,s,opcode,0xb00f0003,s,...(opcode===75?[0xa0e40007]:[]),1,0x800f0000,0xb0e40003,0xffff]);
    }));
    const cubeRGB=nativeShader([0xffff0102,64,0xb00f0000,82,0xb00f0003,0xb4e40000,1,0x800f0000,0xb0e40003,0xffff]);
    const cube=await page.evaluate(({vs,shaders,spec,rgb})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const faceColors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255],[255,0,255,255],[0,255,255,255]];
      const faces=faceColors.map(color=>({width:1,height:1,pixels:new Uint8Array(color)}));
      const draw={vertexShader:vs,pixelShader:shaders[0],primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],state:{cull:1,zenable:false},
        vertexConstants:new Float32Array(16),textures:[null,null,null,{...faces[0],faces,
          sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}]};
      const results=[],read=()=>Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      for(let mod=0;mod<2;mod++){
        draw.pixelShader=shaders[mod];const pixels=[];
        for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
          draw.vertexConstants.set([.75,.5,.25,1]);
          direction.forEach((value,row)=>draw.vertexConstants.set([value/(mod?.5:.75),0,0,99],4+row*4));
          device.draw(draw);pixels.push(read());
        }
        results.push(pixels);
      }
      const reflections=[];
      for(let variant=0;variant<spec.length;variant++){
        draw.pixelShader=spec[variant];draw.pixelConstants=new Float32Array(32);
        draw.pixelConstants.set([9,8,7,6],4);const pixels=[];
        for(const eye of [[1,0,0],[0,1,0],[0,0,1],[-1,0,0]]){
          draw.vertexConstants.set([variant&1?.75:.5,0,0,1,4,0,0,eye[0],4,0,0,eye[1],0,0,0,eye[2]]);
          draw.pixelConstants.set([...eye,99],28);device.draw(draw);pixels.push(read());
        }
        reflections.push(pixels);
      }
      const rgbResults=[];draw.pixelShader=rgb;
      for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        draw.vertexConstants.set([...direction.map(v=>(v+1)/2),1]);device.draw(draw);rgbResults.push(read());
      }
      const lowered=D3D9Shader.compileIR(shaders[0],{cubeStages:[3]}),errors=[];
      for(const instructions of [shaders[0].instructions.slice(0,2),shaders[0].instructions.filter((_,i)=>i!==2)]){
        try{D3D9Shader.compileIR({...shaders[0],instructions},{cubeStages:[3]});errors.push('success');}catch(e){errors.push(e.message);}
      }
      try{D3D9Shader.compileIR(shaders[0]);errors.push('success');}catch(e){errors.push(e.message);}
      const error=g.getError();device.destroy();return{results,reflections,rgbResults,faceColors,errors,uniforms:lowered.uniforms,error};
    },{vs:cubeVS,shaders:cubePS,spec:cubeSpec,rgb:cubeRGB});
    assert.strictEqual(cube.error,0);
    assert.deepStrictEqual(cube.results,[cube.faceColors,cube.faceColors],'native IR TEXM3x3 GPU six-face lookup and bx2');
    assert.deepStrictEqual(cube.rgbResults,cube.faceColors,'PS1.2 dependent RGB cube lookup and source bx2');
    assert.deepStrictEqual(cube.reflections,Array.from({length:4},()=>[2,0,5,3].map(face=>cube.faceColors[face])),
      'SPEC/VSPEC non-unit normal reflection matches native, original Q survives t register writes, constant c7');
    assert.deepStrictEqual(cube.uniforms.filter(n=>/^d3d_s/.test(n)),['d3d_s3']);
    assert(cube.errors.every(error=>/texm3x3/.test(error)),'incomplete/2D macros fail explicitly');
    console.log('PASS native IR -> real GPU TEXM3x3 cube/SPEC/VSPEC: six faces, bx2, non-unit normals, original Q, no PAD samplers');
    const ps12Shaders=[
      [0xffff0102,1,0x800f0001,0xa0e40001,88,0x800f0000,0xa0e40000,0x80e40001,0xa0e40002,0xffff],
      [0xffff0102,9,0x800f0000,0xa0e40000,0xa0e40001,0xffff],
      ...[82,83,85].map(op=>[0xffff0102,64,0xb00f0000,op,0xb00f0001,0xb0e40000,1,0x800f0000,0xb0e40001,0xffff]),
      [0xffff0102,64,0xb00f0000,73,0xb00f0001,0xb0e40000,73,0xb00f0002,0xb0e40000,86,0xb00f0003,0xb0e40000,1,0x800f0000,0xb0e40003,0xffff],
      // Same destination/disjoint masks; reversed CMP pairing and CMP/CMP.
      [0xffff0102,1,0x800f0001,0xa0e40002,88,0x80070000,0xa0e40000,0xa0e40001,0x80e40001,0x40000001,0x80080000,0xa0e40001,0xffff],
      [0xffff0102,1,0x800f0001,0xa0e40002,1,0x80080000,0xa0e40001,0x40000058,0x80070000,0xa0e40000,0xa0e40001,0x80e40001,0xffff],
      [0xffff0102,1,0x800f0001,0xa0e40002,88,0x80070000,0xa0e40000,0xa0e40001,0x80e40001,0x40000058,0x80080000,0xa0e40000,0xa0e40001,0x80e40001,0xffff],
      ...[false,true].map(reverse=>{
        const rgb=[1,0x80070001,0xa0e40001],alpha=[88,0x80080000,0x80aa0001,0xa0e40001,0xa0e40002];
        const pair=reverse?[alpha,rgb]:[rgb,alpha];pair[1]=[pair[1][0]|0x40000000,...pair[1].slice(1)];
        return[0xffff0102,1,0x800f0001,0xa0e40000,...pair.flat(),1,0x80070000,0x80e40001,0xffff];
      })
    ].map(nativeShader);
    const ps12GPU=await page.evaluate(({vs,shaders})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const draw={vertexShader:vs,primitive:4,primitiveCount:1,stride:16,
        vertices:new Uint8Array(new Float32Array([-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]).buffer),
        attributes:[{register:0,type:3,offset:0}],state:{cull:1,zenable:false},
        vertexConstants:new Float32Array([.25,.25,.75,1,1,0,0,99,0,1,0,99,0,0,1,99]),
        textures:[null,{width:2,height:2,pixels:new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]),
          sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}]};
      const results=[];
      for(let i=0;i<shaders.length;i++){
        draw.pixelShader=shaders[i];draw.pixelConstants=new Float32Array(i===0||i>=6?[-.25,0,.5,-0,.2,.4,.6,.8,.8,.6,.4,.2]:[.25,.5,.75,1,.1,.1,.1,.1]);
        if(i>=9)draw.pixelConstants[2]=-.5;
        device.draw(draw);results.push(Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));
      }
      const error=g.getError();device.destroy();return{results,error};
    },{vs:cubeVS,shaders:ps12Shaders});
    assert.strictEqual(ps12GPU.error,0);
    const ps12Expected=[[204,102,153,204],[64,64,64,64],[255,0,0,255],[255,0,0,255],[64,64,64,64],[64,64,191,255],
      [204,102,153,204],[204,102,153,204],[204,102,153,204],[51,102,153,51],[51,102,153,51]];
    ps12GPU.results.forEach((pixel,i)=>pixel.forEach((value,c)=>assert(Math.abs(value-ps12Expected[i][c])<=1,`PS1.2 GPU ${i}/${c}: ${pixel}`)));
    console.log('PASS native PS1.2 IR -> GPU CMP/DP4/TEXREG2RGB/TEXDP3TEX/TEXDP3/plain TEXM3x3');
    const depthPS=nativeShader([0xffff0103,64,0xb00f0000,71,0xb00f0001,0xb0e40000,
      84,0xb00f0002,0xb0e40000,1,0x800f0000,0xa0e40000,0xffff]);
    const plainPS=nativeShader([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]);
    const depthGPU=await page.evaluate(({vs,ps,plain})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const d=new D3D9Backend.Device(canvas),g=d.gpu,gl=g.gl;
      const draw={vertexShader:vs,pixelShader:ps,primitive:4,primitiveCount:1,stride:16,
        attributes:[{register:0,type:3,offset:0}],pixelConstants:new Float32Array([1,0,0,1]),state:{cull:1,zfunc:2}};
      const pixel=()=>Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const results=[];
      for(const format of [80,75])for(const [geometry,z,w]of [[.8,.25,1],[.2,.75,1],[.2,.25,0],[.8,-1,1],[.2,2,1]]){
        draw.depthAttachment={id:format,width:4,height:4,format};draw.pixelShader=ps;
        draw.vertices=new Uint8Array(new Float32Array([-1,-1,geometry,1,3,-1,geometry,1,-1,3,geometry,1]).buffer);
        draw.vertexConstants=new Float32Array([1,0,0,1,z,0,0,1,w,0,0,1,0,0,0,1]);
        draw.pixelConstants.set([1,0,0,1]);d.clear([0,0,0,1],3,.5,null,draw.depthAttachment);d.draw(draw);results.push(pixel());
        if(z===.25&&w===1){
          draw.pixelShader=plain;draw.pixelConstants.set([0,0,1,1]);
          draw.vertices=new Uint8Array(new Float32Array([-1,-1,.4,1,3,-1,.4,1,-1,3,.4,1]).buffer);d.draw(draw);results.push(pixel());
        }
      }
      const getExtension=gl.getExtension.bind(gl);gl.getExtension=name=>name==='EXT_frag_depth'?null:getExtension(name);
      draw.pixelShader=ps;let rejected='';try{d.draw(draw);}catch(e){rejected=e.message;}gl.getExtension=getExtension;
      const error=g.getError();d.destroy();return{results,rejected,error};
    },{vs:cubeVS,ps:depthPS,plain:plainPS});
    assert.strictEqual(depthGPU.error,0);
    const depthExpected=[[255,0,0,255],[255,0,0,255],[0,0,0,255],[0,0,0,255],[255,0,0,255],[0,0,0,255]];
    assert.deepStrictEqual(depthGPU.results,[...depthExpected,...depthExpected]);
    if (webglVersion === 1) assert.match(depthGPU.rejected,/EXT_frag_depth/);
    else assert.strictEqual(depthGPU.rejected,'','WebGL2 depth output is core without EXT_frag_depth');
    console.log('PASS PS1.3 actual GPU depth replacement/store, D16/D24S8, zero denominator and explicit range policy');
    const mipVS=nativeShader([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xe00f0000,0x90e40001,0xffff]);
    const mipPS=nativeShader([0xffff0101,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    const mipKillPS=nativeShader([0xffff0101,1,0xb00f0000,0xa0e40000,65,0xb00f0000,66,0xb00f0000,1,0x800f0000,0xb0e40000,0xffff]);
    const mipLevels=Array.from({length:3},(_,level)=>{const width=4>>level,pixels=[];
      for(let y=0;y<width;y++)for(let x=0;x<width;x++)pixels.push(...(level===0?(x%2?[0,255,0,255]:[255,0,0,255]):level===1?[0,0,255,255]:[255,255,255,255]));
      return{width,height:width,pixels};});
    const mipCases=[
      {lambda:-1,min:1,mag:2},{lambda:.25,min:1,mag:2},{lambda:.5,min:1,mag:2},
      {lambda:1.5,min:1,mag:2},{lambda:0,bias:1,min:2,mag:2},
      {lambda:1,bias:-1.5,min:1,mag:2},{lambda:-1,max:1,min:1,mag:2},
      {lambda:.5,base:1,min:1,mag:2},{lambda:1.5,base:1,min:2,mag:2},
      {lambda:2,bias:.25,mode:0,min:2,mag:1},
      {lambda:.5,bias:.125,mode:1,min:2,mag:1},
      {lambda:0,bias:.25,max:2,min:1,mag:2}
    ];
    for(const address of [1,2,3,4])for(const coord of [0,1,-.125,1.125])
      mipCases.push({lambda:-1,min:1,mag:2,address,coord});
    mipCases.push({lambda:1.5,bias:.25,min:2,mag:2,signed:true},{lambda:1.75,bias:.25,min:2,mag:2,levels:2});
    const signedMipLevels=mipLevels.map((level,i)=>({...level,pixels:level.pixels.map((v,c)=>c%4===0?[129,127,0][i]:c%4===1?[0,127,128][i]:c%4===2?[255,0,128][i]:13)}));
    new Uint8Array(native.memory.buffer,sourcePointer,mipPS.nativeBytes.length).set(mipPS.nativeBytes);
    const mipProgram=wasm.d3d_shader_vm_compile(sourcePointer),mipContext=wasm.d3d_shader_vm_context(mipProgram,15);
    const wa=n=>wasm.guest_to_wasm(wasm.guest_alloc(n))>>>0,table=wa(48),descriptor=wa(64);
    const nativeLevels=mipLevels.map(level=>{const p=wa(level.pixels.length);new Uint8Array(native.memory.buffer,p,level.pixels.length).set(level.pixels);return[p,level.width,level.height,level.width*4];});
    const expectedMip=mipCases.map(c=>{
      const base=c.base||0,count=c.levels||3;
      (c.signed?signedMipLevels:mipLevels).forEach((level,i)=>new Uint8Array(native.memory.buffer,nativeLevels[i][0],level.pixels.length).set(level.pixels));
      new Uint32Array(native.memory.buffer,table,12).set(nativeLevels.slice(base,count).flat());
      new Uint32Array(native.memory.buffer,descriptor,16).set([1,count-base,table,c.signed?62:0,c.address||3,c.address||3,0xff4080bf,c.min,c.mag,c.mode===undefined?2:c.mode,0,c.max||0,base,4,4,0]);
      new Float32Array(native.memory.buffer,descriptor+40,1)[0]=c.bias||0;
      assert.strictEqual(wasm.d3d_shader_vm_bind_texture_mips(mipContext,0,descriptor),1);
      return[0,1,2,3].map(channel=>Math.round(Math.max(0,Math.min(1,wasm.d3d_shader_vm_sample_lod(mipContext,0,c.coord??.55,c.coord??.55,c.lambda,channel)))*255));
    });
    const mipGPU=await page.evaluate(({vs,ps,killPS,levels,signedLevels,cases})=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
      const device=new D3D9Backend.Device(canvas),g=device.gpu,gl=g.gl;
      const draw={vertexShader:vs,pixelShader:ps,primitive:4,primitiveCount:1,stride:32,
        attributes:[{register:0,type:3,offset:0},{register:1,type:3,offset:16}],state:{cull:1,zenable:false}};
      const results=[],sizes=[];
      for(const c of cases){
        // D3D integer centers map to GL half-centers: the lower-left
        // vertex lands at (.5,-.5), so GL sample (2.5,2.5) is (2,3)
        // pixels from it. Keep the native oracle's exact (coord,coord).
        const delta=2**c.lambda/4,offsetX=(c.coord??.55)-2*delta,offsetY=(c.coord??.55)-3*delta;
        draw.vertices=new Uint8Array(new Float32Array([-1,-1,.5,1,offsetX,offsetY,0,1,
          3,-1,.5,1,offsetX+8*delta,offsetY,0,1,-1,3,.5,1,offsetX,offsetY+8*delta,0,1]).buffer);
        const resident=(c.signed?signedLevels:levels).slice(c.base||0,c.levels||3).map(level=>({...level,pixels:new Uint8Array(level.pixels)}));
        draw.textures=[{...resident[0],levels:resident,originalWidth:4,originalHeight:4,baseLOD:c.base||0,
          ...(c.signed?{format:62}:{}),sampler:{addressU:c.address||3,addressV:c.address||3,borderColor:0xff4080bf,min:c.min,mag:c.mag,mip:c.mode===undefined?2:c.mode,lodBias:c.bias||0,maxMipLevel:c.max||0}}];
        device.draw(draw);results.push(Array.from(g.readPixels(2,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))));sizes.push(device.programs.size);
      }
      const errors=[];
      const extension=gl.getExtension.bind(gl);gl.getExtension=name=>name==='OES_standard_derivatives'?null:extension(name);
      try{device.draw(draw);errors.push('success');}catch(e){errors.push(e.message);}gl.getExtension=extension;
      const parameter=gl.getParameter.bind(gl);gl.getParameter=name=>name===gl.MAX_TEXTURE_SIZE?1:parameter(name);
      try{device.draw(draw);errors.push('success');}catch(e){errors.push(e.message);}gl.getParameter=parameter;
      const resident=levels.map(level=>({...level,pixels:new Uint8Array(level.pixels)}));
      draw.textures=[{...resident[0],levels:resident,originalWidth:4,originalHeight:4,baseLOD:0,
        sampler:{addressU:3,addressV:3,min:1,mag:2,mip:2}}];
      // Preserve the intended quad UVs after the viewport center conversion:
      // raw GL (1,1) receives (.05,.05); raw GL (0,0) gets (-.45,-.45).
      draw.vertices=new Uint8Array(new Float32Array([-1,-1,.5,1,-.45,-.95,0,1,
        3,-1,.5,1,3.55,-.95,0,1,-1,3,.5,1,-.45,3.05,0,1]).buffer);
      draw.pixelShader=killPS;draw.pixelConstants=new Float32Array([1,1,1,1]);device.clear([0,0,0,1],1);device.draw(draw);
      const survivor=Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const discarded=Array.from(g.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      draw.pixelConstants.fill(-1);device.clear([0,0,0,1],1);device.draw(draw);
      const negativeWriteSurvivor=Array.from(g.readPixels(1,1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      const error=g.getError();device.destroy();return{results,sizes,errors,error,survivor,discarded,negativeWriteSurvivor};
    },{vs:mipVS,ps:mipPS,killPS:mipKillPS,levels:mipLevels,signedLevels:signedMipLevels,cases:mipCases});
    assert.strictEqual(mipGPU.error,0);
    mipGPU.results.forEach((actual,i)=>actual.forEach((v,c)=>assert.ok(Math.abs(v-expectedMip[i][c])<=1,`GPU mip case${i} channel${c}: ${v} vs native${expectedMip[i][c]}`)));
    assert(mipGPU.sizes.every(n=>n===1),'mip state values are uniforms, not program specializations');
    if (webglVersion === 1) assert.match(mipGPU.errors[0],/OES_standard_derivatives/);
    else assert.strictEqual(mipGPU.errors[0],'success','WebGL2 derivatives are core without the extension');
    assert.match(mipGPU.errors[1],/texture size/);
    assert.deepStrictEqual(mipGPU.survivor,[0,0,255,255],'TEXKILL helper contributes to later implicit LOD');
    assert.deepStrictEqual(mipGPU.discarded,[0,0,0,255],'deferred kill still suppresses output');
    assert.deepStrictEqual(mipGPU.negativeWriteSurvivor,[0,0,255,255],'TEXKILL ignores negative mutable t0 when original coordinates survive');
    wasm.d3d_shader_vm_free(mipContext);wasm.d3d_shader_vm_free(mipProgram);
    console.log('PASS GPU manual mip atlas vs native: distinct min/mag, SetLOD, bias, MAXMIPLEVEL, point/trilinear, cache and capability gates');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

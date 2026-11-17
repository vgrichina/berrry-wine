// Read-only JS projection of the WAT-owned shader IR. No guest token parser.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.D3DShaderIR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAGIC = 0x44534952, VERSION = 1, HEADER_BYTES = 32, INSTRUCTION_BYTES = 128;
  function read(memory, address, options = {}) {
    if (!Number.isInteger(address) || address < 0 || address % 4
        || address + HEADER_BYTES > memory.byteLength) throw new RangeError('shader IR header bounds');
    const view = new DataView(memory), u32 = p => view.getUint32(p, true);
    if (u32(address) !== MAGIC || u32(address + 4) !== VERSION) throw new Error('shader IR ABI mismatch');
    const stage = u32(address + 8), version = u32(address + 12), count = u32(address + 16),
      length = u32(address + 20), bytes = u32(address + 24), flags = u32(address + 28);
    // Core IR (flag 8, 09af1): vertex is always 0xfffe0200; pixel may
    // be the sampler-naming 0xffff0200 (texld names samplers 0..7).
    const core = (flags & 8) !== 0;
    if (stage > 1 || !(stage ? [0xffff0101,0xffff0102,0xffff0103,0xffff0104,...(core ? [0xffff0200] : [])] :
        (options.experimentalVS20 || core ? [0xfffe0100,0xfffe0101,0xfffe0200] : [0xfffe0100,0xfffe0101])).includes(version)
        || count > 65536 || length < 2 || length > 65536
        || bytes !== HEADER_BYTES + count * INSTRUCTION_BYTES || address + bytes > memory.byteLength)
      throw new RangeError('shader IR layout bounds');
    const instructions = [];
    for (let i = 0; i < count; i++) {
      const p = address + HEADER_BYTES + i * INSTRUCTION_BYTES;
      const opcode = u32(p), offset = u32(p + 4), operands = u32(p + 8), coissue = u32(p + 12);
      if (operands > 5 || offset < 1 || offset >= length || coissue > 1)
        throw new RangeError('shader IR instruction bounds');
      const args = [], relativeAddressBanks = [], relativeAddressComponents = [];
      for (let j = 0; j < operands; j++) {
        const q = p + 16 + j * 16, bank = u32(q), index = u32(q + 4),
          selector = u32(q + 8), modifier = u32(q + 12);
        if (version===0xfffe0200 && (modifier & 1024)) {
          if(bank!==2 || !(modifier&256))
            throw new RangeError('shader IR loop-relative metadata');
        }
        if(version===0xfffe0200&&(modifier&6144)&&
            (bank!==2||!(modifier&256)||(modifier&1024)))
          throw new RangeError('shader IR address component metadata');
        relativeAddressBanks.push(version===0xfffe0200&&(modifier&256)?((modifier&1024)?'aL':'a0'):null);
        relativeAddressComponents.push(version===0xfffe0200&&(modifier&256)?((modifier>>>11)&3):null);
        if (bank === 255) {
          // Private typed definitions retain raw DWORD values, but must not
          // silently erase malformed immediate metadata during projection.
          // Keep the existing legacy float DEF reader contract unchanged.
          if(version===0xfffe0200&&(opcode===47||opcode===48)&&(selector!==0||modifier!==0))
            throw new RangeError('shader IR typed immediate metadata');
          args.push(index); continue;
        }
        if (bank === 254) { args.push((0x80000000 | index | selector << 16) >>> 0); continue; }
        if (bank > 31 || index > 2047) throw new RangeError('shader IR register bounds');
        const base = 0x80000000 | (bank & 7) << 28 | (bank & 24) << 8 | index;
        // Retain the existing GLSL lowering's operand encoding internally.
        // These fields came from normalized IR, not unvalidated guest tokens.
        const dest = (j === 0 && !(version===0xfffe0200&&[25,26,27,30,38,40].includes(opcode))) || opcode === 31;
        if (dest) {
          if (selector > 15) throw new RangeError('shader IR write mask');
          args.push((base | selector << 16 | (modifier & 1) << 20 |
            ((modifier >>> 8) & 15) << 24) >>> 0);
        } else {
          if (selector > 255) throw new RangeError('shader IR swizzle');
          args.push((base | selector << 16 | (modifier & 15) << 24 |
            ((modifier >>> 8) & 1) << 13) >>> 0);
        }
      }
      instructions.push(Object.freeze({ opcode, offset, coissue: !!coissue, args: Object.freeze(args),
        relativeAddressBanks: Object.freeze(relativeAddressBanks),
        relativeAddressComponents: Object.freeze(relativeAddressComponents) }));
    }
    return Object.freeze({ irVersion: VERSION, stage: stage ? 'pixel' : 'vertex', version,
      length, flags, instructions: Object.freeze(instructions),
      // Executor handoff retains the validated native form, not reconstructed
      // guest bytecode. This copy survives freeing/reusing the WAT IR allocation.
      nativeBytes: new Uint8Array(memory,address,bytes).slice() });
  }
  // Read-only DFB1 projection. The copied IR owns its constant bindings (DEF),
  // so no executor may substitute the guest programmable constant banks.
  function readFixedBundle(memory, address) {
    if (!Number.isInteger(address) || address <= 0 || address % 4 || address + 32 > memory.byteLength)
      throw new RangeError('fixed bundle bounds');
    const v = new DataView(memory), word = n => v.getUint32(address + n * 4, true);
    if (word(0) !== 0x44464231 || word(7) !== 15 || word(5) !== 1)
      throw new Error('shared fixed bundle profile mismatch');
    const vertex = read(memory, word(1)), pixel = read(memory, word(2));
    if (vertex.stage !== 'vertex' || pixel.stage !== 'pixel' || vertex.flags !== 4 || pixel.flags !== 4)
      throw new Error('shared fixed IR origin mismatch');
    return Object.freeze({ version: 1, profile: 'positiont-modulate', constants: 'embedded-def',
      coordinates: 'd3d-clip', vertex, pixel });
  }
  // Descriptor projection and profile admission only. All coordinate and
  // combiner arithmetic is emitted by the native fixed compiler.
  function fixedPositionT(getExports, getMemory, draw) {
    const e = getExports?.(), f = draw.fixedFunction, s = f?.stages?.[0];
    if (!e?.d3d_fixed_compile_positiont || draw.vertexShader || draw.pixelShader || !s
        || f.lighting || f.fog || f.specular || f.alphaTest || f.colorKey || draw.fogState?.enabled
        || draw.state?.alphaTest || (draw.state?.fillMode ?? 3) !== 3
        || ![4,5,6].includes(draw.primitive) || draw.userClipPlanes?.mask
        || !draw.textures?.[0] || draw.textures[0].faces
        || s.colorOp !== 4 || s.colorArg1 !== 2 || s.colorArg2 !== 0
        || s.alphaOp !== 4 || s.alphaArg1 !== 2 || s.alphaArg2 !== 0
        || (s.resultArg ?? 1) !== 1 || s.transformFlags !== 0 || s.texCoordIndex !== 0
        || (f.stages[1]?.colorOp ?? 1) !== 1) return null;
    const a = draw.attributes || [], select = (usage, type) => a.filter(x =>
      x.usage === usage && x.usageIndex === 0 && type.includes(x.type));
    const pos = select(9,[3]), color = select(10,[3,4]), uv = select(5,[1,2,3]);
    if (a.length !== 3 || pos.length !== 1 || color.length !== 1 || uv.length !== 1) return null;
    const regs = [pos[0].register,color[0].register,uv[0].register];
    if (new Set(regs).size !== 3 || regs.some(r => !Number.isInteger(r) || r < 0 || r > 15)) return null;
    // Default viewport is resolved by the bridge before native compilation.
    const vp = draw.viewport;
    // The shared VS emits clip-space depth. Screen-space POSITIONT bypasses
    // depth clipping and viewport remapping in the established software path.
    // Admit only the identity depth mapping and in-range input depths; otherwise
    // retain each backend's existing fixed-function fallback before allocating.
    if (!vp || vp.minZ !== 0 || vp.maxZ !== 1) return null;
    // Match the descriptor's unsigned viewport domain before converting it.
    if ([vp.x,vp.y].some(n => !Number.isInteger(n) || n < 0 || n > 2048)
        || [vp.width,vp.height].some(n => !Number.isInteger(n) || n < 1 || n > 2048)) return null;
    const vertices = draw.vertices, stride = draw.stride, offset = pos[0].offset;
    if (!(vertices instanceof Uint8Array) || !Number.isInteger(stride) || stride < 16
        || !Number.isInteger(offset) || offset < 0 || offset + 16 > stride
        || vertices.byteLength % stride) return null;
    const input = new DataView(vertices.buffer, vertices.byteOffset, vertices.byteLength);
    // A finite RHW alone is insufficient: RCP can overflow, and MUL/MAD or
    // projection can lose a finite coordinate. This deliberately conservative
    // domain uses positive power-of-two RHW in [2^-16,2^16]. Scaling and its
    // reciprocal are exact unless a component underflows (checked below).
    // Unequal per-vertex RHW is allowed. Keep vertices inside the viewport so
    // the shared clipper need not construct vertices absent from the old path.
    // These f32 checks mirror only POSITIONT reconstruction/projection, never
    // emit IR or replace the native compiler/DEF bindings.
    const f32 = Math.fround, sx = f32(2 / vp.width), sy = f32(-2 / vp.height);
    const bx = f32(-1 - f32(vp.x * sx)), by = f32(1 - f32(vp.y * sy));
    for (let at = offset; at < vertices.byteLength; at += stride) {
      const x = input.getFloat32(at, true), y = input.getFloat32(at + 4, true),
        z = input.getFloat32(at + 8, true), rhw = input.getFloat32(at + 12, true);
      if (!(x >= vp.x && x <= vp.x + vp.width && y >= vp.y && y <= vp.y + vp.height
          && z >= 0 && z <= 1 && rhw >= 2 ** -16 && rhw <= 2 ** 16)
          || !Number.isInteger(Math.log2(rhw))) return null;
      const w = f32(1 / rhw), cx = f32(f32(f32(x * sx) + bx) * w),
        cy = f32(f32(f32(y * sy) + by) * w), cz = f32(z * w);
      if (![w,cx,cy,cz].every(Number.isFinite) || !(w > 0)
          || cx < -w || cx > w || cy < -w || cy > w || cz < 0 || cz > w
          || f32(1 / w) !== rhw
          || f32(vp.x + f32(f32(f32(f32(cx / w) + 1) * .5) * vp.width)) !== x
          || f32(vp.y + f32(f32(f32(1 - f32(cy / w)) * .5) * vp.height)) !== y
          || f32(cz / w) !== z) return null;
    }
    const guest = e.guest_alloc(288) >>> 0;
    if (!guest) throw new Error('shared fixed descriptor allocation failed');
    let bundle = 0;
    try {
      const p = e.guest_to_wasm(guest) >>> 0, memory = getMemory();
      const words = new Uint32Array(memory,p,72), floats = new Float32Array(memory,p,72);
      words.fill(0);
      words.set([0x44465831,1,15,...regs,s.colorOp,s.colorArg1,s.colorArg2,
        s.alphaOp,s.alphaArg1,s.alphaArg2,f.textureFactor,s.constant,1,0,0,
        vp.x,vp.y,vp.width,vp.height]);
      floats[21] = vp.minZ; floats[22] = vp.maxZ;
      bundle = e.d3d_fixed_compile_positiont(p) >>> 0;
      if (!bundle) throw new Error('shared native POSITIONT lowering rejected');
      return readFixedBundle(getMemory(),bundle);
    } finally {
      if (bundle) e.d3d_fixed_free(bundle);
      e.guest_free(guest);
    }
  }
  // ps1.x -> core IR (flag 8) is WAT-owned (09af1). The canonical IR is a new
  // allocation; the input stays owned by the caller. A decline is counted in
  // WAT and surfaces here as an error naming the declined opcode.
  function canonical(e, memory, pointer) {
    if (typeof e?.d3d_shader_ir_canonicalize !== 'function') throw new Error('native shader IR canonicalizer unavailable');
    const core = e.d3d_shader_ir_canonicalize(pointer) >>> 0;
    if (!core) throw new Error(`D3D shader IR canonicalization declined opcode 0x${(e.d3d_shader_ir_canon_decline_op() >>> 0).toString(16)}`);
    try { return read(memory(), core); } finally { e.d3d_shader_ir_free(core); }
  }
  // Same, for an IR projection's retained bytes (copied into guest memory).
  function canonicalBytes(e, memory, bytes) {
    const guest = e.guest_alloc(bytes.byteLength) >>> 0;
    if (!guest) throw new Error('shader IR canonicalization allocation failed');
    try {
      const p = e.guest_to_wasm(guest) >>> 0;
      new Uint8Array(memory(), p, bytes.byteLength).set(bytes);
      return canonical(e, memory, p);
    } finally { e.guest_free(guest); }
  }
  class Compiler {
    constructor({ getExports, getMemory, maxBytes = 1024 * 1024, maxEntries = 64 }) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1)
        throw new RangeError('shader IR cache budget');
      this.getExports = getExports; this.getMemory = getMemory;
      this.maxBytes = maxBytes; this.maxEntries = maxEntries; this.bytes = 0;
      this.entries = new Map();
    }
    compile(address, wordCount) {
      const memory = this.getMemory(), ex = this.getExports();
      if (typeof ex?.d3d_shader_ir_compile !== 'function' || typeof ex?.d3d_shader_ir_free !== 'function')
        throw new Error('native shader IR validator unavailable');
      if (!Number.isInteger(address) || address < 0 || address % 4
          || !Number.isInteger(wordCount) || wordCount < 2 || wordCount > 65536
          || address + wordCount * 4 > memory.byteLength) throw new RangeError('shader source bounds');
      const words = new Uint32Array(memory,address,wordCount);
      const previous = this.entries.get(address);
      if (previous?.words?.length === wordCount && words.every((v,i) => v === previous.words[i])) {
        this.entries.delete(address); this.entries.set(address,previous);
        return previous.ir;
      }
      // Pointer identity is not content identity: released guest allocations can
      // be reused. Compare immutable words before reusing a compiled view.
      if (previous) { this.entries.delete(address); this.bytes -= previous.bytes; }
      const ownedWords = words.slice();
      const pointer = ex.d3d_shader_ir_compile(address,wordCount) >>> 0;
      if (!pointer) throw new Error(`D3D shader IR validation ${ex.d3d_shader_ir_error()} at DWORD ${ex.d3d_shader_ir_error_offset()}`);
      let ir;
      try { ir = read(this.getMemory(),pointer); }
      finally { ex.d3d_shader_ir_free(pointer); }
      // Account for serialized IR and retained source; JS object overhead is
      // additionally bounded by maxEntries and the validated instruction limit.
      const bytes = HEADER_BYTES + ir.instructions.length * INSTRUCTION_BYTES + ownedWords.byteLength;
      if (bytes <= this.maxBytes) {
        while (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries) {
          const key = this.entries.keys().next().value;
          this.bytes -= this.entries.get(key).bytes; this.entries.delete(key);
        }
        this.entries.set(address,{words:ownedWords,ir,bytes}); this.bytes += bytes;
      }
      return ir;
    }
    retained(address, wordCount) {
      const memory = this.getMemory();
      if (!Number.isInteger(address) || address < 0 || address % 4
          || address + HEADER_BYTES > memory.byteLength || !Number.isInteger(wordCount)
          || wordCount < 2 || wordCount > 65536) throw new RangeError('retained shader IR bounds');
      const header = new DataView(memory,address,HEADER_BYTES), bytes = header.getUint32(24,true);
      if (bytes < HEADER_BYTES || bytes > HEADER_BYTES + 65536 * INSTRUCTION_BYTES
          || address + bytes > memory.byteLength || header.getUint32(20,true) !== wordCount)
        throw new RangeError('retained shader IR extent');
      const previous = this.entries.get(address), source = new Uint8Array(memory,address,bytes);
      // Allocations can be reused even though every published shader is
      // immutable. Content comparison prevents a stale pointer cache hit.
      if (previous?.retained && previous.ir.nativeBytes.length === bytes
          && source.every((v,i) => v === previous.ir.nativeBytes[i])) {
        this.entries.delete(address); this.entries.set(address,previous); return previous.ir;
      }
      if (previous) { this.entries.delete(address); this.bytes -= previous.bytes; }
      const ir = read(memory,address);
      if (ir.flags & ~3) throw new Error('retained shader IR guest profile is not enabled');
      if (bytes <= this.maxBytes) {
        while (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries) {
          const key = this.entries.keys().next().value;
          this.bytes -= this.entries.get(key).bytes; this.entries.delete(key);
        }
        this.entries.set(address,{retained:true,ir,bytes}); this.bytes += bytes;
      }
      return ir;
    }
    clear() { this.entries.clear(); this.bytes = 0; }
  }
  // Fixed-function state -> DFX1 descriptor + cascade rows (+ DLT1 lighting),
  // lowered by 09aj into shared VS/PS IR. Every executor (software VM, WebGL
  // GLSL) consumes that IR; this is descriptor packing and admission only.
  // env: exports(), memory(), alloc(bytes)->{wa} (caller owns release),
  // bundle(ptr) (caller frees with d3d_fixed_free), cache (0 = uncached),
  // components(declType) -> coordinate count or 0.
  // Cascade6 (192-byte rows) is selected only when something reads the
  // secondary colour, so every other state lowers to the exact cascade5 IR.
  function fixedCascade(env, snapshot, viewport, fixedVS = true, fixedPS = true, uvRequired = 0) {
    const invalid = message => { throw new Error('D3D9 fixed: ' + message); };
    const original=snapshot.fixedFunction;let f=original&&snapshot.fogState?{...original,fog:snapshot.fogState.enabled,
      fogColor:snapshot.fogState.color,fogTableMode:snapshot.fogState.tableMode}:original;
    const stage=f&&f.stages&&f.stages[0];
    if(!f||!stage)invalid('missing fixed-function state');
    if(f.fog&&f.fogTableMode)f={...f,fog:false}; // pixel fog takes precedence over vertex generation
    const memory=()=>env.memory(),e=env.exports();
    const attributes=fixedVS?snapshot.attributes||[]:[];
    const positions=attributes.filter(a=>(a.usage===0||a.usage===9)&&a.usageIndex===0);
    if(fixedVS&&positions.length!==1)invalid('fixed function requires exactly one position');
    const transformed=fixedVS&&positions[0].usage===9;
    // Any coordinate encoding with three components is a position; byte
    // quadruples stay refused (D3DCOLOR is host-permuted, UBYTE4 is an index
    // set). POSITIONT remains FLOAT4 only: its w is a real reciprocal.
    const components=fixedVS?env.components(positions[0].type):0;
    if(fixedVS&&(!components||components<3||[4,5,8].includes(positions[0].type)
      ||(transformed&&positions[0].type!==3)))invalid('invalid fixed position format');
    const diffuse=attributes.filter(a=>a.usage===10&&a.usageIndex===0);
    const uv=attributes.filter(a=>a.usage===5&&a.usageIndex===stage.texCoordIndex);
    const psize=attributes.filter(a=>a.usage===4&&a.usageIndex===0);
    if(diffuse.length>1||uv.length>1||psize.length>1)invalid('duplicate fixed vertex semantic');
    if(psize.length&&psize[0].type!==0)invalid('PSIZE requires FLOAT1');
    const selected=[positions[0],diffuse[0],uv[0],psize[0]],registers=selected.map(a=>a?a.register:null),used=new Set();
    for(const register of registers)if(register!==null){
      if(!Number.isInteger(register)||register<0||register>15||used.has(register))invalid('invalid fixed vertex registers');
      used.add(register);
    }
    for(let i=0;i<3;i++)if(registers[i]===null){registers[i]=Array.from({length:16},(_,n)=>n).find(n=>!used.has(n));used.add(registers[i]);}
    const integer=(value,label)=>{
      if(!Number.isInteger(value)||value<0||value>0xffffffff)invalid(`invalid fixed ${label}`);
      return value;
    };
    const point=fixedVS&&snapshot.state?.fillMode===1,pointState=snapshot.state||{};
    const block=env.alloc(point?320:288);
    const words=new Uint32Array(memory(),block.wa,point?80:72),floats=new Float32Array(memory(),block.wa,point?80:72);
    const pixel=(value,label)=>fixedPS?integer(value,label):0;
    words.fill(0);
        // Software consumes screen-space XYZ/RHW (flag 16); a GL executor needs
    // the clip-space reconstruction (POSITIONT alone).
    words.set([0x44465831,point?(psize.length?3:2):1,(transformed?(env.clipSpace?1:17):0)|(diffuse.length?2:0)|(uv.length?4:0)|(snapshot.textures?.[0]?8:0)|(point?32:0)|(point&&pointState.pointScale?64:0)|(point&&psize.length?128:0),...registers.slice(0,3),
      pixel(stage.colorOp,'COLOROP'),pixel(stage.colorArg1,'COLORARG1'),pixel(stage.colorArg2,'COLORARG2'),
      pixel(stage.alphaOp,'ALPHAOP'),pixel(stage.alphaArg1,'ALPHAARG1'),pixel(stage.alphaArg2,'ALPHAARG2'),
      pixel(f.textureFactor,'texture factor'),pixel(stage.constant,'stage constant'),
      pixel(f.stages[1]?f.stages[1].colorOp:1,'stage1 COLOROP'),fixedVS?integer(stage.transformFlags,'texture transform'):0,
      fixedVS?integer(stage.texCoordIndex,'coordinate index'):0,viewport.x,viewport.y,viewport.width,viewport.height]);
    floats[21]=viewport.minZ;floats[22]=viewport.maxZ;
    if(point){
      const values=['pointSize','pointScaleA','pointScaleB','pointScaleC'].map((key,i)=>pointState[key]===undefined?(i<2?1:0):pointState[key]);
      if(values.some(v=>!Number.isFinite(v)||v<0))invalid('invalid point size/attenuation');
      floats.set(values,72);
      if(psize.length)words[76]=registers[3];
    }
    if(fixedVS&&!transformed)for(const [name,offset]of[['world',24],['view',40],['projection',56]]){
      const values=f[name];
      if(!(values instanceof Float32Array)||values.length!==16)invalid(`invalid fixed ${name} matrix`);
      floats.set(values,offset);
    }
    if(f.stages.length>6)invalid('fixed cascade supports at most six stages');
    const normals=attributes.filter(a=>a.usage===3&&a.usageIndex===0);
    const speculars=attributes.filter(a=>a.usage===10&&a.usageIndex===1);
    if((f.fog||f.specular)&&speculars.length>1)invalid('duplicate specular input');
    const lit=fixedVS&&!!f.lighting&&!transformed;
    // D3DTA_SPECULAR (4) in any argument of a stage the cascade will run.
    let specularArg=false;
    if(fixedPS)for(let i=0;i<6;i++){const s=f.stages[i];
      if(!s||s.colorOp===1||(s.colorArg1===2&&!snapshot.textures?.[i]))break;
      if(['colorArg0','colorArg1','colorArg2','alphaArg0','alphaArg1','alphaArg2'].some(k=>((s[k]??0)&15)===4))specularArg=true;}
    const postSpecular=fixedPS&&!!f.specular;
    const six=postSpecular||specularArg||(fixedVS&&!fixedPS&&speculars.length>0),stride=six?192:160,rw=stride/4;
    const table=env.alloc(6*stride);
    const stageWords=new Uint32Array(memory(),table.wa,6*rw);stageWords.fill(0);
    let terminated=false;
    for(let i=0;i<6;i++){
      const s=f.stages[i]||{colorOp:1},active=!terminated&&s.colorOp!==1&&!(s.colorArg1===2&&!snapshot.textures?.[i]);
      if(!active)terminated=true;
      if(active&&fixedPS&&s.resultArg!==undefined&&![1,5].includes(s.resultArg))invalid('invalid fixed RESULTARG');
      const needed=(active&&fixedPS)||(fixedVS&&(uvRequired&(1<<i))),flags=s.transformFlags??0;
      if(needed&&flags&&(!fixedVS||![2,3,4,259,260].includes(flags)))invalid('unsupported fixed texture transform flags');
      if(needed&&(flags&256)&&(snapshot.textures?.[i]?.faces||(fixedPS&&([22,23].includes(s.colorOp)||[22,23].includes(f.stages[i-1]?.colorOp)))))
        invalid('projected cube/bump coordinates are not implemented');
      if(needed&&snapshot.textures?.[i]?.faces&&flags&&(flags&255)<3)invalid('cube transform needs three coordinates');
      if(active&&fixedPS&&[22,23].includes(s.colorOp)){
        const texture=snapshot.textures?.[i],coefficients=snapshot.bumpStates?.[i];
        if(!texture||texture.format!==62||texture.faces)invalid('fixed bump requires signed 2D format62');
        if(!(coefficients instanceof Float32Array)||coefficients.length!==6||!coefficients.every(Number.isFinite))invalid('invalid fixed bump coefficients');
      }
      if(active&&fixedPS&&i&&[22,23].includes(f.stages[i-1]?.colorOp)&&snapshot.textures?.[i]?.faces)
        invalid('cube fixed bump coordinates are not implemented');
      const index=s.texCoordIndex??i,generation=index>>>16,input=attributes.filter(a=>a.usage===5&&a.usageIndex===(index&65535));
      if(needed&&(generation>3||generation&&(!fixedVS||transformed)))invalid('unsupported generated texture coordinates');
      if(needed&&(generation===1||generation===3)&&(normals.length!==1||![2,3].includes(normals[0].type)))invalid('camera normal/reflection requires one FLOAT3/4 NORMAL');
      if(input.length>1)invalid('duplicate fixed texture coordinate');
      const reg=input.length?integer(input[0].register,'UV register'):16;
      if((active&&fixedPS)||(fixedVS&&(uvRequired&(1<<i)))){integer(index,'coordinate index');integer(s.transformFlags??0,'texture transform');}
      stageWords.set([integer(s.colorOp,'COLOROP'),s.colorArg1??2,s.colorArg2??1,s.alphaOp??1,s.alphaArg1??2,s.alphaArg2??1,
        s.constant??0xffffffff,snapshot.textures?.[i]?1:0,reg,flags,index,s.resultArg??1,s.colorArg0??1,s.alphaArg0??1,input.length?Math.min(input[0].type+1,4):0,0],i*rw);
      stageWords[i*rw+32]=normals.length===1?integer(normals[0].register,'NORMAL register'):16;
      stageWords[i*rw+33]=(f.normalizeNormals?1:0)|((f.localViewer===false||f.localViewer===0)?0:2);
      if(needed&&flags&&fixedVS&&!transformed){
        if(!(s.transform instanceof Float32Array)||s.transform.length!==16||!s.transform.every(Number.isFinite))invalid('invalid fixed texture matrix');
        new Float32Array(memory(),table.wa+i*stride+64,16).set(s.transform);
      }
      if(active&&fixedPS)for(const key of ['colorArg1','colorArg2','alphaOp','alphaArg1','alphaArg2','constant',
        ...([25,26].includes(s.colorOp)?['colorArg0']:[]),...([25,26].includes(s.alphaOp)?['alphaArg0']:[])])if(s[key]!==undefined)integer(s[key],key);
    }
    if(f.fog){stageWords[34]=1|(f.rangeFog?2:0);stageWords[35]=integer(f.fogVertexMode??0,'vertex fog mode');
      new Float32Array(memory(),table.wa+144,3).set([f.fogStart??0,f.fogEnd??1,f.fogDensity??1]);
      stageWords[39]=speculars.length?integer(speculars[0].register,'specular register'):16;
      integer(f.fogColor??0,'fog color');}
    if(six){
      // oD1: lit -> lighting writes it (zero without SPECULARENABLE); unlit ->
      // saturated COLOR1 (zero when absent); programmable VS -> untouched.
      stageWords[40]=!fixedVS?17:lit||!speculars.length?16:integer(speculars[0].register,'specular register');
      stageWords[41]=(specularArg?1:0)|(postSpecular?2:0);
    }
    const args=[block.wa,table.wa,6,(fixedVS?1:0)|(fixedPS?2:0),uvRequired];
    const bundle=(env.cache?(six?e.d3d_fixed_compile_cached6:e.d3d_fixed_compile_cached)(env.cache,...args):
      (six?e.d3d_fixed_compile_cascade6:e.d3d_fixed_compile_cascade5)(...args))>>>0;
    if(!bundle)invalid('native fixed-state validation or lowering rejected');
    env.bundle(bundle);
    if(lit){
      // No NORMAL is legal: D3D9 lights it as N=0, ambient + emissive only (DLT1 register 16).
      if(normals.length>1||(normals.length===1&&![2,3].includes(normals[0].type)))invalid('lighting requires at most one FLOAT3/4 NORMAL');
      if(speculars.length>1)invalid('duplicate lighting COLOR2');
      if(!f.material||!Array.isArray(f.lights)||f.lights.length>8)invalid('invalid material or directional light count');
      // ABI1: 64-byte directional rows. ABI2: 128-byte rows with position,
      // range, attenuation and cone. ABI3: ABI2 plus specular (09aj).
      const positional=f.lights.some(light=>light.type!==3),abi=f.specular?3:positional?2:1,row=abi>1?32:16;
      const lighting=env.alloc(128+row*4*f.lights.length);
      const lw=new Uint32Array(memory(),lighting.wa,32+row*f.lights.length);lw.fill(0);
      const lf=new Float32Array(memory(),lighting.wa,lw.length);
      const source=(key,def)=>{const n=f[key]??def;if(!Number.isInteger(n)||n<0||n>2)invalid('invalid material source');return n;};
      const color=(value,label)=>{if(!(value instanceof Float32Array)||value.length!==4||!value.every(Number.isFinite))invalid('invalid '+label);return value;};
      lw.set([0x444c5431,abi,f.lights.length,normals.length?integer(normals[0].register,'NORMAL register'):16,
        diffuse.length?diffuse[0].register:16,speculars.length?speculars[0].register:16,f.normalizeNormals?1:0,
        f.colorVertex===false||f.colorVertex===0?0:1,source('diffuseMaterialSource',1),source('ambientMaterialSource',0),source('emissiveMaterialSource',0)]);
      lw[12]=integer(f.ambientColor??0,'ambient color');
      for(const [i,key]of ['diffuse','ambient','emissive'].entries())lf.set(color(f.material[key],'material '+key),16+i*4);
      if(abi===3){
        const power=f.material.power;
        if(typeof power!=='number'||!Number.isFinite(power)||power<0)invalid('invalid material power');
        lw[13]=1|((f.localViewer===false||f.localViewer===0)?0:4);lw[14]=source('specularMaterialSource',2);
        lf.set(color(f.material.specular,'material specular').subarray(0,3),28);lf[31]=power;
      }
      const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))invalid('invalid light '+label);return value;};
      f.lights.forEach((light,i)=>{
        if(![1,2,3].includes(light.type))invalid('invalid light type');
        const base=32+i*row;lw[base]=light.type;lf.set(color(light.diffuse,'light diffuse'),base+1);
        lf.set(color(light.ambient,'light ambient'),base+5);
        if(abi===3)lf.set(color(light.specular,'light specular').subarray(0,3),base+22);
        if(light.type!==1){
          if(!(light.direction instanceof Float32Array)||light.direction.length!==3||!light.direction.every(Number.isFinite))invalid('invalid light direction');
          lf.set(light.direction,base+9);
        }
        if(light.type===3)return;
        if(!(light.position instanceof Float32Array)||light.position.length!==3||!light.position.every(Number.isFinite))invalid('invalid light position');
        lf.set(light.position,base+12);
        lf.set([finite(light.range,'range'),finite(light.attenuation0,'attenuation'),finite(light.attenuation1,'attenuation'),
          finite(light.attenuation2,'attenuation')],base+15);
        if(light.type===2){
          // Half-angle cosines are taken here so WAT runs no transcendental;
          // D3D9 bounds phi to [0,pi] and theta to [0,phi].
          const phi=Math.min(Math.max(finite(light.phi,'phi'),0),Math.PI),theta=Math.min(Math.max(finite(light.theta,'theta'),0),phi);
          lf.set([finite(light.falloff,'falloff'),Math.cos(theta/2),Math.cos(phi/2)],base+19);
        }
      });
      if(!(env.cache?e.d3d_fixed_light_cached(env.cache,bundle,block.wa,lighting.wa):e.d3d_fixed_bind_lighting(bundle,block.wa,lighting.wa)))
        invalid('native lighting validation or instruction budget exceeded');
    }
    const result=new Uint32Array(memory(),bundle,8);
    if(fixedPS&&!fixedVS)for(let i=0;i<6;i++)if((result[5]&(1<<i))&&(f.stages[i]?.texCoordIndex??i)!==i)invalid('programmable VS requires default texture coordinate index');
    return {sampled:result[5],
      vertex:fixedVS?{pointer:result[3],ir:read(memory(),result[1])}:null,
      pixel:fixedPS?{pointer:result[4],ir:read(memory(),result[2])}:null};
  }
  return { read, canonical, canonicalBytes, readFixedBundle, fixedPositionT, fixedCascade, Compiler, MAGIC, VERSION, HEADER_BYTES, INSTRUCTION_BYTES };
});

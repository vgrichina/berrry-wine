// D3D bytecode -> backend shader source. No guest state or COM ownership here.
(function (root, factory) {
  const api = factory(() => typeof module !== 'undefined' && module.exports
    ? require('./d3d-shader-ir') : root.D3DShaderIR);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.D3D9Shader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getIR) {
  'use strict';

  const OPS = {
    0: ['nop', 0], 1: ['mov', 2], 2: ['add', 3], 3: ['sub', 3],
    4: ['mad', 4], 5: ['mul', 3], 6: ['rcp', 2], 7: ['rsq', 2],
    8: ['dp3', 3], 9: ['dp4', 3], 10: ['min', 3], 11: ['max', 3],
    12: ['slt', 3], 13: ['sge', 3], 14: ['exp', 2], 15: ['log', 2],
    16: ['lit', 2], 17: ['dst', 3], 18: ['lrp', 4], 19: ['frc', 2],
    20: ['m4x4', 3], 21: ['m4x3', 3], 22: ['m3x4', 3],
    23: ['m3x3', 3], 24: ['m3x2', 3], 31: ['dcl', 2], 64: ['texcoord', 1],
    65: ['texkill', 1], 66: ['tex', 1], 67: ['texbem', 2], 68: ['texbeml', 2],
    69: ['texreg2ar', 2], 70: ['texreg2gb', 2], 71: ['texm3x2pad', 2], 72: ['texm3x2tex', 2],
    73: ['texm3x3pad', 2], 74: ['texm3x3tex', 2],
    75: ['texm3x3spec', 3], 76: ['texm3x3vspec', 2],
    82: ['texreg2rgb', 2], 83: ['texdp3tex', 2], 84: ['texm3x2depth', 2], 85: ['texdp3', 2], 86: ['texm3x3', 2], 88: ['cmp', 4],
    78: ['expp', 2], 79: ['logp', 2], 80: ['cnd', 4], 81: ['def', 5],
  };
  const PS14_OPS = {64:['texcrd',2],66:['texld',2],87:['texdepth',1],89:['bem',3],65533:['phase',0]};
  const VS20_OPS = {25:['call',1],26:['callnz',2],27:['loop',2],28:['ret',0],29:['endloop',0],30:['label',1],32:['pow',3],33:['crs',3],34:['sgn',4],35:['abs',2],36:['nrm',2],37:['sincos',4],38:['rep',1],39:['endrep',0],40:['if',1],42:['else',0],43:['endif',0],46:['mova',2],47:['defb',2],48:['defi',5]};
  const instructionSpec=(version,opcode)=>version===0xfffe0200?(VS20_OPS[opcode]||
    ([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,31,78,79,81].includes(opcode)?OPS[opcode]:null)):version===0xffff0104?(PS14_OPS[opcode]||
    ([0,1,2,3,4,5,8,9,18,65,80,81,88].includes(opcode)?OPS[opcode]:null)):OPS[opcode];
  function fail(message, offset) {
    throw new Error(`D3D shader DWORD ${offset}: ${message}`);
  }
  function parse(words) {
    if (!(words instanceof Uint32Array)) throw new TypeError('shader must be Uint32Array');
    const version = words[0] >>> 0;
    const stage = version >>> 16 === 0xfffe ? 'vertex'
      : version >>> 16 === 0xffff ? 'pixel' : null;
    if (!stage || !(stage==='pixel'?[0x0101,0x0102,0x0103,0x0104]:[0x0101]).includes(version&0xffff)) fail('unsupported shader version', 0);
    const instructions = [];
    let offset = 1;
    while (offset < words.length && offset < 65536) {
      const start = offset, token = words[offset++], opcode = token & 0xffff;
      if (token === 0x0000ffff) return { stage, version, instructions, length: offset };
      if (opcode === 0xfffe) {
        const size = (token >>> 16) & 0x7fff;
        if (offset + size > words.length) fail('truncated comment', start);
        offset += size;
        continue;
      }
      if ((token & 0xbfff0000) || ((token & 0x40000000) && stage !== 'pixel'))
        fail('unsupported instruction controls/coissue', start);
      const spec = instructionSpec(version,opcode);
      if (!spec) fail(`unsupported opcode ${opcode}`, start);
      if (offset + spec[1] > words.length) fail('truncated operands', start);
      const args = Array.from(words.subarray(offset, offset + spec[1]));
      for (let i = 0; i < (opcode === 81 ? 1 : args.length); ++i) {
        if (!(args[i] & 0x80000000)) fail('invalid parameter token', offset + i);
        if ((args[i] & 0x2000) && (stage !== 'vertex' || i === 0 || opcode === 31
            || (((args[i] >>> 28) & 7) | ((args[i] >>> 8) & 24)) !== 2))
          fail('invalid relative addressing operand', offset + i);
      }
      instructions.push({ opcode, name: spec[0], args, offset: start, coissue: !!(token & 0x40000000) });
      offset += spec[1];
    }
    fail('missing END or token limit exceeded', offset);
  }

  function compile(words, options = {}) {
    return compileIR(parse(words), options);
  }

  // Production handoff is serialized native IR, never a claim attached to an
  // arbitrary instruction object. This checks transport structure, not guest
  // legality: the native Compiler is the producer/validation boundary. Ignore
  // redundant JS projection fields so mutation cannot select different code.
  function compileNativeIR(shader, options = {}) {
    if (shader?.irVersion !== 1 || !(shader.nativeBytes instanceof Uint8Array))
      throw new TypeError('native shader IR bytes required');
    const reader = getIR();
    if (!reader) throw new Error('native shader IR reader unavailable');
    const bytes = shader.nativeBytes.slice();
    const ir = reader.read(bytes.buffer, 0);
    if ((ir.flags >>> 0) === 8) return compileCoreIR(ir, options);
    if ((ir.flags & ~3) !== 0)
      throw new Error('native shader IR guest profile is not enabled');
    return compileIR(ir, options);
  }

  // Core pixel IR (header flag 8): 09af1 WAT already lowered every ps1.x
  // rule -- source/result modifiers, coissue, cnd, texture addressing, bump,
  // depth and phase -- into core arithmetic plus texld/texkill. This is a
  // 1:1 statement printer; it knows no ps1.x semantics. Register model:
  // r0..r31 temps (r0 = colour), v0/v1 colour inputs, t0..t5 coordinates,
  // c0..c15 constants (DEF'd or uniforms), c16+2s / c17+2s stage-s bump
  // matrix / luminance, s0..s5 samplers, oDepth.
  function compileCoreIR(shader, options = {}) {
    if (shader?.stage !== 'pixel' || ![0xffff0101,0xffff0102,0xffff0103,0xffff0104].includes(shader.version >>> 0)
        || ((shader.flags >>> 0) & ~4) !== 8 || !(shader.nativeBytes instanceof Uint8Array))
      throw new TypeError('invalid core pixel IR');
    const bytes = shader.nativeBytes, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u32 = p => view.getUint32(p, true), count = u32(16);
    const cube = n => !!options.cubeStages?.includes(n), projected = options.projectedStages || [];
    const ps14 = (shader.version >>> 0) === 0xffff0104;
    if (projected.some(n => n !== 0)) {
      if (ps14 || projected.length > 6 || projected.some(n => ![0,3,4].includes(n))) fail('unsupported projected texture profile', 0);
      if (projected.some((n,i) => n && cube(i))) fail('projected cube sampling is not implemented', 0);
    }
    const temps = new Set(), inputs = new Set(), constants = new Map(), samplers = new Set(), bumpStages = new Set();
    const lines = []; let depthOutput = false, origin = 0;
    const name = (bank, index, write) => {
      if (bank === 0 && index < 32) { temps.add(index); return `r${index}`; }
      if (write) fail(`core IR destination bank ${bank}`, origin);
      if (bank === 1 && index < 2) { inputs.add(index); return `d3d_color${index}`; }
      if (bank === 3 && index < 6) { inputs.add(16 + index); return `d3d_tex${index}`; }
      if (bank === 2 && index < 16) { if (!constants.has(index)) constants.set(index, null); return `d3d_ps_c${index}`; }
      if (bank === 2 && index < 28) { const s = (index - 16) >> 1; bumpStages.add(s); return index & 1 ? `d3d_bumpL${s}` : `d3d_bump${s}`; }
      fail(`core IR register ${bank}:${index}`, origin);
    };
    const operand = (at, j) => { const q = at + 16 + j * 16; return { bank: u32(q), index: u32(q + 4), selector: u32(q + 8), modifier: u32(q + 12) }; };
    const swizzle = s => Array.from({ length: 4 }, (_, i) => 'xyzw'[(s >>> (2 * i)) & 3]).join('');
    const src = o => {
      if (o.modifier > 1 || o.selector > 255) fail('core IR source modifier', origin);
      const s = `${name(o.bank, o.index)}.${swizzle(o.selector)}`;
      return o.modifier ? `(-${s})` : `(${s})`;
    };
    for (let i = 0; i < count; i++) {
      const at = 32 + i * 128, op = u32(at), n = u32(at + 8);
      origin = u32(at + 4);
      if (u32(at + 12)) fail('core IR coissue', origin);
      if (op === 81) {
        const d = operand(at, 0);
        if (d.bank !== 2 || d.index >= 16) fail('invalid core DEF register', origin);
        const values = [1,2,3,4].map(j => view.getFloat32(at + 16 + j * 16 + 4, true));
        if (!values.every(Number.isFinite)) fail('non-finite DEF value', origin);
        constants.set(d.index, values.map(v => { const s = String(v); return /[.e]/i.test(s) ? s : `${s}.0`; }));
        continue;
      }
      const d = operand(at, 0), mask = d.selector & 15;
      if (!mask || d.selector > 15 || d.modifier) fail('core IR destination mask/modifier', origin);
      const comps = 'xyzw'.split('').filter((_, k) => mask & (1 << k)).join('');
      if (op === 65) {
        if (n !== 1) fail('invalid core texkill', origin);
        const value = name(d.bank, d.index);
        lines.push(comps.length === 1 ? `if (${value}.${comps} < 0.0) discard;`
          : `if (any(lessThan(${value}.${comps}, vec${comps.length}(0.0)))) discard;`);
        continue;
      }
      if (op === 1 && d.bank === 9) {
        if (d.index || mask !== 1) fail('invalid core oDepth write', origin);
        depthOutput = true;
        lines.push(`gl_FragDepthEXT = ${src(operand(at, 1))}.x;`);
        continue;
      }
      const target = name(d.bank, d.index, true), result = `result${i}`;
      let expression;
      if (op === 66) {
        const c = operand(at, 1), s = operand(at, 2), stage = s.index;
        if (n !== 3 || s.bank !== 10 || stage >= 6 || s.selector > 3 || s.selector === 1) fail('invalid core texld sampler', origin);
        if ((s.selector === 3) !== cube(stage) && s.selector) fail(`texld s${stage} ${cube(stage) ? 'cube' : '2D'} texture mismatch`, origin);
        if (![0, 9, 10].includes(c.modifier)) fail('invalid core texld coordinate', origin);
        samplers.add(stage);
        const value = name(c.bank, c.index), sw = swizzle(c.selector);
        const raw = c.bank === 3 && c.index === stage && c.selector === 0xe4 && !c.modifier;
        if (projected[stage] && !raw) fail('projected dependent texture instructions are not implemented', origin);
        if (cube(stage)) {
          if (c.modifier) fail('projective cube lookup is undefined', origin);
          expression = `textureCube(d3d_s${stage}, ${value}.${sw}.xyz)`;
        } else if (raw && projected[stage]) {
          const id = `${stage}_${origin}_${i}`, q = `d3d_tex${stage}.${projected[stage] === 3 ? 'z' : 'w'}`;
          lines.push(`bool projectValid${id} = ff_projectInput${stage} == 0.0 && abs(${q}) > 0.0 && abs(${q}) <= 3.402823466e38;`,
            `vec2 projectUV${id} = d3d_tex${stage}.xy / (projectValid${id} ? ${q} : 1.0);`,
            `projectValid${id} = projectValid${id} && all(lessThanEqual(abs(projectUV${id}),vec2(3.402823466e38)));`,
            `projectUV${id} = projectValid${id} ? projectUV${id} : vec2(0.0);`,
            `vec4 projectSample${id} = texture2D(d3d_s${stage},projectUV${id});`);
          expression = `(projectValid${id} ? projectSample${id} : vec4(0.0))`;
        } else if (c.modifier) {
          const den = `${value}.${c.modifier === 9 ? 'z' : 'w'}`;
          expression = `texture2D(d3d_s${stage}, (${den} == 0.0 ? vec2(1.0) : ${value}.${sw}.xy / ${den}))`;
        } else expression = `texture2D(d3d_s${stage}, ${value}.${sw}.xy)`;
      } else {
        const arity = { 1: 1, 2: 2, 4: 3, 5: 2, 6: 1, 8: 2, 9: 2, 10: 2, 11: 2, 18: 3, 88: 3 }[op];
        if (!arity || n !== arity + 1) fail(`core IR opcode ${op}`, origin);
        const [a, b, c] = Array.from({ length: arity }, (_, j) => src(operand(at, j + 1)));
        expression = {
          1: () => a, 2: () => `${a} + ${b}`, 4: () => `${a} * ${b} + ${c}`, 5: () => `${a} * ${b}`,
          6: () => `vec4(1.0 / ${a}.x)`, 8: () => `vec4(dot(${a}.xyz, ${b}.xyz))`, 9: () => `vec4(dot(${a}, ${b}))`,
          10: () => `min(${a}, ${b})`, 11: () => `max(${a}, ${b})`,
          18: () => `${a} * ${b} + (vec4(1.0) - ${a}) * ${c}`,
          88: () => `vec4(${['x','y','z','w'].map(ch => `${a}.${ch} >= 0.0 ? ${b}.${ch} : ${c}.${ch}`).join(', ')})`,
        }[op]();
      }
      lines.push(`vec4 ${result} = ${expression};`, `${target}.${comps} = ${result}.${comps};`);
    }
    temps.add(0);
    const constantName = k => `d3d_ps_c${k}`;
    const header = [...(depthOutput ? ['#extension GL_EXT_frag_depth : require'] : []), 'precision highp float;'];
    for (const [k, value] of constants) header.push(value
      ? `const vec4 ${constantName(k)} = vec4(${value.join(', ')});` : `uniform vec4 ${constantName(k)};`);
    for (const k of samplers) header.push(`uniform ${cube(k) ? 'samplerCube' : 'sampler2D'} d3d_s${k};`);
    for (const k of samplers) if (projected[k]) header.push(`varying float ff_projectInput${k};`);
    for (const k of bumpStages) header.push(`uniform vec4 d3d_bump${k};`, `uniform vec4 d3d_bumpL${k};`);
    for (const k of inputs) header.push(`varying vec4 d3d_${k >= 16 ? `tex${k - 16}` : `color${k}`};`);
    const declarations = [...temps].sort((x, y) => x - y).map(k => `vec4 r${k} = vec4(0.0);`);
    const source = [...header, 'void main() {', ...declarations, ...lines, 'gl_FragColor = r0;', '}'];
    return { ...shader, source: source.join('\n'), semantics: {}, depthOutput, clipDistanceMask: 0, fogOutput: false,
      bumpStages: Array.from(bumpStages), attributes: [], integerUniformRanges: [],
      uniforms: [...Array.from(constants).filter(([, v]) => !v).map(([k]) => constantName(k)),
        ...Array.from(samplers, k => `d3d_s${k}`), ...Array.from(bumpStages, k => [`d3d_bump${k}`, `d3d_bumpL${k}`]).flat()] };
  }

  // Fixed-origin IR has a separate entry point; guest shader validation must
  // continue rejecting flag4. Never infer this origin from projection fields.
  function compileNativeFixedIR(shader, options = {}) {
    if (shader?.irVersion !== 1 || !(shader.nativeBytes instanceof Uint8Array))
      throw new TypeError('native fixed IR bytes required');
    const bytes = shader.nativeBytes.slice(), ir = getIR().read(bytes.buffer,0);
    if (ir.flags === 12 && ir.stage === 'pixel') return compileCoreIR(ir, options);
    if (ir.flags !== 4) throw new Error('native fixed IR origin required');
    return compileIR(ir,options);
  }

  // The WAT validator's normalized IR view enters here without decoding the
  // original guest token stream again. parse() remains a migration/test path.
  // VS2 has forward-only, non-nested calls. Keep each body once rather than
  // expanding it at every callsite. This prepass also composes a0/loop effects.
  function callPlan(instructions) {
    if (!instructions.some(i => [25,26,28,30].includes(i.opcode))) return null;
    const main={id:null,body:[],lines:[]}, routines=[main], labels=new Map();
    let routine=main,ended=false;
    const label=(token,offset)=>{
      const n=token&2047;
      if((token>>>0)!==((0xa0e41000|n)>>>0))fail('invalid label source',offset);
      return n;
    };
    for(const ins of instructions){
      if(ins.opcode===30){
        if(!ended)fail('LABEL requires preceding RET',ins.offset);
        const id=label(ins.args[0],ins.offset);
        if(labels.has(id))fail('duplicate LABEL',ins.offset);
        routine={id,body:[],lines:[],offset:ins.offset};routines.push(routine);labels.set(id,routine);ended=false;
      }else if([31,47,48,81].includes(ins.opcode))routine.body.push(ins);
      else {
        if(ended)fail('instruction after RET without LABEL',ins.offset);
        routine.body.push(ins);if(ins.opcode===28)ended=true;
      }
    }
    if(routines.length>1&&!ended)fail('subroutine missing RET',instructions.at(-1)?.offset);
    function analyze(fn){
      let initialized=0,requiresA0=0,inheritedAL=false,hasLoop=false;
      const stack=[];
      for(const ins of fn.body){
        const op=ins.opcode;
        if(op===30)continue;
        if(op===40)stack.push({kind:'if',entry:initialized});
        else if(op===42){const f=stack.at(-1);if(f?.kind!=='if'||f.other!==undefined)fail('invalid ELSE',ins.offset);f.other=initialized;initialized=f.entry;}
        else if(op===43){const f=stack.pop();if(f?.kind!=='if')fail('invalid ENDIF',ins.offset);initialized &= f.other??f.entry;}
        else if(op===27||op===38){hasLoop=true;stack.push({kind:op===27?'loop':'rep',entry:initialized});}
        else if(op===29||op===39){const f=stack.pop();if(f?.kind!==(op===29?'loop':'rep'))fail('invalid loop boundary',ins.offset);initialized=f.entry;}
        else if(op===28){if(stack.length)fail('RET inside structured flow',ins.offset);}
        else if(op===25||op===26){
          if(fn!==main)fail('nested VS2 calls are not allowed',ins.offset);
          const callee=labels.get(label(ins.args[0],ins.offset));
          if(!callee||callee.offset<=ins.offset)fail('missing or backward CALL target',ins.offset);
          const loop=stack.find(f=>f.kind==='loop'),anyLoop=stack.some(f=>f.kind==='loop'||f.kind==='rep');
          if(callee.inheritedAL&&!loop)fail('called routine requires inherited aL',ins.offset);
          if(callee.hasLoop&&anyLoop)fail('called LOOP/REP exceeds nesting limit',ins.offset);
          requiresA0 |= callee.requiresA0 & ~initialized;
          if(op===25)initialized |= callee.writesA0;
        }else if(![31,47,48,81].includes(op)){
          for(let i=1;i<ins.args.length;i++)if(ins.args[i]&8192){
            if(ins.relativeAddressBanks?.[i]==='aL'){
              if(!stack.some(f=>f.kind==='loop'))inheritedAL=true;
            }else requiresA0 |= (1 << (ins.relativeAddressComponents?.[i]??0)) & ~initialized;
          }
          if(op===46)initialized |= (ins.args[0]>>>16)&15;
        }
      }
      if(stack.length)fail('unclosed routine flow',fn.offset||0);
      Object.assign(fn,{requiresA0,inheritedAL,hasLoop,writesA0:initialized});
    }
    for(const fn of routines.slice(1))analyze(fn);analyze(main);
    if(main.requiresA0)fail('relative address used before a0 initialization',0);
    if(main.inheritedAL)fail('aL relative address outside LOOP',0);
    return {main,routines,labels};
  }
  function compileIR(shader, options = {}) {
    if (!shader || !['vertex', 'pixel'].includes(shader.stage)
        || !(shader.stage==='vertex'?(options.experimentalVS20?[0xfffe0100,0xfffe0101,0xfffe0200]:[0xfffe0100,0xfffe0101]):[0xffff0104]).includes(shader.version>>>0)
        || !Array.isArray(shader.instructions)) throw new TypeError('invalid D3D shader IR');
    // ps1.x pixel lowering is WAT-owned (09af1 core IR, compileCoreIR). Only
    // the GPS producers' legacy ps_1_4 subset (ALU, texld, texkill) remains.
    if(shader.stage==='pixel'&&(shader.flags>>>0)&~3)fail('pixel IR profile requires core IR',0);
    shader = { ...shader, instructions: shader.instructions.map(ins => {
      const spec = instructionSpec(shader.version,ins.opcode);
      if (!spec || !Array.isArray(ins.args) || ins.args.length !== spec[1])
        fail('invalid IR instruction', ins.offset);
      return { ...ins, name: spec[0] };
    }) };
    const cube = n => options.cubeStages && options.cubeStages.includes(n);
    const pixel = shader.stage === 'pixel';
    const clipDistanceMask=options.userClipPlaneMask===undefined?0:options.userClipPlaneMask;
    if(!Number.isInteger(clipDistanceMask)||clipDistanceMask<0||clipDistanceMask>63||pixel&&clipDistanceMask)
      fail('invalid user clip plane mask/stage',0);
    const clipUniforms=Array.from({length:6},(_,i)=>i).filter(i=>clipDistanceMask&(1<<i)).map(i=>`d3d_user_clip${i}`);
    const ps14=shader.version===0xffff0104;
    const vs20=shader.version===0xfffe0200;
    const calls=vs20?callPlan(shader.instructions):null;
    const vertexConstants=vs20?256:96;
    if((options.projectedStages||[]).some(n=>n!==0))fail('projected texture stages require core IR',0);
    const constantName = n => `d3d_${pixel ? 'ps' : 'vs'}_c${n}`;
    const declarations = new Map(), constants = new Map(), samplers = new Set();
    const boolConstants=new Map(),intConstants=new Map();
    const boolInputs=new Set(),intInputs=new Set(),loopInputs=new Set(),flowStack=[];let staticFlowCount=0,repSerial=0,currentRelativeBank='a0',currentRelativeComponent=0,currentInstruction;
    const inputs = new Set(), outputs = new Set();let lines = [], currentRoutine=calls?.main;
    if(calls)lines=currentRoutine.lines;
    let current = 0, coissue = false, lastWrite = -1, relative = false, addressWritten = false,addressMask=0;
    const semantics = {};
    const declare = (name, text) => { declarations.set(name, text); return name; };
    function reg(token, write = false) {
      const type = ((token >>> 28) & 7) | ((token >>> 8) & 24), n = token & 2047;
      // Fixed-origin IR (09aj) is a private ps_1_1 profile: six temps and six
      // coordinate/sampler stages, as the native VM admits for flag-4 IR.
      if (type === 0 && n < (pixel ? 6 : 12))
        return declare(`r${n}`, `vec4 r${n} = vec4(0.0);`);
      if (type === 1 && n < (pixel ? 2 : 16) && !write) {
        inputs.add(n); return pixel ? `d3d_color${n}` : `d3d_v${n}`;
      }
      if (type === 2 && n < (pixel ? 8 : vertexConstants) && !write) {
        if(token&0x2000) {
          const loopFrame=flowStack.find(f=>f.kind==='loop');
          if(currentRelativeBank==='aL'&&!loopFrame&&!currentRoutine?.inheritedAL)fail('aL relative address outside LOOP',current);
          if(currentRelativeBank!=='aL'&&!(addressMask&(1<<currentRelativeComponent))&&!calls)fail('relative address used before a0 initialization',current);
          relative=true;
          for(let i=0;i<vertexConstants;++i)constants.set(i,null);
          if(currentRelativeBank!=='aL')declare('a0','vec4 a0 = vec4(0.0);');
          return `(d3d_relative(${currentRelativeBank==='aL'?`float(${loopFrame?.address||'d3d_inherited_aL'})`:`a0.${'xyzw'[currentRelativeComponent]}`} + ${n}.0))`;
        }
        constants.set(n, null); return constantName(n);
      }
      if (!pixel && type === 3 && n === 0 && write)
        return declare('a0', 'vec4 a0 = vec4(0.0);');
      if (pixel && type === 3 && n < 6) {
        inputs.add(16 + n);
        if(write)fail('ps_1_4 coordinates are read-only',current);return `d3d_tex${n}`;
      }
      if (!pixel && type === 4 && n === 0) {
        outputs.add('position'); return declare('position', 'vec4 position = vec4(0.0);');
      }
      if (!pixel && type === 4 && n === 2 && write) {
        outputs.add('pointSize');return declare('pointSize','vec4 pointSize = vec4(0.0);');
      }
      if (!pixel && type === 4 && n === 1 && write) {
        outputs.add('fog');return declare('fog','vec4 fog = vec4(0.0);');
      }
      if (!pixel && type === 5 && n < 2) {
        outputs.add(`color${n}`); return `d3d_color${n}`;
      }
      if (!pixel && type === 6 && n < 8) {
        outputs.add(`tex${n}`); return `d3d_tex${n}`;
      }
      fail(`unsupported ${write ? 'destination' : 'source'} register ${type}:${n}`, current);
    }
    function src(token, operandIndex=1) {
      currentRelativeBank=currentInstruction?.relativeAddressBanks?.[operandIndex]||'a0';
      currentRelativeComponent=currentInstruction?.relativeAddressComponents?.[operandIndex]??0;
      const base = reg(token), swizzle = Array.from({ length: 4 }, (_, i) =>
        'xyzw'[(token >>> (16 + 2 * i)) & 3]).join('');
      const s = `(${base}.${swizzle})`, modifier = (token >>> 24) & 15;
      switch (modifier) {
        case 0: return s;
        case 1: return `(-${s})`;
        case 2: return `(${s} - vec4(0.5))`;
        case 3: return `(vec4(0.5) - ${s})`;
        case 4: return `(${s} * 2.0 - vec4(1.0))`;
        case 5: return `(vec4(1.0) - ${s} * 2.0)`;
        case 6: return `(vec4(1.0) - ${s})`;
        case 7: return `(${s} * 2.0)`;
        case 8: return `(${s} * -2.0)`;
        default: fail(`unsupported source modifier ${modifier}`, current);
      }
    }
    function assign(token, expression) {
      const target = reg(token, true), mask = (token >>> 16) & 15;
      const modifier = (token >>> 20) & 15, shift = (token >>> 24) & 15;
      if (!mask || modifier > 1) fail('invalid destination mask/modifier', current);
      if (![0, 1, 2, 3, 13, 14, 15].includes(shift)) fail('invalid result shift', current);
      if (shift) expression = `(${expression}) * ${Math.pow(2, shift > 8 ? shift - 16 : shift).toFixed(3)}`;
      if (modifier) expression = `clamp(${expression}, 0.0, 1.0)`;
      const scalarPoint=!pixel&&((token>>>28)&7)===4&&(token&2047)===2;
      if(scalarPoint&&(![1,15].includes(mask)||(!vs20&&modifier)||shift))fail('invalid scalar point-size destination',current);
      const components = scalarPoint?'x':'xyzw'.split('').filter((_, i) => mask & (1 << i)).join('');
      // Evaluate all sources before the masked write, including aliased r0.
      const resultName = `result${current}`;
      let deferred;
      if (coissue) {
        if (lastWrite !== lines.length - 1 || lastWrite < 0) fail('invalid coissue pair', current);
        deferred = lines.pop();
      }
      lines.push(`vec4 ${resultName} = ${expression};`);
      if (deferred) lines.push(deferred);
      lines.push(`${target}.${components} = ${resultName}.${components};`);
      lastWrite = coissue ? -1 : lines.length - 1;
    }
    for (const ins of shader.instructions) {
      currentInstruction=ins;
      current = ins.offset;
      coissue = ins.coissue;
      const addressBanks=(ins.relativeAddressBanks||[]).filter(x=>x!==null);
      if(addressBanks.some(x=>x!=='a0'&&x!=='aL'))
        fail('invalid relative address bank metadata',current);
      for(const [i,component]of (ins.relativeAddressComponents||[]).entries())if(component!==null&&component!==undefined){
        if(!Number.isInteger(component)||component<0||component>3||!(ins.args[i]&8192)
            ||(ins.relativeAddressBanks?.[i]==='aL'&&component!==0))
          fail('invalid relative address component metadata',current);
      }
      currentRelativeBank=addressBanks[0]||'a0';
      const [d, ...args] = ins.args;
      if(calls&&[25,26,28,30].includes(ins.opcode)){
        if(coissue)fail('invalid coissued call instruction',current);
        if(ins.opcode===30){currentRoutine=calls.labels.get(d&2047);lines=currentRoutine.lines;lastWrite=-1;}
        else if(ins.opcode===28)lines.push('return;');
        else {
          const frame=flowStack.find(f=>f.kind==='loop');
          const invocation=`d3d_label_${d&2047}(${frame?.address||'0'});`;
          if(ins.opcode===26){
            const token=args[0]>>>0,n=token&2047,mod=token>>>24&15;
            if(n>=16||![0,13].includes(mod)||token!==((0xe0e40800|mod<<24|n)>>>0))fail('invalid CALLNZ Boolean source',current);
            boolInputs.add(n);lines.push(`if (${mod===13?'!':''}d3d_vs_b${n}) ${invocation}`);
          }else lines.push(invocation);
        }
        continue;
      }
      if(vs20&&[27,29,38,39,40,42,43].includes(ins.opcode)){
        if(coissue)fail('invalid coissued flow instruction',current);
        if(ins.opcode===38||ins.opcode===27){
          const isLoop=ins.opcode===27,integer=isLoop?args[0]:d,n=integer&2047;
          if(isLoop&&(d>>>0)!==0xf0e40800)fail('invalid LOOP counter source',current);
          if(n>=16||(integer>>>0)!==((0xf0e40000|n)>>>0))fail('invalid LOOP/REP integer source',current);
          if(flowStack.some(frame=>frame.kind==='rep'||frame.kind==='loop'))fail('nested LOOP/REP exceeds VS2 limit',current);
          if(++staticFlowCount>16)fail('static flow count exceeded',current);
          const counter=`d3d_rep${repSerial++}`;
          flowStack.push({kind:isLoop?'loop':'rep',entryAddressMask:addressMask,address:`(d3d_vs_i${n}.y + ${counter} * d3d_vs_i${n}.z)`});intInputs.add(n);
          if(isLoop)loopInputs.add(n);
          // WebGL1 needs a constant loop bound. Exact for legal counts0..255;
          // invalid dynamic API counts require validation before submission.
          lines.push(`for (int ${counter} = 0; ${counter} < 255; ++${counter}) {`,
            `if (${counter} >= d3d_vs_i${n}.x) break;`);
        }else if(ins.opcode===39||ins.opcode===29){
          if(flowStack[flowStack.length-1]?.kind!==(ins.opcode===29?'loop':'rep'))fail('unmatched or straddling ENDLOOP/ENDREP',current);
          addressMask=flowStack.pop().entryAddressMask;lines.push('}');
        }else if(ins.opcode===40){
          const n=d&2047;
          // First private slice: unmodified, identity-swizzled scalar b#.
          if(n>=16||(d>>>0)!==((0xe0e40800|n)>>>0))fail('invalid IF Boolean source',current);
          if(++staticFlowCount>16)fail('static flow count exceeded',current);
          flowStack.push({kind:'if',hasElse:false,entryAddressMask:addressMask});boolInputs.add(n);lines.push(`if (d3d_vs_b${n}) {`);
        }else if(ins.opcode===42){
          if(flowStack[flowStack.length-1]?.kind!=='if'||flowStack[flowStack.length-1].hasElse)fail('unmatched or duplicate ELSE / REP straddle',current);
          if(++staticFlowCount>16)fail('static flow count exceeded',current);
          flowStack[flowStack.length-1].hasElse=true;
          flowStack[flowStack.length-1].thenAddressMask=addressMask;
          addressMask=flowStack[flowStack.length-1].entryAddressMask;lines.push('} else {');
        }else{
          if(flowStack[flowStack.length-1]?.kind!=='if')fail('unmatched ENDIF / REP straddle',current);
          const frame=flowStack.pop();addressMask &= frame.hasElse?frame.thenAddressMask:frame.entryAddressMask;lines.push('}');
        }
        lastWrite=-1;continue;
      }
      if([82,83,85,86,88].includes(ins.opcode)&&(!pixel||![0xffff0102,0xffff0103,0xffff0104].includes(shader.version)))fail('instruction requires ps_1_2+',current);
      if(pixel&&ins.opcode===9&&![0xffff0102,0xffff0103,0xffff0104].includes(shader.version))fail('pixel dp4 requires ps_1_2+',current);
      if(ins.opcode===84&&(!pixel||shader.version!==0xffff0103))fail('instruction requires ps_1_3',current);
      if(pixel&&[64,87,89,65533].includes(ins.opcode))fail(`${ins.name} requires core IR`,current);
      if(ps14&&[65,66].includes(ins.opcode)){
        const stage=d&2047;
        if(coissue)fail('ps_1_4 texture instructions cannot coissue',current);
        if(stage>=6)fail('ps_1_4 destination index',current);
        if(ins.opcode===65){
          const value=reg(d);
          lines.push(`if (any(lessThan(${value}.xyz, vec3(0.0)))) discard;`);lastWrite=-1;continue;
        }
        const source=args[0],bank=(source>>>28)&7,swizzle=(source>>>16)&255,modifier=(source>>>24)&15;
        if(![0,3].includes(bank)||![228,244].includes(swizzle)||![0,9,10].includes(modifier))fail('invalid ps_1_4 texture operand',current);
        const value=reg(source),coords=swizzle===244?`${value}.xyw`:`${value}.xyz`;
        if(modifier&&cube(stage)&&ins.opcode===66)fail('projective cube lookup is undefined',current);
        const denominator=`${value}.${modifier===9?'z':'w'}`;
        const uv=modifier?`(${denominator} == 0.0 ? vec2(1.0) : ${value}.xy / ${denominator})`:`${value}.xy`;
        samplers.add(stage);
        assign(d,cube(stage)?`textureCube(d3d_s${stage}, ${coords})`:`texture2D(d3d_s${stage}, ${uv})`);
        lastWrite=-1;continue;
      }
      if (ins.name === 'dcl') {
        if (pixel || ins.coissue || ((args[0] >>> 28) & 7) !== 1)
          fail('unsupported declaration', current);
        const register = args[0] & 2047;
        reg(args[0]);
        semantics[register] = { usage: d & 15, index: (d >>> 16) & 15 };
        lastWrite = -1;
        continue;
      }
      if (ins.name === 'nop') continue;
      if(ins.name==='defb'||ins.name==='defi'){
        const boolean=ins.name==='defb',n=d&2047;
        const expected=((boolean?0xe00f0800:0xf00f0000)|n)>>>0;
        if(n>=16||(d>>>0)!==expected||!args.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff))
          fail('invalid '+ins.name.toUpperCase()+' definition',current);
        // Immediate words are not float operands. Preserve all integer bits;
        // DEFB accepts any nonzero DWORD, including its high bit alone.
        // Shader-local definitions override API state and are hoisted below.
        if(boolean)boolConstants.set(n,args[0]!==0);
        else intConstants.set(n,args.map(v=>v|0));
        continue;
      }
      if (ins.name === 'def') {
        if (((d >>> 28) & 7) !== 2 || (d & 2047) >= (pixel ? 8 : vertexConstants)) fail('invalid DEF register', current);
        const values = new Float32Array(new Uint32Array(args).buffer);
        if (!values.every(Number.isFinite)) fail('non-finite DEF value', current);
        // Set after source collection below: DEF applies regardless of location.
        continue;
      }
      if(ins.name==='sgn'){
        // Native validation owns the two distinct scratch TEMP operands.
        // Their values are undefined afterward, not ordinary value reads.
        // Follow Microsoft's comparison order, including equal signed zeros;
        // NaN -> +1 is a literal-pseudocode inference, not a native oracle.
        // https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/sgn---vs
        const value=src(args[0]);
        assign(d,`vec4(${['x','y','z','w'].map(ch=>`${value}.${ch} < 0.0 ? -1.0 : (${value}.${ch} == 0.0 ? 0.0 : 1.0)`).join(', ')})`);
        continue;
      }
      if(ins.name==='sincos'){
        // Required VS2 coefficient values are the guest's runtime contract.
        // Emit mathematical sin/cos, not a particular driver macro expansion;
        // only written XY are defined and the existing assignment preserves W.
        const angle=src(args[0]);
        assign(d,`vec4(cos(${angle}.x), sin(${angle}.x), 0.0, 0.0)`);
        continue;
      }
      const [a, b, c] = args.map((token,i)=>src(token,i+1));
      if(!pixel && ((d>>>28)&7)===3) {
        if(ins.name!==(vs20?'mova':'mov') || (vs20?((d>>>16)&15)===0:((d>>>16)&15)!==1) || (d&2047)!==0
            || (vs20&&(d&0x0ff00000)))
          fail('invalid address-register write for shader profile',current);
        // VS1.1 retains its existing floor policy. Private VS2 MOVA uses
        // round-to-nearest, with ties-to-even as our explicit adapter policy.
        assign(d,vs20?`d3d_mova(${a})`:`floor(${a})`);addressWritten=true;addressMask |= (d>>>16)&15;continue;
      }
      if(ins.name==='mova')fail('MOVA requires address-register destination',current);
      const expressions = {
        mov: () => a, abs: () => `abs(${a})`, add: () => `${a} + ${b}`, sub: () => `${a} - ${b}`,
        mad: () => `${a} * ${b} + ${c}`, mul: () => `${a} * ${b}`,
        rcp: () => `vec4(1.0 / ${a}.x)`, rsq: () => `vec4(inversesqrt(abs(${a}.x)))`,
        dp3: () => `vec4(dot(${a}.xyz, ${b}.xyz))`, dp4: () => `vec4(dot(${a}, ${b}))`,
        crs: () => `vec4(cross(${a}.xyz, ${b}.xyz), 0.0)`,
        nrm: () => `${a} * (dot(${a}.xyz, ${a}.xyz) == 0.0 ? 3.402823466e+38 : inversesqrt(dot(${a}.xyz, ${a}.xyz)))`,
        // Microsoft POW permits exp(exponent * log(abs(base))). Its zero
        // table is unspecified: our finite-input adapter policy chooses
        // x^0=1, 0^positive=0, 0^negative=+Infinity. Do not call GLSL pow
        // on its undefined zero-base/nonpositive-exponent domain.
        pow: () => `vec4(${b}.x == 0.0 ? 1.0 : (abs(${a}.x) == 0.0 ? (${b}.x > 0.0 ? 0.0 : 1.0 / abs(${a}.x)) : exp2(${b}.x * log2(abs(${a}.x)))))`,
        min: () => `min(${a}, ${b})`, max: () => `max(${a}, ${b})`,
        slt: () => `vec4(lessThan(${a}, ${b}))`, sge: () => `vec4(greaterThanEqual(${a}, ${b}))`,
        exp: () => `vec4(exp2(${a}.x))`, log: () => `vec4(${a}.x == 0.0 ? -3.402823466e+38 : log2(abs(${a}.x)))`,
        expp: () => vs20 ? `vec4(exp2(${a}.x))` : `vec4(exp2(floor(${a}.x)), fract(${a}.x), exp2(${a}.x), 1.0)`,
        logp: () => `vec4(${a}.x == 0.0 ? -3.402823466e+38 : log2(abs(${a}.x)))`,
        frc: () => `fract(${a})`, lrp: () => vs20 ? `${a} * (${b} - ${c}) + ${c}` : `${a} * ${b} + (vec4(1.0) - ${a}) * ${c}`,
        dst: () => `vec4(1.0, ${a}.y * ${b}.y, ${a}.z, ${b}.w)`,
        cnd: () => `vec4(${['x','y','z','w'].map(ch=>`${a}.${ch} > 0.5 ? ${b}.${ch} : ${c}.${ch}`).join(', ')})`,
        cmp: () => `vec4(${['x','y','z','w'].map(ch=>`${a}.${ch} >= 0.0 ? ${b}.${ch} : ${c}.${ch}`).join(', ')})`,
        // Microsoft LIT pseudocode gates both dot products before exponentiation;
        // pow(0, negative) is not a substitute for the unlit branch. Match the
        // native VM's documented power clamp, including its 8.8-style boundary.
        // https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/lit---vs
        lit: () => `vec4(1.0, ${a}.x > 0.0 ? ${a}.x : 0.0, (${a}.x > 0.0 && ${a}.y > 0.0) ? pow(${a}.y, clamp(${a}.w, -127.9961, 127.9961)) : 0.0, 1.0)`,
      };
      if (ins.name[0] === 'm' && /^m[34]x[234]$/.test(ins.name)) {
        if (pixel) fail('vertex matrix instruction in pixel shader', current);
        const size = +ins.name[1], rows = +ins.name[3];
        const terms = [];
        for (let row = 0; row < rows; ++row) {
          const rowToken = (args[1] + row) >>> 0;
          terms.push(`dot(${a}${size === 3 ? '.xyz' : ''}, ${src(rowToken,2)}${size === 3 ? '.xyz' : ''})`);
        }
        while (terms.length < 4) terms.push('0.0');
        assign(d, `vec4(${terms.join(', ')})`);
        continue;
      }
      if (!expressions[ins.name]) fail(`lowering not implemented: ${ins.name}`, current);
      assign(d, expressions[ins.name]());
    }
    if(flowStack.length)fail('unclosed IF/REP block',current);
    for(const n of intInputs)if(intConstants.has(n)&&(intConstants.get(n)[0]<0||intConstants.get(n)[0]>255))
      fail('REP DEFI count outside 0..255',current);
    for(const n of loopInputs)if(intConstants.has(n)){
      const v=intConstants.get(n);
      if(v[1]<0||v[1]>255||v[2]<-128||v[2]>127||v[3]!==0)fail('LOOP DEFI parameters outside legal domain',current);
    }
    for (const ins of shader.instructions.filter(i => i.name === 'def')) {
      const values = new Float32Array(new Uint32Array(ins.args.slice(1)).buffer);
      constants.set(ins.args[0] & 2047, Array.from(values, v => {
        const s = String(v); return /[.e]/i.test(s) ? s : `${s}.0`;
      }));
    }
    const depthOutput=false;
    const header = ['precision highp float;'];
    if(clipDistanceMask){
      // WebGL2's optional geometric clip-distance extension, never a fragment
      // discard approximation. The GPU adapter validates extension/limits and
      // enables exactly clipDistanceMask; this option does not advertise caps.
      header.unshift('#extension GL_ANGLE_clip_cull_distance : require');
      for(const name of clipUniforms)header.push(`uniform highp vec4 ${name};`);
    }
    if(vs20&&addressWritten)header.push(
      // GLSL ES1 lacks roundEven; exact half ties are selected explicitly.
      'vec4 d3d_mova(vec4 value) {',
      'vec4 base = floor(value), fraction = value - base;',
      'vec4 up = vec4(greaterThan(fraction, vec4(0.5)));',
      'vec4 tie = vec4(equal(fraction, vec4(0.5)));',
      'return base + up + tie * mod(base, vec4(2.0));', '}');
    for (const [n, value] of constants) header.push(value
      ? `const vec4 ${constantName(n)} = vec4(${value.join(', ')});` : `uniform vec4 ${constantName(n)};`);
    for(const [n,value]of boolConstants)header.push(`const bool d3d_vs_b${n} = ${value?'true':'false'};`);
    for(const n of boolInputs)if(!boolConstants.has(n))header.push(`uniform bool d3d_vs_b${n};`);
    for(const [n,value]of intConstants)header.push(`const highp ivec4 d3d_vs_i${n} = ivec4(${value.map(v=>v===-2147483648?'(-2147483647 - 1)':String(v)).join(', ')});`);
    for(const n of intInputs)if(!intConstants.has(n))header.push(`uniform highp ivec4 d3d_vs_i${n};`);
    for (const n of samplers) header.push(`uniform ${cube(n) ? 'samplerCube' : 'sampler2D'} d3d_s${n};`);
    for (const n of inputs) header.push(pixel
      ? `varying vec4 d3d_${n >= 16 ? `tex${n - 16}` : `color${n}`};`
      : `attribute vec4 d3d_v${n};`);
    for (const name of outputs) if (!['position','pointSize'].includes(name)) header.push(`varying vec4 d3d_${name};`);
    if(relative)header.push('vec4 d3d_relative(float index) {',
      ...Array.from({length:vertexConstants},(_,i)=>`if (index == ${i}.0) return ${constantName(i)};`),
      'return vec4(0.0);','}');
    if (pixel) reg(0x800f0000, true);
    else if (!outputs.has('position')) fail('vertex shader does not write position', current);
    const clipEpilogue=clipUniforms.map(name=>`gl_ClipDistance[${name.slice(-1)}] = dot(${name}, position);`).join('\n');
    const epilogue = pixel ? 'gl_FragColor = r0;'
      : (clipEpilogue?clipEpilogue+'\n':'')+'gl_Position = vec4(position.xy, position.z * 2.0 - position.w, position.w);'+(outputs.has('pointSize')?'\ngl_PointSize = pointSize.x;':'')+
        (outputs.has('fog')?'\nd3d_fog = vec4(clamp(fog.x,0.0,1.0));':'');
    const source=calls?[...header,...declarations.values(),
      ...calls.routines.slice(1).flatMap(fn=>[`void d3d_label_${fn.id}(highp int d3d_inherited_aL) {`,...fn.lines,'}']),
      'void d3d_guest_main() {',...calls.main.lines,'}',
      'void main() {d3d_guest_main();',epilogue,'}']:
      [...header, 'void main() {', ...declarations.values(),...lines, epilogue, '}'];
    return { ...shader, source: source.join('\n'), semantics, depthOutput, clipDistanceMask, fogOutput:outputs.has('fog'), bumpStages: [],
    attributes: Array.from(inputs).filter(() => !pixel).map(n => `d3d_v${n}`),
    // Descriptive precondition only: frontend typed upload is not wired yet.
    integerUniformRanges:Array.from(intInputs).filter(n=>!intConstants.has(n)).flatMap(n=>
      (loopInputs.has(n)?[[0,0,255],[1,0,255],[2,-128,127],[3,0,0]]:[[0,0,255]])
        .map(([component,min,max])=>({name:`d3d_vs_i${n}`,component,min,max}))),
    uniforms: [...clipUniforms,...Array.from(constants).filter(([, v]) => !v).map(([n]) => constantName(n)),
      ...Array.from(boolInputs).filter(n=>!boolConstants.has(n)).map(n=>`d3d_vs_b${n}`),
      ...Array.from(intInputs).filter(n=>!intConstants.has(n)).map(n=>`d3d_vs_i${n}`),
      ...Array.from(samplers, n => `d3d_s${n}`)] };
  }
  function validateMemory(memory, address, version) {
    address >>>= 0;
    if (!address || address % 4 || address + 4 > memory.byteLength) return 0;
    const words = new Uint32Array(memory, address,
      Math.min(65536, Math.floor((memory.byteLength - address) / 4)));
    if (words[0] !== (version >>> 0)) return 0;
    try { return compile(words).length * 4; } catch (_) { return 0; }
  }
  // GPU mip-atlas lowering also accepts the existing fixed-function GLSL result.
  // State VALUES are uniforms; changing bias/clamps does not specialize programs.
  // https://registry.khronos.org/webgl/extensions/OES_standard_derivatives/
  // Uses the native VM's isotropic LOD/filter policy; derivative precision and
  // exact texel-boundary interpolation remain hardware-conformance gates.
  function withMipSampling(shader, stages, rasterOffset=0, planeStages=[], centerStages=[]) {
    if(rasterOffset!==0&&rasterOffset!==1/16)throw new Error('invalid texture raster offset');
    const used=stages.filter(n=>shader.uniforms.includes(`d3d_s${n}`));
    // Integer-center evaluation is also needed by ordinary single-level
    // samplers. Keep their hardware filtering/upload path independent of LOD.
    const centered=centerStages.filter(n=>!used.includes(n)&&shader.uniforms.includes(`d3d_s${n}`));
    if(!used.length&&!centered.length)return shader;
    let source=shader.source;const helpers=[],uniforms=[...shader.uniforms];
    for(const n of centered){
      source=source.replaceAll(`texture2D(d3d_s${n},`,`d3d_center${n}(`);
      if(planeStages.includes(n))uniforms.push(`d3d_planeq${n}`,`d3d_planeu${n}`,`d3d_planev${n}`);
      helpers.push(`
${planeStages.includes(n)?`uniform vec4 d3d_planeq${n},d3d_planeu${n},d3d_planev${n};`:''}
vec4 d3d_center${n}(vec2 uv) {
  ${planeStages.includes(n)?`vec3 point=vec3(gl_FragCoord.x-0.5,gl_FragCoord.y+0.5,1.0);
  float reciprocalW=dot(d3d_planeq${n}.xyz,point);
  uv=vec2(dot(d3d_planeu${n}.xyz,point),dot(d3d_planev${n}.xyz,point))/reciprocalW;`:
  `float reciprocalW=gl_FragCoord.w;
  vec2 numerator=uv*reciprocalW;
  numerator-=${rasterOffset}*(dFdx(numerator)-dFdy(numerator));
  reciprocalW-=${rasterOffset}*(dFdx(reciprocalW)-dFdy(reciprocalW));
  uv=numerator/reciprocalW;`}
  return texture2D(d3d_s${n},uv);
}`);
    }
    for(const n of used) {
      const cube=source.includes(`samplerCube d3d_s${n}`);
      if(cube)source=source.replace(`samplerCube d3d_s${n}`,`sampler2D d3d_s${n}`);
      // Projected coordinates are rational twice: the varying is divided by
      // geometric W, then xy by texture q. Undo the first division so N and Q
      // are affine across the quad, and differentiate their quotient at this
      // fragment rather than taking finite differences of the divided UV.
      const projected=[...source.matchAll(new RegExp(
        `vec2 (ff_projected${n}|projectUV${n}_\\d+) = (\\w+)\\.xy / \\([^?]+\\? \\2\\.([zw]) : 1\\.0\\);`, 'g'))];
      for(const [,uv,varying,q] of projected)source=source.replaceAll(
        `texture2D(d3d_s${n},${uv})`,
        `d3d_sample${n}(${uv},vec3(${varying}.xy,${varying}.${q})*gl_FragCoord.w)`);
      source=source.replaceAll(`${cube?'textureCube':'texture2D'}(d3d_s${n},`, `d3d_sample${n}(`);
      const names=[`d3d_mips${n}[0]`,`d3d_lod${n}`,`d3d_filter${n}`,`d3d_extent${n}`,`d3d_address${n}`,`d3d_border${n}`];
      if(planeStages.includes(n))names.push(`d3d_planeq${n}`,`d3d_planeu${n}`,`d3d_planev${n}`);
      uniforms.push(...names);
      helpers.push(`
uniform vec4 d3d_mips${n}[12];
uniform vec4 d3d_lod${n}, d3d_filter${n}, d3d_extent${n}, d3d_address${n}, d3d_border${n};
${planeStages.includes(n)?`uniform vec4 d3d_planeq${n},d3d_planeu${n},d3d_planev${n};`:''}
float d3d_address_${n}(float x,float size,float mode) {
  if(mode==1.0)return mod(x,size);
  if(mode==2.0){float p=mod(x,2.0*size);return p<size?p:2.0*size-1.0-p;}
  if(mode==3.0)return clamp(x,0.0,size-1.0);
  return x;
}
vec4 d3d_tap${n}(vec4 level,vec2 p) {
  p=vec2(d3d_address_${n}(p.x,level.z,d3d_address${n}.x),d3d_address_${n}(p.y,level.w,d3d_address${n}.y));
  if(p.x<0.0||p.y<0.0||p.x>=level.z||p.y>=level.w)return d3d_border${n};
  return texture2D(d3d_s${n},(level.xy+p+0.5)/d3d_extent${n}.xy);
}
vec4 d3d_level${n}(float index,vec2 uv,float sampleFilter${cube?',float face':''}) {
  vec4 level=d3d_mips${n}[0];
  ${Array.from({length:11},(_,i)=>`if(index==${i+1}.0)level=d3d_mips${n}[${i+1}];`).join('\n  ')}
  ${cube?'level.x+=face*level.z;':''}
  if(d3d_address${n}.x==1.0)uv.x=fract(uv.x);
  else if(d3d_address${n}.x==2.0){uv.x=mod(uv.x,2.0);uv.x=min(uv.x,2.0-uv.x);}
  else uv.x=clamp(uv.x,d3d_address${n}.x==3.0?0.0:-1.0,d3d_address${n}.x==3.0?1.0:2.0);
  if(d3d_address${n}.y==1.0)uv.y=fract(uv.y);
  else if(d3d_address${n}.y==2.0){uv.y=mod(uv.y,2.0);uv.y=min(uv.y,2.0-uv.y);}
  else uv.y=clamp(uv.y,d3d_address${n}.y==3.0?0.0:-1.0,d3d_address${n}.y==3.0?1.0:2.0);
  vec2 p=uv*level.zw;
  if(sampleFilter==1.0)return d3d_tap${n}(level,floor(p));
  p-=0.5;vec2 f=fract(p);p=floor(p);
  return mix(mix(d3d_tap${n}(level,p),d3d_tap${n}(level,p+vec2(1,0)),f.x),
    mix(d3d_tap${n}(level,p+vec2(0,1)),d3d_tap${n}(level,p+vec2(1,1)),f.x),f.y);
}
${cube?`
// Match the native reference: X/Y/Z tie order and face-local filtering.
vec2 d3d_cube_uv${n}(vec3 d,float face) {
  vec2 p;float major;
  if(face<2.0){major=abs(d.x);p=vec2(face==0.0?-d.z:d.z,-d.y);}
  else if(face<4.0){major=abs(d.y);p=vec2(d.x,face==2.0?d.z:-d.z);}
  else{major=abs(d.z);p=vec2(face==4.0?d.x:-d.x,-d.y);}
  return 0.5*(p/major+1.0);
}
vec4 d3d_sample${n}(vec3 direction) {
  // Derivatives must precede divergent face selection. Reconstruct each quad
  // neighbor and project it onto this fragment's face, avoiding edge UV jumps.
  vec3 ddx=dFdx(direction),ddy=dFdy(direction),magnitude=abs(direction);
  float face=magnitude.x>=magnitude.y&&magnitude.x>=magnitude.z?(direction.x<0.0?1.0:0.0):
    magnitude.y>=magnitude.z?(direction.y<0.0?3.0:2.0):(direction.z<0.0?5.0:4.0);
  vec2 uv=d3d_cube_uv${n}(direction,face);
  vec2 signNeighbor=vec2(1.0)-2.0*mod(floor(gl_FragCoord.xy),2.0);
  vec2 dx=(d3d_cube_uv${n}(direction+signNeighbor.x*ddx,face)-uv)*d3d_lod${n}.xy;
  vec2 dy=(d3d_cube_uv${n}(direction+signNeighbor.y*ddy,face)-uv)*d3d_lod${n}.xy;
`:projected.length?`vec4 d3d_sample${n}(vec2 uv,vec3 homogeneous) {
  vec2 dx=(dFdx(homogeneous.xy)-uv*dFdx(homogeneous.z))/homogeneous.z*d3d_lod${n}.xy;
  vec2 dy=(dFdy(homogeneous.xy)-uv*dFdy(homogeneous.z))/homogeneous.z*d3d_lod${n}.xy;
`:`vec4 d3d_sample${n}(vec2 uv) {
  // UV is already perspective divided. UV*geometric RHW is affine, so
  // differentiate that numerator and RHW before evaluating the quotient.
  // Finite differences of UV itself displace the footprint within a quad.
  ${planeStages.includes(n)?`// Submitted TL planes at the integer D3D center. Window Y points up.
  vec3 point=vec3(gl_FragCoord.x-0.5,gl_FragCoord.y+0.5,1.0);
  float reciprocalW=dot(d3d_planeq${n}.xyz,point);
  uv=vec2(dot(d3d_planeu${n}.xyz,point),dot(d3d_planev${n}.xyz,point))/reciprocalW;
  vec2 dx=(vec2(d3d_planeu${n}.x,d3d_planev${n}.x)-uv*d3d_planeq${n}.x)/reciprocalW*d3d_lod${n}.xy;
  vec2 dy=(vec2(d3d_planeu${n}.y,d3d_planev${n}.y)-uv*d3d_planeq${n}.y)/reciprocalW*d3d_lod${n}.xy;`:
  rasterOffset?`// N and Q are affine; undo only the coverage translation.
  // GL window Y points up, hence dFdx-dFdy for the screen-space shift.
  float reciprocalW=gl_FragCoord.w;
  vec2 numerator=uv*reciprocalW;
  vec2 nx=dFdx(numerator),ny=dFdy(numerator);
  float qx=dFdx(reciprocalW),qy=dFdy(reciprocalW);
  numerator-=${rasterOffset}*(nx-ny);
  reciprocalW-=${rasterOffset}*(qx-qy);
  uv=numerator/reciprocalW;
  vec2 dx=(nx-uv*qx)/reciprocalW*d3d_lod${n}.xy;
  vec2 dy=(ny-uv*qy)/reciprocalW*d3d_lod${n}.xy;`:
  `vec2 dx=(dFdx(uv*gl_FragCoord.w)-uv*dFdx(gl_FragCoord.w))/gl_FragCoord.w*d3d_lod${n}.xy;
  vec2 dy=(dFdy(uv*gl_FragCoord.w)-uv*dFdy(gl_FragCoord.w))/gl_FragCoord.w*d3d_lod${n}.xy;`}` }
  float lambda=0.5*log2(clamp(max(dot(dx,dx),dot(dy,dy)),1e-30,1e30))+d3d_lod${n}.z;
  float sampleFilter=lambda<=0.0?d3d_filter${n}.y:d3d_filter${n}.x;
  float low=min(d3d_extent${n}.w,max(d3d_lod${n}.w,d3d_filter${n}.w));
  float level=clamp(lambda,low,d3d_extent${n}.w);
  if(d3d_filter${n}.z==0.0)level=low;
  if(d3d_filter${n}.z==1.0)level=floor(level+0.5);
  level-=d3d_lod${n}.w;
  vec4 a=d3d_level${n}(floor(level),uv,sampleFilter${cube?',face':''});
  if(d3d_filter${n}.z!=2.0||fract(level)==0.0)return a;
  return mix(a,d3d_level${n}(floor(level)+1.0,uv,sampleFilter${cube?',face':''}),fract(level));
}`);
    }
    // Keep discarded invocations available for later derivative calculations.
    source=source.replaceAll('discard;', 'd3d_discard = true;');
    const entry=/void\s+main\s*\(\s*(?:void\s*)?\)\s*\{/;
    if(!entry.test(source))throw new Error('mip sampling requires a shader main function');
    source=source.replace(entry,match=>helpers.join('\n')+'\n'+match+' bool d3d_discard = false;');
    source=source.replace('gl_FragColor =','if(d3d_discard)discard;\ngl_FragColor =');
    const samplingDerivatives=!!used.length||centered.some(n=>!planeStages.includes(n));
    return {...shader,source:(samplingDerivatives?'#extension GL_OES_standard_derivatives : require\n':'')+source,
      uniforms,mipStages:used,centerStages:centered,samplingDerivatives};
  }
  // Token parsing/compile/validateMemory remain standalone diagnostic tools;
  // they are not the D3D9 CreateShader legality oracle.
  return { parse, compile, compileIR, compileCoreIR, compileNativeIR, compileNativeFixedIR, validateMemory, withMipSampling };
});

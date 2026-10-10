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
    if (stage > 1 || !(stage ? [0xffff0101,0xffff0102,0xffff0103,0xffff0104] :
        (options.experimentalVS20 ? [0xfffe0101,0xfffe0200] : [0xfffe0101])).includes(version)
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
  return { read, Compiler, MAGIC, VERSION, HEADER_BYTES, INSTRUCTION_BYTES };
});

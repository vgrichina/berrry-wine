'use strict';

// Test-only behavioral oracle retained after production moved GL encoding to WAT.
const ABI = require('../../lib/gl-command-stream');
const {
  DEFAULT_BYTES, HEADER_BYTES, FLAG_POINTER_COPY, FLAG_POINTER_BORROW,
  PACKED_DRAW_OPCODE, VERTEX_FLOATS, ARG_WORDS, BARRIERS,
} = ABI;
const TEXTURE_UNITS = 2;
const stats = {
  calls: 0, byOpcode: new Float64Array(128), spans: 0,
  packedRecords: 0, packedVertices: 0, flushes: 0,
};
  const GL = {
    POINTS: 0x0000, LINES: 0x0001, LINE_LOOP: 0x0002, LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004, TRIANGLE_STRIP: 0x0005, TRIANGLE_FAN: 0x0006,
    QUADS: 0x0007, QUAD_STRIP: 0x0008, POLYGON: 0x0009,
    SMOOTH: 0x1D01, FLAT: 0x1D00,
    BYTE: 0x1400, UNSIGNED_BYTE: 0x1401, SHORT: 0x1402, UNSIGNED_SHORT: 0x1403,
    INT: 0x1404, UNSIGNED_INT: 0x1405, FLOAT: 0x1406, DOUBLE: 0x140A,
    VERTEX_ARRAY: 0x8074, NORMAL_ARRAY: 0x8075, COLOR_ARRAY: 0x8076,
    TEXTURE_COORD_ARRAY: 0x8078,
  };

  // Physical 32-bit stack words consumed by src/09a8b-handlers-opengl.wat.
  // Doubles occupy two words.  Keeping this beside the command format makes a
  // captured stack only as large as the command needs instead of copying an
  // arbitrary fixed window for every vertex.
  const align4 = n => (n + 3) & ~3;
  function u32At(view, stackWa, index) {
    return view.getUint32((stackWa >>> 0) + 4 + index * 4, true) >>> 0;
  }

  function componentCount(format) {
    switch (format >>> 0) {
      case 0x1906: // GL_ALPHA
      case 0x1909: // GL_LUMINANCE
        return 1;
      case 0x190A: // GL_LUMINANCE_ALPHA
        return 2;
      case 0x1907: // GL_RGB
      case 0x80E0: // GL_BGR
        return 3;
      case 0x1908: // GL_RGBA
      case 0x80E1: // GL_BGRA
        return 4;
      default:
        return 4;
    }
  }

  function pixelBytes(format, type) {
    switch (type >>> 0) {
      case 0x1400: // GL_BYTE
      case 0x1401: // GL_UNSIGNED_BYTE
        return componentCount(format);
      case 0x1402: // GL_SHORT
      case 0x1403: // GL_UNSIGNED_SHORT
        return componentCount(format) * 2;
      case 0x8363: // GL_UNSIGNED_SHORT_5_6_5
      case 0x8033: // GL_UNSIGNED_SHORT_4_4_4_4
      case 0x8034: // GL_UNSIGNED_SHORT_5_5_5_1
        return 2;
      case 0x1404: // GL_INT
      case 0x1405: // GL_UNSIGNED_INT
      case 0x1406: // GL_FLOAT
        return componentCount(format) * 4;
      default:
        return componentCount(format);
    }
  }

  function checkedImageBytes(width, height, format, type) {
    const row = Number(width >>> 0) * pixelBytes(format, type);
    const total = row * Number(height >>> 0);
    if (!Number.isSafeInteger(total) || total > 0x7fffffff) {
      throw new RangeError('GL texture upload is too large');
    }
    return total;
  }

  function appendVertex(out, offset, vertices, index, colorStart) {
    const start = index * VERTEX_FLOATS;
    for (let i = 0; i < VERTEX_FLOATS; i++) {
      out[offset++] = colorStart >= 0 && i >= 3 && i < 7
        ? vertices[colorStart + i - 3] : vertices[start + i];
    }
    return offset;
  }

  function appendTriangle(out, offset, vertices, a, b, c, flat, provoking = c) {
    const colorStart = flat ? provoking * VERTEX_FLOATS + 3 : -1;
    offset = appendVertex(out, offset, vertices, a, colorStart);
    offset = appendVertex(out, offset, vertices, b, colorStart);
    return appendVertex(out, offset, vertices, c, colorStart);
  }

  function appendLine(out, offset, vertices, a, b, flat, provoking = b) {
    const colorStart = flat ? provoking * VERTEX_FLOATS + 3 : -1;
    offset = appendVertex(out, offset, vertices, a, colorStart);
    return appendVertex(out, offset, vertices, b, colorStart);
  }

  // Turn boundary-sensitive desktop primitives into independent WebGL
  // primitives. Independent triangles/lines can subsequently be concatenated
  // without accidentally joining adjacent glBegin/glEnd blocks.
  function normalizeImmediate(mode, vertices, shadeModel) {
    const count = Math.floor(vertices.length / VERTEX_FLOATS);
    const flat = shadeModel === GL.FLAT;
    let outputVertices = 0;
    if (mode === GL.TRIANGLES && flat) {
      outputVertices = count - (count % 3);
    } else if (mode === GL.LINES && flat) {
      outputVertices = count - (count % 2);
    } else if (mode === GL.QUADS) {
      outputVertices = Math.floor(count / 4) * 6;
    } else if (mode === GL.QUAD_STRIP) {
      outputVertices = Math.max(0, Math.floor((count - 2) / 2)) * 6;
    } else if (mode === GL.POLYGON || mode === GL.TRIANGLE_FAN
        || mode === GL.TRIANGLE_STRIP) {
      outputVertices = Math.max(0, count - 2) * 3;
    } else if (mode === GL.LINE_LOOP || mode === GL.LINE_STRIP) {
      outputVertices = (mode === GL.LINE_LOOP ? count : Math.max(0, count - 1)) * 2;
    } else {
      return { mode, vertices: vertices instanceof Float32Array
        ? vertices : new Float32Array(vertices) };
    }
    const out = new Float32Array(outputVertices * VERTEX_FLOATS);
    let offset = 0;
    if (mode === GL.TRIANGLES && flat) {
      for (let i = 0; i + 2 < count; i += 3) {
        offset = appendTriangle(out, offset, vertices, i, i + 1, i + 2, true);
      }
    } else if (mode === GL.LINES && flat) {
      for (let i = 0; i + 1 < count; i += 2) {
        offset = appendLine(out, offset, vertices, i, i + 1, true);
      }
    } else if (mode === GL.QUADS) {
      for (let i = 0; i + 3 < count; i += 4) {
        // An independent quad's fourth vertex shades both lowered triangles.
        offset = appendTriangle(out, offset, vertices, i, i + 1, i + 2, flat, i + 3);
        offset = appendTriangle(out, offset, vertices, i, i + 2, i + 3, flat, i + 3);
      }
      mode = GL.TRIANGLES;
    } else if (mode === GL.QUAD_STRIP) {
      for (let i = 0; i + 3 < count; i += 2) {
        // GL_QUAD_STRIP uses the last vertex of each logical quad, not the
        // last vertex of each triangle produced for WebGL.
        offset = appendTriangle(out, offset, vertices, i, i + 1, i + 3, flat, i + 3);
        offset = appendTriangle(out, offset, vertices, i, i + 3, i + 2, flat, i + 3);
      }
      mode = GL.TRIANGLES;
    } else if (mode === GL.POLYGON) {
      // A single polygon is shaded by its first vertex in legacy OpenGL.
      for (let i = 1; i + 1 < count; i++) {
        offset = appendTriangle(out, offset, vertices, 0, i, i + 1, flat, 0);
      }
      mode = GL.TRIANGLES;
    } else if (mode === GL.TRIANGLE_FAN) {
      for (let i = 1; i + 1 < count; i++) {
        offset = appendTriangle(out, offset, vertices, 0, i, i + 1, flat, i + 1);
      }
      mode = GL.TRIANGLES;
    } else if (mode === GL.TRIANGLE_STRIP) {
      for (let i = 0; i + 2 < count; i++) {
        if (i & 1) offset = appendTriangle(out, offset, vertices, i + 1, i, i + 2, flat);
        else offset = appendTriangle(out, offset, vertices, i, i + 1, i + 2, flat);
      }
      mode = GL.TRIANGLES;
    } else if (mode === GL.LINE_LOOP || mode === GL.LINE_STRIP) {
      const edges = mode === GL.LINE_LOOP ? count : Math.max(0, count - 1);
      for (let i = 0; i < edges; i++) {
        const end = (i + 1) % count;
        offset = appendLine(out, offset, vertices, i, end, flat, end);
      }
      // Preserve connectivity when lowering strips/loops to independent pairs.
      mode = GL.LINES | 0x1000000;
    }
    return { mode, vertices: offset === out.length ? out : out.subarray(0, offset) };
  }

  function pointerSpec(opcode, view, stackWa) {
    let arg = -1, length = 0, borrow = false;
    switch (opcode | 0) {
      case 147: {
      if (u32At(view,stackWa,0)!==0x2300) break;
      const count=u32At(view,stackWa,1)===0x2201?4:u32At(view,stackWa,1)===0x2200?1:0;
      if(count) {arg=2;length=count*4;}
      break;
    }
    case 112: { // glTexParameterfv: invalid enums must not read params
        if (! [0x0DE0,0x0DE1].includes(u32At(view, stackWa, 0))) break;
        const pname=u32At(view, stackWa, 1);
        if (pname===0x1004) {arg=2;length=16;}
        else if ([0x2800,0x2801,0x2802,0x2803,0x8066].includes(pname)) {arg=2;length=4;}
        break;
      }
      case 149: arg=7;length=u32At(view,stackWa,3)*(u32At(view,stackWa,6)===0x1406?16:4);break;
      case 150: arg=6;length=u32At(view,stackWa,3)*(u32At(view,stackWa,5)===0x1406?16:4);break;
      case 158: case 159: arg=8;length=u32At(view,stackWa,opcode===158?3:4)*u32At(view,stackWa,opcode===158?4:5)*16;break;
      case 148: arg = 1; length = 32; break; // glClipPlane
      case 34: arg = 0; length = 64; break; // glLoadMatrixf
      case 109: arg = 0; length = 64; break; // glMultMatrixf
      case 43: // glDeleteTextures(count, names)
        arg = 1; length = u32At(view, stackWa, 0) * 4; break;
      case 45: { // glTexImage2D
        arg = 8;
        const width = u32At(view, stackWa, 3);
        const height = u32At(view, stackWa, 4);
        const format = u32At(view, stackWa, 6);
        const type = u32At(view, stackWa, 7);
        length = checkedImageBytes(width, height, format, type);
        borrow = true;
        break;
      }
      case 47: { // glTexSubImage2D
        arg = 8;
        const width = u32At(view, stackWa, 4);
        const height = u32At(view, stackWa, 5);
        const format = u32At(view, stackWa, 6);
        const type = u32At(view, stackWa, 7);
        length = checkedImageBytes(width, height, format, type);
        // Only four-byte texels whose rows need no unpack padding are
        // snapshotted. Larger or other pixel layouts keep their input lease.
        const snapshot = u32At(view, stackWa, 0) === 0x0DE1
          && type === 0x1401 && (format === 0x1908 || format === 0x80E1)
          && length <= 65536 && (width % 2 === 0 || height === 1);
        borrow = !snapshot;
        break;
      }
      case 61: { // gluBuild2DMipmaps
        arg = 6;
        const width = u32At(view, stackWa, 2);
        const height = u32At(view, stackWa, 3);
        const format = u32At(view, stackWa, 4);
        const type = u32At(view, stackWa, 5);
        length = checkedImageBytes(width, height, format, type);
        borrow = true;
        break;
      }
      case 67: // glLightfv(light, pname, params)
        arg = 2; length = u32At(view,stackWa,1) <= 0x1203 ? 16 : u32At(view,stackWa,1) === 0x1204 ? 12 : 4; break;
      case 68: // glMaterialfv(face, pname, params)
        arg = 2; length = u32At(view, stackWa, 1) === 0x1601 ? 4 : u32At(view,stackWa,1) === 0x1603 ? 12 : 16; break;
      case 69: // glLightModelfv(pname, params)
        arg = 1; length = u32At(view,stackWa,0) === 0xb53 ? 16 : 4; break;
      case 78: // glFogfv(pname, params)
        arg = 1; length = u32At(view, stackWa, 0) === 0x0B66 ? 16 : 4; break;
      case 85: // glTexGenfv(coord, pname, params)
        arg = 2; length = u32At(view, stackWa, 1) === 0x2500 ? 4 : 16; break;
      case 98: { // gluBuild1DMipmaps(target, internal, width, format, type, data)
        arg = 5;
        length = checkedImageBytes(u32At(view, stackWa, 2), 1,
          u32At(view, stackWa, 3), u32At(view, stackWa, 4));
        borrow = true;
        break;
      }
      default:
        return null;
    }
    const pointer = u32At(view, stackWa, arg);
    if (!pointer || !length) return null;
    if (!Number.isSafeInteger(length) || length > 0x7fffffff) {
      throw new RangeError('GL pointer input is too large');
    }
    return { arg, pointer, length, borrow };
  }

  class Encoder {
    constructor(options) {
      options = options || {};
      this.getMemory = options.getMemory;
      this.guestToWasm = options.guestToWasm;
      this.submit = options.submit;
      if (typeof this.getMemory !== 'function' || typeof this.guestToWasm !== 'function'
          || typeof this.submit !== 'function') {
        throw new TypeError('GL command encoder needs getMemory, guestToWasm, and submit');
      }
      this.capacity = Math.max(256, options.capacity || DEFAULT_BYTES);
      const BufferType = options.shared !== false && typeof SharedArrayBuffer === 'function'
        ? SharedArrayBuffer : ArrayBuffer;
      this.buffer = new BufferType(this.capacity);
      this.bytes = new Uint8Array(this.buffer);
      this.view = new DataView(this.buffer);
      this.used = 0;
      this.commands = 0;
      this.submissions = 0;
      this.currentContext = 0;
      this.immediateStates = new Map();
      this.immediate = null;
      // Reused across glBegin/glEnd spans. Immediate-mode games submit many
      // tiny vertices, so a JS Array push followed by a Float32Array copy made
      // every frame create garbage proportional to its geometry.
      this.immediateVertices = new Float32Array(VERTEX_FLOATS * 64);
      this.memoryBuffer = null;
      this.memoryView = null;
    }

    _state() {
      let state = this.immediateStates.get(this.currentContext);
      if (!state) {
        // Texture coordinates are (s, t, r, q): q is 1 unless glTexCoord4f,
        // glMultiTexCoord4fARB or a 4-component array set it.
        state = { color: [1, 1, 1, 1], texCoord: [0, 0, 0, 1], normal: [0, 0, 1],
          shadeModel: GL.SMOOTH, attribStack: [], clientEnabled: new Set(),
          vertexPointer: null, normalPointer: null, colorPointer: null,
          // ARB_multitexture makes the current texture coordinate, the client
          // array pointer and the GL_TEXTURE_COORD_ARRAY enable all per-unit,
          // selected by glClientActiveTextureARB. Warcraft III depends on that
          // split: it clears unit 1's array immediately before every text draw,
          // and on a single-unit implementation that clear takes unit 0's
          // coordinates with it and the text renders as its drop shadow alone.
          clientActiveTexture: 0,
          texCoord1: [0, 0, 0, 1],
          texCoordPointers: [null, null],
          texCoordEnabled: [false, false] };
        this.immediateStates.set(this.currentContext, state);
      }
      return state;
    }

    _f32(stackWa, index) {
      return this._memoryView().getFloat32((stackWa >>> 0) + 4 + index * 4, true);
    }

    _memoryView() {
      const memory = this.getMemory();
      if (memory !== this.memoryBuffer) {
        this.memoryBuffer = memory;
        this.memoryView = new DataView(memory);
      }
      return this.memoryView;
    }

    _readPointerFloats(stackWa, count, target, targetOffset = 0) {
      const pointer = u32At(this._memoryView(), stackWa, 0);
      const wa = this.guestToWasm(pointer) >>> 0;
      const view = this._memoryView();
      for (let i = 0; i < count; i++) {
        target[targetOffset + i] = view.getFloat32(wa + i * 4, true);
      }
    }

    _setColor(opcode, stackWa) {
      const color = this._state().color;
      if (opcode === 23) {
        color[0] = this._f32(stackWa, 0);
        color[1] = this._f32(stackWa, 1);
        color[2] = this._f32(stackWa, 2);
        color[3] = 1;
      } else if (opcode === 24) {
        this._readPointerFloats(stackWa, 3, color);
        color[3] = 1;
      } else if (opcode === 25) {
        for (let i = 0; i < 4; i++) color[i] = this._f32(stackWa, i);
      } else if (opcode === 26) {
        this._readPointerFloats(stackWa, 4, color);
      } else {
        const pointer = u32At(this._memoryView(), stackWa, 0);
        const wa = this.guestToWasm(pointer) >>> 0;
        const view = this._memoryView();
        for (let i = 0; i < 4; i++) color[i] = view.getUint8(wa + i) / 255;
      }
    }

    _reserveImmediate(additional) {
      const needed = this.immediate.length + additional;
      if (needed <= this.immediateVertices.length) return;
      let capacity = this.immediateVertices.length;
      while (capacity < needed) capacity *= 2;
      const grown = new Float32Array(capacity);
      grown.set(this.immediateVertices.subarray(0, this.immediate.length));
      this.immediateVertices = grown;
    }

    _appendVertex(opcode, stackWa) {
      if (!this.immediate) return false;
      let x, y, z, w = 1;
      if (opcode === 118) {
        x = this._f32(stackWa, 0); y = this._f32(stackWa, 1); z = this._f32(stackWa, 2); w = this._f32(stackWa, 3);
      } else if (opcode === 29) {
        x = this._f32(stackWa, 0); y = this._f32(stackWa, 1); z = 0;
      } else if (opcode === 30) {
        x = this._f32(stackWa, 0); y = this._f32(stackWa, 1); z = this._f32(stackWa, 2);
      } else {
        const pointer = u32At(this._memoryView(), stackWa, 0);
        const wa = this.guestToWasm(pointer) >>> 0;
        const view = this._memoryView();
        x = view.getFloat32(wa, true);
        y = view.getFloat32(wa + 4, true);
        z = view.getFloat32(wa + 8, true);
        if (opcode === 119) w = view.getFloat32(wa + 12, true);
      }
      return this._appendResolvedVertex(x, y, z, w);
    }

    _appendResolvedVertex(x, y, z, w = 1) {
      if (!this.immediate) return false;
      const state = this._state();
      this._reserveImmediate(VERTEX_FLOATS);
      let offset = this.immediate.length;
      this.immediateVertices[offset++] = x;
      this.immediateVertices[offset++] = y;
      this.immediateVertices[offset++] = z;
      for (let i = 0; i < 4; i++) this.immediateVertices[offset++] = state.color[i];
      this.immediateVertices[offset++] = state.texCoord[0];
      this.immediateVertices[offset++] = state.texCoord[1];
      this.immediateVertices[offset++] = state.normal[0];
      this.immediateVertices[offset++] = state.normal[1];
      this.immediateVertices[offset++] = state.normal[2];
      this.immediateVertices[offset++] = state.texCoord1[0];
      this.immediateVertices[offset++] = state.texCoord1[1];
      this.immediateVertices[offset++] = w;
      this.immediateVertices[offset++] = state.texCoord[2];
      this.immediateVertices[offset++] = state.texCoord[3];
      this.immediateVertices[offset++] = state.texCoord1[2];
      this.immediateVertices[offset++] = state.texCoord1[3];
      this.immediate.length = offset;
      return true;
    }

    _arrayType(type) {
      switch (type >>> 0) {
        case GL.BYTE: return { bytes: 1, get: 'getInt8', max: 127 };
        case GL.UNSIGNED_BYTE: return { bytes: 1, get: 'getUint8', max: 255 };
        case GL.SHORT: return { bytes: 2, get: 'getInt16', max: 32767 };
        case GL.UNSIGNED_SHORT: return { bytes: 2, get: 'getUint16', max: 65535 };
        case GL.INT: return { bytes: 4, get: 'getInt32', max: 2147483647 };
        case GL.UNSIGNED_INT: return { bytes: 4, get: 'getUint32', max: 4294967295 };
        case GL.FLOAT: return { bytes: 4, get: 'getFloat32', max: 0 };
        case GL.DOUBLE: return { bytes: 8, get: 'getFloat64', max: 0 };
        default: return null;
      }
    }

    _readArray(pointer, index, components, normalize) {
      const info = this._arrayType(pointer.type);
      if (!info) return null;
      const stride = pointer.stride || pointer.size * info.bytes;
      const guest = (pointer.pointer + Math.imul(index | 0, stride | 0)) >>> 0;
      const wa = this.guestToWasm(guest) >>> 0;
      const view = this._memoryView(), values = [];
      for (let i = 0; i < components; i++) {
        let value = view[info.get](wa + i * info.bytes, true);
        if (normalize && info.max) value = Math.max(-1, value / info.max);
        values.push(value);
      }
      return values;
    }

    _arrayElement(index) {
      const state = this._state();
      if (state.clientEnabled.has(GL.NORMAL_ARRAY) && state.normalPointer) {
        const normal = this._readArray(state.normalPointer, index, 3, true);
        if (normal) for (let i = 0; i < 3; i++) state.normal[i] = normal[i];
      }
      if (state.clientEnabled.has(GL.COLOR_ARRAY) && state.colorPointer) {
        const size = state.colorPointer.size;
        const color = this._readArray(state.colorPointer, index, size, true);
        if (color) {
          for (let i = 0; i < size && i < 4; i++) state.color[i] = color[i];
          if (size < 4) state.color[3] = 1;
        }
      }
      for (let unit = 0; unit < TEXTURE_UNITS; unit++) {
        const pointer = state.texCoordPointers[unit];
        if (!state.texCoordEnabled[unit] || !pointer) continue;
        const uv = this._readArray(pointer, index, Math.min(4, pointer.size), false);
        if (!uv) continue;
        const target = unit === 0 ? state.texCoord : state.texCoord1;
        target[0] = uv[0] || 0;
        target[1] = uv.length > 1 ? uv[1] || 0 : 0;
        // Missing components take GL's defaults, r = 0 and q = 1.
        target[2] = uv.length > 2 ? uv[2] || 0 : 0;
        target[3] = uv.length > 3 ? uv[3] || 0 : 1;
      }
      if (!state.clientEnabled.has(GL.VERTEX_ARRAY) || !state.vertexPointer) return;
      const vertex = this._readArray(state.vertexPointer, index, state.vertexPointer.size, false);
      if (vertex) this._appendResolvedVertex(vertex[0] || 0, vertex[1] || 0, vertex[2] || 0,
        state.vertexPointer.size > 3 ? (vertex[3] === undefined ? 1 : vertex[3]) : 1);
    }

    // glDrawArrays is glArrayElement over first .. first+count-1 (the Descent
    // demo's OpenGL renderer), with the same save/restore of current state.
    _drawArrays(mode, first, count) {
      if (this.immediate) throw new RangeError('glDrawArrays inside glBegin/glEnd');
      if ((count | 0) < 1 || (first | 0) < 0) return;
      const state = this._state();
      if (!state.clientEnabled.has(GL.VERTEX_ARRAY) || !state.vertexPointer) return;
      const saved = { color: state.color.slice(), texCoord: state.texCoord.slice(),
        texCoord1: state.texCoord1.slice(), normal: state.normal.slice() };
      this.immediate = { mode, length: 0 };
      try {
        for (let i = 0; i < count; i++) this._arrayElement(first + i);
        this._finishImmediate();
      } finally {
        this.immediate = null;
        for (let i = 0; i < 4; i++) state.color[i] = saved.color[i];
        for (let i = 0; i < 4; i++) state.texCoord[i] = saved.texCoord[i];
        for (let i = 0; i < 4; i++) state.texCoord1[i] = saved.texCoord1[i];
        for (let i = 0; i < 3; i++) state.normal[i] = saved.normal[i];
      }
    }

    // glDrawElements is glArrayElement over an index array: Warcraft III draws
    // its whole world this way. Compile it into one immediate-mode span here so
    // the guest's client pointers are read at call time, as OpenGL promises.
    _drawElements(mode, count, type, indices) {
      if (this.immediate) throw new RangeError('glDrawElements inside glBegin/glEnd');
      const info = this._arrayType(type);
      if (!info || !count) return;
      const state = this._state();
      if (!state.clientEnabled.has(GL.VERTEX_ARRAY) || !state.vertexPointer) return;
      const saved = { color: state.color.slice(), texCoord: state.texCoord.slice(),
        texCoord1: state.texCoord1.slice(), normal: state.normal.slice() };
      const view = this._memoryView();
      const wa = this.guestToWasm(indices >>> 0) >>> 0;
      this.immediate = { mode, length: 0 };
      try {
        for (let i = 0; i < count; i++) {
          this._arrayElement(view[info.get](wa + i * info.bytes, true));
        }
        this._finishImmediate();
      } finally {
        this.immediate = null;
        for (let i = 0; i < 4; i++) state.color[i] = saved.color[i];
        for (let i = 0; i < 4; i++) state.texCoord[i] = saved.texCoord[i];
        for (let i = 0; i < 4; i++) state.texCoord1[i] = saved.texCoord1[i];
        for (let i = 0; i < 3; i++) state.normal[i] = saved.normal[i];
      }
    }

    _capturePacked(mode, vertices) {
      const primitive = mode & 0xff;
      const groupVertices = primitive === GL.TRIANGLES ? 3 : primitive === GL.LINES ? 2 : 1;
      const maxFloats = Math.floor((this.capacity - HEADER_BYTES) / 4 / VERTEX_FLOATS)
        * VERTEX_FLOATS;
      const chunkFloats = Math.floor(maxFloats / (groupVertices * VERTEX_FLOATS))
        * groupVertices * VERTEX_FLOATS;
      if (!chunkFloats) throw new RangeError('GL command buffer cannot hold one packed primitive');
      stats.packedRecords++;
      stats.packedVertices += vertices.length / VERTEX_FLOATS;
      for (let base = 0; base < vertices.length; base += chunkFloats) {
        const length = Math.min(chunkFloats, vertices.length - base);
        const recordBytes = align4(HEADER_BYTES + length * 4);
        if (this.used + recordBytes > this.capacity) this.flush();
        const start = this.used;
        const pointerOffset = start + HEADER_BYTES;
        this.view.setUint32(start, recordBytes, true);
        this.view.setUint32(start + 4, PACKED_DRAW_OPCODE, true);
        const continuation = base && (mode & 0x1000000) ? 0x2000000 : 0;
        this.view.setUint32(start + 8, (mode | continuation) >>> 0, true);
        this.view.setUint32(start + 12, 0, true);
        this.view.setUint32(start + 16, 0, true);
        this.view.setUint32(start + 20, length * 4, true);
        this.view.setUint32(start + 24, pointerOffset, true);
        this.view.setUint32(start + 28, FLAG_POINTER_COPY, true);
        new Float32Array(this.buffer, pointerOffset, length).set(vertices.subarray(base, base + length));
        this.used += recordBytes;
        this.commands++;
      }
    }

    _finishImmediate() {
      const immediate = this.immediate;
      this.immediate = null;
      if (!immediate || !immediate.length) return;
      const vertices = this.immediateVertices.subarray(0, immediate.length);
      stats.spans++;
      const geometry = normalizeImmediate(immediate.mode, vertices, this._state().shadeModel);
      if (geometry.vertices.length) this._capturePacked(geometry.mode, geometry.vertices);
    }

    _capture(opcode, stackWa, aux, pointer, borrowed) {
      const memory = this.getMemory();
      const words = ARG_WORDS[opcode | 0];
      if (words === undefined) throw new RangeError(`unknown GL opcode ${opcode}`);
      const stackBytes = 4 + words * 4;
      const pointerBytes = pointer && !borrowed ? pointer.length : 0;
      const recordBytes = align4(HEADER_BYTES + stackBytes + pointerBytes);
      if (recordBytes > this.capacity) return false;
      if (this.used + recordBytes > this.capacity) this.flush();

      const start = this.used;
      const stackOffset = start + HEADER_BYTES;
      const pointerOffset = pointerBytes ? stackOffset + stackBytes : 0;
      this.view.setUint32(start, recordBytes, true);
      this.view.setUint32(start + 4, opcode >>> 0, true);
      this.view.setUint32(start + 8, aux >>> 0, true);
      this.view.setUint32(start + 12, stackBytes, true);
      this.view.setUint32(start + 16, pointer ? pointer.pointer >>> 0 : 0, true);
      this.view.setUint32(start + 20, pointer ? pointer.length >>> 0 : 0, true);
      this.view.setUint32(start + 24, pointerOffset >>> 0, true);
      this.view.setUint32(start + 28, pointer
        ? (borrowed ? FLAG_POINTER_BORROW : FLAG_POINTER_COPY) : 0, true);

      const source = new Uint8Array(memory, stackWa >>> 0, stackBytes);
      this.bytes.set(source, stackOffset);
      if (pointerBytes) {
        const wa = this.guestToWasm(pointer.pointer >>> 0) >>> 0;
        this.bytes.set(new Uint8Array(memory, wa, pointerBytes), pointerOffset);
      }
      this.used += recordBytes;
      this.commands++;
      return true;
    }

    call(opcode, stackWa, aux) {
      opcode |= 0; stackWa >>>= 0; aux >>>= 0;
      stats.calls++;
      if (opcode >= 0 && opcode < 128) stats.byOpcode[opcode]++;
      const memory = this.getMemory();
      const memoryView = this._memoryView();

      // Immediate-mode state and vertices never enter the generic command
      // stream. Compile their final interleaved representation at glEnd.
      if (opcode >= 23 && opcode <= 27) {
        this._setColor(opcode, stackWa);
        return 0;
      }
      if (opcode === 56) {
        const color = this._state().color;
        for (let i = 0; i < 4; i++) {
          color[i] = (u32At(memoryView, stackWa, i) & 0xFF) / 255;
        }
        return 0;
      }
      if (opcode === 111) { // glColor3ub(r, g, b)
        const color = this._state().color;
        for (let i = 0; i < 3; i++) {
          color[i] = (u32At(memoryView, stackWa, i) & 0xFF) / 255;
        }
        color[3] = 1;
        return 0;
      }
      if (opcode === 58) {
        const pointer = u32At(memoryView, stackWa, 0);
        const wa = this.guestToWasm(pointer) >>> 0;
        const color = this._state().color;
        color[0] = memoryView.getUint8(wa) / 255;
        color[1] = memoryView.getUint8(wa + 1) / 255;
        color[2] = memoryView.getUint8(wa + 2) / 255;
        color[3] = 1;
        return 0;
      }
      if (opcode === 28) {
        const texCoord = this._state().texCoord;
        texCoord[0] = this._f32(stackWa, 0);
        texCoord[1] = this._f32(stackWa, 1);
        texCoord[2] = 0; texCoord[3] = 1;
        return 0;
      }
      if (opcode === 120) { // glTexCoord4f(s, t, r, q)
        const texCoord = this._state().texCoord;
        for (let i = 0; i < 4; i++) texCoord[i] = this._f32(stackWa, i);
        return 0;
      }
      if (opcode === 121) { // glTexCoord4fv(v)
        this._readPointerFloats(stackWa, 4, this._state().texCoord);
        return 0;
      }
      if (opcode === 122 || opcode === 123) { // glMultiTexCoord4f[v]ARB
        const unit = (u32At(memoryView, stackWa, 0) - 0x84C0) >>> 0;
        if (unit < TEXTURE_UNITS) {
          const state = this._state();
          const target = unit === 0 ? state.texCoord : state.texCoord1;
          if (opcode === 122) for (let i = 0; i < 4; i++) target[i] = this._f32(stackWa, i + 1);
          else this._readPointerFloats(stackWa + 4, 4, target);
        }
        return 0;
      }
      if (opcode === 63 || opcode === 64) {
        const normal = this._state().normal;
        if (opcode === 63) {
          normal[0] = this._f32(stackWa, 0);
          normal[1] = this._f32(stackWa, 1);
          normal[2] = this._f32(stackWa, 2);
        } else {
          this._readPointerFloats(stackWa, 3, normal);
        }
        return 0;
      }
      if (opcode === 86 || opcode === 99) { // glEnable/glDisableClientState
        const state = this._state();
        const array = u32At(memoryView, stackWa, 0);
        const on = opcode === 86;
        if (array === GL.TEXTURE_COORD_ARRAY) {
          state.texCoordEnabled[state.clientActiveTexture] = on;
        } else if (array === GL.VERTEX_ARRAY || array === GL.NORMAL_ARRAY
            || array === GL.COLOR_ARRAY) {
          if (on) state.clientEnabled.add(array);
          else state.clientEnabled.delete(array);
        }
        return 0;
      }
      if (opcode === 88) {
        this._state().vertexPointer = {
          size: u32At(memoryView, stackWa, 0), type: u32At(memoryView, stackWa, 1),
          stride: u32At(memoryView, stackWa, 2), pointer: u32At(memoryView, stackWa, 3),
        };
        return 0;
      }
      if (opcode === 89) {
        this._state().normalPointer = {
          size: 3, type: u32At(memoryView, stackWa, 0),
          stride: u32At(memoryView, stackWa, 1), pointer: u32At(memoryView, stackWa, 2),
        };
        return 0;
      }
      if (opcode === 100) { // glTexCoordPointer(size, type, stride, pointer)
        const state = this._state();
        state.texCoordPointers[state.clientActiveTexture] = {
          size: u32At(memoryView, stackWa, 0), type: u32At(memoryView, stackWa, 1),
          stride: u32At(memoryView, stackWa, 2), pointer: u32At(memoryView, stackWa, 3),
        };
        return 0;
      }
      if (opcode === 106) { // glClientActiveTextureARB(GL_TEXTUREn_ARB)
        const unit = (u32At(memoryView, stackWa, 0) - 0x84C0) >>> 0;
        if (unit < TEXTURE_UNITS) this._state().clientActiveTexture = unit;
        return 0;
      }
      if (opcode === 107) { // glMultiTexCoord2fARB(target, s, t)
        const unit = (u32At(memoryView, stackWa, 0) - 0x84C0) >>> 0;
        if (unit < TEXTURE_UNITS) {
          const state = this._state();
          const target = unit === 0 ? state.texCoord : state.texCoord1;
          target[0] = this._f32(stackWa, 1);
          target[1] = this._f32(stackWa, 2);
          target[2] = 0; target[3] = 1;
        }
        return 0;
      }
      if (opcode === 117) { // glMultiTexCoord2fvARB(target, v): 107 by pointer
        const unit = (u32At(memoryView, stackWa, 0) - 0x84C0) >>> 0;
        if (unit < TEXTURE_UNITS) {
          const state = this._state();
          // One word along, the pointer is argument 0 to the shared reader.
          const target = unit === 0 ? state.texCoord : state.texCoord1;
          this._readPointerFloats(stackWa + 4, 2, target);
          target[2] = 0; target[3] = 1;
        }
        return 0;
      }
      if (opcode === 101) { // glColorPointer(size, type, stride, pointer)
        this._state().colorPointer = {
          size: u32At(memoryView, stackWa, 0), type: u32At(memoryView, stackWa, 1),
          stride: u32At(memoryView, stackWa, 2), pointer: u32At(memoryView, stackWa, 3),
        };
        return 0;
      }
      if (opcode === 102) { // glDrawElements(mode, count, type, indices)
        this._drawElements(u32At(memoryView, stackWa, 0), u32At(memoryView, stackWa, 1),
          u32At(memoryView, stackWa, 2), u32At(memoryView, stackWa, 3));
        return 0;
      }
      if (opcode === 108) { // glDrawArrays(mode, first, count)
        this._drawArrays(u32At(memoryView, stackWa, 0), u32At(memoryView, stackWa, 1) | 0,
          u32At(memoryView, stackWa, 2) | 0);
        return 0;
      }
      if (opcode === 95) {
        const texCoord = this._state().texCoord;
        this._readPointerFloats(stackWa, 2, texCoord);
        texCoord[2] = 0; texCoord[3] = 1;
        return 0;
      }
      if (opcode === 87) {
        this._arrayElement(u32At(memoryView, stackWa, 0));
        return 0;
      }
      if (opcode === 91) {
        if (!this.immediate) return 0;
        const pointer = u32At(memoryView, stackWa, 0);
        const wa = this.guestToWasm(pointer) >>> 0;
        this._appendResolvedVertex(memoryView.getFloat32(wa, true),
          memoryView.getFloat32(wa + 4, true), 0);
        return 0;
      }
      if (opcode === 97) {
        this._appendResolvedVertex(u32At(memoryView, stackWa, 0) | 0,
          u32At(memoryView, stackWa, 1) | 0, 0);
        return 0;
      }
      if (opcode === 76) {
        const state = this._state();
        state.attribStack.push({
          color: state.color.slice(), texCoord: state.texCoord.slice(),
          texCoord1: state.texCoord1.slice(),
          normal: state.normal.slice(), shadeModel: state.shadeModel,
        });
      } else if (opcode === 77) {
        const state = this._state();
        const saved = state.attribStack.pop();
        if (saved) {
          for (let i = 0; i < 4; i++) state.color[i] = saved.color[i];
          for (let i = 0; i < 4; i++) state.texCoord[i] = saved.texCoord[i];
          for (let i = 0; i < 4; i++) state.texCoord1[i] = saved.texCoord1[i];
          for (let i = 0; i < 3; i++) state.normal[i] = saved.normal[i];
          state.shadeModel = saved.shadeModel;
        }
      }
      if (opcode === 19) {
        if (this.immediate) throw new RangeError(`GL opcode ${opcode} inside glBegin/glEnd`);
        this._state().shadeModel = u32At(memoryView, stackWa, 0);
        return 0;
      }
      if (opcode === 21) {
        if (this.immediate) throw new RangeError('nested glBegin is unsupported');
        this.immediate = { mode: u32At(memoryView, stackWa, 0), length: 0 };
        return 0;
      }
      if ((opcode >= 29 && opcode <= 31) || opcode === 118 || opcode === 119) {
        this._appendVertex(opcode, stackWa);
        return 0;
      }
      if (opcode === 22) {
        if (this.immediate) this._finishImmediate();
        return 0;
      }
      if (this.immediate) throw new RangeError(`GL opcode ${opcode} inside glBegin/glEnd`);
      const pointer = pointerSpec(opcode, memoryView, stackWa);

      // OpenGL promises that client pixels have been consumed when a texture
      // upload returns. Preserve that contract without a staging copy: append
      // the borrowed range to the pending stream, then keep the guest blocked
      // until the single ordered submission has replayed it.
      if (pointer && pointer.borrow) {
        if (!this._capture(opcode, stackWa, aux, pointer, true)) {
          throw new RangeError(`GL command ${opcode} does not fit empty buffer`);
        }
        return this.flush();
      }

      // An unexpectedly large pointer input follows the same safe borrowed
      // path.  This remains a batch submission, never a per-call host fallback.
      if (pointer && HEADER_BYTES + 4 + (ARG_WORDS[opcode] * 4) + pointer.length > this.capacity) {
        if (!this._capture(opcode, stackWa, aux, pointer, true)) {
          throw new RangeError(`GL borrowed command ${opcode} does not fit empty buffer`);
        }
        return this.flush();
      }

      if (!this._capture(opcode, stackWa, aux, pointer, false)) {
        throw new RangeError(`GL command ${opcode} does not fit command buffer`);
      }
      const result = BARRIERS.has(opcode) ? this.flush() : 0;
      if (opcode === 51 && result) this.currentContext = u32At(memoryView, stackWa, 1);
      if (opcode === 49 && result) {
        const deleted = u32At(memoryView, stackWa, 0);
        this.immediateStates.delete(deleted);
        if (this.currentContext === deleted) this.currentContext = 0;
      }
      return result;
    }

    flush() {
      if (!this.used) return 0;
      const batch = { buffer: this.buffer, bytes: this.used, commands: this.commands };
      let result = 0;
      try {
        result = this.submit(batch) | 0;
        this.submissions++;
        stats.flushes++;
      } finally {
        this.used = 0;
        this.commands = 0;
      }
      return result;
    }
  }

module.exports = { ...ABI, Encoder, pointerSpec, normalizeImmediate };

// OpenGL 1.x fixed-function frontend lowered to the generic GPU backend.
(function (root, factory) {
  const backendApi = typeof module !== 'undefined' && module.exports
    ? require('./gpu-backend') : root.GpuBackend;
  const commandApi = typeof module !== 'undefined' && module.exports
    ? require('./gl-command-stream') : root.GLCommandStream;
  const memUtils = typeof module !== 'undefined' && module.exports
    ? require('./mem-utils') : root.memUtils;
  const api = factory(backendApi, commandApi, memUtils);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OpenGLCompat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GpuBackend, GLCommandStream, MemUtils) {
  'use strict';

  const GL_CALLS = [
    'glAlphaFunc', 'glBlendFunc', 'glClear', 'glClearColor', 'glCullFace',
    'glDepthFunc', 'glDepthMask', 'glDepthRange', 'glDisable', 'glDrawBuffer',
    'glEnable', 'glFinish', 'glGetError', 'glGetFloatv', 'glGetString',
    'glPointSize', 'glPolygonMode', 'glReadPixels', 'glScissor', 'glShadeModel',
    'glViewport', 'glBegin', 'glEnd', 'glColor3f', 'glColor3fv', 'glColor4f',
    'glColor4fv', 'glColor4ubv', 'glTexCoord2f', 'glVertex2f', 'glVertex3f',
    'glVertex3fv', 'glFrustum', 'glLoadIdentity', 'glLoadMatrixf', 'glMatrixMode',
    'glOrtho', 'glPopMatrix', 'glPushMatrix', 'glRotatef', 'glScalef',
    'glTranslatef', 'glBindTexture', 'glDeleteTextures', 'glTexEnvf',
    'glTexImage2D', 'glTexParameterf', 'glTexSubImage2D',
  ];
  const WGL_CALLS = [
    'wglCreateContext', 'wglDeleteContext', 'wglGetProcAddress',
    'wglMakeCurrent', 'wglChoosePixelFormat', 'wglDescribePixelFormat',
    'wglSetPixelFormat',
  ];
  // Opcode 55 is a backend presentation operation reached by authentic
  // GDI32!SwapBuffers and the legacy wglSwapBuffers spelling dynamically
  // requested by Quake II's 1998 ref_gl.dll.
  // Keep additions after gpuPresent so the long-lived GL/WGL opcode ABI used
  // by the Worker command stream does not shift. GoldSrc calls the scalar
  // colour form while drawing its software-generated lightmap polygons.
  const GPU_CALLS = ['gpuPresent', 'glColor4ub', 'glPolygonOffset', 'glColor3ubv'];
  const GLU_CALLS = ['gluPerspective', 'gluLookAt', 'gluBuild2DMipmaps', 'gluOrtho2D'];
  const LEGACY_GL_CALLS = [
    'glNormal3f', 'glNormal3fv', 'glIsEnabled', 'glColorMaterial',
    'glLightfv', 'glMaterialfv', 'glLightModelfv', 'glLightModeli',
    'glMaterialf', 'glLightf', 'glPixelStorei', 'glGenTextures', 'glHint',
    'glPushAttrib', 'glPopAttrib',
    'glFogfv', 'glFogf', 'glFogi',
    'glFrontFace',
    'glTexEnvi',
    'glTexGeni', 'glTexGenf', 'glTexGenfv',
    // SimGolf's Terrain.dll uses the OpenGL 1.1 vertex-array path and a few
    // vector/double aliases absent from the earlier immediate-mode corpus.
    'glEnableClientState', 'glArrayElement', 'glVertexPointer', 'glNormalPointer',
    'glRotated', 'glVertex2fv', 'glMateriali',
    'glFlush', 'glLineWidth', 'glTexCoord2fv', 'glTexParameteri', 'glVertex2i',
    'gluBuild1DMipmaps',
    // Warcraft III disables the arrays again between passes, draws its world
    // through indexed client arrays, and queries integer limits at startup.
    'glDisableClientState',
    'glTexCoordPointer', 'glColorPointer', 'glDrawElements',
    'glGetIntegerv', 'glReadBuffer',
    // ARB_multitexture. Warcraft III looks these up through wglGetProcAddress
    // and clears unit 1's coordinate array before every text draw; without the
    // extension that clear lands on unit 0 and the menu text loses its fill.
    'glActiveTextureARB', 'glClientActiveTextureARB', 'glMultiTexCoord2fARB',
    // Descent 3 draws its client arrays unindexed.
    'glDrawArrays',
    // Unreal-engine OpenGlDrv composes its view transform and sets the
    // depth its clears write.
    'glMultMatrixf', 'glClearDepth',
    // Anachronox's ref_gl sets its HUD and font colours with the scalar
    // unsigned-byte RGB form.
    'glColor3ub',
    'glTexParameterfv', 'glGetTexParameterfv',
    // Serious Sam reads a level's component sizes to choose texture formats.
    'glGetTexLevelParameteriv', 'glGetTexLevelParameterfv',
  ];
  const CALLS = GL_CALLS.concat(WGL_CALLS, GPU_CALLS, GLU_CALLS, LEGACY_GL_CALLS);

  // Process-wide load-immune counters, the executor half of the pair in
  // gl-command-stream.js. `enqueued` packed spans against `draws` says whether
  // same-mode spans actually merge or every state change splits them.
  // `ops` is one counter per CALLS index -- which GL entry points a real app
  // actually issues, as opposed to which ones we happen to implement. It is
  // the ground truth behind any claim that the WAT mirror in
  // src/09a8f-gl-matrix.wat covers an app: a family we cannot mirror is
  // harmless in an app whose counter for it is zero, and disqualifying in one
  // where it is not. There is no such family left -- the attribute stack was
  // the last, and the WAT mirror now keeps its own copy of the same state this
  // file's pushAttrib saves -- so the counters are now evidence about coverage
  // rather than about a known hole. Counting here rather than in the WAT observer keeps the
  // encoder's hot path untouched -- an increment beside the GL work itself is
  // lost in the noise, one inside $gl_mtx_observe would not be.
  // The stream's two synthetic opcodes are not CALLS entries and are numbered
  // far above them, so `ops` gets a slot appended for each. -1 when the stream
  // module is absent, which no real opcode can collide with.
  const CommandStreamOps = {
    PACKED_DRAW: GLCommandStream ? GLCommandStream.PACKED_DRAW_OPCODE : -1,
    WAT_FLUSH: GLCommandStream ? GLCommandStream.WAT_STREAM_FLUSH_OPCODE : -1,
  };
  const PACKED_DRAW_SLOT = CALLS.length;
  const WAT_FLUSH_SLOT = CALLS.length + 1;
  const OP_NAMES = CALLS.concat(['(packed draw)', '(WAT stream flush)']);

  const stats = {
    enqueued: 0, draws: 0, drawVertices: 0, presents: 0, frontFlushes: 0,
    ops: new Int32Array(CALLS.length + 2),
  };
  const CALL_INDEX = Object.fromEntries(CALLS.map((name, index) => [name, index]));
  // hooks.trace(slot, opcode, aux, capture), when set, sees every replayed command before
  // it runs -- the CLI's --trace-gl. Null costs one property read per call.
  const hooks = { trace: null };

  const C = {
    FALSE: 0, TRUE: 1,
    POINTS: 0x0000, LINES: 0x0001, LINE_LOOP: 0x0002, LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004, TRIANGLE_STRIP: 0x0005, TRIANGLE_FAN: 0x0006,
    QUADS: 0x0007, QUAD_STRIP: 0x0008, POLYGON: 0x0009,
    MODELVIEW: 0x1700, PROJECTION: 0x1701, TEXTURE: 0x1702,
    MODELVIEW_MATRIX: 0x0BA6, PROJECTION_MATRIX: 0x0BA7, TEXTURE_MATRIX: 0x0BA8,
    MAX_TEXTURE_SIZE: 0x0D33,
    // Fixed-function integer limits WebGL has no enum for, plus the read-buffer
    // selector Warcraft III sets before its screenshot readback.
    MAX_LIGHTS: 0x0D31, MAX_TEXTURE_UNITS: 0x84E2,
    MAX_MODELVIEW_STACK_DEPTH: 0x0D36, MAX_PROJECTION_STACK_DEPTH: 0x0D38,
    MAX_TEXTURE_STACK_DEPTH: 0x0D39, MAX_ATTRIB_STACK_DEPTH: 0x0D35,
    READ_BUFFER: 0x0C02, DRAW_BUFFER: 0x0C01, BACK: 0x0405,
    TEXTURE_2D: 0x0DE1, ALPHA_TEST: 0x0BC0, BLEND: 0x0BE2,
    DEPTH_TEST: 0x0B71, CULL_FACE: 0x0B44, SCISSOR_TEST: 0x0C11,
    POLYGON_OFFSET_FILL: 0x8037,
    LIGHTING: 0x0B50, COLOR_MATERIAL: 0x0B57,
    LIGHT0: 0x4000, LIGHT7: 0x4007,
    AMBIENT: 0x1200, DIFFUSE: 0x1201, SPECULAR: 0x1202, POSITION: 0x1203,
    EMISSION: 0x1600, SHININESS: 0x1601, AMBIENT_AND_DIFFUSE: 0x1602,
    LIGHT_MODEL_AMBIENT: 0x0B53,
    FOG: 0x0B60, FOG_DENSITY: 0x0B62, FOG_START: 0x0B63, FOG_END: 0x0B64,
    FOG_MODE: 0x0B65, FOG_COLOR: 0x0B66, EXP: 0x0800, EXP2: 0x0801, LINEAR: 0x2601,
    TEXTURE_GEN_S: 0x0C60, TEXTURE_GEN_T: 0x0C61,
    S: 0x2000, T: 0x2001, TEXTURE_GEN_MODE: 0x2500, SPHERE_MAP: 0x2402,
    SMOOTH: 0x1D01, FLAT: 0x1D00,
    TEXTURE_ENV: 0x2300, TEXTURE_ENV_MODE: 0x2200,
    MODULATE: 0x2100, REPLACE: 0x1E01,
    CLAMP: 0x2900, CLAMP_TO_EDGE: 0x812F,
    REPEAT: 0x2901, MIRRORED_REPEAT: 0x8370, NEAREST: 0x2600,
    TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803, TEXTURE_BORDER_COLOR: 0x1004,
    TEXTURE_PRIORITY: 0x8066, TEXTURE_RESIDENT: 0x8067,
    INVALID_ENUM: 0x0500, INVALID_VALUE: 0x0501,
    RGB: 0x1907, RGBA: 0x1908, BGRA: 0x80E1, ALPHA: 0x1906, LUMINANCE: 0x1909,
    BYTE: 0x1400, UNSIGNED_BYTE: 0x1401, SHORT: 0x1402, UNSIGNED_SHORT: 0x1403,
    INT: 0x1404, UNSIGNED_INT: 0x1405, FLOAT: 0x1406, DOUBLE: 0x140A,
    VERTEX_ARRAY: 0x8074, NORMAL_ARRAY: 0x8075,
    NO_ERROR: 0,
  };

  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function stackTop(stack) {
    return stack[stack.length - 1];
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] +
          a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
      }
    }
    return out;
  }

  function translation(x, y, z) {
    const out = identity(); out[12] = x; out[13] = y; out[14] = z; return out;
  }
  function scale(x, y, z) {
    const out = identity(); out[0] = x; out[5] = y; out[10] = z; return out;
  }
  function rotation(angle, x, y, z) {
    const length = Math.hypot(x, y, z) || 1;
    x /= length; y /= length; z /= length;
    const r = angle * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), t = 1 - c;
    return new Float32Array([
      x * x * t + c, y * x * t + z * s, z * x * t - y * s, 0,
      x * y * t - z * s, y * y * t + c, z * y * t + x * s, 0,
      x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0,
      0, 0, 0, 1,
    ]);
  }
  function frustum(l, r, b, t, n, f) {
    const out = new Float32Array(16);
    out[0] = 2 * n / (r - l); out[5] = 2 * n / (t - b);
    out[8] = (r + l) / (r - l); out[9] = (t + b) / (t - b);
    out[10] = -(f + n) / (f - n); out[11] = -1;
    out[14] = -(2 * f * n) / (f - n);
    return out;
  }
  function ortho(l, r, b, t, n, f) {
    const out = identity();
    out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
    out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b);
    out[14] = -(f + n) / (f - n);
    return out;
  }
  function perspective(fovy, aspect, nearValue, farValue) {
    const radians = fovy * Math.PI / 360;
    const top = nearValue * Math.tan(radians);
    const right = top * aspect;
    return frustum(-right, right, -top, top, nearValue, farValue);
  }
  function lookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
    let fx = centerX - eyeX, fy = centerY - eyeY, fz = centerZ - eyeZ;
    let length = Math.hypot(fx, fy, fz) || 1;
    fx /= length; fy /= length; fz /= length;
    let sx = fy * upZ - fz * upY;
    let sy = fz * upX - fx * upZ;
    let sz = fx * upY - fy * upX;
    length = Math.hypot(sx, sy, sz) || 1;
    sx /= length; sy /= length; sz /= length;
    const ux = sy * fz - sz * fy;
    const uy = sz * fx - sx * fz;
    const uz = sx * fy - sy * fx;
    return new Float32Array([
      sx, ux, -fx, 0,
      sy, uy, -fy, 0,
      sz, uz, -fz, 0,
      -(sx * eyeX + sy * eyeY + sz * eyeZ),
      -(ux * eyeX + uy * eyeY + uz * eyeZ),
      fx * eyeX + fy * eyeY + fz * eyeZ,
      1,
    ]);
  }

  function transform4(matrix, vector) {
    return new Float32Array([
      matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
      matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
      matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
      matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
    ]);
  }

  const VERTEX_SHADER = `
    // mat3(m) on a mat4 -- a "sub-matrix constructor" -- is legal in GLSL ES
    // 1.00, which is what a browser's WebGL compiles, and ILLEGAL in desktop
    // GLSL 110, which is what a native GL driver gives a WebGL 1 context that
    // is not going through ANGLE. Headless runs on @node-3d/webgl hit the
    // native compiler and every shader failed with "GLSL 110 does not allow
    // sub- or super-matrix constructors", followed by a cascade of undeclared
    // identifiers from the abandoned parse. Extracting the columns is valid in
    // both dialects, so this is portable rather than conditional.
    #define NORMAL_MATRIX(m) mat3(m[0].xyz, m[1].xyz, m[2].xyz)
    attribute vec3 aPosition;
    attribute vec4 aColor;
    attribute vec2 aTexCoord;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord1;
    uniform mat4 uModelView;
    uniform mat4 uProjection;
    uniform mat4 uTextureMatrix;
    uniform mat4 uTextureMatrix1;
    uniform float uPointSize;
    uniform int uLightingEnabled;
    uniform int uColorMaterialEnabled;
    uniform vec4 uGlobalAmbient;
    uniform vec4 uLightEnabledA;
    uniform vec4 uLightEnabledB;
    uniform vec4 uLightPosition[8];
    uniform vec4 uLightAmbient[8];
    uniform vec4 uLightDiffuse[8];
    uniform vec4 uLightSpecular[8];
    uniform vec4 uMaterialAmbient;
    uniform vec4 uMaterialDiffuse;
    uniform vec4 uMaterialSpecular;
    uniform vec4 uMaterialEmission;
    uniform float uMaterialShininess;
    uniform int uSphereMapEnabled;
    varying vec4 vColor;
    varying vec2 vTexCoord;
    varying vec2 vTexCoord1;
    varying float vFogDistance;
    void main() {
      vec4 eyePosition = uModelView * vec4(aPosition, 1.0);
      gl_Position = uProjection * eyePosition;
      vec4 litColor = aColor;
      if (uLightingEnabled != 0) {
        vec3 normal = normalize(NORMAL_MATRIX(uModelView) * aNormal);
        vec3 viewDirection = normalize(-eyePosition.xyz);
        vec4 materialAmbient = uColorMaterialEnabled != 0 ? aColor : uMaterialAmbient;
        vec4 materialDiffuse = uColorMaterialEnabled != 0 ? aColor : uMaterialDiffuse;
        litColor = uMaterialEmission + uGlobalAmbient * materialAmbient;
        for (int i = 0; i < 8; i++) {
          float enabled = i < 4 ? uLightEnabledA[i] : uLightEnabledB[i - 4];
          if (enabled > 0.5) {
            vec3 lightDirection = uLightPosition[i].w == 0.0
              ? normalize(uLightPosition[i].xyz)
              : normalize(uLightPosition[i].xyz - eyePosition.xyz);
            float diffuse = max(dot(normal, lightDirection), 0.0);
            litColor += uLightAmbient[i] * materialAmbient;
            litColor += uLightDiffuse[i] * materialDiffuse * diffuse;
            if (diffuse > 0.0 && uMaterialShininess > 0.0) {
              vec3 halfVector = normalize(lightDirection + viewDirection);
              float specular = pow(max(dot(normal, halfVector), 0.0), uMaterialShininess);
              litColor += uLightSpecular[i] * uMaterialSpecular * specular;
            }
          }
        }
        litColor.a = materialDiffuse.a;
      }
      vColor = clamp(litColor, 0.0, 1.0);
      vec2 texCoord = aTexCoord;
      if (uSphereMapEnabled != 0) {
        vec3 eyeDirection = normalize(eyePosition.xyz);
        vec3 reflected = reflect(eyeDirection, normalize(NORMAL_MATRIX(uModelView) * aNormal));
        float m = 2.0 * sqrt(dot(reflected.xy, reflected.xy) + (reflected.z + 1.0) * (reflected.z + 1.0));
        if (m > 0.000001) texCoord = reflected.xy / m + vec2(0.5, 0.5);
      }
      vTexCoord = (uTextureMatrix * vec4(texCoord, 0.0, 1.0)).xy;
      vTexCoord1 = (uTextureMatrix1 * vec4(aTexCoord1, 0.0, 1.0)).xy;
      vFogDistance = abs(eyePosition.z);
      gl_PointSize = uPointSize;
    }`;
  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform int uTextureEnabled;
    uniform int uTextureMode;
    uniform sampler2D uTexture1;
    uniform int uTexture1Enabled;
    uniform int uTexture1Mode;
    uniform int uAlphaEnabled;
    uniform int uAlphaFunc;
    uniform float uAlphaRef;
    uniform int uFogEnabled;
    uniform int uFogMode;
    uniform vec4 uFogColor;
    uniform float uFogDensity;
    uniform float uFogStart;
    uniform float uFogEnd;
    varying vec4 vColor;
    varying vec2 vTexCoord;
    varying vec2 vTexCoord1;
    varying float vFogDistance;
    bool alphaPass(float a) {
      if (uAlphaFunc == 0) return false;
      if (uAlphaFunc == 1) return a < uAlphaRef;
      if (uAlphaFunc == 2) return abs(a - uAlphaRef) < 0.00392157;
      if (uAlphaFunc == 3) return a <= uAlphaRef;
      if (uAlphaFunc == 4) return a > uAlphaRef;
      if (uAlphaFunc == 5) return abs(a - uAlphaRef) >= 0.00392157;
      if (uAlphaFunc == 6) return a >= uAlphaRef;
      return true;
    }
    void main() {
      vec4 color = vColor;
      if (uTextureEnabled != 0) {
        vec4 texel = texture2D(uTexture, vTexCoord);
        color = uTextureMode == 1 ? texel : texel * color;
      }
      if (uTexture1Enabled != 0) {
        vec4 texel1 = texture2D(uTexture1, vTexCoord1);
        color = uTexture1Mode == 1 ? texel1 : texel1 * color;
      }
      if (uAlphaEnabled != 0 && !alphaPass(color.a)) discard;
      if (uFogEnabled != 0) {
        float factor;
        if (uFogMode == 0) factor = (uFogEnd - vFogDistance) / max(0.000001, uFogEnd - uFogStart);
        else if (uFogMode == 1) factor = exp(-uFogDensity * vFogDistance);
        else factor = exp(-uFogDensity * uFogDensity * vFogDistance * vFogDistance);
        color = mix(uFogColor, color, clamp(factor, 0.0, 1.0));
      }
      gl_FragColor = color;
    }`;

  // Explicit texel-center fetches avoid depending on the hardware sampler's
  // MIN/MAG choice while reconstructing desktop GL's missing border taps.
  // Integer LOD fetches select one mip; trilinear filtering combines levels
  // only after each level has applied its own border footprint.
  function borderFragmentShader() {
    let source = FRAGMENT_SHADER.replace('precision mediump float;', 'precision highp float;');
    let helpers = '';
    for (const unit of [0, 1]) {
      const sampler = unit ? 'uTexture1' : 'uTexture';
      source = source.replace(`texture2D(${sampler}, ${unit ? 'vTexCoord1' : 'vTexCoord'})`,
        `borderSample${unit}(${unit ? 'vTexCoord1' : 'vTexCoord'})`);
      helpers += `
      uniform vec4 uBorderExtent${unit}, uBorderFilter${unit}, uBorderColor${unit};
      float borderAddress${unit}(float p, float size, float mode) {
        if (mode == 1.0) return mod(p, size);
        if (mode == 2.0) { float q=mod(p,2.0*size); return q<size?q:2.0*size-1.0-q; }
        if (mode == 3.0) return clamp(p,0.0,size-1.0);
        return p;
      }
      vec4 borderTap${unit}(vec2 p, vec2 size, float level) {
        p=vec2(borderAddress${unit}(p.x,size.x,uBorderExtent${unit}.z),
               borderAddress${unit}(p.y,size.y,uBorderExtent${unit}.w));
        if (p.x<0.0 || p.y<0.0 || p.x>=size.x || p.y>=size.y) return uBorderColor${unit};
        return texture2DLodEXT(${sampler}, (p+0.5)/size, level);
      }
      vec4 borderLevel${unit}(vec2 uv, float level, float linearFilter) {
        vec2 size=max(vec2(1.0),floor(uBorderExtent${unit}.xy/exp2(level)));
        if (uBorderExtent${unit}.z==4.0) uv.x=clamp(uv.x,0.0,1.0);
        if (uBorderExtent${unit}.w==4.0) uv.y=clamp(uv.y,0.0,1.0);
        vec2 p=uv*size;
        if (linearFilter==0.0) {
          p=floor(p);
          if (uBorderExtent${unit}.z==4.0) p.x=min(p.x,size.x-1.0);
          if (uBorderExtent${unit}.w==4.0) p.y=min(p.y,size.y-1.0);
          return borderTap${unit}(p,size,level);
        }
        p-=0.5; vec2 f=fract(p); p=floor(p);
        return mix(mix(borderTap${unit}(p,size,level),borderTap${unit}(p+vec2(1,0),size,level),f.x),
          mix(borderTap${unit}(p+vec2(0,1),size,level),borderTap${unit}(p+vec2(1,1),size,level),f.x),f.y);
      }
      vec4 borderSample${unit}(vec2 uv) {
        if (uBorderExtent${unit}.z!=4.0 && uBorderExtent${unit}.w!=4.0)
          return texture2D(${sampler},uv);
        vec2 dx=dFdx(uv*uBorderExtent${unit}.xy),dy=dFdy(uv*uBorderExtent${unit}.xy);
        float lod=0.5*log2(max(max(dot(dx,dx),dot(dy,dy)),1e-30));
        float minFilter=uBorderFilter${unit}.x, magFilter=uBorderFilter${unit}.y;
        float threshold=(magFilter==1.0 && (minFilter==2.0 || minFilter==4.0))?0.5:0.0;
        if (lod<=threshold) return borderLevel${unit}(uv,0.0,magFilter);
        float linearFilter=mod(minFilter,2.0);
        if (minFilter<2.0) return borderLevel${unit}(uv,0.0,linearFilter);
        lod=clamp(lod,0.0,uBorderFilter${unit}.z);
        if (minFilter<4.0) return borderLevel${unit}(uv,max(0.0,ceil(lod+0.5)-1.0),linearFilter);
        float lo=floor(lod),hi=min(lo+1.0,uBorderFilter${unit}.z);
        return mix(borderLevel${unit}(uv,lo,linearFilter),borderLevel${unit}(uv,hi,linearFilter),fract(lod));
      }`;
    }
    return '#extension GL_OES_standard_derivatives : require\n#extension GL_EXT_shader_texture_lod : require\n'
      + source.replace('void main() {', helpers + '\nvoid main() {');
  }

  class FixedFunctionGL {
    constructor(backend) {
      this.backend = backend;
      this.gl = backend.gl;
      this.program = backend.createProgram(VERTEX_SHADER, FRAGMENT_SHADER,
        ['aPosition', 'aColor', 'aTexCoord', 'aNormal', 'aTexCoord1'],
        ['uModelView', 'uProjection', 'uTextureMatrix', 'uTextureMatrix1', 'uPointSize',
          'uTexture', 'uTextureEnabled', 'uTextureMode',
          'uTexture1', 'uTexture1Enabled', 'uTexture1Mode', 'uAlphaEnabled',
          'uAlphaFunc', 'uAlphaRef', 'uLightingEnabled', 'uColorMaterialEnabled',
          'uGlobalAmbient', 'uLightEnabledA', 'uLightEnabledB',
          'uLightPosition[0]', 'uLightAmbient[0]', 'uLightDiffuse[0]', 'uLightSpecular[0]',
          'uMaterialAmbient', 'uMaterialDiffuse', 'uMaterialSpecular',
          'uMaterialEmission', 'uMaterialShininess', 'uFogEnabled', 'uFogMode',
          'uFogColor', 'uFogDensity', 'uFogStart', 'uFogEnd', 'uSphereMapEnabled']);
      this.standardProgram = this.program;
      this.borderProgram = null;
      this.vertexBuffer = backend.createBuffer();
      this.indexBuffer = backend.createBuffer();
      this.matrixMode = C.MODELVIEW;
      this.matrices = {
        [C.MODELVIEW]: [identity()], [C.PROJECTION]: [identity()], [C.TEXTURE]: [identity()],
      };
      // ARB_multitexture: the texture matrix stack, the texture binding, the
      // GL_TEXTURE_2D enable and the texture environment are all per-unit and
      // selected by glActiveTextureARB. Unit 0's matrix stack stays the object
      // in `matrices` so single-unit callers are unchanged.
      this.activeTexture = 0;
      this.textureMatrices = [this.matrices[C.TEXTURE], [identity()]];
      this.textures = new Map();
      this.boundTextureNames = [0, 0];
      this.textureUnitEnabled = [false, false];
      this.nextTextureName = 1;
      // Desktop GL texture name zero is a real default object whose parameters
      // and image may be changed. WebGL's null binding is not mutable, so give
      // the GL1 frontend an owned backing texture for that default object.
      this.defaultTexture = backend.createTexture();
      this.textureState = new Map();
      this.enabled = new Set();
      this.clearColor = [0, 0, 0, 0];
      this.clearDepth = 1;
      this.alphaFunc = 0x0207;
      this.alphaRef = 0;
      this.textureModes = [C.MODULATE, C.MODULATE];
      this.pointSize = 1;
      this.unpackAlignment = 4;
      this.depthRangeReversed = false;
      this.lastError = C.NO_ERROR;
      this.globalAmbient = new Float32Array([0.2, 0.2, 0.2, 1]);
      this.lights = Array.from({ length: 8 }, (_unused, index) => ({
        position: new Float32Array([0, 0, 1, 0]),
        ambient: new Float32Array([0, 0, 0, 1]),
        diffuse: new Float32Array(index === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
        specular: new Float32Array(index === 0 ? [1, 1, 1, 1] : [0, 0, 0, 1]),
      }));
      this.material = {
        ambient: new Float32Array([0.2, 0.2, 0.2, 1]),
        diffuse: new Float32Array([0.8, 0.8, 0.8, 1]),
        specular: new Float32Array([0, 0, 0, 1]),
        emission: new Float32Array([0, 0, 0, 1]),
        shininess: 0,
      };
      this.fog = { mode: C.EXP, density: 1, start: 0, end: 1,
        color: new Float32Array([0, 0, 0, 0]) };
      this.texGenMode = { [C.S]: 0x2400, [C.T]: 0x2400 };
      this.uniformDirty = new Set([
        'uModelView', 'uProjection', 'uTextureMatrix', 'uTextureMatrix1', 'uPointSize',
        'uTexture', 'uTextureEnabled', 'uTextureMode',
        'uTexture1', 'uTexture1Enabled', 'uTexture1Mode', 'uAlphaEnabled',
        'uAlphaFunc', 'uAlphaRef', 'uLightingEnabled', 'uColorMaterialEnabled',
        'uGlobalAmbient', 'uLightEnabledA', 'uLightEnabledB',
        'uLightPosition[0]', 'uLightAmbient[0]', 'uLightDiffuse[0]', 'uLightSpecular[0]',
        'uMaterialAmbient', 'uMaterialDiffuse', 'uMaterialSpecular',
        'uMaterialEmission', 'uMaterialShininess', 'uFogEnabled', 'uFogMode',
        'uFogColor', 'uFogDensity', 'uFogStart', 'uFogEnd', 'uSphereMapEnabled',
      ]);
      this.attributes = [
        { name: 'aPosition', size: 3, offset: 0 },
        { name: 'aColor', size: 4, offset: 12 },
        { name: 'aTexCoord', size: 2, offset: 28 },
        { name: 'aNormal', size: 3, offset: 36 },
        { name: 'aTexCoord1', size: 2, offset: 48 },
      ];
      this.pendingDraw = null;
      this.attribStack = [];
      // Some GL backends refuse any depth range but the default. @node-3d/webgl
      // rejects even a valid glDepthRange(0,0.5) with GL_INVALID_OPERATION and
      // silently leaves the range at [0,1]. That is fatal to GoldSrc's
      // gl_ztrick, which never clears depth and instead alternates
      // LEQUAL+[0,0.5] with GEQUAL+[1,0.5] so each frame's values always beat
      // the previous frame's. With the range ignored both phases write the full
      // range and fight each other's leftovers, so BOTH render partially -- a
      // stable half-drawn scene rather than the alternating good/bad frame that
      // a mere missing depth clear would give.
      // Probe once and, when the range does not take, fold it into the
      // projection instead (see _applyUniforms).
      this.depthRangeNear = 0;
      this.depthRangeFar = 1;
      this.depthRangeEmulated = this._probeDepthRange();
    }

    // True when the backend will not honour a non-default depth range.
    _probeDepthRange() {
      const gl = this.gl;
      if (!gl || typeof gl.depthRange !== 'function' || typeof gl.getParameter !== 'function') return false;
      try {
        while (gl.getError && gl.getError() !== gl.NO_ERROR) { /* drain */ }
        gl.depthRange(0, 0.5);
        const got = gl.getParameter(gl.DEPTH_RANGE);
        const ok = got && Math.abs(got[0] - 0) < 1e-6 && Math.abs(got[1] - 0.5) < 1e-6;
        gl.depthRange(0, 1);
        while (gl.getError && gl.getError() !== gl.NO_ERROR) { /* drain */ }
        if (!ok) {
          console.log('[gl] backend ignores glDepthRange; folding the depth range'
            + ' into the projection matrix instead');
        }
        return !ok;
      } catch (_) { return false; }
    }

    _stack() {
      return this.matrixMode === C.TEXTURE
        ? this.textureMatrices[this.activeTexture] : this.matrices[this.matrixMode];
    }
    _matrix() { const s = this._stack(); return s[s.length - 1]; }
    _matrixUniform() {
      return this.matrixMode === C.MODELVIEW ? 'uModelView'
        : this.matrixMode === C.PROJECTION ? 'uProjection'
          : this.activeTexture ? 'uTextureMatrix1' : 'uTextureMatrix';
    }
    _replaceMatrix(value) {
      const s = this._stack();
      s[s.length - 1] = new Float32Array(value);
      this.uniformDirty.add(this._matrixUniform());
    }
    _multMatrix(value) { this._replaceMatrix(multiply(this._matrix(), value)); }

    enqueuePacked(mode, vertices) {
      if (!vertices.length) return;
      stats.enqueued++;
      if (this.pendingDraw && this.pendingDraw.mode !== (mode | 0)) this.flushPendingDraw();
      if (!this.pendingDraw) this.pendingDraw = { mode: mode | 0, chunks: [], floats: 0 };
      this.pendingDraw.chunks.push(vertices);
      this.pendingDraw.floats += vertices.length;
    }

    flushPendingDraw() {
      const pending = this.pendingDraw;
      if (!pending) return;
      this.pendingDraw = null;
      let vertices = pending.chunks[0];
      if (pending.chunks.length > 1) {
        vertices = new Float32Array(pending.floats);
        let offset = 0;
        for (const chunk of pending.chunks) {
          vertices.set(chunk, offset);
          offset += chunk.length;
        }
      }
      this._drawGeometry({ mode: pending.mode, vertices });
    }

    _applyUniforms() {
      if (!this.uniformDirty.size) return;
      let projection = stackTop(this.matrices[C.PROJECTION]);
      if (this.depthRangeEmulated) {
        const n = this.depthRangeNear, f = this.depthRangeFar;
        if (n !== 0 || f !== 1) {
          // Window depth is d = ((f-n)/2)*z_ndc + (n+f)/2. The driver is stuck
          // at [0,1], i.e. d = 0.5*z' + 0.5, so pre-transform clip z:
          //   z' = (f-n)*z + (n+f-1)*w
          // which reproduces d exactly, and handles f < n (the reversed case)
          // with no separate negation. z' stays inside [-1,1] for any
          // 0<=n,f<=1, so nothing is clipped that would not have been.
          projection = new Float32Array(projection);
          const scale = f - n, bias = n + f - 1;
          for (const row2 of [2, 6, 10, 14]) {
            projection[row2] = scale * projection[row2] + bias * projection[row2 + 1];
          }
        }
      } else if (this.depthRangeReversed) {
        projection = new Float32Array(projection);
        // Desktop OpenGL permits glDepthRange(near > far), which GoldSrc uses
        // for its z-trick. WebGL rejects that ordering. Negating clip-space Z
        // and submitting the sorted range is algebraically identical.
        for (const index of [2, 6, 10, 14]) projection[index] = -projection[index];
      }
      const values = {
        uModelView: ['matrix4', stackTop(this.matrices[C.MODELVIEW])],
        uProjection: ['matrix4', projection],
        uTextureMatrix: ['matrix4', stackTop(this.textureMatrices[0])],
        uTextureMatrix1: ['matrix4', stackTop(this.textureMatrices[1])],
        uPointSize: ['1f', this.pointSize],
        uTexture: ['1i', 0],
        uTextureEnabled: ['1i', this.textureUnitEnabled[0] ? 1 : 0],
        uTextureMode: ['1i', this.textureModes[0] === C.REPLACE ? 1 : 0],
        uTexture1: ['1i', 1],
        uTexture1Enabled: ['1i', this.textureUnitEnabled[1] ? 1 : 0],
        uTexture1Mode: ['1i', this.textureModes[1] === C.REPLACE ? 1 : 0],
        uAlphaEnabled: ['1i', this.enabled.has(C.ALPHA_TEST) ? 1 : 0],
        uAlphaFunc: ['1i', Math.max(0, Math.min(7, this.alphaFunc - 0x0200))],
        uAlphaRef: ['1f', this.alphaRef],
        uLightingEnabled: ['1i', this.enabled.has(C.LIGHTING) ? 1 : 0],
        uColorMaterialEnabled: ['1i', this.enabled.has(C.COLOR_MATERIAL) ? 1 : 0],
        uGlobalAmbient: ['4f', this.globalAmbient],
        uLightEnabledA: ['4f', new Float32Array([0, 1, 2, 3].map(i => this.enabled.has(C.LIGHT0 + i) ? 1 : 0))],
        uLightEnabledB: ['4f', new Float32Array([4, 5, 6, 7].map(i => this.enabled.has(C.LIGHT0 + i) ? 1 : 0))],
        'uLightPosition[0]': ['4f', new Float32Array(this.lights.flatMap(light => Array.from(light.position)))],
        'uLightAmbient[0]': ['4f', new Float32Array(this.lights.flatMap(light => Array.from(light.ambient)))],
        'uLightDiffuse[0]': ['4f', new Float32Array(this.lights.flatMap(light => Array.from(light.diffuse)))],
        'uLightSpecular[0]': ['4f', new Float32Array(this.lights.flatMap(light => Array.from(light.specular)))],
        uMaterialAmbient: ['4f', this.material.ambient],
        uMaterialDiffuse: ['4f', this.material.diffuse],
        uMaterialSpecular: ['4f', this.material.specular],
        uMaterialEmission: ['4f', this.material.emission],
        uMaterialShininess: ['1f', this.material.shininess],
        uFogEnabled: ['1i', this.enabled.has(C.FOG) ? 1 : 0],
        uFogMode: ['1i', this.fog.mode === C.LINEAR ? 0 : this.fog.mode === C.EXP ? 1 : 2],
        uFogColor: ['4f', this.fog.color],
        uFogDensity: ['1f', this.fog.density],
        uFogStart: ['1f', this.fog.start],
        uFogEnd: ['1f', this.fog.end],
        uSphereMapEnabled: ['1i', this.enabled.has(C.TEXTURE_GEN_S)
          && this.enabled.has(C.TEXTURE_GEN_T)
          && this.texGenMode[C.S] === C.SPHERE_MAP && this.texGenMode[C.T] === C.SPHERE_MAP ? 1 : 0],
      };
      for (const name of this.uniformDirty) {
        const entry = values[name];
        this.backend.setUniform(this.program, name, entry[0], entry[1]);
      }
      this.uniformDirty.clear();
    }

    setDepthRange(nearValue, farValue) {
      this.flushPendingDraw();
      if (this.depthRangeEmulated) {
        // The driver stays at [0,1]; the requested range is applied to clip
        // space in _applyUniforms, so only the uniform has to be invalidated.
        if (this.depthRangeNear !== nearValue || this.depthRangeFar !== farValue) {
          this.depthRangeNear = nearValue;
          this.depthRangeFar = farValue;
          this.uniformDirty.add('uProjection');
        }
        return;
      }
      const reversed = nearValue > farValue;
      if (reversed !== this.depthRangeReversed) {
        this.depthRangeReversed = reversed;
        this.uniformDirty.add('uProjection');
      }
      this.backend.setDepthRange(
        reversed ? farValue : nearValue,
        reversed ? nearValue : farValue);
    }

    _drawGeometry(geometry) {
      if (!geometry.vertices.length) return;
      stats.draws++;
      stats.drawVertices += geometry.vertices.length / 14;
      if (this.onBeforeDraw) this.onBeforeDraw();
      const gl = this.gl;
      this.backend.updateBuffer(this.vertexBuffer, gl.ARRAY_BUFFER,
        geometry.vertices, gl.STREAM_DRAW);
      const states = [this._textureState(this._boundTexture(0)), this._textureState(this._boundTexture(1))];
      const needsBorder = this.backend.software !== true && states.some((s, unit) => this.textureUnitEnabled[unit]
        && (s.wrapS === C.CLAMP || s.wrapT === C.CLAMP));
      if (needsBorder && !this.borderProgram) {
        if (this.backend.version !== 2 && (!gl.getExtension
          || !gl.getExtension('OES_standard_derivatives') || !gl.getExtension('EXT_shader_texture_lod')))
          throw new Error('Legacy GL_CLAMP border sampling requires derivatives and explicit texture LOD');
        this.borderProgram = this.backend.createProgram(VERTEX_SHADER, borderFragmentShader(),
          Object.keys(this.standardProgram.attributes), [...Object.keys(this.standardProgram.uniforms),
            ...[0, 1].flatMap(u => [`uBorderExtent${u}`, `uBorderFilter${u}`, `uBorderColor${u}`])]);
      }
      const program = needsBorder ? this.borderProgram : this.standardProgram;
      if (this.program !== program) {
        this.program = program;
        for (const name of Object.keys(this.standardProgram.uniforms)) this.uniformDirty.add(name);
      }
      this.backend.useProgram(this.program);
      this._applyUniforms();
      if (needsBorder) for (const unit of [0, 1]) {
        const s=states[unit], level=s.levels.get(0) || {width:1,height:1,internalFormat:C.RGBA};
        const mode=v=>v===C.REPEAT?1:v===C.MIRRORED_REPEAT?2:v===C.CLAMP?4:3;
        const filter=v=>v===C.NEAREST?0:v===C.LINEAR?1:v-0x2700+2;
        const color=Array.from(s.border);
        if (level.internalFormat===3 || level.internalFormat===C.RGB) color[3]=1;
        this.backend.setUniform(this.program,`uBorderExtent${unit}`,'4f',
          [level.width,level.height,mode(s.wrapS),mode(s.wrapT)]);
        this.backend.setUniform(this.program,`uBorderFilter${unit}`,'4f',
          [filter(s.minFilter),filter(s.magFilter),Math.floor(Math.log2(Math.max(level.width,level.height))),0]);
        this.backend.setUniform(this.program,`uBorderColor${unit}`,'4f',color);
        this.backend.setUniform(this.program,unit?'uTexture1Enabled':'uTextureEnabled','1i',
          this.textureUnitEnabled[unit] && this._textureComplete(s) ? 1 : 0);
      }
      this.backend.bindTexture(this._boundTexture(0), 0);
      this.backend.bindTexture(this._boundTexture(1), 1);
      this.backend.draw({
        program: this.program, vertexBuffer: this.vertexBuffer,
        mode: geometry.mode, count: geometry.vertices.length / 14, stride: 56,
        attributes: this.attributes,
      });
    }

    setEnabled(capability, value) {
      const gl = this.gl;
      // GL_TEXTURE_2D belongs to the active texture unit, not to the context.
      if (capability === C.TEXTURE_2D) {
        const unit = this.activeTexture;
        if (this.textureUnitEnabled[unit] !== !!value) {
          this.textureUnitEnabled[unit] = !!value;
          this.uniformDirty.add(unit ? 'uTexture1Enabled' : 'uTextureEnabled');
        }
        if (value) this.backend.bindTexture(this._boundTexture(unit), unit);
        return gl;
      }
      const changed = this.enabled.has(capability) !== !!value;
      if (value) this.enabled.add(capability); else this.enabled.delete(capability);
      if ([C.BLEND, C.DEPTH_TEST, C.CULL_FACE, C.SCISSOR_TEST,
        C.POLYGON_OFFSET_FILL].includes(capability)) {
        this.backend.setCapability(capability, value);
      }
      // ALPHA_TEST is shader state, not a WebGL capability.
      if (changed && capability === C.ALPHA_TEST) this.uniformDirty.add('uAlphaEnabled');
      if (changed && capability === C.LIGHTING) this.uniformDirty.add('uLightingEnabled');
      if (changed && capability === C.COLOR_MATERIAL) this.uniformDirty.add('uColorMaterialEnabled');
      if (changed && capability === C.FOG) this.uniformDirty.add('uFogEnabled');
      if (changed && (capability === C.TEXTURE_GEN_S || capability === C.TEXTURE_GEN_T)) {
        this.uniformDirty.add('uSphereMapEnabled');
      }
      if (changed && capability >= C.LIGHT0 && capability <= C.LIGHT7) {
        this.uniformDirty.add(capability < C.LIGHT0 + 4 ? 'uLightEnabledA' : 'uLightEnabledB');
      }
      return gl;
    }

    setActiveTexture(target) {
      const unit = ((target >>> 0) - 0x84C0) >>> 0;
      if (unit < this.boundTextureNames.length) this.activeTexture = unit;
    }

    setLight(light, pname, values) {
      const index = (light >>> 0) - C.LIGHT0;
      if (index < 0 || index >= this.lights.length) return;
      const target = this.lights[index];
      if (pname === C.POSITION) target.position = transform4(stackTop(this.matrices[C.MODELVIEW]), values);
      else if (pname === C.AMBIENT) target.ambient = new Float32Array(values);
      else if (pname === C.DIFFUSE) target.diffuse = new Float32Array(values);
      else if (pname === C.SPECULAR) target.specular = new Float32Array(values);
      const uniform = pname === C.POSITION ? 'uLightPosition[0]'
        : pname === C.AMBIENT ? 'uLightAmbient[0]'
          : pname === C.DIFFUSE ? 'uLightDiffuse[0]' : 'uLightSpecular[0]';
      this.uniformDirty.add(uniform);
    }

    setMaterial(pname, values) {
      if (pname === C.AMBIENT || pname === C.AMBIENT_AND_DIFFUSE) this.material.ambient = new Float32Array(values);
      if (pname === C.DIFFUSE || pname === C.AMBIENT_AND_DIFFUSE) this.material.diffuse = new Float32Array(values);
      if (pname === C.SPECULAR) this.material.specular = new Float32Array(values);
      if (pname === C.EMISSION) this.material.emission = new Float32Array(values);
      if (pname === C.SHININESS) this.material.shininess = Math.max(0, Math.min(128, +values[0]));
      if (pname === C.AMBIENT || pname === C.AMBIENT_AND_DIFFUSE) this.uniformDirty.add('uMaterialAmbient');
      if (pname === C.DIFFUSE || pname === C.AMBIENT_AND_DIFFUSE) this.uniformDirty.add('uMaterialDiffuse');
      if (pname === C.SPECULAR) this.uniformDirty.add('uMaterialSpecular');
      if (pname === C.EMISSION) this.uniformDirty.add('uMaterialEmission');
      if (pname === C.SHININESS) this.uniformDirty.add('uMaterialShininess');
    }

    setFog(pname, values) {
      if (pname === C.FOG_MODE) this.fog.mode = values[0] | 0;
      else if (pname === C.FOG_DENSITY) this.fog.density = Math.max(0, +values[0]);
      else if (pname === C.FOG_START) this.fog.start = +values[0];
      else if (pname === C.FOG_END) this.fog.end = +values[0];
      else if (pname === C.FOG_COLOR) this.fog.color = new Float32Array(values);
      const uniform = pname === C.FOG_MODE ? 'uFogMode'
        : pname === C.FOG_DENSITY ? 'uFogDensity'
          : pname === C.FOG_START ? 'uFogStart'
            : pname === C.FOG_END ? 'uFogEnd' : 'uFogColor';
      this.uniformDirty.add(uniform);
    }

    setTexGen(coord, pname, value) {
      if ((coord === C.S || coord === C.T) && pname === C.TEXTURE_GEN_MODE) {
        this.texGenMode[coord] = value | 0;
        this.uniformDirty.add('uSphereMapEnabled');
      }
    }

    pushAttrib(mask) {
      this.attribStack.push({
        mask: mask >>> 0, enabled: new Set(this.enabled), alphaFunc: this.alphaFunc,
        alphaRef: this.alphaRef, textureModes: this.textureModes.slice(),
        pointSize: this.pointSize,
        boundTextureNames: this.boundTextureNames.slice(),
        textureUnitEnabled: this.textureUnitEnabled.slice(),
        activeTexture: this.activeTexture, unpackAlignment: this.unpackAlignment,
        globalAmbient: new Float32Array(this.globalAmbient),
        material: Object.fromEntries(Object.entries(this.material).map(([key, value]) =>
          [key, value instanceof Float32Array ? new Float32Array(value) : value])),
      });
    }

    popAttrib() {
      const saved = this.attribStack.pop();
      if (!saved) return;
      const oldEnabled = this.enabled;
      this.enabled = saved.enabled;
      for (const capability of [C.BLEND, C.DEPTH_TEST, C.CULL_FACE, C.SCISSOR_TEST,
        C.POLYGON_OFFSET_FILL]) {
        if (oldEnabled.has(capability) !== this.enabled.has(capability)) {
          this.backend.setCapability(capability, this.enabled.has(capability));
        }
      }
      this.alphaFunc = saved.alphaFunc; this.alphaRef = saved.alphaRef;
      this.textureModes = saved.textureModes; this.pointSize = saved.pointSize;
      this.boundTextureNames = saved.boundTextureNames;
      this.textureUnitEnabled = saved.textureUnitEnabled;
      this.activeTexture = saved.activeTexture;
      this.unpackAlignment = saved.unpackAlignment;
      this.globalAmbient = saved.globalAmbient; this.material = saved.material;
      for (const name of ['uPointSize', 'uTextureEnabled', 'uTextureMode',
        'uTexture1Enabled', 'uTexture1Mode', 'uAlphaEnabled',
        'uAlphaFunc', 'uAlphaRef', 'uLightingEnabled', 'uColorMaterialEnabled',
        'uGlobalAmbient', 'uLightEnabledA', 'uLightEnabledB', 'uMaterialAmbient',
        'uMaterialDiffuse', 'uMaterialSpecular', 'uMaterialEmission', 'uMaterialShininess']) {
        this.uniformDirty.add(name);
      }
      this.backend.bindTexture(this._boundTexture(0), 0);
      this.backend.bindTexture(this._boundTexture(1), 1);
    }

    setPointSize(value) {
      value = Math.max(1, +value);
      if (this.pointSize !== value) {
        this.pointSize = value;
        this.uniformDirty.add('uPointSize');
      }
    }

    setAlphaFunc(func, ref) {
      if (this.alphaFunc !== (func >>> 0)) this.uniformDirty.add('uAlphaFunc');
      if (this.alphaRef !== +ref) this.uniformDirty.add('uAlphaRef');
      this.alphaFunc = func >>> 0;
      this.alphaRef = +ref;
    }

    setTextureMode(value) {
      value |= 0;
      const unit = this.activeTexture;
      if (this.textureModes[unit] !== value) {
        this.textureModes[unit] = value;
        this.uniformDirty.add(unit ? 'uTexture1Mode' : 'uTextureMode');
      }
    }

    _boundTexture(unit = this.activeTexture) {
      const name = this.boundTextureNames[unit];
      if (!name) return this.defaultTexture;
      let texture = this.textures.get(name);
      if (!texture) {
        texture = this.backend.createTexture();
        this.textures.set(name, texture);
        this.backend.setTextureParameter(texture, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST_MIPMAP_LINEAR);
        this.backend.setTextureParameter(texture, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.backend.setTextureParameter(texture, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.backend.setTextureParameter(texture, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
      }
      return texture;
    }

    bindTexture(name) {
      const unit = this.activeTexture;
      this.boundTextureNames[unit] = name >>> 0;
      this.backend.bindTexture(this._boundTexture(unit), unit);
    }
    deleteTextures(names) {
      for (const name of names) {
        const texture = this.textures.get(name >>> 0);
        if (texture) this.backend.deleteTexture(texture);
        if (texture) this.textureState.delete(texture);
        this.textures.delete(name >>> 0);
        for (let unit = 0; unit < this.boundTextureNames.length; unit++) {
          if ((name >>> 0) === this.boundTextureNames[unit]) this.boundTextureNames[unit] = 0;
        }
      }
    }
    genTextures(count) {
      const names = new Uint32Array(Math.max(0, count | 0));
      for (let i = 0; i < names.length; i++) {
        while (this.textures.has(this.nextTextureName)) this.nextTextureName++;
        names[i] = this.nextTextureName++;
      }
      return names;
    }

    _textureFormat(value) {
      if (value === C.RGB) return this.gl.RGB;
      if (value === C.ALPHA) return this.gl.ALPHA;
      if (value === C.LUMINANCE) return this.gl.LUMINANCE;
      return this.gl.RGBA;
    }

    _texturePixels(format, type, pixels) {
      if (format !== C.BGRA || type !== C.UNSIGNED_BYTE || !pixels) return pixels;
      const rgba = new Uint8Array(pixels.length);
      for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
        rgba[offset] = pixels[offset + 2];
        rgba[offset + 1] = pixels[offset + 1];
        rgba[offset + 2] = pixels[offset];
        rgba[offset + 3] = pixels[offset + 3];
      }
      return rgba;
    }

    texImage(level, internalFormat, width, height, border, format, type, pixels) {
      const mapped = this._textureFormat(format);
      this._textureState().levels.set(level,{width,height,internalFormat});
      this.backend.uploadTexture2D(this._boundTexture(), {
        level, internalFormat: mapped, width, height, border,
        format: mapped, type, pixels: this._texturePixels(format, type, pixels),
        alignment: this.unpackAlignment,
      });
    }
    texSubImage(level, x, y, width, height, format, type, pixels) {
      this.backend.updateTexture2D(this._boundTexture(), {
        level, x, y, width, height, format: this._textureFormat(format),
        type, pixels: this._texturePixels(format, type, pixels), alignment: this.unpackAlignment,
      });
    }
    build2DMipmaps(internalFormat, width, height, format, type, pixels) {
      this.texImage(0, internalFormat, width, height, 0, format, type, pixels);
      this.backend.generateMipmaps(this._boundTexture());
      const state=this._textureState();
      for (let level=1; width>1 || height>1; level++) {
        width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));
        state.levels.set(level,{width,height,internalFormat});
      }
    }
    _textureComplete(state) {
      const base=state.levels.get(0);
      if (!base || base.width<=0 || base.height<=0) return false;
      if (state.minFilter===C.NEAREST || state.minFilter===C.LINEAR) return true;
      let width=base.width,height=base.height;
      for (let level=1; width>1 || height>1; level++) {
        width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));
        const image=state.levels.get(level);
        if (!image || image.width!==width || image.height!==height
          || image.internalFormat!==base.internalFormat) return false;
      }
      return true;
    }
    _textureState(texture = this._boundTexture()) {
      let state = this.textureState.get(texture);
      if (!state) {
        state = {border: new Float32Array(4), wrapS: C.REPEAT, wrapT: C.REPEAT,
          magFilter: C.LINEAR, minFilter: 0x2702, priority: 1, levels: new Map()};
        this.textureState.set(texture, state);
      }
      return state;
    }

    _textureError(error) {
      if (!this.lastError) this.lastError = error;
      return false;
    }

    // This frontend helper is not guest API support until vector payload
    // copying and both renderers are connected. Keep the original float data
    // for queries; the rasterizer quantizes only when resolving a draw.
    texBorderColor(values, target = C.TEXTURE_2D) {
      if (target !== C.TEXTURE_2D) return this._textureError(C.INVALID_ENUM);
      if (!values || values.length !== 4) return this._textureError(C.INVALID_VALUE);
      this.flushPendingDraw();
      this._textureState().border.set(Array.from(values,
        value => Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value))));
      return true;
    }

    getTexParameter(pname, target = C.TEXTURE_2D) {
      if (target !== C.TEXTURE_2D) { this._textureError(C.INVALID_ENUM); return null; }
      const state = this._textureState();
      if (pname === C.TEXTURE_BORDER_COLOR) return new Float32Array(state.border);
      if (pname === C.TEXTURE_PRIORITY) return [state.priority];
      // Texture objects remain backed for their entire lifetime; the frontend
      // never evicts an object's image in response to residency hints.
      if (pname === C.TEXTURE_RESIDENT) return [1];
      const key = {[C.TEXTURE_MAG_FILTER]: 'magFilter', [C.TEXTURE_MIN_FILTER]: 'minFilter',
        [C.TEXTURE_WRAP_S]: 'wrapS', [C.TEXTURE_WRAP_T]: 'wrapT'}[pname];
      if (!key) { this._textureError(C.INVALID_ENUM); return null; }
      return [state[key]];
    }

    // glGetTexLevelParameter: the level's recorded size and internal format,
    // and per-component sizes of the backing store. Every image is held as
    // 8 bits per channel, so a component the internal format has is 8 bits
    // and one it lacks is 0. A level never specified reads as 0 (its width,
    // height and sizes) with internal format 1, as GL defines.
    getTexLevelParameter(target, level, pname) {
      if (target !== C.TEXTURE_2D) { this._textureError(C.INVALID_ENUM); return null; }
      if (level < 0 || level > 31) { this._textureError(C.INVALID_VALUE); return null; }
      const image = this._textureState().levels.get(level);
      const fmt = image ? image.internalFormat : 0;
      if (pname === 0x1000) return image ? image.width : 0;           // TEXTURE_WIDTH
      if (pname === 0x1001) return image ? image.height : 0;          // TEXTURE_HEIGHT
      if (pname === 0x1003) return image ? fmt : 1;                   // TEXTURE_INTERNAL_FORMAT
      if (pname === 0x1005) return 0;                                 // TEXTURE_BORDER
      // GL 1.1 internal formats by base format: the 1-4 component counts,
      // the unsized names, and the sized ranges.
      const base = f => (f === 1 || f === 0x1909 || (f >= 0x803F && f <= 0x8042)) ? 'luminance'
        : (f === 2 || f === 0x190A || (f >= 0x8043 && f <= 0x8048)) ? 'la'
        : (f === 0x1906 || (f >= 0x803B && f <= 0x803E)) ? 'alpha'
        : (f >= 0x8049 && f <= 0x804D) ? 'intensity'
        : (f === 3 || f === 0x1907 || f === 0x2A10 || (f >= 0x804F && f <= 0x8054)) ? 'rgb'
        : (f === 4 || f === 0x1908 || (f >= 0x8055 && f <= 0x805B)) ? 'rgba' : '';
      const has = channels => image && channels.includes(base(fmt)) ? 8 : 0;
      switch (pname) {
        case 0x805C: return has(['rgb', 'rgba']);                     // RED_SIZE
        case 0x805D: return has(['rgb', 'rgba']);                     // GREEN_SIZE
        case 0x805E: return has(['rgb', 'rgba']);                     // BLUE_SIZE
        case 0x805F: return has(['rgba', 'alpha', 'la']);             // ALPHA_SIZE
        case 0x8060: return has(['luminance', 'la']);                 // LUMINANCE_SIZE
        case 0x8061: return has(['intensity']);                       // INTENSITY_SIZE
      }
      this._textureError(C.INVALID_ENUM);
      return null;
    }

    texParameter(pname, value, target = C.TEXTURE_2D) {
      if (target !== C.TEXTURE_2D || pname === C.TEXTURE_BORDER_COLOR)
        return this._textureError(C.INVALID_ENUM);
      if (pname === C.TEXTURE_PRIORITY) {
        this._textureState().priority = Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
        return true;
      }
      const key = {[C.TEXTURE_MAG_FILTER]: 'magFilter', [C.TEXTURE_MIN_FILTER]: 'minFilter',
        [C.TEXTURE_WRAP_S]: 'wrapS', [C.TEXTURE_WRAP_T]: 'wrapT'}[pname];
      const valid = key === 'magFilter' ? [C.NEAREST, C.LINEAR]
        : key === 'minFilter' ? [C.NEAREST, C.LINEAR, 0x2700, 0x2701, 0x2702, 0x2703]
        : key ? [C.REPEAT, C.CLAMP, C.CLAMP_TO_EDGE, C.MIRRORED_REPEAT] : null;
      if (valid && !valid.includes(value)) return this._textureError(C.INVALID_ENUM);
      this.flushPendingDraw();
      const texture = this._boundTexture();
      if (key) this._textureState(texture)[key] = value;
      // WebGL's sampler must stay legal; shader border sampling will use the
      // original desktop wrap enum saved above instead of this hardware alias.
      this.backend.setTextureParameter(texture, pname,
        value === C.CLAMP ? C.CLAMP_TO_EDGE : value | 0);
      return true;
    }

    destroy() {
      this.flushPendingDraw();
      for (const texture of this.textures.values()) this.backend.deleteTexture(texture);
      this.backend.deleteTexture(this.defaultTexture);
      this.backend.destroy();
    }
  }

  // The GPU half of a context whose drawing happens in WAT
  // (src/09a8g-gl-raster.wat). FixedFunctionGL still runs over it, because its
  // JS state answers the guest's queries (glGetFloatv, glGetError...), but
  // every backend operation that would draw is a no-op here -- the pixels are
  // written by the WAT rasterizer into a DirectDraw surface, which is why
  // this needs no canvas and no WebGL and so works on any host.
  //
  // Only the sixteen WebGL constants FixedFunctionGL actually reads from
  // `backend.gl` are defined, at their GL values; a method nobody listed
  // resolves to a no-op through the Proxy, so a frontend change that starts
  // calling a new backend method keeps working instead of throwing.
  const SOFTWARE_GL_CONSTANTS = Object.freeze({
    NO_ERROR: 0, ALPHA: 0x1906, RGB: 0x1907, RGBA: 0x1908, LUMINANCE: 0x1909,
    REPEAT: 0x2901, LINEAR: 0x2601, NEAREST_MIPMAP_LINEAR: 0x2702,
    TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    MAX_TEXTURE_SIZE: 0x0D33, DEPTH_RANGE: 0x0B70,
    ARRAY_BUFFER: 0x8892, STREAM_DRAW: 0x88E0,
  });
  function createSoftwareGLBackend(width, height) {
    const target = {
      software: true,
      gl: SOFTWARE_GL_CONSTANTS,
      canvas: { width: Math.max(1, width | 0), height: Math.max(1, height | 0) },
      software: true,
      createBuffer: () => ({}),
      createTexture: () => ({}),
      createProgram: () => ({}),
      getError: () => 0,
      getParameter: pname => (pname === SOFTWARE_GL_CONSTANTS.MAX_TEXTURE_SIZE ? 2048
        : pname === SOFTWARE_GL_CONSTANTS.DEPTH_RANGE ? new Float32Array([0, 1]) : 0),
      // present() returning null keeps the layer's existing canvas; the frame
      // is in the DirectDraw surface, not here.
      present: () => null,
    };
    return new Proxy(target, {
      get(obj, key) {
        if (key in obj) return obj[key];
        if (typeof key === 'symbol') return undefined;
        return () => undefined;
      },
    });
  }

  class OpenGLHostBridge {
    constructor(options) {
      this.options = options || {};
      this.contexts = new Map();
      this.nextContext = 1;
      this.current = 0;
      this.currentByOwner = new Map();
      this._owner = 0;
      this.lastError = 0;
      this._capture = null;
      this._memoryBuffer = null;
      this._memoryDataView = null;
      this._captureBuffer = null;
      this._captureDataView = null;
    }

    _exports() { return typeof this.options.exports === 'function' ? this.options.exports() : this.options.exports; }
    // The window's client size, which on Windows IS the GL drawable. Asked of
    // WAT, which owns the geometry, before the renderer's win.clientRect --
    // that is a cache refreshed only when the renderer recomputes it, and it
    // can be one resize behind: Warcraft III does SetWindowPos(800x600) and
    // then SW_SHOWMAXIMIZED on a 640x480 screen, the renderer caches the
    // client while WAT still holds 800x600, and WAT's own maximize recompute
    // (the one its WM_SIZE reports, 640x480) never reaches the cache.
    _clientSize(win) {
      const e = this._exports();
      if (win && e && typeof e.get_client_rect_r === 'function') {
        const w = (e.get_client_rect_r(win.hwnd) | 0) - (e.get_client_rect_l(win.hwnd) | 0);
        const h = (e.get_client_rect_b(win.hwnd) | 0) - (e.get_client_rect_t(win.hwnd) | 0);
        if (w > 0 && h > 0) return { w, h };
      }
      const client = (win && win.clientRect) || {};
      return { w: (client.w || (win && win.w) || 0) | 0, h: (client.h || (win && win.h) || 0) | 0 };
    }
    _memory() { return this.options.getMemory(); }
    _guestToWasm(pointer) {
      if (!pointer) return 0;
      const e = this._exports();
      // Pointer-bearing GL calls can reference the engine's sparse
      // VirtualAlloc arena (Quake world vertices do). Keep address-space
      // policy in the emulator and consume its canonical translator here.
      return MemUtils.guestToWasm(pointer, e, this._memory(), 0x400000);
    }
    _dv() {
      const memory = this._memory();
      if (memory !== this._memoryBuffer) {
        this._memoryBuffer = memory;
        this._memoryDataView = new DataView(memory);
      }
      return this._memoryDataView;
    }
    _stackDv() {
      if (!this._capture) return this._dv();
      if (this._capture.buffer !== this._captureBuffer) {
        this._captureBuffer = this._capture.buffer;
        this._captureDataView = new DataView(this._captureBuffer);
      }
      return this._captureDataView;
    }
    _stackBase(stack) { return this._capture ? this._capture.stackOffset : stack; }
    _u32(stack, index) { return this._stackDv().getUint32(this._stackBase(stack) + 4 + index * 4, true); }
    _f32(stack, index) { return this._stackDv().getFloat32(this._stackBase(stack) + 4 + index * 4, true); }
    _f64(stack, dwordIndex) { return this._stackDv().getFloat64(this._stackBase(stack) + 4 + dwordIndex * 4, true); }
    _pointerBytes(pointer, length) {
      const capture = this._capture;
      if (capture && (pointer >>> 0) === capture.pointerGuest && length <= capture.pointerLength) {
        if (!capture.pointerBorrowed && capture.pointerOffset) {
          return new Uint8Array(capture.buffer, capture.pointerOffset, length);
        }
      }
      return new Uint8Array(this._memory(), this._guestToWasm(pointer), length);
    }
    _floatArray(pointer, count) {
      const bytes = this._pointerBytes(pointer, count * 4);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = [];
      for (let i = 0; i < count; i++) out.push(dv.getFloat32(i * 4, true));
      return out;
    }
    _uintArray(pointer, count) {
      const bytes = this._pointerBytes(pointer, count * 4);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = [];
      for (let i = 0; i < count; i++) out.push(dv.getUint32(i * 4, true));
      return out;
    }
    _bytes(pointer, length) {
      if (!pointer || !length) return null;
      return this._pointerBytes(pointer, length);
    }
    // A client image as GL reads it: each row is width*channels bytes padded
    // to GL_UNPACK_ALIGNMENT (default 4), the last row unpadded. The upload
    // then runs with that same alignment, so WebGL reads exactly these bytes.
    // Slicing width*height*channels instead was short for any row that is not
    // a multiple of the alignment -- an RGB or LUMINANCE mip level of 2x2 --
    // and WebGL refused the upload ("ArrayBufferView not big enough"):
    // Anachronox's ref_gl drew a black page while the software renderer,
    // which reads guest memory itself, drew the title.
    _imageBytes(pointer, width, height, channels, alignment) {
      if (!pointer || !(width > 0) || !(height > 0)) return null;
      const row = width * channels;
      const align = alignment === 1 || alignment === 2 || alignment === 8 ? alignment : 4;
      const stride = Math.ceil(row / align) * align;
      return this._pointerBytes(pointer, stride * (height - 1) + row);
    }

    _renderer() { return this.options.renderer && (typeof this.options.renderer === 'function' ? this.options.renderer() : this.options.renderer); }
    // Where a drawable comes from. The browser has `document`; a headless Node
    // run passes `createCanvas` (lib/canvas-compat.js), whose canvases now hand
    // out a real WebGL context of their own -- see lib/headless-gl.js. Before
    // this, both call sites below just returned 0 without a document, which is
    // why every OpenGL guest was browser-only.
    _newCanvas(w, h) {
      const make = this.options.createCanvas;
      const canvas = typeof make === 'function' ? make(Math.max(1, w | 0), Math.max(1, h | 0))
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      if (!canvas) return null;
      canvas.width = Math.max(1, w | 0);
      canvas.height = Math.max(1, h | 0);
      return canvas;
    }
    // A GDI surface id arrives from WAT with the high bit set, meaning the GL
    // drawable is a DIB section selected into a memory DC (PFD_DRAW_TO_BITMAP)
    // rather than a window. See $handle_gpu_api in
    // src/09a8b-handlers-opengl.wat.
    _gdiSurface(id) {
      const get = this.options.getGdiSurface;
      if (typeof get !== 'function') return null;
      const presentation = get((id >>> 0) & 0x7FFFFFFF);
      return presentation && presentation.surface ? presentation : null;
    }
    // PFD_DRAW_TO_BITMAP. The drawable is the DIB, so there is no window layer
    // and no compositing question: the app reads these pixels back out with
    // BitBlt/StretchBlt whenever it likes, and what it must find there is the
    // last frame we presented. Everything else about the context is ordinary.
    createBitmapContext(target) {
      if (this.options.backend === 'software') return this._createSoftwareBitmapContext(target);
      const presentation = this._gdiSurface(target);
      if (!presentation) return 0;
      const surface = presentation.surface;
      const canvas = this._newCanvas(surface.width, surface.height);
      if (!canvas) return 0;
      let backend;
      try { backend = new GpuBackend.WebGLBackend(canvas); }
      catch (_) { return 0; }
      const handle = this.nextContext++;
      const presented = typeof backend.getPresentationSurface === 'function'
        ? backend.getPresentationSurface() : canvas;
      const layer = { canvas: presented, backend, writeSeq: 0, kind: 'gpu' };
      const context = {
        handle, hwnd: 0, win: null, layer, backend,
        surfaceId: (target >>> 0) & 0x7FFFFFFF,
        frontend: new FixedFunctionGL(backend),
        // The DIB *is* the colour buffer, and the application draws on it with
        // GDI between frames, so the drawable has to be re-read before the
        // guest's next primitive lands on it. See _seedFromBitmap.
        needsSeed: true,
      };
      context.frontend.onBeforeDraw = () => this._seedFromBitmap(context);
      this.contexts.set(handle, context);
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(this.contexts.size);
      }
      return handle;
    }
    createContext(hwnd) {
      if ((hwnd >>> 0) & 0x80000000) return this.createBitmapContext(hwnd);
      const renderer = this._renderer();
      const win = renderer && renderer.windows && renderer.windows[hwnd >>> 0];
      if (!win) return 0;
      const client = this._clientSize(win);
      if (this.options.backend === 'software') return this._createSoftwareContext(hwnd, win, client);
      const canvas = this._newCanvas(client.w || win.w || 640, client.h || win.h || 480);
      if (!canvas) return 0;
      let backend;
      try { backend = new GpuBackend.WebGLBackend(canvas); }
      catch (_) { return 0; }
      const handle = this.nextContext++;
      const presentation = typeof backend.getPresentationSurface === 'function'
        ? backend.getPresentationSurface() : canvas;
      const layer = { canvas: presentation, backend, writeSeq: 0, kind: 'gpu' };
      win._gpuFrameLayer = layer;
      // Renderer compatibility while its compositor still calls the historical
      // accelerated layer `_dxFrameLayer`. The owned object remains generic.
      win._dxFrameLayer = layer;
      this.contexts.set(handle, { handle, hwnd: hwnd >>> 0, win, layer, backend,
        frontend: new FixedFunctionGL(backend) });
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(this.contexts.size);
      }
      return handle;
    }

    // A context drawn by the WAT software rasterizer. No canvas and no WebGL,
    // so it works on any host; the layer is deliberately NOT attached to the
    // window, because there is nothing in it -- the frame lives in the
    // DirectDraw surface src/09a8g-gl-raster.wat draws into.
    _createSoftwareContext(hwnd, win, client) {
      const e = this._exports();
      // A render consumer mirrors JS state and publishes the producer's leased
      // front; it must not initialize producer-owned WAT regions. Actual queued
      // raster work installs private state through gl_sw_worker_draw instead.
      if (!this.options.softwareConsumer) {
        if (!e || typeof e.gl_sw_set_enabled !== 'function') return 0;
        e.gl_sw_set_enabled(1);
      }
      const w = client.w || win.w || 640, h = client.h || win.h || 480;
      // GL's default viewport is the drawable; an app that never calls
      // glViewport (ptct) draws through this.
      if (!this.options.softwareConsumer && typeof e.gl_sw_set_default_size === 'function') e.gl_sw_set_default_size(w, h);
      const backend = createSoftwareGLBackend(w, h);
      const handle = this.nextContext++;
      const layer = { canvas: null, backend, writeSeq: 0, kind: 'gpu-software' };
      this.contexts.set(handle, { handle, hwnd: hwnd >>> 0, win, layer, backend,
        software: true, frontend: new FixedFunctionGL(backend) });
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(this.contexts.size);
      }
      return handle;
    }

    // PFD_DRAW_TO_BITMAP on the software backend: WAT rasterizes straight into
    // the DIB's own bits, so there is no host surface to seed from or publish
    // to -- the app's next BitBlt simply finds the pixels there.
    _createSoftwareBitmapContext(target) {
      const e = this._exports();
      let width=1,height=1;
      if (this.options.softwareConsumer) {
        const presentation=this._gdiSurface(target);
        if(!presentation)return 0;
        width=presentation.surface.width;height=presentation.surface.height;
      } else {
        if (!e || typeof e.gl_sw_bind_bitmap !== 'function') return 0;
        e.gl_sw_set_enabled(1);
        if (!e.gl_sw_bind_bitmap((target >>> 0) & 0x7FFFFFFF)) return 0;
      }
      const backend = createSoftwareGLBackend(width, height);
      const handle = this.nextContext++;
      const layer = { canvas: null, backend, writeSeq: 0, kind: 'gpu-software' };
      this.contexts.set(handle, { handle, hwnd: 0, win: null, layer, backend,
        surfaceId:(target>>>0)&0x7fffffff, software: true, frontend: new FixedFunctionGL(backend) });
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(this.contexts.size);
      }
      return handle;
    }

    deleteContext(handle) {
      const context = this.contexts.get(handle >>> 0);
      if (!context) return 0;
      context.frontend.destroy();
      // A bitmap context has no window.
      if (context.win && context.win._gpuFrameLayer === context.layer) context.win._gpuFrameLayer = null;
      if (context.win && context.win._dxFrameLayer === context.layer) context.win._dxFrameLayer = null;
      this.contexts.delete(handle >>> 0);
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(this.contexts.size);
      }
      if (this.current === (handle >>> 0)) this.current = 0;
      for (const [owner, current] of this.currentByOwner) {
        if (current === (handle >>> 0)) this.currentByOwner.set(owner, 0);
      }
      return 1;
    }

    makeCurrent(handle) {
      const current = this._current();
      if (current && current.frontend.flushPendingDraw) current.frontend.flushPendingDraw();
      if (!handle) {
        this.currentByOwner.set(this._owner, 0);
        if (this._owner === 0) this.current = 0;
        if (typeof this.options.onContextCountChange === 'function') {
          this.options.onContextCountChange(0);
        }
        return 1;
      }
      if (!this.contexts.has(handle >>> 0)) return 0;
      this.currentByOwner.set(this._owner, handle >>> 0);
      if (this._owner === 0) this.current = handle >>> 0;
      if (typeof this.options.onContextCountChange === 'function') {
        this.options.onContextCountChange(1);
      }
      return 1;
    }
    _current() {
      const handle = this.currentByOwner.has(this._owner)
        ? this.currentByOwner.get(this._owner) : this.current;
      return this.contexts.get(handle);
    }
    present() {
      const context = this._current();
      if (!context) return 0;
      stats.presents++;
      return this._publishContext(context);
    }
    // On Windows the GL drawable IS the window's client area: resize the
    // window and the next frame is drawn at the new size, with no API call in
    // between saying so. Here the canvas was sized once, in createContext, and
    // then never again -- so an app that resizes its own window afterwards
    // draws into a surface the size it used to be.
    //
    // Warcraft III does exactly that, and it is not a corner case: its startup
    // sequence is ShowWindow ; ...first context... ; SW_MINIMIZE ; SW_MAXIMIZE ;
    // ...second context... (see docs/re-notes/warcraft3-demo.md). The maximize
    // takes the client area to the whole desktop, the game lays its menu out in
    // that space and calls glViewport(0,0,940,734), and we handed it an 800x600
    // canvas. A viewport larger than the drawable is not scaled -- it is
    // clipped -- so the picture was the corner of the menu the surface happened
    // to cover, and the buttons the game hit-tests at its own coordinates were
    // nowhere near the pixels a click landed on.
    _syncDrawableSize(context) {
      const win = context && context.win;
      const backend = context && context.backend;
      if (!backend || typeof backend.resetRenderTargets !== 'function') return;
      let width;
      let height;
      if (context.surfaceId) {
        // A bitmap context follows its DIB, not a window: SelectObject can put
        // a differently sized bitmap into the same memory DC.
        const presentation = this._gdiSurface(context.surfaceId);
        if (!presentation) return;
        width = Math.max(1, presentation.surface.width | 0);
        height = Math.max(1, presentation.surface.height | 0);
      } else {
        if (!win) return;
        const client = this._clientSize(win);
        width = Math.max(1, client.w);
        height = Math.max(1, client.h);
      }
      const canvas = backend.canvas;
      if (!canvas || (canvas.width === width && canvas.height === height)) return;
      // A failed reallocation keeps the old surface and its pixels rather than
      // taking the context down; the next frame tries again.
      try { backend.resetRenderTargets(width, height); }
      catch (_) { return; }
      if (typeof backend.getPresentationSurface === 'function') {
        const presentation = backend.getPresentationSurface();
        if (presentation) context.layer.canvas = presentation;
      }
    }
    // Copy the presented frame into the DIB the context was created on. The
    // canonical bits are the truth for a GDI surface — the derived canvas is a
    // cache a later flush overwrites — so this writes the surface, and
    // writeRgbaRect's markDirty republishes the canvas for us.
    _publishToBitmap(context) {
      const presentation = this._gdiSurface(context.surfaceId);
      if (!presentation) return 0;
      const surface = presentation.surface;
      if (typeof surface.writeRgbaRect !== 'function') return 0;
      const source = context.layer.canvas;
      if (!source || typeof source.getContext !== 'function') return 0;
      const ctx2d = source.getContext('2d');
      if (!ctx2d) return 0;
      const w = Math.min(source.width | 0, surface.width | 0);
      const h = Math.min(source.height | 0, surface.height | 0);
      if (w <= 0 || h <= 0) return 0;
      const pixels = ctx2d.getImageData(0, 0, w, h).data;
      surface.writeRgbaRect(0, 0, w, h, pixels);
      return 1;
    }
    // The other half of PFD_DRAW_TO_BITMAP. A WebGL drawable is a surface of
    // our own, so the DIB's pixels have to be copied *into* it before the guest
    // draws, exactly as a driver rendering straight into the bitmap would find
    // them. Without this every publish writes a full frame whose untouched
    // pixels are black, and everything the application drew on that same bitmap
    // with GDI — in SimGolf the trees, the golfers and their name plates, all
    // of which jgl.dll blits itself — is erased the moment the terrain is
    // flushed. Deferred to the first primitive after each present so a frame
    // the guest spends entirely in GDI costs nothing.
    _seedFromBitmap(context) {
      if (!context.needsSeed) return;
      context.needsSeed = false;
      const presentation = this._gdiSurface(context.surfaceId);
      if (!presentation) return;
      const surface = presentation.surface;
      const backend = context.backend;
      if (!surface || typeof surface.rgbaRect !== 'function'
          || typeof backend.seedColorBuffer !== 'function') return;
      const w = Math.min(backend.canvas.width | 0, surface.width | 0);
      const h = Math.min(backend.canvas.height | 0, surface.height | 0);
      if (w <= 0 || h <= 0) return;
      const seed = surface.rgbaRect(0, 0, w, h);
      backend.seedColorBuffer(seed, w, h);
    }
    _publishContext(context, deferRepaint) {
      if (!context || (context.handle !== undefined && !this.contexts.has(context.handle))) return 0;
      if (context.frontend.flushPendingDraw) context.frontend.flushPendingDraw();
      const presentation = context.backend.present();
      if (presentation) context.layer.canvas = presentation;
      context.layer.writeSeq++;
      if (typeof this.options.onPresent === 'function') {
        this.options.onPresent(context.layer);
      }
      // The software rasterizer's frame is already in its DirectDraw surface;
      // there is no GPU canvas to merge into the window, so WAT blits that
      // surface into the window's client area instead. It still follows the
      // window's client area, for the reason _syncDrawableSize gives; WAT
      // rebuilds its target at the next draw, so the frame just presented
      // stays on screen until then.
      if (context.software) {
        // onPresent above already published the leased front in consumer mode.
        // Calling gl_sw_present_window here would use another instance's globals
        // and route GDI through the renderer's intentionally inert host imports.
        if(this.options.softwareConsumer)return 1;
        const win = context.win;
        const e = win ? this._exports() : null;
        if (e && typeof e.gl_sw_present_window === 'function') e.gl_sw_present_window(context.hwnd);
        if (e && typeof e.gl_sw_set_default_size === 'function') {
          const client = this._clientSize(win);
          e.gl_sw_set_default_size(client.w, client.h);
        }
        return 1;
      }
      // PFD_DRAW_TO_BITMAP: the drawable is a DIB, so presenting means writing
      // the frame into that DIB's canonical bits. There is no window and no
      // compositing to do — the application will blit these pixels itself.
      if (context.surfaceId) {
        // needsSeed still set means nothing has been rasterized since the last
        // present, so our copy of the drawable is older than the bitmap the
        // application has been drawing on in the meantime. Writing it back
        // would undo that GDI, and there is nothing new in it to write.
        if (!context.needsSeed) this._publishToBitmap(context);
        this._syncDrawableSize(context);
        context.needsSeed = true;
        return 1;
      }
      const renderer = this._renderer();
      if (renderer) {
        // A single-buffered GL context shares the window's device context, so
        // the front buffer belongs *in* the window surface and the GDI the app
        // draws next belongs on top of it. Publishing it as a separate layer
        // the compositor paints last buried SimGolf's entire interface under
        // the terrain. This has to happen here, synchronously with the guest's
        // flush — deferring it to the repaint would put the frame back over
        // whatever the app drew in between.
        if (typeof renderer.mergeGpuLayerIntoBackCanvas === 'function') {
          renderer.mergeGpuLayerIntoBackCanvas(context.hwnd);
        }
        renderer.needsRepaint = true;
        if (!deferRepaint && typeof renderer.repaint === 'function') renderer.repaint();
      }
      // After the frame is on screen, not before it: resizing reallocates the
      // colour and depth attachments, so doing it mid-frame would throw away
      // what the guest had already drawn.
      this._syncDrawableSize(context);
      return 1;
    }
    flushFrontBuffer() {
      const context = this._current();
      if (!context) return 0;
      stats.frontFlushes++;
      if (typeof context.backend.flush === 'function') context.backend.flush();
      const raf = typeof globalThis !== 'undefined' && globalThis.requestAnimationFrame;
      if (typeof raf !== 'function') return this._publishContext(context);
      // Publish the frame now — the guest draws its GDI interface over this
      // surface on the next few instructions, and it has to land on top — but
      // coalesce the screen repaint to one animation frame, which is what
      // stopped intermediate terrain passes from flickering.
      const published = this._publishContext(context, true);
      if (!context.flushPresentPending) {
        context.flushPresentPending = true;
        raf(() => {
          context.flushPresentPending = false;
          const renderer = this._renderer();
          if (renderer && typeof renderer.repaint === 'function') renderer.repaint();
        });
      }
      return published;
    }

    call(opcode, stack, aux, capture) {
      // The two synthetic opcodes live at 0x10000/0x10001, far past CALLS, and
      // a plain range check drops them -- which is not a small omission: the
      // packed draw is where ALL the geometry goes, so a census without it
      // reads as "this app issues no vertices at all". They are folded onto
      // the two slots appended to `ops` for them.
      const slot = opcode === CommandStreamOps.PACKED_DRAW ? PACKED_DRAW_SLOT
        : opcode === CommandStreamOps.WAT_FLUSH ? WAT_FLUSH_SLOT : opcode;
      if (slot >= 0 && slot < stats.ops.length) stats.ops[slot]++;
      if (hooks.trace) hooks.trace(slot, opcode, aux, capture);
      const previous = this._capture;
      this._capture = capture || null;
      try { return this._call(opcode, stack, aux); }
      finally { this._capture = previous; }
    }

    replay(batch, owner) {
      if (!GLCommandStream) return 0;
      const previous = this._owner;
      this._owner = (owner || 0) | 0;
      try {
        return GLCommandStream.replay(batch,
          (opcode, aux, capture) => this.call(opcode, 0, aux, capture));
      } finally {
        for (const context of this.contexts.values()) {
          if (context.frontend.flushPendingDraw) context.frontend.flushPendingDraw();
        }
        this._owner = previous;
      }
    }

    _call(opcode, stack, aux) {
      if (GLCommandStream && opcode === GLCommandStream.PACKED_DRAW_OPCODE) {
        const context = this._current();
        if (!context || !context.frontend.enqueuePacked || !this._capture) return 0;
        if ((this._capture.pointerLength % 56) !== 0 || !this._capture.pointerOffset) {
          throw new RangeError('invalid packed GL vertex payload');
        }
        const vertices = new Float32Array(this._capture.buffer,
          this._capture.pointerOffset, this._capture.pointerLength / 4);
        context.frontend.enqueuePacked(aux | 0, vertices);
        return 0;
      }
      const name = CALLS[opcode | 0];
      if (!name) return 0;
      // Current color/texcoord/shade state and glBegin/glEnd vertices are
      // compiled into PACKED_DRAW_OPCODE by the native WAT encoder in both
      // cooperative and Worker modes. Seeing one here means a caller bypassed
      // the mandatory ordering/state layer.
      if (opcode === CALL_INDEX.glShadeModel
          || (opcode >= CALL_INDEX.glBegin && opcode <= CALL_INDEX.glVertex3fv)
          || opcode === CALL_INDEX.glColor4ub || opcode === CALL_INDEX.glColor3ubv
          || opcode === CALL_INDEX.glColor3ub
          || opcode === CALL_INDEX.glEnableClientState
          || opcode === CALL_INDEX.glDisableClientState
          || opcode === CALL_INDEX.glArrayElement
          || opcode === CALL_INDEX.glVertexPointer
          || opcode === CALL_INDEX.glNormalPointer
          || opcode === CALL_INDEX.glTexCoordPointer
          || opcode === CALL_INDEX.glColorPointer
          || opcode === CALL_INDEX.glDrawElements
          || opcode === CALL_INDEX.glDrawArrays
          || opcode === CALL_INDEX.glVertex2fv
          || opcode === CALL_INDEX.glTexCoord2fv
          || opcode === CALL_INDEX.glClientActiveTextureARB
          || opcode === CALL_INDEX.glMultiTexCoord2fARB
          || opcode === CALL_INDEX.glVertex2i) {
        throw new Error(`${name} must be compiled by the native WAT GL encoder`);
      }
      if (name.startsWith('wgl')) {
        const current = this._current();
        if (current && current.frontend.flushPendingDraw) current.frontend.flushPendingDraw();
      }
      if (name === 'wglCreateContext') return this.createContext(aux >>> 0);
      if (name === 'wglDeleteContext') return this.deleteContext(this._u32(stack, 0));
      if (name === 'wglMakeCurrent') return this.makeCurrent(this._u32(stack, 1));
      if (name === 'wglGetProcAddress') return 0;
      if (name === 'wglChoosePixelFormat' || name === 'wglSetPixelFormat') return 1;
      if (name === 'wglDescribePixelFormat') return 1;
      if (name === 'gpuPresent') return this.present();
      const context = this._current();
      if (!context) return 0;
      const f = context.frontend, gl = f.gl;
      if (f.flushPendingDraw) f.flushPendingDraw();
      switch (name) {
        case 'glAlphaFunc': f.setAlphaFunc(this._u32(stack, 0), this._f32(stack, 1)); break;
        case 'glBlendFunc': f.backend.setBlendFunc(this._u32(stack, 0), this._u32(stack, 1)); break;
        case 'glClear': f.backend.clear(f.clearColor, this._u32(stack, 0), f.clearDepth); break;
        case 'glClearDepth': f.clearDepth = Math.min(1, Math.max(0, this._f64(stack, 0))); break;
        case 'glClearColor': f.clearColor = [0, 1, 2, 3].map(i => this._f32(stack, i)); break;
        case 'glCullFace': f.backend.setCullFace(this._u32(stack, 0)); break;
        case 'glDepthFunc': f.backend.setDepthFunc(this._u32(stack, 0)); break;
        case 'glDepthMask': f.backend.setDepthMask(this._u32(stack, 0)); break;
        case 'glDepthRange': f.setDepthRange(this._f64(stack, 0), this._f64(stack, 2)); break;
        case 'glDisable': f.setEnabled(this._u32(stack, 0), false); break;
        case 'glDrawBuffer': break;
        case 'glEnable': f.setEnabled(this._u32(stack, 0), true); break;
        case 'glIsEnabled': return f.enabled.has(this._u32(stack, 0)) ? 1 : 0;
        case 'glColorMaterial': break;
        case 'glLightfv': f.setLight(this._u32(stack, 0), this._u32(stack, 1),
          this._floatArray(this._u32(stack, 2), 4)); break;
        case 'glMaterialfv': {
          const pname = this._u32(stack, 1);
          f.setMaterial(pname, this._floatArray(this._u32(stack, 2), pname === C.SHININESS ? 1 : 4));
          break;
        }
        case 'glLightModelfv': if (this._u32(stack, 0) === C.LIGHT_MODEL_AMBIENT) {
          f.globalAmbient = new Float32Array(this._floatArray(this._u32(stack, 1), 4));
          f.uniformDirty.add('uGlobalAmbient');
        } break;
        case 'glLightModeli': break;
        case 'glMaterialf': f.setMaterial(this._u32(stack, 1), [this._f32(stack, 2)]); break;
        case 'glMateriali': f.setMaterial(this._u32(stack, 1), [this._u32(stack, 2)]); break;
        case 'glLightf': break;
        case 'glPixelStorei': if (this._u32(stack, 0) === 0x0CF5) {
          const alignment = this._u32(stack, 1);
          if (alignment === 1 || alignment === 2 || alignment === 4 || alignment === 8) {
            f.unpackAlignment = alignment;
          }
        } break;
        case 'glGenTextures': {
          const count = this._u32(stack, 0);
          const names = f.genTextures(count);
          const wa = this._guestToWasm(this._u32(stack, 1));
          const dv = this._dv();
          for (let i = 0; i < names.length; i++) dv.setUint32(wa + i * 4, names[i], true);
          break;
        }
        case 'glHint': break;
        case 'glPushAttrib': f.pushAttrib(this._u32(stack, 0)); break;
        case 'glPopAttrib': f.popAttrib(); break;
        case 'glFogfv': {
          const pname = this._u32(stack, 0);
          f.setFog(pname, this._floatArray(this._u32(stack, 1), pname === C.FOG_COLOR ? 4 : 1));
          break;
        }
        case 'glFogf': f.setFog(this._u32(stack, 0), [this._f32(stack, 1)]); break;
        case 'glFogi': f.setFog(this._u32(stack, 0), [this._u32(stack, 1)]); break;
        case 'glFrontFace': f.backend.setFrontFace(this._u32(stack, 0)); break;
        // Any target but GL_TEXTURE_ENV is GL_INVALID_ENUM and changes nothing
        // (SimGolf asks for REPLACE on GL_TEXTURE_2D and must stay MODULATE).
        case 'glTexEnvi': if (this._u32(stack, 0) === C.TEXTURE_ENV && this._u32(stack, 1) === C.TEXTURE_ENV_MODE) {
          f.setTextureMode(this._u32(stack, 2));
        } break;
        case 'glTexGeni': f.setTexGen(this._u32(stack, 0), this._u32(stack, 1), this._u32(stack, 2)); break;
        case 'glTexGenf': f.setTexGen(this._u32(stack, 0), this._u32(stack, 1), Math.round(this._f32(stack, 2))); break;
        case 'glTexGenfv': f.setTexGen(this._u32(stack, 0), this._u32(stack, 1),
          Math.round(this._floatArray(this._u32(stack, 2), 1)[0])); break;
        case 'glFinish': f.backend.finish(); break;
        // A single-buffered desktop GL context presents its front buffer as
        // glFlush completes. WebGL draws into an offscreen canvas here, so a
        // flush must also publish that canvas to the window compositor.
        case 'glFlush': return this.flushFrontBuffer();
        case 'glGetError': {
          if (f.lastError) { const error=f.lastError; f.lastError=0; return error; }
          return f.backend.getError();
        }
        case 'glGetTexParameterfv': {
          const values=f.getTexParameter(this._u32(stack,1),this._u32(stack,0));
          if (values) {
            const dv=this._dv(),wa=this._guestToWasm(this._u32(stack,2));
            for(let i=0;i<values.length;i++)dv.setFloat32(wa+i*4,values[i],true);
          }
          break;
        }
        case 'glGetTexLevelParameteriv':
        case 'glGetTexLevelParameterfv': {
          const value=f.getTexLevelParameter(this._u32(stack,0),this._u32(stack,1),this._u32(stack,2));
          if (value!==null) {
            const dv=this._dv(),wa=this._guestToWasm(this._u32(stack,3));
            if (name==='glGetTexLevelParameterfv') dv.setFloat32(wa,value,true);
            else dv.setInt32(wa,value,true);
          }
          break;
        }
        case 'glTexParameterfv': {
          if (aux===0x0505) { f._textureError(aux); break; }
          const target=this._u32(stack,0),pname=this._u32(stack,1);
          if(target!==C.TEXTURE_2D || ![C.TEXTURE_BORDER_COLOR,C.TEXTURE_MAG_FILTER,
            C.TEXTURE_MIN_FILTER,C.TEXTURE_WRAP_S,C.TEXTURE_WRAP_T,C.TEXTURE_PRIORITY].includes(pname)) {
            f._textureError(C.INVALID_ENUM); break;
          }
          const values=this._floatArray(this._u32(stack,2),pname===C.TEXTURE_BORDER_COLOR?4:1);
          if(pname===C.TEXTURE_BORDER_COLOR)f.texBorderColor(values,target);
          else f.texParameter(pname,pname===C.TEXTURE_PRIORITY?values[0]:Math.round(values[0]),target);
          break;
        }
        case 'glGetFloatv': this._getFloatv(f, this._u32(stack, 0), this._u32(stack, 1)); break;
        case 'glGetString': return 0; // WAT returns stable guest strings.
        case 'glGetIntegerv': this._getIntegerv(f, this._u32(stack, 0), this._u32(stack, 1)); break;
        // One WebGL drawing buffer serves as both colour buffers, so selecting
        // FRONT or BACK reads the same surface. Record it so glGetIntegerv
        // reports back what the guest set, as glDrawBuffer's twin already does.
        case 'glReadBuffer': f.readBuffer = this._u32(stack, 0); break;
        case 'glPointSize': f.setPointSize(this._f32(stack, 0)); break;
        case 'glLineWidth': f.backend.setLineWidth(this._f32(stack, 0)); break;
        case 'glPolygonMode': break; // Filled rendering is the WebGL baseline.
        case 'glPolygonOffset': f.backend.setPolygonOffset(this._f32(stack, 0), this._f32(stack, 1)); break;
        case 'glReadPixels': this._readPixels(f, stack); break;
        case 'glScissor': f.backend.setScissor(this._u32(stack, 0), this._u32(stack, 1), this._u32(stack, 2), this._u32(stack, 3)); break;
        case 'glViewport': f.backend.setViewport(this._u32(stack, 0), this._u32(stack, 1), this._u32(stack, 2), this._u32(stack, 3)); break;
        case 'glFrustum': f._multMatrix(frustum(...[0, 2, 4, 6, 8, 10].map(i => this._f64(stack, i)))); break;
        case 'glLoadIdentity': f._replaceMatrix(identity()); break;
        case 'glLoadMatrixf': f._replaceMatrix(this._floatArray(this._u32(stack, 0), 16)); break;
        case 'glMultMatrixf': f._multMatrix(this._floatArray(this._u32(stack, 0), 16)); break;
        case 'glMatrixMode': if (f.matrices[this._u32(stack, 0)]) f.matrixMode = this._u32(stack, 0); break;
        case 'glOrtho': f._multMatrix(ortho(...[0, 2, 4, 6, 8, 10].map(i => this._f64(stack, i)))); break;
        case 'glPopMatrix': { const s = f._stack(); if (s.length > 1) { s.pop(); f.uniformDirty.add(f._matrixUniform()); } break; }
        case 'glPushMatrix': f._stack().push(new Float32Array(f._matrix())); break;
        case 'glRotatef': f._multMatrix(rotation(this._f32(stack, 0), this._f32(stack, 1), this._f32(stack, 2), this._f32(stack, 3))); break;
        case 'glRotated': f._multMatrix(rotation(this._f64(stack, 0), this._f64(stack, 2), this._f64(stack, 4), this._f64(stack, 6))); break;
        case 'glScalef': f._multMatrix(scale(this._f32(stack, 0), this._f32(stack, 1), this._f32(stack, 2))); break;
        case 'glTranslatef': f._multMatrix(translation(this._f32(stack, 0), this._f32(stack, 1), this._f32(stack, 2))); break;
        case 'gluPerspective': f._multMatrix(perspective(
          this._f64(stack, 0), this._f64(stack, 2),
          this._f64(stack, 4), this._f64(stack, 6))); break;
        case 'gluLookAt': f._multMatrix(lookAt(
          ...[0, 2, 4, 6, 8, 10, 12, 14, 16].map(i => this._f64(stack, i)))); break;
        case 'gluBuild2DMipmaps': {
          const width = this._u32(stack, 2), height = this._u32(stack, 3);
          const format = this._u32(stack, 4), type = this._u32(stack, 5);
          const channels = format === C.RGB ? 3 : format === C.ALPHA || format === C.LUMINANCE ? 1 : 4;
          f.build2DMipmaps(this._u32(stack, 1), width, height, format, type,
            this._imageBytes(this._u32(stack, 6), width, height, channels, f.unpackAlignment));
          return 0;
        }
        case 'gluBuild1DMipmaps': {
          const width = this._u32(stack, 2), format = this._u32(stack, 3);
          const type = this._u32(stack, 4);
          const channels = format === C.RGB ? 3 : format === C.ALPHA || format === C.LUMINANCE ? 1 : 4;
          f.build2DMipmaps(this._u32(stack, 1), width, 1, format, type,
            this._bytes(this._u32(stack, 5), width * channels));
          return 0;
        }
        case 'gluOrtho2D': f._multMatrix(ortho(
          this._f64(stack, 0), this._f64(stack, 2),
          this._f64(stack, 4), this._f64(stack, 6), -1, 1)); break;
        case 'glBindTexture': f.bindTexture(this._u32(stack, 1)); break;
        case 'glActiveTextureARB': f.setActiveTexture(this._u32(stack, 0)); break;
        case 'glDeleteTextures': f.deleteTextures(this._uintArray(this._u32(stack, 1), this._u32(stack, 0))); break;
        case 'glTexEnvf': if (this._u32(stack, 0) === C.TEXTURE_ENV && this._u32(stack, 1) === C.TEXTURE_ENV_MODE) f.setTextureMode(Math.round(this._f32(stack, 2))); break;
        case 'glTexImage2D': this._texImage(f, stack, false); break;
        case 'glTexParameterf': f.texParameter(this._u32(stack, 1), this._u32(stack,1)===C.TEXTURE_PRIORITY
          ?this._f32(stack,2):Math.round(this._f32(stack, 2)), this._u32(stack, 0)); break;
        case 'glTexParameteri': f.texParameter(this._u32(stack, 1), this._u32(stack, 2), this._u32(stack, 0)); break;
        case 'glTexSubImage2D': this._texImage(f, stack, true); break;
      }
      return 0;
    }

    _getFloatv(frontend, pname, pointer) {
      const values = pname === C.MODELVIEW_MATRIX ? stackTop(frontend.matrices[C.MODELVIEW])
        : pname === C.PROJECTION_MATRIX ? stackTop(frontend.matrices[C.PROJECTION])
          : pname === C.TEXTURE_MATRIX ? stackTop(frontend.matrices[C.TEXTURE])
            : [pname === C.MAX_TEXTURE_SIZE ? frontend.backend.getParameter(frontend.gl.MAX_TEXTURE_SIZE) : 0];
      const dv = this._dv(), wa = this._guestToWasm(pointer);
      for (let i = 0; i < values.length; i++) dv.setFloat32(wa + i * 4, values[i], true);
    }
    // Fixed-function-only enums are answered from this frontend's own limits;
    // everything else shares its numeric value with WebGL and is asked of the
    // real context, which sets GL_INVALID_ENUM itself for an enum it rejects.
    // An unanswerable query writes nothing, exactly as OpenGL specifies.
    _getIntegerv(frontend, pname, pointer) {
      let values;
      switch (pname >>> 0) {
        case C.MAX_LIGHTS: values = [frontend.lights.length]; break;
        // The ARB_multitexture pipeline this frontend implements has exactly
        // two units; reporting WebGL's sampler count would promise fixed-
        // function stages that do not exist.
        case C.MAX_TEXTURE_UNITS: values = [frontend.boundTextureNames.length]; break;
        // The matrix and attribute stacks are unbounded JS arrays here, so the
        // OpenGL 1.1 required minimums are depths this frontend really honours.
        case C.MAX_MODELVIEW_STACK_DEPTH:
        case C.MAX_PROJECTION_STACK_DEPTH:
        case C.MAX_TEXTURE_STACK_DEPTH:
          values = [32]; break;
        case C.MAX_ATTRIB_STACK_DEPTH: values = [16]; break;
        case C.READ_BUFFER: values = [frontend.readBuffer || C.BACK]; break;
        case C.DRAW_BUFFER: values = [C.BACK]; break;
        default: {
          const value = frontend.backend.getParameter(pname >>> 0);
          if (value === null || value === undefined) return;
          values = typeof value === 'number' ? [value]
            : typeof value === 'boolean' ? [value ? 1 : 0]
              : Array.from(value, item => Math.round(Number(item)) | 0);
          break;
        }
      }
      const dv = this._dv(), wa = this._guestToWasm(pointer);
      for (let i = 0; i < values.length; i++) dv.setInt32(wa + i * 4, values[i] | 0, true);
    }
    _readPixels(frontend, stack) {
      const x = this._u32(stack, 0), y = this._u32(stack, 1);
      const width = this._u32(stack, 2), height = this._u32(stack, 3);
      const format = this._u32(stack, 4), type = this._u32(stack, 5);
      const pointer = this._u32(stack, 6);
      const channels = format === C.RGB ? 3 : format === C.ALPHA || format === C.LUMINANCE ? 1 : 4;
      const out = new Uint8Array(width * height * channels);
      frontend.backend.readPixels(x, y, width, height, frontend._textureFormat(format), type, out);
      new Uint8Array(this._memory(), this._guestToWasm(pointer), out.length).set(out);
    }
    _texImage(frontend, stack, sub) {
      const base = sub ? 0 : 0;
      const level = this._u32(stack, 1);
      let x = 0, y = 0, internal = 4, width, height, border = 0, format, type, pointer;
      if (sub) {
        x = this._u32(stack, 2); y = this._u32(stack, 3);
        width = this._u32(stack, 4); height = this._u32(stack, 5);
        format = this._u32(stack, 6); type = this._u32(stack, 7); pointer = this._u32(stack, 8);
      } else {
        internal = this._u32(stack, 2); width = this._u32(stack, 3); height = this._u32(stack, 4);
        border = this._u32(stack, 5); format = this._u32(stack, 6);
        type = this._u32(stack, 7); pointer = this._u32(stack, 8);
      }
      const channels = format === C.RGB ? 3 : format === C.ALPHA || format === C.LUMINANCE ? 1 : 4;
      const pixels = this._imageBytes(pointer, width, height, channels, frontend.unpackAlignment);
      if (sub) frontend.texSubImage(level, x, y, width, height, format, type, pixels);
      else frontend.texImage(level, internal, width, height, border, format, type, pixels);
      return base;
    }
  }

  return { GL_CALLS, WGL_CALLS, CALLS, CALL_INDEX, constants: C,
    // perspective and lookAt are exported for the same reason frustum and
    // ortho are: the WAT mirror in src/09a8f-gl-matrix.wat has to be checked
    // against the implementation that actually ships, not a transcription of
    // it into a test.
    FixedFunctionGL, OpenGLHostBridge, identity, multiply, frustum, ortho,
    perspective, lookAt, stats, hooks,
    OP_NAMES };
});

#!/usr/bin/env node
// gen_dispatch.js — Generate 09b2-dispatch-table.generated.wat
//
// Reads api_table.json and generates the $dispatch_api_table function
// containing just the br_table that calls $handle_{Name} functions.
// The hand-written $win32_dispatch wrapper lives in 09b-dispatch.wat.

const fs = require('fs');
const path = require('path');

const apiTable = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'api_table.json'), 'utf8'));

// Two spellings of the x86 GPRs: the historical per-instance wasm globals, and
// the per-thread register file in linear memory ($reg_base, slots +0 eax /
// +16 esp). The generated table must match whichever the tree declares, or the
// build's own staleness check fires on every run. Read it from 01-header.wat
// rather than a flag so the generator cannot drift from the source it feeds.
const REGFILE = /\(global \$reg_base \(mut i32\)/.test(
  fs.readFileSync(path.join(__dirname, '..', 'src', '01-header.wat'), 'utf8'));
const getR = r => REGFILE
  ? `(i32.load offset=${{ eax: 0, esp: 16 }[r]} (global.get $reg_base))`
  : `(global.get $${r})`;
const setR = (r, v) => REGFILE
  ? `(i32.store offset=${{ eax: 0, esp: 16 }[r]} (global.get $reg_base) ${v})`
  : `(global.set $${r} ${v})`;
const outPath = path.join(__dirname, '..', 'src', '09b2-dispatch-table.generated.wat');

// --check: generate in memory and compare with the file on disk. Used as a build
// gate so a stale generated table fails the build instead of dispatching to the
// wrong handler at runtime.
const CHECK_ONLY = process.argv.includes('--check');

// A COM vtable whose api_ids are not contiguous produces a table that dispatches
// method N to some unrelated API. This used to print WARNING and generate the
// broken table anyway; it is now fatal.
const errors = [];
function fatal(msg) { errors.push(msg); console.error(`ERROR: ${msg}`); }

// Clean up old generated file if it exists
const oldPath = path.join(__dirname, '..', 'src', '09b-dispatch.generated.wat');
if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

const N = apiTable.length;
const out = [];
const PAGE_SIZE = 256;

function watName(name, label) {
  if (!/^[A-Za-z0-9_?@$]+$/.test(name)) {
    fatal(`${label} has invalid WAT identifier ${JSON.stringify(name)}`);
  }
  return name;
}

function watI32(value) {
  return value > 0x7fffffff ? `0x${value.toString(16)}` : String(value);
}

// Hand-written fast paths and the COM-vtable bootstrap still need a few IDs,
// but their source must never bake in api_table.json's current array indexes.
// Emit the names beside the generated dispatcher so an append/reorder repair
// updates every consumer through the existing `gen_dispatch.js --check` gate.
const namedApiIds = [
  ['IVBDirectX7_QueryInterface', 'API_ID_IVBDirectX7_BASE'],
  ['IDirectMusic_EnumPort', 'API_ID_IDirectMusic_EnumPort'],
  ['GetTickCount', 'API_ID_GetTickCount'],
  ['timeGetTime', 'API_ID_timeGetTime'],
  ['QueryPerformanceCounter', 'API_ID_QueryPerformanceCounter'],
  ['QueryPerformanceFrequency', 'API_ID_QueryPerformanceFrequency'],
  ['MsgWaitForMultipleObjects', 'API_ID_MsgWaitForMultipleObjects'],
  ['PeekMessageA', 'API_ID_PeekMessageA'],
  ['PeekMessageW', 'API_ID_PeekMessageW'],
  ['_EH_prolog', 'API_ID__EH_prolog'],
  ['IDirectDraw_QueryInterface', 'API_ID_IDirectDraw_BASE'],
  ['IAMMultiMediaStream_QueryInterface', 'API_ID_IAMMultiMediaStream_BASE'],
  ['IShellLinkA_QueryInterface', 'API_ID_IShellLinkA_BASE'],
  ['IPersistFile_QueryInterface', 'API_ID_IPersistFile_BASE'],
  ['IDirect3DShader9_QueryInterface', 'API_ID_IDirect3DShader9_BASE'],
  ['IDirect3DBuffer9_QueryInterface', 'API_ID_IDirect3DBuffer9_BASE'],
  ['IDirect3DVertexDeclaration9_QueryInterface', 'API_ID_IDirect3DVertexDeclaration9_BASE'],
  ['IDirect3DStateBlock9_QueryInterface', 'API_ID_IDirect3DStateBlock9_BASE'],
  ['IDirect3DQuery9_QueryInterface', 'API_ID_IDirect3DQuery9_BASE'],
  ['IDirect3DCubeTexture9_QueryInterface', 'API_ID_IDirect3DCubeTexture9_BASE'],
  ['IDirect3DCubeTexture8_QueryInterface', 'API_ID_IDirect3DCubeTexture8_BASE'],
  ['IDirect3DTexture8_QueryInterface', 'API_ID_IDirect3DTexture8_BASE'],
  ['IDirect3DSurface8_QueryInterface', 'API_ID_IDirect3DSurface8_BASE'],
];

out.push('  ;; Named API ids consumed by hand-written dispatch fast paths.');
out.push('  ;; Generated from api_table.json; never replace these with array indexes.');
for (const [name, symbol] of namedApiIds) {
  const matches = apiTable.filter(api => api.name === name);
  if (matches.length !== 1) {
    fatal(`named API id ${name} must match exactly one api_table.json entry (found ${matches.length})`);
    continue;
  }
  out.push(`  (global $${symbol} i32 (i32.const ${matches[0].id}))`);
}
out.push('');

// Constant compatibility stubs are data, not behavior worth transcribing in
// a hand-written handler file.  The explicit pop count keeps unusual calling
// conventions reviewable; stdcall rows are additionally checked against nargs.
const stubApis = apiTable.filter(api => api.stub !== undefined);
const stubHandlers = new Set();
for (const api of stubApis) {
  const stub = api.stub;
  if (!stub || typeof stub !== 'object' || Array.isArray(stub) ||
      Object.keys(stub).some(key => key !== 'pop' && key !== 'ret') ||
      !Number.isInteger(stub.pop) || stub.pop < 0 || stub.pop % 4 !== 0 ||
      !Number.isInteger(stub.ret) || stub.ret < -0x80000000 || stub.ret > 0xffffffff) {
    fatal(`API ${api.name} stub must be {"pop": aligned nonnegative integer, "ret": i32 integer}`);
    continue;
  }
  if (api.handler) {
    fatal(`API ${api.name} cannot combine stub metadata with a handler alias`);
    continue;
  }
  if (api.convention === 'stdcall' && Number.isInteger(api.nargs) &&
      stub.pop !== 4 * (api.nargs + 1)) {
    fatal(`API ${api.name} stub pop ${stub.pop} disagrees with stdcall nargs ${api.nargs}`);
  }
  const handler = watName(api.name, `API ${api.name} stub handler`);
  if (stubHandlers.has(handler)) fatal(`duplicate generated stub handler $handle_${handler}`);
  stubHandlers.add(handler);
}
if (stubApis.length) {
  out.push('  ;; ============================================================');
  out.push('  ;; CONSTANT API STUBS — GENERATED, do not edit');
  out.push('  ;; Opted in with stub:{pop,ret} in api_table.json.');
  out.push('  ;; ============================================================');
}
for (const api of stubApis) {
  if (!stubHandlers.has(api.name)) continue;
  out.push(`  ;; ${api.name}: pop ${api.stub.pop}, return ${watI32(api.stub.ret)}`);
  out.push(`  (func $handle_${api.name} (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)`);
  out.push(`    ${setR('eax', `(i32.const ${watI32(api.stub.ret)})`)}`);
  out.push(`    ${setR('esp', `(i32.add ${getR('esp')} (i32.const ${api.stub.pop}))`)})`);
  out.push('');
}

// Test-only direct-call exports used by focused WAT harnesses.  These have one
// mechanical ABI: expose the API's declared arguments, zero-fill the handler's
// remaining argument registers/name pointer, and restore ESP after the stdcall
// handler advances it. For >5 i32 arguments, mirror the entire argument list
// into the caller-provided guest stack: some handlers also read early words
// there. These are synchronous test calls, not callback-aware guest runners;
// callers must provide writable stack space for return address + arguments.
// Reduced signatures and other setup remain hand-written in 13-exports.wat.
const testCallApis = apiTable.filter(api => api.test_call === true);
for (const api of apiTable) {
  if (api.test_call !== undefined && api.test_call !== true) {
    fatal(`API ${api.name} test_call must be true when present`);
  }
}
if (testCallApis.length) {
  out.push('  ;; ============================================================');
  out.push('  ;; TEST-CALL EXPORTS — GENERATED, do not edit');
  out.push('  ;; Opted in with test_call:true in api_table.json.');
  out.push('  ;; ============================================================');
}
for (const api of testCallApis) {
  if (!Number.isInteger(api.nargs) || api.nargs < 0 || api.nargs > 16) {
    fatal(`API ${api.name} test_call requires integer nargs in range 0..16`);
    continue;
  }
  const handler = watName(api.handler || api.name, `API ${api.name} handler`);
  const isFloat = i => api.args?.[i]?.type === 'FLOAT';
  const word = i => isFloat(i) ? `(i32.reinterpret_f32 (local.get $arg${i}))` : `(local.get $arg${i})`;
  const params = Array.from({ length: api.nargs }, (_, i) => ` (param $arg${i} ${isFloat(i) ? 'f32' : 'i32'})`).join('');
  const args = Array.from({ length: 5 }, (_, i) =>
    i < api.nargs ? word(i) : '(i32.const 0)');
  args.push('(i32.const 0)');
  out.push(`  (func (export "test_call_${api.name}")${params} (result i32)`);
  out.push('    (local $saved_esp i32)');
  out.push(`    (local.set $saved_esp ${getR('esp')})`);
  if (api.nargs > 5) {
    for (let i = 0; i < api.nargs; i++) {
      out.push(`    (call $gs32 (i32.add (local.get $saved_esp) (i32.const ${4 * (i + 1)})) ${word(i)})`);
    }
  }
  out.push(`    (call $handle_${handler}`);
  out.push(`      ${args.slice(0, 3).join(' ')}`);
  out.push(`      ${args.slice(3).join(' ')})`);
  out.push(`    ${setR('esp', '(local.get $saved_esp)')}`);
  out.push(`    ${getR('eax')})`);
}
if (testCallApis.length) out.push('');

// OpenGL/WGL exports share one ABI bridge. `words` counts physical 32-bit
// stack words (GLdouble consumes two), while api_table nargs remains the
// source-level argument count used by tracing.
const gpuApis = new Map([
  ['glAlphaFunc', 2], ['glBlendFunc', 2], ['glClear', 1], ['glClearColor', 4],
  ['glCullFace', 1], ['glDepthFunc', 1], ['glDepthMask', 1], ['glDepthRange', 4],
  ['glDisable', 1], ['glDrawBuffer', 1], ['glEnable', 1], ['glFinish', 0],
  ['glGetError', 0], ['glGetFloatv', 2], ['glGetString', 1], ['glPointSize', 1],
  ['glPolygonMode', 2], ['glReadPixels', 7], ['glScissor', 4], ['glShadeModel', 1],
  ['glViewport', 4], ['glBegin', 1], ['glEnd', 0], ['glColor3f', 3],
  ['glColor3fv', 1], ['glColor4f', 4], ['glColor4fv', 1], ['glColor4ubv', 1],
  ['glTexCoord2f', 2], ['glVertex2f', 2], ['glVertex3f', 3], ['glVertex3fv', 1],
  ['glFrustum', 12], ['glLoadIdentity', 0], ['glLoadMatrixf', 1],
  ['glMatrixMode', 1], ['glOrtho', 12], ['glPopMatrix', 0], ['glPushMatrix', 0],
  ['glRotatef', 4], ['glScalef', 3], ['glTranslatef', 3], ['glBindTexture', 2],
  ['glDeleteTextures', 2], ['glTexEnvf', 3], ['glTexImage2D', 9],
  ['glTexParameterf', 3], ['glTexSubImage2D', 9], ['wglCreateContext', 1],
  ['wglDeleteContext', 1], ['wglGetProcAddress', 1], ['wglMakeCurrent', 2],
  ['wglChoosePixelFormat', 2], ['wglDescribePixelFormat', 4],
  ['wglSetPixelFormat', 3],
  // Legacy ref_gl.dll dynamically asks for this spelling. Opcode 55 is the
  // same backend-neutral present operation used by GDI32!SwapBuffers.
  ['wglSwapBuffers', 1],
  // Appended after the stable GL/WGL opcode range. GoldSrc uses the scalar
  // unsigned-byte colour entry point for world geometry and polygon offset
  // for coplanar decals.
  ['glColor4ub', 4],
  ['glPolygonOffset', 2],
  ['glColor3ubv', 1],
  // GLU matrix helpers are appended after the stable GL/WGL/GPU range.
  // Their GLdouble arguments consume two physical stack dwords each.
  ['gluPerspective', 8],
  ['gluLookAt', 18],
  ['gluBuild2DMipmaps', 7],
  ['gluOrtho2D', 8],
  // Win98-era intros use immediate-mode normals even when lighting is toggled
  // only for a subset of their geometry. Keep these appended so every older
  // command-stream opcode stays stable.
  ['glNormal3f', 3],
  ['glNormal3fv', 1],
  ['glIsEnabled', 1],
  ['glColorMaterial', 2],
  ['glLightfv', 3],
  ['glMaterialfv', 3],
  ['glLightModelfv', 2],
  ['glLightModeli', 2],
  ['glMaterialf', 3],
  ['glLightf', 3],
  ['glPixelStorei', 2],
  ['glGenTextures', 2],
  ['glHint', 2],
  ['glPushAttrib', 1],
  ['glPopAttrib', 0],
  ['glFogfv', 2],
  ['glFogf', 2],
  ['glFogi', 2],
  ['glFrontFace', 1],
  ['glTexEnvi', 3],
  ['glTexGeni', 3],
  ['glTexGenf', 3],
  ['glTexGenfv', 3],
  // SimGolf Terrain.dll's measured OpenGL 1.1 imports. Client arrays are
  // compiled locally by GLCommandStream so guest pointers retain call-time semantics.
  ['glEnableClientState', 1],
  ['glArrayElement', 1],
  ['glVertexPointer', 4],
  ['glNormalPointer', 3],
  ['glRotated', 8],
  ['glVertex2fv', 1],
  ['glMateriali', 3],
  ['glFlush', 0],
  ['glLineWidth', 1],
  ['glTexCoord2fv', 1],
  ['glTexParameteri', 3],
  ['glVertex2i', 2],
  ['gluBuild1DMipmaps', 6],
  // Warcraft III turns the vertex-array path back off between its UI and
  // world passes, so the disable half has to exist too.
  ['glDisableClientState', 1],
  // Warcraft III's world pass is indexed client arrays with colour and texture
  // coordinates, and it queries integer limits before choosing its texture path.
  ['glTexCoordPointer', 4],
  ['glColorPointer', 4],
  ['glDrawElements', 4],
  ['glGetIntegerv', 2],
  ['glReadBuffer', 1],
  // ARB_multitexture, reached through wglGetProcAddress rather than the import
  // table. Warcraft III's text pass depends on the per-unit client-array split
  // these entry points select.
  ['glActiveTextureARB', 1],
  ['glClientActiveTextureARB', 1],
  ['glMultiTexCoord2fARB', 3],
  // Descent 3's OpenGL renderer draws its client arrays unindexed.
  ['glDrawArrays', 3],
  // Unreal-engine OpenGlDrv composes its view transform with glMultMatrixf
  // (Deus Ex demo, OPENGLDRV-GL11-SURFACE).
  ['glMultMatrixf', 1],
  // glClearDepth(GLclampd): two physical stack dwords.
  ['glClearDepth', 2],
  // glColor3ub(r, g, b): Anachronox's ref_gl HUD and font colours.
  ['glColor3ub', 3],
  ['glTexParameterfv', 3], ['glGetTexParameterfv', 3],
  // Serious Sam's Engine probes GL_TEXTURE_GREEN_SIZE of a 1x1 GL_RGBA8 image
  // to decide whether 32-bit textures are available.
  ['glGetTexLevelParameteriv', 4], ['glGetTexLevelParameterfv', 4],
]);
const gpuApiOrder = [...gpuApis.keys()];

// Dynamic WGL lookup must not expose fail-fast aliases merely because their
// names exist in the global import table. Derive availability from the same
// implementation map that dispatch uses. GLU helpers are a separate library.
out.push('  (func $wgl_api_available (param $id i32) (result i32)');
// These WGL implementations dispatch to native handlers rather than GPU opcodes.
const nativeWglApis = new Set(['wglSwapLayerBuffers', 'wglGetCurrentContext', 'wglGetCurrentDC']);
for (const [id, api] of apiTable.entries()) {
  if ((gpuApis.has(api.name) || nativeWglApis.has(api.name)) && /^(?:gl[A-Z]|wgl[A-Z])/.test(api.name)) {
    out.push(`    (if (i32.eq (local.get $id) (i32.const ${id})) (then (return (i32.const 1)))) ;; ${api.name}`);
  }
}
out.push('    (i32.const 0))', '');

function handlerCall(api) {
  const gpuOpcode = gpuApiOrder.indexOf(api.name);
  if (gpuOpcode >= 0) {
    return `      (call $handle_gpu_api (i32.const ${gpuOpcode}) (i32.const ${gpuApis.get(api.name)}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const vbDdSlot = api.name.match(/^IVBDirectDraw7_DirectSlot(\d+)$/);
  if (vbDdSlot && !api.handler) {
    const slot = (api.nargs + 1) * 4;
    return `      (call $handle_vb_unsupported_stdcall (i32.const ${slot}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const vbClipSlot = api.name.match(/^IVBDirectDrawClipper_DirectSlot(\d+)$/);
  if (vbClipSlot) {
    // Even an unsupported method must consume the complete typelib ABI.
    // Keep the argument count in api_table, not a second per-slot WAT table.
    const stackBytes = (api.nargs + 1) * 4;
    return `      (call $handle_vb_unsupported_stdcall (i32.const ${stackBytes}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const vbSoundSlot = api.name.match(/^IVBDirectSound_DirectSlot(\d+)$/);
  if (vbSoundSlot) {
    const slot = parseInt(vbSoundSlot[1], 10);
    return `      (call $handle_IVBDirectSound_DirectSlot (i32.const ${slot}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const vbSurfaceSlot = api.name.match(/^IVBDirectDrawSurface7_DirectSlot(\d+)$/);
  if (vbSurfaceSlot) {
    const slot = parseInt(vbSurfaceSlot[1], 10);
    return `      (call $handle_IVBDirectDrawSurface7_DirectSlot (i32.const ${slot}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const daSlot = api.name.match(/^IDirectAnimationDA(View|Statics|Behavior)_DirectSlot(\d+)$/);
  if (daSlot) {
    const iface = daSlot[1];
    const slot = parseInt(daSlot[2], 10);
    return `      (call $handle_IDirectAnimationDA${iface}_DirectSlot (i32.const ${slot}) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
  }
  const handler = watName(api.handler || api.name, `API ${api.name} handler alias`);
  return `      (call $handle_${handler} (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`;
}

out.push('  ;; ============================================================');
out.push('  ;; API BR_TABLE DISPATCH — GENERATED, do not edit');
out.push('  ;; Generated by tools/gen_dispatch.js from api_table.json');
out.push('  ;; Hand-written dispatch wrapper is in 09b-dispatch.wat');
out.push('  ;; ============================================================');
out.push('  (func $dispatch_api_table (param $api_id i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)');
out.push('');
out.push('    ;; === Paged br_table dispatch ===');
for (let base = 0, page = 0; base < N; base += PAGE_SIZE, page++) {
  const end = Math.min(base + PAGE_SIZE, N);
  out.push(`    (if (i32.lt_u (local.get $api_id) (i32.const ${end}))`);
  out.push('      (then');
  out.push(`        (call $dispatch_api_table_page_${page} (i32.sub (local.get $api_id) (i32.const ${base})) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))`);
  out.push('        (return)))');
}
out.push('    (call $handle_fallback (local.get $name_ptr) (local.get $api_id))');
out.push('  )');

for (let base = 0, page = 0; base < N; base += PAGE_SIZE, page++) {
  const end = Math.min(base + PAGE_SIZE, N);
  const count = end - base;
  out.push('');
  out.push(`  (func $dispatch_api_table_page_${page} (param $api_id i32) (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)`);
  out.push(`    ;; api ids ${base}..${end - 1}`);
  out.push('    (block $fallback');
  for (let slot = count - 1; slot >= 0; slot--) {
    out.push(`    (block $api_${slot}`);
  }
  let br = '      (br_table';
  for (let slot = 0; slot < count; slot++) br += ` $api_${slot}`;
  br += ' $fallback (local.get $api_id))';
  out.push(br);
  for (let slot = 0; slot < count; slot++) {
    const id = base + slot;
    const api = apiTable[id];
    out.push(`    ) ;; ${id}: ${api.name}`);
    out.push(handlerCall(api));
    out.push('      (return)');
  }
  out.push('    ) ;; fallback');
  out.push(`    (call $handle_fallback (local.get $name_ptr) (i32.add (local.get $api_id) (i32.const ${base})))`);
  out.push('  )');
}

// ── Generate $init_dx_com_thunks from api_table.json ────────────────
// COM interfaces: prefix → WAT global name.  Order matters (parent before child).
const comInterfaces = [
  { prefix: 'IDirectDraw',          global: 'DX_VTBL_DDRAW' },
  { prefix: 'IDirectDraw2',         global: 'DX_VTBL_DDRAW2',   extends: 'IDirectDraw' },
  { prefix: 'IDirectDrawSurface',   global: 'DX_VTBL_DDSURF' },
  { prefix: 'IDirectDrawSurface2',  global: 'DX_VTBL_DDSURF2', extends: 'IDirectDrawSurface' },
  { prefix: 'IDirectDrawPalette',   global: 'DX_VTBL_DDPAL' },
  { prefix: 'IDirectDrawClipper',  global: 'DX_VTBL_DDCLIP' },
  { prefix: 'IDirectSound',         global: 'DX_VTBL_DSOUND' },
  { prefix: 'IDirectSoundBuffer',   global: 'DX_VTBL_DSBUF' },
  { prefix: 'IDirectInput',         global: 'DX_VTBL_DINPUT' },
  { prefix: 'IDirectInputDevice',   global: 'DX_VTBL_DIDEV' },
  { prefix: 'IDirectPlay3',         global: 'DX_VTBL_DPLAY3' },
  { prefix: 'IDirectPlayLobby2',    global: 'DX_VTBL_DPLAYLOBBY2' },
  { prefix: 'IDirect3D',            global: 'DX_VTBL_D3D' },
  { prefix: 'IDirect3D3',           global: 'DX_VTBL_D3D3' },
  { prefix: 'IDirectDrawFactory',   global: 'DX_VTBL_DDFACTORY' },
  { prefix: 'IDirectAnimationDAView', global: 'DX_VTBL_DA_VIEW' },
  { prefix: 'IDirectAnimationDAStatics', global: 'DX_VTBL_DA_STATICS' },
  { prefix: 'IDirectAnimationDABehavior', global: 'DX_VTBL_DA_BEHAVIOR' },
  { prefix: 'IMalloc',              global: 'DX_VTBL_IMALLOC' },
  { prefix: 'IRunningObjectTable',   global: 'DX_VTBL_OLE_ROT' },
  { prefix: 'IEnumMoniker',         global: 'DX_VTBL_OLE_ENUMMONIKER' },
  { prefix: 'IMoniker',             global: 'DX_VTBL_OLE_MONIKER' },
  { prefix: 'IBindCtx',             global: 'DX_VTBL_OLE_BINDCTX' },
  { prefix: 'IEnumString',          global: 'DX_VTBL_OLE_ENUMSTRING' },
  { prefix: 'ILockBytes',           global: 'DX_VTBL_OLE_LOCKBYTES' },
  { prefix: 'IStream',              global: 'DX_VTBL_OLE_STREAM' },
  { prefix: 'IStorage',             global: 'DX_VTBL_OLE_STORAGE' },
  { prefix: 'IDataObject',          global: 'DX_VTBL_OLE_DATAOBJECT' },
  { prefix: 'IEnumFORMATETC',       global: 'DX_VTBL_OLE_ENUMFORMATETC' },
  { prefix: 'IEnumSTATSTG',         global: 'DX_VTBL_OLE_ENUMSTATSTG' },
  { prefix: 'IOleObject',           global: 'DX_VTBL_OLE_OBJECT' },
  { prefix: 'IPersistStorage',      global: 'DX_VTBL_OLE_PERSISTSTORAGE' },
  { prefix: 'IOleCache',            global: 'DX_VTBL_OLE_CACHE' },
  { prefix: 'IViewObject',          global: 'DX_VTBL_OLE_VIEWOBJECT' },
  { prefix: 'IViewObject2',         global: 'DX_VTBL_OLE_VIEWOBJECT2', extends: 'IViewObject' },
  { prefix: 'IDirect3DDevice3',     global: 'DX_VTBL_D3DDEV3' },
  { prefix: 'IDirect3DViewport3',   global: 'DX_VTBL_D3DVP3' },
  { prefix: 'IDirect3DLight',       global: 'DX_VTBL_D3DLIGHT' },
  { prefix: 'IDirect3DMaterial3',   global: 'DX_VTBL_D3DMAT3' },
];

// Append Direct3D Immediate Mode interfaces from shared spec.
const { vtableGlobals: d3dimVtables } = require('./d3dim-methods');
for (const v of d3dimVtables) comInterfaces.push(v);

// OLE Automation font object (OleCreateFontIndirect). Kept last so its
// registry slot is appended rather than shifting every existing one.
comInterfaces.push({ prefix: 'IFont', global: 'DX_VTBL_OLE_FONT' });

// DirectSound3D is an auxiliary view of an existing sound buffer. Keep it at
// the registry tail so adding it cannot renumber any established interface.
comInterfaces.push({ prefix: 'IDirectSound3DBuffer', global: 'DX_VTBL_DS3DBUF' });

// Direct3D 9. Also at the tail: $dx_sync_thread_vtables restores globals by
// registry offset, so anything inserted above renumbers every later slot.
const { vtableGlobals: d3d9Vtables } = require('./d3d9-methods');
for (const v of d3d9Vtables) comInterfaces.push(v);

// IDirectInput7: the v1 vtable plus FindDevice/CreateDeviceEx. Tail again,
// for the same registry-offset reason as the entries above.
comInterfaces.push({ prefix: 'IDirectInput7', global: 'DX_VTBL_DINPUT7', extends: 'IDirectInput' });

// IDirectInputDevice2: the v1 device vtable plus the force-feedback/Poll
// methods. Tail again, same registry-offset reason.
comInterfaces.push({ prefix: 'IDirectInputDevice2', global: 'DX_VTBL_DIDEV2', extends: 'IDirectInputDevice' });

// Surface3 adds SetSurfaceDesc to Surface2. Keep it at the absolute tail so
// every established cross-thread vtable registry offset remains stable.
comInterfaces.push({ prefix: 'IDirectDrawSurface3', global: 'DX_VTBL_DDSURF3', extends: 'IDirectDrawSurface2' });

// D3D9 swap chains were added after every established interface. Keep this at
// the absolute tail so worker-thread registry offsets remain append-only.
comInterfaces.push({ prefix: 'IDirect3DSwapChain9', global: 'DX_VTBL_D3DSWAP9' });

// Listener is an auxiliary view of a primary DirectSound buffer. Append it
// after every established interface so registry offsets remain stable.
comInterfaces.push({ prefix: 'IDirectSound3DListener', global: 'DX_VTBL_DS3DLISTENER' });
comInterfaces.push({ prefix: 'IDirectPlay4', global: 'DX_VTBL_DPLAY4', extends: 'IDirectPlay3' });
comInterfaces.push({ prefix: 'IDirectPlayLobby3', global: 'DX_VTBL_DPLAYLOBBY3', extends: 'IDirectPlayLobby2' });

// D3D8 factory and device. Keep them at the absolute registry tail so no
// established worker-thread vtable offset moves.
const { vtableGlobals: d3d8Vtables } = require('./d3d8-methods');
for (const v of d3d8Vtables) comInterfaces.push(v);

// Free-threaded marshaler (CoCreateFreeThreadedMarshaler): its non-delegating
// IUnknown and its IMarshal. Tail again, same registry-offset reason.
comInterfaces.push({ prefix: 'IFtmInner', global: 'DX_VTBL_FTM_INNER' });
comInterfaces.push({ prefix: 'IFtmMarshal', global: 'DX_VTBL_FTM_MARSHAL' });
// Separate Unicode DirectPlay4 interface; never aliases ANSI method semantics.
comInterfaces.push({ prefix: 'IDirectPlay4W', global: 'DX_VTBL_DPLAY4W' });

// IDirectInputDevice7: the v2 device vtable plus EnumEffectsInFile and
// WriteEffectToFile. An app that asks for IID_IDirectInputDevice7A and is
// refused has no fallback to try -- Pawn quits with "This program requires
// DirectX 9 or later!" -- and a v2 vtable handed out under a v7 identity puts
// those two slots on whatever interface's thunks follow ours. Tail again, same
// registry-offset reason as every entry above.
comInterfaces.push({ prefix: 'IDirectInputDevice7', global: 'DX_VTBL_DIDEV7', extends: 'IDirectInputDevice2' });
comInterfaces.push({ prefix: 'IDirectSound8', global: 'DX_VTBL_DSOUND8', extends: 'IDirectSound' });

// Build a map of prefix → { startId, count } from the api_table
const byName = new Map(apiTable.map(a => [a.name, a]));
// Preserve all existing shared vtable registry offsets.
comInterfaces.push({prefix:'IVBImageSurface7',global:'DX_VTBL_VBIMAGE7'});
// Unicode IDirectPlayLobby/2/3 (one 19-slot vtable serves all three as a
// prefix). Tail, so every established registry offset stays where it was.
comInterfaces.push({ prefix: 'IDirectPlayLobby3W', global: 'DX_VTBL_DPLAYLOBBY3W' });
// Append only: worker registry offsets of existing interfaces are ABI.
comInterfaces.push({ prefix: 'IDirectSoundNotify', global: 'DX_VTBL_DSNOTIFY' });
comInterfaces.push({ prefix: 'IDirectSoundPropertySet', global: 'DX_VTBL_DSPROPERTY' });

const ifaceInfo = new Map();
for (const iface of comInterfaces) {
  // Find all APIs matching this interface (prefix + "_")
  const methods = apiTable.filter(a => a.name.startsWith(iface.prefix + '_'));
  if (methods.length === 0) {
    fatal(`no methods found for COM interface ${iface.prefix}`);
    continue;
  }
  methods.sort((a, b) => a.id - b.id);
  const startId = methods[0].id;
  // Verify contiguous
  for (let i = 1; i < methods.length; i++) {
    if (methods[i].id !== startId + i) {
      fatal(`${iface.prefix} api_ids not contiguous: expected ${startId + i}, got ${methods[i].id} (${methods[i].name}). ` +
        'COM vtable slots are computed as startId + slot, so this table would call the wrong method.');
    }
  }
  let slotApiIds = null;
  if (iface.methods) {
    slotApiIds = iface.methods.map(method => {
      const api = byName.get(`${iface.prefix}_${method}`);
      if (!api) {
        fatal(`${iface.prefix} vtable method ${method} has no api_table.json entry`);
        return startId;
      }
      return api.id;
    });
    if (slotApiIds.length !== methods.length) {
      fatal(`${iface.prefix} vtable order has ${slotApiIds.length} slots but ${methods.length} APIs`);
    }
  }
  ifaceInfo.set(iface.prefix, { startId, count: methods.length, slotApiIds });
}

out.push('');
out.push('  ;; ============================================================');
out.push('  ;; COM VTABLE INIT — GENERATED, do not edit');
out.push('  ;; Generated by tools/gen_dispatch.js from api_table.json');
out.push('  ;; ============================================================');
const registeredInterfaces = comInterfaces.filter(iface => ifaceInfo.has(iface.prefix));
out.push(`  (global $DX_VTBL_REGISTRY_COUNT i32 (i32.const ${registeredInterfaces.length}))`);
out.push('  ;; Restore only a complete registry, in the same order as initialization.');
out.push('  (func $dx_sync_thread_vtables');
out.push('    (if (i32.lt_u (i32.load (global.get $DX_VTBL_REGISTRY))');
out.push('                   (global.get $DX_VTBL_REGISTRY_COUNT))');
out.push('      (then (return)))');
registeredInterfaces.forEach((iface, index) => {
  out.push(`    (global.set $${iface.global} (i32.load offset=${4 + index * 4} (global.get $DX_VTBL_REGISTRY)))`);
});
out.push('  )');
out.push('  (func $init_dx_com_thunks (export "init_dx_com_thunks")');

const builtVtableCounts = new Map();
for (const iface of registeredInterfaces) {
  const info = ifaceInfo.get(iface.prefix);
  if (iface.extends) {
    // Extended interface: copy parent vtable + append extra methods
    const parentInfo = ifaceInfo.get(iface.extends);
    if (!parentInfo) { fatal(`COM interface ${iface.prefix} extends ${iface.extends}, which has no methods in api_table.json`); continue; }
    // The parent may itself extend another interface. Copy its full generated
    // vtable, not only the methods declared directly on that parent.
    const parentCount = builtVtableCounts.get(iface.extends) || parentInfo.count;
    const totalCount = parentCount + info.count;
    out.push(`    ;; ${iface.prefix}: extends ${iface.extends} (${parentCount}) + ${info.count} extra = ${totalCount} total, extra at api_id ${info.startId}`);
    out.push(`    (global.set $${iface.global} (call $extend_com_vtable`);
    out.push(`      (global.get $${ifaceInfo.get(iface.extends) ? comInterfaces.find(c => c.prefix === iface.extends).global : '??'}) (i32.const ${parentCount}) (i32.const ${info.startId}) (i32.const ${totalCount})))`);
    builtVtableCounts.set(iface.prefix, totalCount);
  } else {
    out.push(`    ;; ${iface.prefix}: ${info.count} methods starting at api_id ${info.startId}`);
    out.push(`    (global.set $${iface.global} (call $init_com_vtable (i32.const ${info.startId}) (i32.const ${info.count})))`);
    if (info.slotApiIds) {
      for (let slot = 0; slot < info.slotApiIds.length; slot++) {
        const apiId = info.slotApiIds[slot];
        if (apiId === info.startId + slot) continue;
        out.push(`    (call $set_com_vtable_slot_api_id (global.get $${iface.global}) (i32.const ${slot}) (i32.const ${apiId}))`);
      }
    }
    builtVtableCounts.set(iface.prefix, info.count);
  }
}

out.push('  )');

// ── Validate paren balance ──────────────────────────────────────────
const result = out.join('\n') + '\n';
let depth = 0;
for (let ci = 0; ci < result.length; ci++) {
  if (result[ci] === '"') { while (ci + 1 < result.length && result[++ci] !== '"') { if (result[ci] === '\\') ci++; } continue; }
  if (result[ci] === ';' && result[ci + 1] === ';') { while (ci < result.length && result[ci] !== '\n') ci++; continue; }
  if (result[ci] === '(') depth++;
  if (result[ci] === ')') depth--;
}
if (depth !== 0) {
  fatal(`paren imbalance in generated output, final depth = ${depth}`);
}

if (errors.length) {
  console.error(`${errors.length} fatal problem(s); ${CHECK_ONLY ? 'not checking' : 'not writing'} ${path.relative(process.cwd(), outPath)}.`);
  process.exit(1);
}

if (CHECK_ONLY) {
  const onDisk = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  if (onDisk !== result) {
    console.error(`ERROR: ${path.relative(process.cwd(), outPath)} is stale — it does not match what api_table.json generates.`);
    console.error('       Run: node tools/gen_dispatch.js');
    process.exit(1);
  }
  console.log(`dispatch table OK: 09b2-dispatch-table.generated.wat matches api_table.json (${N} APIs).`);
} else {
  fs.writeFileSync(outPath, result);
  console.error(`Written ${outPath} (${N} APIs)`);
}

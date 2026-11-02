#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// Remaining observed MDK2 misses; implemented families are checked separately below.
// Keep this observed set independent of the generator's availability predicate.
const unsupportedMdk2 = `
  glAreTexturesResident glClearIndex
  glColor4d glCopyPixels
   glDrawPixels glEdgeFlag glEdgeFlagPointer glEdgeFlagv
  glEvalCoord1d glEvalCoord1dv glEvalCoord1f glEvalCoord1fv glEvalCoord2d
  glEvalCoord2dv glEvalCoord2f glEvalCoord2fv glEvalMesh1 glEvalMesh2
  glEvalPoint1 glEvalPoint2 glFeedbackBuffer
   glGetMapdv
  glGetMapfv glGetMapiv glGetPixelMapfv
  glGetPixelMapuiv glGetPixelMapusv glGetPolygonStipple

   glIndexMask glIndexPointer glIndexd glIndexdv
  glIndexf glIndexfv glIndexi glIndexiv glIndexs
  glIndexsv glIndexub glIndexubv glInitNames glInterleavedArrays
  glLineStipple
  glLoadName glLogicOp glMap1d glMap1f
  glMap2d glMap2f glMapGrid1d glMapGrid1f glMapGrid2d
  glMapGrid2f
  glPassThrough glPixelMapfv glPixelMapuiv glPixelMapusv glPixelStoref
    glPixelZoom glPolygonStipple glPopName
  glPrioritizeTextures glPushName
  glRenderMode glSelectBuffer

  wglCopyContext wglCreateLayerContext
  wglShareLists wglUseFontBitmapsA wglUseFontOutlinesA
`.trim().split(/\s+/);

const texgenNumericQueryApis = ["glTexGend", "glTexGendv", "glTexGeniv", "glGetTexGendv", "glGetTexGenfv", "glGetTexGeniv"];

const integerLightMaterialFogApis = ["glFogiv", "glLightModelf", "glLightModeliv", "glLighti", "glLightiv", "glMaterialiv"];

const rasterPositionApis = `glRasterPos2d glRasterPos2dv glRasterPos2f glRasterPos2fv glRasterPos2i glRasterPos2iv glRasterPos2s glRasterPos2sv glRasterPos3d glRasterPos3dv glRasterPos3f glRasterPos3fv glRasterPos3i glRasterPos3iv glRasterPos3s glRasterPos3sv glRasterPos4d glRasterPos4dv glRasterPos4f glRasterPos4fv glRasterPos4i glRasterPos4iv glRasterPos4s glRasterPos4sv`.split(/\s+/);

async function main() {
  const extraWat = `
    ;; No PE is loaded by this harness. Initialize the thunk guest translation
    ;; exactly as the loader does before executing dynamically resolved calls.
    (func (export "lookup_init")
      (global.set $thunk_guest_base (i32.add (global.get $image_base)
        (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
      (call $update_thunk_end))
    (func (export "lookup_regs") (result i32) (global.get $reg_base))
    ;; Native color/list/software tests supply a context identity without a
    ;; browser drawable. Every color call still uses its resolved real thunk.
    (func (export "lookup_color_context") (call $gl_state_context_changed (i32.const 1)))
    (func (export "lookup_thunks") (result i32) (i32.atomic.load (global.get $THUNK_NEXT_SHARED)))
    (func (export "lookup_error") (result i32) (global.get $last_error))
    (func (export "lookup_module_kind") (param $module i32) (result i32)
      (call $static_sys_dll_from_handle (local.get $module)))
    (func (export "lookup_name_kind") (param $name i32) (result i32)
      (call $guest_name_is_static_system_dll (local.get $name)))
    (func (export "lookup_dc") (result i32)
      (call $handle_GetDC (i32.const 0) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "lookup_invoke") (param $thunk i32) (result i32)
      (global.set $last_error (i32.const 0))
      (call $win32_dispatch (i32.div_u
        (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
      (i32.load (global.get $reg_base)))
    (func (export "lookup_library") (param $name i32) (result i32)
      (local $esp i32)
      (local.set $esp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $esp))
      (i32.load (global.get $reg_base)))
    (func (export "lookup_static_gl_test") (param $module i32) (param $name i32) (result i32)
      (global.set $last_error (i32.const 0))
      (call $handle_GetProcAddress (local.get $module) (local.get $name)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "lookup_gl_test") (param $name i32) (result i32)
      (local $esp i32) (local $answer i32)
      (local.set $esp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_gpu_api (i32.const 50) (i32.const 1)
        (local.get $name) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (local.set $answer (i32.load (global.get $reg_base)))
      (if (i32.ne (i32.load offset=16 (global.get $reg_base))
          (i32.add (local.get $esp) (i32.const 8))) (then (unreachable)))
      (i32.store offset=16 (global.get $reg_base) (local.get $esp))
      (local.get $answer))`;
  const mutation = process.env.GL_LOOKUP_MUTATION;
  let prebuiltModule = null;
  if (mutation) {
    const { compileSrcWasm } = require('./compile-src');
    let changed = false;
    const bytes = compileSrcWasm((file, source) => {
      if (file === '13-exports.wat') return source + extraWat;
      if (file !== '09a0-handlers-base.wat') return source;
      const from = mutation === 'cleanup'
        ? '(global.set $last_error (i32.const 127)) ;; ERROR_PROC_NOT_FOUND\n        (br $gpa)'
        : '(call $gl_dynamic_api_unsupported (local.get $i))';
      const to = mutation === 'cleanup'
        ? '(global.set $last_error (i32.const 127)) ;; ERROR_PROC_NOT_FOUND\n        (return)'
        : mutation === 'all' ? '(i32.const 1)' : '(i32.const 0)';
      assert(source.includes(from), 'mutation anchor'); changed = true;
      return source.replace(from, to);
    });
    assert(changed); prebuiltModule = new WebAssembly.Module(bytes);
  }
  const { exports: e, memory } = await bootRenderHarness(prebuiltModule ? { prebuiltModule } : { extraWat });
  e.lookup_init();
  const toWasm = p => p - e.get_image_base() + e.get_guest_base();
  const table = require('../src/api_table.json');
  function string(name) {
    const bytes = Buffer.from(name + '\0');
    const p = e.guest_alloc(bytes.length);
    new Uint8Array(memory.buffer, toWasm(p), bytes.length).set(bytes);
    return p;
  }
  const lookup = name => e.lookup_gl_test(string(name)) >>> 0;
  for (const name of ['wglSwapIntervalEXT',
    'glLockArraysEXT', 'glUnlockArraysEXT',
    'GetTickCount', 'gluPerspective', 'glNotARealFunction', 'glactivetextureARB']) {
    assert.strictEqual(lookup(name), 0, `${name} must not be advertised`);
  }
  for (const name of ['glCopyTexImage1D','glCopyTexImage2D','glCopyTexSubImage1D','glCopyTexSubImage2D','glGetTexImage','glPixelTransferf','glPixelTransferi', 'glTexImage1D', 'glTexSubImage1D', 'glTexParameteriv', 'glGetLightfv', 'glGetLightiv', 'glGetMaterialfv', 'glGetMaterialiv', ...texgenNumericQueryApis, 'glClipPlane', 'glGetClipPlane', 'glTexEnvfv', 'glTexEnviv', 'glGetTexEnvfv', 'glGetTexEnviv', 'glGetTexParameteriv', ...integerLightMaterialFogApis, ...rasterPositionApis, 'glActiveTextureARB', 'glClientActiveTextureARB',
    'glMultiTexCoord2fARB', 'glTexParameterfv', 'glGetTexParameterfv',
    'glVertex2iv', 'glVertex2s', 'glVertex2sv',
    'glVertex3dv', 'glVertex3i', 'glVertex3iv', 'glVertex3s', 'glVertex3sv',
    'glVertex4d', 'glVertex4dv', 'glVertex4i', 'glVertex4iv', 'glVertex4s', 'glVertex4sv',
    'glTexCoord2d', 'glTexCoord2dv',
    'glColor3dv', 'glColor4dv', 'glRectf', 'glRectd', 'glRectdv', 'glAccum', 'glClearAccum',
    'glNormal3b', 'glNormal3bv', 'glNormal3d', 'glNormal3dv', 'glNormal3i', 'glNormal3iv', 'glNormal3s', 'glNormal3sv',
    'glTexCoord1d', 'glTexCoord1dv', 'glTexCoord1f', 'glTexCoord1fv', 'glTexCoord1i',
    'glTexCoord1iv', 'glTexCoord1s', 'glTexCoord1sv', 'glTexCoord2iv', 'glTexCoord2s',
    'glTexCoord2sv', 'glTexCoord3d', 'glTexCoord3dv', 'glTexCoord3f', 'glTexCoord3fv',
    'glTexCoord3i', 'glTexCoord3iv', 'glTexCoord3s', 'glTexCoord3sv', 'glTexCoord4d',
    'glTexCoord4dv', 'glTexCoord4i', 'glTexCoord4iv', 'glTexCoord4s', 'glTexCoord4sv', 'glRectfv', 'glRecti', 'glRectiv', 'glRects', 'glRectsv', 'glMultMatrixd', 'glLoadMatrixd', 'glTranslated', 'glScaled',
    'wglSwapLayerBuffers', 'wglGetCurrentContext', 'wglGetCurrentDC']) {
    const thunk = lookup(name);
    assert.notStrictEqual(thunk, 0, `${name} remains available`);
    assert.strictEqual(new DataView(memory.buffer).getUint32(toWasm(thunk) + 4, true),
      table.findIndex(api => api.name === name), `${name} dispatches to its real API`);
  }
  assert.strictEqual(e.lookup_gl_test(0), 0);
  const module = e.lookup_library(string('opengl32.dll')) >>> 0;
  assert(module, 'OpenGL has a native module identity');
  const kind = e.lookup_name_kind(string('opengl32.dll'));
  assert(kind, 'OpenGL is a supported static system module');
  assert.strictEqual(e.lookup_module_kind(module), kind, 'LoadLibrary returns the OpenGL identity');
  assert.strictEqual(e.lookup_library(string('OPENGL32')), module, 'stable case-insensitive module identity');
  assert.strictEqual(new DataView(memory.buffer).getUint16(toWasm(module), true), 0x5a4d, 'native module MZ header');
  const v = new DataView(memory.buffer), regs = e.lookup_regs(), stack = e.guest_alloc(128);
  function staticLookup(name) {
    const p = string(name);
    for (let i=0;i<8;i++) v.setUint32(regs+i*4, 0x55660000+i, true);
    v.setUint32(regs+16, stack, true);
    new Uint8Array(memory.buffer,toWasm(stack),128).fill(0xa5);
    const result = e.lookup_static_gl_test(module,p) >>> 0;
    assert.strictEqual(v.getUint32(regs+16,true),stack+12,'GetProcAddress stdcall ABI');
    for (let i=1;i<8;i++) if(i!==4) assert.strictEqual(v.getUint32(regs+i*4,true),0x55660000+i,'GPR preserved');
    assert(new Uint8Array(memory.buffer,toWasm(stack),128).every(x=>x===0xa5),'guest stack preserved');
    return result;
  }
  assert.strictEqual(unsupportedMdk2.length, 70, 'retain every still unsupported MDK2 name');
  for (const name of [...unsupportedMdk2, 'glLockArraysEXT','glUnlockArraysEXT','wglSwapIntervalEXT']) {
    const before=e.lookup_thunks();
    assert.strictEqual(lookup(name),0,`${name}: WGL must reject unsupported GL`);
    assert.strictEqual(e.lookup_thunks(),before,'WGL rejection allocates no thunk');
    assert.strictEqual(staticLookup(name),0,`${name}: SDL fallback must also reject unsupported GL`);
    assert.strictEqual(e.lookup_error(),127,'ERROR_PROC_NOT_FOUND');
    assert.strictEqual(e.lookup_thunks(),before,'rejection allocates no thunk');
  }
  for (const name of ['glGetBooleanv', 'glGetPointerv', 'glTexImage1D', 'glTexSubImage1D', 'glTexParameteriv', 'glGetLightfv', 'glGetLightiv', 'glGetMaterialfv', 'glGetMaterialiv', ...texgenNumericQueryApis, 'glClipPlane', 'glGetClipPlane', 'glTexEnvfv', 'glTexEnviv', 'glGetTexEnvfv', 'glGetTexEnviv', 'glGetTexParameteriv', ...integerLightMaterialFogApis, ...rasterPositionApis, 'glDrawElements','glDrawArrays','glMultMatrixd', 'glLoadMatrixd', 'glTranslated', 'glScaled','glAccum','glClearAccum','glNormal3b','glNormal3bv','glNormal3d','glNormal3dv','glNormal3i','glNormal3iv','glNormal3s','glNormal3sv',
    'glTexCoord1d', 'glTexCoord1dv', 'glTexCoord1f', 'glTexCoord1fv', 'glTexCoord1i',
    'glTexCoord1iv', 'glTexCoord1s', 'glTexCoord1sv', 'glTexCoord2iv', 'glTexCoord2s',
    'glTexCoord2sv', 'glTexCoord3d', 'glTexCoord3dv', 'glTexCoord3f', 'glTexCoord3fv',
    'glTexCoord3i', 'glTexCoord3iv', 'glTexCoord3s', 'glTexCoord3sv', 'glTexCoord4d',
    'glTexCoord4dv', 'glTexCoord4i', 'glTexCoord4iv', 'glTexCoord4s', 'glTexCoord4sv','wglGetProcAddress']) {
    const thunk=staticLookup(name);
    assert(thunk,`${name} remains available through SDL fallback`);
    assert.strictEqual(v.getUint32(toWasm(thunk)+4,true),table.findIndex(a=>a.name===name));
  }
  assert(staticLookup('GetTickCount'),'non-GL compatibility lookup preserved');
  assert.strictEqual(staticLookup('glNotARealFunction'),0);
  // Resolve and execute the returned thunks through the real Win32 dispatcher,
  // including both palette aliases. A nonzero pointer alone is insufficient.
  const output = e.guest_alloc(64);
  v.setUint32(regs+16, stack, true);
  const hdc = e.lookup_dc() >>> 0;
  assert(hdc, 'screen DC exists');
  for (const name of ['wglDescribeLayerPlane', 'wglGetLayerPaletteEntries',
    'wglSetLayerPaletteEntries', 'wglRealizeLayerPalette']) {
    const id = table.findIndex(a => a.name === name);
    for (const resolve of [staticLookup, lookup]) {
      const thunk = resolve(name);
      assert(thunk, `${name}: native layer-plane handler remains available`);
      assert.strictEqual(v.getUint32(toWasm(thunk)+4,true),id,`${name}: resolved API identity`);
      for (const [dc, plane, error] of [[hdc,1,87], [hdc,-1,87], [hdc,0,87], [0x1234,1,6]]) {
        const args = name === 'wglDescribeLayerPlane' ? [dc,1,plane,32,output]
          : name === 'wglRealizeLayerPalette' ? [dc,plane,1] : [dc,plane,0,16,output];
        for (let i=0;i<8;i++) v.setUint32(regs+i*4,0x55660000+i,true);
        v.setUint32(regs+16,stack,true);
        new Uint8Array(memory.buffer,toWasm(stack),128).fill(0xa5);
        v.setUint32(toWasm(stack),0x12345678,true);
        args.forEach((arg,i) => v.setUint32(toWasm(stack)+4+i*4,arg,true));
        const before = new Uint8Array(memory.buffer,toWasm(stack),128).slice();
        new Uint8Array(memory.buffer,toWasm(output),64).fill(0xcc);
        assert.strictEqual(e.lookup_invoke(thunk),0,`${name}: no layer or invalid DC fails`);
        assert.strictEqual(e.lookup_error(),error,`${name}: existing native failure error`);
        assert.strictEqual(v.getUint32(regs+16,true),stack+4*(args.length+1),`${name}: stdcall cleanup`);
        for (let i=1;i<8;i++) if(i!==4)
          assert.strictEqual(v.getUint32(regs+i*4,true),0x55660000+i,`${name}: GPR preserved`);
        assert.deepStrictEqual(new Uint8Array(memory.buffer,toWasm(stack),128),before,`${name}: stack bytes preserved`);
        assert(new Uint8Array(memory.buffer,toWasm(output),64).every(x=>x===0xcc),`${name}: no output on failure`);
      }
    }
  }
  require('./gl-integer-color-cases').exerciseIntegerColors({e,memory,regs,stack,toWasm,staticLookup,lookup,hdc});
  if (!mutation) {
    const { spawnSync } = require('child_process');
    for (const variant of ['missing','all','cleanup']) {
      const r=spawnSync(process.execPath,[__filename],{env:{...process.env,GL_LOOKUP_MUTATION:variant},encoding:'utf8',timeout:120000});
      assert.strictEqual(r.status,1,`${variant} must fail acceptance: ${r.stderr}`);
      assert(/AssertionError/.test(r.stderr),`${variant} must fail an assertion: ${r.stderr}`);
      console.log(`Rejected broken ${variant} lookup variant`);
    }
  }
  console.log('WGL procedure availability and thunk identities pass');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

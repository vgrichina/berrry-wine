# OpenGL 1.1 rectangle aliases — 2026-11-02

Implemented the seven observed MDK2 misses: `glRectd`, `glRectdv`,
`glRectfv`, `glRecti`, `glRectiv`, `glRects`, and `glRectsv`.
Their existing API IDs remain unchanged. Both dynamic lookup routes now
resolve real handlers; no new command opcode or JavaScript consumer was needed.

Primary analysis preceded shared edits and execution.
[OpenGL 1.1, 4 March 1997](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
§2.9 defines the ordered four-corner polygon; §2.6.3 restricts Begin/End
commands; §5.4 specifies pointer dereferencing when commands are issued.
The static analysis and independent pixel plan are retained in
`scratch/runs/20261102-gl-rectangle-family/`.

The adapters read signed integer coordinates numerically. Scalar shorts use
the signed low16 bits of DWORD argument slots; vectors use tightly packed
elements. Scalar doubles consume all eight argument words and pop36 bytes
including the return address. Double vectors pop12 bytes. Page-aware loads
validate mappings and wraparound before encoding. Both corners are captured
into invocation-owned storage and demoted at the existing packed-f32 vertex
boundary, then canonical opcode142 owns list capture and atomic execution.
`glRectf`, accumulation, readPixels and presentation implementations are unchanged.

The new full-source fixture resolves actual GetProcAddress/WGL thunks, checks
API IDs, stdcall cleanup, preserved registers/stack and vector memory, and
reads native software pixels. Direct and queued routes each pass132 checks
plus two negative controls. Coverage includes signed16/32 endpoints and
short upper-word junk, scalar-double stack width, unaligned page-crossing
vectors, pointer mutation after compilation, both list modes, winding,
replay color/texture/normal/transforms, invalid pointers and invalid direct/
replayed Begin without disturbing the caller's pending triangle. Literal8×8
masks and interior/exterior triangle pixels supply independent expectations.

The exact final fixture with committed-old WAT from
`47d4a08225a9c3c41b33bd5602cb935b71ca7278` passes the glRectf control then
fails glRectd resolution, in both routes. In-memory production mutations
(unsigned short load and duplicate rectangle corner) fail the pixel assertions.
No checkout source was changed for those controls.

The existing isolated rectangle/color/texcoord fixtures needed two maintenance
repairs: strip an inline export before parsing a parameter signature, and
provide drawable-selection seams in tests that exercise no buffer-selection
commands. Their production conversion/list/rectangle code remains under test;
the new full-source fixture uses the real drawable interceptors.

Tested identity:
- Source base: `bbe53ca507d58f830ea94f107b56fc8f7990a006` plus the exact
  SHA256 input manifest in `tested-input.json`.
- Both full-source test modules:
  `3f10baa76040c15a98c79ca553caa0d814c42262ed04d68697f91fb15120bf25`
  (2,031,272 bytes; test exports included).
- Exact test SHA256:
  `b95290e7888df1e72f418a82ac0d88096f1078e9c8d595e0961a89394a5d1456`.
- `direct.identity.json` and `queued.identity.json` retain complete compiler/
  source identities. Build and publication identities are recorded separately
  in the same run directory. These test modules are not the shipping module.

Limitations preserved from the canonical path: the native software scanline
rasterizer can emit a row for a horizontal zero-height rectangle; alias output
is checked against glRectf, not presented as corrected polygon degeneracy.
Existing shadow-Begin list validation reports the rejected rectangle during
compilation; this preserves current behavior rather than claiming complete
OpenGL list error-timing conformance. Renderer precision remains packed f32.

Both required predecessor terminal/result/final author releases were consumed
in order, with31 GTA and242 MDK helpers independently absent before ownership.
No original MDK2, browser, boat, download, optimization, deployment or Codex
worker launch occurred. Local queued raster threads were joined by their
test managers. Box ID/state/expiry N/A; coordinator lifecycle unchanged.

The observed remaining unsupported set is181 names, independently exercised
through both lookup routes by `test/test-wgl-proc-availability.js`.
This includes accumulation; mandatory exports still prevent original replay:

```text
glAccum glAreTexturesResident glClearAccum glClearIndex glClipPlane
glColor4d glCopyPixels glCopyTexImage1D glCopyTexImage2D glCopyTexSubImage1D
glCopyTexSubImage2D glDrawPixels glEdgeFlag glEdgeFlagPointer glEdgeFlagv
glEvalCoord1d glEvalCoord1dv glEvalCoord1f glEvalCoord1fv glEvalCoord2d
glEvalCoord2dv glEvalCoord2f glEvalCoord2fv glEvalMesh1 glEvalMesh2
glEvalPoint1 glEvalPoint2 glFeedbackBuffer glFogiv glGetBooleanv
glGetClipPlane glGetDoublev glGetLightfv glGetLightiv glGetMapdv
glGetMapfv glGetMapiv glGetMaterialfv glGetMaterialiv glGetPixelMapfv
glGetPixelMapuiv glGetPixelMapusv glGetPointerv glGetPolygonStipple glGetTexEnvfv
glGetTexEnviv glGetTexGendv glGetTexGenfv glGetTexGeniv glGetTexImage
glGetTexParameteriv glIndexMask glIndexPointer glIndexd glIndexdv
glIndexf glIndexfv glIndexi glIndexiv glIndexs
glIndexsv glIndexub glIndexubv glInitNames glInterleavedArrays
glLightModelf glLightModeliv glLighti glLightiv glLineStipple
glLoadMatrixd glLoadName glLogicOp glMap1d glMap1f
glMap2d glMap2f glMapGrid1d glMapGrid1f glMapGrid2d
glMapGrid2f glMaterialiv glNormal3b glNormal3bv glNormal3d
glNormal3dv glNormal3i glNormal3iv glNormal3s glNormal3sv
glPassThrough glPixelMapfv glPixelMapuiv glPixelMapusv glPixelStoref
glPixelTransferf glPixelTransferi glPixelZoom glPolygonStipple glPopName
glPrioritizeTextures glPushName glRasterPos2d glRasterPos2dv glRasterPos2fv
glRasterPos2i glRasterPos2iv glRasterPos2s glRasterPos2sv glRasterPos3d
glRasterPos3dv glRasterPos3f glRasterPos3fv glRasterPos3i glRasterPos3iv
glRasterPos3s glRasterPos3sv glRasterPos4d glRasterPos4dv glRasterPos4f
glRasterPos4fv glRasterPos4i glRasterPos4iv glRasterPos4s glRasterPos4sv
glRenderMode glScaled glSelectBuffer glTexCoord1d glTexCoord1dv
glTexCoord1f glTexCoord1fv glTexCoord1i glTexCoord1iv glTexCoord1s
glTexCoord1sv glTexCoord2iv glTexCoord2s glTexCoord2sv glTexCoord3d
glTexCoord3dv glTexCoord3f glTexCoord3fv glTexCoord3i glTexCoord3iv
glTexCoord3s glTexCoord3sv glTexCoord4d glTexCoord4dv glTexCoord4i
glTexCoord4iv glTexCoord4s glTexCoord4sv glTexEnvfv glTexEnviv
glTexGend glTexGendv glTexGeniv glTexImage1D glTexParameteriv
glTexSubImage1D glTranslated glVertex2iv glVertex2s glVertex2sv
glVertex3dv glVertex3i glVertex3iv glVertex3s glVertex3sv
glVertex4d glVertex4dv glVertex4i glVertex4iv glVertex4s
glVertex4sv wglCopyContext wglCreateLayerContext wglShareLists wglUseFontBitmapsA
wglUseFontOutlinesA
```

Evidence: `scratch/runs/20261102-gl-rectangle-family/` contains actual waits,
baseline/mutation logs, direct/queued identities, focused regressions, locked
build, publication verification, cleanup and final result. This is bounded
fixture evidence, with no MDK2 startup or gameplay claim.


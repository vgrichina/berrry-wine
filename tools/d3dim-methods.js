// d3dim-methods.js — shared spec of Direct3D Immediate Mode interface methods
// Consumed by gen_api_table.js (API identities/aliases) and gen_dispatch.js
// (COM vtable order). Runtime bodies are hand-maintained in src/09aa and 09ab.
//
// nargs documents the stdcall argument count (including `this`), not the
// generic handler-frame width. It does not generate runtime stack cleanup.

'use strict';

// Each entry: { prefix, methods: [ { name, nargs, handler? } ] }
// handler aliases dispatch directly to an existing shared implementation.
//
// Interface lists below are canonical DX5/6/7 orderings (Wine + DXSDK consensus).
// IDs allocated via gen_api_table.js (existing.length-based, contiguous per interface).

const interfaces = [
  // ── IDirect3D2 ──────────────────────────────────────────────────────
  { prefix: 'IDirect3D2', methods: [
    { name: 'QueryInterface', nargs: 3, handler: 'IDirect3D_QueryInterface' },
    { name: 'AddRef',         nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',        nargs: 1, handler: 'dx_com_release_basic' },
    { name: 'EnumDevices',    nargs: 3 },
    { name: 'CreateLight',    nargs: 3 },
    { name: 'CreateMaterial', nargs: 3 },
    { name: 'CreateViewport', nargs: 3 },
    { name: 'FindDevice',     nargs: 3 },
    { name: 'CreateDevice',   nargs: 4 },
  ]},

  // ── IDirect3D7 ──────────────────────────────────────────────────────
  { prefix: 'IDirect3D7', methods: [
    { name: 'QueryInterface',           nargs: 3, handler: 'IDirect3D_QueryInterface' },
    { name: 'AddRef',                   nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',                  nargs: 1, handler: 'dx_com_release_basic' },
    { name: 'EnumDevices',              nargs: 3 },
    { name: 'CreateDevice',             nargs: 4 },
    { name: 'CreateVertexBuffer',       nargs: 4 },
    { name: 'EnumZBufferFormats',       nargs: 4, handler: 'IDirect3D3_EnumZBufferFormats' },
    { name: 'EvictManagedTextures',     nargs: 1 },
  ]},

  // ── IDirect3DDevice (v1) ────────────────────────────────────────────
  { prefix: 'IDirect3DDevice', methods: [
    { name: 'QueryInterface',     nargs: 3 },
    { name: 'AddRef',             nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',            nargs: 1 },
    { name: 'Initialize',         nargs: 4 },
    { name: 'GetCaps',            nargs: 3 },
    { name: 'SwapTextureHandles', nargs: 3 },
    { name: 'CreateExecuteBuffer', nargs: 4 },
    { name: 'GetStats',           nargs: 2 },
    { name: 'Execute',            nargs: 4 },
    { name: 'AddViewport',        nargs: 2 },
    { name: 'DeleteViewport',     nargs: 2 },
    { name: 'NextViewport',       nargs: 4 },
    { name: 'Pick',               nargs: 5 },
    { name: 'GetPickRecords',     nargs: 3 },
    { name: 'EnumTextureFormats', nargs: 3, handler: 'IDirect3DDevice2_EnumTextureFormats' },
    { name: 'CreateMatrix',       nargs: 2 },
    { name: 'SetMatrix',          nargs: 3 },
    { name: 'GetMatrix',          nargs: 3 },
    { name: 'DeleteMatrix',       nargs: 2 },
    { name: 'BeginScene',         nargs: 1 },
    { name: 'EndScene',           nargs: 1 },
    { name: 'GetDirect3D',        nargs: 2 },
  ]},

  // ── IDirect3DDevice2 ────────────────────────────────────────────────
  { prefix: 'IDirect3DDevice2', methods: [
    { name: 'QueryInterface',          nargs: 3 },
    { name: 'AddRef',                  nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',                 nargs: 1 },
    { name: 'GetCaps',                 nargs: 3 },
    { name: 'SwapTextureHandles',      nargs: 3 },
    { name: 'GetStats',                nargs: 2 },
    { name: 'AddViewport',             nargs: 2 },
    { name: 'DeleteViewport',          nargs: 2 },
    { name: 'NextViewport',            nargs: 4 },
    { name: 'EnumTextureFormats',      nargs: 3 },
    { name: 'BeginScene',              nargs: 1 },
    { name: 'EndScene',                nargs: 1 },
    { name: 'GetDirect3D',             nargs: 2 },
    { name: 'SetCurrentViewport',      nargs: 2 },
    { name: 'GetCurrentViewport',      nargs: 2 },
    { name: 'SetRenderTarget',         nargs: 3 },
    { name: 'GetRenderTarget',         nargs: 2 },
    { name: 'Begin',                   nargs: 4 },
    { name: 'BeginIndexed',            nargs: 6 },
    { name: 'Vertex',                  nargs: 2 },
    { name: 'Index',                   nargs: 2 },
    { name: 'End',                     nargs: 2 },
    { name: 'GetRenderState',          nargs: 3 },
    { name: 'SetRenderState',          nargs: 3 },
    { name: 'GetLightState',           nargs: 3 },
    { name: 'SetLightState',           nargs: 3 },
    { name: 'SetTransform',            nargs: 3 },
    { name: 'GetTransform',            nargs: 3 },
    { name: 'MultiplyTransform',       nargs: 3 },
    { name: 'DrawPrimitive',           nargs: 6 },
    { name: 'DrawIndexedPrimitive',    nargs: 8 },
    { name: 'SetClipStatus',           nargs: 2 },
    { name: 'GetClipStatus',           nargs: 2 },
  ]},

  // ── IDirect3DDevice7 ────────────────────────────────────────────────
  { prefix: 'IDirect3DDevice7', methods: [
    { name: 'QueryInterface',                nargs: 3 },
    { name: 'AddRef',                        nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',                       nargs: 1 },
    { name: 'GetCaps',                       nargs: 2 },
    { name: 'EnumTextureFormats',            nargs: 3, handler: 'IDirect3DDevice3_EnumTextureFormats' },
    { name: 'BeginScene',                    nargs: 1 },
    { name: 'EndScene',                      nargs: 1 },
    { name: 'GetDirect3D',                   nargs: 2 },
    { name: 'SetRenderTarget',               nargs: 3 },
    { name: 'GetRenderTarget',               nargs: 2 },
    { name: 'Clear',                         nargs: 7 },
    { name: 'SetTransform',                  nargs: 3, handler: 'IDirect3DDevice2_SetTransform' },
    { name: 'GetTransform',                  nargs: 3 },
    { name: 'SetViewport',                   nargs: 2 },
    { name: 'MultiplyTransform',             nargs: 3 },
    { name: 'GetViewport',                   nargs: 2 },
    { name: 'SetMaterial',                   nargs: 2 },
    { name: 'GetMaterial',                   nargs: 2 },
    { name: 'SetLight',                      nargs: 3 },
    { name: 'GetLight',                      nargs: 3 },
    { name: 'SetRenderState',                nargs: 3 },
    { name: 'GetRenderState',                nargs: 3 },
    { name: 'BeginStateBlock',               nargs: 1 },
    { name: 'EndStateBlock',                 nargs: 2 },
    { name: 'PreLoad',                       nargs: 2 },
    // These three were one dword short. Cross-check: the hand-written
    // IDirect3DDevice3 twins in 09a8-handlers-directx.wat pop 28 and 36 for
    // the same two signatures, and DrawPrimitiveStrided/DrawPrimitiveVB here
    // already carry the 6/8 shape. A short pop is not cosmetic -- the caller
    // returns through its own first argument.
    { name: 'DrawPrimitive',                 nargs: 6 },
    { name: 'DrawIndexedPrimitive',          nargs: 8 },
    { name: 'SetClipStatus',                 nargs: 2 },
    { name: 'GetClipStatus',                 nargs: 2 },
    { name: 'DrawPrimitiveStrided',          nargs: 6 },
    { name: 'DrawIndexedPrimitiveStrided',   nargs: 8 },
    { name: 'DrawPrimitiveVB',               nargs: 6 },
    { name: 'DrawIndexedPrimitiveVB',        nargs: 8 },
    { name: 'ComputeSphereVisibility',       nargs: 6 },
    { name: 'GetTexture',                    nargs: 3 },
    { name: 'SetTexture',                    nargs: 3 },
    { name: 'GetTextureStageState',          nargs: 4, handler: 'IDirect3DDevice3_GetTextureStageState' },
    { name: 'SetTextureStageState',          nargs: 4, handler: 'IDirect3DDevice3_SetTextureStageState' },
    { name: 'ValidateDevice',                nargs: 2, handler: 'IDirect3DDevice3_ValidateDevice' },
    { name: 'ApplyStateBlock',               nargs: 2 },
    { name: 'CaptureStateBlock',             nargs: 2 },
    { name: 'DeleteStateBlock',              nargs: 2 },
    { name: 'CreateStateBlock',              nargs: 3 },
    { name: 'Load',                          nargs: 7 },
    { name: 'LightEnable',                   nargs: 3 },
    { name: 'GetLightEnable',                nargs: 3 },
    { name: 'SetClipPlane',                  nargs: 3 },
    { name: 'GetClipPlane',                  nargs: 3 },
    { name: 'GetInfo',                       nargs: 4 },
  ]},

  // ── IDirect3DViewport (v1) ──────────────────────────────────────────
  { prefix: 'IDirect3DViewport', methods: [
    { name: 'QueryInterface',       nargs: 3 },
    { name: 'AddRef',               nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',              nargs: 1 },
    { name: 'Initialize',           nargs: 2 },
    { name: 'GetViewport',          nargs: 2 },
    { name: 'SetViewport',          nargs: 2 },
    { name: 'TransformVertices',    nargs: 5 },
    { name: 'LightElements',        nargs: 3 },
    { name: 'SetBackground',        nargs: 2 },
    { name: 'GetBackground',        nargs: 3 },
    { name: 'SetBackgroundDepth',   nargs: 2 },
    { name: 'GetBackgroundDepth',   nargs: 3 },
    { name: 'Clear',                nargs: 4 },
    { name: 'AddLight',             nargs: 2 },
    { name: 'DeleteLight',          nargs: 2 },
    { name: 'NextLight',            nargs: 4 },
  ]},

  // ── IDirect3DViewport2 ──────────────────────────────────────────────
  { prefix: 'IDirect3DViewport2', methods: [
    { name: 'QueryInterface',       nargs: 3, handler: 'IDirect3DViewport_QueryInterface' },
    { name: 'AddRef',               nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',              nargs: 1, handler: 'IDirect3DViewport_Release' },
    { name: 'Initialize',           nargs: 2 },
    { name: 'GetViewport',          nargs: 2 },
    { name: 'SetViewport',          nargs: 2 },
    { name: 'TransformVertices',    nargs: 5 },
    { name: 'LightElements',        nargs: 3 },
    { name: 'SetBackground',        nargs: 2 },
    { name: 'GetBackground',        nargs: 3 },
    { name: 'SetBackgroundDepth',   nargs: 2 },
    { name: 'GetBackgroundDepth',   nargs: 3 },
    { name: 'Clear',                nargs: 4 },
    { name: 'AddLight',             nargs: 2 },
    { name: 'DeleteLight',          nargs: 2 },
    { name: 'NextLight',            nargs: 4 },
    { name: 'GetViewport2',         nargs: 2 },
    { name: 'SetViewport2',         nargs: 2 },
  ]},

  // ── IDirect3DMaterial (v1) ──────────────────────────────────────────
  { prefix: 'IDirect3DMaterial', methods: [
    { name: 'QueryInterface', nargs: 3 },
    { name: 'AddRef',         nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',        nargs: 1 },
    { name: 'Initialize',     nargs: 2 },
    { name: 'SetMaterial',    nargs: 2 },
    { name: 'GetMaterial',    nargs: 2 },
    { name: 'GetHandle',      nargs: 3 },
    { name: 'Reserve',        nargs: 1 },
    { name: 'Unreserve',      nargs: 1 },
  ]},

  // ── IDirect3DMaterial2 ──────────────────────────────────────────────
  { prefix: 'IDirect3DMaterial2', methods: [
    { name: 'QueryInterface', nargs: 3, handler: 'IDirect3DMaterial_QueryInterface' },
    { name: 'AddRef',         nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',        nargs: 1, handler: 'IDirect3DMaterial_Release' },
    { name: 'SetMaterial',    nargs: 2 },
    { name: 'GetMaterial',    nargs: 2 },
    { name: 'GetHandle',      nargs: 3 },
  ]},

  // ── IDirect3DExecuteBuffer ──────────────────────────────────────────
  { prefix: 'IDirect3DExecuteBuffer', methods: [
    { name: 'QueryInterface',  nargs: 3 },
    { name: 'AddRef',          nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',         nargs: 1 },
    { name: 'Initialize',      nargs: 3 },
    { name: 'Lock',            nargs: 2 },
    { name: 'Unlock',          nargs: 1 },
    { name: 'SetExecuteData',  nargs: 2 },
    { name: 'GetExecuteData',  nargs: 2 },
    { name: 'Validate',        nargs: 5 },
    { name: 'Optimize',        nargs: 2 },
  ]},

  // ── IDirect3DVertexBuffer ───────────────────────────────────────────
  { prefix: 'IDirect3DVertexBuffer', methods: [
    { name: 'QueryInterface',      nargs: 3 },
    { name: 'AddRef',              nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',             nargs: 1 },
    { name: 'Lock',                nargs: 4 },
    { name: 'Unlock',              nargs: 1 },
    { name: 'ProcessVertices',     nargs: 8 },
    { name: 'GetVertexBufferDesc', nargs: 2 },
    { name: 'Optimize',            nargs: 3 },
  ]},

  // ── IDirect3DVertexBuffer7 ──────────────────────────────────────────
  { prefix: 'IDirect3DVertexBuffer7', methods: [
    { name: 'QueryInterface',         nargs: 3 },
    { name: 'AddRef',                 nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',                nargs: 1, handler: 'IDirect3DVertexBuffer_Release' },
    { name: 'Lock',                   nargs: 4, handler: 'IDirect3DVertexBuffer_Lock' },
    { name: 'Unlock',                 nargs: 1 },
    { name: 'ProcessVertices',        nargs: 8, handler: 'IDirect3DVertexBuffer_ProcessVertices' },
    { name: 'GetVertexBufferDesc',    nargs: 2, handler: 'IDirect3DVertexBuffer_GetVertexBufferDesc' },
    { name: 'Optimize',               nargs: 3 },
    { name: 'ProcessVerticesStrided', nargs: 8 },
  ]},

  // ── IDirect3DTexture (v1) ───────────────────────────────────────────
  { prefix: 'IDirect3DTexture', methods: [
    { name: 'QueryInterface',  nargs: 3 },
    { name: 'AddRef',          nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',         nargs: 1 },
    { name: 'Initialize',      nargs: 3 },
    { name: 'GetHandle',       nargs: 3 },
    { name: 'PaletteChanged',  nargs: 3 },
    { name: 'Load',            nargs: 2 },
    { name: 'Unload',          nargs: 1 },
  ]},

  // ── IDirect3DTexture2 ───────────────────────────────────────────────
  { prefix: 'IDirect3DTexture2', methods: [
    { name: 'QueryInterface',  nargs: 3 },
    { name: 'AddRef',          nargs: 1, handler: 'dx_com_addref' },
    { name: 'Release',         nargs: 1 },
    { name: 'GetHandle',       nargs: 3, handler: 'IDirect3DTexture_GetHandle' },
    { name: 'PaletteChanged',  nargs: 3 },
    { name: 'Load',            nargs: 2 },
  ]},
];

// Vtable globals registered with gen_dispatch.js. Order matches declaration in
// 01-header / 09a8 globals block (prefix → global name, no `extends` needed
// since IM interfaces don't inherit via prefix-match in our scheme).
const vtableGlobals = [
  { prefix: 'IDirect3D2',              global: 'DX_VTBL_D3D2' },
  { prefix: 'IDirect3D7',              global: 'DX_VTBL_D3D7' },
  { prefix: 'IDirect3DDevice',         global: 'DX_VTBL_D3DDEV1' },
  { prefix: 'IDirect3DDevice2',        global: 'DX_VTBL_D3DDEV2' },
  { prefix: 'IDirect3DDevice7',        global: 'DX_VTBL_D3DDEV7' },
  { prefix: 'IDirect3DViewport',       global: 'DX_VTBL_D3DVP1' },
  { prefix: 'IDirect3DViewport2',      global: 'DX_VTBL_D3DVP2' },
  { prefix: 'IDirect3DMaterial',       global: 'DX_VTBL_D3DMAT1' },
  { prefix: 'IDirect3DMaterial2',      global: 'DX_VTBL_D3DMAT2' },
  { prefix: 'IDirect3DExecuteBuffer',  global: 'DX_VTBL_D3DEXEC' },
  { prefix: 'IDirect3DVertexBuffer',   global: 'DX_VTBL_D3DVB' },
  { prefix: 'IDirect3DVertexBuffer7',  global: 'DX_VTBL_D3DVB7' },
  { prefix: 'IDirect3DTexture',        global: 'DX_VTBL_D3DTEX' },
  { prefix: 'IDirect3DTexture2',       global: 'DX_VTBL_D3DTEX2' },
];

// api_table.json is append-only, so a method discovered late cannot be moved
// into its ABI slot. Give the vtable generator the normative COM order; it
// patches any slot whose stable API id is no longer sequential.
for (const vtable of vtableGlobals) {
  const iface = interfaces.find(candidate => candidate.prefix === vtable.prefix);
  vtable.methods = iface.methods.map(method => method.name);
}

module.exports = { interfaces, vtableGlobals };

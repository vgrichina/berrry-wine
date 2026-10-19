'use strict';
// Independent COM prototypes/slot order from Wine include/ddraw.h, d3d.h,
// unknwn.idl. Counts INCLUDE this, unlike C++ method declarations.
// This is a test contract, not generated from emulator API metadata.
const common = { 0: ['QueryInterface', 3], 1: ['AddRef', 1], 2: ['Release', 1] };
const interfaces = {
  ddraw: { ...common, 6: ['CreateSurface', 4], 8: ['EnumDisplayModes', 5],
    9: ['EnumSurfaces', 5], 12: ['GetDisplayMode', 2], 19: ['RestoreDisplayMode', 1],
    20: ['SetCooperativeLevel', 3], 21: ['SetDisplayMode', null] },
  surface: { ...common, 9: ['EnumAttachedSurfaces', 3], 12: ['GetAttachedSurface', 3],
    14: ['GetCaps', 2], 22: ['GetSurfaceDesc', 2], 23: ['Initialize', 3],
    25: ['Lock', 5], 32: ['Unlock', 2], 39: ['SetSurfaceDesc', 3] },
  texture: { ...common },
};
function methodAt(family, slot, version) {
  const entry = interfaces[family]?.[slot];
  if (!entry) throw Error(`unreviewed COM slot ${family}:${slot}`);
  const [name, fixedCount] = entry;
  if (family === 'ddraw' && name === 'SetDisplayMode' && ![1, 2, 4, 7].includes(version))
    throw Error('SetDisplayMode needs an independently tracked DirectDraw version');
  const nargs = fixedCount ?? (version === 1 ? 4 : 6);
  const prefix = family === 'ddraw' ? 'IDirectDraw' : family === 'texture'
    ? 'IDirect3DTexture2' : name === 'SetSurfaceDesc' ? 'IDirectDrawSurface3' : 'IDirectDrawSurface';
  return { name: `${prefix}_${name}`, nargs, pop: 4 * (nargs + 1) };
}
function methodArity(apiName, version) {
  for (const [family, slots] of Object.entries(interfaces)) {
    for (const slot of Object.keys(slots)) {
      // Only SetDisplayMode is version-dependent; avoid evaluating it for
      // unrelated API names whose interface version is intentionally absent.
      if (family === 'ddraw' && Number(slot) === 21 && apiName !== 'IDirectDraw_SetDisplayMode') continue;
      const entry = methodAt(family, slot, version);
      if (entry.name === apiName) return entry.nargs;
    }
  }
  throw Error(`unreviewed COM API ${apiName}`);
}
module.exports = { interfaces, methodAt, methodArity };

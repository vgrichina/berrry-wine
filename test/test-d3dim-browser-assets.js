#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { APPS, appFileUrl } = require('../lib/apps');
const { isLoadableDll, dllPath } = require('../lib/dll-registry');

const root = path.join(__dirname, '..');
const generatedDispatch = fs.readFileSync(
  path.join(root, 'src', '09b2-dispatch-table.generated.wat'), 'utf8');
const directxHandlers = fs.readFileSync(
  path.join(root, 'src', '09a8-handlers-directx.wat'), 'utf8');

assert(directxHandlers.includes('(func $set_com_vtable_slot_api_id'),
  'DirectX must provide a helper for stable API ids whose COM slot is non-sequential');
assert(generatedDispatch.includes(
  '(call $set_com_vtable_slot_api_id (global.get $DX_VTBL_D3DDEV7) (i32.const 20) (i32.const 1394))'),
  'IDirect3DDevice7 slot 20 must dispatch SetRenderState');
assert(generatedDispatch.includes(
  '(call $set_com_vtable_slot_api_id (global.get $DX_VTBL_D3DDEV7) (i32.const 37) (i32.const 1382))'),
  'IDirect3DDevice7 slot 37 must dispatch SetTextureStageState');

assert.strictEqual(isLoadableDll('D3DXOF.DLL'), true,
  'browser DLL policy must recognize the retained-mode .x loader');
assert.strictEqual(dllPath('d3dxof.dll'), 'binaries/dlls/d3dxof.dll');
assert(fs.existsSync(path.join(root, dllPath('d3dxof.dll'))),
  'the registered d3dxof DLL must be present');

const viewerFiles = APPS.dx_viewer.files;
// Original DX5 Viewer inputs, pinned by the recovery recipe in
// docs/re-notes/dx-sdk-d3drm-samples.md. Renamed ProgressiveMesh copies and
// synthetic fixture overrides must not satisfy the original-scene manifest.
const expectedMeshes = new Map([
  ['camera.x', [2820, '1c56daf9d94fa31c3a721d69d07d223c44ebe1972914af497da40dd251295383']],
  ['mslogo.x', [146596, 'bbe967bbe686d5b3bc25979b70abf2d8ce6aea4b821f4ced9ca59d7902a6727d']],
  ['sphere2.x', [21092, '804a4b79b7de03ed529bc7af7e9a904278956d6c052c9b81cc617ce703d633be']],
]);
for (const [name, [bytes, sha256]] of expectedMeshes) {
  const url = `binaries/dx-sdk/bin/${name}`;
  const vfsPath = `c:\\${name}`;
  assert(viewerFiles.some(file => appFileUrl(file).toLowerCase() === url),
    `Viewer must mount the recovered original ${name}`);
  assert(!viewerFiles.some(file => file && typeof file === 'object' &&
    file.vfsPath?.toLowerCase() === vfsPath && appFileUrl(file).toLowerCase() !== url),
    `Viewer must not replace ${name} with a synthetic fixture alias`);
  assert(fs.existsSync(path.join(root, url)), `${url} must exist`);
  const mesh = fs.readFileSync(path.join(root, url));
  assert.strictEqual(mesh.length, bytes, `${name} must retain its original SDK size`);
  assert.strictEqual(crypto.createHash('sha256').update(mesh).digest('hex'), sha256,
    `${name} must be the recovered original SDK mesh`);
}

console.log('PASS D3DIM browser manifests load retained-mode DLL and valid Viewer meshes');

'use strict';
const assert=require('node:assert/strict');
const {install}=require('../tools/oasaver-presentation-observer.cjs');
async function controls(){
  let calls=0;
  const root={WebAssembly:{Module:WebAssembly.Module,instantiate:async(m,i)=>{assert.equal(i.host.gdi_surface_upload(7,0,0,10,10),1);return {exports:{}};}}};
  const original=root.WebAssembly.instantiate,restore=install(root);
  const bytes=Buffer.from([0,97,115,109,1,0,0,0]);
  const imports={host:{gdi_surface_upload:()=>{calls++;return 1;}}};
  await root.WebAssembly.instantiate(new WebAssembly.Module(bytes),imports);
  assert.equal(calls,1);assert.equal(root.__oaPresentation.calls.gdi_surface_upload.returned,1);
  assert.equal(root.__oaPresentation.instances[0].instantiated,true);
  assert.equal(root.__oaPresentation.instances[0].moduleSha256,null,'compiled Module is not byte identity');
  assert.equal(root.__oaPresentation.rows[0].boundary,'host-import-return');
  imports.host.gdi_surface_upload=()=>{throw Error('failure');};
  await assert.rejects(root.WebAssembly.instantiate(bytes,imports),/failure/);
  assert.equal(root.__oaPresentation.calls.gdi_surface_upload.returned,1,'failed import cannot count as completion');
  restore();assert.equal(root.WebAssembly.instantiate,original);
  console.log('presentation observer return/unknown/error/restoration PASS');
}
module.exports={controls};
if(require.main===module)controls().catch(e=>{console.error(e);process.exitCode=1;});

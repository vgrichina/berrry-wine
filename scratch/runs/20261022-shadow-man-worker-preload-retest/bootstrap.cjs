'use strict';
// Synthetic imports/exports ONLY for the offline PNG boundary fixture.
if(require('worker_threads').isMainThread){
 const ROOT='/home/user/shadow-man-tools-ready-oct22/runtime';
 require(ROOT+'/lib/host-imports').createHostImports=()=>({});
 WebAssembly.instantiate=async()=>({instance:{exports:{get_image_base:()=>0,get_esp:()=>0x1000,get_eax:()=>1}}});
}

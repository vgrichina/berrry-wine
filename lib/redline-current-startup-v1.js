'use strict';
// Explicit primary CPU build; never a replacement for the legacy default.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else Object.defineProperty(root,'RedlineCurrentStartupV1',{value:api});
})(globalThis,function(){
 return Object.freeze({version:'redline-startup-3e491c08-v1',
  SELECTED:Object.freeze({sha256:'3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18',bytes:2186068}),
  publishedModuleCommit:'5c8780318afbbe0e5a4e7c64190f2e0abde21cd0'});
});

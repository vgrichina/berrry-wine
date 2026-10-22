'use strict';
// Copied diagnostic runner only: one hook and observer per WASM instance.
// Install hook.log_eip in that instance's imports, bind once after instantiation.
// Do not close over a mutable runner-global `instance` or reuse across workers.
module.exports = function instanceHook(createObserver, emit, region, instanceId) {
  let context;
  const observer=createObserver(x=>emit({instanceId,...x}),region);
  return {
    bind(exports,memory,translate) {
      if(context)throw Error('instance hook already bound');
      context={exports,memory,translate};
    },
    log_eip(ip) {
      if(!context)throw Error('unbound instance hook');
      const {exports:e,memory:m,translate:tr}=context;
      if((e.get_eip()>>>0)!==(ip>>>0))throw Error('instance/EIP context mismatch');
      observer.block(ip,e,m,tr);
    },
    api(name,phase) {
      if(!context)throw Error('unbound instance hook');
      const {exports:e,memory:m,translate:tr}=context;
      observer.api(name,e,m,tr,phase);
    },
  };
};

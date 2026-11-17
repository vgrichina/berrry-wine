'use strict';
// Observation guard only: refuse existing success stubs before their bodies.
// Originals, guest memory and return registers are never patched.
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.NEVERHOOD_EVIDENCE_DIR;
if (!root) throw new Error('explicit evidence destination required');
const instantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function (module, imports) {
  let instance;
  if (imports?.host?.memory && imports.host.log) {
    const h = imports.host, log = h.log;
    h.log = function(ptr, len) {
      const name = Buffer.from(h.memory.buffer, ptr, Math.min(len, 256)).toString('ascii').replace(/\0.*$/, '');
      if (name === 'DirectXSetup') {
        const e = instance?.exports;
        const receipt = {boundary:name, action:'STOP_BEFORE_EXISTING_SUCCESS_STUB',
          handlerExecuted:false, eip:e?.get_eip(), esp:e?.get_esp(),
          eax:e?.get_eax(), stack:e?.guest_read32 ? Array.from({length:8},(_,i)=>e.guest_read32(e.get_esp()+i*4)>>>0):null,
          at:new Date().toISOString()};
        fs.writeFileSync(path.join(root, 'unsupported-boundary-'+process.pid+'.json'), JSON.stringify(receipt,null,2), {flag:'wx'});
        throw new Error('ORIGINAL_UNSUPPORTED_BOUNDARY: '+name+'; existing success stub was not executed');
      }
      return log.apply(this, arguments);
    };
  }
  const result = await instantiate.call(WebAssembly, module, imports);
  instance = result.instance || result;
  return result;
};

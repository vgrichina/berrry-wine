'use strict';
// Node adapter; the same observer core runs inside the browser owner.
const fs=require('node:fs'),path=require('node:path');
const core=require('../lib/quake2-owning-load-core');
function attach(options) {
  return core.attach({...options,canonicalBytes:fs.readFileSync(path.resolve(__dirname,'..',core.EXE))});
}
module.exports={...core,attach};

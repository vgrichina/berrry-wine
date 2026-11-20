'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
// Call the selected exported body explicitly. Module._compile adapters are
// libraries, so their require.main guard cannot start an independent release.
async function runLocalRelease(out,file,selectRelease=()=>require('./gltron-browser-controller.cjs').release){
  assert(out&&file,'release output directory and config required');
  const cfg=JSON.parse(fs.readFileSync(file));
  const release=selectRelease(cfg);
  assert.equal(typeof release,'function','actual exported release body required');
  return release(out,file);
}
module.exports={runLocalRelease};
if(require.main===module)runLocalRelease(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});

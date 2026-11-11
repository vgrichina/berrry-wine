'use strict';
// Finalize only a newly staged graph. Runtime response checks remain mandatory.
const fs = require('node:fs');
const {prepareHttpPins} = require('./mw3-runtime-http-pins.cjs');
function finalize(pins, root) { return prepareHttpPins(pins, root); }
module.exports = {finalize};
if (require.main === module) {
  const [input, root] = process.argv.slice(2);
  const prepared = finalize(JSON.parse(fs.readFileSync(input)), root);
  // Caller owns this freshly generated manifest; exclusive temp then rename.
  const temp = input + '.prepared.tmp';
  fs.writeFileSync(temp, JSON.stringify(prepared, null, 2)+'\n', {flag:'wx'});
  fs.renameSync(temp,input);
}

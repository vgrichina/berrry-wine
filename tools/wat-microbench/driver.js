// Shell driver for tools/wat-microbench: runs in node, d8, sm (js) and jsc.
//   <shell> driver.js -- <module.wasm> <calls> <k>        (d8, jsc)
//   sm driver.js <module.wasm> <calls> <k>
//   node driver.js <module.wasm> <calls> <k>
// Compiles and instantiates the module, calls run(k) `calls` times and prints
// `CHECKSUM <u32>` from the last call. Timing is the caller's job (process CPU
// time, see run.js); nothing here reads a clock.
/* global scriptArgs, arguments, readbuffer, read, readFile, os, print */
var shellArgs = typeof arguments !== 'undefined' ? arguments : undefined;  // d8/jsc global, read before the IIFE shadows it
(function () {
  var argv;
  if (typeof process !== 'undefined' && process.argv) argv = process.argv.slice(2);
  else if (typeof scriptArgs !== 'undefined') argv = scriptArgs;
  else argv = shellArgs;
  var file = argv[0], calls = argv[1] | 0, k = argv[2] | 0;
  var bytes;
  if (typeof process !== 'undefined' && process.argv) bytes = require('fs').readFileSync(file);
  else if (typeof readbuffer === 'function') bytes = readbuffer(file);
  else if (typeof os !== 'undefined' && os.file) bytes = os.file.readFile(file, 'binary');
  else if (typeof readFile === 'function') bytes = readFile(file, 'binary');
  else bytes = read(file, 'binary');
  var out = typeof print === 'function' ? print : console.log;
  var inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), {});
  var run = inst.exports.run, r = 0;
  for (var c = 0; c < calls; c++) r = run(k);
  out('CHECKSUM ' + (r >>> 0));
})();

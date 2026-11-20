'use strict';
// Reuse the qualified controls verbatim, selecting the Hexen public adapter at
// the test module boundary. The production Q2 module and mechanism stay intact.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const adapter=require('../tools/hexen2-native-consumption-input.cjs');
const filename=path.join(__dirname,'test-browser-reviewed-frame-equivalence.cjs');
const controls=new Module(filename,module);
controls.filename=filename;controls.paths=module.paths;
const original=controls.require.bind(controls);
controls.require=name=>name==='../tools/quake2-native-consumption-input.cjs'?
  {...adapter,createQuake2Session:adapter.createHexenSession}:original(name);
controls._compile(fs.readFileSync(filename,'utf8'),filename);

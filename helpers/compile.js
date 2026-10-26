const fs=require('fs'),crypto=require('crypto');
const wasm=require('/tmp/civ2-win16-ordinary-gameplay-oct26/source/test/compile-src.js').compileSrcWasm();
const sha256=crypto.createHash('sha256').update(wasm).digest('hex');
if(wasm.length!==1880280||sha256!=='f3f3cd439c50a2bc441de67c5f138e32cc060186d84d37d85de2b200ca806d75')throw Error('module identity mismatch');
fs.writeFileSync('/tmp/civ2-win16-footprint-recovered-gameplay-oct26/canonical.wasm',wasm);
console.log(JSON.stringify({bytes:wasm.length,sha256,compiler:'test/compile-src.js compileSrcWasm()',transform:null}));

const fs=require('fs'),crypto=require('crypto');
const wasm=require('./source/test/compile-src.js').compileSrcWasm();
fs.writeFileSync('/tmp/civ2-win16-ordinary-gameplay-oct26/canonical.wasm',wasm);
console.log(JSON.stringify({bytes:wasm.length,sha256:crypto.createHash('sha256').update(wasm).digest('hex'),compiler:'test/compile-src.js compileSrcWasm()',transform:null,root:'src/main.watx'}));

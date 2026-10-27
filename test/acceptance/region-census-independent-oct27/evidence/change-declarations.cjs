'use strict';
const fs=require('fs'),path=require('path'),read=fs.readFileSync;
let once=false;
fs.readFileSync=function(file,...args){
 const text=read.call(this,file,...args);
 if(!once && path.basename(String(file))==='host.js'){
  once=true;const target=path.join(path.dirname(String(file)),'src/00-regions.wat');
  fs.appendFileSync(target,"\n(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))\n");
  fs.writeFileSync(path.join(path.dirname(String(file)),'mutation-fired.json'),JSON.stringify({trigger:'host.js read after declarations/layout',target,mutation:"\n(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))\n"}));
 }
 return text;
};

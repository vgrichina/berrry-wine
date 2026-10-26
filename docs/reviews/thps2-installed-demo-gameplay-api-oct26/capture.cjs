'use strict';
const fs=require('fs'), assert=require('assert');
const {PNG}=require('../runner/node_modules/pngjs');
const helper=require('./lossless-capture-png.cjs');
const original=fs.writeFileSync;let frames=0,total=0,terminal=null;
fs.writeFileSync=function(file,data,...args){
 if(terminal)throw terminal;
 if(typeof file==='string'&&file.endsWith('.png')){
  try{data=helper.encode(PNG,data);assert(++frames<=3,'capture frame limit');total+=data.length;assert(total<=393216,'capture cumulative byte limit');
   process.stderr.write(`[capture] lossless frame=${frames} bytes=${data.length} total=${total}\n`);
  }catch(e){terminal=e;process.stderr.write(`[capture] TERMINAL ${e.stack}\n`);throw e;}
 }
 return original.call(this,file,data,...args);
};

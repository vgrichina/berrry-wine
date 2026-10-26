'use strict';
const fs=require('fs'), assert=require('assert'),crypto=require('crypto');
const {PNG}=require('../runner/node_modules/pngjs');
const helper=require('./lossless-capture-png.cjs');
const original=fs.writeFileSync;let frames=0,total=0,terminal=null;
fs.writeFileSync=function(file,data,...args){
 if(terminal)throw terminal;
 if(typeof file==='string'&&file.endsWith('.png')){
  try{assert(data.length<=2097152,'capture source byte limit');
   const png=PNG.sync.read(data,{checkCRC:true});assert(png.width<=640&&png.height<=480,'task capture dimensions');
   const metadata={at:new Date().toISOString(),requestedPhase:file.split('/').pop(),width:png.width,height:png.height,rgbaSHA256:crypto.createHash('sha256').update(png.data).digest('hex')};
   fs.appendFileSync('/tmp/thps2-installed-demo-gameplay-api-oct26/guest/frame-metadata.jsonl',JSON.stringify(metadata)+'\n');
   if(!file.endsWith('/final.png')){process.stderr.write('[capture] metadata checkpoint only; no PNG retained '+JSON.stringify(metadata)+'\n');return;}
   data=helper.encode(PNG,data,'single-frame');assert(++frames<=1,'capture frame limit');total+=data.length;assert(total<=1294816,'task cumulative byte limit');
   process.stderr.write(`[capture] lossless frame=${frames} bytes=${data.length} total=${total}\n`);
  }catch(e){terminal=e;process.stderr.write(`[capture] TERMINAL ${e.stack}\n`);throw e;}
 }
 return original.call(this,file,data,...args);
};

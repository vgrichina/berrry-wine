'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const {scanWat}=require(path.join(root,'tools/callback-ownership-census.js'));
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'pinned-callback-ownership-census.json')));
const files=['src/13-exports.wat','src/09c3a-dialog-runtime.wat','src/09b-dispatch.wat'];
const changes=[];let count=0;
for(const file of files)for(const e of scanWat(fs.readFileSync(path.join(root,file),'utf8'),file)){
  count++;const known=base.entries.find(x=>x.file===e.file&&x.name===e.name);
  if(!known||known.sha256!==e.sha256)changes.push({file:e.file,name:e.name,status:known?'changed producer hash':'unknown producer',old:known?.sha256,new:e.sha256});
}
if(changes.length!==4)throw Error('expected four direct census changes');
const result={exit:0,scope:'direct scanWat of three edited fragments against exact unchanged candidate baseline; NOT full census',count,changes,fullCensus:'Mandatory hash check would fail until reviewed ledger reconciliation. No baseline regenerated.'};
fs.writeFileSync(path.join(__dirname,'census-delta.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const PINS=Object.freeze({
 iso:['scratch/media/neverhood-original.iso',651438080,'94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3'],
 pe:['test/binaries/dlls/comctl32.dll',577808,'28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'],
 ne:['test/binaries/sims-native-common-controls/kommctrl.dll',155136,'39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9'],
 setupx:['scratch/runs/20261116-neverhood-original-install-after-setupx/inputs/setupx.dll',745168,'6cd5c194743fdf676112c0808b724a78f8f8650a54059d046a15fe270f5f55f4']
});
function verify(){
 const rows={};for(const [name,[path,size,digest]] of Object.entries(PINS)){
  const b=fs.readFileSync(path);assert.equal(b.length,size,path);assert.equal(sha(b),digest,path);
  rows[name]={path,size,sha256:digest};
 }
 const lib=require('../lib/iso9660'),image=fs.readFileSync(PINS.iso[0]),iso=lib.parseIso(image);
 const files=iso.files.filter(f=>!f.isDirectory);assert.equal(files.length,257);
 const members=[['SETUP95.EXE',202240,'ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e'],
 ['setup/DSETUP6E.DLL',45104,'a3feb8e3a947d8c6b6c594b80b5c0db0c5bd26968f3d749c27781cb60d6c7d7d']];
 for(const [name,size,digest]of members){const entry=lib.findEntry(iso,name);assert(entry,name);const b=lib.readEntry(iso,entry);assert.equal(b.length,size);assert.equal(sha(b),digest);}
 return {inputs:rows,files:files.map(f=>({path:f.path,size:f.length,sha256:sha(lib.readEntry(iso,f))})),members,completeCD:true};
}
module.exports={verify,PINS};
if(require.main===module)console.log(JSON.stringify(verify(),null,2));

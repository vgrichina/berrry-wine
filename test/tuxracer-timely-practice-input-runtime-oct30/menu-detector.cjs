'use strict';
const fs=require('fs'), {PNG}=require('pngjs');
const ref=PNG.sync.read(fs.readFileSync('/home/user/tuxracer-render/capture-practice-publication-oct30/main-menu.png'));
const cur=PNG.sync.read(fs.readFileSync(process.argv[2]));
if(cur.width!==640||cur.height!==480)throw Error('dimensions');
let expected=0,matched=0;
for(let y=246;y<274;y++)for(let x=255;x<385;x++){
 const i=(y*640+x)*4,white=(a)=>a[i]>245&&a[i+1]>245&&a[i+2]>245;
 if(white(ref.data)){expected++;if(white(cur.data))matched++;}
}
if(expected<100)throw Error('reference mask');
console.log(JSON.stringify({menu:matched/expected>.92,expected,matched,ratio:matched/expected}));

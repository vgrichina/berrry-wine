'use strict';
// Read-only visible-state discriminator. Text silhouettes and button geometry
// survive the tiny animated eyes; there is no whole-image/hash admission rule.
const assert=require('node:assert/strict');
const MAIN_LABELS=[['Solo',[240,123,40,20]],['Multiplay',[265,183,76,20]],['Buy Nox Now!',[283,247,119,23]],['Credits',[350,307,65,23]],['Options',[190,442,65,21]],['Quit',[393,442,45,21]]];
function validate(spec){
 assert(spec&&['main','reviewed'].includes(spec.kind),'explicit menu kind');
 assert(Array.isArray(spec.rect)&&spec.rect.length===4&&spec.rect.every(Number.isInteger),'state geometry');
 const [x,y,w,h]=spec.rect;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=640&&y+h<=480,'state bounds');
 assert(Array.isArray(spec.labels)&&spec.labels.length>=2&&spec.labels.length<=20,'visible menu labels required');
 if(spec.kind==='main'){assert.deepEqual(spec.labels,MAIN_LABELS,'all six main menu labels and geometry required');assert.deepEqual(spec.rect,[130,110,400,250],'main menu/modal area required');}
 for(const [name,r] of spec.labels){assert(typeof name==='string'&&name.trim(),'named visible label');assert(r.length===4&&r.every(Number.isInteger)&&r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0&&r[0]+r[2]<=640&&r[1]+r[3]<=480,'label bounds');}
}
// Self-contained to run in the actual owning page, or against recovered pixels.
function describe(data,spec){
 if(data.length!==640*480*4)throw Error('640x480 original pixels required');
 const labels=spec.labels.map(([name,[x,y,w,h]])=>{let mask='',count=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*640+i)*4,r=data[p],g=data[p+1],b=data[p+2],v=r>=180&&g>=120&&b<100&&r>=g*.95;mask+=v?'1':'0';count+=v?1:0;}return {name,mask,count};});
 const [sx,sy,sw,sh]=spec.rect,geometry=[];
 // Per 8px cell: dark area, red button fill, and neutral metal edges. Small
 // eye sprites change a few occupancies, whereas dialogs replace many cells.
 for(let y=sy;y<sy+sh;y+=8)for(let x=sx;x<sx+sw;x+=8){let dark=0,red=0,metal=0,n=0;for(let j=y;j<Math.min(y+8,sy+sh);j++)for(let i=x;i<Math.min(x+8,sx+sw);i++){const p=(j*640+i)*4,r=data[p],g=data[p+1],b=data[p+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);n++;dark+=hi<16;red+=r>60&&r>g*1.6&&r>b*1.6;metal+=lo>90&&hi-lo<35;}geometry.push([dark,red,metal,n]);}
 let greenTitle=0,blackModal=0;
 for(let y=160;y<300;y++)for(let x=240;x<400;x++){const p=(y*640+x)*4,r=data[p],g=data[p+1],b=data[p+2];greenTitle+=g>150&&r<100&&b<100;blackModal+=Math.max(r,g,b)<8;}
 return {version:1,labels,geometry,greenTitle,blackModal};
}
function healthy(v){assert.equal(v.version,1);for(const label of v.labels)assert(label.count>=12,'missing visible menu text: '+label.name);assert(v.greenTitle<12,'unexpected green modal/title overlay');}
function compare(reference,current){
 healthy(reference);healthy(current);assert.equal(reference.labels.length,current.labels.length);
 for(let i=0;i<reference.labels.length;i++){assert.equal(current.labels[i].name,reference.labels[i].name);assert.equal(current.labels[i].mask,reference.labels[i].mask,'visible menu text/geometry changed: '+reference.labels[i].name);}
 assert.equal(reference.geometry.length,current.geometry.length);let changed=0,total=0;
 for(let i=0;i<reference.geometry.length;i++){const a=reference.geometry[i],b=current.geometry[i];assert.equal(a[3],b[3]);for(let k=0;k<3;k++){const delta=Math.abs(a[k]-b[k]);assert(delta<=Math.min(24,a[3]),'button/modal geometry changed');changed+=delta;}total+=a[3];}
 assert(changed<=total*.001,'menu geometry changed beyond small sprite animation');
 assert(Math.abs(reference.blackModal-current.blackModal)<=32,'unexpected dark modal body');
 return {textLabels:current.labels.map(v=>v.name),geometryClassChanges:changed,area:total,greenTitle:current.greenTitle};
}
function reviewed(bytes,canvas,spec){
 validate(spec);const {PNG}=require('../node_modules/pngjs/lib/png.js'),im=PNG.sync.read(bytes,{checkCRC:true}),r=canvas?.rect;
 assert(canvas?.width===640&&canvas.height===480&&r,'reviewed original canvas geometry');
 const s=Math.min(r.width/640,r.height/480),left=r.left+(r.width-640*s)/2,top=r.top+(r.height-480*s)/2;
 assert(s>=1&&left>=0&&top>=0&&left+640*s<=im.width&&top+480*s<=im.height,'recoverable reviewed pixels');
 const data=new Uint8Array(640*480*4);for(let y=0;y<480;y++)for(let x=0;x<640;x++){const p=(Math.floor(top+(y+.5)*s)*im.width+Math.floor(left+(x+.5)*s))*4;data.set(im.data.subarray(p,p+4),(y*640+x)*4);}
 const value=describe(data,spec);healthy(value);return value;
}
module.exports={MAIN_LABELS,validate,describe,healthy,compare,reviewed};

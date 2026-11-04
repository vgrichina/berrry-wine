'use strict';
// Offline original-demo menu boundary. Uses personally reviewed retained pixels.
const {PNG}=require('pngjs');
const {sha256,assertGeometry,projectNative}=require('./native-start-boundary.cjs');
const patches=[
 {scene:'main-menu',box:[190,344,220,30],sha256:'af17c4f3210918760eb2fb7fac479fd40d6ef68f6d0c976d9bd46ca493903073'},
 {scene:'crusader-type',box:[235,340,420,35],sha256:'1d414967a82a43f7f0b9a5228e1ca6f3c73595f2e3159e6436941e21c09b3fed'},
];
function scene(png){
 const p=PNG.sync.read(png);if(p.width!==1200||p.height!==900)throw Error('unsupported menu geometry');
 const found=patches.filter(s=>{const [x,y,w,h]=s.box,b=Buffer.alloc(w*h*3);let k=0;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const o=(j*p.width+i)*4;if(p.data[o+3]!==255)throw Error('nonopaque menu');for(let c=0;c<3;c++)b[k++]=p.data[o+c];}return sha256(b)===s.sha256;});
 return found.length===1?found[0].scene:'unknown';
}
function mainToCrusader(png,geometry){
 if(scene(png)!=='main-menu')throw Error('personally reviewed main menu required');assertGeometry(geometry);
 return {control:'Crusader',native:{x:304,y:144},client:projectNative(geometry,304,144),expected:'crusader-type'};
}
function assertTransition(png,expected){if(scene(png)!==expected)throw Error('first unexpected menu state: '+scene(png)+'; expected '+expected);}
module.exports={scene,mainToCrusader,assertTransition};

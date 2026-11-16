#!/usr/bin/env node
'use strict';
// Replay trusted local command captures. Initial color is transparent black;
// this is diagnostic output, not proof of equivalence to uncaptured history.
const fs=require('fs'),path=require('path'),v8=require('v8'),crypto=require('crypto');
const puppeteer=require('puppeteer'),{PNG}=require('pngjs');
const {OPCODES:O}=require('../lib/d3d-command-stream');
(async()=>{
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw new Error('usage: node tools/d3d-replay-web.js capture/frame.v8 output.png');
 const frame=v8.deserialize(fs.readFileSync(input));
 if(frame.version!==1||!frame.complete||!Array.isArray(frame.commands))throw new Error('complete version1 capture required');
 if(frame.commands.some(c=>![O.DRAW,O.CLEAR,O.PRESENT].includes(c.opcode)))throw new Error('capture needs unsupported resource/history replay');
 const present=frame.commands.at(-1);
 if(present.opcode!==O.PRESENT)throw new Error('capture must end in Present');
 const {width,height}=present.payload;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216)throw new Error('invalid target dimensions');
 const assets={},encode=value=>{
  if(ArrayBuffer.isView(value)){
   const bytes=Buffer.from(value.buffer,value.byteOffset,value.byteLength),hash=crypto.createHash('sha256').update(bytes).digest('hex');
   assets[hash]??=bytes.toString('base64');return {captureType:value.constructor.name,asset:hash};
  }
  if(Array.isArray(value))return value.map(encode);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
  return value;
 };
 const commands=encode(frame.commands);
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['gpu-backend.js','d3d-shader-ir.js','d3d9-shader.js','d3d9-backend.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
  const result=await page.evaluate(({commands,assets,width,height})=>{
   const buffers={};for(const [id,data]of Object.entries(assets))buffers[id]=Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer;
   const types={Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,DataView};
   const decode=value=>{
    if(value?.captureType){const T=types[value.captureType];if(!T)throw Error('unknown captured array type');return new T(buffers[value.asset]);}
    if(Array.isArray(value))return value.map(decode);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)]));
    return value;
   };
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const d=new D3D9Backend.Device(canvas,{webglVersion:2}),g=d.gpu,gl=g.gl;
   try{
    d.clear([0,0,0,0],1);
    let draws=0;
    for(const {opcode,payload}of decode(commands)){
     if(opcode===5){d.draw(payload);draws++;}
     else if(opcode===6)throw Error('CLEAR replay requires explicit payload handling');
    }
    const bytes=g.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(width*height*4));
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {pixels:btoa(binary),draws,error:g.getError()};
   }finally{d.destroy();}
  },{commands,assets,width,height});
  if(result.error)throw new Error('WebGL error '+result.error);
  const pixels=Buffer.from(result.pixels,'base64'),png=new PNG({width,height});
  for(let y=0;y<height;y++)pixels.copy(png.data,y*width*4,(height-y-1)*width*4,(height-y)*width*4);
  fs.writeFileSync(output,PNG.sync.write(png));
  console.log(JSON.stringify({output,width,height,draws:result.draws,uniqueAssets:Object.keys(assets).length,initialColor:'transparent black'}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

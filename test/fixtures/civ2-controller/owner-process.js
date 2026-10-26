'use strict';
// Offline process competitor: no guest or transport is ever created.
const fs=require('fs'),path=require('path');
const {createController,launchController}=require('../../../tools/civ2-serial-controller');
const [configFile,mode,ready,go,release]=process.argv.slice(2),cfg=JSON.parse(fs.readFileSync(configFile));
fs.writeFileSync(ready,'ready');
const timer=setInterval(async()=>{
 if(!fs.existsSync(go))return;clearInterval(timer);let launches=0;
 try{
  if(mode==='launcher')await launchController(cfg,{launch:async()=>{launches++;}});
  else createController(cfg).start();
  console.log(JSON.stringify({started:true,launches,pid:process.pid}));
  const hold=setInterval(()=>{if(fs.existsSync(release)){clearInterval(hold);}},2);
 }catch(e){console.log(JSON.stringify({started:false,launches,error:e.message,pid:process.pid}));}
},2);

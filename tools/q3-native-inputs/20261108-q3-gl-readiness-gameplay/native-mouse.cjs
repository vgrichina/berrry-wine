'use strict';
const assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function validate(c){
 assert(['click','doubleclick','drag'].includes(c.action),'ordinary mouse action');
 for(const p of c.action==='drag'?[c.point,c.to]:[c.point])assert(p?.length===2&&p.every(v=>Number.isFinite(v)&&v>0&&v<1),'normalized canvas point');
 assert(c.holdMs===undefined||Number.isInteger(c.holdMs)&&c.holdMs>=100&&c.holdMs<=1500,'bounded mouse hold');
}
async function perform({send,session,geometry:g,command:c}){
 validate(c);assert([g.left,g.top,g.width,g.height].every(Number.isFinite)&&g.width>0&&g.height>0,'native canvas geometry');
 const point=p=>({x:g.left+g.width*p[0],y:g.top+g.height*p[1]});
 const start=point(c.point),end=point(c.to||c.point),holdMs=c.holdMs??(c.action==='drag'?700:150),rows=[];
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...start,buttons:0},session);
 for(let count=1;count<=(c.action==='doubleclick'?2:1);count++){
  let release,releaseAt,error,position=start;const started=Date.now();
  const up=()=>{if(!release){releaseAt=Date.now();release=send('Input.dispatchMouseEvent',{type:'mouseReleased',...position,button:'left',buttons:0,clickCount:count},session);}return release;};
  const timer=setTimeout(()=>up().catch(()=>{}),holdMs);
  try{
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',buttons:1,clickCount:count},session);
   assert(!release,'mouse delivery exceeded hold bound');
   if(c.action==='drag')for(let n=1;n<=5;n++){
    await wait(holdMs/8);assert(!release,'mouse move exceeded hold bound');
    position={x:start.x+(end.x-start.x)*n/5,y:start.y+(end.y-start.y)*n/5};
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...position,button:'left',buttons:1},session);
   }
   await wait(Math.max(0,holdMs-(Date.now()-started)));
  }catch(e){error=e;}finally{clearTimeout(timer);await up();}
  rows.push({started,releaseAt,position,holdMs});if(error){error.mouseReceipt=rows;throw error;}
 }
 return {action:c.action,rows,independentRelease:true,route:'native CDP'};
}
module.exports={validate,perform};

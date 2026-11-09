'use strict';
const assert=require('node:assert/strict');

// The review binds pixels and the lock state from that same capture. A later
// scene cannot inherit an earlier menu's input coordinate system.
function plan({capture,locked,command,point}){
 assert.equal(typeof capture?.pointerLocked,'boolean','reviewed capture lock state required');
 assert.equal(typeof locked,'boolean','current pointer-lock state required');
 assert.equal(locked,capture.pointerLocked,'pointer lock changed since reviewed capture');
 const mouse=['click','doubleclick','drag'].includes(command.action);
 if(command.action==='relative'||(mouse&&locked)){
  assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'last submitted CDP position required');
  if(command.action==='relative'){
   assert(locked,'native pointer lock required');
   assert(Number.isInteger(command.dx)&&Number.isInteger(command.dy)&&Math.abs(command.dx)<=24&&Math.abs(command.dy)<=24&&(command.dx||command.dy),'small integer relative counts');
   return {route:'relative',pointerLocked:locked};
  }
  assert(command.action==='click'&&command.cursorOnly===true,'locked absolute mouse target refused; review cursor then use cursorOnly click');
  assert.equal(command.holdMs,150,'menu click retains 150ms hold');
  return {route:'cursorOnly',pointerLocked:locked};
 }
 if(mouse)assert(!command.cursorOnly,'current-cursor click requires pointer lock');
 return {route:mouse?'absolute':command.action,pointerLocked:locked};
}
function integrate(source){
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'one current-lock planning seam: '+a);source=source.replace(a,b);};
 replace("save(label+'-mouse-events.json',await evaluate('({events:globalThis.__nativeMouseEvents,locked:document.pointerLockElement===document.getElementById(\"screen\")})'));",
  "const menuBefore=await evaluate('({events:globalThis.__nativeMouseEvents,locked:document.pointerLockElement===document.getElementById(\"screen\")})');save(label+'-mouse-events.json',menuBefore);");
 replace('latest=shot.capture;',"const menuLocked=await evaluate(\"document.pointerLockElement===document.getElementById('screen')\");assert.equal(menuLocked,menuBefore.locked,'pointer lock changed during capture');latest={...shot.capture,pointerLocked:menuLocked};");
 replace('assert.equal(review.sha256,latest.sha256);assert(review.review?.trim());',"assert.equal(review.sha256,latest.sha256);assert.equal(review.pointerLocked,latest.pointerLocked,'reviewed capture lock binding');assert(review.review?.trim());");
 replace('const dispatch=async receipt=>{\n markDispatch();',
  `const dispatch=async receipt=>{
 const menuPlan=require(root+'/tools/redline-menu-planning.cjs').plan({capture:latest,locked:await evaluate("document.pointerLockElement===document.getElementById('screen')"),command:c,point:cdpMousePoint});
 save('input-'+c.id+'-plan.json',{...menuPlan,reviewRef:c.reviewRef,sha256:latest.sha256});
 markDispatch();`);
 return source;
}
module.exports={plan,integrate};

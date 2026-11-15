'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const diagnostic=require('../tools/quake3-visibility-controller.cjs'),base=require('../tools/quake3-browser-controller.cjs');
function fixture(){
 const elements=[],rect={left:0,top:0,right:100,bottom:100,width:100,height:100};
 function make(id,tag='DIV',parent=null){const e={id,tagName:tag,isConnected:true,parentElement:parent,childNodes:[],namespaceURI:'http://www.w3.org/1999/xhtml',
  getBoundingClientRect(){return {...rect,toJSON(){return {...rect};}};},contains(o){for(let p=o;p;p=p.parentElement)if(p===this)return true;return false;}};elements.push(e);return e;}
 const wrap=make('screen-wrap'),canvas=make('screen','CANVAS',wrap),overlay=make('overlay','DIV',wrap);
 const c=vm.createContext({Date,crypto:require('node:crypto').webcrypto,innerWidth:100,innerHeight:100,devicePixelRatio:1,crossOriginIsolated:true,
  getComputedStyle:(e,pseudo)=>({display:'block',visibility:'visible',opacity:'1',position:'static',overflowX:'visible',overflowY:'visible',backgroundColor:'rgba(0, 0, 0, 0)',backgroundImage:'none',boxShadow:'none',backdropFilter:'none',outlineStyle:'none',content:pseudo?'none':undefined,...e.style}),
  document:{visibilityState:'visible',fullscreenElement:wrap,hasFocus:()=>true,querySelector:()=>null,querySelectorAll:q=>q==='*'?elements:[],elementsFromPoint:()=>[canvas,wrap],getElementById:()=>canvas},
  runningApps:[{name:'fixture',wine:{running:true,renderer:{canvas,windows:{},peekKeyDownState:k=>k===1?0x8000:0}}}]});
 return {c,wrap,canvas,overlay};
}
test('diagnostics retain exact guard outcome and physical operands, emit before refusal',()=>{
 const f=fixture(),rows=[];f.c[diagnostic.BINDING]=s=>rows.push(JSON.parse(s));
 const read=diagnostic.controller().PAGE_READ;
 const result=vm.runInContext(read,f.c),old=vm.runInContext(base.PAGE_READ,f.c);
 assert.equal(result.apps[0].outputVisible,old.apps[0].outputVisible);assert.equal(rows.length,1);
 const o=result.apps[0].outputVisibility.operands;
 assert.equal(o.fullscreen.id,'screen-wrap');assert.equal(o.fullscreenContainsOutput,true);assert.equal(o.output.id,'screen');assert.equal(o.samples.length,5);assert.equal(o.intersecting[0].element.id,'overlay');
 assert.equal(rows[0].apps[0].physical[0].state,0x8000);
 f.overlay.style={backgroundColor:'red'};
 assert.throws(()=>vm.runInContext(diagnostic.controller().readinessExpression({}),f.c),/startup owner\/output/);
 assert.equal(rows.length,2);assert.equal(rows[1].apps[0].outputVisibility.reason,'intersecting painted DOM box');
});
test('disconnected or missing output remains refused; no diagnostic admission',()=>{
 const f=fixture();f.canvas.isConnected=false;f.c[diagnostic.BINDING]=()=>{};
 assert.equal(vm.runInContext(diagnostic.controller().PAGE_READ,f.c).apps[0].outputVisible,false);
 f.c.runningApps[0].wine.renderer.canvas=null;
 const r=vm.runInContext(diagnostic.controller().PAGE_READ,f.c);assert.equal(r.apps[0].outputVisible,false);assert.equal(r.apps[0].outputVisibility.operands.output,null);
});
test('composition preserves owner, freshness, terminal, physical-UP and capture implementation',()=>{
 const source=fs.readFileSync('tools/quake3-browser-controller.cjs','utf8'),changed=diagnostic.compose(source);new vm.Script(changed);
 for(const phrase of ['startup owner/output not live and fully visible','input owner/output not live and fully visible','capture owner/output not live and fully visible','_validateCurrentDisplayCapture','MAX_AGE_MS = 30000','1750','3000'])assert(changed.includes(phrase));
 assert.throws(()=>diagnostic.compose(source.replace('const outputVisibility=visibility(output);','const outputVisibility=false;')),/anchor/);
 assert.throws(()=>diagnostic.compose(source.replace('c.event=v=>{','c.event = v => {')),/anchor/);
});
test('diagnostic and original visibility decisions agree for fullscreen, clipping and occlusion negatives',()=>{
 for(const kind of ['valid-fullscreen','outside-fullscreen-overlay','inside-overlay','modal','popover','hidden-output','translucent-ancestor','clipped-ancestor','outside-viewport','not-fullscreen']){
  const f=fixture();f.c[diagnostic.BINDING]=()=>{};
  if(kind==='outside-fullscreen-overlay'){f.overlay.parentElement=null;f.overlay.style={backgroundColor:'red',pointerEvents:'none'};}
  if(kind==='inside-overlay')f.overlay.style={backgroundColor:'red',pointerEvents:'none'};
  if(['modal','popover'].includes(kind))f.c.document.querySelector=()=>f.overlay;
  if(kind==='hidden-output')f.canvas.style={visibility:'hidden'};
  if(kind==='translucent-ancestor')f.wrap.style={opacity:'0.5'};
  if(kind==='clipped-ancestor'){f.wrap.style={overflowX:'hidden'};f.wrap.getBoundingClientRect=()=>({left:0,right:50,top:0,bottom:100,width:50,height:100,toJSON(){return {left:0,right:50,top:0,bottom:100,width:50,height:100};}});}
  if(kind==='outside-viewport')f.c.innerWidth=99;
  if(kind==='not-fullscreen')f.c.document.fullscreenElement=null;
  const old=vm.runInContext(base.PAGE_READ,f.c).apps[0],fresh=vm.runInContext(diagnostic.controller().PAGE_READ,f.c).apps[0];
  assert.equal(fresh.outputVisible,old.outputVisible,kind);assert.equal(fresh.outputVisibility.reason,old.outputVisibility.reason,kind);
  assert.equal(fresh.outputVisible,['valid-fullscreen','outside-fullscreen-overlay','not-fullscreen'].includes(kind),kind);
 }
});
test('owner replacement is still refused after operands are emitted',()=>{
 const f=fixture(),rows=[];f.c[diagnostic.BINDING]=s=>rows.push(JSON.parse(s));const api=diagnostic.controller();
 const old=vm.runInContext(api.PAGE_READ,f.c).apps[0],w=f.c.runningApps[0].wine;
 f.c.runningApps[0].wine={...w};
 assert.throws(()=>vm.runInContext(api.readinessExpression(old),f.c),/startup identity changed processObject/);
 assert.equal(rows.length,2);assert.notEqual(rows[0].apps[0].processObject,rows[1].apps[0].processObject);
});
test('native qualification is only composed; it preserves complete independent input/capture/UNKNOWN suites',()=>{
 const source=fs.readFileSync('test/quake3-browser-controller.test.cjs','utf8'),changed=diagnostic.qualificationSource(source);new vm.Script(changed);
 for(const phrase of ['queuedNativeControls({','fullscreenModalAndPopoverRefused','replacementRefused','lateReplyCannotReopen','independent','1750'])assert(changed.includes(phrase),phrase);
 assert(changed.includes("Runtime.addBinding"));assert(changed.includes("visibility-operands.jsonl"));
 assert.throws(()=>diagnostic.qualificationSource(source.replace('  c.event=v=>{','  c.event = v => {')),/anchor/);
});

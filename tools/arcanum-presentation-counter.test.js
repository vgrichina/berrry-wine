'use strict';
const assert=require('node:assert/strict');
const {installArcanumPresentationCounter:install}=require('./arcanum-presentation-counter');
global.document={visibilityState:'visible'};global.innerWidth=1000;global.innerHeight=800;
global.getComputedStyle=c=>c.style;
class Context{constructor(canvas){this.canvas=canvas;}drawImage(source){if(source.fail)throw Error('copy failure');}}
function canvas(id,w=800,h=600){const c={id,width:w,height:h,isConnected:true,style:{display:'block',visibility:'visible',opacity:'1'},getBoundingClientRect(){return{x:0,y:0,left:0,top:0,right:w,bottom:h,width:w,height:h};},getContext(){return this.ctx;}};c.ctx=new Context(c);return c;}
function fixture(){const game=canvas('game'),desktop=canvas('desktop'),sink=canvas('sink'),derived=canvas('derived');
 const layer={canvas:game,writeSeq:1},win={visible:true,_dxFrameLayer:layer};
 const r={windows:{7:win},canvas:desktop,ctx:desktop.ctx,presentationCanvas:sink,_directPresentation:false,
   presentationFilter:{canvas:sink,present(source){sink.ctx.drawImage(source);return true;}},
   _buildExclusivePresentationSource(){derived.ctx.drawImage(game,0,0);return derived;},
   _presentDisplayCanvas(){if(this.noop)return;if(this._directPresentation)return;return this.presentationFilter.present(this._exclusivePresentationSource||desktop,'nearest',{}, {});}};
 return{r,layer,win,game,desktop,sink,derived};}
const raw=Context.prototype.drawImage;
{
 const {r,layer,game,sink}=fixture(),c=install(r,7,800,600);
 r.ctx.drawImage(game);r._presentDisplayCanvas();assert.equal(c.sample().count,0);
 layer.writeSeq=2;r._presentDisplayCanvas();assert.equal(c.sample().count,0); // raw present only
 r.ctx.drawImage(canvas('unrelated'));r._presentDisplayCanvas();assert.equal(c.sample().count,0);
 r.ctx.drawImage(game);r.noop=true;r._presentDisplayCanvas();assert.equal(c.sample().count,0); // early return
 r.noop=false;sink.style.display='none';r._presentDisplayCanvas();assert.equal(c.sample().count,0); // hidden sink
 sink.style.display='block';r._presentDisplayCanvas();assert.equal(c.sample().count,1);
 r.ctx.drawImage(game);r._presentDisplayCanvas();assert.equal(c.sample().count,1); // repeat
 layer.writeSeq=3;layer.writeSeq=4;r.ctx.drawImage(game);r._presentDisplayCanvas();assert.equal(c.sample().count,2);
 layer.writeSeq=5;game.fail=true;assert.throws(()=>r.ctx.drawImage(game),/copy failure/);game.fail=false;r._presentDisplayCanvas();assert.equal(c.sample().count,2);
 const result=c.stop();assert.equal(result.frames,2);assert.deepEqual(result.events.map(e=>e.seq),[2,4]);assert.equal(result.errors.length,0);
}
{
 const {r,layer,game,desktop}=fixture();r._directPresentation=true;r.presentationCanvas.style.display='none';const c=install(r,7,800,600);
 layer.writeSeq=2;r.ctx.drawImage(game);desktop.style.opacity='0';r._presentDisplayCanvas();assert.equal(c.sample().count,0);
 desktop.style.opacity='1';r._presentDisplayCanvas();assert.equal(c.sample().count,1);assert.equal(c.stop().events[0].kind,'visible direct logical canvas');
}
{
 const {r,layer,derived}=fixture(),c=install(r,7,800,600);layer.writeSeq=2;
 r._exclusivePresentationSource=r._buildExclusivePresentationSource();r._presentDisplayCanvas();assert.equal(c.sample().count,1);
 r.presentationFilter.present=()=>true;layer.writeSeq=3;r._exclusivePresentationSource=r._buildExclusivePresentationSource();r._presentDisplayCanvas();assert.equal(c.sample().count,1);
 const result=c.stop();assert.ok(result.errors.includes('observer wrapper replaced: present'));assert.equal(result.fps,null);
}
{
 const {r,win,game}=fixture();delete win._dxFrameLayer;win._dxOwnerCanvas=game;game._waCanonicalPresentation={writeSeq:1};
 assert.throws(()=>install(r,7),/geometry/);const c=install(r,7,800,600);game._waCanonicalPresentation.writeSeq=2;
 r.ctx.drawImage(game);r._presentDisplayCanvas();assert.equal(c.sample().count,1);win._dxOwnerCanvas=canvas('replacement');assert.equal(c.stop().fps,null);
}
assert.equal(Context.prototype.drawImage,raw);
class OffscreenContext{constructor(canvas){this.canvas=canvas;}drawImage(){}}
{
 const {r,layer,game,derived}=fixture();game.ctx=new OffscreenContext(game);derived.ctx=new OffscreenContext(derived);
 const offscreenRaw=OffscreenContext.prototype.drawImage,c=install(r,7,800,600);layer.writeSeq=2;
 r._exclusivePresentationSource=r._buildExclusivePresentationSource();r._presentDisplayCanvas();assert.equal(c.sample().count,1);
 assert.equal(c.stop().frames,1);assert.equal(OffscreenContext.prototype.drawImage,offscreenRaw);
}
console.log('visible filtered/direct sinks, actual copy chain, early return, hidden sink, raw calls, repeats, overwrite, throws, geometry, replacement and restoration PASS');

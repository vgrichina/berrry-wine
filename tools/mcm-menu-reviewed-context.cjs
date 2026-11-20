'use strict';
// MENU-only whole-frame equality authority. No source is promoted to a current
// frame: every comparison captures a new complete viewport through the owner.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const CAPABILITY='mcm-menu-reviewed-context-v1';
const POLICY=Object.freeze({sourceMs:30000,reviewMs:15000,freshMs:5000});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function createImageSink(directory){
  let sequence=0;
  return row=>{
    assert(fs.statSync(directory).isDirectory(),'existing image evidence directory required');
    const base=String(++sequence).padStart(4,'0')+'-'+row.stage;
    const write=(name,bytes)=>{
      const file=path.join(directory,base+name),fd=fs.openSync(file,'wx',0o400);
      try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      assert.equal(sha(fs.readFileSync(file)),sha(bytes),'image sink readback mismatch');
      return path.basename(file);
    };
    const {png,...metadata}=row;
    const image=write('.png',png);
    write('.json',Buffer.from(JSON.stringify({...metadata,image},null,2)+'\n'));
    const fd=fs.openSync(directory,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    return true;
  };
}
function createMenuContext({capture,identity,evidenceSink,checkpoint=()=>{},now=Date.now}){
  assert(typeof capture==='function'&&typeof identity==='function'&&typeof evidenceSink==='function',
    'native capture, current identity and synchronous full image sink required');
  const session=crypto.randomUUID(),handles=new WeakMap();
  let source=null,closed=false,busy=false,used=false;
  const gate=()=>{assert(!closed,'MENU context permanently closed');
    try{checkpoint();}catch(e){closed=true;throw e;}};
  const age=(at,max)=>{const t=now();assert(Number.isSafeInteger(at)&&t>=at&&t-at<max,'MENU context clock expired or reversed');};
  const same=(a,b)=>assert.deepEqual(b,a,'MENU current owner/HWND generation/endpoint/epoch/viewport/module changed');
  function retain(image,stage,extra={}){
    assert.equal(evidenceSink({...structuredClone({...image,png:undefined,rgba:undefined}),
      png:Buffer.from(image.png),capability:CAPABILITY,session,stage,...structuredClone(extra)}),true,
    'synchronous immutable full image sink must acknowledge retention');
  }
  function fail(error,image=source){
    closed=true;
    if(image)try{retain(image,'refused',{reason:error.message,personallyReviewed:false});}
    catch(sink){throw new Error('MENU refused image retention failed: '+sink.message,{cause:error});}
    throw error;
  }
  async function observe(){gate();const value=structuredClone(await identity());gate();
    assert(value&&value.session&&value.owner&&value.process&&value.hwnd&&value.generation&&
      value.endpoint&&value.epoch&&value.viewport&&value.module,'complete MENU identity required');
    return value;
  }
  async function frame(stage){
    gate();const before=await observe(),at=now();
    const png=Buffer.from(await capture());
    const p=PNG.sync.read(png);assert(p.width>0&&p.height>0&&p.data.length===p.width*p.height*4,'COMPLETE whole RGBA frame required');
    const image={png,rgba:Buffer.from(p.data),sha256:sha(png),rgbaSHA256:sha(p.data),
      width:p.width,height:p.height,orientation:'top-left-row-major-RGBA8',at,completedAt:now(),
      identity:before,personallyReviewed:false,route:'Page.captureScreenshot complete viewport'};
    // Retain even a refused captured image. Never recapture after an unknown.
    retain(image,stage);
    try{
      const v=before.viewport;
      assert.equal(image.width,Math.round(v.width*(v.deviceScaleFactor??1)),'COMPLETE viewport width required');
      assert.equal(image.height,Math.round(v.height*(v.deviceScaleFactor??1)),'COMPLETE viewport height required');
      same(before,await observe());gate();return image;
    }catch(e){return fail(e,image);}
  }
  function intentCheck(intent){
    assert(intent?.capability===CAPABILITY&&intent.mode==='MENU'&&intent.action==='Start'&&
      intent.kind==='mouse'&&intent.button==='left'&&intent.holdMs===100&&
      typeof intent.nonce==='string'&&intent.nonce.length>0&&
      Number.isFinite(intent.x)&&Number.isFinite(intent.y)&&intent.x>0&&intent.y>0&&
      intent.x<source.width&&intent.y<source.height,'one exact MENU Start mouse intent required');
    const rect=source.identity.viewport.screen;
    assert(rect&&intent.x>=rect.x&&intent.x<rect.x+rect.width&&
      intent.y>=rect.y&&intent.y<rect.y+rect.height,'Start must lie in reviewed screen viewport');
    assert(intent.review?.trim()&&intent.imageSHA256===source.sha256&&
      Number.isSafeInteger(intent.reviewedAt)&&intent.reviewedAt>=source.completedAt,
    'personally reviewed complete source and exact Start intent required');
  }
  function validate(handle,intent){
    gate();const p=handles.get(handle);assert(p&&!p.used&&!used,'private one-use MENU capability required');
    assert.equal(JSON.stringify(intent),p.intent,'exact reviewed Start intent changed');
    age(source.at,POLICY.sourceMs);age(p.reviewedAt,POLICY.reviewMs);return p;
  }
  function equal(fresh){
    same(source.identity,fresh.identity);
    assert(source.width===fresh.width&&source.height===fresh.height&&
      source.orientation===fresh.orientation&&source.rgba.equals(fresh.rgba),'MENU EXACT whole RGBA differs');
    age(fresh.at,POLICY.freshMs);
  }
  return {capability:CAPABILITY,policy:POLICY,get closed(){return closed;},
    close(){closed=true;},
    async captureReview(){try{gate();
      assert(!busy&&!source&&!used,'one MENU source only');busy=true;
      source=await frame('source');
      return {png:Buffer.from(source.png),sha256:source.sha256,at:source.at,completedAt:source.completedAt,
        width:source.width,height:source.height,personallyReviewed:false};
    }catch(e){return fail(e);}finally{busy=false;}},
    review(intent){try{gate();
      assert(source&&!busy&&!used,'complete idle MENU source required');intentCheck(intent);
      age(source.at,POLICY.sourceMs);age(intent.reviewedAt,POLICY.reviewMs);
      retain(source,'review',{personallyReviewed:true,review:intent.review,reviewedAt:intent.reviewedAt,intent});
      const handle=Object.freeze({});handles.set(handle,{intent:JSON.stringify(intent),reviewedAt:intent.reviewedAt,used:false});
      // Multiple reviews cannot authorize multiple Start edges.
      return handle;
    }catch(e){return fail(e);}},
    async start(handle,intent,down){let last=source;
      try{
        gate();
        assert(!busy&&typeof down==='function','idle MENU dispatch required');busy=true;
        validate(handle,intent);
        last=await frame('fresh');equal(last);validate(handle,intent);
        last=await frame('final');equal(last);const p=validate(handle,intent);
        // All async capture/owner work and synchronous retention has finished.
        // The callback must publish the exact DOWN immediately, without await.
        gate();p.used=true;used=true;
        return await down(structuredClone(intent),{capability:CAPABILITY,session,
          sourceSHA256:source.sha256,freshSHA256:last.sha256,sourceAt:source.at,
          finalAt:last.at,reviewedAt:p.reviewedAt,personallyReviewed:false,exactWholeRGBA:true});
      }catch(e){return fail(e,last);}finally{busy=false;}
    },
  };
}
module.exports={CAPABILITY,POLICY,createMenuContext,createImageSink};

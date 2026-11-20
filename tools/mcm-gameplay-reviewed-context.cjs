'use strict';
// Explicit animated GAMEPLAY context. A current image is a new observation,
// never an equality claim or a renewal of the personally reviewed source.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PNG}=require('pngjs');
const CAPABILITY='mcm-gameplay-keyboard-reviewed-context-v1';
const POLICY=Object.freeze({sourceMs:30000,reviewMs:15000,currentMs:5000,nativeMs:500,maxHoldMs:1500});
const KEYS=Object.freeze({ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Escape:27});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function createGameplayContext({capture,identity,evidenceSink,checkpoint=()=>{},native,release,down,now=Date.now}){
  for(const f of [capture,identity,evidenceSink,down,native?.prepare,native?.status,release?.arm,release?.due,release?.cancel,release?.finish])
    assert.equal(typeof f,'function','complete native consumption and independent release adapters required');
  const session=crypto.randomUUID(),handles=new WeakMap();
  let source=null,closed=false,busy=false,used=false;
  const gate=()=>{assert(!closed,'GAMEPLAY context permanently closed');checkpoint();};
  const age=(at,max)=>assert(Number.isSafeInteger(at)&&now()>=at&&now()-at<max,'GAMEPLAY clock expired or reversed');
  const same=(a,b)=>assert.deepEqual(b,a,'GAMEPLAY owner/thread/module/renderer/epoch/viewport changed');
  function retain(image,stage,extra={}){
    const {png,...metadata}=image;
    assert.equal(evidenceSink({...structuredClone(metadata),png:Buffer.from(png),stage,
      capability:CAPABILITY,session,...structuredClone(extra)}),true,'synchronous immutable COMPLETE image retention required');
  }
  const fail=e=>{closed=true;throw e;};
  async function observe(){gate();const value=structuredClone(await identity());gate();
    for(const k of ['session','owner','process','hwnd','generation','endpoint','epoch','viewport','module','threads','nativeInstance','memory'])
      assert(value?.[k]!==undefined&&value[k]!==null&&value[k]!=='','complete GAMEPLAY provenance required: '+k);
    assert(value.mode==='GAMEPLAY'&&value.gps===true&&value.modal===null,'actual GPS GAMEPLAY without modal required');
    return value;
  }
  async function frame(stage){
    gate();const before=await observe(),at=now(),png=Buffer.from(await capture()),p=PNG.sync.read(png);
    const image={png,sha256:sha(png),rgbaSHA256:sha(p.data),width:p.width,height:p.height,
      orientation:'top-left-row-major-RGBA8',at,completedAt:now(),identity:before,
      personallyReviewed:false,route:'Page.captureScreenshot COMPLETE viewport'};
    retain(image,stage);
    assert(p.width>0&&p.height>0&&p.data.length===4*p.width*p.height,'COMPLETE RGBA required');
    assert.equal(p.width,Math.round(before.viewport.width*(before.viewport.deviceScaleFactor??1)),'COMPLETE viewport width');
    assert.equal(p.height,Math.round(before.viewport.height*(before.viewport.deviceScaleFactor??1)),'COMPLETE viewport height');
    same(before,await observe());gate();return image;
  }
  function exact(intent){
    assert(intent?.capability===CAPABILITY&&intent.mode==='GAMEPLAY'&&intent.kind==='key'&&
      Object.hasOwn(KEYS,intent.key)&&intent.code===intent.key&&intent.vk===KEYS[intent.key]&&
      Number.isInteger(intent.holdMs)&&intent.holdMs>=50&&intent.holdMs<=POLICY.maxHoldMs&&
      typeof intent.nonce==='string'&&intent.nonce.length>0,'one allowed exact GAMEPLAY keyboard intent required');
    assert(intent.review?.trim()&&intent.imageSHA256===source.sha256&&Number.isSafeInteger(intent.reviewedAt)&&
      intent.reviewedAt>=source.completedAt,'personally reviewed COMPLETE source and one action required');
  }
  function validate(handle,intent){gate();const p=handles.get(handle);
    assert(p&&!p.used&&!used,'private single-use GAMEPLAY handle required');
    assert.equal(JSON.stringify(intent),p.intent,'reviewed GAMEPLAY intent changed');
    age(source.at,POLICY.sourceMs);age(p.reviewedAt,POLICY.reviewMs);return p;
  }
  function current(image){same(source.identity,image.identity);
    assert.equal(image.width,source.width);assert.equal(image.height,source.height);
    age(image.at,POLICY.currentMs);
  }
  return {capability:CAPABILITY,policy:POLICY,get closed(){return closed;},close(){closed=true;},
    async captureReview(){try{gate();assert(!busy&&!source&&!used,'one idle GAMEPLAY source required');busy=true;
      source=await frame('source');const {png,...metadata}=source;return {...structuredClone(metadata),png:Buffer.from(png)};
    }catch(e){return fail(e);}finally{busy=false;}},
    review(intent){try{gate();assert(source&&!busy&&!used,'idle COMPLETE GAMEPLAY source required');exact(intent);
      age(source.at,POLICY.sourceMs);age(intent.reviewedAt,POLICY.reviewMs);
      retain(source,'review',{personallyReviewed:true,reviewedAt:intent.reviewedAt,intent});
      const handle=Object.freeze({});handles.set(handle,{intent:JSON.stringify(intent),reviewedAt:intent.reviewedAt,used:false});return handle;
    }catch(e){return fail(e);}},
    async dispatch(handle,intent){let armed=false,published=false,proof,up,error;
      try{
        gate();assert(!busy,'idle GAMEPLAY dispatch required');busy=true;validate(handle,intent);
        const fresh=await frame('current');current(fresh);validate(handle,intent);
        const arm=await release.arm(structuredClone(intent));armed=true;
        const releaseGate=()=>{gate();assert(release.alive!==false&&Number.isSafeInteger(arm?.at)&&
          arm.fallback-arm.at===1750&&Number.isSafeInteger(arm.releaseDue)&&now()+intent.holdMs<arm.releaseDue&&
          now()+intent.holdMs<arm.fallback,'independent release deadline expired');};
        validate(handle,intent);releaseGate();
        const preparedAt=now();
        const prepared=await native.prepare(structuredClone(intent),fresh.completedAt);
        assert(prepared?.prepared===true,'new genuine native keyboard consumption owner unavailable');
        validate(handle,intent);releaseGate();
        const final=await frame('final');current(final);const p=validate(handle,intent);releaseGate();
        assert(now()-preparedAt<POLICY.nativeMs,'native preparation expired before DOWN');
        // Last synchronous fence: retention, owner reads and all awaits above
        // have finished. Consume before publishing so exceptions cannot replay.
        p.used=true;used=true;release.due(intent.nonce,now()+intent.holdMs);published=true;
        const pending=down(structuredClone(intent));
        await pending;gate();
        do{
          assert(now()-preparedAt<POLICY.nativeMs,'native keyboard consumption UNKNOWN');
          proof=await native.status(intent.nonce);gate();
          assert(!['UNKNOWN','CANCELLED'].includes(proof?.state),'native keyboard consumption UNKNOWN');
          if(proof?.consumed)break;
          await wait(5);
        }while(true);
        assert(now()-preparedAt<POLICY.nativeMs&&proof.nonce===intent.nonce&&proof.receiptBoundary==='owner-worker-native-user-return'&&
          proof.nativeMessage?.consumption==='owner-user-return'&&proof.nativeMessage.token&&
          [0x100,0x104].includes(proof.nativeMessage.msg)&&proof.nativeMessage.wParam===intent.vk,
        'native keyboard API return required; transport ACK is insufficient');
        proof={...proof,context:{capability:CAPABILITY,session,sourceAt:source.at,currentAt:final.at,
          sourceSHA256:source.sha256,currentSHA256:final.sha256,exactWholeRGBA:false,personallyReviewedCurrent:false}};
      }catch(e){error=e;closed=true;}
      finally{
        if(armed){
          if(!published)try{release.cancel(intent.nonce);}catch(e){error??=e;closed=true;}
          try{up=await release.finish(intent.nonce);assert(up?.trusted===true&&up.down===false&&up.nonce===intent.nonce,
            'independent trusted exact keyboard UP required');}catch(e){error??=e;closed=true;}
        }
        used=true;busy=false;
      }
      if(error)throw error;return {proof,up};
    },
  };
}
module.exports={CAPABILITY,POLICY,KEYS,createGameplayContext};

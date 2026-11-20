'use strict';
// Native-only authority. The caller supplies identity observations, never pixels
// or freshness. Pixels come from a new synchronous XGetImage of the whole root.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{PNG}=require('pngjs');
const {encodeXwd}=require('../tools/browser-transients.cjs');
const POLICY=Object.freeze({contextMs:30000,reviewMs:15000,freshMs:5000});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const digestIntent=i=>JSON.stringify([i.nonce,i.name,i.kind,i.code,i.button??null,i.x??null,i.y??null,
  i.key??null,i.domCode??null,i.ms,i.mode,i.review,i.reviewedAt,i.imageSHA256]);
function createNativeAuthority({env,context,checkpoint,record=()=>{},evidenceSink,key=crypto.randomBytes(32).toString('hex')},manualContext=false){
  const version=manualContext?'native-manual-context-v1':'native-whole-frame-equivalence-v1';
  assert(env?.DISPLAY&&env?.XAUTHORITY&&typeof context==='function'&&typeof checkpoint==='function');
  assert(/^[a-f0-9]{64}$/.test(key),'invalid equivalence signing key');
  assert(evidenceSink===undefined||typeof evidenceSink==='function','invalid evidence sink');
  const sources=new Map(),proofs=new WeakMap(),nonces=new Set();let closed=false,busy=false;
  const gate=()=>{assert(!closed,'review equivalence permanently closed');checkpoint();};
  const fail=e=>{closed=true;record({event:'refused',at:Date.now(),reason:e.message,zeroDown:true});throw e;};
  const nativeIdentity=()=>cp.execFileSync('xdotool',['getwindowfocus'],{env,encoding:'utf8',timeout:500}).trim();
  const decode=b=>{const p=PNG.sync.read(b);assert(p.width>0&&p.height>0&&p.data.length===4*p.width*p.height);return {width:p.width,height:p.height,orientation:'top-left-row-major-RGBA8',rgba:Buffer.from(p.data)};};
  const capture=()=>{gate();const at=Date.now(),focus=nativeIdentity();
    const raw=cp.execFileSync('xwd',['-root','-silent'],{env,timeout:1000,maxBuffer:16*1024*1024});
    const image=encodeXwd(raw),pixels=decode(image.png),completedAt=Date.now();
    assert.equal(nativeIdentity(),focus,'native focus raced capture');gate();
    return {...pixels,png:image.png,sha256:sha(image.png),at,completedAt,focus,rawSHA256:sha(raw),rgbaSHA256:sha(pixels.rgba),
      route:'XGetImage root window; entire private display',personallyReviewed:false};};
  const same=(a,b)=>assert.equal(JSON.stringify(b),JSON.stringify(a),'review identity changed');
  const observe=async()=>{gate();const value=structuredClone(await context());gate();
    for(const k of ['target','owner','generation','viewport','focus','modal','capture','module','realm'])
      assert(value?.[k]!==undefined&&value[k]!==null&&value[k]!=='','missing review identity '+k);
    return value;};
  function equal(source,fresh){assert.equal(fresh.focus,source.focus,'native focus changed');
    for(const k of ['width','height','orientation'])assert.equal(fresh[k],source[k],'whole-frame '+k+' changed');
    if(!manualContext)assert(source.rgba.equals(fresh.rgba),'whole-frame RGBA differs');}
  // Opt-in diagnostics have no authority. Each image and identity is detached
  // from private proof state; never export the proof, key, nonce or intent.
  // Synchronous acknowledgement is required before any authorization proceeds.
  function compare(source,fresh,stage,reviewedAt,identity=null){
    let refusal=null;try{equal(source,fresh);if(identity)same(source.identity,identity);}catch(e){refusal=e;}
    if(evidenceSink){
      const copy=image=>{const {png,at,completedAt,sha256,rawSHA256,rgbaSHA256,width,height,orientation,route,focus,personallyReviewed}=image;
        return {png:Buffer.from(png),at,completedAt,sha256,rawSHA256,rgbaSHA256,width,height,orientation,route,focus,personallyReviewed};};
      const evidence={version:'native-whole-frame-evidence-v1',capability:version,authoritative:false,stage,
        source:{...copy(source),identity:structuredClone(source.identity),review:{reviewedAt}},
        fresh:{...copy(fresh),identity:structuredClone(identity)},refusal:refusal?.message??null,
        equal:source.rgba.equals(fresh.rgba),accepted:!refusal};
      try{assert.equal(evidenceSink(evidence),true,'evidence sink must acknowledge synchronous retention');}
      catch(e){throw new Error('failure evidence sink failed: '+e.message,{cause:e});}
    }
    if(refusal)throw refusal;
  }
  const age=(at,max)=>assert(Number.isSafeInteger(at)&&Date.now()>=at&&Date.now()-at<max,'review equivalence age expired');
  function validate(handle,intent,image){gate();const p=proofs.get(handle);assert(p&&!p.used,'missing/forged/used equivalence proof');
    assert.equal(p.intent,digestIntent(intent),'manual intent changed');assert.equal(image.sha256,p.source.sha256);
    assert.equal(image.completedAt,p.source.at,'original capture timestamp changed');
    age(p.source.at,POLICY.contextMs);age(intent.reviewedAt,POLICY.reviewMs);age(p.fresh.at,POLICY.freshMs);return p;}
  function dispatchCapture(p,event){const fresh=capture();compare(p.source,fresh,event,p.reviewedAt);
    const {at,completedAt,rawSHA256,rgbaSHA256,width,height,orientation,route,personallyReviewed}=fresh;
    record({event,at:Date.now(),sourceSHA256:p.source.sha256,fresh:{at,completedAt,rawSHA256,rgbaSHA256,width,height,orientation,route,personallyReviewed}});}
  return {key,capability:version,policy:POLICY,get closed(){return closed;},close(){closed=true;sources.clear();},
    async captureReview(name){gate();try{assert(typeof name==='string'&&name&&!sources.has(name));
      const before=await observe(),source={...capture(),identity:before};same(before,await observe());
      sources.set(name,source);const {png,at,completedAt,sha256,width,height,orientation,rawSHA256,route}=source;
      // No caller-supplied pixels, source timestamps or publication claims.
      return {name,png:Buffer.from(png),at,completedAt,sha256,width,height,orientation,rawSHA256,route,reviewed:false};
    }catch(e){return fail(e);}},
    async prove(name,intent,image){gate();try{assert(!busy&&!nonces.has(intent.nonce),'concurrent/reused invocation');busy=true;
      const source=sources.get(name);assert(source,'missing retained whole-frame source');
      assert(intent.review?.trim()&&intent.imageSHA256===source.sha256&&image.sha256===source.sha256);
      assert.equal(image.completedAt,source.at);age(source.at,POLICY.contextMs);age(intent.reviewedAt,POLICY.reviewMs);
      assert(intent.reviewedAt>=source.completedAt,'review precedes complete source');
      same(source.identity,await observe());const fresh=capture();
      compare(source,fresh,'prove',intent.reviewedAt,await observe());
      const body={version,id:crypto.randomUUID(),intent:digestIntent(intent),
        source:{sha256:source.sha256,at:source.at,completedAt:source.completedAt,reviewedAt:intent.reviewedAt,
          rgbaSHA256:source.rgbaSHA256,width:source.width,height:source.height,orientation:source.orientation},
        fresh:{at:fresh.at,completedAt:fresh.completedAt,rawSHA256:fresh.rawSHA256,rgbaSHA256:fresh.rgbaSHA256,
          width:fresh.width,height:fresh.height,orientation:fresh.orientation,route:fresh.route,personallyReviewed:false},
        identity:source.identity};
      const payload=JSON.stringify(body),signature=crypto.createHmac('sha256',Buffer.from(key,'hex')).update(payload).digest('hex');
      const handle=Object.freeze({payload,signature});proofs.set(handle,{source,fresh,intent:body.intent,reviewedAt:intent.reviewedAt,used:false});nonces.add(intent.nonce);
      record(structuredClone({event:manualContext?'manual-context-authorized':'equivalent',...body}));return handle;
    }catch(e){return fail(e);}finally{busy=false;}},
    validate(handle,intent,image){try{validate(handle,intent,image);return true;}catch(e){return fail(e);}},
    async beforeDown(handle,intent,image){try{const p=validate(handle,intent,image);same(p.source.identity,await observe());
      dispatchCapture(p,manualContext?'pre-down-manual-context':'pre-down-equivalent');validate(handle,intent,image);
    }catch(e){return fail(e);}},
    // Invoke synchronously at the real transport boundary, with no await before
    // socket publication. This never changes the retained proof's timestamps.
    fence(handle,intent,image,beforePublish){try{const p=validate(handle,intent,image);dispatchCapture(p,manualContext?'socket-manual-context':'socket-equivalent');
      // Capture and synchronous evidence writers may consume the remaining
      // window or observe cancellation. Recheck after all synchronous work.
      validate(handle,intent,image);
      if(beforePublish!==undefined){assert.equal(typeof beforePublish,'function');beforePublish();}
      return true;}catch(e){return fail(e);}},
    consume(handle){const p=proofs.get(handle);assert(p&&!p.used);p.used=true;},
  };
}
// Serialized into the trusted page bootstrap. Key is private to the newly
// created session closure; no page method registers arbitrary unsigned proof.
async function verifyPageEquivalence(key,envelope,intent,capability='native-whole-frame-equivalence-v1'){
  if(!['native-whole-frame-equivalence-v1','native-manual-context-v1'].includes(capability))throw Error('unknown review capability');
  if(!/^[a-f0-9]{64}$/.test(key||'')||!envelope||typeof envelope.payload!=='string'||
    !/^[a-f0-9]{64}$/.test(envelope.signature||''))throw Error('missing/forged equivalence proof');
  const bytes=s=>Uint8Array.from(s.match(/../g),v=>parseInt(v,16));
  const k=await crypto.subtle.importKey('raw',bytes(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',k,bytes(envelope.signature),new TextEncoder().encode(envelope.payload)))throw Error('forged equivalence proof');
  const p=JSON.parse(envelope.payload),now=Date.now(),s=p.source,f=p.fresh;
  const expected=JSON.stringify([intent.nonce,intent.name,intent.kind,intent.code,intent.button??null,intent.x??null,intent.y??null,
    intent.key??null,intent.domCode??null,intent.ms,intent.mode,intent.review,intent.reviewedAt,intent.imageSHA256]);
  if(p.version!==capability||p.intent!==expected||s.sha256!==intent.imageSHA256||
    s.reviewedAt!==intent.reviewedAt||s.at!==intent.completedAt||s.completedAt>s.reviewedAt||
    ![s.at,s.completedAt,s.reviewedAt,f.at,f.completedAt].every(Number.isSafeInteger)||
    now-s.at<0||now-s.at>=30000||now-s.reviewedAt<0||now-s.reviewedAt>=15000||
    now-f.at<0||now-f.at>=5000||f.completedAt<f.at||f.completedAt>now||f.personallyReviewed!==false||
    f.orientation!=='top-left-row-major-RGBA8'||!(f.width>0&&f.height>0)||
    (capability==='native-whole-frame-equivalence-v1'&&s.rgbaSHA256!==f.rgbaSHA256)||s.width!==f.width||s.height!==f.height||s.orientation!==f.orientation||
    !/^[a-f0-9]{64}$/.test(f.rgbaSHA256||''))throw Error('expired/mismatched equivalence proof');
  return p;
}
function createNativeEquivalence(options){return createNativeAuthority(options);}
// Explicit manual intent uses a retained reviewed image as context, not a claim
// that animated pixels remain identical. Identity and all age fences still hold.
function createNativeManualContext(options){return createNativeAuthority(options,true);}
module.exports={POLICY,createNativeEquivalence,createNativeManualContext,verifyPageEquivalence};

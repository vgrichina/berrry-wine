'use strict';
const assert=require('node:assert/strict');
// Host fullscreen consent is a distinct, personally reviewed host action. Its
// trusted click must finish before binding the document-sensitive native owner.
function reviewHost(scene,review,live,binding,app,now=Date.now()){
  assert(['hexen2_demo','live_input_fixture'].includes(app));
  assert(review.sha256===scene.sha256&&review.observation?.trim()&&review.hostOnly===true);
  assert(now-scene.at>=0&&now-scene.at<30000,'fresh host geometry review');
  const want=scene.observation.page.apps[0],a=live.page.apps[0];
  assert(live.page.isolated&&live.page.apps.length===1);
  assert(a.name===app&&want.name===app&&a.running&&!a.stopped&&a.guestWorker);
  assert(Number.isInteger(a.windowHwnd)&&a.windowHwnd>0);
  assert(Number.isInteger(a.processId)&&a.processId>0&&a.guestEndpoint===a.endpoint&&Number.isInteger(a.slot));
  assert.equal(a.slice?.focusHwnd,a.windowHwnd,'native owning window focus');
  assert.equal(want.slice?.focusHwnd,want.windowHwnd,'reviewed native owning window focus');
  for(const k of binding.HOST_FIELDS){assert(want[k]!==null&&want[k]!==undefined,'missing '+k);assert.equal(a[k],want[k],k);}
  binding.consentButton(scene.observation);binding.consentButton(live);
  for(const k of ['object','label','x','y'])assert.equal(live.button[k],scene.observation.button[k]);
  assert.deepEqual(live.button.box,scene.observation.button.box);
  assert.equal(live.wrap,scene.observation.wrap);assert.equal(live.strip.object,scene.observation.strip.object);
  assert.deepEqual(live.viewport,scene.observation.viewport);
}
function createFocusOrder(){
  let state='HOST_REVIEW',receipt=null;
  return {
    complete(observation,downAt){
      assert.equal(state,'HOST_REVIEW','host focus cannot restart');state='CLOSED';
      assert(Number.isSafeInteger(downAt));
      // One synchronous document read supplies the event and focus facts.
      const e=observation?.event;
      assert(observation?.focused===true&&observation.visibility==='visible'&&observation.fullscreen===true,
        'trusted host click did not focus visible fullscreen document '+JSON.stringify(observation));
      assert(e?.type==='click'&&e.trusted===true&&e.target==='BUTTON'&&e.at>=downAt,
        'actual trusted host button click required');
      receipt=Object.freeze(structuredClone(observation));state='FOCUSED';return receipt;
    },
    beforeBind(){assert.equal(state,'FOCUSED','reviewed trusted host focus must precede native bind');return receipt;},
  };
}
module.exports={reviewHost,createFocusOrder};

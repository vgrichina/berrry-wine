'use strict';

// Serialized into the owning page. Read only: a decoder extent, raw canvas,
// GPS stamp or a historical joined row alone is never publication authority.
function currentSynchronousSource(w, win) {
  const fail = () => { throw Error('current completed synchronous source publication required'); };
  const r = w?.renderer, j = w?._d3dimPublicationJoin?.synchronous;
  const link = w?.guestWorker?.link, layer = win?._dxFrameLayer;
  if (!w?.running || w._stopped || !r || !j || !link || !j.valid() ||
      j.renderer !== r || j.memory !== w.memory || j.workerSlot !== link.slot ||
      j.endpointId !== link.endpointIdentity || j.owner?.endpointId !== link.endpointIdentity ||
      !r._d3dimPublicationJoins?.has(j) || win.wasm !== w.instance ||
      win.wasmMemory !== w.memory || win.processId !== w.processId ||
      r.windows?.[win.hwnd] !== win || !layer || layer.kind === 'gpu' || layer.stale?.() ||
      r._overlayFrameLayer(win) !== layer) return fail();
  const proof = j.dxLayerProofs.get(layer), version = layer.canvas?._waD3dimVersion;
  const record = version?.record, display = r._currentDisplayRecord;
  const row = j.rows[j.rows.length - 1];
  const pin = display?.windows?.length === 1 && display.windows[0];
  const pinnedInstance = pin?.instance?.deref ? pin.instance.deref() : pin?.instance;
  if (!pin || pin.window.deref() !== win || pinnedInstance !== w.instance ||
      pin.processId !== w.processId || pin.hwnd !== win.hwnd || !win.visible || win.isChild || win.region ||
      ['x','y','w','h','z','style'].some(k => win[k] !== pin[k]) ||
      Object.values(r.windows).filter(v => v.visible && !v.isChild && v.w > 0 && v.h > 0).length !== 1 ||
      display.logical !== r.canvas || r.canvas.width !== display.width || r.canvas.height !== display.height ||
      display.display.output.width !== display.outputWidth || display.display.output.height !== display.outputHeight ||
      display.display.source.width !== display.sourceWidth || display.display.source.height !== display.sourceHeight ||
      display.display.output !== (!r.presentationFilter || r._directPresentation ? r.canvas : r.presentationCanvas || r.canvas))
    return fail();
  if (display.composition?.exclusive) {
    const v=display.viewport, live=r._exclusivePresentationViewport;
    if (!v || !live || display.display.output===r.canvas ||
        display.display.source!==r._exclusivePresentationSource ||
        display.sourceWidth!==pin.w || display.sourceHeight!==pin.h ||
        v.cropX!==0 || v.cropY!==0 || v.cropW!==pin.w || v.cropH!==pin.h ||
        v.nativeX!==pin.x || v.nativeY!==pin.y ||
        v.cropBase.x!==0 || v.cropBase.y!==0 || v.cropBase.w!==pin.w || v.cropBase.h!==pin.h ||
        v.outputW!==display.outputWidth || v.outputH!==display.outputHeight ||
        !(v.dstX>=0 && v.dstY>=0 && v.dstW>0 && v.dstH>0 && v.dstX+v.dstW<=v.outputW && v.dstY+v.dstH<=v.outputH) ||
        Object.keys(v).some(k=>k!=='cropBase' && v[k]!==live[k]) ||
        Object.keys(v.cropBase).some(k=>v.cropBase[k]!==live.cropBase?.[k])) return fail();
  } else if(display.viewport || display.display.source!==r.canvas || pin.x<0 || pin.y<0 ||
      pin.x+pin.w>display.width || pin.y+pin.h>display.height) return fail();
  if (!proof || proof.window !== win || proof.canvas !== layer.canvas || proof.version !== version ||
      version.join !== j || !record || record.sourceKind !== 'synchronous-native-flip' ||
      !record.request?.descriptor || !record.request.serial || !record.batch || !record.pages ||
      !record.sourceWriter?.sealExit || record.versionRejected ||
      record.owner.scope !== j.ownerScope || record.owner.endpointId !== j.endpointId ||
      record.owner.generation !== j.owner.generation || record.observationGeneration !== j.observationGeneration ||
      !j.sourceUnchanged(record) || !j.compositionReads?.get(version) ||
      !row?.qualified || j.key(row) !== j.key(record) || row.canvasCacheSerial !== version.cacheSerial ||
      row.consumedSurfaceVersion !== record.sourceVersion ||
      row.publication !== r._immutablePublicationSequence || !display?.display?.output ||
      layer.canvas.width !== record.layout.width || layer.canvas.height !== record.layout.height ||
      version.cacheSerial <= (j.blockedSceneCacheSerial || 0) ||
      !(j.transfers.get(display.display.output) || []).some(t => t.version === version && t.path.length) ||
      row.scene.length !== 1 || row.scene[0].hwnd !== win.hwnd || row.scene[0].processId !== w.processId)
    return fail();
  // Repeated compositions without a new qualified row are deliberately refused.
  // No diagnostic repaint or historical-row promotion makes them current.
  return { layer, publication: {kind: 'synchronous-native-flip', sourceVersion: record.sourceVersion,
    descriptor: record.request.descriptor, serial: record.request.serial, batch: record.batch,
    workerSlot: j.workerSlot, endpointId: j.endpointId, owner: {...record.owner},
    observationGeneration: j.observationGeneration, canvasCacheSerial: version.cacheSerial,
    sequence: row.publication, writeSeq: layer.writeSeq} };
}

const ARM_SYNCHRONOUS_SOURCE = `(async () => {
  if(typeof runningApps==='undefined'||runningApps.length!==1)throw Error('one MCM owner required');
  const app=runningApps[0], w=app.wine, g=w?.guestWorker, link=g?.link, r=w?.renderer,
    instance=w?.instance, memory=w?.memory, processId=w?.processId;
  if(app.name!=='mcm'||!w.running||w._stopped||!link||!r||!instance||!memory)
    throw Error('live MCM command owner required');
  const join=await w.armD3dimPublicationObservation({synchronousSource:true,maxRecords:256});
  if(runningApps.length!==1||runningApps[0]!==app||w.guestWorker!==g||g.link!==link||
    w.renderer!==r||w.instance!==instance||w.memory!==memory||w.processId!==processId||
    !w.running||w._stopped||w._d3dimPublicationJoin!==join||!join.synchronous?.valid())
    throw Error('MCM command owner changed while arming');
  return {endpoint:link.endpointIdentity,slot:link.slot,processId,
    synchronousOwner:{...join.synchronous.owner},generation:join.synchronous.observationGeneration};
})()`;

module.exports = {currentSynchronousSource, ARM_SYNCHRONOUS_SOURCE};

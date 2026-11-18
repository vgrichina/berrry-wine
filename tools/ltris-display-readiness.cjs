'use strict';

// Startup observation only. A completed desktop can precede SDL's first
// visible native window. It is not a completed frame of that window.
// This function is also evaluated verbatim in the owned browser document.
function startupDisplayReadiness(renderer, owner, deadline, now = Date.now()) {
  if (!(Number.isFinite(deadline) && now < deadline)) throw Error('SDL startup readiness expired');
  const r = renderer, w = owner?.window, record = r?._currentDisplayRecord;
  if (!w || r.windows[owner.hwnd] !== w || w.hwnd !== owner.hwnd ||
      w.processId !== owner.processId || w.wasm !== owner.instance) {
    throw Error('SDL startup owner replaced');
  }
  if (!w.visible || w.isChild || w.region || !(w.w > 0 && w.h > 0)) {
    throw Error('SDL startup owner hidden or shaped');
  }
  if (record?.pixelError) throw record.pixelError;
  if (record && (record.logical !== r.canvas || record.width !== r.canvas.width ||
      record.height !== r.canvas.height || record.outputWidth !== record.display.output.width ||
      record.outputHeight !== record.display.output.height ||
      record.sourceWidth !== record.display.source.width || record.sourceHeight !== record.display.source.height)) {
    throw Error('SDL startup display replaced or resized');
  }
  // Refuse native clipping even while awaiting the first window publication.
  if (!(w.x >= 0 && w.y >= 0 && w.x + w.w <= r.canvas.width &&
      w.y + w.h <= r.canvas.height)) throw Error('SDL startup owner clipped');
  const visible = Object.values(r.windows).filter(v => v.visible && !v.isChild && v.w > 0 && v.h > 0);
  if (visible.length !== 1 || visible[0] !== w) throw Error('SDL startup native stack changed');
  if (record && record.windows.length === 0) {
    if (record.composition.exclusive || record.composition.windows.length !== 0) {
      throw Error('SDL startup inconsistent desktop receipt');
    }
    return {ready:false, pending:'first ordinary publication containing SDL owner',
      publication:r._immutablePublicationSequence, displayedAt:record.displayedAt};
  }
  if (!record) return {ready:false, pending:'ordinary display transaction'};
  // Do not turn an owner/geometry replacement into a paint wait. The live
  // retained pins must still match before considering a writer-held frame.
  const pins = record.windows;
  if (pins.length !== 1 || pins[0].window.deref() !== w ||
      pins[0].hwnd !== owner.hwnd || pins[0].processId !== owner.processId ||
      (pins[0].instance instanceof WeakRef ? pins[0].instance.deref() : pins[0].instance) !== owner.instance ||
      ['x','y','w','h','z','style'].some(k => pins[0][k] !== w[k])) {
    throw Error('SDL startup retained owner or geometry changed');
  }
  if (r._repainting || (!record.pixels && (r._workerPublicationHeld() || r._workerGdiPaintDepth > 0))) {
    return {ready:false, pending:'ordinary unheld SDL publication'};
  }
  // All production output, visibility, ownership and readback predicates still
  // apply. No exception from this validator is converted into NOT_READY.
  const complete = r._validateCurrentDisplayCapture({owner});
  if (!(complete.displayedAt <= now && r._immutablePublicationSequence > 0)) {
    throw Error('SDL startup invalid publication time');
  }
  return {ready:true, publication:r._immutablePublicationSequence, displayedAt:complete.displayedAt};
}

function requireFreshReview(command, frame, now = Date.now()) {
  if (!frame || command.review !== frame.label || command.sha256 !== frame.sha256 ||
      !(command.observation?.length > 10)) throw Error('whole-frame review required');
  if (!(now >= frame.at && now - frame.at < 15000 &&
      now >= frame.metadata.readbackCompletedAt && now - frame.metadata.readbackCompletedAt < 15000)) {
    throw Error('whole-frame review stale');
  }
}

module.exports = {startupDisplayReadiness, requireFreshReview};

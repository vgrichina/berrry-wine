'use strict';
const crypto = require('node:crypto');
const scene = require('./cli-native-scene');
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const CONTRACT = 'native-whole-capture-v1';

// This registry belongs to one live launcher. A receipt names retained encoder
// bytes, never a later repaint. It grants no new native authority.
function createCaptureReceipts({now=Date.now, monotonic=()=>performance.now(), authority=()=>({healthy:true,refs:{}})}={}) {
  const records = new Map();
  const sameAuthority=(a,b)=>a.healthy&&b.healthy&&Object.keys(a.refs).length===Object.keys(b.refs).length&&
    Object.keys(a.refs).every(key=>Object.is(a.refs[key],b.refs[key]));
  function capture(snapshot, encode, write) {
    const startedAt=now(), mono=monotonic(), before=snapshot(), owner=authority();
    if (!scene.matches(before,before)) throw Error('native capture context unavailable');
    const image=Buffer.from(encode()), after=snapshot(), completedAt=now();
    if (completedAt<startedAt || completedAt-startedAt>=3000 || monotonic()-mono>=3000 ||
        !sameAuthority(owner,authority()) || !scene.matches(after,before) || !equal(scene.reviewedContext(after),scene.reviewedContext(before)))
      throw Error('native capture context changed or observation expired');
    for (const [id,r] of records) if (monotonic()-r.mono>=30000) records.delete(id);
    if (records.size>=128) throw Error('native capture registry full');
    const receipt={contract:CONTRACT,captureId:crypto.randomUUID(),pngSHA256:hash(image),startedAt,completedAt,expiresAt:startedAt+30000};
    write(image);
    records.set(receipt.captureId,{receipt:structuredClone(receipt),image,snapshot:structuredClone(before),mono,owner:{healthy:owner.healthy,refs:{...owner.refs}}});
    return {receipt,snapshot:before,observationAfter:after};
  }
  function verify(current, expected) {
    const r=records.get(expected?.receipt?.captureId);
    if (!r || !equal(r.receipt,expected.receipt) || expected.pngSHA256!==r.receipt.pngSHA256 || hash(r.image)!==r.receipt.pngSHA256 ||
        !equal(scene.reviewedContext(expected.snapshot),scene.reviewedContext(r.snapshot)))
      throw Error('unissued or mismatched native whole capture');
    if (now()<r.receipt.completedAt || now()>=r.receipt.expiresAt || monotonic()-r.mono>=30000)
      throw Error('native whole capture stale');
    if (!sameAuthority(r.owner,authority()) || !scene.matches(current,r.snapshot) || !equal(scene.reviewedContext(current),scene.reviewedContext(r.snapshot)))
      throw Error('reviewed native scene changed before binding');
    return scene.context(current);
  }
  return {capture,verify};
}
module.exports={createCaptureReceipts,CONTRACT};

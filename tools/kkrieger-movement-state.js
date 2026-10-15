'use strict';

// Original unpacked image SHA256 42b8f545db0fce60f8f1b22035386c2a6b87653741bbb5ae4a9d24c2b6df76aa.
const movementPins = [
  [0x805f44, 34, '2adb2a12294a6587b98bd23aa8c859cf9f43bd4c6d621fd23bc170c45ef20c57'],
  [0x80604f, 43, 'd13d33b4aa11ddb05b27a568876e6e0ea2b3aa7ef5d6b092f63295bef511629f'],
  [0x819d55, 35, 'dddc113297c51d806de16f855e614d6b76726fc6171ae729273960b3a65573af'],
  [0x819e7b, 173, 'a42473eff241884baa37182599addcac74482e354dbb602c544a9c12ad808dff'],
  [0x81b45a, 1684, '52491bffb4e72533f74b3ce612c2c45fa759efd0d365ae54879eba609ca43721'],
  [0x81c341, 387, 'a7e3cf951f329d8760c9c7cb9e41752d6d8bcc911b804683e7a7a068986b54b5'],
  [0x81c728, 298, 'fae19888550bc0c2de4e8b569501535c852212a424eff40ebd7535f43ac372e2'],
  [0x81dd4c, 2294, '4d84e0d0573fac20a006bb136bc418d9a07a2cdc48efb178456a0da52b65900e'],
  [0x81e8cb, 1047, '458ff0d84a8e84f5e8f3061c29599ac0ca02cb72808e9e6a12e258570b03f3b6'],
];

// Serialize into page.evaluate with movementPins. This only reads guest bytes.
async function installMovementReader(pins) {
  const w = window.wineShell?.currentWine, e = w?.instance?.exports;
  const live = () => {
    if (window.wineShell?.currentWine !== w || !w?.running || w.guestWorker || !e?.guest_to_wasm)
      throw Error('Expected same cooperative original guest');
  };
  live();
  if (window.__kkriegerMovementRead) throw Error('Movement reader already installed');
  const bytes = (address, size) => {
    const result = new Uint8Array(size), memory = new Uint8Array(w.memory.buffer);
    for (let i = 0; i < size; i++) {
      const p = e.guest_to_wasm(address + i) >>> 0;
      if (p === 0xf0 || p >= memory.length) throw Error('Unmapped original movement read');
      result[i] = memory[p];
    }
    return result;
  };
  for (const [address, size, expected] of pins) {
    live();
    const digest = await crypto.subtle.digest('SHA-256', bytes(address, size));
    const actual = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw Error('Original movement code mismatch at ' + address.toString(16));
  }
  live();
  const u32 = address => new DataView(bytes(address, 4).buffer).getUint32(0, true);
  const initialObject = u32(0x14a0998);
  const read = () => {
    live();
    const object = u32(0x14a0998);
    if (!object || object !== initialObject || object > 0xffffffff - 0x15544)
      throw Error('Invalid/replaced movement object');
    const f32 = offset => {
      const value = new DataView(bytes(object + offset, 4).buffer).getFloat32(0, true);
      if (!Number.isFinite(value)) throw Error('Nonfinite movement field at ' + offset.toString(16));
      return value;
    };
    const vec = offset => [f32(offset), f32(offset + 4), f32(offset + 8)];
    const updateContext = u32(object), currentTime = u32(0x15289b8), completedTime = u32(0x15289b0);
    return {pageMs: performance.now(), object, updateContext, currentTime, completedTime,
      // Context is set before gameplay work and cleared near its end; the
      // callback copies currentTime to completedTime only after update returns.
      betweenUpdates: updateContext === 0 && currentTime !== 0 && currentTime === completedTime,
      requestedSteps: u32(object + 0x15540), phase: bytes(object + 0x14fe9, 1)[0],
      position: vec(0x14948), bodyPosition: vec(0x14a3c),
      bodyCollisionPosition: vec(0x14a4c), bodyPreviousPosition: vec(0x14a5c),
      cameraPosition: vec(0x15380), forwardBasis: vec(0x15328), strafeBasis: vec(0x15308),
      pitch: f32(0x14958), yaw: f32(0x1495c), forward: f32(0x15358), strafe: f32(0x1535c),
      forwardSpeed: f32(0x153b8), grounded: bytes(object + 0x15364, 1)[0],
      bodyType: u32(object + 0x14a08), bodySector: u32(object + 0x14a18),
      sector: u32(object + 0x14960), cameraMode: u32(object + 0x14964),
      physicalW: !!w.renderer?._physicalKeys?.[87],
      scope: 'Read-only simulation state; intermediate samples are not completed movement or FPS'};
  };
  const initial = read();
  window.__kkriegerMovementRead = read;
  return initial;
}

module.exports = {movementPins, installMovementReader};

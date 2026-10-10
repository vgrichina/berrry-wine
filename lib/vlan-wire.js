// Virtual LAN wire — docs/virtual-lan-party.md
//
// The room switch lives in WAT. This file is only the segment the frames
// travel on: it never reads a port, tracks a connection, or decides a
// route. A wire has exactly three obligations:
//
//   send(bytes)  accept an outbound frame, or refuse it when full
//   peek()       show the next inbound frame without consuming it
//   commit()     consume the frame that was just shown
//
// Peek and commit are separate because a frame whose destination ring is
// full has to stay queued. A byte stream may not drop or reorder anything,
// so the guest reader draining its buffer is what lets the wire advance.
//
// Two wires ship here. LoopbackWire connects instances inside one process
// (unit tests, and later two WASM instances in one browser tab).
// ProcessWire connects an emulator process to a hub over Node's child IPC,
// which is how the two-process Liquid War gate runs. Slice 4 adds a third
// that carries the same frames over a WebRTC DataChannel; nothing in WAT
// changes when it does, because the frame is the contract.

// Datagrams past this many undelivered frames are dropped, as a full receive
// buffer drops them.
const MAX_QUEUE_FRAMES = 512;
// A stream frame is never dropped. The send window in src/09d-winsock.wat
// charges every DATA frame at least 64 of its 16384 bytes, so one connection
// has at most 256 in flight and all 64 sockets together 16384; past that plus
// headroom for control frames, something is not honouring the window.
const MAX_STREAM_QUEUE_FRAMES = 20000;

// The header is fixed-width, so the wire can describe what it is carrying
// without knowing what any of it means. Both the trace in host-imports.js and
// the arrival hook below print through this, so a frame reads the same way
// wherever it is observed.
const VLN_TYPES = { 1: 'SYN', 2: 'SYNACK', 3: 'DATA', 4: 'FIN', 5: 'RST', 6: 'DGRAM', 7: 'GONE', 8: 'WINDOW' };
const ip4 = (v) => `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;

// DirectPlay sessions ride the same wire under 'DPL1' (src/09d4-dplay-net.wat):
// +4 type, +8 src ip, +12 dst ip (-1 broadcast), +16 a, +20 b, +24 length.
const DPL_MAGIC = 0x314C5044;
const DPL_TYPES = {
  1: 'ENUM_REQ', 2: 'ENUM_REPLY', 3: 'JOIN_REQ', 4: 'JOIN_ACK',
  5: 'PLAYER_ADD', 6: 'PLAYER_DEL', 7: 'DATA', 8: 'LEAVE', 9: 'PLAYER_DATA',
};

// Win16 DDEML conversations ride it under 'DDE1' (src/09f-win16-ddeml.wat):
// +4 type, +8 src tag (the room address), +12 src conv, +16 dst conv,
// +20 payload length, +24 clipboard format. Read as a vln/1 frame instead,
// a poke (type 6) printed as "DGRAM" once vln/1 named its own type 6 -- and
// test-win16-hearts-vlan.js, which counts pokes, stopped seeing any.
const DDE_MAGIC = 0x31454444;
const DDE_TYPES = {
  1: 'CONNECT', 2: 'CONNECT_ACK', 3: 'DISCONNECT', 4: 'REQUEST', 5: 'DATA',
  6: 'POKE', 7: 'EXECUTE', 8: 'ADVSTART', 9: 'ACK', 10: 'ADVISE',
};

function describeFrame(bytes) {
  if (!bytes || bytes.length < 28) return `malformed ${bytes ? bytes.length : 0}B`;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) === DPL_MAGIC) {
    const type = dv.getUint32(4, true);
    const dst = dv.getUint32(12, true);
    const len = dv.getUint32(24, true);
    return `dpl ${DPL_TYPES[type] || `type${type}`} ${ip4(dv.getUint32(8, true))} `
      + `-> ${dst === 0xFFFFFFFF ? 'broadcast' : ip4(dst)}`
      + ` a=0x${dv.getUint32(16, true).toString(16)} b=0x${dv.getUint32(20, true).toString(16)}`
      + (len ? ` len=${len}` : '');
  }
  if (dv.getUint32(0, true) === DDE_MAGIC) {
    const type = dv.getUint32(4, true);
    const len = dv.getUint32(20, true);
    return `dde ${DDE_TYPES[type] || `type${type}`} ${ip4(dv.getUint32(8, true))}`
      + ` conv ${dv.getUint32(12, true)} -> ${dv.getUint32(16, true)}`
      + (len ? ` len=${len}` : '');
  }
  const type = dv.getUint32(4, true);
  const len = dv.getUint32(24, true);
  return `${VLN_TYPES[type] || `type${type}`} `
    + `${ip4(dv.getUint32(8, true))}:${dv.getUint32(12, true)} `
    + `-> ${ip4(dv.getUint32(16, true))}:${dv.getUint32(20, true)}`
    + (len ? ` len=${len}` : '');
}

// A vln/1 DGRAM frame: 'VLN1' magic (src/09d-winsock.wat) and type 6.
const VLN_MAGIC = 0x314E4C56;
function isDatagram(bytes) {
  if (!bytes || bytes.length < 28) return false;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(0, true) === VLN_MAGIC && dv.getUint32(4, true) === 6;
}

// vln/1 GONE: 'VLN1', type 7, src = the address that left, dst = broadcast.
function goneFrame(ip) {
  const out = new Uint8Array(28);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, VLN_MAGIC, true);
  dv.setUint32(4, 7, true);
  dv.setUint32(8, ip >>> 0, true);
  dv.setUint32(16, 0xFFFFFFFF, true);
  return out;
}

// The room address a frame was sent from, or null: +8 in both vln/1 and dpl/1.
function frameSource(bytes) {
  if (!bytes || bytes.length < 28) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== VLN_MAGIC && magic !== DPL_MAGIC) return null;
  return dv.getUint32(8, true);
}

class Wire {
  constructor() {
    this.inbox = [];
    this.sentFrames = 0;
    this.recvFrames = 0;
    this.droppedFrames = 0;
  }

  // Called by the transport when a frame arrives for this endpoint.
  //
  // A wire that is one link of a star room (lib/vlan-star.js) is not read by
  // a guest at all: the room reads it, to decide where the frame goes next.
  // `onFrame` hands the frame straight there instead of queuing it here.
  deliver(bytes) {
    if (this.onFrame) {
      this.recvFrames++;
      this.onFrame(bytes);
      return;
    }
    if (this.inbox.length >= MAX_QUEUE_FRAMES && isDatagram(bytes)) {
      // A datagram is allowed to be lost: a full receive buffer is exactly
      // where real UDP loses one, and a game that retries a request every
      // pass of its main loop outruns a peer that is busy drawing (Atomic
      // Bomberman's join, ~90 frames per batch).
      this.droppedFrames++;
      return;
    }
    if (this.inbox.length >= MAX_STREAM_QUEUE_FRAMES) {
      // Refusing anything else would silently lose a stream byte, and the
      // send window already bounds what can be in flight, so reaching this
      // means a sender is not honouring it; say so rather than hide it.
      this.droppedFrames++;
      throw new Error(`vlan-wire: inbox overflow (${MAX_STREAM_QUEUE_FRAMES} frames undelivered)`);
    }
    this.inbox.push(bytes);
    this.recvFrames++;
    // Arrival and observation are different events, and confusing them costs
    // hours: a frame sitting unread in this inbox looks exactly like a frame
    // that was never sent, because the only other trace point is the guest's
    // peek. This hook is what tells the two apart.
    if (this.onDeliver) this.onDeliver(bytes);
  }

  // The link to room address `ip` (a number; 0xFFFFFFFF for every remote
  // address) has closed. The guest cannot see a link, only frames, so the
  // news goes in as one: a vln/1 GONE the host writes into its own inbox, and
  // src/09d-winsock.wat resets every connection to that address and drops its
  // DirectPlay players. It skips the queue bound -- losing this frame would
  // leave a blocking recv waiting for ever, which is what it exists to end.
  peerGone(ip) {
    this.inbox.push(goneFrame(ip));
    this.recvFrames++;
  }

  peek() { return this.inbox.length ? this.inbox[0] : null; }
  commit() { this.inbox.shift(); }
  get pending() { return this.inbox.length; }

  // Subclasses implement transmission. Return false to apply backpressure.
  send(_bytes) { throw new Error('vlan-wire: send not implemented'); }
}

// Every endpoint on one loopback segment sees every frame except its own,
// which is what makes the WAT side responsible for address filtering.
class LoopbackSegment {
  constructor() { this.endpoints = []; }

  attach() {
    const wire = new LoopbackWire(this);
    this.endpoints.push(wire);
    return wire;
  }

  broadcast(from, bytes) {
    for (const ep of this.endpoints) {
      if (ep === from) continue;
      ep.deliver(bytes);
    }
    return true;
  }
}

class LoopbackWire extends Wire {
  constructor(segment) { super(); this.segment = segment; }
  send(bytes) {
    this.sentFrames++;
    return this.segment.broadcast(this, bytes);
  }
}

// One emulator process talking to a hub over child-process IPC. Frames
// arrive asynchronously, so they land in the inbox and the guest sees them
// the next time it drains the wire.
class ProcessWire extends Wire {
  constructor(channel) {
    super();
    this.channel = channel;
    channel.on('message', (msg) => {
      if (msg && msg.t === 'vln-gone') {
        const f = Buffer.from(msg.d, 'base64');
        this.peerGone(f.readUInt32LE(8));
        return;
      }
      if (!msg || msg.t !== 'vln') return;
      this.deliver(Uint8Array.from(Buffer.from(msg.d, 'base64')));
    });
  }

  send(bytes) {
    if (!this.channel.connected) return false;
    this.sentFrames++;
    return this.channel.send({ t: 'vln', d: Buffer.from(bytes).toString('base64') }) !== false;
  }
}

// The hub is the segment itself when the endpoints are separate processes:
// it repeats each frame to every other member and holds no state of its own.
class ProcessHub {
  constructor() { this.members = []; }

  add(child) {
    this.members.push(child);
    child.on('message', (msg) => {
      if (!msg || msg.t !== 'vln') return;
      // Learn the child's room address from what it sends, so its exit can
      // be announced: a process that dies says nothing on the wire.
      if (child.vlanIp == null) {
        const src = frameSource(Uint8Array.from(Buffer.from(msg.d, 'base64')));
        if (src != null && src !== 0xFFFFFFFF) child.vlanIp = src;
      }
      for (const other of this.members) {
        if (other === child) continue;
        if (other.connected) other.send(msg);
      }
    });
    child.on('exit', () => {
      this.members = this.members.filter(m => m !== child);
      if (child.vlanIp == null) return;
      const d = Buffer.from(goneFrame(child.vlanIp)).toString('base64');
      for (const other of this.members) {
        if (other.connected) other.send({ t: 'vln-gone', d });
      }
    });
  }
}

// The wire of an emulator process that has started guest child processes of
// its own (CreateProcess with redirected std handles, src/09d7-pipes.wat):
// it is both an endpoint and the hub between itself and its children, the
// way ProcessHub is for a test harness. A child's frames are delivered here
// and repeated to its siblings; frames sent here go to every child. A child
// only reads its IPC channel once its emulator is up and its std handles are
// attached, so frames for it wait in its queue until it says
// { t: 'child-ready' } -- the first command a parent writes to a child's
// stdin is sent within the same CreateProcess turn, long before that.
class ParentHub extends Wire {
  constructor() { super(); this.children = []; }

  send(bytes) {
    this.sentFrames++;
    const d = Buffer.from(bytes).toString('base64');
    for (const c of this.children) {
      if (!c.connected) continue;
      if (c.vlnReady) c.send({ t: 'vln', d });
      else c.vlnQueue.push(d);
    }
    return true;
  }

  // ip: the child's room address as a number, announced as GONE on its exit.
  addChild(child, ip) {
    child.vlnReady = false;
    child.vlnQueue = [];
    child.vlanIp = ip >>> 0;
    this.children.push(child);
    child.on('message', (msg) => {
      if (msg && msg.t === 'child-ready') {
        child.vlnReady = true;
        for (const d of child.vlnQueue) if (child.connected) child.send({ t: 'vln', d });
        child.vlnQueue = [];
        return;
      }
      if (!msg || msg.t !== 'vln') return;
      this.deliver(Uint8Array.from(Buffer.from(msg.d, 'base64')));
      for (const other of this.children) {
        if (other !== child && other.connected && other.vlnReady) other.send(msg);
      }
    });
    child.on('exit', () => {
      this.children = this.children.filter(c => c !== child);
      this.peerGone(child.vlanIp);
      const d = Buffer.from(goneFrame(child.vlanIp)).toString('base64');
      for (const other of this.children) {
        if (other.connected) other.send({ t: 'vln-gone', d });
      }
    });
  }
}

// ProcessWire and ProcessHub are Node-only (they speak child-process IPC) but
// they cost nothing to name here; the browser uses LoopbackSegment for two
// instances in one page and lib/vlan-rtc.js for two people in two browsers.
const _exports = {
  Wire, LoopbackSegment, LoopbackWire, ProcessWire, ProcessHub, ParentHub,
  MAX_QUEUE_FRAMES, describeFrame, goneFrame, isDatagram,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
} else if (typeof window !== 'undefined') {
  window.VlanWire = _exports;
}

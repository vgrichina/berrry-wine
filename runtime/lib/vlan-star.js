// The room as a star — docs/virtual-lan-party.md
//
// A WebRTC connection joins exactly two browsers, so a room of three needs
// more than one of them. The room is a star rather than a mesh:
//
//                     owner 10.0.0.1
//                    /      |       \
//             member .2  member .3  member .4
//
// Every member holds ONE link, to the owner; the owner holds one per member,
// hands out the seats, and routes. Most games that go over a LAN are client
// and server anyway, and for them every packet already goes through one
// machine. A peer-to-peer game still works, one hop longer: the owner forwards
// a frame addressed to another member onto that member's link.
//
// What the guest sees does not change. It is handed a Wire (lib/vlan-wire.js)
// exactly as before, and the room switch in WAT still decides what a frame
// means; this file only decides which link a frame leaves on, by reading the
// destination address every frame format on the wire already carries.
//
// It also holds the probe that tells the shell whether this machine's game is
// HOSTING, which nothing on the wire says on its own: a Quake II client binds
// the server port exactly like a server does. So the probe asks the way a
// player would -- a server-info query from a seat nobody holds -- and the
// answer, which a real server gives and a client does not, is caught before it
// reaches the wire.

(function (root, factory) {
  const wire = (typeof require === 'function') ? require('./vlan-wire') : root.VlanWire;
  const mod = factory(wire);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.VlanStar = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (VlanWire) {
  'use strict';

  const { Wire } = VlanWire;

  const VLN_MAGIC = 0x314E4C56;          // 'VLN1', src/09d-winsock.wat
  const DPL_MAGIC = 0x314C5044;          // 'DPL1', src/09d4-dplay-net.wat
  const VLN_HDR = 28;
  const VLN_DGRAM = 6;
  const BROADCAST = 'broadcast';

  // The room is 10.0.0.0/24 (lib/vlan-rtc.js). The owner is always seat 1,
  // members get 2 upward, and 254 is kept back for the host probe so its
  // question can never be mistaken for a player's.
  const ROOM_PREFIX = 0x0A000000;
  const OWNER_SEAT = 1;
  const PROBE_SEAT = 254;
  const LAST_MEMBER_SEAT = 253;

  function seatIp(seat) { return (ROOM_PREFIX | seat) >>> 0; }
  function ipText(v) { return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`; }
  function ipValue(text) {
    return String(text).split('.').reduce((a, o) => ((a << 8) | (Number(o) & 255)) >>> 0, 0) >>> 0;
  }

  // Where a frame is going: a room address as a number, BROADCAST, or null for
  // a frame this file cannot read. Anything unreadable goes everywhere --
  // DDEML's frames, say -- because every receiver's WAT already filters by
  // address, and flooding costs bandwidth where guessing would cost the frame.
  function frameDestination(bytes) {
    if (!bytes || bytes.length < 16) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = dv.getUint32(0, true);
    let dst;
    if (magic === VLN_MAGIC && bytes.length >= VLN_HDR) dst = dv.getUint32(16, true);
    else if (magic === DPL_MAGIC) dst = dv.getUint32(12, true);
    else return null;
    if (dst === 0xFFFFFFFF || (dst >>> 8) === (ROOM_PREFIX >>> 8) && (dst & 255) === 255) return BROADCAST;
    return dst >>> 0;
  }

  // The reset that answers a vln/1 SYN, or null for any other frame: its
  // endpoints swapped, as the listener's own stack would answer it.
  const VLN_SYN = 1;
  const VLN_RST = 5;
  function refusal(bytes) {
    if (!bytes || bytes.length < VLN_HDR) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== VLN_MAGIC || dv.getUint32(4, true) !== VLN_SYN) return null;
    return vlnHeader(VLN_RST, dv.getUint32(16, true), dv.getUint32(20, true),
      dv.getUint32(8, true), dv.getUint32(12, true));
  }
  function vlnHeader(type, srcIp, srcPort, dstIp, dstPort) {
    const out = new Uint8Array(VLN_HDR);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, VLN_MAGIC, true);
    dv.setUint32(4, type, true);
    dv.setUint32(8, srcIp, true);
    dv.setUint32(12, srcPort, true);
    dv.setUint32(16, dstIp, true);
    dv.setUint32(20, dstPort, true);
    return out;
  }

  // A link is anything with send(bytes) -> bool whose arriving frames can be
  // redirected: RtcWire, or a test's stand-in. Wire.deliver hands a frame to
  // `onFrame` when one is set instead of queuing it, which is what lets the
  // owner see a member's frame before any guest does.
  function tapLink(link, onFrame) {
    link.onFrame = onFrame;
    return link;
  }

  // The guest-facing wire of whoever owns the room. `send` is the guest
  // talking; `fromLink` is a member talking. Both go through route().
  class StarOwnerWire extends Wire {
    constructor() {
      super();
      this.address = ipText(seatIp(OWNER_SEAT));
      this.links = new Map();        // ip number -> link
      this.forwardedFrames = 0;
      this.lostFrames = 0;
      // Set by a probe: a frame the guest addresses to the probe seat is an
      // answer to the probe and is taken here, never routed.
      this.intercept = null;
    }

    addLink(address, link) {
      const ip = ipValue(address);
      this.links.set(ip, tapLink(link, bytes => this.fromLink(ip, bytes)));
    }

    removeLink(address) {
      const ip = ipValue(address);
      const link = this.links.get(ip);
      if (link) link.onFrame = null;
      this.links.delete(ip);
      // Whatever the guest had open to that seat will never be answered.
      if (link) this.peerGone(ip);
    }

    get memberCount() { return this.links.size; }

    send(bytes) {
      if (this.intercept && this.intercept(bytes)) return true;
      this.sentFrames++;
      return this._route(bytes, null);
    }

    fromLink(fromIp, bytes) {
      this._route(bytes, fromIp);
    }

    // `from` is null for the owner's own guest. The guest's own send gets the
    // link's backpressure answer, so a guest that outruns one member blocks
    // the way a real socket would; a forwarded frame has nobody to push back
    // on, so a refusal there is counted and the frame is lost -- the member it
    // was for is not draining, and holding everyone else for them is worse.
    _route(bytes, from) {
      const dst = frameDestination(bytes);
      const self = seatIp(OWNER_SEAT);
      if (dst === BROADCAST || dst === null) {
        if (from !== null) this._toGuest(bytes);
        for (const [ip, link] of this.links) {
          if (ip === from) continue;
          if (!link.send(bytes)) this.lostFrames++;
          else if (from !== null) this.forwardedFrames++;
        }
        return true;
      }
      if (dst === self) {
        if (from !== null) this._toGuest(bytes);
        return true;
      }
      const link = this.links.get(dst);
      // Nobody at that seat: on a real LAN the frame goes out and nothing
      // answers, and the guest's own protocol notices -- except a connect,
      // which would wait out its whole timeout for a machine the owner
      // already knows is not there. That one is refused at once, as a router
      // does for a host it has no route to.
      if (!link) {
        const rst = refusal(bytes);
        if (rst) {
          if (from === null) this._toGuest(rst);
          else { const back = this.links.get(from); if (back) back.send(rst); }
        }
        return true;
      }
      if (from === null) return link.send(bytes);
      if (link.send(bytes)) this.forwardedFrames++;
      else this.lostFrames++;
      return true;
    }

    _toGuest(bytes) {
      try { this.deliver(bytes); } catch (_) { this.lostFrames++; }
    }

    close() {
      for (const link of this.links.values()) {
        link.onFrame = null;
        try { link.close(); } catch (_) {}
      }
      this.links.clear();
    }
  }

  // The guest-facing wire of a member: one link, and the same probe seam the
  // owner has. Everything goes to the owner, who knows where it goes next.
  class StarMemberWire extends Wire {
    constructor(link, address) {
      super();
      this.address = address;
      this.link = tapLink(link, bytes => {
        try { this.deliver(bytes); } catch (_) { this.droppedFrames++; }
      });
      this.intercept = null;
    }

    send(bytes) {
      if (this.intercept && this.intercept(bytes)) return true;
      if (!this.link.send(bytes)) return false;
      this.sentFrames++;
      return true;
    }

    close() {
      this.link.onFrame = null;
      try { this.link.close(); } catch (_) {}
    }
  }

  // ---- the host probe ----------------------------------------------------
  //
  // `spec` comes from the app registry (lan.hostProbe in lib/apps.js):
  //   port      the game's server port
  //   query     the payload a searching client sends, as a latin-1 string
  //   label     optional regexp source; its first group labels the session
  //             ("noname demo1 1/4"), and a reply that does not match still
  //             counts as hosting
  //   protocol  'dplay' for a DirectPlay game (src/09d4-dplay-net.wat): the
  //             question is then the provider's own ENUM_REQ, which only a
  //             hosting session answers, and the label is the session's name
  //             and player count. port/query/label are not used.
  //   protocol  'announce' for a game whose server says so unasked: it
  //             broadcasts itself on `port` (Atomic Bomberman's IPX server
  //             announce), and a client never broadcasts there. Nothing is
  //             asked; the probe only watches what the guest sends, lets
  //             every frame through, and `label`, if given, is read from the
  //             announce's payload. Hosting ends when no announce has been
  //             seen for `forgetMs` (default 30000) -- a match in progress
  //             stops announcing, and nobody can join it then anyway.
  //   protocol  'serving' for a game whose hosting nothing on the wire shows
  //             and no question could safely find out: a TCP listener
  //             (`listen: port`) sends nothing until somebody connects, and
  //             a SYN to test it would hand the game a phantom player; a DDE
  //             service (`dde: true`, Hearts' dealer) would be asked whether
  //             to seat whoever connected. So the probe asks the emulator
  //             itself, through `probe.serving(spec)`, which the page sets to
  //             read the guest's own socket or service table; true/false, or
  //             null while it cannot tell yet.
  //
  // The question is a datagram to our own guest from the probe seat, put
  // straight into its inbox, and the answer is whatever the guest sends back
  // to that seat. Two unanswered questions in a row and we are not hosting --
  // one could be a server between maps.

  const PROBE_PORT = 27999;

  function latin1(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 255;
    return out;
  }

  // dpl/1, src/09d4-dplay-net.wat: 'DPL1' type src dst a b length payload.
  const DPL_HDR = 28;
  const DPL_ENUM_REQ = 1;
  const DPL_ENUM_REPLY = 2;
  const DPL_SESSION_SIZE = 76;
  function dplayFrame(type, srcIp, dstIp, payload) {
    const out = new Uint8Array(DPL_HDR + payload.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, DPL_MAGIC, true);
    dv.setUint32(4, type, true);
    dv.setUint32(8, srcIp, true);
    dv.setUint32(12, dstIp, true);
    dv.setUint32(24, payload.length, true);
    out.set(payload, DPL_HDR);
    return out;
  }

  function datagram(srcIp, srcPort, dstIp, dstPort, payload) {
    const out = new Uint8Array(VLN_HDR + payload.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, VLN_MAGIC, true);
    dv.setUint32(4, VLN_DGRAM, true);
    dv.setUint32(8, srcIp, true);
    dv.setUint32(12, srcPort, true);
    dv.setUint32(16, dstIp, true);
    dv.setUint32(20, dstPort, true);
    dv.setUint32(24, payload.length, true);
    out.set(payload, VLN_HDR);
    return out;
  }

  // A guest can bind sockets and answer probes without publishing presence
  // or opening a WebRTC connection. Only an explicit discovery packet leaves
  // this local segment as a UI request; normal guest traffic has no peers.
  class LocalProbeWire extends StarOwnerWire {
    constructor(spec, onDiscovery) {
      super();
      this.localOnly = true;
      this.discoveryRe = spec.discoveryQuery ? new RegExp(spec.discoveryQuery, 's') : null;
      this.discoveryPort = spec.port;
      this.onDiscovery = onDiscovery;
      this.closed = false;
    }
    send(bytes) {
      if (this.closed) return false;
      if (this.discoveryRe && frameDestination(bytes) === BROADCAST && bytes.length >= VLN_HDR) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (dv.getUint32(0, true) === VLN_MAGIC && dv.getUint32(4, true) === VLN_DGRAM
            && dv.getUint32(20, true) === this.discoveryPort) {
          const text = Array.from(bytes.subarray(VLN_HDR), b => String.fromCharCode(b)).join('');
          if (this.discoveryRe.test(text) && this.onDiscovery) this.onDiscovery();
        }
      }
      return super.send(bytes);
    }
    close() { this.closed = true; this.onDiscovery = null; this.inbox.length = 0; super.close(); }
  }

  class HostProbe {
    constructor(wire, spec, onChange) {
      this.wire = wire;
      this.spec = spec;
      this.onChange = onChange || (() => {});
      this.hosting = null;           // null, or { label }
      this.unanswered = 0;
      this.timer = null;
      this.labelRe = spec.label ? new RegExp(spec.label, 's') : null;
      this.responseRe = spec.response ? new RegExp(spec.response, 's') : null;
      this.lastHeard = 0;
      this.serving = null;           // 'serving': spec -> true/false/null
      if (spec.protocol === 'announce') wire.intercept = bytes => { this._heard(bytes); return false; };
      else if (spec.protocol !== 'serving') wire.intercept = bytes => this._answer(bytes);
    }

    ask() {
      if (this.spec.protocol === 'serving') {
        let now = null;
        try { now = this.serving ? this.serving(this.spec) : null; } catch (_) { now = null; }
        if (now === true && !this.hosting) this._set({ label: this.spec.labelText || '' });
        else if (now === false && this.hosting) this._set(null);
        return;
      }
      if (this.spec.protocol === 'announce') {
        if (this.hosting && Date.now() - this.lastHeard > (this.spec.forgetMs || 30000)) this._set(null);
        return;
      }
      this.unanswered++;
      if (this.unanswered > 2 && this.hosting) this._set(null);
      const frame = this.spec.protocol === 'dplay'
        ? dplayFrame(DPL_ENUM_REQ, seatIp(PROBE_SEAT), ipValue(this.wire.address), new Uint8Array(16))
        : datagram(seatIp(PROBE_SEAT), PROBE_PORT, ipValue(this.wire.address),
          this.spec.port, latin1(this.spec.query));
      try { this.wire.deliver(frame); } catch (_) {}
    }

    start(everyMs) {
      if (this.timer) return;
      this.ask();
      this.timer = setInterval(() => this.ask(), everyMs || 5000);
      if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    }

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      if (this.spec.protocol !== 'serving' && this.wire.intercept) this.wire.intercept = null;
    }

    _answer(bytes) {
      if (!bytes || bytes.length < VLN_HDR) return false;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (dv.getUint32(0, true) === DPL_MAGIC) return this._answerDplay(bytes, dv);
      if (dv.getUint32(0, true) !== VLN_MAGIC) return false;
      if (dv.getUint32(16, true) !== seatIp(PROBE_SEAT)) return false;
      if (dv.getUint32(12, true) !== this.spec.port) return true;
      let text = '';
      for (const b of bytes.subarray(VLN_HDR)) text += String.fromCharCode(b);
      if (this.responseRe && !this.responseRe.test(text)) return true;
      const m = this.labelRe && this.labelRe.exec(text);
      // Status lines are fixed-width columns ("%16s %8s %2i/%2i" in Quake
      // II), so the padding is squeezed out and "1/ 4" reads "1/4".
      const label = m && m[1]
        ? m[1].replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/').trim() : '';
      this.unanswered = 0;
      if (!this.hosting || this.hosting.label !== label) this._set({ label });
      return true;
    }

    // An ENUM_REPLY to the probe seat carries the session record: +32 max
    // players, +36 current players, +44 the name, NUL-terminated.
    _answerDplay(bytes, dv) {
      if (dv.getUint32(12, true) !== seatIp(PROBE_SEAT)) return false;
      if (dv.getUint32(4, true) !== DPL_ENUM_REPLY) return true;
      const len = dv.getUint32(24, true);
      if (len < DPL_SESSION_SIZE || bytes.length < DPL_HDR + DPL_SESSION_SIZE) return true;
      const rec = DPL_HDR;
      const max = dv.getUint32(rec + 32, true);
      const now = dv.getUint32(rec + 36, true);
      let name = '';
      for (let i = 0; i < 32; i++) {
        const b = bytes[rec + 44 + i];
        if (!b) break;
        name += String.fromCharCode(b);
      }
      const label = `${name.trim() || 'session'} ${now}/${max || '?'}`;
      this.unanswered = 0;
      if (!this.hosting || this.hosting.label !== label) this._set({ label });
      return true;
    }

    // A broadcast datagram the guest sent to the announce port.
    _heard(bytes) {
      if (!bytes || bytes.length < VLN_HDR) return;
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (dv.getUint32(0, true) !== VLN_MAGIC || dv.getUint32(4, true) !== VLN_DGRAM) return;
      if (dv.getUint32(20, true) !== this.spec.port || frameDestination(bytes) !== BROADCAST) return;
      let label = '';
      if (this.labelRe) {
        let text = '';
        for (const b of bytes.subarray(VLN_HDR)) text += String.fromCharCode(b);
        const m = this.labelRe.exec(text);
        label = m && m[1] ? m[1].replace(/\s+/g, ' ').trim() : '';
      }
      this.lastHeard = Date.now();
      if (!this.hosting || this.hosting.label !== label) this._set({ label });
    }

    _set(value) {
      this.hosting = value;
      try { this.onChange(value); } catch (_) {}
    }
  }

  // ---- seats -------------------------------------------------------------

  // The owner is the only one who hands out seats, so there is nothing to
  // race: the lowest seat nobody holds, from 2 up.
  function nextMemberSeat(taken) {
    const used = new Set(Array.from(taken, a => String(a)));
    for (let seat = OWNER_SEAT + 1; seat <= LAST_MEMBER_SEAT; seat++) {
      const address = ipText(seatIp(seat));
      if (!used.has(address)) return address;
    }
    throw new Error('vlan: the room is full');
  }

  return {
    StarOwnerWire, StarMemberWire, LocalProbeWire, HostProbe,
    frameDestination, datagram, dplayFrame, nextMemberSeat, seatIp, ipText, ipValue, latin1,
    BROADCAST, OWNER_SEAT, PROBE_SEAT, PROBE_PORT,
    OWNER_ADDRESS: ipText(seatIp(OWNER_SEAT)),
  };
}));

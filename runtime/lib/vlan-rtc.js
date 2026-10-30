// Virtual LAN over WebRTC — docs/virtual-lan-party.md
//
// lib/vlan-wire.js defines what a wire owes the emulator: send, peek, commit.
// LoopbackWire satisfies it inside one process and ProcessWire across two on
// one machine. This is the third: two browsers, two people, one segment.
//
// Nothing in WAT changes to support it. The guest still sees a room address
// and a byte stream; the frame is the contract, and this file only moves
// frames between machines.
//
// Three parts live here:
//
//   RtcWire       a Wire whose transport is an RTCDataChannel
//   joinNetwork   presence: who is here, at what address
//   connect       the introduction, addressed to exactly one peer
//
// The DataChannel is configured ordered and fully reliable. That is not the
// obvious choice for a game — an action game would normally want unreliable
// delivery so a late packet is dropped rather than delaying the ones behind
// it. It is the right choice here because what travels is a TCP byte stream
// the guest believes is TCP: dropping or reordering a byte is not a dropped
// frame of animation, it is a corrupted protocol stream. The reliability the
// guest assumes has to come from somewhere, and the DataChannel provides it
// for free.
//
// Datagrams are the exception, and get a second channel. A vln/1 DGRAM is a
// UDP packet the guest already expects to lose, and on the reliable channel
// one lost packet holds up every frame behind it -- other games' packets
// included -- while SCTP retransmits something the game has long since sent
// a newer copy of. So once the reliable channel is open the offering side
// adds 'vln-dg' (unordered, no retransmits) to the same connection, and DGRAM
// frames travel there when it is open. It is opened late on purpose: an
// answerer that predates it takes the first channel it is offered as the
// stream, and that is still 'vln'. Either side without it simply sends
// datagrams on the reliable channel, as before.
//
// ---- what is public, and what is not ------------------------------------
//
// Presence is public: everyone signed in can see who else is on the segment,
// under what name, at what address. That is the point of a shared network —
// it is the part that replaces matchmaking.
//
// Addresses are not. A WebRTC offer carries ICE candidates, which carry the
// publisher's LAN and public IP, so publishing an offer to the whole network
// would hand every signed-in user a list of everyone's home addresses whether
// or not they ever play together. Instead each peer advertises an ephemeral
// public key in its presence record, and an offer is encrypted to the one
// peer it is meant for and left in that peer's inbox. The store stays
// world-readable; the SDP in it is readable by exactly one person.

(function (root, factory) {
  const wire = (typeof require === 'function')
    ? require('./vlan-wire')
    : root.VlanWire;
  // Crypto comes from the vendored tweetnacl rather than crypto.subtle, so a
  // session works on a plain-http origin. See the header of
  // lib/vendor/tweetnacl.js for the measurement that forced that choice.
  const nacl = (typeof require === 'function')
    ? require('./vendor/tweetnacl')
    : root.nacl;
  const mod = factory(wire, nacl);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.VlanRtc = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (VlanWire, nacl) {
  'use strict';

  const { Wire, isDatagram } = VlanWire;

  const DATAGRAM_LABEL = 'vln-dg';
  // Past this much queued on the datagram channel a packet is dropped, not
  // queued: a stale position update is worth less than none, and a refusal
  // would make the guest's sendto block, which real UDP never does.
  const DATAGRAM_BUFFER_LIMIT = 256 << 10;

  if (!nacl || !nacl.box || !nacl.secretbox || !nacl.hash) {
    // Every entry point below would otherwise fail deep inside a join with a
    // TypeError on `undefined`, which reads as a signaling fault. Say what is
    // actually missing, once, at load.
    throw new Error('vlan-rtc: lib/vendor/tweetnacl.js is not loaded');
  }

  const DEFAULT_JOIN_TIMEOUT_MS = 60000;
  const POLL_INTERVAL_MS = 1000;
  // How long an answer waits for the offering peer to open its channel.
  // A joiner gives up on its own clock (20s in a star room), so this only
  // has to outlast a slow ICE check, never a closed tab.
  const ANSWER_ESTABLISH_MS = 20000;

  // A presence record is a claim with an expiry, not a registration. Nobody
  // reliably says goodbye — browsers get closed, laptops get shut — so a peer
  // counts as present only while its record is fresh, and it keeps the record
  // fresh by republishing. Everything else here (who is listed, which
  // addresses are taken) follows from that one rule.
  //
  // The freshness clock is the store's own `updatedAt`, never a timestamp in
  // the record body. A peer cannot forge it in either direction: it cannot
  // backdate to look like it arrived first, and — more importantly — it
  // cannot post-date to stay listed after it has gone.
  //
  // The TTL is generous on purpose. Browsers throttle timers in tabs that are
  // not in front: a 15-second heartbeat is observed to stretch to 30 seconds
  // and degrades toward once a minute the longer a tab stays hidden. Two
  // windows means one of them is always hidden, so a TTL tight enough to look
  // responsive would age out the very peer being waited for. Better to keep a
  // departed peer listed a little too long than to lose a present one.
  const PRESENCE_TTL_MS = 150000;
  const PRESENCE_REFRESH_MS = 15000;

  // Public STUN only. There is no TURN here, which means two peers behind
  // symmetric NATs will fail to connect and there is nothing this file can do
  // about it — relaying someone else's game traffic needs a server somebody
  // pays for. connect() reports that case as a distinct failure rather than a
  // generic timeout, so the UI can say something true about it.
  const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

  // How long an ICE 'disconnected' is allowed to be a blip before it counts as
  // the other player being gone. Short enough that a closed tab is reported
  // while the person is still looking at the screen, long enough that a Wi-Fi
  // hiccup mid-rally does not put a "they left" banner over a live game.
  const DISCONNECT_GRACE_MS = 4000;

  class RtcWire extends Wire {
    // `pc` is optional and only used to notice a peer that vanished. A data
    // channel's onclose is a clean goodbye; a browser that was closed, a phone
    // that went to sleep or a Wi-Fi drop produces no goodbye at all, and the
    // channel can sit in 'open' while ICE has already given up. The peer
    // connection is the only thing that reports that, so both are watched and
    // whichever fires first wins.
    constructor(channel, pc) {
      super();
      this.channel = channel;
      this.closed = false;
      // Set by whoever owns the match to hear that the other player is gone.
      // Called at most once, and never for a close this side asked for --
      // quitting is not a disconnection and must not raise one in the UI.
      this.onClosed = null;
      this._lostFired = false;
      this._closedByUs = false;
      if (pc) {
        this.pc = pc;
        pc.addEventListener('connectionstatechange', () => {
          const state = pc.connectionState;
          // 'disconnected' is not yet a verdict: ICE reports it for a blip it
          // often recovers from within a second or two, and announcing "the
          // other player left" for a blip is worse than announcing it late.
          // 'failed' and 'closed' are final and need no wait.
          if (state === 'disconnected') {
            if (this._graceTimer) return;
            this._graceTimer = setTimeout(() => {
              this._graceTimer = null;
              if (pc.connectionState !== 'connected') this._lost(pc.connectionState);
              // Lowered by the test, which cannot wait four seconds per case.
            }, RtcWire.disconnectGraceMs);
            return;
          }
          if (this._graceTimer && state === 'connected') {
            clearTimeout(this._graceTimer);
            this._graceTimer = null;
          }
          if (state === 'failed' || state === 'closed') this._lost(state);
        });
      }
      this.dgChannel = null;
      this._listen(channel);
      channel.onclose = () => { this.closed = true; this._lost('channel-closed'); };
      channel.onerror = () => { this.closed = true; this._lost('channel-error'); };
    }

    _listen(channel) {
      channel.binaryType = 'arraybuffer';
      channel.onmessage = (ev) => {
        const data = ev.data;
        // A peer that sends something that is not a frame is not a peer we
        // can talk to; ignoring it keeps a malformed sender from stopping
        // the guest, which has no way to report it.
        if (data instanceof ArrayBuffer) this.deliver(new Uint8Array(data));
        else if (ArrayBuffer.isView(data)) this.deliver(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      };
    }

    // The unordered datagram channel, from either end: the offerer opens it
    // with openDatagramChannel(), the answerer is handed it by ondatachannel.
    // Losing it is not losing the peer -- datagrams fall back to the
    // reliable channel -- so its close only forgets it.
    attachDatagramChannel(channel) {
      if (this.closed) { try { channel.close(); } catch (_) {} return; }
      this.dgChannel = channel;
      this._listen(channel);
      const forget = () => { if (this.dgChannel === channel) this.dgChannel = null; };
      channel.onclose = forget;
      channel.onerror = forget;
    }

    openDatagramChannel(pc) {
      const peer = pc || this.pc;
      if (!peer || typeof peer.createDataChannel !== 'function') return;
      try {
        this.attachDatagramChannel(peer.createDataChannel(DATAGRAM_LABEL, { ordered: false, maxRetransmits: 0 }));
      } catch (_) {
        // A browser that cannot open it keeps datagrams on the reliable one.
      }
    }

    // One notification per wire, and none for our own close(). The guest is
    // still running when this fires: the frames simply stop arriving, and
    // without this nothing anywhere says why.
    _lost(why) {
      if (this._lostFired || this._closedByUs) return;
      this._lostFired = true;
      this.closed = true;
      if (this._graceTimer) { clearTimeout(this._graceTimer); this._graceTimer = null; }
      // When this wire is the guest's own (a two-person lobby link), tell the
      // guest too: every connection it had over it is now dead. A link inside
      // a star room has `onFrame` set and is announced by the room instead.
      if (!this.onFrame) this.peerGone(0xFFFFFFFF);
      if (typeof this.onClosed === 'function') {
        try { this.onClosed(why); } catch (_) {}
      }
    }

    send(bytes) {
      if (this.closed) return false;
      const dg = this.dgChannel;
      if (dg && dg.readyState === 'open' && isDatagram(bytes)) {
        // Accepted either way, as a UDP send is: dropping here is the
        // network losing the packet, which the guest is written to survive.
        if (dg.bufferedAmount > DATAGRAM_BUFFER_LIMIT) { this.droppedFrames++; return true; }
        try {
          dg.send(bytes);
          this.sentFrames++;
          return true;
        } catch (_) {
          // Fall through to the reliable channel.
        }
      }
      if (this.channel.readyState !== 'open') return false;
      // Backpressure is real here in a way it is not on a loopback: the
      // channel buffers, and a guest that outruns the link would grow that
      // buffer without bound. Refusing the frame makes the guest's own send
      // block, which is exactly what a real socket would do.
      if (this.channel.bufferedAmount > 1 << 20) return false;
      try {
        this.channel.send(bytes);
      } catch (_) {
        return false;
      }
      this.sentFrames++;
      return true;
    }

    static disconnectGraceMs = DISCONNECT_GRACE_MS;

    close() {
      this.closed = true;
      this._closedByUs = true;
      if (this._graceTimer) { clearTimeout(this._graceTimer); this._graceTimer = null; }
      if (this.dgChannel) { try { this.dgChannel.close(); } catch (_) {} this.dgChannel = null; }
      try { this.channel.close(); } catch (_) {}
    }
  }

  // ---- encoding ---------------------------------------------------------

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64url(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function unb64url(text) {
    const s = atob(String(text).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function newRoomSecret() {
    return b64url(crypto.getRandomValues(new Uint8Array(16)));
  }

  // ---- scopes -----------------------------------------------------------
  //
  // A scope names the segment two peers are trying to share. All three tiers
  // in docs/virtual-lan-party.md are the same string with more of it filled
  // in, so nothing downstream branches on which tier is in use:
  //
  //   scopeFor({})                        one network, everyone signed in
  //   scopeFor({exe: 'lwwin.exe'})        a per-program channel
  //   scopeFor({exe: 'lwwin.exe', room})  a named room inside that channel
  //
  // The executable is folded to lower case and stripped of any directory,
  // because the same program launched from two paths is still the same game.

  function scopeFor(opts) {
    const o = opts || {};
    const parts = ['net:' + (o.network || 'default')];
    if (o.exe) parts.push('exe:' + String(o.exe).replace(/^.*[\\/]/, '').toLowerCase());
    if (o.room) parts.push('room:' + o.room);
    return parts.join('/');
  }

  // tweetnacl's hash is SHA-512; the first 32 bytes of it stand in for the
  // SHA-256 this used to call. These are record *names*, not secrets carrying
  // the session, and truncating a SHA-512 is a standard construction.
  //
  // It does mean the key strings differ from the WebCrypto scheme's, so a page
  // on the old code and a page on this one compute different keys and never see
  // each other. That is DELIBERATE, and lib/watx-launcher.js's exported
  // sha256PureHex would have avoided it: same digest as before, no new
  // dependency, record keys unchanged. The reason not to is the sealing, which
  // cannot be kept compatible — AES-GCM and secretbox are different
  // ciphertexts. Matching keys with mismatched seals would put both pages in
  // one room where every introduction silently fails, which is a worse failure
  // than not seeing each other at all: "nobody is here" is a state the lobby
  // already explains, and "they are listed but never connect" reads as a NAT
  // problem and sends someone hunting for a TURN server.
  //
  // Still async, though nothing here awaits any more: every caller is async
  // and the signatures are what the tests and call sites are written against.
  async function hashedKey(prefix, material) {
    const digest = nacl.hash(enc.encode(prefix + material)).subarray(0, 32);
    return b64url(digest).slice(0, 22);
  }

  // Where presence for a scope is published. A secret, when there is one,
  // is folded in before hashing, so a room's key cannot be computed by
  // someone who knows only which channel it is in.
  async function signalKeyFor(scope, secret) {
    return 'vln-signal-' + await hashedKey('vln-scope:', secret ? `${scope}#${secret}` : scope);
  }

  function roomKeyFor(secret) {
    return signalKeyFor(scopeFor({}), secret);
  }

  // Where offers *for a given peer* are left. Deriving it from the recipient
  // means a peer polls one key to find everything addressed to it, without
  // anyone having to write to a record they do not own.
  async function inboxKeyFor(scope, userId, secret) {
    const material = (secret ? `${scope}#${secret}` : scope) + '|inbox:' + userId;
    return 'vln-inbox-' + await hashedKey('vln-inbox:', material);
  }

  // ---- addresses --------------------------------------------------------
  //
  // Addresses are claimed, not assigned: there is no server to hand them out,
  // only the presence list saying which ones are currently spoken for.
  //
  // They are SEATS, not random draws, because the address is something a
  // person has to type. A 1998 game asks for its host by IP, in a dialog with
  // no clipboard, and often on a phone keyboard. So the room is 10.0.0.0/24
  // and seats run 1, 2, 3: the first person here — the one who hosts — is
  // always 10.0.0.1, and every game's host-IP box takes "10.1", which
  // inet_addr widens to exactly that.
  //
  // The cost of seats over random draws is that collisions stop being rare
  // and become the normal case: two people opening the same room at the same
  // moment both see an empty segment and both want seat 1. That is what
  // claimLoses and the retry loop in joinNetwork are for, and with three
  // seats they are on the hot path rather than theoretical.
  //
  // Seat 1 is freed when its holder leaves, so a later arrival can become
  // 10.0.0.1. That is the behaviour we want — the host's address is a
  // property of the room, not of a person — but it does mean a client that
  // outlives its host may see a *different* machine answer at the address it
  // was talking to. Every game here reconnects from its own menu rather than
  // resuming a socket, so that reads as "the host left", which it is.

  const ADDR_PREFIX = [10, 0, 0];
  const MAX_SEATS = 254;                        // .0 and .255 are not seats

  function formatAddress(v) {
    return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`;
  }

  function seatAddress(seat) {
    return `${ADDR_PREFIX[0]}.${ADDR_PREFIX[1]}.${ADDR_PREFIX[2]}.${seat}`;
  }

  // Who yields when two peers pick the same address. Deliberately not "who
  // was first": the store's timestamp is rewritten by every heartbeat, so
  // arrival order stops being recoverable after fifteen seconds, and a
  // timestamp in the record body would be a client clock and therefore a lie
  // waiting to happen.
  //
  // Comparing user ids instead needs no clock and no history. Both peers see
  // the same two ids and reach the same conclusion without exchanging
  // anything, and exactly one of them moves. It is arbitrary, not fair — but
  // fairness is not the requirement; agreement is.
  function claimLoses(mine, theirs) {
    if (!mine || !theirs || !mine.address || mine.address !== theirs.address) return false;
    return theirs.userId < mine.userId;
  }

  // The lowest free seat, so an empty room always yields 10.0.0.1 and the
  // numbering stays dense and predictable as people come and go.
  function pickAddress(taken) {
    const used = new Set(taken);
    for (let seat = 1; seat <= MAX_SEATS; seat++) {
      const candidate = seatAddress(seat);
      if (!used.has(candidate)) return candidate;
    }
    // 254 seats taken in a room built for a handful of players is not a busy
    // segment, it is something republishing junk. Say so rather than hand
    // back a duplicate.
    throw new Error('vlan: no free address on the segment');
  }

  // ---- identity and directed encryption ---------------------------------
  //
  // The keypair is ephemeral and per session. It is not an identity — the
  // signaling service already says who each user is — it exists so that an
  // offer can be encrypted to one recipient. A fresh pair each session means
  // yesterday's published records cannot be decrypted today.

  // X25519 rather than P-256, and the key a pair of these agrees on is a raw
  // 32-byte array rather than a non-extractable CryptoKey. Non-extractable was
  // worth something: the browser held the private key where script could not
  // read it. Here it is an ordinary Uint8Array in the page's heap, which is a
  // real reduction in what a hostile script on this origin cannot reach — and
  // the trade is deliberate, because the alternative on http is no session at
  // all. The pair stays ephemeral and per session, so what leaks is one
  // session's SDP, never an identity.
  async function newIdentity() {
    const pair = nacl.box.keyPair();
    return { keyPair: pair, publicKey: b64url(pair.publicKey) };
  }

  async function sharedKeyWith(identity, theirPublicKey) {
    // box.before is the X25519 agreement plus HSalsa20, i.e. exactly the key
    // box() would compute internally — precomputing it here keeps one key per
    // peer instead of per message.
    return nacl.box.before(unb64url(theirPublicKey), identity.keyPair.secretKey);
  }

  async function cryptoKeyFor(secret) {
    // Stands in for the HKDF: one hash over a domain-separated string, first
    // 32 bytes. The salt and info of the old construction become literal
    // prefixes, so the derivation is still specific to this use.
    return nacl.hash(enc.encode('vln-signal|sdp|' + secret)).subarray(0, 32);
  }

  async function sealed(key, obj) {
    // secretbox is XSalsa20-Poly1305: authenticated like AES-GCM was, with a
    // 24-byte nonce instead of a 12-byte IV. The envelope keeps the field name
    // `iv` so every stored record and call site reads the same; only its
    // length changed.
    const iv = crypto.getRandomValues(new Uint8Array(nacl.secretbox.nonceLength));
    const ct = nacl.secretbox(enc.encode(JSON.stringify(obj)), iv, key);
    return { iv: b64url(iv), ct: b64url(ct) };
  }

  async function opened(key, envelope) {
    if (!envelope || !envelope.iv || !envelope.ct) return null;
    try {
      // secretbox.open returns null on a bad key, a bad nonce or a forged tag,
      // where subtle.decrypt threw; both land in the same "cannot use this
      // record" case below.
      const plain = nacl.secretbox.open(unb64url(envelope.ct), unb64url(envelope.iv), key);
      if (!plain) return null;
      return JSON.parse(dec.decode(plain));
    } catch (_) {
      // Not for us, or stale, or tampered with. All three are the same thing
      // from here: a record we cannot use. A shared key is a shared namespace
      // and anything at all may appear under it.
      return null;
    }
  }

  // ---- signaling client -------------------------------------------------

  class SignalingClient {
    constructor(base) { this.base = base || ''; }

    async _json(method, url, body) {
      // Every read gets a unique query. Berrry's API answers with no
      // Cache-Control and Cloudflare caches the GETs: on 2026-09-21 one
      // signed-in /api/auth/user response was served to every visitor for
      // hours (a signed-out page believed it was that user and never asked
      // anyone to sign in), and the presence lists behind hostedRooms() came
      // back stale. An extra query misses the edge cache.
      if (method === 'GET') url += `${url.includes('?') ? '&' : '?'}fresh=${Date.now()}`;
      const res = await fetch(this.base + url, {
        method,
        cache: 'no-store',
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        throw Object.assign(new Error('not signed in'), { needsLogin: true });
      }
      if (!res.ok) return null;
      return res.json();
    }

    // Berrry's API (berrry-server src/backend-api) is adapted here, once, to
    // the shapes Network works in: user ids as strings (Berrry's are
    // integers, and a room link's ?room= is a string), a name, a publisher
    // list as { users }, and a read as { value, updatedAt }.
    async whoami() {
      const me = await this._json('GET', '/api/auth/user');
      if (!me || me.id == null) return me;
      return Object.assign({}, me, {
        id: String(me.id),
        name: me.name || me.display_name || me.username || null,
      });
    }
    // POST, not PUT: POST creates or replaces, PUT answers 404 for a key
    // that was never written, which is every presence record's first write.
    publish(key, value) { return this._json('POST', `/api/data/${encodeURIComponent(key)}?visibility=public`, value); }
    withdraw(key) { return this._json('DELETE', `/api/data/${encodeURIComponent(key)}`); }
    // A bare array of { userId, email, updatedAt, value } -- readable signed
    // out. It carries each value, so a reader need not ask for them one by
    // one. The email is dropped here: nothing of ours has any use for it.
    async publishers(key) {
      const list = await this._json('GET', `/api/public-data/users/${encodeURIComponent(key)}`);
      const rows = Array.isArray(list) ? list : (list && list.users) || [];
      return {
        users: rows.map(u => {
          const row = { userId: String(u.userId), name: u.name || null, updatedAt: u.updatedAt };
          if ('value' in u) row.value = u.value;
          return row;
        }),
      };
    }
    // The stored value itself, with no timestamp; peers() and _readInbox()
    // take the timestamp from the publisher list instead.
    async read(userId, key) {
      const value = await this._json('GET',
        `/api/public-data/${encodeURIComponent(userId)}/${encodeURIComponent(key)}`);
      return value == null ? null : { value, updatedAt: null };
    }
  }

  // One publisher's record: the value the list already carried, or a read.
  async function recordOf(signaling, u, key) {
    if ('value' in u) return { value: u.value, updatedAt: u.updatedAt };
    const rec = await signaling.read(u.userId, key);
    if (!rec) return null;
    return { value: rec.value, updatedAt: rec.updatedAt || u.updatedAt };
  }

  // ---- connection establishment -----------------------------------------

  function gathered(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      // Some candidates never resolve (a TURN server that is not there), and
      // the ones already gathered are usually enough. Publish rather than
      // wait forever.
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }, 5000);
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => Date.now();

  function established(pc, channel, timeoutMs) {
    return new Promise((resolve, reject) => {
      const finish = (fn, arg) => {
        clearTimeout(timer);
        pc.removeEventListener('connectionstatechange', onState);
        fn(arg);
      };
      const timer = setTimeout(() => finish(reject, Object.assign(
        new Error('the connection could not be established'),
        // Both sides exchanged descriptions, so the introduction worked and
        // the direct path did not. That is the NAT case, and it needs a relay
        // this project does not run.
        { needsRelay: true })), timeoutMs);
      const onState = () => {
        if (pc.connectionState === 'failed') {
          finish(reject, Object.assign(new Error('the connection failed'), { needsRelay: true }));
        }
      };
      pc.addEventListener('connectionstatechange', onState);
      if (channel.readyState === 'open') return finish(resolve);
      channel.onopen = () => finish(resolve);
    });
  }

  // ---- the network ------------------------------------------------------

  class Network {
    constructor(config) {
      Object.assign(this, config);
      this._timer = null;
      this._left = false;
      // An inbox key is a rendezvous point, not a mailbox we own: to send to
      // a peer we publish *our own* record under a key derived from *their*
      // id. So the only records we can ever withdraw are the ones we wrote,
      // and they live under other people's inbox keys. Remember which.
      this._posted = new Set();
      // accept(): connections that completed after the call that answered
      // them returned, the offers already answered once, and the wake-up
      // for a waiting call.
      this._admitted = [];
      this._tried = new Set();
      this._acceptWake = null;
    }

    async _post(inboxKey, value) {
      this._posted.add(inboxKey);
      await this.signaling.publish(inboxKey, value);
    }

    async _unpost(inboxKey) {
      this._posted.delete(inboxKey);
      await this.signaling.withdraw(inboxKey).catch(() => {});
    }

    // Everyone whose presence record is still fresh, us excluded. A stale
    // record is not deleted — nobody is around to delete it — so freshness is
    // decided here on every read.
    async peers() {
      const list = await this.signaling.publishers(this.presenceKey);
      const users = ((list && list.users) || []).filter(u => u.userId !== this.userId);
      const out = [];
      for (const u of users) {
        const rec = await recordOf(this.signaling, u, this.presenceKey);
        const value = rec && rec.value;
        if (!value || typeof value.publicKey !== 'string') continue;
        // A record with no server timestamp is one we cannot age out, so it
        // is not one we are willing to treat as present.
        const stampedAt = Date.parse(rec.updatedAt || '');
        if (!Number.isFinite(stampedAt)) continue;
        if (now() - stampedAt > PRESENCE_TTL_MS) continue;
        out.push({
          userId: u.userId,
          name: String(value.name || u.name || 'player'),
          address: value.address,
          publicKey: value.publicKey,
          status: value.status || 'available',
          // A star room (lib/vlan-room.js): 'owner' routes and hands out
          // seats, 'member' holds one link to it. Absent for the lobby's
          // pairwise peers, which have neither.
          role: typeof value.role === 'string' ? value.role : null,
          // What this peer's game says it is serving, when it is serving
          // anything: { label } from the host probe in lib/vlan-star.js.
          hosting: value.hosting && typeof value.hosting === 'object'
            ? { label: String(value.hosting.label || '') } : null,
          updatedAt: stampedAt,
        });
      }
      return out;
    }

    // What a peer publishes about itself: who it is, where to reach it on the
    // segment, and the key to encrypt an offer to it. No timestamp — the
    // store supplies that, and a second one in here would only be a second
    // thing to disagree.
    _record() {
      const record = {
        name: this.name,
        address: this.address,
        publicKey: this.identity.publicKey,
        status: this.status,
      };
      if (this.role) record.role = this.role;
      if (this.hosting) record.hosting = this.hosting;
      return record;
    }

    async setRole(role, address) {
      this.role = role;
      if (address !== undefined) this.address = address;
      await this._announce();
    }

    async setHosting(hosting) {
      this.hosting = hosting || null;
      await this._announce();
    }

    async _announce() {
      await this.signaling.publish(this.presenceKey, this._record());
    }

    // Republishing is what keeps this peer visible; stopping is how it
    // disappears. The interval is unref'd where that exists so a forgotten
    // network cannot hold a Node process open.
    _startHeartbeat() {
      if (this._timer) return;
      this._timer = setInterval(() => {
        if (this._left) return;
        this._announce().catch(() => {});
      }, PRESENCE_REFRESH_MS);
      if (this._timer && typeof this._timer.unref === 'function') this._timer.unref();
      // Coming back to a hidden tab is the one moment we know throttling has
      // just ended and the record is at its stalest. Refresh straight away
      // rather than waiting out whatever interval the browser was allowing.
      if (typeof document !== 'undefined' && document.addEventListener) {
        this._onVisible = () => {
          if (!this._left && !document.hidden) this._announce().catch(() => {});
        };
        document.addEventListener('visibilitychange', this._onVisible);
      }
    }

    async setStatus(status) {
      this.status = status;
      await this._announce();
    }

    // Open a connection to one peer. The offer is encrypted to that peer's
    // advertised key and left in that peer's inbox, so no one else on the
    // segment learns this machine's addresses.
    async connect(peerId, options) {
      const opts = options || {};
      const timeoutMs = opts.timeoutMs || DEFAULT_JOIN_TIMEOUT_MS;
      const deadline = now() + timeoutMs;
      const onStatus = opts.onStatus || this.onStatus;

      const peer = (await this.peers()).find(p => p.userId === peerId);
      if (!peer) throw new Error('vlan: that peer is no longer on the segment');

      const key = await sharedKeyWith(this.identity, peer.publicKey);
      const theirInbox = await inboxKeyFor(this.scope, peer.userId, this.secret);
      const myInbox = await inboxKeyFor(this.scope, this.userId, this.secret);

      const pc = new RTCPeerConnection({ iceServers: this.iceServers });
      try {
        onStatus('offering');
        const channel = pc.createDataChannel('vln', { ordered: true });
        const wire = new RtcWire(channel, pc);
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        await this._post(theirInbox, Object.assign(
          { from: this.userId, publicKey: this.identity.publicKey },
          await sealed(key, { role: 'offer', sdp: pc.localDescription.sdp, at: now() })));

        onStatus('waiting for an answer');
        let answered = false;
        let answeredWith = null;
        while (!answered && now() < deadline) {
          const msg = await this._readInbox(myInbox, peer, key, 'answer');
          if (msg) {
            await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
            answeredWith = msg;
            answered = true;
            break;
          }
          await sleep(POLL_INTERVAL_MS);
        }
        if (!answered) throw new Error('vlan: the peer did not answer');

        onStatus('connecting');
        await established(pc, channel, Math.max(5000, deadline - now()));
        // Only now, so an answerer that predates it still gets 'vln' first.
        wire.openDatagramChannel(pc);
        // The offer has done its job; leaving it published would hand a
        // future reader a description of this machine to attempt.
        this._unpost(theirInbox);
        // `answer` carries whatever the answering side added to its sealed
        // reply -- a star room's owner puts the seat it is handing out there.
        return { wire, pc, peer, answer: answeredWith };
      } catch (err) {
        try { pc.close(); } catch (_) {}
        this._unpost(theirInbox);
        throw err;
      }
    }

    // Read one message of the expected role out of an inbox. A record is only
    // considered if its author is who it claims to be *and* the key it was
    // sealed with is the one that author advertised — otherwise a third party
    // could drop a record in and have it treated as coming from the peer.
    async _readInbox(inboxKey, expectFrom, key, role) {
      const list = await this.signaling.publishers(inboxKey);
      for (const u of ((list && list.users) || [])) {
        if (expectFrom && u.userId !== expectFrom.userId) continue;
        const rec = await recordOf(this.signaling, u, inboxKey);
        const value = rec && rec.value;
        if (!value || value.from !== u.userId) continue;
        if (expectFrom && value.publicKey !== expectFrom.publicKey) continue;
        const msg = await opened(key, value);
        if (msg && msg.role === role) return Object.assign({}, msg, { from: u.userId });
      }
      return null;
    }

    // Wait for someone to offer us a connection and accept it. The caller
    // decides whether it wants to be connectable at all — this is only ever
    // running while it is called.
    //
    // An offer can be stale: its author closed the tab after posting it, and
    // nobody else can withdraw it. Answering one gets no data channel ever,
    // so every answer is bounded by ANSWER_ESTABLISH_MS, each offer is tried
    // once, and answers run side by side -- a dead offer never makes the
    // live joiner behind it wait. A connection that completes after this
    // call has returned is kept for the next one.
    async accept(options) {
      const opts = options || {};
      const timeoutMs = opts.timeoutMs || DEFAULT_JOIN_TIMEOUT_MS;
      const deadline = now() + timeoutMs;
      const onStatus = opts.onStatus || this.onStatus;
      const myInbox = await inboxKeyFor(this.scope, this.userId, this.secret);
      // `answerExtra(peer)` adds fields to the sealed answer (a star room's
      // owner hands out the seat there); `release(extra)` undoes it when the
      // connection then fails. `skip(peer)` passes over a peer already
      // connected, whose old offer may still sit in the inbox.
      const answerExtra = opts.answerExtra || (() => null);
      const release = opts.release || (() => {});
      const skip = opts.skip || (() => false);
      let failure = null;

      for (;;) {
        if (this._left) throw new Error('vlan: left the segment');
        if (this._admitted.length) return this._admitted.shift();
        if (failure) throw failure;
        if (now() >= deadline) throw new Error('vlan: nobody tried to connect');
        const known = await this.peers();
        for (const peer of known) {
          if (skip(peer)) continue;
          const key = await sharedKeyWith(this.identity, peer.publicKey);
          const offer = await this._readInbox(myInbox, peer, key, 'offer');
          if (!offer) continue;
          // The SDP names this one attempt (its ICE credentials are fresh
          // per offer), so a retry by the same peer is a new entry.
          const id = `${peer.userId}\n${offer.sdp}`;
          if (this._tried.has(id)) continue;
          this._tried.add(id);
          const extra = answerExtra(peer) || null;
          onStatus('answering');
          this._answer(peer, key, offer, extra).then(result => {
            if (this._left) { try { result.wire.close(); } catch (_) {} return; }
            this._admitted.push(result);
            this._wakeAccept();
          }, err => {
            try { release(extra); } catch (_) {}
            if (opts.keepGoing) onStatus('a connection failed');
            else failure = failure || err;
            this._wakeAccept();
          });
        }
        await new Promise(resolve => {
          const timer = setTimeout(resolve, Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - now())));
          this._acceptWake = () => { clearTimeout(timer); resolve(); };
        });
        this._acceptWake = null;
      }
    }

    _wakeAccept() {
      if (this._acceptWake) this._acceptWake();
    }

    // Answer one offer: resolves with { wire, pc, peer, extra } once the data
    // channel is open, or rejects within ANSWER_ESTABLISH_MS.
    async _answer(peer, key, offer, extra) {
      const giveUp = now() + (this.answerTimeoutMs || ANSWER_ESTABLISH_MS);
      const pc = new RTCPeerConnection({ iceServers: this.iceServers });
      const theirInbox = await inboxKeyFor(this.scope, peer.userId, this.secret);
      try {
        // The stream channel resolves the wait; the datagram channel comes
        // later and joins whatever wire the stream channel made.
        let wire = null;
        let lateDatagram = null;
        const incoming = new Promise(resolve => {
          pc.ondatachannel = ev => {
            if (ev.channel.label !== DATAGRAM_LABEL) { resolve(ev.channel); return; }
            if (wire) wire.attachDatagramChannel(ev.channel);
            else lateDatagram = ev.channel;
          };
        });
        await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        await this._post(theirInbox, Object.assign(
          { from: this.userId, publicKey: this.identity.publicKey },
          await sealed(key, Object.assign({}, extra,
            { role: 'answer', sdp: pc.localDescription.sdp, at: now() }))));

        // An author that is gone never opens a channel: without this bound
        // the wait below would never end.
        const channel = await Promise.race([incoming, sleep(Math.max(0, giveUp - now())).then(() => {
          throw Object.assign(new Error('the offering peer never connected'), { stale: true });
        })]);
        wire = new RtcWire(channel, pc);
        if (lateDatagram) wire.attachDatagramChannel(lateDatagram);
        await established(pc, channel, Math.max(1000, giveUp - now()));
        // Withdraw the answer we published into *their* inbox. The record
        // under our own inbox key belongs to the peer who sent the offer,
        // and only they can remove it.
        this._unpost(theirInbox);
        return { wire, pc, peer, extra };
      } catch (err) {
        try { pc.close(); } catch (_) {}
        this._unpost(theirInbox).catch(() => {});
        throw err;
      }
    }

    async leave() {
      this._left = true;
      for (const r of this._admitted.splice(0)) { try { r.wire.close(); } catch (_) {} }
      this._wakeAccept();
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
      if (this._onVisible && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._onVisible);
        this._onVisible = null;
      }
      const posted = Array.from(this._posted);
      this._posted.clear();
      await Promise.all([
        this.signaling.withdraw(this.presenceKey).catch(() => {}),
        // Anything still sitting in someone else's inbox is ours to clean up;
        // nobody else is able to.
        ...posted.map(key => this.signaling.withdraw(key).catch(() => {})),
      ]);
    }
  }

  // Join a segment: claim an address, announce presence, and return a handle
  // that can list peers and connect to them. Joining does not connect to
  // anyone — that is the whole point of separating the two.
  async function joinNetwork(options) {
    const opts = options || {};
    const signaling = opts.signaling || new SignalingClient(opts.apiBase || '');
    const scope = opts.scope || scopeFor(opts);
    const secret = opts.secret || null;
    const onStatus = opts.onStatus || (() => {});

    const me = await signaling.whoami();
    if (!me || !me.id) throw new Error('vlan: the signaling service did not identify us');

    const presenceKey = await signalKeyFor(scope, secret);
    const identity = await newIdentity();

    const net = new Network({
      signaling, scope, secret, presenceKey, identity,
      userId: me.id,
      name: opts.name || me.name || 'player',
      status: opts.status || 'available',
      role: opts.role || null,
      hosting: null,
      iceServers: opts.iceServers || DEFAULT_ICE,
      onStatus,
    });

    // A star room's seats are handed out by its owner (lib/vlan-room.js), so
    // a peer joining one claims nothing here: it is in the channel, seatless,
    // until the owner answers or it becomes the owner itself.
    if (opts.claimSeat === false) {
      net.address = null;
      await net._announce();
      net._startHeartbeat();
      return net;
    }

    // Claim the lowest free seat, then check again: two peers can choose at
    // the same moment and neither sees the other's claim yet. With seats that
    // is not a rare race — everyone opening an empty room wants seat 1 — so
    // this loops instead of re-picking once. Three people arriving together
    // produce two losers, and a single retry would hand both of them seat 2.
    const seen = await net.peers();
    net.address = opts.address || pickAddress(seen.map(p => p.address).filter(Boolean));
    await net._announce();

    for (let round = 0; !opts.address && round < 4; round++) {
      const after = await net.peers();
      const mine = { address: net.address, userId: net.userId };
      if (!after.some(p => claimLoses(mine, p))) break;
      onStatus(`seat ${net.address} taken, taking the next one`);
      net.address = pickAddress(after.map(p => p.address).filter(Boolean));
      await net._announce();
    }

    net._startHeartbeat();
    return net;
  }

  // Who is on a channel, without joining it: nothing is published, so looking
  // leaves no trace in anyone else's list. This is what lets the shell ask
  // "is anybody hosting this game?" when a person merely opens it.
  async function peekNetwork(options) {
    const opts = options || {};
    const signaling = opts.signaling || new SignalingClient(opts.apiBase || '');
    const scope = opts.scope || scopeFor(opts);
    // Presence records are public, so a signed-out page can still see who
    // is here; it just cannot publish or connect. `signedOut` says which.
    let me = null;
    try {
      me = await signaling.whoami();
    } catch (e) {
      if (!(e && e.needsLogin)) throw e;
    }
    if (me && !me.id) throw new Error('vlan: the signaling service did not identify us');
    const presenceKey = await signalKeyFor(scope, opts.secret || null);
    const net = new Network({ signaling, scope, presenceKey, userId: me ? me.id : null });
    return {
      userId: me ? me.id : null,
      name: me ? me.name || null : null,
      signedOut: !me,
      peers: await net.peers(),
    };
  }

  // Two peers, one segment, no UI: join, then take whichever role is
  // available — offer if someone is already here, otherwise wait to be
  // offered to. This is the shape the CLI gate and the tests want; a real
  // lobby calls joinNetwork and lets a person choose.
  async function joinRoom(options) {
    const opts = options || {};
    const net = await joinNetwork(opts);
    const timeoutMs = opts.timeoutMs || DEFAULT_JOIN_TIMEOUT_MS;
    try {
      const peers = await net.peers();
      const link = peers.length
        ? await net.connect(peers[0].userId, { timeoutMs })
        : await net.accept({ timeoutMs });
      return Object.assign({ network: net, scope: net.scope, address: net.address }, link);
    } catch (err) {
      await net.leave().catch(() => {});
      throw err;
    }
  }

  return {
    RtcWire, SignalingClient, Network,
    joinNetwork, joinRoom, peekNetwork,
    newRoomSecret, roomKeyFor, scopeFor, signalKeyFor, inboxKeyFor,
    seatAddress, pickAddress, formatAddress, claimLoses, MAX_SEATS,
    DEFAULT_ICE, DEFAULT_JOIN_TIMEOUT_MS, PRESENCE_TTL_MS, PRESENCE_REFRESH_MS,
    _internals: { sealed, opened, cryptoKeyFor, newIdentity, sharedKeyWith, b64url, unb64url },
  };
}));

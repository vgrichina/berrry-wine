// Pairing an AI agent to a running page: the token, the compact SDP, the
// sealed answer. docs/design-agent-connect.md, section 3.
//
// Pure functions, shared by the page (lib/agent-remote.js) and the agent's
// bridge (tools/wine-agent/, bundled into the skill's wine-agent.mjs), so the
// two ends cannot disagree about a byte of the format.
//
// The whole handshake is one paste and one record:
//
//   page  --wa1 token (in a URL fragment, pasted by the player)-->  bridge
//   page  <--sealed answer (berrry app data, written by the bot)--  bridge
//
// The page's offer rides INSIDE the token, which is why the page never writes
// to berrry and the player needs no account. A browser SDP is 1-3 KB, but a
// data-channel-only session needs only ice-ufrag, ice-pwd, the DTLS
// fingerprint and the candidates; the rest is boilerplate both ends can
// rebuild. So the token carries those fields in a binary layout and each end
// re-expands them into a standard SDP with minimalSdp().

(function (root, factory) {
  const nacl = (typeof require === 'function') ? require('./vendor/tweetnacl') : root.nacl;
  const mod = factory(nacl);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.AgentPair = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (nacl) {
  'use strict';

  const VERSION = 1;
  const PREFIX = 'wa1.';
  const TOKEN_TTL_S = 600;
  const RECORD_PREFIX = 'agentpair:';
  const SIG_CONTEXT = 'wa1-answer|';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function unb64url(text) {
    const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const unhex = text => new Uint8Array(String(text).match(/../g).map(h => parseInt(h, 16)));

  function randomBytes(n) {
    const out = new Uint8Array(n);
    crypto.getRandomValues(out);
    return out;
  }

  // ---- the parts of an SDP a data channel needs ---------------------------
  //
  // { ufrag, pwd, fingerprint: Uint8Array(32), candidates: [{kind, addr, port}] }
  //
  // kind is the address family plus the candidate type, because those are the
  // only two things a peer needs to try an address: 'host4', 'srflx4',
  // 'host6', 'srflx6', 'relay4', and 'mdns' — Chrome hides a host address
  // behind a random <uuid>.local name unless the page holds a media
  // permission, so an mDNS host candidate is the COMMON case in a browser,
  // not an edge case.

  const KIND = { host4: 1, srflx4: 2, mdns: 3, host6: 4, srflx6: 5, relay4: 6 };
  const KIND_NAME = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v, k]));
  const KIND_TYP = { host4: 'host', srflx4: 'srflx', mdns: 'host', host6: 'host', srflx6: 'srflx', relay4: 'relay' };

  function parseIPv4(addr) {
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(addr);
    if (!m) return null;
    const out = m.slice(1).map(Number);
    return out.every(n => n <= 255) ? new Uint8Array(out) : null;
  }

  function parseIPv6(addr) {
    if (!/^[0-9a-f:]+$/i.test(addr) || !addr.includes(':')) return null;
    const halves = addr.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
    const groups = [...head, ...Array(missing).fill('0'), ...tail];
    const out = new Uint8Array(16);
    groups.forEach((g, i) => { const v = parseInt(g, 16); out[i * 2] = v >> 8; out[i * 2 + 1] = v & 0xff; });
    return out;
  }

  function formatIPv6(bytes) {
    const groups = [];
    for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
    return groups.join(':');
  }

  function parseUuid(name) {
    const m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(name);
    return m ? unhex(m.slice(1).join('')) : null;
  }

  function formatUuid(bytes) {
    const h = hex(bytes);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
  }

  // `a=candidate:` lines out of any SDP. UDP only: a TCP candidate is never
  // what connects two peers that also have UDP, and dropping them keeps the
  // token short. Unknown shapes are skipped rather than rejected — a peer
  // with one usable candidate still connects.
  function parseCandidates(sdp) {
    const out = [];
    const seen = new Set();
    for (const line of String(sdp).split(/\r?\n/)) {
      const m = /^a=candidate:\S+ \d+ (\S+) \d+ (\S+) (\d+) typ (\S+)/i.exec(line);
      if (!m || m[1].toLowerCase() !== 'udp') continue;
      const [, , addr, portText, typ] = m;
      const port = Number(portText);
      let kind = null;
      if (typ === 'host' && /\.local$/i.test(addr) && parseUuid(addr)) kind = 'mdns';
      else if (parseIPv4(addr)) kind = typ === 'host' ? 'host4' : typ === 'srflx' ? 'srflx4' : typ === 'relay' ? 'relay4' : null;
      else if (parseIPv6(addr)) kind = typ === 'host' ? 'host6' : typ === 'srflx' ? 'srflx6' : null;
      if (!kind) continue;
      const key = `${kind}|${addr}|${port}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, addr, port });
    }
    return out;
  }

  // The session parts of an SDP: the ICE credentials and the DTLS fingerprint
  // (SHA-256 only — every browser and werift offer it).
  function parseSdp(sdp) {
    const text = String(sdp);
    const pick = re => { const m = re.exec(text); return m ? m[1].trim() : null; };
    const ufrag = pick(/^a=ice-ufrag:(.+)$/m);
    const pwd = pick(/^a=ice-pwd:(.+)$/m);
    const fp = pick(/^a=fingerprint:sha-256 ([0-9A-Fa-f:]+)$/m);
    if (!ufrag || !pwd || !fp) throw new Error('SDP lacks ice-ufrag, ice-pwd or a sha-256 fingerprint');
    return { ufrag, pwd, fingerprint: unhex(fp.replace(/:/g, '')), candidates: parseCandidates(text) };
  }

  // A standard data-channel SDP from the parts. `role` is 'offer' or
  // 'answer', which only decides a=setup: the offerer says actpass as every
  // browser does, and the answerer takes the DTLS client side.
  function minimalSdp(parts, role) {
    const fp = hex(parts.fingerprint).toUpperCase().match(/../g).join(':');
    const lines = [
      'v=0',
      `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      `a=ice-ufrag:${parts.ufrag}`,
      `a=ice-pwd:${parts.pwd}`,
      'a=ice-options:trickle',
      `a=fingerprint:sha-256 ${fp}`,
      `a=setup:${role === 'offer' ? 'actpass' : 'active'}`,
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144',
    ];
    // Priorities follow RFC 8445's type preferences (host > srflx > relay) so
    // the pair a peer tries first is the cheapest one.
    parts.candidates.forEach((c, i) => {
      const typ = KIND_TYP[c.kind];
      const typePref = typ === 'host' ? 126 : typ === 'srflx' ? 100 : 0;
      const priority = (typePref << 24) + ((65535 - i) << 8) + 255;
      const raddr = typ === 'host' ? '' : ' raddr 0.0.0.0 rport 0';
      lines.push(`a=candidate:${i + 1} 1 udp ${priority} ${c.addr} ${c.port} typ ${typ}${raddr}`);
    });
    lines.push('a=end-of-candidates');
    return lines.join('\r\n') + '\r\n';
  }

  // ---- binary packing of the parts -----------------------------------------

  class Writer {
    constructor() { this.bytes = []; }
    u8(v) { this.bytes.push(v & 0xff); }
    u16(v) { this.u8(v >> 8); this.u8(v); }
    u32(v) { this.u16(v >>> 16); this.u16(v & 0xffff); }
    raw(b) { for (const x of b) this.u8(x); }
    str(s) { const b = enc.encode(s); if (b.length > 255) throw new Error('field too long'); this.u8(b.length); this.raw(b); }
    done() { return new Uint8Array(this.bytes); }
  }

  class Reader {
    constructor(b) { this.b = b; this.i = 0; }
    need(n) { if (this.i + n > this.b.length) throw new Error('token is truncated'); }
    u8() { this.need(1); return this.b[this.i++]; }
    u16() { return (this.u8() << 8) | this.u8(); }
    u32() { return ((this.u16() << 16) >>> 0) + this.u16(); }
    raw(n) { this.need(n); const out = this.b.slice(this.i, this.i + n); this.i += n; return out; }
    str() { return dec.decode(this.raw(this.u8())); }
  }

  // What goes into the token. A laptop routinely advertises one IPv4 host
  // address and five or more IPv6 ones (temporary privacy addresses), which
  // measured 302 characters of token for no extra reach: any one working
  // address of a family is as good as five. So keep every IPv4/mDNS/relay
  // candidate, at most two IPv6, at most eight in all, IPv4 first.
  const KIND_ORDER = { host4: 0, mdns: 1, srflx4: 2, relay4: 3, host6: 4, srflx6: 5 };
  function pickCandidates(candidates) {
    let v6 = 0;
    return candidates
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (KIND_ORDER[a.c.kind] - KIND_ORDER[b.c.kind]) || (a.i - b.i))
      .map(x => x.c)
      .filter(c => !c.kind.endsWith('6') || ++v6 <= 2)
      .slice(0, 8);
  }

  function writeParts(w, parts) {
    w.str(parts.ufrag);
    w.str(parts.pwd);
    if (parts.fingerprint.length !== 32) throw new Error('fingerprint must be sha-256');
    w.raw(parts.fingerprint);
    const cands = pickCandidates(parts.candidates);
    w.u8(cands.length);
    for (const c of cands) {
      w.u8(KIND[c.kind]);
      if (c.kind === 'mdns') w.raw(parseUuid(c.addr));
      else if (c.kind.endsWith('6')) w.raw(parseIPv6(c.addr));
      else w.raw(parseIPv4(c.addr));
      w.u16(c.port);
    }
  }

  function readParts(r) {
    const ufrag = r.str();
    const pwd = r.str();
    const fingerprint = r.raw(32);
    const n = r.u8();
    const candidates = [];
    for (let i = 0; i < n; i++) {
      const kind = KIND_NAME[r.u8()];
      if (!kind) throw new Error('token has an unknown candidate kind');
      let addr;
      if (kind === 'mdns') addr = formatUuid(r.raw(16));
      else if (kind.endsWith('6')) addr = formatIPv6(r.raw(16));
      else addr = Array.from(r.raw(4)).join('.');
      candidates.push({ kind, addr, port: r.u16() });
    }
    return { ufrag, pwd, fingerprint, candidates };
  }

  // ---- the token ------------------------------------------------------------
  //
  // wa1.<base64url: ver | mailbox id 16 | key 32 | expires u32 (unix s) | offer parts>

  function makeToken(offerSdp, opts) {
    const o = opts || {};
    const id = o.id || randomBytes(16);
    const key = o.key || randomBytes(32);
    const expires = o.expires || Math.floor(Date.now() / 1000) + TOKEN_TTL_S;
    const w = new Writer();
    w.u8(VERSION);
    w.raw(id);
    w.raw(key);
    w.u32(expires);
    writeParts(w, parseSdp(offerSdp));
    return { token: PREFIX + b64url(w.done()), id, key, expires };
  }

  // Accepts the bare token, or anything that contains one — the pasted
  // sentence, the full link with the token in its #fragment.
  function extractToken(text) {
    const m = /wa1\.[A-Za-z0-9_-]{40,}/.exec(String(text || ''));
    return m ? m[0] : null;
  }

  function readToken(text) {
    const token = extractToken(text);
    if (!token) throw new Error('no wa1. token found');
    const r = new Reader(unb64url(token.slice(PREFIX.length)));
    const ver = r.u8();
    if (ver !== VERSION) throw new Error(`token version ${ver} is not supported (need ${VERSION})`);
    const id = r.raw(16);
    const key = r.raw(32);
    const expires = r.u32();
    const offer = readParts(r);
    return { token, id, key, expires, offer, recordKey: recordKey(id) };
  }

  const recordKey = id => RECORD_PREFIX + hex(id);

  // ---- the answer record ----------------------------------------------------

  function sigMessage(id, answerFingerprint) {
    return enc.encode(SIG_CONTEXT + hex(id) + '|' + hex(answerFingerprint));
  }

  // bot = { username, runsAs, secretKey: Uint8Array(64) } (an ed25519 key).
  function sealAnswer(pairing, answerSdp, bot) {
    const parts = parseSdp(answerSdp);
    const w = new Writer();
    writeParts(w, parts);
    const signPub = bot.secretKey.slice(32);
    const payload = {
      answer: b64url(w.done()),
      bot: { username: String(bot.username || ''), runsAs: String(bot.runsAs || ''), pub: hex(signPub) },
      sig: b64url(nacl.sign.detached(sigMessage(pairing.id, parts.fingerprint), bot.secretKey)),
    };
    const iv = randomBytes(nacl.secretbox.nonceLength);
    const ct = nacl.secretbox(enc.encode(JSON.stringify(payload)), iv, pairing.key);
    return { v: VERSION, iv: b64url(iv), ct: b64url(ct) };
  }

  // null for anything that is not a valid answer for THIS pairing: wrong key,
  // tampered, bad signature. Callers treat every such record as absent.
  function openAnswer(pairing, record) {
    try {
      if (!record || record.v !== VERSION || !record.iv || !record.ct) return null;
      const plain = nacl.secretbox.open(unb64url(record.ct), unb64url(record.iv), pairing.key);
      if (!plain) return null;
      const payload = JSON.parse(dec.decode(plain));
      const parts = readParts(new Reader(unb64url(payload.answer)));
      const pub = unhex(payload.bot.pub);
      if (pub.length !== 32) return null;
      const ok = nacl.sign.detached.verify(sigMessage(pairing.id, parts.fingerprint),
        unb64url(payload.sig), pub);
      if (!ok) return null;
      return {
        sdp: minimalSdp(parts, 'answer'),
        bot: {
          username: String(payload.bot.username).slice(0, 64),
          runsAs: String(payload.bot.runsAs || '').slice(0, 64),
          pub: payload.bot.pub,
          // What the consent dialog shows: short enough to read aloud,
          // long enough that a lookalike key is not cheap to grind.
          keyLabel: payload.bot.pub.slice(0, 12).match(/..../g).join('·'),
        },
      };
    } catch (_) {
      return null;
    }
  }

  // ---- data-channel framing -------------------------------------------------
  //
  // A PNG data URL is far larger than one SCTP message should be, so a reply
  // longer than CHUNK goes out as {id, chunk, of, data} pieces and is
  // reassembled by id on the other side.

  const CHUNK = 16 * 1024;

  function frames(message) {
    const text = JSON.stringify(message);
    if (text.length <= CHUNK) return [text];
    const of = Math.ceil(text.length / CHUNK);
    const out = [];
    const id = (message && message.id != null) ? message.id : `m${Date.now()}`;
    for (let i = 0; i < of; i++) {
      out.push(JSON.stringify({ id, chunk: i, of, data: text.slice(i * CHUNK, (i + 1) * CHUNK) }));
    }
    return out;
  }

  function assembler(onMessage) {
    const pending = new Map();
    return function receive(text) {
      const msg = JSON.parse(text);
      if (msg && typeof msg.chunk === 'number' && typeof msg.of === 'number') {
        const parts = pending.get(msg.id) || [];
        parts[msg.chunk] = msg.data;
        pending.set(msg.id, parts);
        if (parts.filter(p => p !== undefined).length < msg.of) return;
        pending.delete(msg.id);
        onMessage(JSON.parse(parts.join('')));
        return;
      }
      onMessage(msg);
    };
  }

  return {
    VERSION, PREFIX, TOKEN_TTL_S, CHUNK,
    b64url, unb64url, hex, unhex,
    parseSdp, parseCandidates, minimalSdp,
    makeToken, readToken, extractToken, recordKey,
    sealAnswer, openAnswer,
    frames, assembler,
  };
}));

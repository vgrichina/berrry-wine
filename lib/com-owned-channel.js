'use strict';

// Authority-side COM object identities and byte requests. No guest address,
// CPU, memory object, or callback is accepted here. Guest continuations are
// serviced separately by the authenticated exporter that owns each ticket.
const { randomBytes } = require('node:crypto');
const {OwnedComActivation}=require('./com-owned-activation');
const MAX_BYTES = 1024 * 1024;
const MAX_QUEUE = 256;
const MAX_EXPORTS = 4096;
const guid = /^[0-9a-f]{32}$/;
const pin = /^[0-9a-f]{64}$/;
const id = n => {for(let attempt=0;attempt<8;attempt++){const value=randomBytes(n).toString('hex');if(!/^0+$/.test(value))return value;}throw new Error('COM identity entropy failure');};
const fail = code => { throw Object.assign(new Error(code), { code }); };
const requireGuid = value => {
  if (typeof value !== 'string' || !guid.test(value) || /^0+$/.test(value)) fail('EINVAL');
  return value;
};
const bytes = value => {
  if (!(value instanceof Uint8Array) || value.byteLength > MAX_BYTES) fail('EINVAL');
  return Uint8Array.from(value);
};
const ownerKey = owner => {
  if (!owner || !Number.isSafeInteger(owner.thread) || owner.thread < 1 || owner.thread > 16 ||
      typeof owner.generation !== 'string' || owner.generation.length > 20 || !/^[1-9][0-9]*$/.test(owner.generation) ||
      BigInt(owner.generation) > 0xffffffffffffffffn ||
      !pin.test(owner.source || '') || !pin.test(owner.module || '')) fail('EINVAL');
  return [owner.thread, owner.generation, owner.source, owner.module].join(':');
};

class OwnedComAuthority {
  constructor() {
    this.sessions = new Map();this.exports = new Map();this.requests = new Map();
    this.activation=new OwnedComActivation(this);
  }
  connect(identity) {
    // identity is assigned by the authenticated transport, never taken from
    // an object reference supplied by a caller.
    if (typeof identity !== 'string' || !identity || this.sessions.has(identity)) fail('EAUTH');
    const session = { identity, oxid: id(8), owners: new Map(), lastGeneration: new Map(), queue: [], live: true };
    this.sessions.set(identity, session);return session;
  }
  check(session) {
    if (!session?.live || this.sessions.get(session.identity) !== session) fail('ECLOSED');
  }
  registerOwner(session, descriptor) {
    this.check(session);const key = ownerKey(descriptor);
    if (session.owners.has(descriptor.thread)) fail('EALREADY');
    if (BigInt(descriptor.generation) <= (session.lastGeneration.get(descriptor.thread) || 0n)) fail('ESTALE');
    const owner = Object.freeze({ ...descriptor, key });
    session.owners.set(owner.thread, owner);session.lastGeneration.set(owner.thread, BigInt(owner.generation));return owner;
  }
  owner(session, descriptor) {
    this.check(session);const current = session.owners.get(descriptor?.thread);
    if (!current || ownerKey(descriptor) !== current.key) fail('ESTALE');
    return current;
  }
  prepareExport(session, descriptor, iid, mode, objectIdentity) {
    const owner = this.owner(session, descriptor);requireGuid(iid);
    // Weak-table lifetimes require a separate owner-side liveness service.
    if (mode !== 0 && mode !== 1) fail('ENOTSUP');
    if (typeof objectIdentity !== 'string' || !guid.test(objectIdentity)) fail('EINVAL');
    if (this.exports.size >= MAX_EXPORTS) fail('ENOSPC');
    let oid;
    for (const entry of this.exports.values()) {
      if (entry.session === session && entry.owner === owner && entry.objectIdentity === objectIdentity) {
        oid = entry.oid;break;
      }
    }
    const entry = { session, owner, iid, mode, objectIdentity, oxid: session.oxid,
      oid: oid || id(8), ipid: id(16), packet: true, committed: false,
      proxies: new Map(), calls: 0, retiring: false };
    this.exports.set(entry.ipid, entry);
    return this.reference(entry);
  }
  reference(entry) {
    return Object.freeze({ oxid: entry.oxid, oid: entry.oid, ipid: entry.ipid,
      iid: entry.iid, publicRefs: entry.mode === 0 ? 1 : 0 });
  }
  lookup(reference, committed = true) {
    if (!reference || !/^[0-9a-f]{16}$/.test(reference.oxid || '') ||
        !/^[0-9a-f]{16}$/.test(reference.oid || '')) fail('EINVAL');
    requireGuid(reference.ipid);requireGuid(reference.iid);
    const entry = this.exports.get(reference.ipid);
    if (!entry || entry.retiring || (committed && !entry.committed) ||
        entry.oxid !== reference.oxid || entry.oid !== reference.oid ||
        entry.iid !== reference.iid || reference.publicRefs !== (entry.mode === 0 ? 1 : 0)) fail('EDISCONNECTED');
    this.owner(entry.session, entry.owner);return entry;
  }
  commitExport(session, descriptor, reference) {
    const owner = this.owner(session, descriptor), entry = this.lookup(reference, false);
    if (entry.session !== session || entry.owner !== owner || entry.committed) fail('ESTALE');
    entry.committed = true;
  }
  abandonExport(session, descriptor, reference) {
    const owner = this.owner(session, descriptor), entry = this.lookup(reference, false);
    if (entry.session !== session || entry.owner !== owner || entry.committed) fail('ESTALE');
    this.exports.delete(entry.ipid);
    // The owner still owns its unpublished IUnknown/stub references and must
    // release them on its continuation. No packet was exposed to a client.
  }
  consume(session, descriptor, reference) {
    const owner = this.owner(session, descriptor), entry = this.lookup(reference);
    if (!entry.packet) fail('EDISCONNECTED');
    const token = id(16);
    entry.proxies.set(token, { session, owner });
    if (entry.mode === 0) entry.packet = false;
    return Object.freeze({ token, reference: this.reference(entry) });
  }
  proxy(session, descriptor, reference, token) {
    const owner = this.owner(session, descriptor), entry = this.lookup(reference);
    const lease = entry.proxies.get(token);
    if (!lease || lease.session !== session || lease.owner !== owner) fail('ESTALE');
    return entry;
  }
  releaseProxy(session, descriptor, reference, token) {
    const entry = this.proxy(session, descriptor, reference, token);
    entry.proxies.delete(token);this.maybeRetire(entry);
  }
  releaseData(session, descriptor, reference) {
    const owner = this.owner(session, descriptor), entry = this.lookup(reference);
    // CoReleaseMarshalData belongs to the apartment that produced the packet.
    if (entry.session !== session || entry.owner !== owner || !entry.packet) fail('ESTALE');
    entry.packet = false;this.maybeRetire(entry);
  }
  submit(session, descriptor, reference, token, request) {
    const entry = this.proxy(session, descriptor, reference, token);
    if (!request || !Number.isInteger(request.method) || request.method < 3 || request.method > 65535 ||
        !Number.isInteger(request.representation) || request.representation < 0 || request.representation > 0xffffffff ||
        !Number.isInteger(request.flags) || request.flags < 0 || request.flags > 0xffffffff) fail('EINVAL');
    if (entry.session.queue.length >= MAX_QUEUE || this.requests.size >= MAX_EXPORTS) fail('ENOSPC');
    const payload = bytes(request.bytes), ticket = id(16);
    const row = { ticket, entry, caller: session, callerOwner: session.owners.get(descriptor.thread),
      method: request.method, representation: request.representation, flags: request.flags,
      bytes: payload, state: 'queued' };
    this.requests.set(ticket, row);entry.calls++;entry.session.queue.push(row);
    return ticket;
  }
  take(session, descriptor) {
    const owner = this.owner(session, descriptor);
    const at = session.queue.findIndex(row => row.entry.owner === owner && row.state === 'queued');
    if (at < 0) return null;
    const row = session.queue.splice(at, 1)[0];row.state = 'executing';
    return Object.freeze({ ticket: row.ticket, kind: row.kind || 'invoke',
      reference: this.reference(row.entry), method: row.method,
      representation: row.representation, flags: row.flags,
      bytes: row.bytes ? Uint8Array.from(row.bytes) : new Uint8Array() });
  }
  complete(session, descriptor, ticket, response) {
    const owner = this.owner(session, descriptor), row = this.requests.get(ticket);
    if (!row || row.state !== 'executing' || row.entry.session !== session || row.entry.owner !== owner) fail('ESTALE');
    if (row.kind === 'retire') {
      this.requests.delete(ticket);this.exports.delete(row.entry.ipid);return;
    }
    if (!response || !Number.isInteger(response.hresult) || response.hresult < 0 || response.hresult > 0xffffffff ||
        !Number.isInteger(response.status) || response.status < 0 || response.status > 0xffffffff) fail('EINVAL');
    const reply = bytes(response.bytes);
    // Revalidate both sides after the actual guest callback, including a call
    // that suspended. Replacement never publishes a result to an old caller.
    let callerLive = true;
    try { this.owner(row.caller, row.callerOwner); } catch (_) { callerLive = false; }
    row.entry.calls--;row.state = 'completed';row.bytes = null;
    if (callerLive) row.response = Object.freeze({ hresult: response.hresult,
      status: response.status, bytes: reply });
    else this.requests.delete(ticket);
    this.maybeRetire(row.entry);
  }
  poll(session, descriptor, ticket) {
    const owner = this.owner(session, descriptor), row = this.requests.get(ticket);
    if (!row || row.caller !== session || row.callerOwner !== owner) fail('ESTALE');
    if (row.state !== 'completed') return null;
    this.requests.delete(ticket);
    if (row.error) fail(row.error);
    return { ...row.response, bytes: Uint8Array.from(row.response.bytes) };
  }
  maybeRetire(entry) {
    if (entry.packet || entry.proxies.size || entry.calls || entry.retiring) return;
    // The exporter must execute actual stub Disconnect/Release and canonical
    // IUnknown Release before acknowledging this retirement ticket.
    entry.retiring = true;
    const row = { ticket: id(16), kind: 'retire', entry, state: 'queued' };
    this.requests.set(row.ticket, row);entry.session.queue.push(row);
  }
  retireOwner(session, descriptor) {
    const owner = this.owner(session, descriptor);session.owners.delete(owner.thread);
    this.activation.retireOwner(session,owner);
    for (const row of [...this.requests.values()]) {
      if (row.entry.session === session && row.entry.owner === owner) {
        if (row.caller?.live && row.caller.owners.get(row.callerOwner.thread) === row.callerOwner) {
          row.state = 'completed';row.error = 'EDISCONNECTED';row.bytes = null;
        } else this.requests.delete(row.ticket);
      } else if (row.caller === session && row.callerOwner === owner && row.state !== 'executing') {
        this.requests.delete(row.ticket);
        if(row.state === 'queued') {
          row.entry.calls--;row.entry.session.queue=row.entry.session.queue.filter(x=>x!==row);
        }
        row.state = 'cancelled';this.maybeRetire(row.entry);
      }
    }
    session.queue = session.queue.filter(row => row.entry.owner !== owner);
    for (const [ipid, entry] of this.exports) {
      if (entry.session === session && entry.owner === owner) this.exports.delete(ipid);
      else {
        for (const [token, lease] of entry.proxies)
          if (lease.session === session && lease.owner === owner) entry.proxies.delete(token);
        this.maybeRetire(entry);
      }
    }
  }
  disconnect(session) {
    this.check(session);
    for (const owner of [...session.owners.values()]) this.retireOwner(session, owner);
    session.live = false;session.queue.length = 0;this.sessions.delete(session.identity);
  }
}

module.exports = { OwnedComAuthority, MAX_BYTES };

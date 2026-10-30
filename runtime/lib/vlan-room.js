// One game, one room, no dialog — docs/virtual-lan-party.md
//
// Opening a game's LAN is automatic: the first person on a game's channel
// OWNS the room (seat 10.0.0.1) and everyone after them JOINS it, over one
// link each (lib/vlan-star.js). Nobody picks anybody. The game's own server
// browser does the finding, exactly as it did on a 1998 LAN, because every
// machine in the room is on the same segment.
//
//   openRoom()
//     join the channel with no seat
//     somebody owns a room here?  -> offer to them; their answer carries our seat
//     nobody?                     -> take seat 1, own the room, answer everyone
//
// Two people opening an empty channel at the same moment both become owners.
// The one with the higher user id steps down while it still has nobody in its
// room -- the same no-clock rule the lobby uses for glare.
//
// The owner leaving ends the room: members hear 'closed' and the next person
// to go online starts a new one. There is no hand-over, on purpose -- a game
// server is usually the owner, and when it goes the game is over anyway.

(function (root, factory) {
  const req = typeof require === 'function';
  const mod = factory(req ? require('./vlan-rtc') : root.VlanRtc,
    req ? require('./vlan-star') : root.VlanStar);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.VlanRoom = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (VlanRtc, VlanStar) {
  'use strict';

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // The owner to join, when there is more than one to choose from: the one
  // the person picked on the Join card, else one that is actually serving a
  // game, else the freshest heartbeat -- a record left by a closed tab keeps
  // its last timestamp while a live owner keeps renewing.
  function chooseOwner(peers, preferUserId) {
    const owners = (peers || []).filter(p => p.role === 'owner' && p.address);
    if (!owners.length) return null;
    const picked = preferUserId && owners.find(p => p.userId === preferUserId);
    if (picked) return picked;
    return owners.slice().sort((a, b) =>
      (b.hosting ? 1 : 0) - (a.hosting ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  }

  class Room {
    constructor(net, wire, role, options) {
      this.net = net;
      this.wire = wire;
      this.role = role;
      this.address = wire.address;
      this.opts = options || {};
      this.owner = null;             // the owner's presence record, for a member
      this.members = new Map();      // userId -> { seat, peer, link }, for the owner
      this.pending = new Map();      // seat -> userId, handed out, not yet connected
      this.closed = false;
      this.probe = null;
    }

    // Whose room this is, which is what an invite link names.
    get ownerUserId() {
      return this.role === 'owner' ? this.net.userId : (this.owner && this.owner.userId) || null;
    }

    _emit(type, detail) {
      if (typeof this.opts.onEvent !== 'function') return;
      try { this.opts.onEvent(type, Object.assign({ room: this }, detail)); } catch (_) {}
    }

    get memberCount() { return this.role === 'owner' ? this.members.size : 1; }

    // ---- owner --------------------------------------------------------

    _reserve(peer) {
      const taken = [this.address]
        .concat(Array.from(this.members.values(), m => m.seat))
        .concat(Array.from(this.pending.keys()));
      const seat = VlanStar.nextMemberSeat(taken);
      this.pending.set(seat, peer.userId);
      return { seat };
    }

    _admit(result) {
      const seat = result.extra && result.extra.seat;
      if (seat) this.pending.delete(seat);
      if (this.closed) { try { result.wire.close(); } catch (_) {} return; }
      const peer = result.peer;
      this.members.set(peer.userId, { seat, peer, link: result.wire });
      this.wire.addLink(seat, result.wire);
      result.wire.onClosed = why => this._drop(peer.userId, why);
      this._emit('joined', { name: peer.name, address: seat, count: this.members.size });
    }

    _drop(userId, why) {
      const m = this.members.get(userId);
      if (!m) return;
      this.members.delete(userId);
      this.wire.removeLink(m.seat);
      if (!this.closed) {
        this._emit('left', { name: m.peer.name, address: m.seat, count: this.members.size, quit: saidGoodbye(why) });
      }
    }

    // Answer everyone who offers, for as long as the room is open. accept()
    // gives up after its timeout with nobody there, which here only means
    // "keep waiting".
    async _serve() {
      while (!this.closed) {
        try {
          const result = await this.net.accept({
            timeoutMs: 60000,
            keepGoing: true,
            skip: peer => this.members.has(peer.userId),
            answerExtra: peer => this._reserve(peer),
            release: extra => { if (extra && extra.seat) this.pending.delete(extra.seat); },
          });
          this._admit(result);
        } catch (_) {
          if (this.closed) break;
          await sleep(1000);
        }
      }
    }

    // ---- both ---------------------------------------------------------

    // Watch whether this machine's game is serving (lib/vlan-star.js) and
    // publish it, so a person opening the game elsewhere is offered this one.
    startProbe(spec, everyMs) {
      if (!spec || this.probe || this.closed) return;
      this.probe = new VlanStar.HostProbe(this.wire, spec, hosting => {
        this.net.setHosting(hosting).catch(() => {});
        this._emit('hosting', { hosting });
      });
      this.probe.start(everyMs);
    }

    _ended(message, quit) {
      if (this.closed) return;
      this.closed = true;
      if (this.probe) this.probe.stop();
      this._emit('closed', { message, quit: !!quit });
      this.net.leave().catch(() => {});
    }

    async close() {
      if (this.closed) return;
      this.closed = true;
      if (this.probe) this.probe.stop();
      try { this.wire.close(); } catch (_) {}
      await this.net.leave().catch(() => {});
    }
  }

  // Quitting and dropping out look the same to the game -- the frames stop
  // -- but not to the people: a peer that quits closes its channel, and the
  // far end hears that close ('channel-closed'), while a dead Wi-Fi, a phone
  // put to sleep or a crashed browser says nothing and is only noticed when
  // the connection itself gives up ('disconnected' past its grace, 'failed').
  function saidGoodbye(why) {
    return why === 'channel-closed';
  }

  async function joinAsMember(net, owner, opts) {
    const onStatus = opts.onStatus || (() => {});
    onStatus(`joining ${owner.name}…`);
    const link = await net.connect(owner.userId, { timeoutMs: opts.connectTimeoutMs || 20000 });
    const seat = link.answer && link.answer.seat;
    if (!seat) {
      try { link.wire.close(); } catch (_) {}
      throw new Error('vlan: the room owner handed out no seat');
    }
    await net.setRole('member', seat);
    const room = new Room(net, new VlanStar.StarMemberWire(link.wire, seat), 'member', opts);
    room.owner = owner;
    link.wire.onClosed = why => {
      // Every other seat was reached through the owner, so all of them are
      // gone at once.
      room.wire.peerGone(0xFFFFFFFF);
      const quit = saidGoodbye(why);
      room._ended(quit ? `${owner.name} closed the room` : `Lost the connection to ${owner.name}`, quit);
    };
    return room;
  }

  async function startAsOwner(net, opts) {
    await net.setRole('owner', VlanStar.OWNER_ADDRESS);
    // Long enough for a rival's claim to be visible to us and ours to them.
    await sleep(opts.settleMs == null ? 1200 : opts.settleMs);
    const rival = !opts.alone && (await net.peers()).find(p => p.role === 'owner' && p.address && p.userId < net.userId);
    if (rival) {
      await net.setRole(null, null);
      try {
        return await joinAsMember(net, rival, opts);
      } catch (_) {
        await net.setRole('owner', VlanStar.OWNER_ADDRESS);
      }
    }
    const room = new Room(net, new VlanStar.StarOwnerWire(), 'owner', opts);
    room._serve();
    return room;
  }

  function joinFailed(message, owner, cause) {
    const err = new Error(message);
    err.joinFailed = true;
    err.owner = owner;
    err.cause = cause;
    return err;
  }

  // Resolve to a Room: `room.wire` goes to wine.joinVlan(wire, room.address).
  //
  //   options.join            joinNetwork options (exe, name, apiBase, signaling)
  //   options.preferOwner     userId from a Join card, when the person chose
  //   options.mustJoin        with preferOwner: join that owner or reject with
  //                           err.joinFailed, never fall back to hosting
  //   options.ownRoom         open a room of our own even though others exist
  //   options.onEvent(type, detail)
  //       joined {name, address, count}   owner: someone arrived
  //       left   {name, address, count}   owner: someone went
  //       closed {message}                member: the owner went, room over
  //       hosting {hosting}               the probe changed its mind
  //   options.onStatus(text)  progress, for whoever is waiting on this
  async function openRoom(options) {
    const opts = options || {};
    const rtc = opts.rtc || VlanRtc;
    const net = await rtc.joinNetwork(Object.assign({}, opts.join,
      { claimSeat: false, onStatus: opts.onStatus }));
    try {
      // "Start my own room" on the server list: a second server beside the
      // ones already listed, so neither joining one nor the step-down that
      // settles two claims made at the same moment applies.
      if (opts.ownRoom) return await startAsOwner(net, Object.assign({}, opts, { settleMs: 0, alone: true }));
      const peers = await net.peers();
      // A person who asked for one particular room (a room link, a Join
      // button) asked to play *there*: hosting instead would put them in a
      // game of their own under a message about someone else's. So that
      // owner is joined or the whole call fails, and the caller says why.
      if (opts.mustJoin && opts.preferOwner) {
        const wanted = peers.find(p => p.userId === opts.preferOwner && p.role === 'owner' && p.address);
        if (!wanted) throw joinFailed('the room is not open any more', null);
        try {
          return await joinAsMember(net, wanted, opts);
        } catch (err) {
          throw joinFailed(`${wanted.name} did not answer`, wanted, err);
        }
      }
      const owner = chooseOwner(peers, opts.preferOwner);
      if (owner) {
        try {
          return await joinAsMember(net, owner, opts);
        } catch (err) {
          // An owner that does not answer is most likely a closed tab whose
          // record has not aged out yet. Better a room of our own than none.
          if (opts.onStatus) opts.onStatus(`${owner.name} did not answer (${err && err.message}); opening a room`);
          await net.setRole(null, null).catch(() => {});
        }
      }
      return await startAsOwner(net, opts);
    } catch (err) {
      await net.leave().catch(() => {});
      throw err;
    }
  }

  // The rooms worth offering someone who is about to launch the game: owners
  // whose game is serving. A room nobody serves in is joined silently the
  // moment the game goes online, so it needs no card.
  //
  // options.includeIdle also returns owners whose game is not serving yet,
  // which an invite link needs: the friend who sent it may still be at the
  // game's menus.
  async function hostedRooms(options) {
    const opts = options || {};
    const rtc = opts.rtc || VlanRtc;
    const seen = await rtc.peekNetwork(opts.join || {});
    const rooms = seen.peers.filter(p => p.role === 'owner' && p.address && (p.hosting || opts.includeIdle));
    // Read from public records, so a signed-out page sees the rooms too;
    // this says it could not join one without signing in first.
    // Not enumerable: the result is still just the list of rooms.
    Object.defineProperty(rooms, 'signedOut', { value: !!seen.signedOut });
    // Whose page is looking. The list never contains this account's own
    // room, so a room link naming it needs this to say why it is absent.
    Object.defineProperty(rooms, 'userId', { value: seen.userId == null ? null : String(seen.userId) });
    return rooms;
  }

  return { openRoom, hostedRooms, chooseOwner, Room };
}));

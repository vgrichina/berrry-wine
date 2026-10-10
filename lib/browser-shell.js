// The process lifecycle of the browser host: what it means to launch an app,
// what it means to stop one, and the handful of policies that only exist
// because several guests share one page — one renderer, one canvas, disjoint
// hwnd ranges, and a tab-local LAN segment for two copies of a networked game.
//
// launchApp() is the whole boot in one place: seed the registry/INI values the
// app expects to find, ask the LAN lobby who else is out there (before init(),
// because host imports capture the wire at instantiate time), retire an older
// copy of the same app, stage the PE, mount its data files, walk its DLL
// graph, then start the run loop and arm the startup-dialog dismissal.
//
// This was ~330 lines inside index.html. None of it is markup, all of it
// decides how a guest starts, and it is the code most likely to explain "it
// works headless but not in the browser" — so it now has a file of its own.
//
// The page keeps what is genuinely page: the toolbar, the desktop icons, the
// canvas sizing policy, the debug MIDI player.

(function () {
  function crashReportText(details = {}) {
    const error = details.error || {};
    const message = error && error.message ? error.message : String(error || 'Unknown fatal error');
    const lines = [
      'Wine-Assembly crash report',
      `kind: ${details.kind || 'fatal'}`,
      `app: ${details.app || '(unknown)'}`,
      `time: ${new Date().toISOString()}`,
    ];
    if (typeof location !== 'undefined') lines.push(`url: ${location.href}`);
    if (typeof navigator !== 'undefined') lines.push(`user-agent: ${navigator.userAgent}`);
    if (typeof WineAssembly !== 'undefined' && WineAssembly.SOURCE_VERSION != null) {
      lines.push(`source-version: ${WineAssembly.SOURCE_VERSION}`);
    }
    if (typeof isSecureContext !== 'undefined') lines.push(`secure-context: ${!!isSecureContext}`);
    if (typeof crossOriginIsolated !== 'undefined') lines.push(`cross-origin-isolated: ${!!crossOriginIsolated}`);
    if (typeof SharedArrayBuffer !== 'undefined') lines.push('shared-array-buffer: available');
    else lines.push('shared-array-buffer: unavailable');
    lines.push('', `${error.name || 'Error'}: ${message}`);
    if (error.stage) lines.push(`compiler-stage: ${error.stage}`);
    if (error.line || error.col) lines.push(`source-location: ${error.line || 0}:${error.col || 0}`);
    if (details.state) lines.push(`guest-state: ${details.state}`);
    if (details.tag) lines.push(`detail: ${details.tag}`);
    if (error.stack) lines.push('', 'stack:', String(error.stack));
    if (Array.isArray(error.logs) && error.logs.length) {
      lines.push('', 'compiler-log:', ...error.logs.map(String));
    }
    return lines.join('\n');
  }

  function crashReportUi() {
    let overlay = document.getElementById('wine-crash-report');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'wine-crash-report';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'wine-crash-title');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '100000', display: 'none',
      alignItems: 'center', justifyContent: 'center', padding: '12px',
      background: 'rgba(0,0,0,.58)', boxSizing: 'border-box',
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(680px, 100%)', maxHeight: 'min(760px, 94vh)', display: 'flex',
      flexDirection: 'column', gap: '8px', padding: '3px 10px 10px',
      color: '#000', background: '#c0c0c0', border: '2px outset #fff',
      boxSizing: 'border-box', font: '13px Arial, sans-serif',
    });
    const title = document.createElement('div');
    title.id = 'wine-crash-title';
    title.textContent = 'Wine-Assembly encountered a fatal error';
    Object.assign(title.style, {
      margin: '0 -7px', padding: '4px 6px', color: '#fff', background: '#000080',
      fontWeight: 'bold',
    });
    const summary = document.createElement('div');
    summary.className = 'wine-crash-summary';
    summary.textContent = 'The app stopped. Copy this report when filing a bug.';
    const report = document.createElement('textarea');
    report.className = 'wine-crash-text';
    report.readOnly = true;
    report.spellcheck = false;
    report.setAttribute('aria-label', 'Crash report');
    Object.assign(report.style, {
      width: '100%', minHeight: '230px', flex: '1 1 45vh', resize: 'vertical',
      padding: '7px', boxSizing: 'border-box', color: '#000', background: '#fff',
      border: '2px inset #fff', font: '12px/1.35 monospace', whiteSpace: 'pre',
    });
    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'wine-crash-copy';
    copy.textContent = 'Copy crash report';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'wine-crash-close';
    close.textContent = 'Close';
    for (const button of [copy, close]) {
      Object.assign(button.style, { minWidth: '92px', padding: '5px 10px' });
    }
    copy.addEventListener('click', async () => {
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(report.value);
          copied = true;
        }
      } catch (_) { /* insecure LAN / denied permission: use selection below */ }
      if (!copied) {
        report.focus();
        report.select();
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      }
      copy.textContent = copied ? 'Copied' : 'Select all & copy';
      if (!copied) { report.focus(); report.select(); }
    });
    close.addEventListener('click', () => { overlay.style.display = 'none'; });
    panel.append(title, summary, report, buttons);
    buttons.append(copy, close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return overlay;
  }

  function showCrashReport(details) {
    const text = crashReportText(details);
    if (typeof document === 'undefined' || !document.body) return text;
    const overlay = crashReportUi();
    overlay.querySelector('.wine-crash-text').value = text;
    overlay.querySelector('.wine-crash-summary').textContent =
      `${details && details.app ? details.app + ' stopped. ' : ''}` +
      'Copy this report when filing a bug.';
    const copy = overlay.querySelector('.wine-crash-copy');
    copy.textContent = 'Copy crash report';
    overlay.style.display = 'flex';
    copy.focus();
    return text;
  }

  // A LAN match ending because the other side vanished is invisible from
  // inside the guest: the frames simply stop, and DirectPlay games differ
  // wildly in whether they say anything about it -- Blobby Volley keeps
  // serving to a blob that no longer answers. The log pane would be the
  // natural place to say so and is exactly the wrong one: a phone plays
  // full screen with the desktop hidden, so nothing in the page is visible
  // behind the canvas. This is a banner over the app instead.
  //
  // It is deliberately not modal. The guest is still running and a local
  // player may well want to keep going (Blobby falls back to serving
  // against nothing, and its menus still work), so this reports and gets
  // out of the way rather than seizing the screen.
  // A game holds the display through element fullscreen (index.html puts
  // #screen-wrap into it), and a browser paints nothing outside the
  // fullscreen element -- a banner on <body> is simply not there. Same rule
  // and same fix as the shutdown overlays in lib/shutdown.js.
  function lanNoticeHost() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }

  function lanNoticeUi() {
    const existing = document.getElementById('wine-lan-notice');
    if (existing) return existing;
    const banner = document.createElement('div');
    banner.id = 'wine-lan-notice';
    banner.setAttribute('role', 'status');
    Object.assign(banner.style, {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      // Clear of the notch and of the exit chip that lives in the top right.
      top: 'calc(8px + env(safe-area-inset-top, 0px))',
      zIndex: '2147483000', display: 'none', gap: '10px', alignItems: 'center',
      maxWidth: 'min(520px, calc(100vw - 88px))', padding: '7px 10px',
      color: '#000', background: '#c0c0c0', border: '2px outset #fff',
      boxSizing: 'border-box', font: '13px Arial, sans-serif',
      boxShadow: '0 2px 10px rgba(0,0,0,.45)',
    });
    const text = document.createElement('span');
    text.className = 'wine-lan-notice-text';
    text.style.flex = '1 1 auto';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'wine-lan-notice-close';
    dismiss.textContent = 'OK';
    // 44px is Apple's minimum touch target and this is dismissed with a thumb
    // on a screen whose every other pixel belongs to the game.
    Object.assign(dismiss.style, { minWidth: '52px', minHeight: '30px', padding: '4px 10px' });
    dismiss.addEventListener('click', () => { banner.style.display = 'none'; });
    banner.append(text, dismiss);
    lanNoticeHost().appendChild(banner);
    return banner;
  }

  function showLanNotice(message) {
    if (typeof document === 'undefined' || !document.body) return null;
    const banner = lanNoticeUi();
    banner.querySelector('.wine-lan-notice-text').textContent = message;
    banner.style.display = 'flex';
    // The app may enter or leave fullscreen while this is up -- the renderer
    // drops out of it when the last guest window goes -- and the banner has
    // to follow, or it vanishes mid-read.
    const follow = () => {
      const host = lanNoticeHost();
      if (banner.parentNode !== host) host.appendChild(banner);
    };
    follow();
    if (!banner._following) {
      banner._following = true;
      document.addEventListener('fullscreenchange', follow);
      document.addEventListener('webkitfullscreenchange', follow);
    }
    return banner;
  }

  // A game's stock key assignment can be wrong for a thumb and right for a
  // keyboard -- Blobby Volley puts player two's jump on the arrow key its own
  // menus navigate with, which costs a touch layout an entire extra button.
  // An app may declare `touchPatches` to move such a key, and it is applied
  // ONLY while the on-screen pad is up, so a desktop player's file is never
  // touched. It edits bytes in place rather than shipping a second data file,
  // because the file it patches is usually the player's own saved copy and
  // everything else in it -- names, colours, sound -- is theirs to keep.
  //
  // `size` is a guard, not a requirement: a file of another length is a
  // different version of the format and its offsets mean something else, so
  // it is left alone rather than corrupted.
  function applyTouchPatches(app, vfs, log) {
    const patches = app && app.touchPatches;
    if (!patches || !patches.length || !vfs || !vfs.files) return;
    const touch = typeof window !== 'undefined' ? window.TouchControls : null;
    if (!(touch && touch.shouldInstall())) return;
    for (const patch of patches) {
      const norm = typeof vfs._normPath === 'function' ? vfs._normPath(patch.path) : patch.path;
      const entry = vfs.files.get(norm);
      const data = entry && entry.data;
      if (!data) continue;
      if (Number.isFinite(patch.size) && data.length !== patch.size) {
        if (log) log.textContent += `touch keys: ${patch.path} is ${data.length} bytes, not ${patch.size} — left alone\n`;
        continue;
      }
      if (patch.offset + 4 > data.length) continue;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (view.getUint32(patch.offset, true) === patch.uint32) continue;
      view.setUint32(patch.offset, patch.uint32, true);
      if (log) log.textContent += `touch keys: ${patch.path} +0x${patch.offset.toString(16)} = 0x${patch.uint32.toString(16)}\n`;
    }
  }

  // Which on-screen layout this seat gets. A two-player keyboard game reads
  // both players' keys off one keyboard, so a pad that sends both sets walks
  // both blobs -- harmless on the wire, where the other machine owns the other
  // blob, and the whole bug in a solo match. The room hands out seats and the
  // host always holds .1, so by the time we join we know which player we are;
  // before then this machine is the only one there, so player one is right.
  const LAN_HOST_SEAT = '10.0.0.1';
  function touchControlsForSeat(app, address) {
    const own = (app && app.touchControls) || null;
    if (!app || !app.lanClientTouchControls) return own;
    if (!address || String(address) === LAN_HOST_SEAT) return own;
    return app.lanClientTouchControls;
  }

  // Say it once per wire, name the person if the lobby knew their name, and
  // put it in the log too so a desktop session has a record after the banner
  // is dismissed.
  function watchLanWire(wire, peer, log) {
    if (!wire || typeof wire !== 'object') return;
    const who = peer && peer.name ? peer.name : 'The other player';
    wire.onClosed = why => {
      const what = why === 'channel-closed' ? 'left the game' : 'lost their connection';
      const message = `${who} ${what}. The LAN game is over — you can keep playing or launch again to reconnect.`;
      showLanNotice(message);
      if (log) log.textContent += `LAN: ${message}\n`;
    };
  }

  // ---- the automatic room (lan.room === 'auto', lib/vlan-room.js) --------
  //
  // No lobby: the first socket() puts this machine in the game's room, as
  // owner or member, and the game's own server browser does the finding. The
  // only questions a person is ever asked are the Join card -- "alex is
  // hosting; join?" -- and only when somebody actually is.

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timed out')), ms))]);
  }

  // The room as a session chip (lib/session-chips.js): 🌐 and what the room
  // is doing. An event (joined, left, hosting) is held in the chip's text for
  // holdMs and then it settles back to a summary -- "Blobby · 2 players" --
  // with holdMs 0 meaning "until the next one". The chip never asks anything
  // by itself: its menu lists who is here, copies the invite link and leaves
  // the room. Its element keeps the id the old corner toast had,
  // #wine-lan-chip, and the same text, so anything reading that still reads.
  const SHELL_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  const lanChip = { handle: null, gen: 0, room: null, wine: null, app: null, sel: null,
    flash: '', flashUntil: 0, timer: null, events: [] };

  function loadSessionChips() {
    const url = new URL('session-chips.js', SHELL_SRC || new URL('lib/', document.baseURI)).href;
    return import(url);
  }

  function lanChipLabel() {
    return (lanChip.app && lanChip.app.lan && lanChip.app.lan.label) || lanChip.sel || 'LAN';
  }

  function lanChipSpec() {
    const room = lanChip.room;
    let text = 'LAN';
    let short = '';
    if (room && room.role === 'owner') {
      const n = room.members.size + 1;
      text = n > 1 ? `${lanChipLabel()} · ${n} players` : `${lanChipLabel()} room open`;
      short = String(n);
    } else if (room) {
      text = `in ${room.owner ? room.owner.name : 'a host'}'s room`;
      short = '';
    }
    if (lanChip.flash && Date.now() < lanChip.flashUntil) { text = lanChip.flash; short = lanChip.flash; }
    return { icon: 'lan', text, short, title: `LAN: ${text}`, menu: lanChipMenu };
  }

  function lanChipMenu() {
    const room = lanChip.room;
    if (!room) return [{ header: 'LAN', icon: 'lan' }, { sub: lanChip.flash || 'connecting…' }];
    const items = [
      { icon: 'lan', header: `${lanChipLabel()} · ${room.role === 'owner' ? 'your room' : `${room.owner ? room.owner.name : '?'}'s room`}` },
      { sub: `you are ${room.address}${room.role === 'owner' ? ' (host)' : ''}` },
    ];
    if (room.role === 'owner') {
      for (const m of room.members.values()) items.push({ sub: `• ${(m.peer && m.peer.name) || 'a player'} · ${m.seat}` });
      if (!room.members.size) items.push({ sub: 'nobody else here yet' });
    } else if (room.owner) {
      items.push({ sub: `• ${room.owner.name} · ${room.owner.address} (host)` });
    }
    const recent = lanChip.events.slice(-3);
    if (recent.length) items.push({ sep: true }, ...recent.map(t => ({ sub: t })));
    items.push({ sep: true },
      { text: 'Copy invite link', onclick: copyLanInvite },
      { text: room.role === 'owner' ? 'Close room, keep playing' : 'Leave room, keep playing', onclick: leaveLanRoom });
    return items;
  }

  function syncLanChip(pulse) {
    if (typeof document === 'undefined' || !document.body) return;
    if (lanChip.handle) {
      lanChip.handle.update(lanChipSpec());
      if (pulse) lanChip.handle.pulse();
      return;
    }
    if (lanChip.loading) return;
    const gen = lanChip.gen;
    lanChip.loading = loadSessionChips().then((chips) => {
      lanChip.loading = null;
      if (gen !== lanChip.gen || lanChip.handle) return; // cleared while loading
      lanChip.handle = chips.add(Object.assign({ id: 'lan', domId: 'wine-lan-chip' }, lanChipSpec()));
    }).catch((e) => { lanChip.loading = null; console.warn('[lan] no session chip:', e); });
  }

  function showLanChip(text, holdMs) {
    if (typeof document === 'undefined' || !document.body) return;
    const t = String(text).replace(/^(?:[●◌] )?LAN · /, '');
    lanChip.flash = t;
    lanChip.flashUntil = holdMs ? Date.now() + holdMs : Infinity;
    lanChip.events.push(t);
    if (lanChip.events.length > 8) lanChip.events.shift();
    if (lanChip.timer) clearTimeout(lanChip.timer);
    lanChip.timer = holdMs ? setTimeout(() => { lanChip.timer = null; syncLanChip(false); }, holdMs + 20) : null;
    syncLanChip(true);
  }

  function attachLanChip(wine, room, app, sel) {
    Object.assign(lanChip, { wine, room, app, sel });
    syncLanChip(false);
  }

  function removeLanChip() {
    lanChip.gen++;
    if (lanChip.timer) { clearTimeout(lanChip.timer); lanChip.timer = null; }
    if (lanChip.handle) { lanChip.handle.remove(); lanChip.handle = null; }
    Object.assign(lanChip, { room: null, wine: null, app: null, sel: null, flash: '', flashUntil: 0, events: [] });
  }

  function copyLanInvite() {
    const room = lanChip.room;
    if (!room || !room.ownerUserId) return;
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('app', lanChip.sel);
    url.searchParams.set('room', room.ownerUserId);
    const link = url.href;
    const done = ok => showLanChip(ok ? 'invite link copied' : 'could not copy the invite link', 4000);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(() => done(true), () => done(false));
    else done(false);
  }

  // Leave the room and keep the game: the wire closes under it, which to the
  // game is a network that went away, and the offers to join somebody else's
  // room stop -- leaving was a choice, not a dropped connection to repair.
  function leaveLanRoom() {
    const { room, wine } = lanChip;
    if (!room) return;
    if (wine) {
      if (wine._lanRoom === room) wine._lanRoom = null;
      if (wine._lanOffers) { clearInterval(wine._lanOffers); wine._lanOffers = null; }
    }
    clearRoomUrl(room.ownerUserId);
    room.close();
    clearLanNotices();
  }

  // The room's own notices outlive nothing: an owner's "room open" chip is
  // held with no timeout and the share card waits for OK, so quitting the
  // game that opened the room has to take both down itself.
  function clearLanNotices() {
    if (typeof document === 'undefined') return;
    removeLanChip();
    for (const id of ['wine-lan-share']) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }

  // "alex is hosting Quake II -- join?" Resolves 'join' or 'skip'. As a
  // `toast` it sits at the top over a running game and gives up on its own;
  // otherwise it is the card a person sees before the game starts, or when
  // the game first goes online.
  function askToJoin(owner, app, opts) {
    const o = opts || {};
    return new Promise(resolve => {
      if (typeof document === 'undefined' || !document.body) { resolve('skip'); return; }
      const old = document.getElementById('wine-lan-card');
      if (old) old.remove();
      const card = document.createElement('div');
      card.id = 'wine-lan-card';
      card.setAttribute('role', 'dialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', zIndex: '2147483001',
        transform: o.toast ? 'translateX(-50%)' : 'translate(-50%, -50%)',
        top: o.toast ? 'calc(8px + env(safe-area-inset-top, 0px))' : '45%',
        width: 'min(380px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const label = (app.lan && app.lan.label) || 'this game';
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = `● ${owner.name} is hosting ${label}`;
      const detail = document.createElement('div');
      detail.style.cssText = 'margin:4px 0 10px;color:#333;font-family:ui-monospace,monospace';
      detail.textContent = owner.hosting && owner.hosting.label ? owner.hosting.label : '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
      let done = false;
      const finish = answer => {
        if (done) return;
        done = true;
        card.remove();
        resolve(answer);
      };
      const button = (text, answer) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => finish(answer));
        return b;
      };
      // Signed out, the room was read from public records: Join goes by way
      // of the sign-in page and comes back to this room's link.
      const join = button(o.signedOut ? 'Sign in to join' : `Join ${owner.name}`, 'join');
      join.style.fontWeight = '700';
      row.append(button(o.skipLabel || 'Not now', 'skip'), join);
      card.append(title, detail, row);
      lanNoticeHost().appendChild(card);
      join.focus();
      if (o.toast) setTimeout(() => finish('skip'), o.toastMs || 10000);
    });
  }

  // The server list: every room serving this game, freshest first, each with
  // its own Join, and one way to carry on without the network. It re-reads
  // presence while it is open, so a server that starts while somebody is
  // looking appears in it and one that stops drops out. Resolves the chosen
  // owner's presence record, or null to continue offline.
  function pickRoom(rooms, app, opts) {
    const o = opts || {};
    return new Promise(resolve => {
      if (typeof document === 'undefined' || !document.body) { resolve(null); return; }
      const old = document.getElementById('wine-lan-card');
      if (old) old.remove();
      const card = document.createElement('div');
      card.id = 'wine-lan-card';
      card.setAttribute('role', 'dialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', top: '45%', zIndex: '2147483001',
        transform: 'translate(-50%, -50%)',
        width: 'min(420px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const label = (app.lan && app.lan.label) || 'this game';
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = `${label} — games waiting for players`;
      const list = document.createElement('div');
      list.className = 'wine-lan-rooms';
      list.style.cssText = 'margin:8px 0 10px;max-height:40vh;overflow-y:auto;'
        + 'background:#fff;border:2px inset #fff';
      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;justify-content:flex-end';
      let done = false;
      let timer = null;
      const finish = choice => {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        card.remove();
        resolve(choice);
      };
      const render = current => {
        list.textContent = '';
        if (!current.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:8px;color:#555';
          empty.textContent = 'Nobody is hosting right now.';
          list.appendChild(empty);
          return;
        }
        for (const room of current) {
          const row = document.createElement('div');
          row.className = 'wine-lan-room';
          row.dataset.userId = room.userId;
          row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;'
            + 'border-bottom:1px solid #ddd';
          const who = document.createElement('div');
          who.style.cssText = 'flex:1;min-width:0';
          const name = document.createElement('div');
          name.style.fontWeight = '700';
          name.textContent = `● ${room.name}`;
          const detail = document.createElement('div');
          detail.style.cssText = 'color:#333;font-family:ui-monospace,monospace;'
            + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
          detail.textContent = room.hosting && room.hosting.label ? room.hosting.label : 'waiting';
          who.append(name, detail);
          const join = document.createElement('button');
          join.type = 'button';
          join.textContent = 'Join';
          join.dataset.choice = 'join';
          join.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit;font-weight:700';
          join.addEventListener('click', () => finish(room));
          row.append(who, join);
          list.appendChild(row);
        }
      };
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.textContent = 'Play offline';
      skip.dataset.choice = 'skip';
      skip.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
      skip.addEventListener('click', () => finish(null));
      footer.style.gap = '8px';
      // Offered only when the game went online without saying whether it
      // serves or joins (a plain socket): somebody about to host a server
      // beside the ones listed.
      if (o.ownLabel) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.ownLabel;
        b.dataset.choice = 'own';
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => finish('own'));
        footer.appendChild(b);
      }
      footer.appendChild(skip);
      card.append(title, list);
      // Signed out, the list was read from public records; joining needs an
      // account, and the sign-in page comes back straight to the room picked.
      if (o.signedOut) {
        const note = document.createElement('div');
        note.className = 'wine-lan-signin-note';
        note.style.cssText = 'margin:-4px 0 10px;color:#333';
        note.textContent = 'Joining asks you to sign in to a free berrry account first.';
        card.appendChild(note);
      }
      card.appendChild(footer);
      render(rooms);
      lanNoticeHost().appendChild(card);
      const first = list.querySelector('button');
      (first || skip).focus();
      if (o.refresh) {
        timer = setInterval(async () => {
          try {
            const next = await o.refresh();
            if (!done) render(next);
          } catch (_) { /* keep showing what we had */ }
        }, o.refreshMs || 3000);
      }
    });
  }

  // "You are hosting -- here is the link." Shown when this page goes online
  // to serve, because the page URL (setRoomUrl) is the invitation and
  // nothing else on screen says so. Copy uses the clipboard, and the phone's
  // share sheet where there is one.
  function showShareCard(app) {
    if (typeof document === 'undefined' || !document.body) return null;
    const old = document.getElementById('wine-lan-share');
    if (old) old.remove();
    const card = document.createElement('div');
    card.id = 'wine-lan-share';
    card.setAttribute('role', 'dialog');
    Object.assign(card.style, {
      position: 'fixed', left: '50%', top: 'calc(8px + env(safe-area-inset-top, 0px))',
      transform: 'translateX(-50%)', zIndex: '2147483001',
      width: 'min(420px, calc(100vw - 32px))', boxSizing: 'border-box',
      padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
      font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
    });
    const label = (app.lan && app.lan.label) || 'this game';
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.textContent = `● You are hosting ${label}`;
    const text = document.createElement('div');
    text.style.margin = '4px 0 6px';
    text.textContent = 'Send this page’s link to a friend — opening it joins your game:';
    const link = document.createElement('input');
    link.className = 'wine-lan-share-url';
    link.readOnly = true;
    link.value = location.href;
    link.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:10px;'
      + 'font:12px ui-monospace,monospace;padding:4px';
    link.addEventListener('focus', () => link.select());
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const button = (caption, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = caption;
      b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
      b.addEventListener('click', onClick);
      return b;
    };
    // navigator.clipboard exists only in a secure context, so on plain http
    // from another machine (a phone testing a LAN dev server) it is simply
    // undefined. execCommand('copy') on the selected field still works there,
    // as long as it runs inside the click.
    // iOS Safari will not select text in a readOnly input, and execCommand then
    // copies nothing and still returns true -- so drop readOnly for the copy.
    const copyBySelection = () => {
      const ro = link.readOnly;
      link.readOnly = false;
      link.focus();
      link.select();
      try { link.setSelectionRange(0, link.value.length); } catch (_) {}
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      link.readOnly = ro;
      return ok;
    };
    const copied = ok => {
      copy.textContent = ok ? 'Copied' : 'Copy the link above';
      if (ok) setTimeout(() => { copy.textContent = caption; }, 2000);
    };
    const caption = navigator.share ? 'Share link' : 'Copy link';
    const copy = button(caption, async () => {
      link.value = location.href;
      if (navigator.share) {
        try { await navigator.share({ title: label, url: link.value }); return; } catch (e) {
          if (e && e.name === 'AbortError') return;   // the person closed the sheet
        }
      }
      if (!navigator.clipboard || !window.isSecureContext) { copied(copyBySelection()); return; }
      try {
        await navigator.clipboard.writeText(link.value);
        copied(true);
      } catch (_) {
        copied(copyBySelection());
      }
    });
    copy.style.fontWeight = '700';
    row.append(button('OK', () => card.remove()), copy);
    card.append(title, text, link, row);
    lanNoticeHost().appendChild(card);
    return card;
  }

  // Online play needs a Berrry account, and a 401 from the signaling API is
  // the only place the page learns it has none. Resolves 'signin' or
  // 'offline'; `invited` is for a page opened from somebody's room link.
  function askToSignIn(app, opts) {
    const o = opts || {};
    return new Promise(resolve => {
      if (typeof document === 'undefined' || !document.body) { resolve('offline'); return; }
      const old = document.getElementById('wine-lan-signin');
      if (old) old.remove();
      const card = document.createElement('div');
      card.id = 'wine-lan-signin';
      card.setAttribute('role', 'dialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', top: '45%', zIndex: '2147483001',
        transform: 'translate(-50%, -50%)',
        width: 'min(380px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const label = (app.lan && app.lan.label) || 'this game';
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = `Sign in to play ${label} online`;
      const text = document.createElement('div');
      text.style.margin = '4px 0 10px';
      text.textContent = (o.invited ? (o.host ? `${o.host} invited you to a game. ` : 'You were invited to a game. ') : '')
        + 'Online play needs a free berrry account.';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
      const button = (caption, answer) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = caption;
        b.dataset.choice = answer;
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => {
          card.remove();
          // The popup has to open inside the click, or it is blocked.
          if (answer === 'signin' && o.popup && openSignInPopup()) { resolve('popup'); return; }
          resolve(answer);
        });
        return b;
      };
      const signIn = button('Sign in', 'signin');
      signIn.style.fontWeight = '700';
      row.append(button('Play offline', 'offline'), signIn);
      card.append(title, text, row);
      lanNoticeHost().appendChild(card);
      signIn.focus();
    });
  }

  // A room link naming this page's own account. Rooms are one per account,
  // so the page cannot join it: it is the room this account already hosts
  // somewhere else, and it never appears in this page's list. Say so, rather
  // than launching offline with nothing but a log line. Resolves 'host' to
  // start a room on this device instead, or 'offline'.
  function tellOwnRoomLink(app) {
    return new Promise(resolve => {
      if (typeof document === 'undefined' || !document.body) { resolve('offline'); return; }
      const old = document.getElementById('wine-lan-card');
      if (old) old.remove();
      const card = document.createElement('div');
      card.id = 'wine-lan-card';
      card.setAttribute('role', 'alertdialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', top: '45%', zIndex: '2147483001',
        transform: 'translate(-50%, -50%)',
        width: 'min(380px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const label = (app.lan && app.lan.label) || 'this game';
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = 'This is your own room link';
      const text = document.createElement('div');
      text.style.margin = '4px 0 10px';
      text.textContent = `It points at the ${label} room of the account you are signed in with, `
        + 'so it cannot be joined from here. One account can be in a room on only one device '
        + 'at a time. To play together, open the link signed in as a different account, '
        + 'or start a new room here — that moves your room to this device, so close the game '
        + 'on the other one.';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
      const button = (caption, answer) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = caption;
        b.dataset.choice = answer;
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => { card.remove(); resolve(answer); });
        return b;
      };
      const host = button('Start a new room', 'host');
      host.style.fontWeight = '700';
      row.append(button('Play offline', 'offline'), host);
      card.append(title, text, row);
      lanNoticeHost().appendChild(card);
      host.focus();
    });
  }

  // Off to Berrry's login, asking to come back to this exact page: its URL
  // names the app and, for a room link, the room, so the page that loads
  // afterwards carries on from where this one stopped. The URL is also kept
  // in this tab's sessionStorage in case the login returns to the site root
  // instead (resumeAfterSignIn).
  const SIGNIN_RETURN_KEY = 'wine-lan-signin-return';
  function goSignIn(returnTo) {
    const back = returnTo || location.href;
    try { sessionStorage.setItem(SIGNIN_RETURN_KEY, back); } catch (_) {}
    // Absolute: Berrry's /login on the main domain runs `new URL(return)`,
    // which throws on a path. It comes back as return + `?token=…`, and the
    // app's own server turns that into a cookie and redirects to the URL
    // without the token, keeping ?app and ?room.
    location.assign(`/api/auth/login?return=${encodeURIComponent(back)}`);
  }

  // This page's URL naming the app (and a room), so a login that leaves the
  // page comes back to the same game even when it was launched from an icon.
  function appUrl(sel, room) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('app', sel);
      if (room) url.searchParams.set('room', room);
      return url.href;
    } catch (_) { return location.href; }
  }

  // Join a room found signed out: the login comes back to that room's link,
  // and the ordinary invite path joins it from there.
  function signInToJoin(sel, owner) {
    goSignIn(appUrl(sel, owner.userId));
  }

  // Sign in without leaving the running game: Berrry's login in a popup,
  // returning to signin-done.html on this origin. The app server has turned
  // the token into the session cookie by the time that page loads, and it
  // says so on a BroadcastChannel. Nothing else can be watched: the site is
  // cross-origin isolated, so COOP cuts window.opener as soon as the popup
  // visits berrry.app, and popup.closed reads true from then on.
  const SIGNIN_CHANNEL = 'wine-lan-signin';
  function openSignInPopup() {
    try {
      const done = new URL('signin-done.html', location.href).href;
      return window.open(`/api/auth/login?return=${encodeURIComponent(done)}`,
        'wine-signin', 'popup,width=520,height=680') || null;
    } catch (_) { return null; }
  }

  async function signedInNow() {
    try {
      // Unique query: an edge-cached identity must not answer this (see
      // SignalingClient._json in vlan-rtc.js).
      const r = await fetch(`/api/auth/user?fresh=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
      return r.ok;
    } catch (_) { return false; }
  }

  // ---- the Start menu's account item -------------------------------------
  // The signed-in berrry user as { id, name }, or null when signed out or
  // the service cannot be reached.
  async function accountUser() {
    try {
      const r = await fetch(`/api/auth/user?fresh=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return null;
      const me = await r.json();
      if (!me || me.id == null) return null;
      return { id: String(me.id), name: me.display_name || me.name || me.username || null };
    } catch (_) { return null; }
  }

  // The popup when the browser allows it, so a running game is not reloaded;
  // otherwise this tab goes to the login and comes back to this same page.
  function accountSignIn() {
    if (openSignInPopup()) return 'popup';
    goSignIn();
    return 'redirect';
  }

  async function accountSignOut() {
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      return r.ok || r.status === 401;
    } catch (_) { return false; }
  }

  // Calls back whenever a sign-in may have finished elsewhere: the popup's
  // message, or this tab coming back into view.
  function onAccountChange(callback) {
    try { new BroadcastChannel(SIGNIN_CHANNEL).onmessage = () => callback(); } catch (_) {}
    window.addEventListener('storage', e => { if (e.key === 'wine-lan-signin-done') callback(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) callback(); });
  }

  // While the popup is open: resolves 'signed-in', 'redirect' (sign in in
  // this tab instead) or 'offline'. The popup's message is checked against
  // /api/auth/user, and so is every return to this tab, which covers a
  // browser that opened the login as a tab and never delivered the message.
  function waitForSignIn(app) {
    return new Promise(resolve => {
      const label = (app.lan && app.lan.label) || 'the game';
      const card = document.createElement('div');
      card.id = 'wine-lan-signin-wait';
      card.setAttribute('role', 'dialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', top: '45%', zIndex: '2147483001',
        transform: 'translate(-50%, -50%)',
        width: 'min(380px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = 'Signing in…';
      const text = document.createElement('div');
      text.style.margin = '4px 0 10px';
      text.textContent = `Finish signing in in the window that opened. ${label} waits here and goes online when you are done.`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
      let channel = null;
      let timer = 0;
      let done = false;
      const finish = answer => {
        if (done) return;
        done = true;
        card.remove();
        clearInterval(timer);
        window.removeEventListener('focus', check);
        document.removeEventListener('visibilitychange', check);
        window.removeEventListener('storage', onStorage);
        try { if (channel) channel.close(); } catch (_) {}
        resolve(answer);
      };
      let checking = false;
      async function check() {
        if (done || checking) return;
        checking = true;
        const ok = await signedInNow();
        checking = false;
        if (ok) finish('signed-in');
      }
      const onStorage = e => { if (e.key === 'wine-lan-signin-done') check(); };
      try {
        channel = new BroadcastChannel(SIGNIN_CHANNEL);
        channel.onmessage = check;
      } catch (_) {}
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', check);
      window.addEventListener('storage', onStorage);
      timer = setInterval(check, 3000);
      const button = (caption, answer) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = caption;
        b.dataset.choice = answer;
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => finish(answer));
        return b;
      };
      row.append(button('Play offline', 'offline'), button('Sign in in this tab', 'redirect'));
      card.append(title, text, row);
      lanNoticeHost().appendChild(card);
    });
  }

  // Called once at page load, before any ?app= launch. A login that landed
  // back on a page with no app named goes on to the page that sent it there;
  // either way the note is spent. Returns true when it is navigating away.
  function resumeAfterSignIn() {
    let saved = null;
    try {
      saved = sessionStorage.getItem(SIGNIN_RETURN_KEY);
      sessionStorage.removeItem(SIGNIN_RETURN_KEY);
    } catch (_) { return false; }
    if (!saved || new URLSearchParams(location.search).get('app')) return false;
    try {
      const url = new URL(saved);
      if (url.origin !== location.origin || url.href === location.href) return false;
      location.replace(url.href);
      return true;
    } catch (_) { return false; }
  }

  // Serving rooms, the order the list shows them.
  function servingRooms(rooms) {
    return rooms.filter(r => r.hosting)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  // ---- the other side is gone ---------------------------------------------
  //
  // A closed browser, a phone put to sleep or a dropped connection is
  // invisible from inside most games: a host keeps serving to a player who no
  // longer answers, and a guest waits on a host who is not there. Few games
  // notice, and those that do say it in their own words, if at all. So the
  // page says it, the same way for every game, and offers the ways out.
  // Getting a game from its first screen back into a network match is the
  // only game-specific part, and that is the app's lan.host.inGame /
  // lan.join.inGame recipe (lib/apps.js).
  //
  // Resolves 'stay' (carry on; an owner's room stays open for the next
  // player), 'host' (start this game over and host a new match), 'find'
  // (start it over and pick a match from the server list) or 'quit'. It
  // shares the join card's id so the offers toast stays quiet while it is up.
  function showLanOverCard(app, opts) {
    const o = opts || {};
    return new Promise(resolve => {
      if (typeof document === 'undefined' || !document.body) { resolve('stay'); return; }
      const old = document.getElementById('wine-lan-card');
      if (old) old.remove();
      const card = document.createElement('div');
      card.id = 'wine-lan-card';
      card.className = 'wine-lan-over';
      card.setAttribute('role', 'alertdialog');
      Object.assign(card.style, {
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: '2147483001',
        top: 'calc(8px + env(safe-area-inset-top, 0px))',
        width: 'min(440px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
        font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
      });
      const title = document.createElement('div');
      title.className = 'wine-lan-over-title';
      title.style.fontWeight = '700';
      title.textContent = o.title || 'The network game is over';
      const text = document.createElement('div');
      text.className = 'wine-lan-over-text';
      text.style.margin = '4px 0 10px';
      text.textContent = o.text || '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
      let done = false;
      const finish = answer => {
        if (done) return;
        done = true;
        card.remove();
        resolve(answer);
      };
      const button = (caption, answer) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = caption;
        b.dataset.choice = answer;
        b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
        b.addEventListener('click', () => finish(answer));
        return b;
      };
      const stay = button(o.stayLabel || 'Keep playing', 'stay');
      const host = button('Host a new game', 'host');
      const find = button('Find another game', 'find');
      // The likelier next step is the one a thumb lands on: a host whose
      // player left hosts again, a guest whose host left looks for another.
      const primary = o.role === 'owner' ? host : find;
      primary.style.fontWeight = '700';
      row.append(button('Quit', 'quit'), o.role === 'owner' ? find : host, primary, stay);
      card.append(title, text, row);
      lanNoticeHost().appendChild(card);
      primary.focus();
    });
  }

  // Set by createBrowserShell: what a choice on that card does to the running
  // game. Module-level because the room's events arrive here, outside it.
  let lanOverHandler = null;

  function lanRoomEvent(app, type, detail, log) {
    const label = (app.lan && app.lan.label) || 'the game';
    let text = null;
    if (type === 'joined') text = `● LAN · ${detail.name} joined (${detail.count + 1} here)`;
    else if (type === 'left' && !detail.count) {
      // The last other player gone -- a closed browser, a phone asleep -- is
      // invisible from inside most games, which keep serving to nobody.
      const what = detail.quit ? 'left the game' : 'lost their connection';
      const message = `${detail.name} ${what}. Nobody else is in the room now — you can keep playing, and anyone who opens ${label} will see it.`;
      if (log) log.textContent += `LAN: ${message}\n`;
      if (lanOverHandler) {
        lanOverHandler(app, detail.room, {
          role: 'owner',
          title: `${detail.name} ${detail.quit ? 'left the game' : 'disconnected'}`,
          text: `${detail.quit ? '' : `${detail.name} lost their connection. `}`
            + `Your room is still open, so anyone who opens ${label} can join it — `
            + 'or start over and host a new game, or look for another one.',
          stayLabel: 'Keep waiting',
        });
      } else {
        showLanNotice(message);
      }
      return;
    } else if (type === 'left') {
      text = detail.quit
        ? `LAN · ${detail.name} left (${detail.count + 1} here)`
        : `LAN · ${detail.name} lost their connection (${detail.count + 1} here)`;
    }
    else if (type === 'hosting' && detail.hosting) {
      text = `● LAN · hosting ${detail.hosting.label || label} — anyone opening ${label} will see it`;
    } else if (type === 'closed') {
      clearRoomUrl(detail.room && detail.room.ownerUserId);
      if (detail.room && typeof detail.room.onEnded === 'function') {
        setTimeout(() => detail.room.onEnded(detail), 0);
      }
      const message = `${detail.message}. The LAN game is over — you can keep playing, or go online again to start a new room.`;
      if (log) log.textContent += `LAN: ${message}\n`;
      if (lanOverHandler) {
        lanOverHandler(app, detail.room, {
          role: 'member',
          title: detail.message,
          text: 'The network game is over. Start over and host a game of your own, '
            + 'look for another one, or keep playing here.',
        });
      } else {
        showLanNotice(message);
      }
      return;
    }
    if (!text) return;
    showLanChip(text, 8000);
    if (log) log.textContent += `LAN: ${text.replace(/^● /, '')}\n`;
  }

  // Joining one chosen room, with the network's progress on screen: a card
  // that names the host, says which step it is on and counts the seconds, so
  // the wait reads as "connecting" rather than a hung launch. A room link or
  // a Join button is a request to play *there*, so failing to get in is said
  // plainly with Try again / Play offline -- never a silent room of our own.
  // Resolves the Room, or null to carry on offline.
  async function joinRoomWithDialog(app, sel, log, owner) {
    if (typeof document === 'undefined' || !document.body) {
      return openAutoRoom(app, sel, log, owner.userId, false, { mustJoin: true });
    }
    const label = (app.lan && app.lan.label) || sel;
    const name = owner.name || 'the host';
    const card = document.createElement('div');
    card.id = 'wine-lan-card';
    card.setAttribute('role', 'dialog');
    Object.assign(card.style, {
      position: 'fixed', left: '50%', top: '45%', zIndex: '2147483001',
      transform: 'translate(-50%, -50%)',
      width: 'min(380px, calc(100vw - 32px))', boxSizing: 'border-box',
      padding: '12px', color: '#000', background: '#c0c0c0', border: '2px outset #fff',
      font: '13px Arial, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)',
    });
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    const text = document.createElement('div');
    text.style.margin = '4px 0 10px';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    card.append(title, text, row);
    const button = caption => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = caption;
      b.style.cssText = 'min-height:32px;padding:4px 14px;font:inherit';
      return b;
    };
    const old = document.getElementById('wine-lan-card');
    if (old) old.remove();
    lanNoticeHost().appendChild(card);
    const STEPS = {
      'offering': `Sending a request to ${name}…`,
      'waiting for an answer': `Waiting for ${name}'s game to answer…`,
      'connecting': `Opening a direct connection to ${name}…`,
    };
    try {
      for (;;) {
        // One attempt: the card shows progress and a Cancel.
        const started = Date.now();
        let step = 'Looking up the room…';
        title.textContent = `Joining ${name}'s ${label} game`;
        const paint = () => { text.textContent = `${step} (${Math.round((Date.now() - started) / 1000)}s)`; };
        paint();
        const tick = setInterval(paint, 1000);
        const cancel = button('Cancel');
        row.replaceChildren(cancel);
        const cancelled = new Promise(resolve => cancel.addEventListener('click', () => resolve('cancel')));
        const attempt = openAutoRoom(app, sel, log, owner.userId, false, {
          mustJoin: true,
          onStatus: s => { step = STEPS[s] || (/^joining /.test(s) ? `Contacting ${name}…` : step); paint(); },
        }).then(room => ({ room }), error => ({ error }));
        const outcome = await Promise.race([attempt, cancelled]);
        clearInterval(tick);
        if (outcome === 'cancel') {
          // The attempt may still land; a room nobody wants is left at once.
          attempt.then(r => { if (r.room) r.room.close(); });
          log.textContent += 'LAN: joining cancelled, playing offline.\n';
          return null;
        }
        if (outcome.room) return outcome.room;
        const e = outcome.error;
        const why = (e && e.cause && e.cause.message) || (e && e.message) || String(e);
        log.textContent += `LAN: could not join ${name}: ${why}\n`;
        title.textContent = `Could not join ${name}'s game`;
        text.textContent = /not open any more/.test(why)
          ? `${name}'s room is not open any more.`
          : /did not answer|no longer on the segment/.test(why)
            ? `${name}'s game did not answer. Their page may be closed, asleep, or in a background tab.`
            : /could not be established|connection failed/.test(why)
              ? `Reached ${name}, but a direct connection could not be opened between your networks.`
              : `${why}.`;
        const offline = button('Play offline');
        const retry = button('Try again');
        retry.style.fontWeight = '700';
        row.replaceChildren(offline, retry);
        retry.focus();
        const again = await new Promise(resolve => {
          offline.addEventListener('click', () => resolve(false));
          retry.addEventListener('click', () => resolve(true));
        });
        if (!again) { log.textContent += 'LAN: playing offline.\n'; return null; }
      }
    } finally {
      card.remove();
    }
  }

  async function openAutoRoom(app, sel, log, preferOwner, ownRoom, extra) {
    const more = extra || {};
    const room = await VlanRoom.openRoom({
      join: { exe: (app.lan && app.lan.exe) || sel },
      preferOwner,
      ownRoom: !!ownRoom,
      mustJoin: !!more.mustJoin,
      onStatus: text => {
        if (log) log.textContent += `LAN: ${text}\n`;
        if (more.onStatus) more.onStatus(text);
      },
      onEvent: (type, detail) => lanRoomEvent(app, type, detail, log),
    });
    if (app.lan.hostProbe) room.startProbe(app.lan.hostProbe, 5000);
    setRoomUrl(sel, room.ownerUserId);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => { room.close(); }, { once: true });
    }
    const label = (app.lan && app.lan.label) || sel;
    // A game with no join.launchArgs is joined from its own menus, so the
    // chip says where to go (lan.join.hint) and stays up a while.
    const join = (app.lan && app.lan.join) || {};
    const hint = room.role === 'member' && !join.launchArgs ? lanJoinHint(app, room) : null;
    const text = room.role === 'owner'
      ? `◌ LAN · ${label} room open — waiting for players`
      : `● LAN · in ${room.owner.name}'s room${hint ? ` — ${hint}` : ''}`;
    showLanChip(text, room.role === 'owner' ? 0 : hint ? 30000 : 8000);
    if (log) log.textContent += `LAN: ${text.replace(/^[●◌] /, '')}, you are ${room.address}\n`;
    return room;
  }

  // The arguments a Join launches with, so a joiner lands in the match
  // rather than at the game's own menus: lan.join.launchArgs, {host} being
  // the owner's seat.
  // lan.join.dropArgs names launch words that would get in the way of the
  // match, like a menu the ordinary launch opens on top of it.
  function joinLaunchArgs(app, room, baseArgs) {
    const join = app.lan && app.lan.join;
    const template = join && join.launchArgs;
    if (!template || !room || room.role !== 'member' || !room.owner) return baseArgs;
    const extra = template.replace(/\{host\}/g, room.owner.address);
    const drop = new Set(join.dropArgs || []);
    const kept = String(baseArgs || '').split(/\s+/).filter(w => w && !drop.has(w)).join(' ');
    return kept ? `${kept} ${extra}` : extra;
  }

  // The first owner worth offering: serving, freshest.
  function firstHosted(rooms) {
    return window.VlanRoom ? VlanRoom.chooseOwner(rooms) : (rooms[0] || null);
  }

  // ---- invite links ------------------------------------------------------
  //
  // ?app=ID&room=USERID: open this game and join that person's room. The
  // page's own address carries one while it is in a room (setRoomUrl), so
  // sharing the page lands a friend in the room with no list in the way. Only
  // for the app the link names, so the same page launching something else later
  // does not go looking for a room it was never asked to join.
  function lanInviteFor(sel) {
    if (typeof location === 'undefined') return null;
    const params = new URLSearchParams(location.search);
    return params.get('app') === sel ? params.get('room') || null : null;
  }

  // While a page is in a room, its own address is that room's link, so
  // sharing the page (the browser's own Share, or copying the address bar)
  // shares the room. replaceState, not pushState: joining a room is not a
  // page the Back button should step through. Other parameters (?debug) stay.
  function setRoomUrl(sel, ownerUserId) {
    if (typeof history === 'undefined' || !ownerUserId) return;
    try {
      const url = new URL(location.href);
      url.searchParams.set('app', sel);
      url.searchParams.set('room', ownerUserId);
      history.replaceState(history.state, '', url);
    } catch (_) {}
  }
  function clearRoomUrl(ownerUserId) {
    if (typeof history === 'undefined') return;
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has('room')) return;
      if (ownerUserId && url.searchParams.get('room') !== ownerUserId) return;
      url.searchParams.delete('room');
      history.replaceState(history.state, '', url);
    } catch (_) {}
  }
  // Quitting the app the address names takes it and its room off the URL, so
  // a reload or a shared address lands on the desktop rather than relaunching
  // a game that was closed. Another app's ?app= is left alone. pushState, so
  // Back returns to the game's address and the shell's popstate listener
  // relaunches it (and rejoins its room).
  // `ownedRoom`: this page was the room's owner, so the entry left behind is
  // marked and Back hosts again instead of asking about its own room link.
  function clearAppUrl(sel, ownedRoom) {
    if (typeof history === 'undefined') return;
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('app') !== sel) return;
      const state = Object.assign({}, history.state, { wineOwnRoom: ownedRoom ? sel : null });
      history.replaceState(state, '', location.href);
      url.searchParams.delete('app');
      url.searchParams.delete('room');
      // Keep bare flags bare: URLSearchParams writes ?debug back as ?debug=.
      url.search = url.searchParams.toString().replace(/=(?=&|$)/g, '');
      history.pushState(Object.assign({}, history.state, { wineOwnRoom: null }), '', url);
    } catch (_) {}
  }

  // Types `text` into a running game as real keystrokes, down and up, paced
  // so a guest that polls its queue once a frame sees every one. Each key
  // carries its physical DOM code, because games that read the scan code in
  // lParam (Quake II's MapKey) get it from there; `\n` is Enter.
  const TYPE_KEYS = (() => {
    const map = { ' ': [0x20, 'Space'], '\n': [0x0D, 'Enter'], '\x1b': [0x1B, 'Escape'],
      '`': [0xC0, 'Backquote'],
      '.': [0xBE, 'Period'], ':': [0xBA, 'Semicolon'], '-': [0xBD, 'Minus'] };
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(97 + i);
      map[ch] = [0x41 + i, `Key${ch.toUpperCase()}`];
    }
    for (let i = 0; i < 10; i++) map[String(i)] = [0x30 + i, `Digit${i}`];
    return map;
  })();
  async function typeIntoGame(renderer, text, paceMs) {
    const pace = paceMs || 60;
    for (const ch of text) {
      const key = TYPE_KEYS[ch];
      if (!key) continue;
      const info = { code: key[1], location: 0, repeat: false };
      renderer.handleKeyDown(key[0], info);
      await new Promise(r => setTimeout(r, pace));
      renderer.handleKeyUp(key[0], info);
      await new Promise(r => setTimeout(r, pace));
    }
  }

  // Presses named keys (Up, Down, Left, Right, Enter, Escape) the same way,
  // for games that are joined through their menus rather than a console.
  const NAMED_KEYS = {
    Up: [0x26, 'ArrowUp'], Down: [0x28, 'ArrowDown'], Left: [0x25, 'ArrowLeft'],
    Right: [0x27, 'ArrowRight'], Enter: [0x0D, 'Enter'], Escape: [0x1B, 'Escape'],
  };
  async function pressKeys(renderer, names, paceMs) {
    const pace = paceMs || 120;
    for (const name of names) {
      const key = NAMED_KEYS[name];
      if (!key) continue;
      const info = { code: key[1], location: 0, repeat: false };
      renderer.handleKeyDown(key[0], info);
      await new Promise(r => setTimeout(r, 120));
      renderer.handleKeyUp(key[0], info);
      await new Promise(r => setTimeout(r, pace));
    }
  }

  // Distinct colours in the game's window, sampled and capped at 65: enough
  // to tell a drawn menu from a boot screen without reading every pixel.
  function windowColours(renderer, wine) {
    try {
      const win = firstTopLevelWindow(renderer, wine);
      const surface = win && renderer.getWindowCanvas(win.hwnd);
      if (!surface || !surface.canvas) return 0;
      const c = surface.canvas;
      const d = surface.ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length && seen.size <= 64; i += 4 * 37) {
        seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      }
      return seen.size;
    } catch (_) { return 0; }
  }

  // A cheap fingerprint of the game's window: the same sparse sample
  // windowColours reads, hashed. Two equal readings mean nothing on screen
  // moved, which is what lets a menu script wait for the game instead of a
  // clock -- a clock long enough for a slow phone wastes seconds on a fast one.
  function windowFingerprint(renderer, wine) {
    try {
      const win = firstTopLevelWindow(renderer, wine);
      const surface = win && renderer.getWindowCanvas(win.hwnd);
      if (!surface || !surface.canvas) return 0;
      const c = surface.canvas;
      const d = surface.ctx.getImageData(0, 0, c.width, c.height).data;
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i += 4 * 37) {
        h = Math.imul(h ^ d[i] ^ (d[i + 1] << 8) ^ (d[i + 2] << 16), 16777619);
      }
      return h >>> 0;
    } catch (_) { return 0; }
  }

  // Waits for the window to hold still for `stableMs`, and with `change`
  // (a fingerprint taken earlier) for it to have moved off that first.
  // Answers whether it settled inside `maxMs`.
  async function settleWindow(renderer, wine, opts) {
    const o = opts || {};
    const stableMs = o.stableMs || 300;
    const deadline = Date.now() + (o.maxMs || 3000);
    let last = windowFingerprint(renderer, wine);
    let moved = o.change === undefined || last !== o.change;
    let still = Date.now();
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
      const now = windowFingerprint(renderer, wine);
      if (now !== last) { last = now; still = Date.now(); moved = true; continue; }
      if (moved && Date.now() - still >= stableMs) return true;
    }
    return false;
  }

  // lan.join.inGame is how a game joins from wherever it already is once it
  // is in somebody's room: Quake II's console, Blobby's session list. It is
  // told why the game was in the room's hands (`why`: 0 a toast joined a
  // running game; 1-4 what net_link_open was asked for -- 1 socket, 2
  // DirectPlay host, 3 join, 4 search; 5 the list at launch, so the game is
  // still booting), and gets the owner's seat, a guest-dword reader, a typist,
  // a key presser (`press` on a clock, `step` on the screen answering each
  // key), `settle` to wait for the window to stop moving, the frames this
  // machine has heard from the room, how many
  // colours its window shows (a drawn menu, not a black boot screen), and a
  // sleep. It answers whether it managed; if it did
  // not, or there is none, the chip names the game's own menu (lan.join.hint).
  // What a recipe (lan.join.inGame, lan.host.inGame) is handed to drive the
  // game with; see runJoinRecipe for each one.
  function recipeTools(wine, renderer, room, why) {
    return {
      why,
      host: room.owner ? room.owner.address : room.address,
      peek: va => {
        try {
          const wa = wine.instance.exports.guest_to_wasm(va >>> 0) >>> 0;
          return new DataView(wine.memory.buffer).getUint32(wa, true);
        } catch (_) { return null; }
      },
      type: text => typeIntoGame(renderer, text),
      press: (names, paceMs) => pressKeys(renderer, names, paceMs),
      // One key per name, each waiting for the screen to answer it and
      // settle before the next; false as soon as a key moves nothing.
      step: async (names, opts) => {
        for (const name of names) {
          const before = windowFingerprint(renderer, wine);
          await pressKeys(renderer, [name], 1);
          if (!await settleWindow(renderer, wine, Object.assign({ change: before }, opts))) return false;
        }
        return true;
      },
      settle: opts => settleWindow(renderer, wine, opts),
      frame: () => windowFingerprint(renderer, wine),
      colours: () => windowColours(renderer, wine),
      heard: () => room.wire.recvFrames || 0,
      sleep: ms => new Promise(r => setTimeout(r, ms)),
    };
  }

  // Keys sent before the game has a window go nowhere.
  async function waitForGameWindow(wine, renderer) {
    for (let i = 0; i < 60 && !firstTopLevelWindow(renderer, wine); i++) {
      await new Promise(r => setTimeout(r, 500));
    }
    return !wine._stopped;
  }

  // lan.host.inGame: the owner's twin of the join recipe, run when "Host a
  // new game" started the game over in a room of its own. It walks the game
  // from its first screen to hosting a match (Blobby's EIN SPIEL HOSTEN →
  // SPIEL BEGINNEN!), with the same tools. Without one, or if it gives up,
  // the chip names the menu with lan.host.hint, else lan.hint.
  async function runHostRecipe(wine, app, sel, room, log, renderer) {
    const host = (app.lan && app.lan.host) || {};
    let done = false;
    if (typeof host.inGame === 'function' && renderer) {
      if (!await waitForGameWindow(wine, renderer)) return false;
      showLanChip('● LAN · setting up a new game…', 8000);
      try { done = !!await host.inGame(recipeTools(wine, renderer, room, 0)); } catch (_) { done = false; }
      if (done) log.textContent += `LAN: ${sel} is hosting a new game\n`;
    }
    if (!done) {
      const hint = host.hint || (app.lan && app.lan.hint);
      showLanChip(`◌ LAN · room open${hint ? ` — ${hint}` : ' — host a game from its menus'}`, 30000);
    }
    return done;
  }

  async function runJoinRecipe(wine, app, sel, room, log, renderer, why) {
    const join = app.lan.join || {};
    let done = false;
    if (typeof join.inGame === 'function' && renderer) {
      if (!await waitForGameWindow(wine, renderer)) return false;
      showLanChip(`● LAN · joining ${room.owner.name}'s game…`, 8000);
      try {
        done = !!await join.inGame(recipeTools(wine, renderer, room, why));
      } catch (_) { done = false; }
      if (done) {
        showLanChip(`● LAN · in ${room.owner.name}'s game`, 8000);
        log.textContent += `LAN: joined ${room.owner.name}'s game from inside ${sel}\n`;
      }
    }
    const hint = done ? null : lanJoinHint(app, room);
    if (hint) showLanChip(`● LAN · in ${room.owner.name}'s room — ${hint}`, 15000);
    return done;
  }

  // What a member is told to do in the game's own menus: lan.join.hint, else
  // the lobby-era lan.hint, with {host} the owner's seat -- the address a
  // game that asks for its server (TetriNET, Liquid War) has to be given.
  function lanJoinHint(app, room) {
    const lan = app.lan || {};
    const hint = (lan.join && lan.join.hint) || lan.hint;
    if (!hint) return null;
    return room && room.owner ? hint.replace(/\{host\}/g, room.owner.address) : hint;
  }

  // Whether this machine's game is serving, read from the guest itself for a
  // hostProbe of protocol 'serving' (lib/vlan-star.js): a TCP listener on
  // spec.listen, or a DDE service for spec.dde. null until there is a guest.
  function gameServing(wine, spec) {
    const x = wine && wine.instance && wine.instance.exports;
    if (!x) return null;
    if (spec.dde) return typeof x.dde_serving === 'function' ? !!x.dde_serving() : null;
    return typeof x.net_listening === 'function' ? !!x.net_listening(spec.listen | 0) : null;
  }

  // Somebody starts hosting after this game is already running offline: a
  // toast, once per owner, that gives up on its own. The game is past its
  // command line by now, so joining puts it in the room and then either
  // runs lan.join.inGame against it or names the menu with lan.join.hint.
  function startLanOffers(wine, app, sel, log, renderer) {
    const seen = new Set();
    let looking = false;
    const busy = () => wine._lanRoom || looking
      || (wine._lanAsk && wine._lanAsk.state === 'asking')
      || document.getElementById('wine-lan-card');
    const tick = async () => {
      if (busy()) return;
      looking = true;
      try {
        let rooms;
        try {
          rooms = await withTimeout(VlanRoom.hostedRooms({ join: { exe: app.lan.exe || sel } }), 5000);
        } catch (e) {
          return;   // offline or slow: worth another look
        }
        const owner = firstHosted(rooms.filter(r => !seen.has(r.userId)));
        if (!owner || wine._lanRoom) return;
        seen.add(owner.userId);
        if (await askToJoin(owner, app, { toast: true, signedOut: rooms.signedOut }) !== 'join'
          || wine._lanRoom) return;
        // Signed out, the list was read from public records; joining it
        // needs an account, so sign in and come back to that room's link.
        if (rooms.signedOut) { signInToJoin(sel, owner); return; }
        const room = await joinRoomWithDialog(app, sel, log, owner);
        if (!room) return;
        if (wine._stopped) { room.close(); return; }
        adoptLanRoom(wine, room, app, sel, log, renderer);
        if (wine._lanAsk) wine._lanAsk.state = 'done';
        wine.joinVlan(room.wire, room.address);
        if (room.role !== 'member') return;
        await runJoinRecipe(wine, app, sel, room, log, renderer, 0);
      } catch (e) {
        log.textContent += `LAN: could not join: ${e && e.message ? e.message : e}\n`;
      } finally {
        looking = false;
      }
    };
    wine._lanOffers = setInterval(tick, 20000);
    // A room this game was in has ended: offer its owner again (they may
    // be back, or never left -- the drop may have been ours) and look now
    // rather than up to twenty seconds from now.
    wine._lanOfferAgain = ownerId => {
      if (ownerId) seen.delete(ownerId);
      tick();
    };
  }

  // The one place a running game takes a room, so every path hears the room
  // end the same way. A member whose room ended -- the owner quit, or either
  // side's connection gave up (a Wi-Fi blip, a phone put to sleep) -- used to
  // keep the dead room forever: the offers saw a game already in a room and
  // stayed quiet, and they had already marked that owner as seen. Now the
  // room is dropped and the offers pick that owner up again, which is how a
  // phone coming back from the background gets back into the game.
  function adoptLanRoom(wine, room, app, sel, log, renderer) {
    wine._lanRoom = room;
    attachLanChip(wine, room, app, sel);
    if (room.probe) room.probe.serving = spec => gameServing(wine, spec);
    room.onEnded = () => {
      if (lanChip.room === room) removeLanChip();
      if (wine._lanRoom !== room) return;
      wine._lanRoom = null;
      if (wine._stopped || room.role !== 'member' || !app.lan || app.lan.room !== 'auto') return;
      if (!wine._lanOffers) startLanOffers(wine, app, sel, log, renderer);
      if (wine._lanOfferAgain) wine._lanOfferAgain(room.owner && room.owner.userId);
    };
  }

  // "Has this guest put anything on screen yet?" — the bottom window it owns
  // that is visible, real-sized and not a child control. Two callers ask this
  // and they must agree: the single-app maximizer needs the window it is about
  // to resize, and the boot cursor needs the moment the app stops looking
  // dead. Both are polls because nothing notifies us — the window is created
  // by the guest, mid-run-slice, long after launchApp returns.
  //
  // Ownership is the process, not the wasm instance: a window created from a
  // guest thread is owned by that thread's instance (create_window records
  // ctx.instance), so NFS III's 640x480 game window never matched
  // `wine.instance` and the launch window sat on top of a running race.
  function ownedByWine(w, wine) {
    return w.wasm === wine.instance ||
      (wine.processId != null && w.processId === wine.processId);
  }

  function firstTopLevelWindow(renderer, wine) {
    if (!renderer || !wine) return null;
    return Object.values(renderer.windows || {})
      .filter(w => w && w.visible && !w.isChild && w.w > 0 && w.h > 0 &&
        ownedByWine(w, wine))
      .sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0))[0] || null;
  }

  // deps.apps            — the shared registry (lib/apps.js)
  // deps.debugMode       — ?debug: keeps the HTML desktop visible behind the guest
  // deps.screenCanvasSize() — the page's canvas sizing policy
  // deps.appendDebugLog(text) — write a line into the debug log pane
  // deps.onStopAll()     — page cleanup after the last guest is gone
  // Bind each reporter to the owning instance. The shell's current `wine`
  // changes when another app launches, while the first app can still save.
  function persistenceFlushReporter(wine, appId, log, runningApps) {
    return report => {
      const previous = wine._vfsPersistenceWarning;
      const warning = report.pending
        ? `${appId}: ${report.pending} save file(s) not saved to this browser. Export a backup.`
        : '';
      wine._vfsPersistenceWarning = warning;
      const status = document.getElementById('status');
      if (warning) {
        if (status) status.textContent = warning;
        if (warning !== previous) log.textContent += warning + '\n';
      } else if (previous) {
        if (status && status.textContent === previous) {
          status.textContent = runningApps.map(running => running.wine && running.wine._vfsPersistenceWarning)
            .find(Boolean) || (runningApps.length ? `Running ${runningApps.length} app(s)` : 'Ready');
        }
        log.textContent += `${appId}: pending save files saved to this browser.\n`;
      }
    };
  }

  function createBrowserShell(deps) {
    const apps = deps.apps;
    // Registry ids whose files this host does not serve (the local-only
    // candidates, on the deployed site). Nothing may launch them by exe name.
    const unservedApps = new Set(deps.unservedApps || []);
    const resolveRunSlice = deps.resolveRunSlice;
    const DEBUG_MODE = !!deps.debugMode;
    const screenCanvasSize = deps.screenCanvasSize;
    const appendDebugLog = deps.appendDebugLog || (() => {});
    const onStopAll = deps.onStopAll || (() => {});
    // A small screen: one guest owns the page. The desktop cannot launch a
    // second app while one runs, and the app is given the whole screen — see
    // maximizeForSingleApp below and Win98Renderer._computeSingleAppZoom.
    // The page re-decides this whenever the window is resized, so read it
    // through the callback rather than latching it here.
    const SINGLE_APP = () => (typeof deps.singleApp === 'function'
      ? !!deps.singleApp() : !!deps.singleApp);
    const onAppRunningChange = deps.onAppRunningChange || (() => {});
    // The launch window (lib/launch-progress.js) and what it needs from the
    // page: a display name, an icon, whether this page is a direct ?app=
    // link that owns the whole screen, and the way back to the desktop.
    const launchUi = deps.launchUi || null;
    const appLabelFor = deps.appLabel || (id => id);
    const appIconFor = deps.appIcon || (() => '');
    const isDirectLaunch = deps.directLaunch || (() => false);
    const onShowDesktop = deps.onShowDesktop || (() => {});

    let wine = null;
    let lastExitedVfs = null;
    let lastExitedRunSliceAppKey = null;
    const runningApps = [];  // array of { wine, name, appIndex }
    let nextAppIndex = 0;
    let sharedRenderer = null;
    // The appIndex the presentation view mode was last reset for; see
    // syncTouchControls.
    let lastViewModeRun = null;
    const sharedAudioMixer = {};
    const OVERLAY_FLUSH_MS = 2000;

    function overlayLog(message, failed) {
      appendDebugLog(message);
      if (failed) console.error(message); else console.log(message);
    }

    function flushBrowserOverlay(wine, reason) {
      const overlay = wine && wine._vfsOverlay;
      if (!overlay || !overlay.dirtyPaths().length) return Promise.resolve(null);
      return overlay.flush().then(report => {
        const failed = (report.failed | 0) > 0;
        overlayLog(`[overlay] ${reason}: persisted ${report.written | 0} change(s)` +
          (failed ? `, ${report.failed | 0} failed` : ''), failed);
        return report;
      }, error => {
        overlayLog(`[overlay] ${reason} failed: ${error && error.message || error}`, true);
        return null;
      });
    }

    function stopBrowserOverlay(wine) {
      if (!wine) return;
      if (wine._vfsOverlayTimer) clearInterval(wine._vfsOverlayTimer);
      wine._vfsOverlayTimer = null;
      // A session import already owns its changed bytes in this live VFS.
      // Serializing that same tree into the in-memory store cannot make it
      // survive a reload; on installers it only clones the growing multi-MB
      // output files once more on the UI thread. Only durable OPFS journals
      // need a final store flush.
      if (wine._vfsOverlayDurable) void flushBrowserOverlay(wine, 'stop');
    }

    async function attachDynamicOverlay(wine, app, appId) {
      if (!app.dynamic) return null;
      if (!window.VfsOverlay || !window.OverlayStore) {
        throw new Error(`${appId}: writable import overlay modules are not loaded`);
      }
      const vfs = wine._helpCtx && wine._helpCtx.vfs;
      if (!vfs) throw new Error(`${appId}: the guest has no VFS for its writable overlay`);

      const durable = app.badge === 'kept' && !!app.mediaId;
      let store;
      if (durable) {
        store = window.OverlayStore.opfsStore(app.mediaId, {
          log: message => overlayLog(message, false),
        });
        // Open before wrapping the VFS. If OPFS became unavailable since the
        // media library was restored (private mode/quota revocation), the app
        // still runs with an explicitly session-only journal instead of
        // half-attaching a durable store that can never hydrate or flush.
        try {
          await store.list();
        } catch (error) {
          overlayLog(`[overlay] ${appId}: browser storage unavailable; ` +
            `writable C: changes are session-only (${error && error.message || error})`, true);
          store = null;
        }
      }
      if (!store) {
        if (!app._sessionOverlayStore) app._sessionOverlayStore = window.OverlayStore.memoryStore();
        store = app._sessionOverlayStore;
      }

      const overlay = window.VfsOverlay.attach(vfs, {
        store,
        log: message => overlayLog(message, false),
      });
      const hydrated = await overlay.hydrate();
      wine._vfsOverlay = overlay;
      wine._vfsOverlayDurable = store.kind === 'opfs';
      // Shortcuts this process leaves behind may outlive the page only when
      // its C: changes land in this kept media's OPFS journal.
      wine._keptMediaId = wine._vfsOverlayDurable ? app.mediaId : null;
      wine._flushVfsOverlay = reason => flushBrowserOverlay(wine, reason || 'checkpoint');
      // Session imports hand their live VFS directly to an installed child,
      // so checkpointing them to another in-memory copy buys no durability.
      // A WISE installer rewrites its current .pak on every copy slice; the
      // old two-second timer repeatedly cloned that whole growing file and
      // made Safari appear hung. Kept imports still checkpoint to OPFS.
      wine._vfsOverlayTimer = wine._vfsOverlayDurable ? setInterval(() => {
        void flushBrowserOverlay(wine, 'checkpoint');
      }, OVERLAY_FLUSH_MS) : null;
      overlayLog(`[overlay] ${appId}: ${store.kind === 'opfs' ? 'restored' : 'opened session'} ` +
        `${hydrated.files} file(s), ${hydrated.dirs} dir(s), ` +
        `${hydrated.whiteouts} whiteout(s)`, hydrated.errors.length > 0);
      return overlay;
    }

    // One segment for every instance in this tab that chose "both players
    // here". It is the same wire the RTC lobby hands back, minus the network:
    // LoopbackSegment broadcasts each frame to every other endpoint, and the
    // room switch in WAT does the addressing exactly as it does over WebRTC.
    // Sequential addresses are safe because this segment reaches nobody else.
    let pageSegment = null;
    let nextLocalHost = 1;
    function joinPageSegment() {
      if (!pageSegment) pageSegment = new VlanWire.LoopbackSegment();
      return {
        wire: pageSegment.attach(),
        address: `10.0.0.${nextLocalHost++}`,
        local: true,
      };
    }

    // On-screen buttons for keyboard-driven guests (lib/touch-controls.js).
    // Inert on a pointer device and for any app with no `touchControls` in the
    // registry, so this is a call at every lifecycle edge rather than a branch
    // at each of them.
    function syncTouchControls() {
      const tc = typeof window !== 'undefined' ? window.TouchControls : null;
      if (tc) tc.sync(runningApps, sharedRenderer);
      // Zoom (fill) mode needs to know which part of the window is worth
      // filling with; the mode itself resets with the app, so a game left in
      // zoom does not hand the next one a crop of somebody else's window.
      if (sharedRenderer) {
        const last = runningApps.length ? runningApps[runningApps.length - 1] : null;
        const crop = last && last.mobileCrop ? last.mobileCrop : null;
        // Only an app with an intentional alternate crop and an enabled view
        // control may enter Fill. A hidden chip alone left pinch gestures able
        // to crop the other desktop apps' controls and HUD.
        sharedRenderer.allowViewZoom = !!(crop && last && last.touchControls &&
          last.touchControls.viewToggle !== false);
        // Keyed on the RUN, not on the crop object. `mobileCrop` comes
        // straight out of the registry, so relaunching the same app hands
        // over the identical object and this test used to be false -- which
        // meant the view mode survived a stop/launch cycle. Pinball then came
        // back up in Fill because somebody had tapped the chip in a previous
        // run, reported as "start portrait pinball in Fit mode already". Every
        // launch is a fresh appIndex, so keying on it resets once per launch
        // and still never resets mid-run.
        const runKey = last ? last.appIndex : null;
        if (sharedRenderer.mobileCrop !== crop || lastViewModeRun !== runKey) {
          lastViewModeRun = runKey;
          sharedRenderer.mobileCrop = crop;
          if (sharedRenderer.setViewMode) sharedRenderer.setViewMode('fit');
          // The overlay was synced above, BEFORE this line -- so whatever it
          // decided about the fit/fill chip it decided against the previous
          // app's crop (or against none at all, on the first launch). Tell it
          // again now that the crop is the one belonging to the app it is
          // showing controls for.
          if (tc && tc.installed && typeof tc.syncViewMode === 'function') tc.syncViewMode();
        }
        // Whether maximizing this app means "the whole canvas" or "the largest
        // rect at its own aspect ratio" -- see Win98Renderer._singleAppMaximizeRect.
        // A NUMBER is a target client aspect (w/h) and is passed through as a
        // number; anything else is the plain "keep the natural aspect" flag.
        sharedRenderer.singleAppKeepAspect =
          (last && typeof last.keepAspect === 'number' && last.keepAspect > 0)
            ? last.keepAspect : !!(last && last.keepAspect);
        sharedRenderer.exclusiveCrop = last && last.exclusiveCrop
          ? last.exclusiveCrop : null;
        sharedRenderer.singleAppMdiCrop = !!(last && last.mdiCrop);
        // How many phone pixels one guest pixel is worth for this app. Read
        // by singleAppBackingSize, which is called from screenCanvasSize() --
        // and resizeCanvas() runs at the bottom of this same function, so the
        // desktop is re-measured with the new factor before the guest asks
        // for SM_CXSCREEN.
        sharedRenderer.singleAppZoom = (last && last.mobileZoom) || null;
        // The smallest desktop this app may start on (registry
        // `singleAppMinDesktop`), applied by the same re-measure.
        sharedRenderer.singleAppMinDesktop = (last && last.singleAppMinDesktop) || null;
      }
      if (tc && tc.syncViewMode) tc.syncViewMode();
      // Widgets appearing or leaving changes how much of the phone is stage,
      // and the guest's desktop is sized to the stage (singleAppStageShare).
      // Nothing else re-measures on a layout swap, so without this the first
      // app to launch keeps the desktop the empty screen was sized for.
      if (typeof window !== 'undefined' && typeof window.resizeCanvas === 'function') {
        window.resizeCanvas();
      }
    }

    function snapshotVfs(vfs) {
      if (!vfs || typeof vfs._normPath !== 'function' || !(vfs.files instanceof Map)) {
        return null;
      }
      const normPath = vfs._normPath;
      const resolvePath = vfs._resolvePath;
      const snapshot = {
        files: new Map(vfs.files),
        dirs: new Set(vfs.dirs || []),
        readOnlyDrives: new Set(vfs.readOnlyDrives || []),
        cwd: vfs.cwd,
        // The entries are shared, so their identities must be too: without
        // this the adopting process has no identity map at all, and its first
        // CREATE_ALWAYS over an existing file threw (NFS II's installer copies
        // FeData\pc\text twice and reported "Error creating directory!").
        _fileIdentity: vfs._fileIdentity,
        _normPath(fileName) { return normPath.call(this, fileName); },
      };
      if (typeof resolvePath === 'function') {
        snapshot._resolvePath = function(fileName) {
          return resolvePath.call(this, fileName);
        };
      }
      for (const mapName of ['volumeLabels', 'volumeSerials', 'driveTypes', 'volumeSizes']) {
        if (vfs[mapName] instanceof Map) snapshot[mapName] = new Map(vfs[mapName]);
      }
      return snapshot;
    }

    function unregisterRunningApp(wine) {
      if (sharedRenderer && sharedRenderer.setInputHooks && wine) {
        sharedRenderer.setInputHooks(wine.processId, null);
      }
      const index = runningApps.findIndex(running => running && running.wine === wine);
      if (index >= 0) {
        // Preserve the installed machine after its process exits. This copies
        // only VFS maps and path semantics, not the guest's 512MB WASM memory.
        const vfs = wine && wine._helpCtx && wine._helpCtx.vfs;
        const snapshot = snapshotVfs(vfs);
        if (snapshot) {
          lastExitedVfs = snapshot;
          lastExitedRunSliceAppKey = wine._runSliceAppKey || null;
          publishGuestShortcuts(snapshot, wine);
        }
        runningApps.splice(index, 1);
      }
      syncTouchControls();
      const status = document.getElementById('status');
      const unsaved = wine._vfsPersistenceWarning || runningApps
        .map(running => running.wine && running.wine._vfsPersistenceWarning).find(Boolean);
      if (status) status.textContent = unsaved || (runningApps.length
        ? `Running ${runningApps.length} app(s)`
        : 'Ready');
      if (typeof window.updateThreadsStatus === 'function') window.updateThreadsStatus();
      onAppRunningChange(runningApps.length > 0);
      dispatchPendingLaunch();
    }

    function stopRunningApp(running, repaint) {
      if (!running || !running.wine) return;
      if (running.wine._vfsPersistence) running.wine._vfsPersistence.flush();
      if (typeof running.wine.stop === 'function') running.wine.stop({ repaint: false });
      else {
        running.wine.running = false;
        if (running.wine._cleanupAudio) running.wine._cleanupAudio();
        if (running.wine._removeAppWindows) running.wine._removeAppWindows();
      }
      unregisterRunningApp(running.wine);
      if (repaint !== false && sharedRenderer) sharedRenderer.repaint();
    }

    function stopAllApps() {
      for (const app of [...runningApps]) stopRunningApp(app, false);
      runningApps.length = 0;
      syncTouchControls();
      if (sharedRenderer) {
        sharedRenderer.windows = {};
        sharedRenderer.repaint();
      }
      onStopAll();
      onAppRunningChange(false);
    }

    // Navigation is not an ordinary app close. In particular, iOS Safari can
    // put the old document into its page cache immediately after pagehide,
    // before stop()'s zero-delay memory-release timer gets a turn. The next
    // document then tries to allocate another fixed 512MB shared memory and
    // fails before the guest executes. Include `wine` because a page can hide
    // while init() is in flight, before that host reaches runningApps.
    function releaseForPageHide() {
      pendingAppLaunches.length = 0;
      const guests = new Set(runningApps.map(app => app && app.wine).filter(Boolean));
      if (wine) guests.add(wine);
      for (const guest of guests) {
        try { guest.stop({ repaint: false, releaseNow: true }); } catch (_) {
          // A partially initialized host may not have every teardown helper,
          // but any memory it did allocate still has to be detached now.
          try { if (guest._releaseGuestMemory) guest._releaseGuestMemory(); } catch (_) {}
        }
      }
      runningApps.length = 0;
    }

    function clearUnownedDisplayMode() {
      if (runningApps.length) return;
      if (sharedRenderer) {
        sharedRenderer._exclusiveFullscreen = false;
        sharedRenderer._exclusiveTransform = null;
        sharedRenderer._exclusivePresentationViewport = null;
        sharedRenderer._exclusivePresentationSource = null;
        sharedRenderer._requestedBrowserFullscreen = false;
        sharedRenderer._fullscreenDeclined = false;
      }
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('exclusive-fullscreen', 'page-fullscreen');
      }
    }

    // Single-app mode: give the app the whole screen the way Windows would —
    // by maximizing it, not by stretching it. A window that can be maximized
    // (WS_MAXIMIZEBOX or a sizing border) relays out at the phone's aspect
    // ratio and stays pixel-exact; one that cannot (Minesweeper, Solitaire's
    // fixed board) is left alone and the renderer zooms it instead.
    //
    // The window does not exist yet when launchApp returns, so this polls for
    // the first top-level window this instance owns, the same way
    // scheduleStartupDialogDismiss waits for a startup dialog.
    const WS_MAXIMIZEBOX = 0x00010000;
    const WS_THICKFRAME = 0x00040000;

    // "Has this guest put anything on screen yet?" — the bottom window it owns
    // that is visible, real-sized and not a child control. Two callers ask
    // this and they must agree: the single-app maximizer needs the window it
    // is about to resize, and the boot cursor needs the moment the app stops
    // looking dead. Both are polls because nothing notifies us: the window is
    // created by the guest, mid-run-slice, long after launchApp returns.
    function maximizeForSingleApp(wine) {
      if (!SINGLE_APP() || !wine || !sharedRenderer) return;
      const e = wine.instance && wine.instance.exports;
      if (!e || !e.send_message) return;
      let tries = 0;
      const timer = setInterval(() => {
        // A startup dialog (SimCity 2000's "Video Warning") holds the main
        // window back until the user answers it, which takes as long as it
        // takes. Time spent waiting on one does not count against the budget,
        // or the main window arrives after the poll has given up and stays
        // at its CW_USEDEFAULT size on the phone.
        const waitingOnDialog = Object.values(sharedRenderer.windows || {})
          .some(w => w && w.wasm === wine.instance && w.visible && w.isDialog);
        if (!waitingOnDialog) tries++;
        if (!runningApps.some(r => r && r.wine === wine)) { clearInterval(timer); return; }
        // A game that selected a display mode owns its native geometry.
        // Auto-maximizing its window would turn rotation into a guest resize.
        if (sharedRenderer._exclusiveFullscreen) { clearInterval(timer); return; }
        const win = Object.values(sharedRenderer.windows || {})
          .filter(w => w && w.wasm === wine.instance && w.visible &&
            !w.isChild && !w.isDialog && !sharedRenderer._windowOwnerHwnd(w) &&
            !(w.style & 0x80000000) && (w.style & (WS_MAXIMIZEBOX | WS_THICKFRAME)) &&
            w.w > 0 && w.h > 0)
          .sort((a, b) => (a.zOrder || 0) - (b.zOrder || 0))[0];
        if (win) {
          clearInterval(timer);
          const style = win.style >>> 0;
          // Registry `singleAppMaximize: false`: the app's maximize box picks
          // one of its own fixed layouts instead of relaying out to the client
          // rect, so maximizing it on a phone-shaped desktop is a mistake --
          // Snood answers SC_MAXIMIZE by recreating itself at its 936x735
          // "Huge" layout on a 600-wide portrait desktop and the board runs
          // off the screen. Treat it like a fixed window: leave it at its own
          // size and let the renderer zoom it.
          const record = runningApps.find(r => r && r.wine === wine);
          const mayMaximize = !record || record.singleAppMaximize !== false;
          const resizable = mayMaximize && !!(style & (WS_MAXIMIZEBOX | WS_THICKFRAME));
          if (resizable && sharedRenderer.prepareSingleAppMaximize(win)) {
            // Grow the logical desktop BEFORE SC_MAXIMIZE delivers WM_SIZE.
            // Presentation still fits that desktop onto the physical phone.
            if (typeof window.resizeCanvas === 'function') window.resizeCanvas();
          }
          // "Already as big as we are going to make it." For a keepAspect app
          // that is not the full canvas but the fitted rect, and the guest
          // starts out smaller than it, so the command still has to be sent.
          const keepAspect = !!sharedRenderer.singleAppKeepAspect;
          const alreadyFull = !keepAspect && win.x <= 0 && win.y <= 0 &&
            win.w >= sharedRenderer.canvas.width && win.h >= sharedRenderer.canvas.height;
          if (resizable && !alreadyFull) {
            // WM_SYSCOMMAND / SC_MAXIMIZE. It goes to the app's own wndproc
            // first, so an app that tracks its own maximized state sees the
            // command rather than just a surprise WM_SIZE.
            e.send_message(win.hwnd | 0, 0x0112, 0xF030, 0);
          }
          const how = !resizable ? 'zoomed' : (keepAspect ? 'fitted to its aspect' : 'maximized');
          appendDebugLog(`Single-app mode: ${how} ` +
            `hwnd=0x${(win.hwnd >>> 0).toString(16)} ${win.w}x${win.h}`);
        } else if (tries >= 120) {
          clearInterval(timer);
        }
      }, 50);
    }

    // Registry `mdiCrop` (see Win98Renderer._mdiCropRect): the phone shows
    // an MDI app as its menu bar and MDICLIENT, so the document window inside
    // should fill that client the way a user would make it -- maximized, its
    // caption folded into the frame's menu bar. Each MDI child is maximized
    // once, when it first becomes the active one; a child the user restores
    // afterwards is left restored. Polls for the life of the run because an
    // MDI app opens its documents long after its frame (SimCity 2000 creates
    // the city window only once a city is loaded).
    function maximizeMdiChildrenForSingleApp(wine) {
      if (!SINGLE_APP() || !wine || !sharedRenderer) return;
      const e = wine.instance && wine.instance.exports;
      if (!e || !e.send_message || !e.wnd_is_maximized) return;
      const done = new Set();
      const timer = setInterval(() => {
        if (!runningApps.some(r => r && r.wine === wine)) { clearInterval(timer); return; }
        if (sharedRenderer._exclusiveFullscreen) return;
        for (const client of Object.values(sharedRenderer.windows || {})) {
          if (!client || client.wasm !== wine.instance || !client.isChild || !client.visible ||
              String(client.className || '').toLowerCase() !== 'mdiclient') continue;
          const child = e.send_message(client.hwnd | 0, 0x0229, 0, 0) >>> 0; // WM_MDIGETACTIVE
          if (!child || done.has(child)) continue;
          done.add(child);
          if (!e.wnd_is_maximized(child)) {
            e.send_message(client.hwnd | 0, 0x0225, child, 0); // WM_MDIMAXIMIZE
            appendDebugLog(`Single-app mode: maximized MDI child hwnd=0x${child.toString(16)}`);
          }
        }
      }, 500);
    }

    // Booting is invisible, and that reads as broken. Between the click and
    // the app's first window there is a PE to stage, up to 76 data files to
    // fetch (RollerCoaster Tycoon) and a DLL graph to walk, and the desktop
    // shows nothing at all while it happens — the status text lives in the
    // debug toolbar, which is hidden on the live site. Windows answered this
    // with the AppStarting cursor, so the page does too: `progress` is the
    // arrow-plus-hourglass, not the fully-busy `wait`, because the desktop
    // stays live underneath.
    //
    // The boot is over when the guest paints its first top-level window, not
    // when launchApp returns — launchApp is done long before the guest has
    // run a single instruction. Counted rather than a boolean because a
    // ShellExecute hand-off (WRITE.EXE -> WordPad) can have two boots in
    // flight, and the first one to finish must not clear the other's cursor.
    const onAppBootingChange = deps.onAppBootingChange || (() => {});
    let bootsInFlight = 0;
    function beginBoot() {
      bootsInFlight++;
      if (bootsInFlight === 1) onAppBootingChange(true);
    }
    function endBoot() {
      if (bootsInFlight <= 0) return;
      bootsInFlight--;
      if (bootsInFlight === 0) onAppBootingChange(false);
    }
    // Every launch path has to reach exactly one endBoot: the LAN-lobby
    // cancel, both failure branches, and the success path below. This makes
    // that safe to call more than once per launch.
    function bootTicket() {
      let spent = false;
      beginBoot();
      return () => { if (!spent) { spent = true; endBoot(); } };
    }
    // Success path: hold the cursor until there is something to look at. An
    // app that dies or is stopped before it ever shows a window releases it
    // too, otherwise the desktop would keep an hourglass over nothing.
    //
    // done(reason): 'window' when the first top-level window is up, otherwise
    // 'stopped' / 'timeout'. Checked every animation frame as well as on the
    // 100ms timer, so the launch window comes down on the frame the app's
    // window arrives rather than up to 100ms later; the timer is what still
    // runs in a background tab, where frames do not.
    function releaseBootCursorOnFirstWindow(wine, done) {
      if (!wine || !sharedRenderer) { done('stopped'); return; }
      let tries = 0;
      let finished = false;
      const finish = reason => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        done(reason);
      };
      const check = () => {
        if (finished) return true;
        if (firstTopLevelWindow(sharedRenderer, wine)) { finish('window'); return true; }
        if (!runningApps.some(r => r && r.wine === wine)) { finish('stopped'); return true; }
        return false;
      };
      const timer = setInterval(() => {
        tries++;
        // 100ms * 6000 = 10 minutes. Not a deadline for the app, just a
        // guarantee that a wedged guest cannot leave a cursor behind forever.
        if (!check() && tries >= 6000) finish('timeout');
      }, 100);
      if (typeof requestAnimationFrame === 'function') {
        const frame = () => { if (!check()) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      }
    }

    // ---- the launch window ------------------------------------------------
    //
    // One context per launch: its window (shown only if the launch is still
    // pending 500ms after it was asked for -- lib/launch-progress.js), its
    // Cancel, and the bytes a Retry may reuse. `startedAt` is the moment the
    // user asked; for a direct ?app= link that is navigation start, which is
    // why such a launch adopts the window index.html began at page load.
    function createLaunchContext(sel, app, launchOpts) {
      const opts = launchOpts || {};
      const ctx = {
        sel,
        cancelled: false,
        registered: false,
        wine: null,
        abort: typeof AbortController !== 'undefined' ? new AbortController() : null,
        retained: opts.retained || new Map(),
        launch: null,
        transfer: null,
      };
      // A child process a guest started (host.js process_spawn) has no
      // launch window: it is part of its parent, not something the user ran.
      if (!launchUi || opts.hidden) return ctx;
      const direct = isDirectLaunch();
      const handlers = {
        cancel: () => cancelLaunch(ctx),
        retry: previous => {
          void launchApp(sel, { retryOf: previous, retained: ctx.retained });
        },
        closed: () => { ctx.retained.clear(); if (isDirectLaunch()) onShowDesktop(); },
        showDesktop: () => { ctx.retained.clear(); onShowDesktop(); },
        again: () => { void launchApp(sel); },
      };
      const info = {
        appId: sel,
        label: appLabelFor(sel, app),
        iconUrl: appIconFor(sel, app),
        mode: direct ? 'direct' : 'desktop',
        windowed: !direct && !SINGLE_APP(),
        handlers,
      };
      const intent = opts.directIntent;
      if (intent && intent.status === 'pending' && launchUi.current === intent && intent.appId === sel) {
        intent.setInfo(info);
        ctx.launch = intent;
      } else {
        ctx.launch = launchUi.begin(Object.assign(info, {
          startedAt: opts.startedAt,
          retryOf: opts.retryOf || null,
        }));
      }
      ctx.transfer = {
        signal: ctx.abort ? ctx.abort.signal : undefined,
        retained: ctx.retained,
        onTransfer: evt => ctx.launch.transfer(evt),
      };
      return ctx;
    }

    // A launch window that owns the page (a direct link, a phone) holds the
    // keyboard on its Cancel; the guest canvas gets it back when the window
    // closes (index.html wineLaunchUiRestoreFocus). A desktop launch window
    // never takes the keyboard, so there the canvas is focused as before.
    function focusCanvasForLaunch(canvas) {
      const shown = launchUi && launchUi.onScreen;
      if (shown && !shown.windowed) return;
      canvas.focus();
    }

    function launchCancelledError() {
      const e = new Error('Launch cancelled');
      e.name = 'AbortError';
      return e;
    }

    // Between awaits that cannot be aborted (the wasm compile, a DLL init).
    function throwIfCancelled(ctx) {
      if (ctx && ctx.cancelled) throw launchCancelledError();
    }

    function cancelLaunch(ctx) {
      if (!ctx || ctx.cancelled) return;
      ctx.cancelled = true;
      appendDebugLog(`Launch of ${ctx.sel} cancelled`);
      if (ctx.abort) ctx.abort.abort();
      ctx.retained.clear();
      if (ctx.registered) {
        // Already running, still waiting for its first window: stop it the
        // way closing it would. Its boot cursor goes with it.
        const running = runningApps.find(r => r && r.wine === ctx.wine);
        if (running) stopRunningApp(running, true);
      }
      // Say so now, even when the launch is parked in an await that cannot be
      // interrupted; it notices at its next checkpoint and cleans up quietly.
      if (ctx.launch) ctx.launch.cancelled();
    }

    // What each app is made of, and which ones get a desktop icon: lib/apps.js.
    function hasWasmTailCalls() {
      return typeof WineAssembly === 'undefined' ||
        !WineAssembly.supportsWasmTailCalls ||
        WineAssembly.supportsWasmTailCalls();
    }

    function selectedRunSlice(appKey, workerMode = false) {
      const compatDispatch = !hasWasmTailCalls();
      const autoSlice = typeof resolveRunSlice === 'function'
        ? resolveRunSlice(appKey, compatDispatch, workerMode)
        : 100000;
      const select = document.getElementById('slice-size-select');
      const raw = select && select.value ? select.value : 'auto';
      if (raw !== 'auto') {
        const selected = parseInt(raw, 10);
        // Authoritative on every engine: the 8ms cooperative deadline bounds
        // a step whatever the budget, so there is nothing left to clamp.
        if (Number.isFinite(selected) && selected > 0) return selected;
      }
      return autoSlice;
    }

    function applyRunSlice() {
      const applied = [];
      for (const app of runningApps) {
        app.wine.stepsPerSlice = selectedRunSlice(
          app.runSliceAppKey || app.name, !!app.wine.guestWorker);
        applied.push(`${app.name}:${app.wine.stepsPerSlice}`);
      }
      if (applied.length) {
        appendDebugLog(`Run slice updated: ${applied.join(', ')}`);
      }
    }
    function scheduleStartupDialogDismiss(app, wine) {
      const pending = app && (app.dismissStartupDialogs || app.dismissStartupDialog);
      const configs = Array.isArray(pending) ? pending.slice() : (pending ? [pending] : []);
      if (!configs.length || !wine || !sharedRenderer || !wine.hasGuestExport) return;
      let tries = 0;
      const maxTries = Math.max(...configs.map(cfg => cfg.tries || 80));
      const intervalMs = Math.min(...configs.map(cfg => cfg.intervalMs || 50));
      const timer = setInterval(() => {
        tries++;
        const stillRunning = runningApps.some(r => r && r.wine === wine);
        const dialogs = Object.values(sharedRenderer.windows || {})
          .filter(w => w && w.visible && w.isDialog)
          .sort((a, b) => (b.zOrder || 0) - (a.zOrder || 0));
        const idx = configs.findIndex(cfg =>
          dialogs.some(w => !cfg.title || String(w.title || '').includes(cfg.title)));
        if (idx >= 0) {
          const cfg = configs[idx];
          const dlg = dialogs.find(w => !cfg.title || String(w.title || '').includes(cfg.title));
          const control = Number(cfg.control);
          if (Number.isFinite(control)) {
            if (!wine.hasGuestExport('click_dialog_control')) return;
            Promise.resolve(wine.callGuest(
              'click_dialog_control', dlg.hwnd | 0, control | 0)).catch(() => {});
          } else if (wine.hasGuestExport('send_message')) {
            Promise.resolve(wine.callGuest(
              'send_message', dlg.hwnd | 0, 0x0111, cfg.command || 1, 0)).catch(() => {});
          }
          configs.splice(idx, 1);
          if (!configs.length) clearInterval(timer);
        } else if (!stillRunning || tries >= maxTries) {
          clearInterval(timer);
        }
      }, intervalMs);
    }

    // A few period games begin with an optional codec-driven movie which can
    // be skipped from the keyboard. Keep that compatibility policy in the app
    // registry, but enqueue the key through the normal renderer input path so
    // cooperative guests and real guest Workers observe identical messages.
    function scheduleStartupInput(app, wine) {
      const pending = app && app.startupInput;
      const configs = Array.isArray(pending) ? pending.slice() : (pending ? [pending] : []);
      if (!configs.length || !wine || !sharedRenderer) return;
      for (const cfg of configs) {
        const vk = Number(cfg && cfg.vk);
        if (!Number.isFinite(vk)) continue;
        const delayMs = Math.max(0, Number(cfg.delayMs) || 0);
        const holdMs = Math.max(1, Number(cfg.holdMs) || 30);
        setTimeout(() => {
          if (!runningApps.some(r => r && r.wine === wine)) return;
          sharedRenderer.handleKeyDown(vk);
          setTimeout(() => {
            if (runningApps.some(r => r && r.wine === wine)) {
              sharedRenderer.handleKeyUp(vk);
            }
          }, holdMs);
        }, delayMs);
      }
    }

    // Set by the launch in progress so the outer guard below can reach its
    // failLaunch (which owns that launch's boot ticket) from a catch.
    let pendingLaunchFail = null;

    // Every await in here is somewhere a boot can die -- an out-of-memory in
    // init(), a missing asset, a DLL that will not load -- and only some of
    // them had a .catch. A rejection that escaped left the boot ticket
    // unspent, so body.app-booting stayed on for the life of the page: a
    // permanent hourglass over a desktop with nothing running. Seen on the
    // real phone as "null is not an object (evaluating 'wine.instance.exports')"
    // at the set_hwnd_base line, after init() failed to get its guest memory.
    // launchApp wraps it so failLaunch runs whatever threw.
    // A boot takes seconds on a phone, and the desktop icons stay tappable for
    // all of it -- body.app-booting hides nothing. `wine` is one shared
    // variable, so a second tap during the first boot does not start a second
    // app, it *overwrites the first one mid-init*: launch A resumes after its
    // await and configures B's instance, while A's own WineAssembly is left
    // with no owner, no stop() and its 512MB of guest memory held for the life
    // of the page. That is what the phone hit -- two icon taps, 1GB gone, then
    // "Out of memory" on every later launch. The single-app guard below cannot
    // catch it because runningApps is not pushed until the boot finishes.
    let launchInFlight = false;
    const pendingAppLaunches = [];
    let restartAfterCancel = null;
    let pendingDispatchScheduled = false;

    function dispatchPendingLaunch() {
      if (!launchInFlight && restartAfterCancel) {
        const next = restartAfterCancel;
        restartAfterCancel = null;
        queueMicrotask(() => {
          if (!next.intent || next.intent.status === 'pending') {
            void api.launchApp(next.key, { ...next.options, directIntent: next.intent });
          }
        });
        return;
      }
      const pending = pendingAppLaunches[0];
      if (pendingDispatchScheduled || launchInFlight || !pending ||
          (pending.waitForExit && runningApps.length)) return;
      pendingDispatchScheduled = true;
      queueMicrotask(() => {
        pendingDispatchScheduled = false;
        const next = pendingAppLaunches[0];
        if (launchInFlight || !next || (next.waitForExit && runningApps.length)) return;
        pendingAppLaunches.shift();
        appendDebugLog(`[ShellExecute] starting queued launch ${next.key}`);
        void api.launchApp(next.key);
      });
    }

    function queuePendingLaunch(key, waitForExit) {
      pendingAppLaunches.push({ key, waitForExit });
      appendDebugLog(`[ShellExecute] queued ${key} until ` +
        (waitForExit ? 'the current process exits' : 'the current boot finishes'));
      dispatchPendingLaunch();
    }

    // The launch context of the boot in flight (createLaunchContext).
    let inFlightLaunch = null;

    async function launchApp(appKey, launchOpts) {
      if (launchInFlight) {
        if (inFlightLaunch && inFlightLaunch.cancelled) {
          const key = appKey || document.getElementById('app-select').value;
          const app = apps[key];
          if (!app) return;
          // Cleanup of a non-abortable init must finish before allocating a
          // replacement guest. Keep the new request (and its own deadline)
          // instead of dropping Start again behind the old boot guard.
          const next = { key, options: launchOpts || {}, intent: null };
          restartAfterCancel = next;
          if (launchUi) {
            const direct = isDirectLaunch();
            next.intent = launchUi.begin({
              appId: key, label: appLabelFor(key, app), iconUrl: appIconFor(key, app),
              mode: direct ? 'direct' : 'desktop', windowed: !direct && !SINGLE_APP(),
              handlers: {
                cancel: () => {
                  if (restartAfterCancel === next) restartAfterCancel = null;
                  next.intent.cancelled();
                },
                showDesktop: () => {
                  if (restartAfterCancel === next) restartAfterCancel = null;
                  onShowDesktop();
                },
                closed: () => {
                  if (restartAfterCancel === next) restartAfterCancel = null;
                  if (isDirectLaunch()) onShowDesktop();
                },
                again: () => { void launchApp(key); },
              },
            });
          }
          return;
        }
        appendDebugLog(`Launch of ${appKey || '(selected)'} ignored: a boot is already in progress`);
        // Asking again while the launch window is up brings it forward.
        if (launchUi) launchUi.focus();
        return;
      }
      launchInFlight = true;
      inFlightLaunch = null;
      try {
        await launchAppInner(appKey, launchOpts);
        pendingLaunchFail = null;
      } catch (e) {
        const fail = pendingLaunchFail;
        pendingLaunchFail = null;
        if (fail) fail(e);
        else console.error('[launchApp] failed:', e);
      } finally {
        launchInFlight = false;
        dispatchPendingLaunch();
        settleLaunchWindow(inFlightLaunch, launchOpts);
        inFlightLaunch = null;
      }
    }

    // A launch that returned without starting anything (a LAN lobby
    // cancelled, a sign-in redirect, an id that names nothing) has nothing to
    // wait for: its window goes, and a direct link falls back to the desktop.
    function settleLaunchWindow(ctx, launchOpts) {
      if (ctx && ctx.launch && !ctx.registered && ctx.launch.status === 'pending') {
        ctx.retained.clear();
        ctx.launch.dismiss();
        if (ctx.launch.mode === 'direct' && !runningApps.length) onShowDesktop();
      }
      const intent = launchOpts && launchOpts.directIntent;
      if (!ctx && intent && intent.status === 'pending') {
        intent.dismiss();
        if (!runningApps.length) onShowDesktop();
      }
    }

    // The card for a network game whose other side is gone (showLanOverCard).
    // Starting over means a fresh boot: a game left mid-match against nobody
    // is in no state to be steered back to its menus, and a fresh boot is
    // where the recipes start from. The old game and its room go first --
    // rooms are one per account, and a phone runs one app at a time.
    lanOverHandler = async (app, room, info) => {
      const running = runningApps.find(r => r && r.wine && r.wine._lanRoom === room);
      if (!running) return;
      const choice = await showLanOverCard(app, info);
      if (choice === 'stay' || running.wine._stopped) return;
      stopRunningApp(running, true);
      if (choice === 'host' || choice === 'find') launchApp(running.name, { lanAfter: choice });
    };

    // Quitting pushed a desktop address over the game's (clearAppUrl), so
    // Back returns to ?app=…&room=… and this relaunches it -- through the
    // ordinary launch, which reads the room off the address and joins it.
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('popstate', () => {
        const wanted = new URLSearchParams(location.search).get('app');
        if (!wanted || !apps[wanted] || launchInFlight) return;
        if (runningApps.some(running => running && running.name === wanted)) return;
        // A room this page owned before quitting: Back hosts it again.
        launchApp(wanted, { ownRoomBack: (history.state && history.state.wineOwnRoom) === wanted });
      });
    }

    async function launchAppInner(appKey, launchOpts) {
      const select = document.getElementById('app-select');
      const sel = appKey || select.value;
      const app = apps[sel];
      if (!app) return;
      // `let`: a Join on the LAN card adds the app's lan.join.launchArgs.
      let launchArgs = SINGLE_APP() && app.singleAppArgs !== undefined
        ? app.singleAppArgs : app.args;
      // A guest that stopped without its notification reaching here leaves an
      // entry that says an app is running when none is, and on a phone that
      // is a dead end: the icons stay hidden behind body.app-running over a
      // renderer that has already dropped the guest's windows, so the page is
      // bare teal and every tap below is refused in silence. Whether the
      // entry is live is knowable, so check it instead of trusting the
      // bookkeeping -- the same reason onAppRunningChange asserts ownership
      // rather than relying on a transition.
      for (const stale of [...runningApps]) {
        if (stale && stale.wine && stale.wine.running === false) {
          unregisterRunningApp(stale.wine);
        }
      }
      clearUnownedDisplayMode();
      // One guest at a time on a phone. The desktop icons are hidden while an
      // app runs, so this only catches a stray programmatic launch.
      if (SINGLE_APP() && runningApps.length && !(launchOpts && launchOpts.bypassSingleApp)) {
        appendDebugLog(`Single-app mode: ignoring launch of ${sel}, an app is already running`);
        return;
      }
      // From here on the page is committed to a boot, so it says so.
      const bootDone = bootTicket();
      const ctx = createLaunchContext(sel, app, launchOpts);
      inFlightLaunch = ctx;
      if (app.resetIniOnLaunch) {
        // Throws in a frame denied storage, where there is nothing to reset.
        try {
          for (const name of app.resetIniOnLaunch) {
            localStorage.removeItem('ini:' + String(name).toLowerCase());
          }
        } catch (_) {}
      }
      if (app.startupIni && window.StorageImports && StorageImports.setIniValue) {
        for (const entry of app.startupIni) {
          StorageImports.setIniValue(entry.fileName, entry.section, entry.key, entry.value);
        }
      }
      if (app.startupRegistry && window.StorageImports && StorageImports.setRegValue) {
        for (const entry of app.startupRegistry) {
          StorageImports.setRegValue(entry.keyPath, entry.valueName, entry.type, entry.data);
        }
      }
      let launchFailed = false;
      // The WineAssembly this launch built, if it got that far. A boot that
      // dies after init() has already committed 512MB of shared guest memory,
      // and nothing else will ever call stop() on it -- it was never pushed to
      // runningApps -- so the page keeps that half-gigabyte until it is
      // reloaded. Two of those is every later launch failing with "Out of
      // memory" on a phone.
      let createdWine = null;
      // A boot that never runs still ends the process a parent may be
      // waiting on (host.js process_spawn).
      const notifyLaunchExit = () => {
        if (launchOpts && typeof launchOpts.onExit === 'function') launchOpts.onExit(null);
      };
      const failLaunch = (e) => {
        notifyLaunchExit();
        // Idempotent: the inner catches call this and rethrow, and the outer
        // guard in launchApp catches the same rejection on the way out.
        if (launchFailed) return;
        launchFailed = true;
        const log = document.getElementById('log');
        const msg = 'ERROR launching ' + sel + ': ' + (e && e.message ? e.message : e);
        console.error('[launchApp] failed:', e);
        pendingLaunchFail = null;
        if (createdWine) {
          const orphan = createdWine;
          createdWine = null;
          // Launch errors surface after the awaited boot step has unwound, so
          // no guest call can still be using this instance. Release its 512MB
          // now, before a retry on a memory-constrained phone allocates again.
          try { orphan.stop({ releaseNow: true }); } catch (_) {}
        }
        bootDone();
        // Cancel is not a failure: the launch window already says so.
        if (ctx.cancelled || (e && e.name === 'AbortError')) {
          const note = `Launch of ${sel} cancelled`;
          document.getElementById('status').textContent = note;
          if (log) log.textContent += note + '\n';
          if (ctx.launch) ctx.launch.cancelled();
          return;
        }
        document.getElementById('status').textContent = msg;
        if (log) {
          log.textContent += msg + '\n';
          log.scrollTop = log.scrollHeight;
        }
        // A file that did not arrive is something the visitor can act on:
        // the launch window turns into the download error with Retry. Any
        // other failure is a bug report, and keeps the crash report.
        if (e && e.isDownloadError && ctx.launch) {
          const lp = window.LaunchProgress;
          ctx.launch.fail({
            file: lp ? lp.fileNameOf(e.assetUrl) : String(e.assetUrl || ''),
            reason: e.downloadReason || WineAssembly._downloadReason(e),
            attempts: e.attempts || 1,
          });
          return;
        }
        if (ctx.launch) ctx.launch.dismiss();
        ctx.retained.clear();
        showCrashReport({ kind: 'launch', app: sel, error: e });
      };
      pendingLaunchFail = failLaunch;

      const canvas = document.getElementById('screen');
      const size = screenCanvasSize();
      canvas.width = size.w;
      canvas.height = size.h;

      const log = document.getElementById('log');
      log.textContent += `Launching ${sel}.exe...\n`;

      // Create shared renderer on first launch
      if (!sharedRenderer) {
        sharedRenderer = new Win98Renderer(canvas);
        if (!DEBUG_MODE) sharedRenderer.transparentDesktop = true;
        sharedRenderer.singleAppMode = SINGLE_APP();
      }

      // A LAN-capable app asks who else is out there before it boots. The
      // wire and the room address have to be in place before init(), because
      // host imports capture them at instantiate time and the guest may bind
      // a socket on its first slice.
      //
      // This runs before the same-app cleanup below because its answer decides
      // whether that cleanup should happen at all: "both players here" is a
      // second copy of the very app being relaunched.
      //
      // `lan.onDemand` moves all of that to the moment the guest itself asks
      // for the room -- picking network play in its own menus -- so a person
      // who only wants a single-player game never sees a lobby. The wait then
      // happens inside the guest's own API call: see net_link_open.
      let lanLink = (launchOpts && launchOpts.lanLink) || null;
      // An automatic room offers the one thing worth offering before boot:
      // somebody is already hosting this game. Joining now, rather than
      // from the game's menus, lets the game launch straight into the match.
      // Looking is read-only and bounded -- a slow or signed-out signaling
      // service must never hold up a launch -- and "Not now" costs nothing:
      // the same question comes back when the game first goes online.
      const autoRoom = !lanLink && !!(app.lan && app.lan.room === 'auto') && !!window.VlanRoom;
      let lanRoom = null;
      // An invite link (?app=ID&room=USERID) names the owner to join. It is
      // the person's answer already, so no card is shown for that owner.
      let invite = autoRoom ? lanInviteFor(sel) : null;
      // Started over from the game-over card (showLanOverCard): 'host' opens
      // a room of its own and runs lan.host.inGame once the game is up;
      // 'find' shows the server list even when it is empty, with a way to
      // host instead, and joins the way a launch-time pick does.
      const lanAfter = autoRoom && launchOpts ? launchOpts.lanAfter || null : null;
      let hostAfterLaunch = false;
      // The room/lobby cards below are this launch's own questions. The
      // launch window never opens on top of them; if the answer takes longer
      // than 500ms it appears as soon as the cards are gone.
      const lanPrompt = !!(autoRoom || (app.lan && window.VlanLobby && !lanLink &&
        !(app.lan && app.lan.onDemand)));
      if (lanPrompt && ctx.launch) ctx.launch.promptOpen();
      if (autoRoom) {
        let owner = null;
        let invited = null;
        let serving = [];
        // "Start a new room" on the own-room-link card.
        let startOwnRoom = false;
        const peekRooms = () => VlanRoom.hostedRooms(
          { join: { exe: app.lan.exe || sel }, includeIdle: !!invite });
        // Rooms are public records, so a signed-out page sees them too; only
        // joining one needs an account.
        let signedOut = false;
        try {
          const rooms = await withTimeout(peekRooms(), 2500);
          signedOut = !!rooms.signedOut;
          // The list leaves this account out, so its own room link would
          // otherwise read as "not open right now".
          const ownLink = !!(invite && rooms.userId && invite === rooms.userId);
          if (ownLink) {
            log.textContent += 'LAN: this room link is your own account\'s room.\n';
            // Back to a room this page itself hosted: host it again, no card.
            startOwnRoom = (launchOpts && launchOpts.ownRoomBack)
              || await tellOwnRoomLink(app) === 'host';
            clearRoomUrl(invite);
            invite = null;
            if (!startOwnRoom) log.textContent += 'LAN: playing offline.\n';
          }
          invited = invite ? rooms.find(r => r.userId === invite) || null : null;
          // The own-link card was the answer: no server list on top of it.
          serving = ownLink ? [] : servingRooms(rooms);
        } catch (e) {
          // Offline or slow: launch as usual. A 401 here is a server that
          // does not publish rooms openly, which still leaves a room link
          // worth signing in for.
          signedOut = !!(e && e.needsLogin);
          // The rooms could not be read, but a room link still wants the
          // account: ask the one cheap question before the game starts,
          // rather than letting joining fail with "not signed in" later.
          if (!signedOut && invite) {
            try { signedOut = !(await withTimeout(signedInNow(), 2500)); } catch (_) {}
          }
        }
        if (signedOut && (invite || serving.length)) {
          // A room link is a request to play with that person; otherwise the
          // list is what there is to join, each Join by way of the sign-in.
          let pick = null;
          if (invite) {
            if (await askToSignIn(app, { invited: true, host: invited && invited.name }) === 'signin') {
              pick = invited || { userId: invite };
            }
          } else {
            pick = await pickRoom(serving, app, {
              signedOut: true,
              refresh: async () => servingRooms(await peekRooms()),
            });
          }
          if (pick) {
            log.textContent += 'LAN: signing in to join the room.\n';
            signInToJoin(sel, pick);
            bootDone();
            return;
          }
          log.textContent += 'LAN: signed out, playing offline.\n';
          invited = null;
          serving = [];
        }
        if (invite && !invited && !signedOut) log.textContent += 'LAN: the room in this link is not open right now.\n';
        if (lanAfter === 'host') {
          startOwnRoom = true;
        } else if (lanAfter === 'find') {
          owner = await pickRoom(serving, app, {
            ownLabel: 'Host a new game',
            signedOut,
            refresh: async () => servingRooms(await peekRooms()),
          });
          if (owner === 'own') { owner = null; startOwnRoom = true; }
          else if (!owner) log.textContent += 'LAN: continuing offline.\n';
          else if (signedOut) {
            log.textContent += 'LAN: signing in to join the room.\n';
            signInToJoin(sel, owner);
            bootDone();
            return;
          }
        } else if (invited && !invited.hosting) {
          // Their game is not serving yet: the room is joined silently when
          // this game first goes online (openLanLink below).
          log.textContent += `LAN: invited by ${invited.name}; joining when the game goes online.\n`;
        } else if (invited) {
          owner = invited;
        } else if (serving.length) {
          owner = await pickRoom(serving, app, {
            refresh: async () => servingRooms(await peekRooms()),
          });
          if (!owner) log.textContent += 'LAN: continuing offline.\n';
        }
        if (startOwnRoom) {
          try {
            lanRoom = await openAutoRoom(app, sel, log, null, true);
            lanLink = { wire: lanRoom.wire, address: lanRoom.address, room: lanRoom };
            showShareCard(app);
            hostAfterLaunch = !!lanAfter;
          } catch (e) {
            showLanNotice(`Could not start a room: ${e && e.message ? e.message : e}. Playing offline.`);
            log.textContent += `LAN: could not start a room: ${e && e.message ? e.message : e}\n`;
          }
        } else if (owner) {
          // Before the game exists: the dialog is the only thing on screen,
          // and the game launches once it has an answer either way.
          lanRoom = await joinRoomWithDialog(app, sel, log, owner);
          if (lanRoom) {
            lanLink = { wire: lanRoom.wire, address: lanRoom.address, room: lanRoom };
            launchArgs = joinLaunchArgs(app, lanRoom, launchArgs);
          }
        }
      }
      const askLanOnDemand = !lanLink && !!(app.lan && app.lan.onDemand) && !!window.VlanLobby;
      if (app.lan && window.VlanLobby && !lanLink && !askLanOnDemand) {
        try {
          lanLink = await VlanLobby.showLobby({
            exe: app.lan.exe || sel,
            label: app.lan.label || sel,
            localPlay: app.lan.local !== false,
            hint: app.lan.hint,
          });
        } catch (e) {
          console.error('[lan] lobby failed:', e);
        }
        if (lanLink === null) {
          log.textContent += `Launch of ${sel} cancelled.\n`;
          bootDone();
          return;
        }
        if (lanLink && lanLink.local) lanLink = joinPageSegment();
        if (lanLink && lanLink.wire) {
          const who = lanLink.peer && lanLink.peer.name
            ? `connected to ${lanLink.peer.name}`
            : 'on this tab’s own segment';
          log.textContent += `LAN: ${who} — you are ${lanLink.address}\n`;
          watchLanWire(lanLink.wire, lanLink.peer, log);
        }
      }
      if (lanPrompt && ctx.launch) ctx.launch.promptClose();

      // The CLI harness creates a fresh renderer for every run. The browser
      // intentionally shares one renderer so multiple apps can coexist, but
      // relaunching the same app must not leave stale back-canvases or old
      // wasm bindings around; those make the web view disagree with CLI PNGs.
      // A local LAN launch is the one case where two copies of one app are
      // the point, so it keeps whatever is already running.
      if (!(lanLink && lanLink.local)) {
        for (let i = runningApps.length - 1; i >= 0; i--) {
          const running = runningApps[i];
          if (!running || running.name !== sel) continue;
          stopRunningApp(running, false);
        }
      }
      sharedRenderer.repaint();

      wine = new WineAssembly();
      createdWine = wine;
      // The guest asks for the room the first time it needs one, and cannot
      // be kept waiting inside a host import, so this answers "not yet" and
      // the guest parks and asks again. Chosen "both players here" launches
      // the second copy already wired, which is why it never asks again.
      if (askLanOnDemand) {
        const ask = { state: 'idle' };
        const askWine = wine;
        askWine._lanAsk = ask;
        askWine.openLanLink = why => {
          if (ask.state === 'done') return true;
          if (ask.state === 'asking') return false;
          ask.state = 'asking';
          ask.why = why | 0;
          if (autoRoom) {
            (async () => {
              // Somebody hosting gets the card again ("Not now" at launch
              // was not "never"); otherwise the room is joined or started
              // without a word, and the chip says which.
              let owner = null;
              let signedOut = false;
              let serving = [];
              const peekRooms = () => VlanRoom.hostedRooms(
                { join: { exe: app.lan.exe || sel }, includeIdle: !!invite });
              try {
                const rooms = await peekRooms();
                signedOut = !!rooms.signedOut;
                owner = (invite && rooms.find(r => r.userId === invite)) || null;
                serving = servingRooms(rooms);
              } catch (e) { signedOut = !!(e && e.needsLogin); }
              let offline = false;
              // A game about to host (DirectPlay Open to create, why 2) has
              // nothing to pick: it goes online at once, into a room of its
              // own when others are already serving, and the share card says
              // how to invite somebody. Anything else sees the servers, if
              // there are any; an empty list goes online silently.
              let ownRoom = false;
              // A dealer registering its DDE service (why 6) is the same.
              const hosting = ask.why === 2 || ask.why === 6;
              if (!owner && hosting) {
                ownRoom = serving.length > 0;
              } else if (!owner && serving.length) {
                // Signed out, the list still shows (rooms are public records);
                // a Join then goes by way of the sign-in page.
                owner = await pickRoom(serving, app, {
                  ownLabel: ask.why === 1 && !signedOut ? 'Start my own room' : null,
                  signedOut,
                  refresh: async () => servingRooms(await peekRooms()),
                });
                offline = !owner;
                ownRoom = owner === 'own';
                if (ownRoom) owner = null;
              }
              if (offline) {
                log.textContent += 'LAN: playing offline.\n';
              } else if (signedOut && owner) {
                log.textContent += 'LAN: signing in to join the room.\n';
                signInToJoin(sel, owner);
              } else {
                // The game is parked in its network call while these cards
                // are up. Sign in opens Berrry's login in a popup and the game
                // goes online when it is done, still running. A blocked popup,
                // or "Sign in in this tab", leaves the page for the login, which
                // comes back to this game's URL. Play offline lets the call
                // fail the way a cable-less PC's does. Resolves true signed
                // in, false offline, null leaving the page.
                const signInHere = async () => {
                  const answer = await askToSignIn(app, { popup: true });
                  if (answer === 'popup') {
                    log.textContent += 'LAN: signing in (popup).\n';
                    const after = await waitForSignIn(app);
                    if (after === 'signed-in') { log.textContent += 'LAN: signed in.\n'; return true; }
                    if (after !== 'redirect') return false;
                  } else if (answer !== 'signin') {
                    return false;
                  }
                  log.textContent += 'LAN: signing in.\n';
                  goSignIn(appUrl(sel));
                  return null;
                };
                let online = true;
                if (signedOut) {
                  online = await signInHere();
                  if (online === false) log.textContent += 'LAN: signed out, playing offline.\n';
                }
                // Signed in as far as the page could tell, and the room still
                // said 401 (a session that lapsed, a presence read that failed):
                // that is the same question, not an error to show.
                for (let attempt = 0; online; attempt++) {
                try {
                  // A chosen room is joined or reported; only "go online"
                  // with nobody chosen may open a room of its own.
                  const room = owner
                    ? await joinRoomWithDialog(app, sel, log, owner)
                    : await openAutoRoom(app, sel, log, null, ownRoom);
                  if (!room) break;
                  adoptLanRoom(askWine, room, app, sel, log, sharedRenderer);
                  askWine.joinVlan(room.wire, room.address);
                  // Any room this page opened is one only its link can
                  // reach, whether a DirectPlay host asked for it or a plain
                  // socket (Atomic Bomberman's IPX server) went online into
                  // an empty lobby -- so the owner always gets the card.
                  if (hosting || ownRoom || room.role === 'owner') showShareCard(app);
                  // Picked from the list: carry on into that game from where
                  // the guest asked, once the guest has its answer.
                  if (owner && room.role === 'member') {
                    setTimeout(() => runJoinRecipe(askWine, app, sel, room, log,
                      sharedRenderer, ask.why), 0);
                  }
                  const seatLayout = touchControlsForSeat(app, room.address);
                  for (const running of runningApps) {
                    if (running && running.wine === askWine) running.touchControls = seatLayout;
                  }
                  syncTouchControls();
                  break;
                } catch (e) {
                  if (e && e.needsLogin && attempt === 0) {
                    online = await signInHere();
                    if (online === false) log.textContent += 'LAN: signed out, playing offline.\n';
                    continue;
                  }
                  showLanNotice(`Could not go online: ${e && e.message ? e.message : e}. Playing offline.`);
                  log.textContent += `LAN: could not open the room: ${e && e.message ? e.message : e}\n`;
                  break;
                }
                }
              }
              ask.state = 'done';
            })();
            return false;
          }
          (async () => {
            let link = null;
            try {
              link = await VlanLobby.showLobby({
                exe: app.lan.exe || sel,
                label: app.lan.label || sel,
                localPlay: app.lan.local !== false,
                hint: app.lan.hint,
              });
            } catch (e) {
              console.error('[lan] lobby failed:', e);
            }
            if (link && link.local) {
              link = joinPageSegment();
              // The second player is a second copy of this same app, handed
              // its own address on the same segment so it asks nothing.
              setTimeout(() => launchApp(sel, { lanLink: joinPageSegment() }), 0);
            }
            if (link && link.wire) {
              askWine.joinVlan(link.wire, link.address);
              // This is where the seat becomes known, and the app is already
              // running: rewrite its record's layout and re-sync, rather than
              // leaving the pad driving whichever blob it guessed at launch.
              const seatLayout = touchControlsForSeat(app, link.address);
              for (const running of runningApps) {
                if (running && running.wine === askWine) running.touchControls = seatLayout;
              }
              syncTouchControls();
              const who = link.peer && link.peer.name
                ? `connected to ${link.peer.name}`
                : 'on this tab’s own segment';
              log.textContent += `LAN: ${who} — you are ${link.address}\n`;
              watchLanWire(link.wire, link.peer, log);
            } else {
              // Cancelled, or the lobby failed: this machine has no cable and
              // the guest's own search will truthfully find nobody.
              log.textContent += 'LAN: playing without a room.\n';
            }
            ask.state = 'done';
          })();
          return false;
        };
      }
      wine.asyncMultimediaTimer = !!app.asyncMultimediaTimer;
      wine.virtualAllocTop = app.virtualAllocTop >>> 0;
      wine.mmTimerThread = app.mmTimerThread !== false;
      wine.x87Fusion = app.x87Fusion !== false;
      wine.nullPageFaults = app.nullPageFaults === true;
      // Every CreateProcess becomes a child instance (host.js process_spawn).
      wine.spawnProcesses = app.spawnProcesses === true;
      wine.uop = app.uop !== false;
      wine.aggressiveStack = app.aggressiveStack === true;
      // ?force-threads overrides an app's threads: false, so the measurement
      // that put it there can be repeated against the Worker backend.
      wine.threads = app.threads !== false ||
        new URLSearchParams(location.search).has('force-threads');
      wine.cpuSSE = app.cpuSSE === true;
      // Frame-end pacing ($present_pace) is opt-in per app: lib/apps.js
      // `presentCap: N`. It belongs only on an app that runs faster than the
      // cap AND whose presents are its real frames -- otherwise it is a no-op
      // at best, and at worst halves an app that ends a frame with two paced
      // presents. Measured 2026-09-23 (headful, ascii.dev,
      // tools/present-rate-sweep.js): the cap never slept on DX-Ball,
      // Marbles, Quake II, RCT, Pinball, Blobby or Diablo; StarCraft outruns
      // it but makes ~97 presents/s for ~17 displayed frames, so no app
      // qualifies yet. ?present-cap=N overrides for an A/B.
      wine.vlanNagleMs = Number.isFinite(app.vlanNagleMs) ? app.vlanNagleMs : 0;
      const presentCapQuery = new URLSearchParams(location.search).get('present-cap');
      wine.presentCap = presentCapQuery !== null ? Math.max(0, parseInt(presentCapQuery, 10) || 0)
        : Number.isFinite(app.presentCap) ? app.presentCap : 0;
      // ?present-pace=smooth|deadline picks how the cap is spent ($present_pace);
      // an app's `presentPace` overrides the smooth default.
      const presentPaceQuery = new URLSearchParams(location.search).get('present-pace');
      wine.presentPace = (presentPaceQuery || app.presentPace || 'smooth') === 'deadline'
        ? 'deadline' : 'smooth';
      // ?present-at=logical|pump: with a cap on an app that names its game
      // step (perf.logicalFrame), pace once per step (default) or keep the
      // pump-bounded rule, for the A/B. Apps without a step ignore it.
      const presentAtQuery = new URLSearchParams(location.search).get('present-at');
      wine.presentAt = presentAtQuery === 'pump' ? 'pump' : 'logical';
      wine.d3d9Programmable = app.d3d9Programmable === true;
      wine.bigMemory = app.bigMemory === true;
      wine.desktopColorDepth = app.desktopColorDepth === 8 ? 8 : 32;
      if (app.wallClock) wine.wallClockMs = Date.parse(app.wallClock);
      const windowlessGraceMs = Number(app.windowlessGraceMs);
      if (Number.isFinite(windowlessGraceMs) && windowlessGraceMs >= 0) {
        wine.windowlessGraceMs = windowlessGraceMs;
      }
      if (lanRoom) adoptLanRoom(wine, lanRoom, app, sel, log, sharedRenderer);
      // The in-game wait window names the game (host.js _fillParkedRead).
      wine._gameDataLabel = appLabelFor(sel, app);
      wine.onStopped = stoppedWine => {
        // Quitting the game leaves its room: an owner's members hear the
        // room close, a member's seat is freed for the next arrival. The
        // address goes first: clearAppUrl pushes a clean entry and keeps the
        // room in the one Back returns to; clearRoomUrl only replaces, for a
        // room left under an address naming some other app.
        clearAppUrl(sel, !!(stoppedWine._lanRoom && stoppedWine._lanRoom.role === 'owner'));
        if (stoppedWine._lanRoom) {
          clearRoomUrl(stoppedWine._lanRoom.ownerUserId);
          stoppedWine._lanRoom.close();
          stoppedWine._lanRoom = null;
          clearLanNotices();
        }
        if (stoppedWine._lanOffers) { clearInterval(stoppedWine._lanOffers); stoppedWine._lanOffers = null; }
        // A game-over card asks what to do with this game; it has quit.
        const over = document.querySelector('#wine-lan-card.wine-lan-over');
        if (over) over.remove();
        stoppedWine._stopped = true;
        stopBrowserOverlay(stoppedWine);
        unregisterRunningApp(stoppedWine);
      };
      if (launchOpts && typeof launchOpts.onExit === 'function') {
        const stoppedHook = wine.onStopped;
        wine.onStopped = w => { try { stoppedHook(w); } finally { launchOpts.onExit(w); } };
      }
      wine.onFatal = crash => showCrashReport({
        kind: 'runtime', app: sel,
        error: crash && crash.error,
        state: crash && crash.state,
        tag: crash && crash.tag,
      });
      wine._sharedMixer = sharedAudioMixer;
      wine.primeAudio();
      wine.renderer = sharedRenderer;  // set before init so it won't create a new one
      wine._multiApp = true;
      if (lanLink && lanLink.wire) wine.joinVlan(lanLink.wire, lanLink.address);
      ctx.wine = wine;
      await wine.init(canvas);
      throwIfCancelled(ctx);
      // From here until the DLL graph is in, this instance's downloads are
      // the launch window's to report (host.js fetchAssetBytes options).
      wine._launchTransfer = ctx.transfer;

      // Windows data files are not PE dependencies, so the DLL graph cannot
      // discover them. Mount the shared boot list before any guest code runs.
      if (window.processBoot && window.processBoot.SYSTEM_DATA_FILES) {
        // build-info.js (window.WINE_BUILD) exists only on a deployed site,
        // which does not carry the localOnly files.
        const deployed = typeof window.WINE_BUILD === 'string';
        const wanted = window.processBoot.SYSTEM_DATA_FILES.filter(file => !(deployed && file.localOnly));
        const systemFiles = await Promise.all(wanted.map(async file => {
          try {
            return { ...file, bytes: await WineAssembly.fetchAssetBytes(file.url,
              ctx.abort ? { signal: ctx.abort.signal } : {}) };
          } catch (error) {
            // Some system data is a local compatibility aid whose
            // redistribution status does not permit putting it on the public
            // site. Its absence must not prevent unrelated apps from booting.
            appendDebugLog(`[system data] unavailable ${file.url}: ${error.message}`);
            return null;
          }
        }));
        throwIfCancelled(ctx);
        window.processBoot.mountSystemDataFiles(wine._helpCtx && wine._helpCtx.vfs, systemFiles);
      }

      // Set unique hwnd range for this app
      const appIndex = nextAppIndex++;
      const hwndBase = 0x10001 + appIndex * 0x10000;
      wine._hwndBase = hwndBase;
      if (wine.hasGuestExport('set_hwnd_base')) {
        await wine.callGuest('set_hwnd_base', hwndBase);
      }

      window.browserInput.wireCanvasInput(canvas, sharedRenderer, {
        runningApps,
        debugMode: DEBUG_MODE,
      });
      focusCanvasForLaunch(canvas);

      // An imported app (docs/design-byo-media.md phase ④) has no URL to
      // fetch: its exe lives inside a zip, on a mounted ISO, or in a File the
      // visitor dropped a moment ago. So a dynamic entry brings its own
      // container mounts, applied to this guest's VFS before the PE loader
      // runs, and resolves its bytes out of the result. Everything after this
      // -- DLL graph, run slice, persistence -- is the registered-app path
      // unchanged, which is the whole point of synthesizing a registry entry
      // rather than writing a second launcher.
      let dynamicExeBytes = null;
      if (app.localFileManifest && !app._localFilesResolved) {
        document.getElementById('status').textContent = 'Reading local media...';
        const manifestUrl = new URL(app.localFileManifest, location.href);
        const response = await fetch(manifestUrl, ctx.abort ? { signal: ctx.abort.signal } : undefined)
          .catch(error => {
            if (error && error.name !== 'AbortError') {
              error.isDownloadError = true;
              error.assetUrl = manifestUrl.href;
            }
            throw error;
          });
        throwIfCancelled(ctx);
        if (!response.ok) {
          const error = new Error(`Unable to load ${manifestUrl.href}: HTTP ${response.status}`);
          error.isDownloadError = true;
          error.assetUrl = manifestUrl.href;
          throw error;
        }
        const local = await response.json().catch(error => {
          if (error && error.name !== 'AbortError' && error.name !== 'SyntaxError') {
            error.isDownloadError = true;
            error.assetUrl = manifestUrl.href;
          }
          throw error;
        });
        throwIfCancelled(ctx);
        if (!local || local.schemaVersion !== 1 || !Array.isArray(local.files)) {
          throw new Error(`${sel}: invalid local media manifest`);
        }
        const resolved = local.files.map(file => ({
          ...file,
          url: new URL(file.url, manifestUrl).href,
        }));
        app.files = [...(app.files || []), ...resolved];
        app._localRegistry = local.registry || null;
        app._localFilesResolved = true;
        if (app.cdAudio && !app.cdAudio.trackSizes) {
          app.cdAudio.trackSizes = local.trackSizes || {};
        }
      }
      // The registry the local media's installer would have written
      // (tools/prepare-morrowind.js), applied on every launch like
      // startupRegistry and before any guest code runs.
      if (app._localRegistry && window.StorageImports && StorageImports.importStore) {
        StorageImports.importStore(app._localRegistry);
      }
      if (app.mounts && app.mounts.length) {
        const vfs = wine._helpCtx && wine._helpCtx.vfs;
        if (!vfs) throw new Error(`${sel}: the guest has no VFS to mount media into`);
        document.getElementById('status').textContent = 'Mounting media...';
        for (const mount of app.mounts) {
          throwIfCancelled(ctx);
          const info = await mount(vfs, wine).catch(e => { failLaunch(e); throw e; });
          throwIfCancelled(ctx);
          if (info && info.root) log.textContent += `Mounted ${info.root}\n`;
        }
      }
      // A registry app's files arrive through loadFiles() below, so its
      // working directory does not exist yet here; apply it after the load.
      // Imported media is already mounted and is applied immediately.
      let deferWorkingDirectory = false;
      if (app.workingDirectory) {
        const vfs = wine._helpCtx && wine._helpCtx.vfs;
        if (!vfs || typeof vfs.setCurrentDirectory !== 'function') {
          throw new Error(`${sel}: working directory ${app.workingDirectory} is not mounted`);
        }
        if (!vfs.setCurrentDirectory(app.workingDirectory)) {
          if (!(app.files && app.files.length)) {
            throw new Error(`${sel}: working directory ${app.workingDirectory} is not mounted`);
          }
          deferWorkingDirectory = true;
        }
        // The guest ABI still reports every main image as C:\<basename> (see
        // $module_file_name and VfsSeed.seedExeImage). An imported installer
        // consequently constructs absolute C:\ paths for files beside an EXE
        // that actually came from D:\ or a mounted ZIP directory. Mirror only
        // the directory's immediate files, lazily and without overwriting C:
        // state, so sidecars follow the same reported path as the image.
        if (app.mirrorWorkingDirectoryToC && vfs.files instanceof Map) {
          const sourceDir = vfs._normPath(app.workingDirectory).replace(/\\$/, '');
          const prefix = sourceDir + '\\';
          for (const [path] of [...vfs.files]) {
            if (!path.startsWith(prefix)) continue;
            const leaf = path.slice(prefix.length);
            if (!leaf || leaf.includes('\\')) continue;
            const alias = 'c:\\' + leaf;
            if (!vfs.files.has(alias)) vfs.copyFile(path, alias, false);
          }
        }
      }
      // Writable C: state belongs above the immutable import mount and any
      // C: aliases made for an imported executable. Attach only after both
      // exist: otherwise the alias copies themselves look like guest writes,
      // and every checkpoint retries synchronous reads from their lazy media
      // providers. Hydration still happens before resolving the EXE, so an
      // installed replacement wins and a recorded deletion stays deleted.
      // Kept imports use OPFS; session imports keep the same journal only for
      // this page. Both are periodically flushed once the guest starts.
      await attachDynamicOverlay(wine, app, sel);
      // Registered retail/local fixtures can describe a Redump-style CUE
      // without forcing hundreds of megabytes of music through loadFiles().
      // Fetch the tiny table of contents now; each raw audio BIN remains a
      // promise owned by CdRom and is fetched only when MCI plays that track.
      if (app.cdAudio) {
        const vfs = wine._helpCtx && wine._helpCtx.vfs;
        if (!vfs || typeof CdRom === 'undefined') {
          throw new Error(`${sel}: CD audio support is not loaded`);
        }
        const config = app.cdAudio;
        const cueUrl = new URL(config.cue, location.href);
        const response = await fetch(cueUrl);
        if (!response.ok) throw new Error(`${sel}: failed to load ${config.cue} (${response.status})`);
        const cueText = await response.text();
        const sizes = config.trackSizes || {};
        const foldedSizes = new Map(Object.entries(sizes).map(([name, size]) =>
          [String(name).replace(/\\/g, '/').toLowerCase(), size]));
        const parsedCue = CdRom.parseCue(cueText);
        if (parsedCue.tracks.some(track => !track.isAudio)) {
          // Mixed-mode: the data track is the disc the game reads its movies
          // and data from (Civ2 MGE's D:\civ2\video). Mount it as an ISO over
          // HTTP byte ranges -- the recorded track sizes spare a HEAD each --
          // through the same plan a dropped CUE gets (lib/media-import.js),
          // so nothing but the sectors the guest reads is fetched.
          const parts = [{ name: cueUrl.pathname.replace(/^.*\//, ''),
            source: new window.byteProvider.BytesProvider(new TextEncoder().encode(cueText)) }];
          for (const file of parsedCue.files) {
            const size = foldedSizes.get(String(file.name).replace(/\\/g, '/').toLowerCase());
            const url = new URL(file.name, cueUrl).href;
            const provider = size >= 0
              ? new window.byteProvider.HttpRangeProvider(url, size, { name: file.name })
              : await window.byteProvider.HttpRangeProvider.open(url, { name: file.name });
            parts.push({ name: file.name, source: provider, size: provider.size });
          }
          const plan = await window.mediaImport.analyzeCueBundle(parts, { drive: config.drive || 'D' });
          const mounted = await plan.mount(vfs);
          log.textContent += `Mounted ${mounted.root} "${plan.volumeLabel}" ` +
            `(${plan.entryCount} files, ${mounted.disc.audioTracks.length} audio tracks)\n`;
        } else {
          const disc = CdRom.mountCue(vfs, cueText, {
            drive: config.drive || 'D',
            volumeLabel: config.volumeLabel,
            trackSize: name => foldedSizes.get(String(name).replace(/\\/g, '/').toLowerCase()),
            loadTrack: name => WineAssembly.fetchAssetBytes(new URL(name, cueUrl).href),
          });
          log.textContent += `Mounted ${disc.root} CD audio (${disc.tracks.length} tracks)\n`;
        }
      }
      if (app.exeBytes) {
        const vfs = wine._helpCtx && wine._helpCtx.vfs;
        dynamicExeBytes = typeof app.exeBytes === 'function'
          ? await app.exeBytes(vfs, wine).catch(e => { failLaunch(e); throw e; })
          : app.exeBytes;
      }

      document.getElementById('status').textContent = 'Loading PE...';

      throwIfCancelled(ctx);
      if (ctx.launch && !dynamicExeBytes) {
        ctx.launch.beginBatch(window.LaunchProgress
          ? window.LaunchProgress.fileNameOf(app.exe).toUpperCase() : String(app.exe), 1);
      }
      const ok = await wine.loadExe(app.exe, {
        win16Modules: app.win16Modules,
        launchPrefs: app.launchPrefs,
        args: launchArgs,
        bytes: dynamicExeBytes,
        guestPath: app.exeGuestPath,
      });
      throwIfCancelled(ctx);
      if (ok) {
        for (const [name, value] of Object.entries(app.environment || {})) {
          if (wine.guestWorker) {
            const nameBytes = new TextEncoder().encode(name);
            const valueBytes = new TextEncoder().encode(String(value));
            const staging = (await wine.callGuest('get_staging')) >>> 0;
            const capacity = (await wine.callGuest('get_staging_size')) >>> 0;
            const needed = nameBytes.length + valueBytes.length + 2;
            if (!staging || needed > capacity) {
              throw new Error(`${sel}: environment value ${name} exceeds guest staging`);
            }
            const memory = new Uint8Array(wine.memory.buffer);
            const valueAt = staging + nameBytes.length + 1;
            memory.set(nameBytes, staging);
            memory[staging + nameBytes.length] = 0;
            memory.set(valueBytes, valueAt);
            memory[valueAt + valueBytes.length] = 0;
            if (!(await wine.callGuest('set_process_environment_a', staging, valueAt))) {
              throw new Error(`${sel}: failed to set guest environment value ${name}`);
            }
          } else if (!window.processBoot.setEnvironmentVariable(
            wine.instance.exports, wine.memory.buffer, name, value)) {
            throw new Error(`${sel}: failed to set guest environment value ${name}`);
          }
        }
        if (wine.configurePerf) await wine.configurePerf(app.perf || null);
        if (wine.configureStartupClock) wine.configureStartupClock(app.startupClock || null);
        if (app.files && app.files.length) {
          // The default download policy (lib/app-files.js): large data the
          // guest reads through ReadFile streams; executables, small files and
          // what synchronous consumers read load now. run.js applies the same.
          let files = app.files;
          // ?eager-files loads everything up front, as before the policy: the
          // control arm for measuring it, and a debugging opt-out.
          const eagerFilesParam = /[?&]eager-files(?:[=&]|$)/.test(location.search);
          if (window.appFiles && window.byteProvider && !eagerFilesParam) {
            const isWin16 = wine.hasGuestExport('is_win16') ? !!(await wine.callGuest('is_win16')) : false;
            const policy = window.appFiles.normalizeLazyFiles(app, app.files, {
              isWin16,
            });
            files = policy.files;
            window.__waLoadPolicy = { app: sel, ...policy.summary };
            log.textContent += `File policy: ${policy.summary.policy}; ${policy.summary.eagerFiles} eager ` +
              `(${policy.summary.eagerBytes} bytes), ${policy.summary.lazyFiles} on demand ` +
              `(${policy.summary.lazyBytes} bytes)\n`;
          }
          document.getElementById('status').textContent = 'Loading data files...';
          log.textContent += `Loading ${files.length} data file(s)...\n`;
          const progressStride = Math.max(1, Math.ceil(files.length / 20));
          // Files read on demand over HTTP ranges stream during play and are
          // not part of what the launch waits for; duplicates load once. A
          // ranged file with `preloadRanges` is: those ranges load first.
          const eager = new Set();
          for (const f of files) {
            const url = typeof f === 'string' ? f : f && f.url;
            const streamed = f && typeof f === 'object' &&
              (['lazy', 'background'].includes(f.loadMode) || (f.httpRange && f.loadMode !== 'required' && !f.preloadRanges)) && window.byteProvider;
            if (url && !streamed) eager.add(url);
          }
          if (ctx.launch && eager.size) {
            ctx.launch.beginBatch(`${appLabelFor(sel, app)} (${eager.size} file${eager.size === 1 ? '' : 's'})`,
              eager.size);
          }
          await wine.loadFiles(files, {
            required: !!app.requiredFiles,
            concurrency: app.fileConcurrency || 6,
            transfer: ctx.transfer,
            onProgress: ({ loaded, failed, total }) => {
              const done = loaded + failed;
              if (done === total || done === 1 || done % progressStride === 0) {
                const msg = `Loading data files ${done}/${total}${failed ? ` (${failed} failed)` : ''}`;
                document.getElementById('status').textContent = msg;
                log.textContent += msg + '\n';
                log.scrollTop = log.scrollHeight;
              }
            },
          }).catch(e => { failLaunch(e); throw e; });
          throwIfCancelled(ctx);
          log.textContent += `Data files mounted: ${files.length} (streamed files load on demand)\n`;
          log.scrollTop = log.scrollHeight;
        }
        if (deferWorkingDirectory &&
            !wine._helpCtx.vfs.setCurrentDirectory(app.workingDirectory)) {
          const e = new Error(`${sel}: working directory ${app.workingDirectory} is not mounted`);
          failLaunch(e);
          throw e;
        }
        if (app.persistFiles && window.VfsPersistence && wine._helpCtx && wine._helpCtx.vfs) {
          wine._vfsPersistence = window.VfsPersistence.attach(wine._helpCtx.vfs, {
            appId: sel,
            patterns: app.persistFiles,
            resetToken: app.persistReset,
            log: message => { log.textContent += message + '\n'; },
            onFlush: persistenceFlushReporter(wine, sel, log, runningApps),
          });
          if (wine._vfsPersistence.restored) {
            log.textContent += `Restored ${wine._vfsPersistence.restored} saved file(s)\n`;
          }
        }
        // After the restore, never before: the file being patched is the one
        // the guest will actually read, which is the player's own saved copy
        // when they have one.
        applyTouchPatches(app, wine._helpCtx && wine._helpCtx.vfs, log);
        if (app.winver && wine.hasGuestExport('set_winver')) {
          if (wine.threadManager && wine.threadManager.recordInheritedWasmGlobal) {
            wine.threadManager.recordInheritedWasmGlobal('set_winver', app.winver);
          }
          await wine.callGuest('set_winver', app.winver);
        }
        // COPY_RUN remains rollback-gated. A title opts in explicitly so its
        // exact recognizers are enabled before their first block is decoded.
        if (app.copySuperops && wine.hasGuestExport('set_loop_copy_emit')) {
          if (wine.threadManager && wine.threadManager.recordInheritedWasmGlobal) {
            wine.threadManager.recordInheritedWasmGlobal('set_loop_copy_emit', 1);
          }
          await wine.callGuest('set_loop_copy_emit', 1);
        }
        if (launchArgs) {
          wine._extraArgs = launchArgs;
          if (wine.guestWorker) {
            const bytes = new TextEncoder().encode(launchArgs);
            const staging = await wine.callGuest('get_staging');
            new Uint8Array(wine.memory.buffer).set(bytes, staging);
            await wine.callGuest('set_extra_cmdline', staging, bytes.length);
          } else {
            window.processBoot.setExtraCmdline(
              wine.instance.exports, wine.memory.buffer, launchArgs);
          }
        }
        // One list, shared with the CLI (lib/dll-registry.js), and one graph
        // walk (lib/process-boot.js). Both used to exist twice: this page knew
        // a 14-entry URL map and resolved only the EXE's own imports, so an app
        // needing SHELL32 — or the Kodak OI*400 set, which imports itself two
        // levels deep — booted headless and trapped here on the first
        // cross-DLL ordinal.
        const availableDlls = { ...window.dllRegistry.DLL_PATHS };
        wine._availableDllFiles = new Set(Object.keys(availableDlls));
        // App-local DLLs ship beside their exe, so a dependency named by
        // another DLL is looked up in this app's own `files` list too.
        // A files entry is either a URL or { url, vfsPath }.
        const appFileByName = new Map();
        for (const f of (app.files || [])) {
          const url = typeof f === 'string' ? f : (f && f.url);
          if (url) appFileByName.set(url.split('/').pop().toLowerCase(), url);
        }
        const mountedExeDir = /^[a-z]:[\\\/]/i.test(app.exe)
          ? app.exe.toLowerCase().replace(/\//g, '\\').replace(/\\[^\\]*$/, '')
          : null;
        const fetchDll = async (spec) => {
          const name = spec.split(/[\\/]/).pop();
          const url = spec.includes('/') ? spec
            : (availableDlls[name.toLowerCase()] || appFileByName.get(name.toLowerCase()));
          // A BYOM executable and its private DLLs already share a mounted
          // folder; they deliberately have no server URL or app.files entry.
          // Resolve that sibling before giving up, and materialize lazy ISO/
          // ZIP entries because the PE loader consumes the complete image.
          if (!url && mountedExeDir) {
            const vfs = wine._helpCtx && wine._helpCtx.vfs;
            const mountedPath = mountedExeDir + '\\' + name.toLowerCase();
            if (vfs && vfs.files.has(mountedPath)) {
              // Preserve where an app-local module actually lives. The PE
              // loader records this path for GetModuleFileName(hModule), and
              // old plug-in hosts use that answer to enumerate sibling files.
              // Retail Storm.dll, for example, derives
              // C:\Diablo\*.snp from its own module path; reporting the old
              // compatibility alias C:\storm.dll hides standard.snp and
              // makes single-player initialization fail after hero naming.
              return { name, path: mountedPath, bytes: await vfs.materialize(mountedPath) };
            }
          }
          if (!url) return null;
          try {
            return { name, bytes: await WineAssembly.fetchAssetBytes(url, ctx.transfer || {}) };
          } catch (error) {
            // An HTTP answer means "this host has no such DLL", which the
            // graph walk tolerates; Cancel and a dead network do not.
            if (!/HTTP \d{3}$|missing .*\.part\d+/.test(String(error && error.message))) throw error;
            console.error('Failed to fetch DLL:', url);
            return null;
          }
        };
        // How many DLLs the graph needs is only known once it has been walked,
        // so this batch never shows a percentage.
        if (ctx.launch) ctx.launch.beginBatch(`${appLabelFor(sel, app)} libraries`, null);
        const inheritedDlls = new Set((app.inheritedDlls || []).map(n => String(n).toLowerCase()));
        const missingDeclaredDlls = [];
        const dllsToLoad = await window.processBoot.resolveDllGraph({
          exeBytes: wine._exeBytes,
          seeds: app.dlls || [],
          isLoadable: name => inheritedDlls.has(String(name).toLowerCase()) ||
            window.dllRegistry.isLoadableDll(name),
          detectRequiredDlls: DllLoader && DllLoader.detectRequiredDlls,
          loadSpec: fetchDll,
          onLog: (msg) => { log.textContent += msg + '\n'; },
          // Say so in the page log, as the CLI does: a system DLL this host
          // cannot serve (test/binaries/dlls is gitignored, so a fresh
          // worktree has none) otherwise surfaces much later as a crash in
          // one of our built-in stubs, naming nothing that points back here.
          // One the app itself declares (`dlls`) fails the launch.
          onMissing: (name, spec, { seed } = {}) => {
            const msg = `DLL ${name}: not found (${spec}); its imports fall to built-in stubs`;
            log.textContent += msg + '\n';
            console.warn(msg);
            if (seed) missingDeclaredDlls.push(spec);
          },
        });
        if (missingDeclaredDlls.length) {
          const error = new Error(`declared DLL not found: ${missingDeclaredDlls.join(', ')}`);
          failLaunch(error);
          throw error;
        }
        throwIfCancelled(ctx);
        // Everything this launch had to download is in. Anything the running
        // app fetches later is its own business, not the launch window's.
        wine._launchTransfer = null;
        if (ctx.launch) ctx.launch.setPhase('loading');
        // The CLI reports NT to any app that pulls in MFC42U — the unicode MFC
        // never shipped on 9x, and an app that finds Win98 under it takes a
        // different path. The page only honoured an explicit `winver` in the
        // registry, so a second NT app added there would have diverged silently.
        if (!app.winver && wine.hasGuestExport('set_winver') &&
            DllLoader && DllLoader.shouldReportNtForDlls &&
            DllLoader.shouldReportNtForDlls(dllsToLoad.map(d => d.name))) {
          const winver = 0x05650004;
          if (wine.threadManager && wine.threadManager.recordInheritedWasmGlobal) {
            wine.threadManager.recordInheritedWasmGlobal('set_winver', winver);
          }
          await wine.callGuest('set_winver', winver);
          log.textContent += 'Windows version: NT 4 (auto for MFC42U)\n';
        }
        if (dllsToLoad.length) {
          document.getElementById('status').textContent = 'Loading DLLs...';
          log.textContent += `Loading ${dllsToLoad.length} DLL(s)...\n`;
        }
        await wine.loadDlls(dllsToLoad).catch(e => { failLaunch(e); throw e; });
        throwIfCancelled(ctx);
        log.textContent += 'DLLs ready\n';
        // A child process's inherited std handles (host.js process_spawn):
        // installed after the image is in and before its first slice.
        if (launchOpts && typeof launchOpts.beforeRun === 'function') {
          await Promise.resolve(launchOpts.beforeRun(wine)).catch(e => { failLaunch(e); throw e; });
        }
        const runSliceAppKey = app.runSliceAppKey || sel;
        wine._runSliceAppKey = runSliceAppKey;
        const exeLeaf = String(app.exe || '').split(/[\\/]/).pop().toLowerCase();
        const profileExclusiveCrop = (typeof appProfiles !== 'undefined' &&
          appProfiles.EXCLUSIVE_CROPS) ? appProfiles.EXCLUSIVE_CROPS[exeLeaf] : null;
        if (sharedRenderer.setInputHooks) {
          sharedRenderer.setInputHooks(wine.processId, app.inputHooks || null);
        }
        runningApps.push({ wine, name: sel, appIndex, runSliceAppKey,
          // true / false are the registry's choice; undefined means follow the
          // guest at runtime (browser-input wantsRelativeMouse).
          relativeMouse: typeof app.relativeMouse === 'boolean' ? app.relativeMouse : undefined,
          hideHostCursor: app.hideHostCursor === true,
          mobileTouch: app.mobileTouch || 'auto',
          mobileCrop: app.mobileCrop || null,
          // `{ portrait, landscape }`; the renderer picks the one the stage is
          // actually in. Copied, not shared, so a running app can never write
          // back into the registry.
          mobileZoom: (app.mobileZoom && typeof app.mobileZoom === 'object')
            ? { portrait: +app.mobileZoom.portrait || 0,
                landscape: +app.mobileZoom.landscape || 0 } : null,
          exclusiveCrop: app.exclusiveCrop || profileExclusiveCrop || null,
          keepAspect: (typeof app.keepAspect === 'number' && app.keepAspect > 0)
            ? app.keepAspect : app.keepAspect === true,
          singleAppMaximize: app.singleAppMaximize !== false,
          singleAppMinDesktop: (app.singleAppMinDesktop && app.singleAppMinDesktop.w > 0 &&
            app.singleAppMinDesktop.h > 0)
            ? { w: +app.singleAppMinDesktop.w, h: +app.singleAppMinDesktop.h } : null,
          mdiCrop: app.mdiCrop === true,
          // The seat is known up front on a launch that arrives already wired
          // (the "both players here" case, and the second copy it spawns); the
          // on-demand path swaps this record's layout when the room answers.
          touchControls: touchControlsForSeat(app, lanLink && lanLink.address) });
        syncTouchControls();
        if (autoRoom && !lanRoom) startLanOffers(wine, app, sel, log, sharedRenderer);
        // Joined from the list at launch by a game with no launch arguments
        // for it (Blobby): the recipe walks it from its first screen (why 5).
        if (lanRoom && lanRoom.role === 'member' && !(app.lan.join && app.lan.join.launchArgs)) {
          runJoinRecipe(wine, app, sel, lanRoom, log, sharedRenderer, 5);
        }
        if (hostAfterLaunch && lanRoom && lanRoom.role === 'owner') {
          runHostRecipe(wine, app, sel, lanRoom, log, sharedRenderer);
        }
        // Registered, so it has an owner that can stop it; a later failure
        // must not tear down an app the visitor can see.
        createdWine = null;
        ctx.registered = true;
        if (ctx.launch) ctx.launch.setPhase('starting');
        onAppRunningChange(true);
        document.getElementById('status').textContent = `Running ${runningApps.length} app(s)`;
        if (typeof window.updateThreadsStatus === 'function') window.updateThreadsStatus();
        focusCanvasForLaunch(canvas);
        // guestWorker is final here: init() has either established the Worker
        // backend or fallen back. Never give the cooperative fallback Jazz's
        // Worker-sized quantum.
        const runSlice = selectedRunSlice(runSliceAppKey, !!wine.guestWorker);
        const rendererSlices = app.rendererRunSlices;
        if (rendererSlices && Number.isFinite(rendererSlices.software) &&
            Number.isFinite(rendererSlices.opengl)) {
          const applyRendererSlice = (renderer) => {
            const next = renderer === 'opengl'
              ? rendererSlices.opengl : rendererSlices.software;
            if (wine.stepsPerSlice === next) return;
            wine.stepsPerSlice = next;
            log.textContent += `Renderer run slice=${next} (${renderer})\n`;
            log.scrollTop = log.scrollHeight;
          };
          wine.onOpenGLContextCountChange = count => {
            if (count === 0) applyRendererSlice('software');
          };
          wine.onGuestFrame = frame => {
            if (frame && frame.kind === 'gpu') applyRendererSlice('opengl');
            else if (frame && frame.kind === 'directdraw') applyRendererSlice('software');
          };
          wine.onRegistryValueChanged = change => {
            if (!change || String(change.name).toLowerCase() !== 'enginetype' ||
                !/\\software\\valve\\hldemo\\settings$/i.test(String(change.path))) return;
            // Selecting Software writes EngineType before GoldSrc tears down
            // the old renderer and reconstructs the Video Modes UI. Dropping
            // to the 1k CPU-renderer quantum here makes that restart crawl and
            // leaves several partially painted dialogs visible long enough for
            // repeated clicks to queue another restart. Keep the 10k setup
            // quantum until an actual DirectDraw frame proves Software is
            // running; the onGuestFrame hook above performs that handoff. The
            // OpenGL write can raise the budget immediately so its restart is
            // fed without waiting for the first GPU present.
            if (Number(change.data) === 2) applyRendererSlice('opengl');
          };
        }
        log.textContent += `Starting run slice=${runSlice}\n`;
        log.scrollTop = log.scrollHeight;
        wine.run(runSlice);
        wine.startBackgroundAssets();
        scheduleStartupDialogDismiss(app, wine);
        scheduleStartupInput(app, wine);
        maximizeForSingleApp(wine);
        if (app.mdiCrop === true) maximizeMdiChildrenForSingleApp(wine);
        // A frozen page (?frozen, agent-stepped) runs nothing until stepped,
        // so its first window may never come on its own; the launch window
        // must not sit over the screenshots it exists to take.
        const frozen = !!(window.WineFrozen && window.WineFrozen.status &&
          window.WineFrozen.status().frozen);
        if (frozen && ctx.launch) { ctx.retained.clear(); ctx.launch.ready(); }
        releaseBootCursorOnFirstWindow(wine, reason => {
          bootDone();
          ctx.retained.clear();
          if (!ctx.launch) return;
          // The first usable window: the launch window goes on this frame,
          // however briefly it was up. An app that ended first has nothing
          // to show, and a Cancel already said what happened.
          if (reason === 'window') { ctx.retained.clear(); ctx.launch.ready(); }
          else ctx.launch.dismiss();
        });
      } else {
        bootDone();
        document.getElementById('status').textContent = 'Failed to load';
        if (ctx.launch) {
          ctx.launch.fail({
            title: appLabelFor(sel, app),
            heading: `${appLabelFor(sel, app)} could not be started.`,
            message: 'The program file could not be loaded.',
            retry: false,
            retryKeeps: false,
          });
        }
      }
    }

    // ShellExecute("wordpad.exe") — a guest asking the shell to start another
    // program. WRITE.EXE is nothing but that call, and several Win98 apps
    // hand off to a sibling the same way, so the exe name has to resolve
    // against the same registry the desktop icons read. Match the app key
    // first ("wordpad"), then any registered app whose exe basename matches
    // ("mspaint.exe" -> mspaint98 if that is how it is registered). An app
    // whose files this host does not serve never matches: a guest starting
    // some "setup.exe" resolved to the local-only Moorhuhn 3 puzzle on the
    // deployed site and failed its launch with a 404.
    function appKeyForExe(fileName) {
      const base = String(fileName || '').replace(/\\/g, '/').split('/').pop().toLowerCase();
      if (!base) return null;
      const stem = base.endsWith('.exe') ? base.slice(0, -4) : base;
      if (apps[stem] && !unservedApps.has(stem)) return stem;
      for (const key of Object.keys(apps)) {
        if (unservedApps.has(key)) continue;
        const exe = String((apps[key] || {}).exe || '')
          .replace(/\\/g, '/').split('/').pop().toLowerCase();
        if (exe && (exe === base || exe === stem + '.exe')) return key;
      }
      return null;
    }

    // Launch by exe name. Returns true when the name resolved — the launch
    // itself is async and the caller (a synchronous host import) cannot wait
    // for it. In single-app mode the launcher process is usually still in
    // runningApps at this instant (write.exe calls ShellExecute and only then
    // returns into ExitProcess), so hold the launch until the list drains
    // instead of letting launchApp decline it.
    function launchExe(fileName) {
      const key = appKeyForExe(fileName);
      if (!key) {
        appendDebugLog(`[ShellExecute] no registered app for "${fileName}"`);
        return false;
      }
      if (launchInFlight || (SINGLE_APP() && runningApps.length)) {
        queuePendingLaunch(key, SINGLE_APP());
        return true;
      }
      api.launchApp(key);
      return true;
    }

    // ShellExecute("C:\Diablo\diablo.exe") — a guest naming a program that
    // exists only in its own VFS, the way the Diablo CD launcher hands off to
    // the game its installer wrote a moment earlier. No registered app can
    // answer that, and the new process must see the SAME filesystem, so the
    // caller's VFS is adopted wholesale into the fresh instance the launch
    // creates. `workDir` is ShellExecute's lpDirectory; the exe's own
    // directory is the Win98 default when the caller passed none.
    function launchVfsExe(fileName, callerWine, workDir, args, launchOpts) {
      // DX2-era installers commonly offer to replace video/audio drivers even
      // after setup has completed. Wine-Assembly exposes the newer DirectX 7
      // runtime and advertises it in HKLM, so accept the obsolete redistributable
      // as an already-satisfied launch instead of booting a driver installer.
      if (/(?:^|[\\/])dxsetup\.exe$/i.test(String(fileName || ''))) {
        appendDebugLog(`[ShellExecute] skipped obsolete DirectX setup "${fileName}"`);
        // War Wind makes that offer from its final completion dialog. Its
        // 16-bit bootstrap cannot observe the separately emulated installer
        // child exiting, so it otherwise resurfaces its old 39% progress
        // window forever. The installed game is already complete at this
        // point; hand it the same VFS after the synchronous WinExec returns.
        const installerVfs = callerWine && callerWine._helpCtx && callerWine._helpCtx.vfs;
        const warWindExe = 'c:\\program files\\warwind\\ww.exe';
        if (installerVfs && installerVfs.files instanceof Map &&
            installerVfs.files.has(warWindExe)) {
          queueMicrotask(() => {
            appendDebugLog('[ShellExecute] starting installed War Wind after setup');
            launchVfsExe(warWindExe, callerWine, 'C:\\Program Files\\WarWind\\', '');
          });
        }
        return true;
      }
      const callerVfs = callerWine && callerWine._helpCtx && callerWine._helpCtx.vfs;
      const vfs = callerVfs || lastExitedVfs;
      if (!vfs || typeof vfs._normPath !== 'function' || !(vfs.files instanceof Map)) return false;
      const candidate = workDir && workDir.trim() && !/^[a-z]:[\\/]/i.test(fileName)
        ? workDir.replace(/[\\/]$/, '') + '\\' + fileName
        : fileName;
      const norm = typeof vfs._resolvePath === 'function'
        ? vfs._resolvePath(candidate)
        : vfs._normPath(candidate);
      if (!vfs.files.has(norm)) return false;
      const base = norm.split('\\').pop();
      const key = 'vfs:' + norm;
      const cwd = (workDir && workDir.trim())
        || norm.replace(/\\[^\\]*$/, '') + '\\';
      const snapshot = snapshotVfs(vfs);
      // An installed child is still the same workload as the mounted app
      // that spawned it. Preserve that Auto run-slice identity through
      // wrapper -> localized installer -> game handoffs; otherwise Speed
      // Demons drops from 500k to the generic 100k and shows a long black
      // transition between its logo and menu.
      const runSliceAppKey = (callerWine && callerWine._runSliceAppKey)
        || (!callerVfs ? lastExitedRunSliceAppKey : null);
      // Always a fresh entry: the closure holds the *calling* process's VFS,
      // and a second chain-launch in a later session has a different one.
      apps[key] = installedAppEntry(norm, snapshot, cwd, args, callerWine, runSliceAppKey);
      // A child process (host.js process_spawn) carries options the pending
      // queue would drop, and must not wait for its parent to exit: wait out
      // only a boot already in flight, then launch with them.
      if (launchOpts) {
        const go = () => {
          if (launchInFlight) { setTimeout(go, 100); return; }
          api.launchApp(key, launchOpts);
        };
        go();
        return true;
      }
      if (launchInFlight || (SINGLE_APP() && runningApps.length)) {
        queuePendingLaunch(key, SINGLE_APP());
        return true;
      }
      api.launchApp(key);
      return true;
    }

    // A program that lives only in a guest filesystem: launched from inside
    // `snapshot` (an exited or calling process's VFS), with the timing traits
    // of the workload that produced it.
    function installedAppEntry(norm, snapshot, cwd, args, callerWine, runSliceAppKey) {
      return {
        exe: norm,
        dynamic: true,
        badge: 'session',
        label: norm.split('\\').pop().replace(/\.exe$/i, ''),
        runSliceAppKey,
        // Installed children inherit timing semantics from the disc/setup
        // workload that produced them. Diablo's Storm provider, for example,
        // cannot finish SNet initialization without its timeSetEvent callback.
        asyncMultimediaTimer: !!(callerWine && callerWine.asyncMultimediaTimer),
        mmTimerThread: callerWine ? callerWine.mmTimerThread !== false : true,
        x87Fusion: callerWine ? callerWine.x87Fusion !== false : true,
        nullPageFaults: !!(callerWine && callerWine.nullPageFaults),
        // instmsi's msiinst child runs msiexec children of its own.
        spawnProcesses: !!(callerWine && callerWine.spawnProcesses),
        uop: callerWine ? callerWine.uop !== false : true,
        aggressiveStack: !!(callerWine && callerWine.aggressiveStack),
        threads: callerWine ? callerWine.threads !== false : true,
        cpuSSE: !!(callerWine && callerWine.cpuSSE),
        // The app-private DLLs the caller runs as real PEs. A detected import
        // only loads when the registry knows it (isLoadableDll), and these
        // came in as the caller's `dlls` seeds, which a child does not have:
        // Unreal Tournament's first-run wizard starts C:\app.exe testrendev=…
        // per renderer, and that child bound Core/Engine/Window.dll to stubs
        // and trapped on ?appPackage@@YAPBGXZ. Only names the child's own
        // import graph reaches are loaded, from the child's filesystem.
        // Both sources: moduleBases is filled from the in-process loader's
        // results only, and the Worker backend's loadDlls results carry no
        // names, so with Threads on it stays empty.
        inheritedDlls: callerWine
          ? [...new Set([
            ...Object.keys(callerWine.moduleBases || {}),
            ...Object.keys(callerWine._loadedDllBytesByName || {}),
          ])].filter(n => /\.dll$/i.test(n))
          : undefined,
        args: args && args.trim() ? args : undefined,
        mounts: [async (newVfs) => {
          newVfs.adoptFrom(snapshot);
          if (cwd) newVfs.cwd = /\\$/.test(cwd) ? cwd : cwd + '\\';
          // `root` becomes the shell's "Mounted <root>" line; this mount is
          // an inherited filesystem, not a disc, so say that.
          return { root: `caller's filesystem (${snapshot.files.size} entries)` };
        }],
        exeBytes: async (newVfs) => newVfs.materialize(norm),
      };
    }

    // Shortcuts a guest put on the Windows desktop become desktop icons for
    // the rest of the session. An installer (NFS II's InstallShield, Inno
    // Setup) saves C:\WINDOWS\Desktop\<Game>.lnk; the installed program exists
    // only in the exited installer's filesystem, so each icon is bound to that
    // snapshot and launches from it, as a chain-launch would. When the
    // installer ran from kept media, its C: changes are in that media's OPFS
    // journal, so each item also carries what lib/media-import-ui.js needs to
    // save the icon on the media's catalog row and bring it back after a
    // reload (lib/installed-shortcuts.js), plus a `saved` promise that says
    // whether the installed files really reached that journal.
    const shortcutListeners = [];
    function onGuestShortcuts(listener) {
      if (typeof listener === 'function') shortcutListeners.push(listener);
    }

    // The Start Menu counts too: answering "No" to InstallShield's "add a
    // shortcut to the desktop?" still leaves Start Menu\Programs\<Group>\
    // <Game>.lnk, and setup then says to run the game "from the Start Menu",
    // which this shell does not have. Only programs the install put outside
    // C:\WINDOWS qualify there (a Read Me item is Notepad), and uninstallers
    // never do. A desktop shortcut wins when both name the same program.
    const DESKTOP_LINK = /^c:\\windows\\desktop\\[^\\]+\.lnk$/;
    const START_MENU_LINK = /^c:\\windows\\start menu\\programs\\(?!startup\\).+\.lnk$/;
    const UNINSTALLER = /^(uninst|unins\d|isuninst|_isdel|unwise|uninstall)/i;

    // The shortcut's own IconLocation first -- an installer points it at an
    // .ico when the program has no icon resource (NFS II SE's nfs2sen.exe has
    // no .rsrc at all) -- then the target's icon. IconIndex is ignored: the
    // desktop shows one icon per program, and the first group is the one
    // Explorer shows for the file itself.
    function shortcutIconUrl(snapshot, link, exe) {
      const fromPe = bytes => (typeof window.iconDataURLFromBytes === 'function'
        && window.iconDataURLFromBytes(bytes)) || null;
      try {
        const location = link.iconLocation && snapshot.files.get(snapshot._normPath(link.iconLocation));
        if (location && location.data) {
          const url = /\.ico$/i.test(link.iconLocation)
            ? (typeof window.icoDataURLFromBytes === 'function' && window.icoDataURLFromBytes(location.data)) || null
            : fromPe(location.data);
          if (url) return url;
        }
        return fromPe(exe.data);
      } catch (_) {
        return null;
      }
    }

    function publishGuestShortcuts(snapshot, exitedWine) {
      const parse = window.ShellLink && window.ShellLink.parseShellLink;
      if (!parse || !snapshot || !(snapshot.files instanceof Map)) return [];
      const found = [];
      const links = [];
      for (const [path, entry] of snapshot.files) {
        if (!entry) continue;
        if (DESKTOP_LINK.test(path)) links.push({ path, entry, desktop: true });
        else if (START_MENU_LINK.test(path)) links.push({ path, entry, desktop: false });
      }
      links.sort((a, b) => (b.desktop - a.desktop) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      const seen = new Set();
      for (const { path, entry, desktop } of links) {
        let link = null;
        try { link = parse(entry.data); } catch (_) { link = null; }
        if (!link || !/\.exe$/i.test(link.target)) continue;
        const norm = snapshot._normPath(link.target);
        const exe = snapshot.files.get(norm);
        if (!exe || seen.has(norm)) continue;
        const linkName = path.split('\\').pop();
        if (!desktop && (/^c:\\windows\\/.test(norm)
            || UNINSTALLER.test(norm.split('\\').pop()) || UNINSTALLER.test(linkName))) continue;
        seen.add(norm);
        const cwd = link.workingDir || norm.replace(/\\[^\\]*$/, '') + '\\';
        const keptMediaId = exitedWine && exitedWine._keptMediaId || null;
        const key = keptMediaId && window.InstalledShortcuts
          ? window.InstalledShortcuts.appIdFor(keptMediaId, norm) : 'lnk:' + norm;
        apps[key] = installedAppEntry(norm, snapshot, cwd, link.args, exitedWine,
          exitedWine && exitedWine._runSliceAppKey || null);
        // The VFS keeps names lowercased; a description that spells the same
        // name gives the label its case back ("Need For Speed II SE").
        const bareName = linkName.replace(/\.lnk$/i, '');
        apps[key].label = link.description && link.description.toLowerCase() === bareName.toLowerCase()
          ? link.description : bareName;
        const iconUrl = shortcutIconUrl(snapshot, link, exe);
        appendDebugLog(`[shortcut] ${apps[key].label} -> ${link.target}`);
        const item = { appId: key, label: apps[key].label, iconUrl };
        if (keptMediaId) {
          const traits = {};
          for (const name of ['asyncMultimediaTimer', 'mmTimerThread', 'x87Fusion', 'nullPageFaults', 'uop', 'aggressiveStack', 'threads', 'cpuSSE']) {
            if (typeof apps[key][name] === 'boolean') traits[name] = apps[key][name];
          }
          Object.assign(item, { mediaId: keptMediaId, target: norm, cwd, args: link.args || null, traits });
        }
        found.push(item);
      }
      if (found.some(item => item.mediaId)) {
        // Saved means the journal holds every change the installer made. A
        // flush that fails leaves dirty paths behind, and then the icon stays
        // a session icon rather than promising a program a reload cannot find.
        const overlay = exitedWine._vfsOverlay;
        const saved = Promise.resolve(exitedWine._flushVfsOverlay && exitedWine._flushVfsOverlay('shortcuts'))
          .then(() => !!overlay && !overlay.dirtyPaths().length, () => false);
        for (const item of found) if (item.mediaId) item.saved = saved;
      }
      if (found.length) {
        for (const listener of shortcutListeners) {
          try { listener(found); } catch (e) { appendDebugLog(`[shortcut] ${e && e.message || e}`); }
        }
      }
      return found;
    }

    // `wine` and `sharedRenderer` are reassigned on every launch, so they are
    // published as live views rather than copied out once. launchExe goes
    // through `api.launchApp` rather than the local binding so a caller that
    // replaces launchApp (tests, a future single-app policy) is honoured.
    const api = {
      runningApps,
      appKeyForExe,
      launchExe,
      launchVfsExe,
      onGuestShortcuts,
      sharedAudioMixer,
      get currentWine() { return wine; },
      // index.html's one-time isolation reload must not cut a boot short.
      get launchInFlight() { return launchInFlight; },
      get renderer() { return sharedRenderer; },
      launchApp,
      stopRunningApp,
      stopAllApps,
      releaseForPageHide,
      unregisterRunningApp,
      joinPageSegment,
      selectedRunSlice,
      applyRunSlice,
      singleApp: SINGLE_APP,
      maximizeForSingleApp,
      firstTopLevelWindow: wine => firstTopLevelWindow(sharedRenderer, wine),
      bootTicket,
      releaseBootCursorOnFirstWindow,
      get bootsInFlight() { return bootsInFlight; },
      scheduleStartupDialogDismiss,
      scheduleStartupInput,
    };
    return api;
  }

  const browserShell = {
    createBrowserShell,
    persistenceFlushReporter,
    firstTopLevelWindow,
    crashReportText,
    showCrashReport,
    applyTouchPatches,
    touchControlsForSeat,
    resumeAfterSignIn,
    showShareCard,
    showLanOverCard,
    // The 🌐 session chip, driven without a game or a network by
    // test/test-web-lan-chip.js: show(text, holdMs), attach(wine, room, app,
    // sel), clear().
    lanSessionChip: { show: showLanChip, attach: attachLanChip, clear: clearLanNotices },
    accountUser,
    accountSignIn,
    accountSignOut,
    onAccountChange,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = browserShell;
  if (typeof window !== 'undefined') window.browserShell = browserShell;
})();

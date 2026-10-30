// Installed-game shortcuts that survive a reload.
//
// An installer run from kept media (lib/media-library.js) writes the game into
// that media's durable C:\ overlay (lib/vfs-overlay.js + OverlayStore.opfsStore)
// and leaves a .lnk on the guest desktop. lib/browser-shell.js turns the .lnk
// into a desktop icon when the installer exits; this file is the part that
// lets that icon come back on the next visit:
//
//   - what is stored: one small record per shortcut on the media's catalog
//     row (`row.shortcuts`), written only after the installed files reached
//     the durable overlay;
//   - how it is checked on restore: a C:\ target must still be a file in that
//     overlay (a deleted or never-saved install drops the icon rather than
//     offering a program that is not there); a target on the media's own
//     drive lives on the kept disc and stays;
//   - what the icon launches: the kept media plus its overlay, starting the
//     installed exe instead of the media's own.
//
// Pure functions, no DOM and no storage: lib/media-import-ui.js does the I/O.
(function () {
  const MAX_SHORTCUTS = 32;
  const MAX_ICON_URL = 64 * 1024;
  const MAX_TEXT = 260;
  // Entry traits installedAppEntry() inherits from the installer; kept so a
  // restored icon starts the game the way the same-session icon did.
  const TRAITS = ['asyncMultimediaTimer', 'mmTimerThread', 'x87Fusion', 'uop', 'aggressiveStack', 'threads', 'cpuSSE'];

  function normPath(path) {
    return String(path || '').replace(/\//g, '\\').toLowerCase();
  }

  function withSlash(dir) {
    return dir && !dir.endsWith('\\') ? dir + '\\' : dir;
  }

  function appIdFor(mediaId, target) {
    return 'lnk:' + mediaId + ':' + normPath(target);
  }

  function text(value) {
    return typeof value === 'string' && value.length <= MAX_TEXT ? value : '';
  }

  // The record kept on the catalog row, or null when the item is not one this
  // feature may persist. The icon is optional: an oversized or non-image URL
  // is dropped, never the shortcut.
  function persistableShortcut(item) {
    if (!item || typeof item !== 'object') return null;
    const target = normPath(item.target);
    if (!/^[a-z]:\\.+\.exe$/.test(target) || target.length > MAX_TEXT) return null;
    const iconUrl = typeof item.iconUrl === 'string' && item.iconUrl.length <= MAX_ICON_URL &&
      /^data:image\/(png|bmp|x-icon|vnd\.microsoft\.icon);base64,/.test(item.iconUrl) ? item.iconUrl : null;
    const traits = {};
    for (const name of TRAITS) {
      if (item.traits && typeof item.traits[name] === 'boolean') traits[name] = item.traits[name];
    }
    return {
      target,
      cwd: withSlash(normPath(text(item.cwd))) || target.replace(/\\[^\\]*$/, '\\'),
      args: text(item.args) || null,
      label: text(item.label) || target.split('\\').pop().replace(/\.exe$/, ''),
      iconUrl,
      traits,
      savedAt: Number.isFinite(item.savedAt) ? item.savedAt : Date.now(),
    };
  }

  // One shortcut per target: a reinstall replaces the old record (newest
  // label/icon wins) instead of adding a second icon for the same program.
  function mergeShortcuts(existing, incoming) {
    const byTarget = new Map();
    for (const list of [existing || [], incoming || []]) {
      for (const raw of list) {
        const record = persistableShortcut(raw);
        if (!record) continue;
        byTarget.delete(record.target);
        byTarget.set(record.target, record);
      }
    }
    return [...byTarget.values()].slice(-MAX_SHORTCUTS);
  }

  // Which stored shortcuts still point at something. `overlayRecords` is the
  // media's overlay journal listing ({path, kind}); null means it could not be
  // read, and then nothing is shown and nothing is pruned.
  function restorable(shortcuts, overlayRecords, mediaDrive) {
    const keep = [];
    const drop = [];
    const list = mergeShortcuts([], shortcuts);
    if (!Array.isArray(overlayRecords)) return { keep: [], drop: [], unknown: list };
    const kinds = new Map(overlayRecords.map(r => [normPath(r && r.path), r && r.kind]));
    const drive = mediaDrive ? normPath(mediaDrive).slice(0, 1) : null;
    for (const sc of list) {
      const kind = kinds.get(sc.target);
      if (kind === 'file') keep.push(sc);
      else if (kind === 'whiteout') drop.push(sc);
      else if (drive && sc.target[0] === drive && drive !== 'c') keep.push(sc);
      else drop.push(sc);
    }
    return { keep, drop, unknown: [] };
  }

  // The app entry a restored icon launches: the kept media's mounts, its
  // durable overlay (attached by browser-shell because badge is 'kept' with a
  // mediaId), and the installed exe.
  function entryFor(row, shortcut, keptMount) {
    return {
      exe: shortcut.target,
      dynamic: true,
      badge: 'kept',
      mediaId: row.id,
      mediaKind: 'exe',
      mediaName: row.name,
      installedFrom: row.id,
      label: shortcut.label,
      workingDirectory: shortcut.cwd,
      args: shortcut.args || undefined,
      ...shortcut.traits,
      mounts: [keptMount],
      exeBytes: async (vfs) => vfs.materialize(shortcut.target),
    };
  }

  const api = { MAX_SHORTCUTS, MAX_ICON_URL, appIdFor, normPath, persistableShortcut,
    mergeShortcuts, restorable, entryFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.InstalledShortcuts = api;
})();

// Read a Windows shortcut (.lnk, MS-SHLLINK) far enough to launch it: the
// target path, working directory, arguments and description. Installers make
// these with IShellLink + IPersistFile::Save (src/09a7-handlers-dispatch.wat
// writes the LinkInfo/StringData form), and the browser desktop turns the
// ones that land in C:\WINDOWS\Desktop into icons for the installed program.
//
// Only the local-path form is read: a LinkInfo LocalBasePath (+ suffix), or a
// relative path as a fallback. An ID list is skipped, never decoded, so a link
// that names its target only by PIDL reports no target.
(function (root) {
  'use strict';

  const HAS_ID_LIST = 0x01;
  const HAS_LINK_INFO = 0x02;
  const HAS_NAME = 0x04;
  const HAS_RELATIVE_PATH = 0x08;
  const HAS_WORKING_DIR = 0x10;
  const HAS_ARGUMENTS = 0x20;
  const HAS_ICON_LOCATION = 0x40;
  const IS_UNICODE = 0x80;

  function cString(bytes, at, end) {
    let out = '';
    for (let i = at; i < end && bytes[i]; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function parseShellLink(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (bytes.length < 0x4C) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== 0x4C || dv.getUint32(4, true) !== 0x00021401) return null;
    const flags = dv.getUint32(0x14, true);
    let at = 0x4C;
    if (flags & HAS_ID_LIST) {
      if (at + 2 > bytes.length) return null;
      at += 2 + dv.getUint16(at, true);
    }
    let target = '';
    if (flags & HAS_LINK_INFO) {
      if (at + 0x1C > bytes.length) return null;
      const size = dv.getUint32(at, true);
      const end = Math.min(bytes.length, at + size);
      const infoFlags = dv.getUint32(at + 8, true);
      if (infoFlags & 1) {
        const base = cString(bytes, at + dv.getUint32(at + 16, true), end);
        const suffixOff = dv.getUint32(at + 24, true);
        const suffix = suffixOff ? cString(bytes, at + suffixOff, end) : '';
        target = suffix ? base.replace(/\\?$/, '\\') + suffix : base;
      }
      at += size;
    }
    const strings = {};
    const unicode = (flags & IS_UNICODE) !== 0;
    for (const [bit, key] of [[HAS_NAME, 'description'], [HAS_RELATIVE_PATH, 'relativePath'],
      [HAS_WORKING_DIR, 'workingDir'], [HAS_ARGUMENTS, 'args'], [HAS_ICON_LOCATION, 'iconLocation']]) {
      if (!(flags & bit)) continue;
      if (at + 2 > bytes.length) break;
      const count = dv.getUint16(at, true);
      at += 2;
      const width = unicode ? 2 : 1;
      if (at + count * width > bytes.length) break;
      let text = '';
      for (let i = 0; i < count; i++) {
        text += String.fromCharCode(unicode ? dv.getUint16(at + i * 2, true) : bytes[at + i]);
      }
      strings[key] = text;
      at += count * width;
    }
    return {
      target: target || strings.relativePath || '',
      workingDir: strings.workingDir || '',
      args: strings.args || '',
      description: strings.description || '',
      iconLocation: strings.iconLocation || '',
      iconIndex: dv.getInt32(0x38, true),
      showCmd: dv.getUint32(0x3C, true),
    };
  }

  const api = { parseShellLink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShellLink = api;
})(typeof window !== 'undefined' ? window : this);

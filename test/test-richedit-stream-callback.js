#!/usr/bin/env node
// RichEdit EM_STREAMIN regression, including the compatibility direct-cookie
// shape and the RTF-to-visible-text projection used by Win9x-era dialogs.

'use strict';

const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EM_STREAMIN = 0x0449;
const SF_TEXT = 0x0001;
const SF_RTF = 0x0002;

async function main() {
  const wasm = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = {
    getMemory: () => memory.buffer,
    renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} },
    onExit: () => {},
  };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.create_thread = () => 0;
  imports.host.exit_thread = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.create_event = () => 0;
  imports.host.set_event = () => 0;
  imports.host.reset_event = () => 0;
  imports.host.wait_single = () => 0;
  imports.host.wait_multiple = () => 0;
  imports.host.com_create_instance = () => 0x80004002;

  const { instance } = await WebAssembly.instantiate(wasm, imports);
  ctx.exports = instance.exports;
  const e = instance.exports;
  const u8 = new Uint8Array(memory.buffer);
  const wa = g => g - e.get_image_base() + e.get_guest_base();

  function allocAscii(text) {
    const g = e.guest_alloc(text.length + 1);
    const w = wa(g);
    for (let i = 0; i < text.length; i++) u8[w + i] = text.charCodeAt(i);
    u8[w + text.length] = 0;
    return g;
  }

  function readText(hwnd) {
    const len = e.get_edit_text_len(hwnd);
    const out = e.guest_alloc(len + 1);
    e.get_edit_text(hwnd, out, len + 1);
    return Buffer.from(u8.subarray(wa(out), wa(out) + len)).toString('latin1');
  }

  function streamDirect(hwnd, flags, text) {
    const source = allocAscii(text);
    const stream = e.guest_alloc(12);
    e.guest_write32(stream, source);
    e.guest_write32(stream + 4, 0);
    e.guest_write32(stream + 8, 0);
    return e.send_message(hwnd, EM_STREAMIN, flags, stream);
  }

  function streamCallback(hwnd, text, flags = SF_TEXT, callbackError = 0) {
    const source = allocAscii(text);
    const cookie = e.guest_alloc(12);
    e.guest_write32(cookie, source);
    e.guest_write32(cookie + 4, text.length);
    e.guest_write32(cookie + 8, 0);

    // stdcall callback: cookie={source,length,offset}. Respect each cb request,
    // advance the offset, and report zero bytes at EOF.
    const codeBytes = Buffer.from([
      0x56,0x57,0x53,                    // push esi, edi, ebx
      0x8b,0x54,0x24,0x10,              // edx=cookie
      0x8b,0x4a,0x04,0x8b,0x5a,0x08,    // ecx=length, ebx=offset
      0x29,0xd9,                         // ecx-=offset
      0x3b,0x4c,0x24,0x18,0x76,0x04,    // if remaining<=cb keep it
      0x8b,0x4c,0x24,0x18,              // otherwise ecx=cb
      0x89,0xc8,0x8b,0x32,0x01,0xde,    // eax=count; esi=source+offset
      0x8b,0x7c,0x24,0x14,              // edi=buffer
      0x01,0x42,0x08,0xf3,0xa4,         // offset+=count; rep movsb
      0x8b,0x54,0x24,0x1c,0x89,0x02,    // *pcb=count
      0xb8,callbackError,0,0,0,          // return callback status
      0x5b,0x5f,0x5e,                    // restore registers
      0xc2,0x10,0x00,
    ]);
    const callback = e.guest_alloc(codeBytes.length);
    u8.set(codeBytes, wa(callback));
    const stack = e.guest_alloc(8192);
    e.set_esp(stack + 8192 - 16);

    const stream = e.guest_alloc(12);
    e.guest_write32(stream, cookie);
    e.guest_write32(stream + 4, 0);
    e.guest_write32(stream + 8, callback);
    const result = e.send_message(hwnd, EM_STREAMIN, flags, stream);
    return { result, error: e.guest_read32(stream + 4), bytesConsumed: e.guest_read32(cookie + 8) };
  }

  let passed = 0;
  let failed = 0;
  function check(name, ok, detail = '') {
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? 'PASS  ' : 'FAIL  '}${name}${detail ? `  (${detail})` : ''}`);
  }

  const style = 0x50000004; // WS_CHILD | WS_VISIBLE | ES_MULTILINE
  const edit = e.test_create_richedit(1, style, 0);
  const plainLen = streamDirect(edit, SF_TEXT, 'plain stream text');
  check('direct-cookie SF_TEXT populates the control',
    plainLen === 17 && readText(edit) === 'plain stream text',
    `len=${plainLen} text=${JSON.stringify(readText(edit))}`);

  const callbackResult = streamCallback(edit, 'callback stream text');
  check('documented EDITSTREAM callback populates the control',
    callbackResult.result === 20 && callbackResult.error === 0 &&
      callbackResult.bytesConsumed === 20 && readText(edit) === 'callback stream text',
    `${JSON.stringify(callbackResult)} text=${JSON.stringify(readText(edit))}`);

  const bareRtfLen = streamDirect(edit, SF_RTF, 'bare visible');
  check('SF_RTF retains bare visible bytes',
    bareRtfLen === 12 && readText(edit) === 'bare visible',
    `len=${bareRtfLen} text=${JSON.stringify(readText(edit))}`);

  const minimalRtfLen = streamDirect(edit, SF_RTF, '{\\rtf1 Visible}');
  check('SF_RTF retains text after the document header',
    readText(edit).includes('Visible'),
    `len=${minimalRtfLen} text=${JSON.stringify(readText(edit))}`);

  const rtf = "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}Visible \\'ae text\\par Second line}";
  const rtfLen = streamDirect(edit, SF_RTF, rtf);
  const projected = readText(edit);
  check('SF_RTF projects visible document text',
    projected.includes('Visible ® text') && projected.includes('Second line'),
    `len=${rtfLen} text=${JSON.stringify(projected)}`);
  check('SF_RTF drops formatting destinations',
    !projected.includes('fonttbl') && !projected.includes('Arial'),
    JSON.stringify(projected));

  // Word-produced font tables (including Aranna's original licence) contain
  // nested starred destinations. Closing one must not expose its parent's text.
  const nestedFonts = String.raw`{\rtf1{\fonttbl{\f0\froman{\*\panose 02020603050405020304}Times New Roman;}{\f1 Arial{\*\falt Alternate Name};}}Readable licence\par Next paragraph}`;
  streamDirect(edit, SF_RTF, nestedFonts);
  check('nested starred destinations preserve the outer font-table skip',
    readText(edit) === 'Readable licence\nNext paragraph', JSON.stringify(readText(edit)));

  const nestedKnown = String.raw`{\rtf1{\*\unknown hidden{\info nested}still hidden}Visible{\colortbl;\red255;} tail}`;
  streamDirect(edit, SF_RTF, nestedKnown);
  check('nested known destinations preserve an outer unknown destination skip',
    readText(edit) === 'Visible tail', JSON.stringify(readText(edit)));

  const longRtf = '{\\rtf1{\\*\\listtable ' + 'x'.repeat(110000) + '}Readable body after metadata}';
  const longResult = streamCallback(edit, longRtf, SF_RTF);
  check('RTF callback reads past 64KiB metadata to EOF',
    longResult.error === 0 && longResult.bytesConsumed === longRtf.length &&
      readText(edit) === 'Readable body after metadata',
    JSON.stringify({ ...longResult, text: readText(edit) }));

  const failedChunk = streamCallback(edit, 'failed callback data', SF_TEXT, 123);
  check('callback errors discard that callback buffer and preserve dwError',
    failedChunk.error === 123 && failedChunk.result === 0 && readText(edit) === '',
    JSON.stringify({ ...failedChunk, text: readText(edit) }));

  console.log(`${passed}/${passed + failed} checks passed`);
  if (failed) process.exit(1);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

// Game Maker 7/8 runners (Delphi) carry a TWebBrowser on their splash form,
// so every GM game activates CLSID_WebBrowser while its forms stream in.
// Without the class, Spelunky Classic died with EOleSysError before loading;
// with a site-less stub it died in TOleControl.SetParent's GetClientSite.
// This drives the blank control's contract natively (09a7l-webbrowser.wat):
// CoCreateInstance + interfaces, GetMiscStatus/extent/class id, and the
// client-site reference the object owns -- AddRef before publish, Release of
// the former site after, AddRef'd GetClientSite, Release on final Release --
// through the real OLE guest-callback continuation (operations 2 and 39).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const call = (name, n) => {
  const params = Array.from({ length: n }, (_, i) => `(param $a${i} i32)`).join(' ');
  const args = Array.from({ length: 5 }, (_, i) => i < n ? `(local.get $a${i})` : '(i32.const 0)').join(' ');
  return `(func (export "t_${name}") (param $esp i32) ${params} (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_${name} ${args} (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))`;
};
const extraWat = String.raw`
  (func (export "t_cocreate") (param $esp i32) (param $clsid i32) (param $iid i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_CoCreateInstance (local.get $clsid) (i32.const 0) (i32.const 1)
      (local.get $iid) (local.get $out) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  ${call('WebBrowser_QueryInterface', 3)}
  ${call('WebBrowser_Release', 1)}
  ${call('WebBrowserOleObject_GetMiscStatus', 3)}
  ${call('WebBrowserOleObject_GetExtent', 3)}
  ${call('WebBrowserOleObject_SetExtent', 3)}
  ${call('WebBrowserOleObject_GetUserClassID', 2)}
  ${call('WebBrowserOleObject_SetClientSite', 2)}
  ${call('WebBrowserOleObject_GetClientSite', 2)}
  ;; What CACA0011 does when the guest method returns: ESP is the context.
  (func (export "t_resume") (param $esp i32) (param $eax i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store offset=0 (global.get $reg_base) (local.get $eax))
    (call $ole_guest_callback_continue))
  (func (export "t_refcount") (param $this i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $this))))
  (func (export "t_type") (param $this i32) (result i32)
    (load.field DxObject type (call $dx_from_this (local.get $this))))
  (func (export "t_site") (param $this i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $this))))
  (func (export "t_ret_thunk") (result i32) (global.get $font_enum_ret_thunk))
`;

(async () => {
  let hostCreates = 0;
  const { exports: e, memory } = await bootRenderHarness({
    extraWat, fonts: 'none',
    extraHostOverrides: { com_create_instance: () => { hostCreates++; return 0x80040154; } },
  });
  const exe = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE loads');
  e.init_dx_com_thunks();

  const guid = words => { const p = e.guest_alloc(16) >>> 0; words.forEach((w, i) => e.guest_write32(p + 4 * i, w)); return p; };
  const CLSID_WebBrowser = guid([0x8856F961, 0x11D0340A, 0xC0006BA9, 0xA205D74F]);
  const IID_IOleObject = guid([0x00000112, 0, 0x000000C0, 0x46000000]);
  const IID_IWebBrowser2 = guid([0xD30C1661, 0x11D0CDAF, 0xC0003E8A, 0x6EE2C94F]);
  const IID_IDispatch = guid([0x00020400, 0, 0x000000C0, 0x46000000]);
  const IID_IPersistStreamInit = guid([0x7FD52380, 0x101B4E07, 0x00082DAE, 0x13C72E2B]);
  const IID_IOleControl = guid([0xB196B288, 0x101ABAB4, 0xAA009CB6, 0x071D3400]);
  const IID_IConnectionPointContainer = guid([0xB196B284, 0x101ABAB4, 0xAA009CB6, 0x071D3400]);
  const out = e.guest_alloc(16) >>> 0;
  const stackBase = e.guest_alloc(1024) >>> 0;
  const ESP = stackBase + 768;
  const RET = 0x00401234;
  // A fresh call frame: [ESP] = return address, arguments above it.
  const frame = () => { e.guest_write32(ESP, RET); return ESP; };

  assert.strictEqual(e.t_cocreate(frame(), CLSID_WebBrowser, IID_IOleObject, out) >>> 0, 0,
    'CoCreateInstance(CLSID_WebBrowser, IID_IOleObject) succeeds');
  assert.strictEqual(hostCreates, 0, 'created natively, not through the host');
  assert.strictEqual(e.get_esp() >>> 0, ESP + 24, 'CoCreateInstance pops ret + 5 args');
  const ole = e.guest_read32(out) >>> 0;
  assert(ole, 'an IOleObject comes back');
  assert.strictEqual(e.t_type(ole), 36);
  assert.strictEqual(e.t_refcount(ole), 1, 'one caller-owned reference');

  for (const [iid, name] of [[IID_IWebBrowser2, 'IWebBrowser2'], [IID_IDispatch, 'IDispatch'],
      [IID_IPersistStreamInit, 'IPersistStreamInit'], [IID_IOleControl, 'IOleControl']]) {
    e.guest_write32(out, 0);
    assert.strictEqual(e.t_WebBrowser_QueryInterface(frame(), ole, iid, out) >>> 0, 0, `QI ${name}`);
    assert(e.guest_read32(out) >>> 0, `${name} pointer`);
    assert.strictEqual(e.get_esp() >>> 0, ESP + 16, 'QueryInterface pops ret + 3 args');
    assert.strictEqual(e.t_WebBrowser_Release(frame(), e.guest_read32(out) >>> 0) >>> 0, 1,
      `${name} shares the object's count`);
  }
  e.guest_write32(out, 0xfeedface);
  assert.strictEqual(e.t_WebBrowser_QueryInterface(frame(), ole, IID_IConnectionPointContainer, out) >>> 0,
    0x80004002, 'no events: IConnectionPointContainer is E_NOINTERFACE');
  assert.strictEqual(e.guest_read32(out) >>> 0, 0, 'refused QI clears the output');

  assert.strictEqual(e.t_WebBrowserOleObject_GetMiscStatus(frame(), ole, 1, out) >>> 0, 0);
  assert.strictEqual(e.guest_read32(out) >>> 0, 0x00020191, 'WebBrowser OLEMISC bits incl. SETCLIENTSITEFIRST');
  assert.strictEqual(e.t_WebBrowserOleObject_GetExtent(frame(), ole, 1, out) >>> 0, 0);
  assert.deepStrictEqual([e.guest_read32(out), e.guest_read32(out + 4)], [1323, 529], 'default HIMETRIC extent');
  e.guest_write32(out, 2000); e.guest_write32(out + 4, 1500);
  assert.strictEqual(e.t_WebBrowserOleObject_SetExtent(frame(), ole, 1, out) >>> 0, 0);
  e.guest_write32(out, 0); e.guest_write32(out + 4, 0);
  e.t_WebBrowserOleObject_GetExtent(frame(), ole, 1, out);
  assert.deepStrictEqual([e.guest_read32(out), e.guest_read32(out + 4)], [2000, 1500], 'SetExtent is kept');
  assert.strictEqual(e.t_WebBrowserOleObject_GetUserClassID(frame(), ole, out) >>> 0, 0);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(out + 4 * i) >>> 0),
    [0x8856F961, 0x11D0340A, 0xC0006BA9, 0xA205D74F], 'class id is CLSID_WebBrowser');

  // Two guest client sites: vtable [QI, AddRef, Release] at distinct addresses.
  const mkSite = (addref, release) => {
    const vt = e.guest_alloc(12) >>> 0, obj = e.guest_alloc(4) >>> 0;
    e.guest_write32(vt, 0x1); e.guest_write32(vt + 4, addref); e.guest_write32(vt + 8, release);
    e.guest_write32(obj, vt);
    return obj;
  };
  const siteA = mkSite(0x00500100, 0x00500200), siteB = mkSite(0x00500300, 0x00500400);
  // A suspended call leaves EIP at the guest method with [thunk, iface] on
  // the stack directly below the 48-byte context; resuming finishes the API.
  const expectCall = (eip, iface, what) => {
    assert.strictEqual(e.get_eip() >>> 0, eip, what);
    const sp = e.get_esp() >>> 0;
    assert.strictEqual(e.guest_read32(sp) >>> 0, e.t_ret_thunk() >>> 0, `${what}: returns to CACA0011`);
    assert.strictEqual(e.guest_read32(sp + 4) >>> 0, iface, `${what}: this`);
    return sp + 8; // the callee pops its one argument; the thunk sees the context
  };
  const expectDone = (pop, hr, what) => {
    assert.strictEqual(e.get_eip() >>> 0, RET, `${what}: back at the caller`);
    assert.strictEqual(e.get_esp() >>> 0, ESP + pop, `${what}: stdcall pop`);
    assert.strictEqual(e.get_eax() >>> 0, hr, `${what}: result`);
  };

  e.t_WebBrowserOleObject_SetClientSite(frame(), ole, siteA);
  assert.strictEqual(e.t_site(ole), 0, 'site not published before its AddRef returns');
  e.t_resume(expectCall(0x00500100, siteA, 'SetClientSite(A) AddRefs A'), 2);
  expectDone(12, 0, 'SetClientSite(A)');
  assert.strictEqual(e.t_site(ole) >>> 0, siteA, 'A published');

  e.guest_write32(out, 0);
  e.t_WebBrowserOleObject_GetClientSite(frame(), ole, out);
  e.t_resume(expectCall(0x00500100, siteA, 'GetClientSite AddRefs A for the caller'), 3);
  expectDone(12, 0, 'GetClientSite');
  assert.strictEqual(e.guest_read32(out) >>> 0, siteA, 'GetClientSite returns A');

  e.t_WebBrowserOleObject_SetClientSite(frame(), ole, siteB);
  e.t_resume(expectCall(0x00500300, siteB, 'SetClientSite(B) AddRefs B first'), 1);
  assert.strictEqual(e.t_site(ole) >>> 0, siteB, 'B published before A is released');
  e.t_resume(expectCall(0x00500200, siteA, 'then Releases A'), 0);
  expectDone(12, 0, 'SetClientSite(B)');

  e.t_WebBrowserOleObject_SetClientSite(frame(), ole, 0);
  assert.strictEqual(e.t_site(ole), 0, 'SetClientSite(NULL) drops the site immediately');
  e.t_resume(expectCall(0x00500400, siteB, 'SetClientSite(NULL) Releases B'), 0);
  expectDone(12, 0, 'SetClientSite(NULL)');

  e.guest_write32(out, 0xfeedface);
  assert.strictEqual(e.t_WebBrowserOleObject_GetClientSite(frame(), ole, out) >>> 0, 0);
  assert.strictEqual(e.guest_read32(out) >>> 0, 0, 'no site: S_OK with NULL');

  // Final Release while holding a site gives the site reference back.
  e.t_WebBrowserOleObject_SetClientSite(frame(), ole, siteA);
  e.t_resume(expectCall(0x00500100, siteA, 'AddRef A again'), 2);
  expectDone(12, 0, 'SetClientSite(A) again');
  e.t_WebBrowser_Release(frame(), ole);
  e.t_resume(expectCall(0x00500200, siteA, 'final Release Releases A'), 1);
  expectDone(8, 0, 'final Release');

  console.log('PASS  CLSID_WebBrowser blank control: interfaces, extent/status, client-site AddRef/Release ordering');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';
// GetDateFormatA / GetTimeFormatA picture formatting, the calendar LCTypes of
// GetLocaleInfoA/W, and every API that turns UTC into the guest's local time
// (GetTimeZoneInformation, FileTimeToLocalFileTime, LocalFileTimeToFileTime,
// the CRT's time()/localtime()), against one pinned host clock.
//
// Before this, both formatters wrote hardcoded "1/1/01" / "Monday, January 1,
// 2001" / "12:00:00 AM" whatever they were asked, so Notepad's F5 pasted
// "12:00:00 AM 1/1/01"; the bias was zero while GetLocalTime used the host
// zone, and localtime() returned a constant struct tm.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// Local time the pinned host reports: Tuesday 1999-06-01 05:07:09.123, in a
// zone 7 hours behind UTC (Bias 420), i.e. 12:07:09.123Z.
const BIAS = 420;
const UTC_MS = Date.UTC(1999, 5, 1, 12, 7, 9, 123);
const LOCAL = [1999, 6, 2, 1, 5, 7, 9, 123];

const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const wallCalls = [];
function wallClock(out, kind) {
  wallCalls.push(kind);
  const dv = new DataView(memory.buffer);
  if (kind === 1) { LOCAL.forEach((v, i) => dv.setUint16(out + i * 2, v, true)); return 1; }
  if (kind === 2) {
    const ticks = 116444736000000000n + BigInt(UTC_MS) * 10000n;
    dv.setBigUint64(out, ticks, true);
    return 1;
  }
  if (kind === 3) { dv.setInt32(out, BIAS, true); return 1; }
  return 0;
}

const ESP = 0x00300000;
const callWat = (name, cdecl) => `
  (func (export "t_${name}") (param $a0 i32) (param $a1 i32) (param $a2 i32)
      (param $a3 i32) (param $a4 i32) (param $a5 i32) (result i32)
    (global.set $last_error (i32.const 0xdead))
    (i32.store offset=16 (global.get $reg_base) (i32.const ${ESP}))
    (call $gs32 (i32.const ${ESP + 24}) (local.get $a5))
    (call $handle_${name} (local.get $a0) (local.get $a1) (local.get $a2)
      (local.get $a3) (local.get $a4) (i32.const 0))
    (i32.load (global.get $reg_base)))`;

(async () => {
  const { exports: e } = await bootRenderHarness({
    fonts: 'none', memory,
    extraHostOverrides: { wall_clock: wallClock },
    extraWat: [
      'GetDateFormatA', 'GetTimeFormatA', 'GetLocaleInfoA', 'GetLocaleInfoW',
      'GetTimeZoneInformation', 'FileTimeToLocalFileTime', 'LocalFileTimeToFileTime',
      'time', 'localtime',
    ].map(n => callWat(n)).join('\n') + `
      (func (export "t_last_error") (result i32) (global.get $last_error))
      (func (export "t_map") (param $ga i32) (result i32)
        (call $virtual_map_commit (local.get $ga) (i32.const 4096)))`,
  });
  const base = e.get_image_base() >>> 0;
  const ST = base + 0x1000, FMT = base + 0x1100, OUT = base + 0x1200, AUX = base + 0x1400;
  const w8 = (ga, v) => e.guest_write8(ga, v);
  const w16 = (ga, v) => { w8(ga, v & 255); w8(ga + 1, (v >> 8) & 255); };
  const w32 = (ga, v) => { for (let i = 0; i < 4; i++) w8(ga + i, (v >>> (i * 8)) & 255); };
  const r32 = ga => [0, 1, 2, 3].reduce((a, i) => a + e.guest_read8(ga + i) * 2 ** (i * 8), 0);
  const r64 = ga => BigInt(r32(ga)) + (BigInt(r32(ga + 4)) << 32n);
  const w64 = (ga, v) => { w32(ga, Number(v & 0xffffffffn)); w32(ga + 4, Number(v >> 32n)); };
  const cstr = (ga, s) => { [...s].forEach((c, i) => w8(ga + i, c.charCodeAt(0))); w8(ga + s.length, 0); return ga; };
  const rstr = (ga, wide = false) => {
    let s = '';
    for (let i = 0; i < 256; i++) {
      const c = wide ? e.guest_read8(ga + i * 2) | (e.guest_read8(ga + i * 2 + 1) << 8) : e.guest_read8(ga + i);
      if (!c) return s;
      s += String.fromCharCode(c);
    }
    throw new Error('unterminated');
  };
  const fill = (ga, n, v = 0xcc) => { for (let i = 0; i < n; i++) w8(ga + i, v); };
  const systime = (ga, [y, mo, dow, d, h, mi, s, ms]) => {
    [y, mo, dow, d, h, mi, s, ms].forEach((v, i) => w16(ga + i * 2, v)); return ga;
  };
  const popped = (n) => assert.strictEqual(e.get_esp() >>> 0, ESP + n, `ESP pops ${n}`);

  // One formatter call: returns [result, text, lastError].
  const fmt = (api, flags, st, picture, cch = 80, out = OUT) => {
    fill(out, 96);
    const pic = picture == null ? 0 : cstr(FMT, picture);
    const ret = e[`t_${api}`](0x0400, flags, st, pic, out, cch);
    popped(28);
    return [ret, ret && cch ? rstr(out) : null, e.t_last_error()];
  };
  const ok = (api, flags, st, picture, want, why) => {
    const [ret, text] = fmt(api, flags, st, picture);
    assert.strictEqual(text, want, why);
    assert.strictEqual(ret, want.length + 1, `${why}: length includes the NUL`);
  };

  // --- GetDateFormatA -------------------------------------------------------
  ok('GetDateFormatA', 0, 0, null, '6/1/99', 'NULL date = local now, short default');
  ok('GetDateFormatA', 1, 0, null, '6/1/99', 'DATE_SHORTDATE');
  ok('GetDateFormatA', 2, 0, null, 'Tuesday, June 1, 1999', 'DATE_LONGDATE');
  ok('GetDateFormatA', 0x80000002, 0, null, 'Tuesday, June 1, 1999', 'LOCALE_NOUSEROVERRIDE is accepted');
  // wDayOfWeek is ignored and recomputed: 2000-02-29 is a Tuesday.
  systime(ST, [2000, 2, 6, 29, 23, 4, 5, 0]);
  ok('GetDateFormatA', 0, ST, "dddd dd MMM yyyy 'o''clock' ddd MM y yy gg|", 'Tuesday 29 Feb 2000 o\'clock Tue 02 0 00 |',
    'every date element, a quoted literal with an escaped quote, era empty');
  ok('GetDateFormatA', 0, ST, 'MMMM d h:m:s tt', 'February 29 h:m:s tt', 'time letters are literal in a date picture');
  ok('GetDateFormatA', 0, ST, "''d'", '29', "an empty quote pair and an unterminated quote print nothing");
  systime(ST, [1999, 12, 0, 31, 0, 0, 0, 0]);
  ok('GetDateFormatA', 2, ST, null, 'Friday, December 31, 1999', 'caller SYSTEMTIME, long form');
  // Size query, too small, bad date, contradictory flags.
  let [ret, , err] = fmt('GetDateFormatA', 0, 0, null, 0);
  assert.strictEqual(ret, 7, 'cchDate 0 returns the size including NUL');
  assert.strictEqual(e.guest_read8(OUT), 0xcc, 'size query writes nothing');
  [ret, , err] = fmt('GetDateFormatA', 0, 0, null, 6);
  assert.deepStrictEqual([ret, err, e.guest_read8(OUT)], [0, 122, 0xcc], 'short buffer: ERROR_INSUFFICIENT_BUFFER, untouched');
  systime(ST, [1999, 2, 0, 29, 0, 0, 0, 0]);
  [ret, , err] = fmt('GetDateFormatA', 0, ST, null);
  assert.deepStrictEqual([ret, err], [0, 87], '1999-02-29 is ERROR_INVALID_PARAMETER');
  [ret, , err] = fmt('GetDateFormatA', 3, 0, null);
  assert.deepStrictEqual([ret, err], [0, 1004], 'DATE_SHORTDATE|DATE_LONGDATE is ERROR_INVALID_FLAGS');

  // --- GetTimeFormatA -------------------------------------------------------
  ok('GetTimeFormatA', 0, 0, null, '5:07:09 AM', 'NULL time = local now, h:mm:ss tt');
  ok('GetTimeFormatA', 2, 0, null, '5:07 AM', 'TIME_NOSECONDS drops seconds and their separator (Notepad F5)');
  ok('GetTimeFormatA', 1, 0, null, '5 AM', 'TIME_NOMINUTESORSECONDS');
  ok('GetTimeFormatA', 4, 0, null, '5:07:09', 'TIME_NOTIMEMARKER');
  ok('GetTimeFormatA', 4, 0, 'tt h:mm', '5:07', 'a leading dropped marker takes its separator with it');
  systime(ST, [1999, 6, 0, 1, 23, 4, 5, 0]);
  ok('GetTimeFormatA', 0, ST, null, '11:04:05 PM', 'caller SYSTEMTIME, 12-hour');
  ok('GetTimeFormatA', 8, ST, null, '23:04:05 PM', 'TIME_FORCE24HOURFORMAT turns h into H');
  ok('GetTimeFormatA', 0, ST, "HH'h'mm t d/M/y", '23h04 P d/M/y', 'H, quoted text, t, date letters literal');
  systime(ST, [1601, 1, 0, 1, 0, 30, 7, 0]);
  ok('GetTimeFormatA', 0, ST, 'hh:mm:ss tt', '12:30:07 AM', 'midnight hour is 12, hh pads');
  systime(ST, [0, 0, 0, 0, 24, 0, 0, 0]);
  [ret, , err] = fmt('GetTimeFormatA', 0, ST, null);
  assert.deepStrictEqual([ret, err], [0, 87], 'hour 24 is ERROR_INVALID_PARAMETER (date is not checked)');
  [ret, , err] = fmt('GetTimeFormatA', 0x10, 0, null);
  assert.deepStrictEqual([ret, err], [0, 1004], 'an unknown TIME_ flag is ERROR_INVALID_FLAGS');

  // Output straddling two sparse guest pages that are not adjacent in wasm.
  const page = 0x30000000;
  for (const ga of [page, 0x28000000, page + 4096]) assert.strictEqual(e.t_map(ga) >>> 0, ga);
  assert.notStrictEqual(e.guest_to_wasm(page + 4096), e.guest_to_wasm(page) + 4096);
  for (let split = 1; split <= 11; split++) {
    const out = page + 4096 - split;
    fill(out - 1, 13);
    const [r, text] = fmt('GetTimeFormatA', 0, 0, null, 11, out);
    assert.deepStrictEqual([r, text, e.guest_read8(out - 1), e.guest_read8(out + 11)],
      [11, '5:07:09 AM', 0xcc, 0xcc], `page split ${split}`);
  }

  // --- GetLocaleInfoA/W: the same pictures and names the formatter uses -----
  const info = (type, cch = 80, wide = false) => {
    fill(OUT, 96);
    const r = e[wide ? 't_GetLocaleInfoW' : 't_GetLocaleInfoA'](0x0400, type, OUT, cch, 0, 0);
    popped(20);
    return [r, r && cch ? rstr(OUT, wide) : null, e.t_last_error()];
  };
  for (const [type, want] of [
    [0x0003, 'ENU'], [0x80000003, 'ENU'], [0x40000003, 'ENU'],
    [0x1F, 'M/d/yy'], [0x20, 'dddd, MMMM d, yyyy'], [0x1003, 'h:mm:ss tt'],
    [0x1D, '/'], [0x1E, ':'], [0x28, 'AM'], [0x29, 'PM'], [0x21, '0'], [0x23, '0'],
    [0x100C, '6'], [0x1009, '1'], [0x2A, 'Monday'], [0x30, 'Sunday'], [0x31, 'Mon'],
    [0x37, 'Sun'], [0x38, 'January'], [0x43, 'December'], [0x44, 'Jan'], [0x4F, 'Dec'],
    [0x0E, '.'], [0x0F, ','],
  ]) {
    assert.deepStrictEqual(info(type).slice(0, 2), [want.length + 1, want], `GetLocaleInfoA 0x${type.toString(16)}`);
    assert.deepStrictEqual(info(type, 80, true).slice(0, 2), [want.length + 1, want], `GetLocaleInfoW 0x${type.toString(16)}`);
  }
  assert.deepStrictEqual(info(0x1F, 0).slice(0, 1), [7], 'size query');
  for (const wide of [false, true]) {
    assert.strictEqual(info(0x80000003, 0, wide)[0], 4, 'abbreviation size includes NUL');
    assert.strictEqual(e.guest_read8(OUT), 0xcc, 'size query leaves output untouched');
    assert.deepStrictEqual(info(0x80000003, 3, wide).filter((_, i) => i !== 1), [0, 122],
      'abbreviation refuses a short buffer');
    assert.strictEqual(e.guest_read8(OUT), 0xcc, 'short buffer leaves output untouched');
    assert.deepStrictEqual(info(0x20000003, 4, wide).filter((_, i) => i !== 1), [0, 1004],
      'language abbreviation is not numeric');
    assert.deepStrictEqual(info(0x10000003, 4, wide).filter((_, i) => i !== 1), [0, 1004],
      'language abbreviation rejects unknown flags');
  }
  assert.deepStrictEqual([info(0x1F, 6)[0], info(0x1F, 6)[2]], [0, 122], 'short buffer');
  fill(OUT, 8);
  assert.strictEqual(e.t_GetLocaleInfoA(0x0400, 0x2000100C, OUT, 4, 0, 0), 4, 'RETURN_NUMBER: a DWORD, 4 chars (A)');
  assert.strictEqual(r32(OUT), 6, 'IFIRSTDAYOFWEEK as a number');
  assert.strictEqual(e.t_GetLocaleInfoW(0x0400, 0x2000100C, OUT, 2, 0, 0), 2, 'RETURN_NUMBER: 2 WCHARs (W)');
  assert.deepStrictEqual([e.t_GetLocaleInfoA(0x0400, 0x2000001F, OUT, 80, 0, 0), e.t_last_error()], [0, 1004],
    'RETURN_NUMBER on a string LCType is ERROR_INVALID_FLAGS');

  // --- The local-time bias: one value everywhere -----------------------------
  fill(AUX, 172);
  assert.strictEqual(e.t_GetTimeZoneInformation(AUX, 0, 0, 0, 0, 0), 0, 'TIME_ZONE_ID_UNKNOWN');
  popped(8);
  assert.strictEqual(r32(AUX), BIAS, 'TIME_ZONE_INFORMATION.Bias is the host zone');
  for (let i = 4; i < 172; i++) assert.strictEqual(e.guest_read8(AUX + i), 0, `TZI byte ${i} zero`);
  const utcTicks = 116444736000000000n + BigInt(UTC_MS) * 10000n;
  const localTicks = utcTicks - BigInt(BIAS) * 600000000n;
  w64(AUX, utcTicks);
  assert.strictEqual(e.t_FileTimeToLocalFileTime(AUX, AUX + 8, 0, 0, 0, 0), 1); popped(12);
  assert.strictEqual(r64(AUX + 8), localTicks, 'FileTimeToLocalFileTime subtracts Bias');
  assert.strictEqual(e.t_LocalFileTimeToFileTime(AUX + 8, AUX + 8, 0, 0, 0, 0), 1); popped(12);
  assert.strictEqual(r64(AUX + 8), utcTicks, 'LocalFileTimeToFileTime adds it back, in place');
  assert.strictEqual(e.t_FileTimeToLocalFileTime(0, AUX, 0, 0, 0, 0), 0, 'NULL source fails');

  // --- CRT time()/localtime() ------------------------------------------------
  const timeT = Math.floor(UTC_MS / 1000);
  w32(AUX, 0);
  assert.strictEqual(e.t_time(AUX, 0, 0, 0, 0, 0) >>> 0, timeT, 'time() is the wall-clock UTC time_t'); popped(4);
  assert.strictEqual(r32(AUX), timeT, 'time() stores through its argument');
  const tm = e.t_localtime(AUX, 0, 0, 0, 0, 0) >>> 0; popped(4);
  assert(tm, 'localtime returns its struct tm');
  const fields = Array.from({ length: 9 }, (_, i) => r32(tm + i * 4));
  assert.deepStrictEqual(fields, [9, 7, 5, 1, 5, 99, 2, 151, 0],
    'localtime: 05:07:09 Tue 1999-06-01 local (yday 151, no DST)');
  w32(AUX, 0x80000000);
  assert.strictEqual(e.t_localtime(AUX, 0, 0, 0, 0, 0), 0, 'negative time_t is NULL');
  assert.strictEqual(e.t_localtime(0, 0, 0, 0, 0, 0), 0, 'NULL timer is NULL');
  assert(wallCalls.includes(1) && wallCalls.includes(2) && wallCalls.includes(3), 'all three clock kinds were used');

  console.log('PASS date/time formatting, calendar LCTypes and local-time bias');
})().catch(error => { console.error(error); process.exitCode = 1; });

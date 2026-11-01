#!/usr/bin/env node
// Traditional Chinese (CP950) Windows Me accessories, plus the Win16 menu
// regressions they exposed in the English builds too.
//
// 1. FreeCell (English Win16): opening the Game menu posts WM_INITMENU with
//    the window's menu, which for a resource menu is the resource ID (400).
//    $win16_msg_wparam16 used to pass that through as "already narrow", and
//    $win16_h32 trapped on the way back. The dropdown's shortcut column was
//    also read at a UTF-16 stride from one-byte labels ("le" for F2).
// 2. Notepad CHT (Win32, UTF-16 resources): menu labels and shortcuts reach
//    the dropdown as Big5, not as low bytes of UTF-16 units; the caption
//    (LoadStringA) is Big5 too.
// 3. Minesweeper CHT (Win16): the Custom Field dialog opens (smoke only; see
//    the note at the check for why its template decode needs pixels).
//
// The WinMe CHT binaries are Microsoft OS files and are not in the repo: see
// test/binaries/SOURCES.md for where they come from. Each part SKIPs when its
// binary is absent.

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const BIN = path.join(__dirname, 'binaries');

const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });
let ran = 0;

function run(args) {
  try {
    return execFileSync(process.execPath, [RUN, '--quiet-api', '--no-close',
      '--stuck-after=100000', '--max-seconds=60', ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}\n(run.js exited non-zero)`;
  }
}

const shortcuts = (out) => {
  const map = {};
  for (const m of out.matchAll(/\[input\] menu-shortcuts #(\d+) label=([0-9a-f]*) sc=("(?:[^"\\]|\\.)*")/g)) {
    map[m[1]] = { label: m[2], sc: JSON.parse(m[3]) };
  }
  return map;
};
// dump-windows prints the renderer's title mirror, which holds the ANSI
// bytes as latin1 characters; answer them as hex for the first window of
// `cls` (or the first dialog when cls is null).
const titleOf = (out, cls) => {
  for (const line of out.split('\n')) {
    if (!line.startsWith('[input] window ')) continue;
    if (cls ? !line.includes(`class=${JSON.stringify(cls)}`) : !line.includes('dialog=true')) continue;
    const m = line.match(/ title=("(?:[^"\\]|\\.)*") at batch/);
    if (m) return Buffer.from(JSON.parse(m[1]), 'latin1').toString('hex');
  }
  return null;
};
const noCrash = (out) => !/\*\*\* CRASH|UNIMPLEMENTED API:|\(run\.js exited non-zero\)/.test(out);

// ---- 1. FreeCell (Win16, English) ----
if (fs.existsSync(path.join(BIN, 'win98-16bit', 'FREECELL.EXE'))) {
  ran++;
  const out = run(['--app=freecell16', '--max-batches=14',
    '--input=8:mousedown:32:30,9:mouseup:32:30,11:menu-shortcuts']);
  const sc = shortcuts(out);
  check('freecell16: Game menu opens without a Win16 handle trap', noCrash(out));
  check('freecell16: New Game shortcut is F2', sc[0] && sc[0].sc === 'F2', sc[0]);
  check('freecell16: Select Game shortcut is F3', sc[1] && sc[1].sc === 'F3', sc[1]);
  check('freecell16: Undo shortcut is F10', sc[7] && sc[7].sc === 'F10', sc[7]);
} else {
  console.log('SKIP  freecell16: test/binaries/win98-16bit/FREECELL.EXE not found');
}

// ---- 2. Notepad CHT (Win32) ----
if (fs.existsSync(path.join(BIN, 'winme-cht', 'notepad.exe'))) {
  ran++;
  const out = run(['--app=notepad_cht', '--max-batches=14',
    '--input=8:mousedown:110:50,9:mouseup:110:50,12:menu-shortcuts,13:dump-windows']);
  const sc = shortcuts(out);
  check('notepad_cht: runs cleanly', noCrash(out));
  // 復原(&U) = B4 5F AD EC 28 26 55 29, shortcut Ctrl+Z.
  check('notepad_cht: Edit > Undo label is Big5', sc[0] && sc[0].label === 'b45fadec28265529', sc[0]);
  check('notepad_cht: Edit > Undo shortcut is Ctrl+Z', sc[0] && sc[0].sc === 'Ctrl+Z', sc[0]);
  // 未命名 - 記事本
  const cap = titleOf(out, 'Notepad');
  check('notepad_cht: caption is Big5 (LoadStringA)',
    cap === 'a5bca952a657202d20b04fa8c6a5bb', cap);
} else {
  console.log('SKIP  notepad_cht: test/binaries/winme-cht/notepad.exe not found');
}

// ---- 3. Minesweeper CHT (Win16 dialog template) ----
if (fs.existsSync(path.join(BIN, 'winme-cht', 'winmine.exe'))) {
  ran++;
  const out = run(['--app=winmine_cht', '--max-batches=18',
    '--input=8:mousedown:108:66,9:mouseup:108:66,11:mousedown:125:187,12:mouseup:125:187,16:dlg-dump']);
  check('winmine_cht: runs cleanly', noCrash(out));
  // The OK button's text, read back through the control: 確定 = BD 54 A9 77.
  // A smoke check, not the regression: control text is stored as ANSI
  // bytes, and the old byte-by-byte widening round-tripped to the same
  // bytes. What it broke was the UTF-16 template — the caption, statics and
  // the DS_SETFONT face name 新細明體, so the dialog font never resolved to
  // the CJK face and drew Latin glyphs. That is only visible in pixels; the
  // before/after captures are in scratch/runs/20261101T0229Z-winme-cht-cp950-
  // claude-ad26-before and ...-after-mingliu.
  const m = out.match(/\[input\] dlg-dump:.*? id=1 cls=1 [^|]*? text="([^"]*)"/);
  const ok = m ? Buffer.from(m[1], 'latin1').toString('hex') : null;
  check('winmine_cht: Custom Field dialog opens with a Big5 OK button',
    ok === 'bd54a977', ok);
} else {
  console.log('SKIP  winmine_cht: test/binaries/winme-cht/winmine.exe not found');
}

for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.pass || c.detail === undefined ? '' : ' ' + JSON.stringify(c.detail)}`);
}
const failed = checks.filter(c => !c.pass).length;
if (!ran) console.log('SKIP  no binaries present');
console.log(`--- cp950-winme-cht: ${checks.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

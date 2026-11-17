'use strict';
// Byte-compatible port of Python's difflib.unified_diff (SequenceMatcher with
// isjunk=None, autojunk=True), so a patch replaces `python3 -c difflib...`
// without changing its bytes or its hash.

// str.splitlines(keepends=True)
function splitlines(text) {
  const out = [], re = /[^\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]*(?:\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029])?/g;
  for (const m of text.matchAll(re)) if (m[0]) out.push(m[0]);
  return out;
}

function matchingBlocks(a, b) {
  const b2j = new Map();
  b.forEach((line, j) => { let v = b2j.get(line); if (!v) b2j.set(line, v = []); v.push(j); });
  const n = b.length;
  if (n >= 200) {
    const ntest = Math.floor(n / 100) + 1;
    for (const [line, idxs] of [...b2j]) if (idxs.length > ntest) b2j.delete(line);
  }
  const longest = (alo, ahi, blo, bhi) => {
    let besti = alo, bestj = blo, bestsize = 0, j2len = new Map();
    for (let i = alo; i < ahi; i++) {
      const next = new Map();
      for (const j of b2j.get(a[i]) || []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) || 0) + 1;
        next.set(j, k);
        if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
      }
      j2len = next;
    }
    // No junk: extend across popular (non-indexed) equal lines.
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) { besti--; bestj--; bestsize++; }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    return [besti, bestj, bestsize];
  };
  const queue = [[0, a.length, 0, b.length]], blocks = [];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const x = longest(alo, ahi, blo, bhi), [i, j, k] = x;
    if (k) {
      blocks.push(x);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  const merged = [];
  let i1 = 0, j1 = 0, k1 = 0;
  for (const [i2, j2, k2] of blocks) {
    if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
    else { if (k1) merged.push([i1, j1, k1]); i1 = i2; j1 = j2; k1 = k2; }
  }
  if (k1) merged.push([i1, j1, k1]);
  merged.push([a.length, b.length, 0]);
  return merged;
}

function opcodes(a, b) {
  let i = 0, j = 0;
  const out = [];
  for (const [ai, bj, size] of matchingBlocks(a, b)) {
    const tag = i < ai && j < bj ? 'replace' : i < ai ? 'delete' : j < bj ? 'insert' : '';
    if (tag) out.push([tag, i, ai, j, bj]);
    i = ai + size; j = bj + size;
    if (size) out.push(['equal', ai, i, bj, j]);
  }
  return out;
}

function groupedOpcodes(a, b, n = 3) {
  let codes = opcodes(a, b);
  if (!codes.length) codes = [['equal', 0, 1, 0, 1]];
  if (codes[0][0] === 'equal') {
    const [tag, i1, i2, j1, j2] = codes[0];
    codes[0] = [tag, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2];
  }
  if (codes.at(-1)[0] === 'equal') {
    const [tag, i1, i2, j1, j2] = codes.at(-1);
    codes[codes.length - 1] = [tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)];
  }
  const groups = [];
  let group = [];
  for (let [tag, i1, i2, j1, j2] of codes) {
    if (tag === 'equal' && i2 - i1 > n + n) {
      group.push([tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
      groups.push(group); group = [];
      i1 = Math.max(i1, i2 - n); j1 = Math.max(j1, j2 - n);
    }
    group.push([tag, i1, i2, j1, j2]);
  }
  if (group.length && !(group.length === 1 && group[0][0] === 'equal')) groups.push(group);
  return groups;
}

function range(start, stop) {
  let beginning = start + 1;
  const length = stop - start;
  if (length === 1) return String(beginning);
  if (!length) beginning--;
  return `${beginning},${length}`;
}

// difflib.unified_diff(a, b, fromfile, tofile) over line arrays with ends.
function unifiedDiff(a, b, fromfile = '', tofile = '', n = 3) {
  let out = '', started = false;
  for (const group of groupedOpcodes(a, b, n)) {
    if (!started) { started = true; out += `--- ${fromfile}\n+++ ${tofile}\n`; }
    const first = group[0], last = group.at(-1);
    out += `@@ -${range(first[1], last[2])} +${range(first[3], last[4])} @@\n`;
    for (const [tag, i1, i2, j1, j2] of group) {
      if (tag === 'equal') { for (const line of a.slice(i1, i2)) out += ' ' + line; continue; }
      if (tag === 'replace' || tag === 'delete') for (const line of a.slice(i1, i2)) out += '-' + line;
      if (tag === 'replace' || tag === 'insert') for (const line of b.slice(j1, j2)) out += '+' + line;
    }
  }
  return out;
}

// One patch over {file, before, after} rows, as the former Python helper wrote it.
function patchOf(changes) {
  return changes.map(r => unifiedDiff(splitlines(r.before), splitlines(r.after), 'a/' + r.file, 'b/' + r.file)).join('');
}

module.exports = {splitlines, unifiedDiff, patchOf, groupedOpcodes};

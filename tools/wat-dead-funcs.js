#!/usr/bin/env node

'use strict';

// List WAT functions no export, table, start or other top-level form can
// reach. A retired code path leaves its helpers behind: nothing calls them,
// the compiler keeps them, and they read as live code to the next person.
// This walks the src/main.watx include list (the same parts, in the same
// order, as build/combined.wat) as a call graph, so it needs no build.
//
//   node tools/wat-dead-funcs.js                    # every unreachable function
//   node tools/wat-dead-funcs.js --file=09ab-       # only those whose source part matches
//   node tools/wat-dead-funcs.js --json
//
// Roots: functions with an inline (export ...), and every function name that
// appears in a top-level form other than a function (elem segments, start,
// exports, macro bodies). Edges: every function name a body mentions (call,
// return_call, ref.func, a macro argument), so a name in a string or comment
// is not stripped first and the result errs toward "reachable".

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = name => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const { WAT_FILES } = require('../lib/wat-manifest');
const fileFilter = opt('file');
const asJson = args.includes('--json');

const parts = [];
let src = '(module\n';
for (const file of WAT_FILES) {
  parts.push([src.length, file]);
  src += fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
}
src += ')\n';

// Top-level forms: split by paren depth, skipping strings and comments.
function topForms(text) {
  const forms = [];
  let depth = 0, start = -1, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < n && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i++; continue;
    }
    if (c === ';' && text[i + 1] === ';') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '(' && text[i + 1] === ';') {
      let d = 1; i += 2;
      while (i < n && d) {
        if (text[i] === '(' && text[i + 1] === ';') { d++; i += 2; }
        else if (text[i] === ';' && text[i + 1] === ')') { d--; i += 2; }
        else i++;
      }
      continue;
    }
    if (c === '(') { if (depth === 1) start = i; depth++; }
    else if (c === ')') { depth--; if (depth === 1 && start >= 0) { forms.push([start, i + 1]); start = -1; } }
    i++;
  }
  return forms;
}

const NAME = /\$[A-Za-z0-9_.!#%&'*+\-/:<=>?@\\^`|~$]+/g;
const strip = t => t.replace(/;;[^\n]*/g, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');

const partIndex = off => {
  let lo = 0, hi = parts.length - 1, best = 0;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (parts[mid][0] <= off) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  return best;
};
const partAt = off => parts[partIndex(off)][1];
// Line within its own source part.
const lineAt = off => {
  const base = parts[partIndex(off)][0];
  let line = 1;
  for (let i = base; i < off; i++) if (src.charCodeAt(i) === 10) line++;
  return line;
};

const funcs = new Map(); // name -> { start, end, exported, refs:Set }
const topRefs = new Set();
const forms = topForms(src);
for (const [s, e] of forms) {
  const text = strip(src.slice(s, e));
  const head = /^\(\s*func\s+(\$[^\s()]+)/.exec(text);
  if (head) {
    const name = head[1];
    const after = text.slice(head[0].length);
    const exported = /^\s*\(\s*export\s/.test(after);
    const refs = new Set(after.match(NAME) || []);
    refs.delete(name);
    funcs.set(name, { start: s, end: e, exported, refs, bytes: e - s });
  } else {
    for (const r of text.match(NAME) || []) topRefs.add(r);
  }
}

const reach = new Set();
const stack = [];
for (const [name, f] of funcs) if (f.exported || topRefs.has(name)) { reach.add(name); stack.push(name); }
while (stack.length) {
  const f = funcs.get(stack.pop());
  for (const r of f.refs) if (funcs.has(r) && !reach.has(r)) { reach.add(r); stack.push(r); }
}

const dead = [];
for (const [name, f] of funcs) {
  if (reach.has(name)) continue;
  const part = partAt(f.start);
  if (fileFilter && !(part || '').includes(fileFilter)) continue;
  dead.push({ name, part, line: lineAt(f.start), endLine: lineAt(f.end - 1), bytes: f.bytes });
}
dead.sort((a, b) => (a.part < b.part ? -1 : a.part > b.part ? 1 : a.line - b.line));
if (asJson) {
  process.stdout.write(JSON.stringify(dead, null, 1) + '\n');
} else {
  for (const d of dead) console.log(`${d.name}\tsrc/${d.part}:${d.line}\t${d.bytes} B`);
  console.log(`${dead.length} unreachable of ${funcs.size} functions, ${dead.reduce((a, d) => a + d.bytes, 0)} source bytes`);
}

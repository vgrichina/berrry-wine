#!/usr/bin/env node

'use strict';

// Map a WebAssembly function index back to the WAT function that produced it.
//
// An instantiation failure reports an index and nothing else:
//
//   CompileError: Compiling function #3849 failed: expected 1 elements on the
//   stack for fallthru, found 2
//
// In a 3,900-function module concatenated from two dozen files that names no
// file, no function, and no line. Indices count imported functions first, then
// definitions in source order, so this walks build/combined.wat the same way
// the compiler does and prints the function - which is usually enough to see
// the mistake, and always enough to know whose file it is in.
//
//   node tools/func-index.js 3849
//   node tools/func-index.js 3849 --body     # print the whole function
//   node tools/func-index.js --name=$tt_fnt_build   # the other direction
//   node tools/func-index.js 433,949,1225 --combined=/path/combined.wat
//
// --combined names indices against a combined.wat you saved beside a profile.
// build/ is shared, and a rebuild between profiling and reading renumbers
// every function, so an index read against the current build names the wrong
// function with nothing to say so. Several indices may be given, comma-separated.

const fs = require('fs');
const path = require('path');

const DEFAULT_COMBINED = path.join(__dirname, '..', 'build', 'combined.wat');
const DEFAULT_FACTS = path.join(__dirname, '..', 'build', 'watx-facts.json');

// The compiler's own function table (build/watx-facts.json, written by the
// same compile as build/wine-assembly.wasm). The text walk below cannot see
// functions the compiler creates or that sit inside a wrapper form: on the
// 2026-11 build it found 15123 definitions where the module has 17582, every
// index past #398 was named wrongly, and a perf profile's hottest function
// ($uop_fast) came back as "set_uop_poor_work". Use this whenever it exists;
// lines are filled in from the walk by name where the walk saw the function.
function facts(factsPath = DEFAULT_FACTS, source = null) {
  if (!fs.existsSync(factsPath)) return null;
  const mod = JSON.parse(fs.readFileSync(factsPath, 'utf8')).module;
  if (!mod || !Array.isArray(mod.functions) || !Array.isArray(mod.imports)) return null;
  const walked = source ? scan(source) : null;
  const lineOf = new Map();
  if (walked) for (const f of walked.imports.concat(walked.defined)) if (!lineOf.has(f.name)) lineOf.set(f.name, f.line);
  const imports = mod.imports.filter(i => i.kind === 'func').sort((a, b) => a.index - b.index)
    .map(i => ({ name: i.target || `import:${i.name}`, line: lineOf.get(i.target) || 0, host: i.name }));
  const defined = mod.functions.slice().sort((a, b) => a.index - b.index)
    .map(f => ({ name: f.name, line: lineOf.get(f.name) || 0, depth: 0 }));
  return { imports, defined, lines: walked ? walked.lines : [], fromFacts: true };
}

function scan(source) {
  const imports = [];
  const defined = [];
  const lines = source.split('\n');

  // Depth tracking keeps a `(func ...)` inside a comment or a nested form from
  // being counted. Only top-level definitions get an index.
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const code = raw.replace(/;;.*$/, '');

    if (depth <= 1) {
      // An import whose signature is long WRAPS, putting `(func $name ...)` on
      // the next line. Requiring both on one line missed exactly 8 of them and
      // shifted every reported index by 8 — which named $do_alu_sized as the
      // hottest function in a profile whose real answer was $next, and made a
      // dead function ($cdecl_return) look like 26% of RollerCoaster Tycoon.
      // Match the module/name pair first, then look ahead for the (func.
      const importPair = code.match(/\(import\s+"[^"]*"\s+"([^"]*)"(.*)$/);
      // ...but only for an import that has not already said what it is. A
      // memory/table/global import is not a function, and the line under it is
      // usually the first function import — the lookahead counted that one
      // twice and shifted every index by one. Seen on a toyvm module, where
      // `(import "host" "memory" (memory ...))` sits directly above the host
      // functions, which named `run` as the compiled JIT region.
      const kind = importPair && importPair[2].match(/\((func|memory|table|global|tag)\b/);
      const importFunc = importPair && (!kind || kind[1] === 'func')
        && (importPair[2] + (lines[i + 1] || '').replace(/;;.*$/, '')).match(/\(func\s+(\$[^\s)]+)/);
      if (importFunc) {
        imports.push({ name: importFunc[1], line: i + 1, host: importPair[1] });
      } else {
        const define = code.match(/^\s*\(func\s+(\$[^\s)]+|\(export\s+"[^"]*")/);
        if (define) {
          const exported = code.match(/\(export\s+"([^"]*)"/);
          defined.push({
            name: define[1].startsWith('$') ? define[1] : `(export "${exported[1]}")`,
            line: i + 1,
            depth,
          });
        }
      }
    }

    for (const ch of code) {
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
    }
  }
  return { imports, defined, lines };
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('usage: node tools/func-index.js <index>[,<index>...] [--body] [--combined=PATH] | --name=$fn');
    process.exit(2);
  }
  const combinedArg = args.find(a => a.startsWith('--combined='));
  const COMBINED = combinedArg ? combinedArg.slice('--combined='.length) : DEFAULT_COMBINED;
  if (!fs.existsSync(COMBINED)) {
    console.error(`${COMBINED} not found - run bash tools/build.sh first`);
    process.exit(2);
  }

  const source = fs.readFileSync(COMBINED, 'utf8');
  // --combined= names a saved module's text, so only the default build uses
  // the compiler's table; --walk forces the text walk.
  const table = (!combinedArg && !args.includes('--walk') && facts(DEFAULT_FACTS, source)) || scan(source);
  const { imports, defined, lines } = table;
  const wantBody = args.includes('--body');
  const byName = args.find(a => a.startsWith('--name='));

  if (byName) {
    const name = byName.slice('--name='.length);
    const at = defined.findIndex(f => f.name === name);
    if (at < 0) {
      console.error(`no function named ${name} in combined.wat`);
      process.exit(1);
    }
    console.log(`${name} is function #${at + imports.length} ` +
      `(definition ${at}, ${imports.length} imports precede it), ` +
      `combined.wat:${defined[at].line}`);
    return;
  }

  const indexArg = args.find(a => !a.startsWith('--'));
  const indices = String(indexArg).split(',').map(Number);
  if (!indices.every(n => Number.isInteger(n) && n >= 0)) {
    console.error(`not a function index: ${indexArg}`);
    process.exit(2);
  }

  console.log(`${imports.length} imported functions, ${defined.length} defined ` +
    `(indices ${imports.length}..${imports.length + defined.length - 1})`);

  let bad = false;
  for (const index of indices) {
    if (index < imports.length) {
      const found = imports[index];
      console.log(`#${index} is the import ${found.name} ("${found.host}"), ` +
        `combined.wat:${found.line}`);
      continue;
    }

    const at = index - imports.length;
    if (at >= defined.length) {
      console.error(`#${index} is past the last function`);
      bad = true;
      continue;
    }

    const found = defined[at];
    if (!found.line) {
      console.log(`#${index} is ${found.name} (compiler-generated or not found in combined.wat)`);
      continue;
    }
    // With the compiler's table the next index may be a generated function
    // the text has no line for, so the body ends at the next text definition.
    const after = defined.slice(at + 1).find(f => f.line > found.line);
    console.log(`#${index} is ${found.name} at combined.wat:${found.line}` +
      (after ? ` (next function starts at line ${after.line})` : ''));

    if (wantBody) {
      const end = after ? after.line - 1 : lines.length;
      for (let i = found.line - 1; i < end; i += 1) {
        console.log(`${i + 1}\t${lines[i]}`);
      }
    }
  }
  if (bad) process.exit(1);
}

// The index walk is the one place that knows how a WAT function name maps to a
// wasm function index, so tools that need the mapping import it rather than
// re-deriving it (tools/wasm-native.js). Running the file still runs the CLI.
if (require.main === module) main();

module.exports = { scan, facts, DEFAULT_FACTS };

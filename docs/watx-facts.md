# WATX facts — `build/watx-facts.json`

The WATX compile already resolves every declaration in the closure before it
emits a byte: the region map as allocated, every layout lowered to offsets, the
export/import/function/global index spaces and the data segments. A build gate
that only needs those answers can read them instead of parsing and expanding the
25 MB tree again in its own process.

- **Compiler side (generic, `tools/watx-src/`)**: `compile(source, vfs, { facts: true })`
  adds `result.facts`. Opt-in and read-only: the emitted binary is identical with
  and without it (`test/watx-compiler-facts.test.js` asserts this). Nothing in it
  is specific to this repository.
- **Build side (`tools/build-compile-wat.js`)**: the tail-call compile asks for
  facts and, after both artifacts validated and were published, writes them with
  provenance to `build/watx-facts.json` (`<stem>.watx-facts.json` beside a custom
  `--out`; `--facts-out=FILE` overrides; `--no-facts` skips).
- **Reader (`tools/watx-facts.js`)**: `loadFreshFacts()` returns the document only
  if it provably describes the tree and compiler on disk now; otherwise `null`,
  and the caller computes its answer itself exactly as before. `WINE_WATX_FACTS=0`
  forces every reader onto that fallback (the A/B control).
  `node tools/watx-facts.js` reports whether the file is fresh.

Freshness is proved by hashing, not by build order: a gate that runs before the
compile, or after a failed one, or in a tree edited since, falls back and is
exactly as correct as it was — only slower.

## Document (version 1)

```jsonc
{
  "schema": "watx-facts",
  "version": 1,
  "generator": "tools/build-compile-wat.js",
  "entry": "src/main.watx",
  "canonical": true,            // false for a WINE_REGION_SHAKE build — readers reject it
  "regionShake": null,
  "compiler": "<sha256>",       // over tools/watx-src/compiler-{parser,stages,codegen}.js + compiler.js
  "inputs": { "01-header.wat": "<sha256 of the bytes compiled>", ... },  // every src/*.wat(x)
  "module": { ...compiler facts, below... }
}
```

A reader accepts the document only when `schema`/`version` match, it is
`canonical`, `entry` is `src/main.watx`, `compiler` equals the hash of the
compiler sources on disk, and `inputs` equals the SHA-256 of every
`src/*.wat`/`src/*.watx` file on disk (same names, same bytes, nothing added or
removed).

The facts describe the **tail-call artifact as compiled** — i.e. after
`tools/protected-writer-entries.js` wrapped the exports, so `exports[].target`
of a protected export names its wrapper, not the implementation.

## Compiler facts (`module`)

| Field | Content |
|---|---|
| `declarations` | lowerIR's declaration records in source order, in lowerIR's own shape: `layout-lowered` `{name, fields[{name,type,offset,size,count,elemSize,stride}], totalSize, isUnion?, unionOf?, isView?}` (the derived `fieldByName` map omitted), `enum-lowered` `{name, members{NAME: value}}`, `union-lowered` `{name, enumName, tagField, prefixFields, variants[{name,tagValues,size}], totalSize}`, `view-lowered` `{name, of[], fields[]}` |
| `regions` | the allocator's report — exactly `compile().regions`: `{shake, shaken, shakeScaledDown, allocated, floor, imageBase, regions[{name,kind,base,size,align,owner}]}` |
| `memory` | `{imported, module, name, min, max, shared}` |
| `imports` | `{kind:'func', module, name, target, index, params[], results[]}`, `{kind:'global', module, name, target, index, type, mutable}`, `{kind:'memory', module, name}` |
| `exports` | export-section order: `{name, kind, index}`, plus `target` (function/global name) and, for functions, `params[]`/`results[]` |
| `functions` | defined functions in index order: `{name, index, params[], paramNames[], results[]}` (`params` are the declared types, so `ptr<L>` stays visible) |
| `globals` | global index space: imported `{name, index, type, mutable, imported:true}`, defined `{..., imported:false, init}` where `init` is `{kind:'const', value}` (i64 as a decimal string; floats as `{kind:'const', literal}`), `{kind:'region', op, region, value}` with the resolved address, or `{kind:'runtime', runtime}` |
| `data` | active segments: `{offset, size}`, the string pool as `{offset, size, stringPool:true}` |

Additive changes (a new field) keep `version` 1; a change in meaning or a
removal bumps it, and readers reject a version they do not know.

## Who reads it

| Gate | Uses | Fallback |
|---|---|---|
| `tools/gen-layout-offsets.js` (`--check`, table, `--at`, `--field`, `--write`) | `declarations` (layouts) | parse + resolveIncludes + expandMacros + lowerIR |
| `tools/union-gate.js` | `declarations` (layouts, unions, views) | same |

Both run after the compile in `tools/build.sh`. Gates that need function
**bodies** (struct-offset-census, control-variant-gate, region owner checks,
the region census) do not read facts.

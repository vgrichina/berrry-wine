# WATX: compile-time configuration and export wrappers

Two generic WATX language features, added to the vendored compiler
(`tools/watx-src/`, CHANGELOG 2026-11-21) so that no host has to rewrite source
text before compiling it:

- **compile-time configuration** — `defoption`, `defconst`, `if-const`,
  `cond-const` — for anything that differs between builds of one program;
- **`export-wrap`** — a prologue the compiler puts in front of every function
  export a selector matches.

Nothing here is specific to Wine-Assembly. The examples show this tree and a
second, `android-emu`-style program (`wasm-export` forms, no `include` tree) to
keep the design honest about that.

Tests: `test/watx-compiler-cfg.test.js`, `test/watx-compiler-export-wrap.test.js`
(every case compiles **and calls** the module, through both the streaming and
the whole-tree front end).

## 1. Compile-time configuration

### Declarations

```wat
(defoption NAME TYPE DEFAULT "doc string")
(defconst  NAME EXPR)
```

`TYPE` is `bool`, `i32`, `i64` or `(enum a b ...)`. `DEFAULT` must have that
type (an `i32` accepts `-2^31 .. 2^32-1`, so unsigned spellings work; integers
take decimal, `0x` hex and `_` separators). The doc string is required: it is
what `build/watx-facts.json` shows next to the value. A `defconst` is an `i32`/
`i64`-ranged integer or a bool, computed once from earlier names.

Both are module-level forms and produce no wasm. A name is declared once.

### Setting options

```js
compile(source, vfs, { define: { COMPAT_DISPATCH: 'nested', LIMIT: '0x40' } })
```

```sh
node tools/build-compile-wat.js --define COMPAT_DISPATCH=nested
```

A value is a string (parsed by the option's type) or a JS boolean/number. An
unknown name, a `defconst` name, a non-member enum value, a non-integer, or an
out-of-range integer is a **compile error** — a typo never silently builds the
default. A `--define` build is recorded in the facts and marked non-canonical.

### Reads and operators

| Form | Value |
|---|---|
| `(option NAME)` | the option's value |
| `(const NAME)` | the constant's value; also usable as an **immediate**: `(i32.const (const N))`, `(i64.const (const N))` (range-checked against the instruction) |
| `(target FEATURE)` | bool. `tail-calls` follows `options.tailCalls` (default on); `production` follows `mode`. `simd`, `threads`, `multi-memory` come only from `options.targets` — reading one the build did not state is an error, never a guess |
| `and or not` | bools |
| `eq ne` | ints, bools, or an enum option against a bare member name (`(eq (option MODE) fast)`; a name that is not a member is an error) |
| `lt le gt ge add sub mul shl shr and-bits or-bits` | integers |

Operands are type-checked; nothing short-circuits (both operands of `and` must
be well-formed).

**Ordering rule:** a condition sees only options/constants declared **earlier
in include order**. Reading a later one is an error that names it. This is
what makes per-file results depend only on the prefix of the program before
them. In this tree, options read by macros that expand everywhere live at the
top of `src/01-header.wat`.

### Conditionals

```wat
(if-const COND (then FORMS...) (else FORMS...))      ; else optional
(cond-const (COND FORMS...) ... (else FORMS...))      ; else optional, last
```

Allowed at module level, inside function bodies, and inside macro bodies. The
chosen arm is **spliced** like `begin`; an empty arm (or no match) contributes
nothing. The unchosen arm is **parsed but not expanded or type-checked**: it
may call functions, use types or macros that do not exist in this build.
Module-level arms may declare functions, globals, types, exports, even
`export-wrap`; they may not contain `include` or `defmacro` (those are resolved
before conditions are evaluated).

A function header clause (`param`, `result`, `export`, `effects`) may come from
a conditional.

### Facts

`facts.compileTime` records every option (value, default, `source:
'default'|'define'`, doc, file, line), every constant (value, what it reads),
the targets, and per file the options and targets its forms read — transitively
through constants. That per-file list is exactly what a per-file compile cache
must include in its key. (This tree's front-end reuse cache keys only lexical
ranges, which no option changes, so it needs no change.)

### Examples

Wine-Assembly — one source, two dispatch shapes, chosen by the target
(`src/01-header.wat`, `src/04-cache.wat`):

```wat
(defoption COMPAT_DISPATCH (enum trampoline nested) trampoline
  "Dispatch shape when the target has no tail calls")
(defconst TRAMPOLINE_DISPATCH
  (and (not (target tail-calls)) (eq (option COMPAT_DISPATCH) trampoline)))

(defmacro (dispatch-next)
  ...
  (if-const (const TRAMPOLINE_DISPATCH)
    (then (global.set $tramp_op (local.get $nx_op))
          (global.set $tramp_fn (local.get $nx_fn))
          (return))
    (else (return_call_indirect (type $handler_t) (local.get $nx_op) (local.get $nx_fn)))))
```

`build/wine-assembly.compat.wasm` is the same closure compiled with
`tailCalls: false`; `tools/build-dispatch-variant.js --variant=nested` adds
`COMPAT_DISPATCH=nested`. Before this, both were source-text edits applied by a
host script (`lib/dispatch-trampoline.js`), in Node and again in the browser.

An `android-emu`-style program — a debug build with checked memory access:

```wat
(defoption CHECKED bool false "bounds-check guest loads")
(defconst RAM_BYTES (shl 1 24))

(func $ld32 (param $a i32) (result i32)
  (if-const (option CHECKED)
    (then (if (i32.gt_u (local.get $a) (i32.const (const RAM_BYTES))) (then (unreachable)))))
  (i32.load (local.get $a)))
(wasm-export "ld32" $ld32)
```

## 2. `export-wrap`

```wat
(export-wrap
  (match SELECTOR)
  (prologue FORMS...))
```

`SELECTOR` is `(all)`, `(name "a" ...)`, `(prefix "p" ...)`, `(pure)`,
`(not S)`, `(and S ...)`, `(or S ...)`.

For every **function** export the selector matches, the compiler generates a
function with the same signature whose body is the prologue followed by a call
to the original with all parameters, and the export names that function
instead. Exactly:

- the prologue sees the parameters as locals `0 .. n-1`, can read and write
  globals and memory, and may `return` early (with a value of the export's
  result type); it is type-checked like any body;
- **internal calls are unchanged** — only the export entry point moves;
- several declarations matching one export **nest in declaration order, the
  first outermost**;
- `(all)` includes exports declared **after** the `export-wrap` (in later files
  too): it is a default-deny policy, not a list;
- generated functions are appended after every other form, so no existing
  function index moves, and every export keeps its place in the export section;
- memory, table and global exports are never wrapped.

`facts.exports[]` lists, per function export, `wrappers` (declaration indices,
outermost first), `implementation`, and `pure` when a selector asked.

### `(pure)` — inferred, conservative

A function is pure when it has no `(effects ...)` clause, is not an import, has
a non-empty body, and every instruction of its **macro-expanded** body is a
folded read: `local.get`, `global.get`, any `*.const`, a load (including
`load.field`/`load.elem`), a numeric or SIMD operator that is not a store or an
atomic, `select`, or a region/layout constant (`region.addr/end/size`,
`size-of`, `offset-of`, `elem-addr`). Control flow, `local.set`/`tee`, any call,
a store, `memory.*`/`table.*`, `unreachable`, or an atomic makes it impure. A
trap is not an effect. "Impure" may be wrong in the safe direction (a function
that branches but writes nothing is impure); "pure" never is.

### Example (this tree, `src/13a-export-guards.wat`)

```wat
(export-wrap
  (match (and (all)
              (not (pure))
              (not (name "run" "set_rep_store_step" "guest_read8" "guest_read32"))))
  (prologue
    (if (global.get $rep_store_step)
      (then (unreachable)))))
```

While store stepping is armed, every export that might write refuses before
any effect. Previously a Node-only host script (`tools/protected-writer-entries.js`)
rewrote the source text to add these wrappers; the browser's source compile
never ran it. The source form applies to every host, and the facts show the
result. On this tree it wraps the same 1766 exports and exempts the same 660 as
that script did, signature for signature.

`android-emu`-style — count JS→wasm entries in a profiling build:

```wat
(global $entries (mut i32) (i32.const 0))
(if-const (target production) (then) (else
  (export-wrap (match (and (all) (not (prefix "debug_"))))
    (prologue (global.set $entries (i32.add (global.get $entries) (i32.const 1)))))))
```

## Open questions (for review, and for upstream)

1. **Names.** `defoption`/`if-const`/`cond-const`/`(target ...)` versus one
   `cfg` family (`(cfg ...)`, `(cfg-if ...)`, Rust-style). Implemented with the
   names in the brief; renaming is mechanical.
2. **Unchosen arm: parse-only or type-checked?** Parse-only now, which is what
   makes "the compat arm calls a driver the tail build does not define" work.
   Type-checking both arms would catch rot in a rarely built arm at the cost of
   requiring every name either arm uses to exist in every build.
3. **No `(defined $f)` in v1.** A condition cannot ask whether a function or
   global exists; options are the only switch. Feature-detecting the program
   itself invites order-dependent builds.
4. **Prologue only.** No epilogue, no argument rewriting, no wrapping internal
   calls. An epilogue needs result locals and multi-value thinking; nothing here
   needs it yet.
5. **`(pure)` is inferred**, not declared. A `(pure)` annotation would let a
   function that branches be exempt, but it is a claim the compiler would have
   to verify anyway, so inference was the smaller feature.
6. **Upstream first.** These are generic and belong in android-emu's WATX
   before the next vendor import; this tree carries them sealed in
   `tools/watx-src/CHANGELOG.md` until then.

Observed while testing, not changed here: the streaming front end places
out-of-line `(export "x" (func $f))` forms relative to inline exports
differently from the whole-tree front end. Both are stable; `export-wrap`
preserves whichever order the front end produces.

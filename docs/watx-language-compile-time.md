# WATX: compile-time configuration and function advice

Two generic WATX language features, added to the vendored compiler
(`tools/watx-src/`, CHANGELOG 2026-11-21 and 2026-11-24) so that no host has
to rewrite source text before compiling it:

- **compile-time configuration** — `defoption`, `defconst`, `if-const`,
  `cond-const` — for anything that differs between builds of one program;
- **`advise`** — code the compiler runs in front of the functions a selector
  matches, either where JavaScript calls in (`(at export)`, a generated
  wrapper) or for every caller (`(at entry)`, spliced into the body).

Nothing here is specific to Wine-Assembly. The examples show this tree and a
second, `android-emu`-style program (`wasm-export` forms, no `include` tree) to
keep the design honest about that.

Tests: `test/watx-compiler-cfg.test.js`, `test/watx-compiler-advise.test.js`
(every behaviour case compiles **and calls** the module, through both the
streaming and the whole-tree front end), `test/watx-compiler-facts.test.js`.

```text
 pass 1 (headers)                                  pass 2 (bodies, one at a time)
 ───────────────                                   ──────────────────────────────
 include closure ─► expand: if-const/cond-const     load body ─► expand ─► splice
   choose arms, record reads per file / advice        (at entry) prologue ─► codegen
 ─► collect advise / no-advise                      ─► release body
 ─► weave: match selectors, check hot, build
    (at export) wrappers, leave (at entry) chains
    on headers ─► facts.advice
```

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
`advise`; they may not contain `include` or `defmacro` (those are resolved
before conditions are evaluated).

A function header clause (`param`, `result`, `export`, `effects`, `advise`,
`no-advise`) may come from a conditional.

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

## 2. `advise`: function advice

`advise` puts code in front of functions. The code runs either where JavaScript calls in (`at export`) or wherever any caller calls in (`at entry`). It replaces v1's `export-wrap`.

```wat
;; module level: named or anonymous, selected by (match ...)
(advise ["NAME"] (match SELECTOR) (at export|entry) [(allow-hot)]
  QUALIFIER FORMS...)

;; inside a function: no (match): it advises that function
(func $f ... (advise (at export|entry) QUALIFIER FORMS...) ...)

;; inside a function: opt out of named module-level advice
(func $f ... (no-advise "NAME") ...)
```

The clauses before the qualifier (the name, `(match)`, `(at)` and `(allow-hot)`) may come in any order. Each may appear only once.

### Qualifiers

| | `(at export)` | `(at entry)` |
|---|---|---|
| `:before` | yes | yes |
| `:before-until` | yes | yes |
| `:after` | error: future work | error: future work, and only ever for functions with no `return_call` exit |
| `:around` | error: future work | error: never (it would need a frame) |
| `:filter-args`, `:override` | error: not planned | error: not planned |

- **`:before`** runs its forms and then the function. The forms may not `return`.
- **`:before-until`** may `(return VALUE)`, with a value of the function's result type. That returns from the function without running it. If the forms fall through, the function runs.

Advice forms see the function's parameters as locals `0 .. n-1`, by index. A wrapper's parameters have no names, so use indices for both placements. The forms can read and write globals and memory, and they are type-checked like any other body. Advice may not declare `(local ...)` and may not tail-call (`return_call*`).

### Where advice runs

- **`(at export)`**: the compiler generates a function with the export's signature. Its body is the chain followed by a call to the original. The export names that new function.
  - **Internal calls are unchanged**: only JavaScript's entry point moves.
  - Generated functions are appended after every other form, so no function index moves.
  - Every export keeps its place in the export section.
  - Memory, table and global exports are never advised.
- **`(at entry)`**: the chain is spliced at the top of the function's own body, after its `param`/`result`/`local` clauses. No function, frame or call is added. Every caller runs it: JavaScript, `call`, `call_indirect`, and a `return_call` into the function. A `return_call` out of the function still works.

### Hot functions: `(allow-hot)`

Entry advice costs every caller. So entry advice must say `(allow-hot)` if it would land on either of these:

- a function placed in the table (by `elem` or `func-table`), which in this tree means an interpreter dispatch handler;
- more than **32** functions in one declaration.

Without `(allow-hot)` the compile fails, naming the first function or the count. Inline entry advice on a table function needs it too. `(allow-hot)` is an error on `(at export)`. The limit of 32 is `WATX_ADVICE_HOT_LIMIT` in the compiler. Facts record it as `advice.hotLimit`.

### Selectors

| Selector | Matches |
|---|---|
| `(all)` | everything |
| `(export)` | at export: every function export; at entry: every function that has one |
| `(name "a" ...)`, `(prefix "p" ...)` | at export: the export name; at entry: the function name without `$` (an anonymous function has no name) |
| `(pure)` | inferred, see below; `(effects)` is its complement |
| `(effects)` | the function declares an `(effects ...)` clause, which forces it impure |
| `(in-table $t)` | functions placed in table `$t` (a compile error if there is no such table) |
| `(not S)`, `(and S ...)`, `(or S ...)` | combinations |

**Selectors never test the build.** `(option ...)`, `(const ...)` and `(target ...)` in a selector are errors. To make advice conditional, use one of the three ways below.

`(export)` and `(all)` are **default-deny policies, not lists**. They include functions declared after the advice, in later files too.

### Chain order

```text
JS ──► [outside advice A] ─► [outside advice B] ─► [inline advice] ─► body
       └─ declaration order, minus every (no-advise "NAME") ─┘   innermost
```

1. Module-level advice that matches the function runs in declaration order, first declared outermost. Any advice the function names in a `(no-advise ...)` clause is skipped.
2. Then the function's own inline advice runs, innermost.

This order holds separately for each placement. Export advice runs before entry advice, because the wrapper calls the function.

`(no-advise "NAME")` must name advice that exists in *some* arm of the program. A typo is an error. Naming advice that this build's `if-const` switched off is not an error. `no-advise` at module level is an error.

### Conditional advice: three ways

```text
1. whole declaration in a conditional       2. condition inside the forms
   (if-const (option TRACE) (then              (advise "trace" (match ...) (at entry)
     (advise "trace" ...)))                       :before (if-const (option TRACE) (then ...)))

3. per-function opt-out
   (func $run ... (no-advise "store-step") ...)
```

Advice whose forms are empty after `if-const` is **dropped**: it matches nothing and generates nothing. The binary is byte-identical to a build that never declared it. Facts still list it, with `dropped: true` and the options it depended on.

### `(pure)`: inferred, conservative

A function is pure when all of these hold:

- it has no `(effects ...)` clause;
- it is not an import;
- its body is not empty;
- every instruction of its **macro-expanded** body is a folded read:
  - `local.get` or `global.get`;
  - any `*.const`;
  - a load, including `load.field`/`load.elem`;
  - a numeric or SIMD operator that is not a store or an atomic;
  - `select`;
  - a region/layout constant: `region.addr/end/size`, `size-of`, `offset-of` or `elem-addr`.

Any of these makes the function impure: control flow, `local.set`/`tee`, any call, a store, `memory.*`/`table.*`, `unreachable` or an atomic.

- A trap is not an effect.
- "Impure" may be wrong in the safe direction: a function that branches but writes nothing is impure. "Pure" is never wrong.
- For an export-side selector, a function's entry advice counts as part of its body.

### Facts

`facts.advice` exists when the program declares any advice:

- **`hotLimit`**: the entry-advice limit, 32.
- **`declarations[]`**: one record per advice, `{index, name, inline, function, at, qualifier, match, allowHot, file, line, forms, dropped, dependsOn[], matched}`. `dependsOn` lists the options and targets of every `if-const` the declaration sits in, plus those inside its forms.
- **`chains[]`**: one record per advised function, `{function, entry[links], exports{name: [links]}}`. Each link is `{index, name, inline, qualifier, file, line}`, outermost first.

`facts.exports[]` gives each function export:

- `advice`: declaration indices, outermost first;
- `implementation`: the function that finally runs;
- `pure`: present when a selector asked.

### Example (this tree, `src/13a-export-guards.wat`)

```wat
(advise "store-step"
  (match (and (export) (not (pure))))
  (at export)
  :before
    (if (global.get $rep_store_step)
      (then (unreachable))))

(func $run (export "run") (param $max_blocks i32)
  (no-advise "store-step")    ;; store stepping IS run: one store per call
  ...)
```

While store stepping is armed, every export that might write refuses before it has any effect. Four functions opt out, each on its own header with the reason:

- `run`
- `set_rep_store_step`
- `guest_read8`
- `guest_read32`

On this tree the advice guards **1772 of 2436** function exports and exempts **660** inferred pure ones. That is the same set, signature for signature, as v1's `export-wrap`, which used a name list. The compiled wasm is **byte-identical** to v1's.

`android-emu`-style example, tracing every handler's entry in a debug build:

```wat
(defoption TRACE bool false "count handler entries")
(advise "trace" (match (in-table $handlers)) (at entry) (allow-hot)
  :before
    (if-const (option TRACE)
      (then (global.set $entries (i32.add (global.get $entries) (i32.const 1))))))
```

With `TRACE` off, the forms are empty and the advice is dropped, so the build is byte-identical to one with no advice.

## Decisions (approved 2026-11-24)

1. **Names**: `defoption`, `defconst`, `const`, `option`, `target`, `if-const`, `cond-const`. `advise`/`no-advise` replace `export-wrap`.
2. **Unchosen arm** is parsed only, not expanded or type-checked.
3. **No `(defined $f)`** in v1.
4. **Qualifiers**:
   - `:before` and `:before-until` are supported at both export and entry.
   - `:after` and `:around` are compile errors naming them as future work: `:after` at export later, and at entry only for functions with no `return_call` exit.
5. **`(pure)` is inferred**. `(effects)` forces a function impure.
6. **Upstream** to android-emu is a follow-up. This tree carries the feature sealed in `tools/watx-src/CHANGELOG.md` until then.

Observed while testing, not changed here: the streaming front end places out-of-line `(export "x" (func $f))` forms relative to inline exports differently from the whole-tree front end. Both orders are stable, and advice preserves whichever order the front end produces.

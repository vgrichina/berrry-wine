# Aranna: first descriptor cache initialization, 2026-11-07

The first runtime initialization is now observed globally, before selected title
identity. `OnStartChore` and `OnUpdate` set their initialization guards, look up
an empty descriptor registry, receive EAX=0, and store that zero. This explains
the later guarded zero caches. It does **not** establish why the registry is
empty or demonstrate an emulator CPU, Win32, or memory contract mismatch. No
production code changed; no repair or menu/world progress is claimed.

Evidence is in the ignored run
`scratch/runs/20261107-aranna-first-descriptor-init/` (started 06:28 UTC).
This extends [the wrapper-boundary investigation](aranna-reflective-time-dispatch-20261107.md).
The unchanged demo was launched once in one fresh box. Guest disassembly and
reads were evidence only. No guest stores, state forcing, synthesized callbacks,
media/config changes, or second original run were used.

## First writes and matched lookup returns

The initial PE and startup observations on CPU owners 0, 1, and 2 have all four
words zero. Store-helper observation starts globally at runtime startup,
independent of title selection. It records four before/after store pairs on
owner 0, below its independent quota of 64. Ordering:

| UTC | Actual guest instruction | Address | Original operation | Cache words afterward |
| --- | --- | --- | --- | --- |
| 06:37:08.127 | `6aaac8` | `7b3684` | byte OR 1, old 0 | `[0,1,0,0]` |
| 06:37:08.128 | `6aaae4` | `7b3680` | dword store EAX=0, old 0 | `[0,1,0,0]` |
| 06:37:08.129 | `6aaa6f` | `7b368c` | byte OR 1, old 0 | `[0,1,0,1]` |
| 06:37:08.132 | `6aaa8b` | `7b3688` | dword store EAX=0, old 0 | `[0,1,0,1]` |

The observer reports translated block PCs `6aaae1`/`6aaa88` for the two A3
stores; the instruction addresses above come from the unchanged guest bytes.
Other owners subsequently observe the changed shared words. Selected identity
arrives only at 06:38:45.308–309, over 97 seconds after initialization.

At `6aaaae`, the first wrapper has caller `69b4d4`, resource value `80010001`,
and argument 1. At `6aaa55`, the next wrapper has caller `69b67b`, the same
resource value, and dt=0. Resource values are not asserted to be pointers.

| Name bytes / length | Name address | `450cf7` result | Lookup callsite / matching return |
| --- | --- | --- | --- |
| `OnStartChore` / 12 | `7a2008` | `6aaadb` | `6aaadc` / `6aaae1` |
| `OnUpdate` / 8 | `7a1ffc` | `6aaa82` | `6aaa83` / `6aaa88` |

`450cf7` returns a **caller code address**, not an interned string. Actual
name bytes and caller-code bytes are recorded separately (events 176 and 177).
At `450dd3`, the three arguments are that caller address, name address, and
length. Both calls follow:

`450dd3 -> 454333 -> 452c47 -> 452c5a -> 452ca9 -> 450dea -> wrapper return`.

At `452c5a`, EAX is the header `086c00bc`; at `452ca9`, `450dea`, and each
matched wrapper return, EAX is zero. Both returns have matching stack/return
context. These are 14 steps against an independent per-owner quota of 128.
See `first-init-events.json`, `first-init-analysis.json`, and original
`observations.jsonl`; `validate-final.py` asserts this sequence and all stores.

## Registry state and registration ordering

The descriptor registry manager loaded from `[7ac9d4]` is `086e0034`.
Its map starts at manager+`20` (hex). At both lookups:

- map+0 = 0; map+4 = header `086c00bc`;
- map+8 = 1, the mode byte, **not the count**;
- map+0c = 0, the count;
- header left/right = header, parent = nil `086c0078`.

Static `455866` initialization uses this empty-header arrangement, with nil
loaded from `[7acabc]`. `4582ac` tests parent against nil and returns the header
on an empty tree, without a name comparison. `452c47` recognizes that header
and returns zero. The observed return agrees with those bytes and table state;
a bad comparison instruction is not demonstrated. A separate asynchronous,
read-only sample at 06:39:51.529 (`live-table.json`) confirms nil and the same
empty map/cache state. It is not a registration-return trace.

Do not confuse this registry with selected animator `09f4a828`, its animation
manager `08c85834`, or selected resource `80080008`. The first initialization
uses resource `80010001` before selection.

The independent generic registration quota of 512 fills at 06:36:42.290,
before first cache initialization. It captures one constructor post-call at
`451705` (06:36:42.054, count 0), 256 post-insert observations at `452348`,
and 255 temporary-string cleanup observations at `45235d`. Captured post-insert
and cleanup map counts are 1. The EAX-pointed words at `452348` describe an
iterator result on the stack, not a descriptor return. Thus earlier insertions
are positively observed, and later emptiness is positively observed; this
bounded trace does not prove how entries disappeared or that every registration
failed. No target-name predicate event 187–189 was admitted. That scoped
absence is not evidence of a missing registration.

The next concrete boundary is registration `4522f8`: capture actual inputs,
caller/code key, name/signature bytes, ECX, and matching results. In particular,
`45c5d7` returns at `4523b6` (nonzero EAX branches to erase), and `4512aa`
returns at `4523d5`, with AL tested at `4523d7` (zero also branches to erase). Observe
`452448 -> 454b58 -> 452457`, success AL=1 at `45241a`, and final return
`452420`. Use separate bounded quotas for kept/rejected registrations across
owners, not just an empty local-name predicate. This would locate the empty-table
cause before choosing any emulator regression or repair.

## Admission, original presentation, and recovery

Before the original, generated fixtures passed against the retained baseline:
identical guest bytes, registers, and PC; first guard/cache stores; nested
CALL/JMP/RET lookup; cross-owner observation without selected identity; nested
reflective dispatch; actual RPC slots 0/1/7/15; shared immutable identity; and
main/thread rendering import signatures. The observer wraps original store
helpers and calls each exactly once; no guest stores or flag evaluations are
added. Per-owner quotas remain independent from selected-wrapper observations.
These are observer admission checks, not an old-behavior-rejecting emulator
regression. `first-init-check.json`, `observer-check.json`, `dispatch-check.json`,
`broker-check.json`, and `host-check.json` record PASS.

A rendered Chrome 151.0.7922.108 shell smoke was personally inspected before
and after one balanced Start-button mouse down/up; the menu opens. The one
original then received ordinary EULA acceptance, passive observations, and one
balanced Escape after inspection of title doors. Captures show loading, intro
orb, logo, and title doors. `response-04.png` still shows doors immediately
after Escape. The later passive `response-05.png` shows a teal shell while the
UI says one app is running, with no title, menu, or world. The cause of this
presentation change is undetermined. The preserved final quit review mistakenly
said title doors; `capture-review-correction.json` explicitly corrects it without
rewriting the original command/review. Final broker records: 24,812, zero drops
in its reported counters. Selected-scope observations retain 64 guarded zero
cache entries and 960 zero wrapper returns; those bounded counts are not a
claim about every callback or runtime fault.

Recovery pins:

- Checkout at capture: `a59ac1821753ae20e868ce21ba89ad77e10a3f56`;
  relevant dirty hunks in `runtime-dirty.patch`, retained untracked recovery
  in `untracked-wininit.patch`; Git remains the source archive.
- CPU source commit `344c54a2cebb0af51858c80b78c18e665dc52080`, closure SHA-256
  `393c95db18c4eb54d055867a661e397d3786549ea341205b90931ae47e903674`;
  runtime closure commit `d14a8e882f9cee83408ba67587591f90bd921957`.
- Final observer module SHA-256
  `40f3dd9c246ee44ab05cc1c89e38a774280004ff26b16be47e517aeb3c048f18`
  (2,210,686 bytes), matched to the original's retrieved instantiated module.
  `prepare-observer.cjs`, retained transforms, `observer-standard.wasm.source.patch`,
  `owned-inputs.patch`, and `runtime-pins.json` preserve reconstruction.
- Existing media `scratch/game-media/aranna-demo-20261105/extracted/DSLOA.exe`,
  SHA-256 `fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
  Expansion.dsres SHA-256
  `3ed0688349f33b2dd7b9458c18cfbbc00490353c5888a93cd02c10da7f3c3b10`.
  Expansion was recovered intact by 54 independently hashed 4 MiB parts,
  concatenated and whole-hash verified; no whole-file upload retry. Parts were
  removed. Reference existing media rather than archiving/copying it into runs.
- All 2,147 pinned runtime files passed pre/post validation. 65 terminal outputs
  (27,506,210 bytes) and two root artifacts were retrieved with verified hashes.
  No source tree, scratch tree, or media archive was created.

Fresh UUID-idempotent box `bx_jqt84p35` was created at 06:32:50.711, with
original expiry 07:02:50.726. Explicitly delegated normal shutdown followed
retrieval: browser/runtime and supervisor exit 0; all 11 recorded processes
absent, both ports closed, browser profile absent, four locks released. Stop
completed nonforced at 06:40:55.363; inspected box state is archived, stopped
06:40:55.346, no expiry. Owned local watcher/smoke processes and ports are clear;
free /home remains above 2 GiB. No production build was run for this docs-only
finding. `local-evidence-validation.json`, `publication.json`, and final
`result.json` record validation and publication; result.json is written last.

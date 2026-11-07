# Aranna title animator: owning CPU history, 2026-11-07

The fresh unchanged original reached the title doors but not the ordinary menu or
world. **No emulator repair is justified by this run.** The narrower missing
observation is the resolved `OnUpdate`/`OnStartChore` reflective dispatch for the
selected clip resource, and its call into `UpdateBlender`/`AnimationCallback`,
with admission on every CPU instance that can own those calls.

Evidence: `scratch/runs/20261107-aranna-animator-owning-history/` (ignored).
This follows `aranna-animation-completion-20261107.md`; its native/current/retained
126 controls were not repeated. Animator `+0x7e` remains consumed pose dirtiness,
not an enable defect. No guest instructions, guest state, assets or configuration
were patched or substituted. No completion was synthesized.

## Runtime and observer provenance

- Checkout at admission: `15b2e2bd49542fe8df76f116df4b2dfeca191f95`, main.
- Retained CPU source: Git `344c54a2cebb0af51858c80b78c18e665dc52080`;
  decoded WAT closure SHA-256
  `393c95db18c4eb54d055867a661e397d3786549ea341205b90931ae47e903674`.
- Reproduced the previous retained observer module byte for byte before adding
  this observer: SHA-256
  `e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`,
  2,206,837 bytes. This was a provenance check, not another guest control run.
- Actual loaded module, recovered from the instantiating worker and independently
  hashed after retrieval: SHA-256
  `be11732bb2e6fb7167f402661c180beb4a47752b684ffa6322ff965e532ada10`,
  2,207,948 bytes. The owning target was slot 0 / endpoint 1,
  `48BB770FAF72591220B3045820DB2285`.
- `observer-standard.wasm.source.patch` records the full transformation against
  retained Git source. `observer-transform.cjs`, `prepare-observer.cjs`,
  `schema.json`, and `module-contract.json` record generation, fields and unchanged
  module imports/exports. Source was reconstructed in memory, without a checkout
  copy or source archive.
- Browser/runtime/media closure: `runtime-pins.json`, verified remotely before
  launch, retained runtime identity `d14a8e882f9cee83408ba67587591f90bd921957`.
  `prepare-runtime.py` records the two tracked runtime files recovered directly
  from that Git revision. Relevant current dirty hunks are in
  `runtime-dirty.patch` and `untracked-wininit.patch`; the retained pin manifest,
  not the changing shared checkout, defines this run.
- Original media: existing
  `scratch/game-media/aranna-demo-20261105/extracted/DSLOA.exe`, SHA-256
  `fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
  Other media paths/hashes are in the pin manifest. No repeated media archive.

The passive WAT hook uses emulator-private globals and retained nonfaulting reads.
It records entry/return with matching ESP, actual float argument bits, decision
boundaries, animator/manager/current-node words, binding installation and reserved
completion lifecycle events. It does not evaluate guest flags or write guest
memory. Detail limits are 128 entry/return pairs, 1,024 decision boundaries and
64 separately reserved lifecycle entries. Synthetic RET-stub checks passed before
box creation at 05:48:12Z; the strengthened lifecycle/state-receiver check passed
before the sole original launch at 05:51:45Z. Baseline and observed stub executions
had identical guest bytes, stack and PC. These checks validate the observer, not
original-program correctness. An intermediate local WAT syntax failure is retained
in `compile-observer-final.log`; final compilation and checks passed.

## Owning CPU results

`analysis.json`, `animator-final-events.json` and raw `original/observations.jsonl`
retain the measurements. Addresses below identify read-only guest test evidence.
The selected animator was **166835476**, manager **147347508**, frontend
**150089148**; these were resolved from the live title entry, not copied from an
older run.

| Observation | Measured result |
| --- | --- |
| Title routine `0x4bf1bb` | First admitted at 05:54:55.961Z on slot 0 |
| `0x69b615` initial entry | Actual `dt = 0`, caller return `0x4be0a5` |
| Pending processing return `0x69b62e` | EAX = 1; pending `+e4` changes 1 to 0 |
| Readiness boundary `0x69b659` | All 171 admitted decisions have EAX = 1 |
| Subsequent animator updates | 127 positive float arguments, 0.0380010009–0.0670000017 seconds; caller return `0x5b9adb` |
| Entry/return window | 05:54:55.961Z–05:55:02.346Z; 128 matching returns |
| Pose update return `0x69b6ac` | 170 samples have AL = 0 (full EAX = 147347456) |
| Detail window | Ends at 05:55:04.554Z when the explicit 1,024-boundary cap is reached |
| Selected clip/request | `+c4 = +d4 = 13`; request `+dc = 1`, `+e0 = 0`; `+d0 = 0` throughout snapshots |
| Animator status | `+78 = 0`, `+7c` dword = 257, `+f0 = 0` throughout snapshots |
| Manager phase/status | `+34 = 0`, `+38 = 0`, `+10 = 0`, `+48 = 0` throughout snapshots |
| Manager current/end | `+3c = +44 = 152079244`; the pointed node is self-linked |

The initial zero-time update returns **before** binding installation. At
05:54:55.964Z, `0x69b012` receives, then stores at animator `+f4`, exactly
`[0x4c0236, 0, 150089148, 0x4f3cab]`. Incoming and stored binding words match.
Thus this run distinguishes successful pending/readiness handling and positive
animator `dt` from phase-manager advancement. It does not support blaming zero
`dt`, an unready clip, or the consumed pose-dirty byte.

No reserved `0x69b048` dispatcher, `0x4f3cab` adapter, `0x4c0236` member, or
`0x521f84` state-request event was admitted. No selected-manager `0x6a6a11`,
`0x6a6a2e`, `0x6a4bd7` or `0x69dde1` event was admitted in the detail window.
These are scoped absences, **not proof of global non-execution**: selected-object
admission lives in each WASM instance's private globals, and only slot 0 saw the
title entry that populated them. Calls on another instance would not qualify.
The animator detail cap also prevents claims about later phase state. A later
title-entry packet at 05:58:37.354Z reports 4,546 selected updates, establishing
continued entry activity, without extending the early argument/state window.
The terminal broker reports zero drops and no observation error; caps and
cross-instance admission, rather than broker overflow, are the stated limits.

## Static discriminator and concrete next observation

`static-boundaries.json` identifies `0x69b048` as exported
`Aspect::AnimationCallback(unsigned long)` and `0x69dde1` as
`Aspect::UpdateBlender(float)`. A linear rel32/reference scan and DLL import scan
found no static natural caller of `AnimationCallback`. That does not exclude
indirect or script/reflection calls; the natural completion caller remains
unresolved.

Bounded disassembly adds a specific next boundary:

- `0x69b615` sends its resource/clip time through `0x6aaa55`.
  `resource-time-path.txt` shows this is a reflective wrapper: it resolves the
  literal **`OnUpdate`** (`0x7a1ffc`), caches its descriptor at `0x7b3688`, and
  invokes `0x45f650` only if that descriptor is nonzero.
- Pending clip setup similarly uses `0x6aaaae`, the **`OnStartChore`** wrapper
  (`0x7a2008`, cached descriptor `0x7b3680`). Names were read from the existing PE;
  `resource-wrapper-names.json` records them.
- The direct static `UpdateBlender` call at `0x69b4f1` is gated by bit 0 of
  animator `+d0`; the observed value is zero. Its absence therefore does not by
  itself identify a CPU branch error (`clip-commit-gate.txt`).
- `UpdateBlender` passes manager and float time into `0x6a6a11`, which calls the
  phase routine with `ECX = manager + 0x34` and combines its status into manager
  `+0x10` (`blender-status-path.txt`, `manager-phase-path.txt`).
- The bound member `0x4c0236` uses state-machine receiver `[0x7ace3c]` and requests
  state 5 with zero delay through `0x521f84`; that receiver is not the frontend.
  The reserved observer explicitly admits that request without a frontend-ECX
  condition (`binding-reference-excerpts.txt`, synthetic lifecycle check).

The next useful observation is therefore the selected resource's incoming
`OnStartChore`/`OnUpdate` arguments, cached descriptor, resolved dispatch target
and return at `0x45f650`, plus manager phase construction/advancement and natural
completion entry on **all** CPU owners. Seed identity from shared resolved
objects rather than requiring every instance to execute `0x4bf1bb`; reserve
separate small budgets for this reflective path and completion. This run did not
capture those resolved descriptors/targets, so neither a skipped script dispatch
nor a CPU/Win32 semantic mismatch is established. Independent native/CPU/API
semantics and an old-implementation-failing regression are still required before
an emulator repair can be claimed.

## Frames, inputs, validation and lifecycle

The cheap rendered full-shell smoke was personally inspected before creation:
one balanced Start-button click opened the Start menu (`smoke-before.png`,
`smoke-after.png`, `smoke-review.json`). It ran no original guest.
The single fresh original attempt then recorded these individually reviewed
frames, paired with `.state.json`, `.review.json`, input tickets and receipts:

| Frame | UTC / visible state | Following action |
| --- | --- | --- |
| startup | 05:52:26, EULA | One balanced click at fractions **.2481,.7093** |
| response-00 | 05:53:06, black loading | Passive observation |
| response-01 | 05:53:27, black loading | Passive observation |
| response-02 | 05:54:06, black loading | Passive observation |
| response-03 | 05:54:52, logo on black | Passive observation |
| response-04 | 05:55:39, logo over closed title doors | One balanced Escape |
| response-05 | 05:57:41, title doors unchanged | Passive observation |
| response-06 | 05:58:21, title doors unchanged | Normal quit |

There was no ordinary menu or world to act on. No EULA/clock control was rerun;
no clock sampling supports a timing claim. Observer compilation, byte-identical
retained provenance, unchanged import/export contract, synthetic passivity and
lifecycle checks, shell smoke, input receipts, fetched evidence hashes and normal
cleanup checks passed. No production code changed, so no emulator regression or
locked production build is claimed for this documentation-only result.

One box was created with a UUID Idempotency-Key, `bx_d7r57pgd`, at 05:49:18Z;
original expiry was 06:19:18Z. No resume, risk/access response, nested worker or
second heavy runtime occurred. Evidence was retrieved before the explicitly
delegated normal box stop. Guest/browser/supervisor exited code 0 at 05:58:42Z;
all 11 recorded process IDs, runtime/CDP ports 34273/43317, and browser profile
`/tmp/wine-assembly-input-Lx2gJi` were absent, with all four runtime locks released
(`cleanup-verified.json`). Normal stop requested 06:00:34Z; API inspection
confirmed **archived**, stop completed, non-forced at 06:00:35Z. Evidence manifests
and lifecycle responses remain in the run directory; no source/media archives
were made.

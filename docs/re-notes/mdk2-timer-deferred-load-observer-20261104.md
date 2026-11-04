# MDK2 passive timer and deferred-load observation, offline

The owning-main observer now records bounded native collection, release-dispatch,
timer and deferred-load boundaries in the same append-only history as its
existing type10 demand/completion/script-buffer and sampled Level records.
This implements observation only. It supplies no new original-game witness,
readiness grant or gameplay claim.

Inputs are `aad7b588f`'s [callback-context finding](mdk2-callback-active-context-20261104.md)
and `12a87f17971452efbbeecb88778a1bdc1f863955`'s retained original evidence.
Evidence is `scratch/runs/20261104-mdk2-timer-deferred-load-observer/` (RUN),
with integration outputs in its sibling `20261104-mdk2-timer-deferred-load-observer-integration/`.
Git SHA plus relevant binary diff and owned new-file patches preserve source;
existing media/modules are referenced by path, size and SHA-256. No source,
media or module archive/copy is introduced.

Before observation, executable identity remains SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`.
The composed driver additionally checks original scripts.zip SHA-256
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.
Focused tests decode menu.lua, level0.lua and mdk2.lua in memory and verify their
original hashes. The observer checks 35 exact live instruction contracts,
including the original native timer setter/subtraction/dispatch, Lua event
bridge, deferred stores and main-loop consumption. Selected disassembly and
all byte pins are retained in RUN; scripts are neither copied nor executed.

| Boundary | Direct observation | Limits on interpretation |
| --- | --- | --- |
| Main-loop collection | Entry `443070` with caller `40218c`; checked ESP+4 return. An initial sample at `4434a0` may retain only the exact five-return stack suffix from the original finding, explicitly marked `prefixUnknown`. | No GC graph traversal, invented entry, remaining-work or duration estimate. |
| Medium's native release path | `42ae70` with caller `46d0c4`, command index62, phase2 and active0; checked return before the pinned post-call active store. | This is the shared Enter release dispatcher. Identifying its Lua operation as Medium still requires the same-history selector/context evidence. `active1` is post-dispatch state; full-rest active0 is unchanged. |
| Timer arming | Original `46cb20` entered from `41e9b2`, actual gob pointer and float argument; return validates gob+`a0` bits. | Gob identity is a captured pointer. Lua `startscreen` association is unknown without independent Lua identity. Pointer matching to an earlier arm is temporal correlation, not object-lifetime proof. |
| Timer expiry/handler | `42b0c0` from `46b693` with nonpositive captured countdown; dispatcher entry/return. If taken, event7 bridge `40daf0` from `42b0f2` and Lua-call `442370` from `40db0e` have separate checked entry/return frames. | The countdown is relative; absolute deadline is null. A dispatcher return alone does not prove an installed Lua handler. Lua-call return does not assert semantic success. Unrelated gob Lua calls are ignored. |
| Deferred request | Lua wrapper `4391a0`; `42bbe0` from `439237`; setter `42cc80` from `42bc2c`, with actual requested level/checkpoint and validated stored globals. | The wrapper entry alone does not establish its Lua caller or timer parent. |
| Consumption | `4019d2` check; loader `42c990` from `401a2d`; checked return and subsequent clear at `401a33`; native Lua level-dispatch path `42cc1e`. | A flag check or loader entry is not completed loading. The level-dispatch path is not a successful Lua result. |

Every emitted record includes direct requested-level/checkpoint/load-flag values
at `4b712c/4b7494/5ccb48`, alongside the existing resource record and continuous
boundary count. New events do not reset the owning history, counters, deadline
or existing demand/decoder/finalizer/buffer state. A sampled nil-to-table Level
transition retains its existing narrow meaning, not a gameplay classification.

The import observer remains passive: no run, setters, guest writes, callback
execution, timer driving or trace arming. The driver binds its epoch to the
same owning Module binding and rejects changed instances/threads/imports,
epoch changes, regressing slice ordinals, malformed frames/returns, unmapped
reads, invalid flag/countdown values and missing required history. New records
have a maximum serialized byte budget of 8192; record-byte exhaustion is terminal
in the driver just like existing record/boundary/deadline exhaustion. No later
event can append after termination. Existing 50M/360s, 512 records, per-read and
decoder byte windows, input/ACK/owner/frozen-review, 16ms and 512/544 selector
limits remain intact. No original runtime code, assets or configuration change.

Offline verification uses original executable fragments in ordinary queued
Workers with explicit fixture objects: the native timer setter, timer
dispatcher with no installed handler, and deferred setter. Both tested module
variants compare full-memory hashes, GPRs, lazy flags, queued commands and the
original trap against observation disabled. Each pair reads module bytes once
in memory and records its hash, independently of changing shared build paths.
Getter-only readback models test
collection entry/suffix/return, release dispatch, nested timer/Lua return frames,
load consumption and owner/epoch/stale/frame/return/global-bound/terminal/record
byte negatives. These models do not execute original callbacks or synthesize
historical timer state. The integration suite independently retains the exact
original Git fixture and checks its fixed hash; new timer fixtures do not
replace that baseline or qualify a historical full runtime closure.

The exact composed entry is also exercised with plain Puppeteer mocking and
independent child-spawn prohibitions: ZERO Chrome. This is an offline entry
fixture, not historical full-closure acceptance or renewed runtime admission.
Focused observer tests pass for both variants; all 151 integration tests and
42 local-runtime tests pass. The full
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Logs are in RUN.

`audit.cjs` verifies all 29 original append-prefix checkpoints, 762000 native
boundaries, 40 records and five finite decoder request returns without rewriting
them. At the last original sample, main remains at `4434a0`; consumed Enter has
raw0/previous0/active1. No new construction demand, finalizer, script-buffer or
new Level appears in those records. The new observer has not run against that
game history and does not backfill any missing field.

The remaining original witness is owning-main progression out of that exact
collection, then independently identified startscreen gob/countdown/firing and
handler return; the requested-level/checkpoint/load globals and deferred
consumption; and subsequent type10 demand/completion, script-buffer execution
and new Level identity, all within one continuously owned history. Exact Medium
dispatch entry/return also remains uncaptured in the original run. Nothing here
establishes a lost timer, loader defect, eventual construction, remaining stream
contents or expected progress duration.

No Chrome/game/boat/shared heavy runtime lock, runtime admission, reset/cap raise,
npm, subworker, deployment or HeroesII action occurred. Box ID/state/expiry: NA;
coordinator owns shutdown. This worker tests and publishes its own change, then
stops; any original-game observation requires a separate assignment.

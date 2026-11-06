# Aranna semantic menu route — 2026-11-06

Run: `scratch/runs/20261106-aranna-semantic-menu/`.
Candidate: `NEW-GAME-ARANNA-DEMO-20261010`.
Result: precise new state-writer and semantic-route boundary. One qualified
original reached the Main Menu; ordinary Single Player click and Enter left it
unchanged. Gameplay, a Single Player semantic invocation, native Windows
comparison, and a documented CPU/Win32 mismatch remain unproved. No production
emulator behavior was changed.

The retained `20261106-aranna-wrapper-action/measured-boundary.json` and
`wrapper-action-report.json` establish the actual wrapper212/member `004bccac`
path, state5, and empty frontend release range. Their AL1 is not evidence of a
Single Player action. Existing input observations are reused without increasing
quotas. No original guest bytes, state, or media are changed.

## Semantic action and query identity

Read-only extraction of `main_menu.gas` from both existing `Resources/Logic.dsres`
and `DSLOA/Expansion.dsres` independently gives:

```
[t:button,n:button_single_player]
rect = 280,132,517,178;
[messages]
{
    onbuttonpress = notify(show_single_player_menu);
    onlbuttondown = notify(button_down);
    onlbuttonup = notify(button_up);
    onrolloff = notify(button_up);
    onrollover = notify(button_rollover);
}
```

The complete small resource texts, exact archive entry offsets, lengths, CRC32,
and hashes are in `static-evidence.json`, `logic-main-menu.gas`, and
`expansion-main-menu.gas`. The extraction script reads existing media paths;
it copies no game media archive. Both entries pass exact length and CRC checks.
Their agreement does not identify which override the original loaded.

The executable's UI message-name table at `007a5098` identifies 3 as
`msg_onlbuttondown`, 4 as `msg_onlbuttonup`, and 9 as `msg_onbuttonpress`.
The action table at `007a4ff8` identifies 11 as `action_notify`. Its dispatch
entry `006f3790` calls `00705945` with the notification string object and control.
That dispatcher invokes each registered binding via `[edi+0x0c]` at `0070595a`,
returning at `0070595d`. The registration at `004bbc96` supplies:

```
[004b9622, 00000000, this, 004df709]
```

Wrapper `004df709` loads the receiver, adds its adjustment, and calls the actual
member `[binding]` at `004df71b`; member return is `004df71d`.
Member `004b9622` first checks its receiver's virtual activation predicate.
It compares the notification string against `00783be4`,
`show_single_player_menu`, at `004b9fea`. The equal branch eventually reaches
`004bac20`, builds a zero double delay, pushes **18**, then jumps to
`004b974f`, which loads `[007ace3c]` and calls `00521f84` at `004b9755`.
This is the statically identified Single Player menu request.

`selection_down` is separately registered to `004bccac`; `skip_current_movie`
is registered to `004bccd2`. Neither name establishes the semantic UI button.
The UI manager's configuration keys `left_button_down` / `left_button_up` bind
members `006ead80` / `006eb03a`. These configuration keys must not be substituted
for the actual runtime query `left_down` already captured in retained inner206.
Retained wrapper208 has binding `[006ead80,074ffb70,09f0115c,006f003f]`, actual
wrapper `006f003f`, return PC `0043b4af` and SP `074ffa34`; it returns AL0.
The wrapper's static tail target is thus the UI down member, while the retained
212 binding belongs to the later frontend selection action.

The UI down member calls a control's virtual slot `+0x5c` to hit-test and then
sends message3 through `00705980`; the release member hit-tests before message4.
The base rectangle predicate `006f34f0` checks enabled byte `+0x137` and inclusive
left/top, exclusive right/bottom bounds at `+0x60..+0x6c`. Derived overrides and
actual loaded control geometry remain runtime unknowns. Control event processor
`006f32ef` searches its event/action list and calls virtual slot `+0x54`.
Consequently an empty **frontend** `left_up` range does not establish that the
UI control saw a release, hit, or button press.

## State field meaning and writer

The executable's 43-entry state-name table is `0078e550`, registered at
`00521b86`. Lookup `00521bb2` calls indexed table lookup `00426f9d`.
Index4 is `ws_logo`; **5 is `ws_main_menu`**; **18 is `ws_sp_main_menu`**.
All 43 pointers/names are retained in `static-evidence.json`.

Constructor `00521ca3` stores its receiver in `[007ace3c]`, initializes `+0x20`
to zero and then2 (`ws_init`). State request member `00521f84` takes a target
state plus double delay and validates transitions using the current state.
Immediate requests are staged in `+0x28` with serial `+0x2c`; deferred requests
use `+0x34/+0x38/+0x40`.

Pump `00521e4f` moves ready deferred requests to pending, then records the old
and new states. At `00521ee5` it loads current `+0x20`, pending `+0x28` and pending
serial `+0x2c`. It saves old state/serial at `+0x18/+0x1c`; instruction
**`00521efb: mov [esi+0x20],edx`** commits pending state to current. It updates
`+0x24`, clears pending fields, and calls virtual transition callback `+0x08`
with old/new states. This identifies a concrete writer and the field's meaning
from the executable; it does not prove which runtime call wrote the retained
value5 at object `08af0f54`.

The previously observed `004bccac` skip of its state4 call is consistent with
being at the Main Menu rather than the logo. The captured operands and selected
CMP/Jcc paths agree. No documented CPU/Win32 mismatch follows from this state.

## Qualified passive observation

Run-owned `observer-transform.cjs` extends the retained passive observations.
New complete transactions target actual indirect hit-test calls for the named
`button_single_player` control, its control events, the exact semantic
notification callback and its owning binding invocation, state5/18 requests,
and pending/deferred5/18 pumps. Each new kind has32 admissions. Existing quotas
and packet endpoints remain unchanged; narrow name/state admission avoids
spending them on unrelated UI initialization.

The store wrapper calls the real `gs32` once and copies the prior/current value
only for the state object's `+0x20` during an admitted pump. It records a **block
EIP**, not an invented instruction PC. Event86 also copies the native bytes
starting at `00521ee5`, so the effective address and before/after value can be
attributed to instruction `00521efb` only when those bytes match the executable.
A ready deferred pump starts its observation at `00521e72` after timer readiness;
its saved caller is at `[esp+0x2c]` and return SP is `esp+0x30`, reflecting the
native `sub esp,0x28; push esi` frame. This phase start avoids consuming the
bounded pump observations on timer-waiting calls. No extra Win32 getters, guest setters, memory
changes, guest patches, or forced actions are part of this observer.

The generated fixture executes ordinary guest calls/stores, native
rectangle-predicate and current/pending instruction shapes, both hit outcomes,
a negative notification, the actual semantic string, actual wrapper/caller
return identities, and state5→18. Its values are synthetic controls, not original
execution evidence. Standard/compat × disabled/observed × ordinaryAPI/owning
Worker controls preserve nonzero GPR, lazy flags, live x87 payload and
environment, input/COM/API/fault results, and reject missing/wrong endpoints.
All eight cells passed. Both baselines equal their shipped modules byte for byte;
observer import/export contracts remain identical. Each CPU owner was identified
by target/session/slot and its actual CDP-recovered WebAssembly bytecode hash.
Actual HTTP response hashes cover source, helpers, modules, and existing media.


## New original boundary

All assigned predecessors posted their exact final releases. The worker reopened
full cleanup evidence and independently checked every recorded resource before
starting: full final-cleanup sets130 absent PIDs,11 refused ports,8 absent
profiles; comprehensive lifecycle625 PIDs,61 ports,25 profiles,4 free locks,
no heavy process, disk floor passed. Runtime window: **08:45:32–09:30:32 UTC**,
including cleanup. No boxes, workers, other games, deployment, guest patches,
forced state, or quota changes were used.

The locked full build passed at08:46:37. Three focused regressions passed:
`test-renderer-input-cursor.js`, `test-browser-relative-mouse-lock-gate.js`,
`test-browser-relative-mouse-latch.js`. Controls passed at08:48:09 before the
single original. Tested Git commit: `51dc02db9ab9b00ac0a5de1c9c752c1d387ac4b1`.
Git binary diffs and owned new-file patches are retained in
`preoriginal-source.json` and its referenced patches; Git is the source archive.
Later coordinator documentation commits changed HEAD without changing the
hashed runtime/helper closure; the final closure check passed.

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| shipped standard / disabled baseline | 2178624 | `3b7511d12f3e8d364eb6bf29cdeed8b53af07abc53644d4f186e46f8620da149` |
| observed standard | 2201031 | `337c2f828c9a4daa7abc129848dd89d5065594a9925057274d337ff58e49e965` |
| shipped compat / disabled baseline | 2181270 | `33c0e72903f542222ec7bb1330a3a408743765184b4a7b8da451e24faf612f41` |
| observed compat | 2203677 | `3fcb0465b01bff97021c4e3e415a6ffc74dc3f54d64337f28994d89eefa6e315` |

The one original ran08:48:21–08:53:47 and closed normally. Before input,
`preinput-identity.json` verifies the actual CPU Worker slot0/endpoint1 module
against the observed-standard hash; `original-http-identity.json` verifies the
served source/media bodies. Balanced ordinary Accept and Escape inputs reached
the Main Menu. Personally reviewed `menu-ready.png`, `after-single-player.png`,
and `after-enter.png` show Main Menu before click, unchanged after click, and
unchanged after the balanced Enter second response. `personal-review.json`
records every reviewed capture. This is not gameplay.

The new actual state transactions are complete:

| Invocation | Entry | Receiver | Actual return PC / SP | Observation |
| --- | --- | --- | --- | --- |
|248 / kind22|`00521f84`|`08af0f54`|`004c024a / 074ff988`|request5, zero double delay, current4|
|249 / kind23|`00521e4f`|`08af0f54`|`004c5cbb / 074ffc2c`|pending5, serial3; commits4→5|

The request caller contains `push 5; call 00521f84` at `004c0243/004c0245`.
The pump caller calls `00521e4f` at `004c5cb6`. During that actual pump, event83
records effective address **`08af0f74`**, prior4, value5, resulting5, block EIP
`00521ee5`. Event86's64 native bytes match the existing `DSLOA.exe` exactly,
including **`00521efb: 89 56 20`**, the current-state store. This resolves the
actual writer and meaning of the retained state5 field. The writer block EIP
has not been misreported as an instruction PC. `semantic-transactions.json`,
`measured-boundary.json`, and narrow caller disassemblies preserve the proof.

All3828 copied packets form305 completed transactions with zero incomplete
transactions and matching actual PC/SP endpoints. The click's actual UI wrapper
invocation268 returns AL0 at `0043b4af`, with binding
`[006ead80,074ffb70,09e2e610,006f003f]`. Its frontend counterpart272 is the
separate `004bccac` selection binding; it returns AL1. Actual query text
`left_down` and empty frontend `left_up` remain distinct from the resource's
semantic notification. See `query-action-report.json`.

## First failure and limits

The first visible menu action failure is preserved in
`first-visible-action-failure.json`: the ordinary click leaves Main Menu visible.
Only new kinds22/23 were admitted. No named hit, control-event, semantic callback,
or owning notification binding (kinds24/25/21/26) was admitted in the original.
The admission assumes that `control+0xa4` points directly to the loaded name;
that original layout was not runtime-qualified. Its generated fixture coverage
cannot establish that layout or prove the original UI path never executed.
No state18 request was observed. Do not infer Single Player action success or an
emulator defect from the frontend selection return.

A postprocessing assertion incorrectly required the document DOM sample to have
matching mouse-down/up counts. Exact failure and raw counts are preserved in
`first-postprocessing-failure.json`:3 downs /1 up;4 key downs /4 ups. The owning
renderer paths independently contain both ordinary canvas down/up pairs, ending
with buttons0. `balanced-input-review.json` keeps those raw pairs, the cursor
warp, and the incomplete DOM sample explicit. The document-listener release
capture reason remains unknown; no input repair is inferred from it.

The next missing fact is the actual UI member's pre-hit gating path for receiver
`09e2e610`: manager/interface/control list bounds and flags, actual loaded button
name representation, and actual hit target. An observation must establish that
identity without depending on the unproved name layout before an absent named
packet can be interpreted. Preserve complete owning transactions. No further
original was attempted; no documented CPU/Win32 mismatch justifies a repair.

Evidence and cleanup are local to `scratch/runs/20261106-aranna-semantic-menu/`.
Existing game media is referenced by path/hash, with no source or media archives.
No boxes were assigned or created; box ID/state/expiry and handback are N/A.

Owned cleanup at `2026-11-06T08:59:37.200470+00:00` passed: 43 absent PIDs,
4 refused ports, 2 removed profiles, all four locks free,
5540806656 bytes free on `/home`. Local browser/server/lock holder and
append-only watcher are gone. No box lifecycle operation was performed.

# CACA003B retained callback lifetime — 2026-10-22

**Scoped FAIL** on exact accepted main
`c26252c4a95babe583ade1d1c6e2da0c050be45c`. The dedicated timer-thread
continuation accepts a callback return under a different, currently valid
invocation identity. This is an executed source-level lifetime failure, not a
new failure of the accepted CACA000A implementation or a demonstrated game bug.
No production repair was made. Nonlocal jump APIs and all census/ownership
gates remain unchanged.

## Actual producer and return matrix

| Boundary | Production behavior | Qualification here |
| --- | --- | --- |
| `09a-handlers.wat:446` `mm_timer_thread_ensure` | Creates CACA003B thunk, zeroes loop ESP, starts thread at thunk, publishes handle | Inspected; host thread creation not executed |
| `09a-handlers.wat:463` `mm_timer_thread_step` | Entry and callback completion share one function; check, pin ESP, poll/consume timer, push six words, transfer to callback; otherwise sleep/re-enter | Extracted function executed unchanged |
| `05-alu.wat:666` `th_ret_imm` | Guest RET pops return address and argument bytes | Actual production function executed |
| `13-exports.wat` run-loop thunk-zone arm | Routes callback EIP into dispatcher | Extracted arm executed |
| `09b-dispatch.wat:100,1595` outer dispatch / CACA003B arm | Preflight check before effects; inner arm calls thread step | Whole outer function and inner prefix through actual arm executed |
| `09a-handlers.wat:347` `mm_timer_thread_check` | Validates live process/thread root and rejects live CACA000A carry under that root | Executed at entry and return; no retained CACA003B identity comparison exists |
| `fire_mm_timer`, DispatchMessageA, bound wave/MIDI | CACA000A retained save-frame path | Prior acceptance reused; only saved-carry regression and direct collision exercised here |

The thread's callback never creates a retained child record. A valid current
root alone does not prove the return belongs to the invocation that admitted
the callback. Initial entry, idle re-entry and callback completion currently
have no separate lifetime state.

## Reproduction and outcomes

Run from the task checkout (Node v24.18.1, no dependencies installed):

```sh
node docs/re-notes/timer-thread-lifetime-boundary-oct22/reproduce.cjs --controls
node docs/re-notes/timer-thread-lifetime-boundary-oct22/reproduce.cjs --require-safe
node test/test-audio-saved-carry.js --mutations
```

The first command exits **0**, verifying 15 recorded outcomes, including three
reproduced unsafe acceptances. Exit 0 means the observations reproduced, not
that lifetime qualification passed. `--require-safe` exits **1** with
`Missing expected exception: retained CACA003B unrelated-child`. This is the
direct failing safety assertion, not a compile or fixture failure.

Smallest reproducer: initialize a valid root, dispatch initial CACA003B to
admit a one-shot callback, call actual `invocation_enter`, execute actual RET20,
then dispatch CACA003B. Admission identity is 2, replacement identity is 3.
The return succeeds, resets the loop to ESP `0x18000`, and enters the idle
50ms sleep while identity 3 remains current. No stale-root corruption, forged
CACA000A record, or production mutation is needed. These addresses are fixture
allocations, not production region addresses.

| Case | Actual result |
| --- | --- |
| Normal callback through RET20 and CACA003B | Correct six-word arguments, one-shot consumption, ESP and idle return |
| Stale shared root / epoch / current thread ID | Reject before dispatcher mutation |
| Actual shared-memory thread-slot reuse in a second instance | Old instance rejects |
| Actual process restart in a second instance | Old instance rejects |
| Live audio CACA000A carry collided with CACA003B | Reject unchanged; proper audio return then thread return both succeed |
| Thread return labeled CACA000A without its record | Reject unchanged |
| RET 0 / 16 / 24 instead of RET20 | Accepted and ESP pinned, matching explicit production convention-tolerance policy |
| Timer table slot reused during first callback | Correct new callback arguments; both returns succeed |
| Unrelated current child | **FAIL: accepts old callback under new identity** |
| Same-depth child retirement and replacement | **FAIL: identity 3 → 4 accepted** |
| Same instance explicitly rebound to fresh thread root | **FAIL: identity 2 → 3 accepted** |

Rejection assertions compare copied whole-memory and exported-global snapshots
at the outer dispatcher boundary, after RET's legitimate stack pop. The return
routing itself is exercised in successful and unsafe-acceptance cases.

The rejecting control removes both actual `mm_timer_thread_check` call sites
only from the compiled fixture text. Compilation succeeds and the stale-root
behavioral assertion fails as expected. Thus stale rejection is observed at
execution, not inferred from source spelling. Existing saved-carry regression:
**29 cases pass and all six corruption controls detected**, exit 0. Existing
tests and production files are unchanged; canonical 28/22/23 and shipping 26
assertion acceptance at c26252c4 is reused, not replayed.

## Smallest repair dependency (not implemented)

The bounded dependency is independent CACA003B admission/completion ownership
in `src/09a-handlers.wat` (`mm_timer_thread_step` and
`mm_timer_thread_check`), used by the existing outer preflight in
`src/09b-dispatch.wat`. Retain a non-reusable callback identity and its root/
thread lifetime before consuming the slot or changing the callback stack;
validate that retained identity before completion effects. Distinguish initial
and idle loop entry from an outstanding callback return. Retire only the
matching callback, without consuming a CACA000A record. A dedicated retained
child can use the existing invocation allocator; merely calling
`invocation_validate` again cannot fix the demonstrated same-root child case.

Any new state needs explicit initialization/retirement consistent with thread
and process reuse. Preserve legitimate audio interruption, timer-table slot
reuse and the documented loop-ESP normalization; strict equality with RET20's
ESP would change current convention-tolerance semantics and is not justified
by this result. Necessary census seals/initialization checks belong to a future
authorized repair task. No broad callback-family change or API unlock is needed.

## Evidence limits and recovery

The reproducer reuses only the accepted extraction fixture prefix from
`test/test-mm-timer-release-review.js`, which itself extracts production from
`test/test-mm-timer-ownership.js`. It executes real Wasm compiled by the vendored
compiler. No production body is replaced in the principal run. Identity guest
translation, synthetic thunk membership/metadata, host timing/events, resource
cleanup and branch/cache dispatch remain fixture stubs. RET executes directly
as the extracted instruction handler, without decoding guest bytes. This is not
a full module, browser, Windows, Worker scheduling, or game execution result.

Same-instance rebind and child changes are adversarial calls to real allocator
functions; this task does not prove a supported guest API can cause those
transitions during a callback. Authentic thunk lookup/creation, cross-thread
admission races, and host lifecycle scheduling are outside execution coverage.
The exact uncovered production boundaries are `mm_timer_thread_ensure`'s
`host_create_thread`, real thunk metadata resolution, and full run/decode and
loader/thread lifecycle integration. Wrong-family return rejection is tested;
arbitrary guest-forged thunk aliases are not qualified by the metadata stub.

Durable evidence is alongside this report: admission manifest/protected hashes,
command receipts, qualification/failing-safety/carry logs, and result/source
seals. Main-host copy:
`scratch/runs/20261022-timer-thread-lifetime-boundary/`.
Branch: `task/timer-thread-lifetime-boundary-oct22`; no main merge.
Recover from the published branch; no ignored Wasm or downloaded package is
needed. The sparse checkout uses a read-only local object alternate; remote
publication is the backup. Initial checkout projection was 2,004,271 bytes plus
16 MiB for new objects/evidence, below 64 MiB. Fresh admission was 8,178,659,328
bytes, above the required 2,982,150,144 bytes.

No workers, runtime/Boat calls, builds, packages, downloads, browser, deployment,
fleet or laptop changes. No assigned box or expiry. Coordinator's board records
`bx_pfv6b6wu` stopped at 01:29:31.724 UTC; this task did not query or change it.
Root WIP/index/config/TODOS/STATUS are protected; ownership returns to the
coordinator on publication. **STOP; repair is a separate assignment.**

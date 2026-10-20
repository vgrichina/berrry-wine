# Native COM owner boundaries — 2026-10-20

**BLOCKED / acceptance incomplete.** This branch preserves a deterministic
fixture and an actual full-VM attempt, not a passing native qualification.
Only this note and `test/test-com-native-owner-boundaries.js` are owned.
Production, existing tests, census metadata and main are unchanged.

## What the fixture adds

The existing integrated `test/test-com-token-real-boundaries.js` and its note
at `3a9adf5822cb387b56f011cd1df997e62715e6fa` compile the real helper/COM-wrapper
composition but do not execute x86. The earlier JS COM native receipt
(`scratch/runs/20261020-js-com-native-run/receipt.json`) executes public
lifetime callbacks and separate direct activation, but not native capacity
or stale-owner boundaries.

This fixture generates a small PE32 image with 63 distinct factories and
unrolled AddRef methods. Each AddRef calls the next factory's public
`CoRegisterClassObject` import, then its public `CoRevokeClassObject`.
Real `storage.js` invokes the exported COM wrappers and runs the x86 method.
There is no direct JS activation call, rewritten activation flag, modeled
token admission, synthetic completion, or production modification.

At 63 actual live children the forwarding observer:

- Requires 63 distinct BigInt tokens and exact public sync depth.
- Calls the real exported enter and requires capacity rejection.
- Rejects the retained outer token and a token differing only above bit 31
  through both exported check and leave; the current token remains valid.
- Checks actual x86 `this`, zero return sentinel, EAX, EIP, yield state and
  `ret 4` cleanup **before** storage restores the parent.

All 63 AddRefs and 63 Releases should complete, with per-method guest counters,
balanced public caller ESP, restored parent registers/control state and live
API thunk/decoded-IP evidence. A fresh sibling rejects the retired deepest
token. Two actual full-module instances share memory and initialize thread
slot 1 through public `init_thread`; replacement invalidates the older
instance's live child. A real `load_pe` publishes a new process epoch.
The final fixture tests epoch rejection with the replacement's own token,
checked live immediately before retirement.

Each rejected exported operation hashes **all 512 MiB of shared memory**
before and after and compares observed registers, EIP, decoded IP, thunk,
steps, handler/yield/SEH state, thread ID, sync depth and all twelve
`test_arena_get` fields of every instance. This includes spill pins and shared
serial/root/stack bytes. Private invocation globals and `spill_desk_forced`
are not exported; their independent byte-for-byte observation is **not**
claimed. Valid checks/unwinding provide additional behavioral controls.
Unchanged state is scoped to the exported rejection, not the entire public
registration attempt (storage allocates a cookie before acquiring its child).

## Actual attempt and blocker

Approved runtime: `bx_6czhvg6m`, Linux x64, Node `24.18.1`,
V8 `13.6.233.17-node.50`. Reused canonical module:

- Source: `ee139a0947c82e3a8eba4920508cb760d99882f5`.
- Module SHA-256:
  `5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21`.
- Module path:
  `/home/user/madbomber-native-fullvm/build/wine-assembly.wasm`.
- First fixture SHA-256:
  `19a2b7c075091280cac825a52bcfcc8f9dafc2cb1837741c14980c4d890fd470`.

Boat exec was an already documented permitted staging/execution mechanism.
No SSH/scp attempt, denied-access retry, public deployment, new worker or
rebuild occurred. All 6,438 manifest source identities and the module hash
matched before staging and again after the attempt. Remote free space was
over 47 GB. The 120-second process-group guard and 128-KiB log cap did not fire.

The first attempt ran **14:16:50.164–14:16:56.019 UTC**, exit **1**. Its
failure artifact contains 126 completed x86 callback rows, 126 public bridge
rows, maximum live depth 63 and 13 unchanged-state rejection records.
The final assertion incorrectly expected an unused `CALLBACK_OWNERSHIP`
property on the generated JS region map. That assertion was removed.
Review also tightened the epoch test: the initial attempt used an already
invalid token for its epoch check/leave calls, so those two observations
cannot independently establish epoch validation. Its epoch enter rejection
does not have that ambiguity. The final fixture also records entries before
completion so a deliberately overflowing run can retain its live x86 frames.

Before staging the corrected fixture, the local guard observed
**2,168,684,544 bytes available**, below the mandatory
**2,210,398,208-byte floor** (shortfall 41,713,664). It stopped before remote
staging or execution. There was no automatic retry after this blocker.
A later finalization-only check found 2,409,889,792 bytes available; that
recovery did not authorize resuming the stopped native work. Runtime was
released at 14:18:14 UTC and left running with its assigned 15:53:12 UTC TTL.

## Controls and remaining acceptance

Final fixture syntax and offline replay pass. Offline mode checks deterministic
PE bytes and ten independent oracle negatives: sentinel, `this`, ESP, EIP,
yield, EAX, memory hash, depth, arena/pins observation and register mutation.
These are **offline oracle checks**, not native negative-control executions.

Three native controls are runnable but **UNEXECUTED**:

- `--overflow`: genuine 64th public registration must trap at exported enter
  with unchanged state; the exception propagates, leaving 63 live children
  and an incomplete parent, with no fabricated unwind.
- `--bad-ret`: deepest guest AddRef executes `ret 8`; actual cleanup must fail
  the ABI oracle before parent restoration (expected process exit 1).
- `--state-corruption`: after a genuine capacity trap the observer deliberately
  changes EAX; the unchanged-state oracle must fail (expected exit 1).
  This is an oracle-sensitivity control, not a production mutation.

The corrected positive full-VM run and these three controls remain required.
No current-main qualification, private-global exhaustive observation, actual
spill pressure/reclamation, race, serial exhaustion, arbitrary abort/yield,
public activation, game or nonlocal-jump readiness is claimed.
The new test is deliberately not registered in existing tier/census files
because that was outside the two-file assignment.

## Recovery

Evidence: `scratch/runs/20261020-com-native-owner-boundaries/`.
`recovered/positive/{failure.json,terminal.json,output.log}` holds the real
failed attempt; `recovered/fixture.js` preserves its exact executed bytes.
`prepare-transport.json` / `postflight.json` pin source/module preservation.
`run.js` records original staging, bounded execution and recovery commands;
`v2/run.js` preserves the corrected staging recipe that the local floor guard
stopped. `receipt.json`, `SHA256SUMS.json` and `verify.js` summarize and verify
the retained evidence. Source/module recovery remains in the earlier
`20261020-js-com-native-run/recovered/canonical-build` evidence and its Git
source identities; no large ignored module was duplicated under this 6-MiB cap.

Offline, from any checkout:

```sh
node test/test-com-native-owner-boundaries.js
```

After a **new authorized assignment** with a valid runtime/disk preflight,
stage the final test by the permitted mechanism and use the pinned old tree:

```sh
node fixture.js --native \
  --runtime-root=/home/user/madbomber-native-fullvm \
  --wasm=/home/user/madbomber-native-fullvm/build/wine-assembly.wasm \
  --source=ee139a0947c82e3a8eba4920508cb760d99882f5 \
  --sha256=5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21 \
  --out=unique-result-directory
```

Use fresh output directories for the three control flags above. The old
runtime's TTL is not an enduring authorization. No main integration occurred.

# JS COM native execution — 2026-10-20

**PARTIAL qualification.** The unchanged positive fixture passed (exit 0);
the malformed outer AddRef `ret 8` fixture failed for the expected actual
stack-cleanup mismatch (exit 1). Public lifetime and nested JS callbacks
passed. Direct unmodified DLL/CreateInstance bridge coverage passed, but
**public activation through the JS carrier remains OPEN**.

## Identities and environment

- Fixture commit: `e67571c7075f0cf59bbc73b4f94e5c3c2dad7a02`.
- Production source: `ee139a0947c82e3a8eba4920508cb760d99882f5`.
- Existing canonical module SHA-256:
  `5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21`.
- Approved runtime: `bx_6czhvg6m`, Linux x64, Node `24.18.1`,
  V8 `13.6.233.17-node.50`.
- Module: `/home/user/madbomber-native-fullvm/build/wine-assembly.wasm`.
  Reused MadBomber's successful gated build and immutable dependencies;
  no rebuild, source changes, dependency installation or activation changes.
- Isolated overlay: `/home/user/js-com-native-run`; exact fixture files,
  with `lib` and `node_modules` links to the existing tree.

The observer and generated PE/x86 code were independently read before running.
The forwarding observer checks genuine BigInt callback tokens, arguments,
zero return sentinel, guest EAX and actual ESP before production restoration.
It also asserts restoration of GPRs, EIP, decoded IP, current thunk, steps,
handler state, yield state and SEH. These assertions passed in the positive
run; full register snapshots and numeric token values are not serialized.

Both commands used the fixture report's exact native arguments and pinned
module/source; `run-remote.js` imposed a 120-second guard on each fresh,
detached process group. Positive ran 13:09:37.301–13:09:37.724 UTC; negative
ran 13:09:41.262–13:09:41.445 UTC. Neither guard nor log cap fired.

## Observed x86 callbacks

Rows are in completion order. ESP includes the sentinel return-address
consumption: `ret 4` advances 8 bytes, `ret 12` advances 16, and `ret 16`
advances 20. Every recorded return sentinel was zero.

| Method | Depth | Argument words | ESP before → completed | EAX | Parent decoded IP / thunk |
| --- | ---: | --- | --- | --- | --- |
| nested AddRef `0x402500` | 2 | `0x403044` | `0x616fa0 → 0x616fa8` | `2` | `0x1a0000ac / 0x7500000` |
| nested Release `0x402600` | 2 | `0x403044` | `0x616fb0 → 0x616fb8` | `1` | `0x1a0000e4 / 0x7500008` |
| outer AddRef `0x402200` | 1 | `0x403040` | `0x616fc0 → 0x616fc8` | `2` | `0x1a000078 / 0x7500000` |
| nested AddRef `0x402500` | 1 | `0x403044` | `0x616f8c → 0x616f94` | `2` | `0x1a0000ac / 0x7500000` |
| nested Release `0x402600` | 1 | `0x403044` | `0x616f9c → 0x616fa4` | `1` | `0x1a0000e4 / 0x7500008` |
| outer Release `0x402300` | 1 | `0x403040` | `0x616fd0 → 0x616fd8` | `1` | `0x1a0001b0 / 0x7500008` |
| direct DllGetClassObject `0x602000` | 1 | `0x403020, 0x61700c, 0x61701c` | `0x616fe4 → 0x616ff4` | `0` | `0x1a000284 / 0x7500130` |
| direct CreateInstance `0x402400` | 1 | `0x403040, 0x12345678, 0x403030, 0x403088` | `0x616fe0 → 0x616ff4` | `0x80004005` | `0x1a000284 / 0x7500130` |

The last two rows are explicitly direct bridge evidence. Both reentered
against the same real suspended decoded loop and thunk. The IID_IClassFactory
content checks passed, and CreateInstance preserved E_FAIL despite writing
the nonzero output `0x55667788`.

Three public activation requests retained resolve-only flags and recorded
zero JS carrier callbacks. Guest owner-side activation results, lifetime
counters and public caller ESP checks passed. This does **not** establish
public DLL/CreateInstance JS-carrier coverage: the public handlers force
resolve-only. No flags were changed and no production caller was introduced.

## Expected malformed-ret rejection

The negative completed two genuine depth-2 nested callbacks, then rejected
outer AddRef's malformed `ret 8`:

```text
AssertionError: actual ret N cleanup before parent restore
actual:   6385612 (0x616fcc)
expected: 6385608 (0x616fc8)
```

The stack identifies `checkReturn` → observed `com_callback_leave` →
production `_invokeComCallback`. The observer throws before forwarding
`com_callback_leave`, and production restores the parent only after that
call. Thus this is actual executed cleanup rejection before restoration,
not a dependency failure or timeout. The failing outer row is not appended
to `runtimeEvidence.rows`; its actual/expected ESP is retained in the error,
while the two completed nested rows are serialized. This is an observer
conformance rejection, not a claim that production independently validates
`ret N`. No repair or rerun occurred.

## Evidence, preservation and recovery

Self-contained evidence: `scratch/runs/20261020-js-com-native-run/`.

- `positive/{native.json,terminal.json,output.log}` and
  `bad-ret/{failure.json,terminal.json,output.log}` contain actual results.
- `snapshot/` retains exact fixture/report bytes; `offline/` retains generated
  PE/method bytes and the independently replayed 28 oracle negatives.
- `recovered/canonical-build/` retains the actual module, successful original
  build log/exit, source manifest, engine identity and dependency receipt.
- `recovered/source/` retains the relevant production route/bridge sources.
- `recovered/{preflight.json,postflight.json,prior.json}` and remote hashes
  prove preservation; `recovery.json.gz` is the recovered evidence archive.
- `prepare*.js`, `execute.js`, `run-remote.js`, `postflight-remote.js`,
  `finalize.js`, `transport.js` preserve Boat exec/file recovery recipes.
  `verify.js` checks recovered hashes, callback evidence and source Git IDs.

All 6,438 source identities matched the exact production Git tree.
Before/after checks preserved 22,984 files across prior Army/ICM/callback/
MadBomber trees and dependency closure; module and fixture hashes matched.
Remote postflight free space was 48,162,623,488 bytes. Local evidence was
approximately 10 MiB, below the 20 MiB cap, with more than 2 GiB + 60 MiB free.
Both process groups were absent. Runtime released at 13:10:49 UTC, left
running with the assigned 15:53 UTC TTL.

Offline generated-image SHA-256 identities:

| Image | SHA-256 |
| --- | --- |
| positive EXE | `4843e6a75b6b24c03009ec17a21f6391ad2f5bd93cf67608d1585a656d76aaea` |
| DLL | `742d55797acfd910c30c04e73a5d2b1de12546d2362b4e87313585f633f25906` |
| malformed EXE | `90bf7d3c33be7e1455d4ccba02ccc48804331226b1a415484549353607f269c4` |

Public activation JS-route coverage, capacity, serial exhaustion, stale
epoch/thread/root, abort/yield, actual spill pressure/reclamation and instance
retirement remain unqualified. No game, browser, renderer, gameplay or whole
jump-system readiness claim. This report-only branch does not integrate main
or modify shared HEAD/index, other workers' files or laptop work.

# Recoil native Software gate integration, 2026-11-08

Run: `scratch/runs/20261108-recoil-gate-integrated/`.

The actual native `browser-position.cjs` now connects its Resume/M compound
command to the repaired explicit Software gate. This task stops on a tested
first new generic integration repair before allocation. No original, Chrome,
input or box ran; the gate remains **not original-validated**. No new M
consequence, movement or power-control progress is claimed.

## New defect and causal repair

The native driver's actual CDP event handler ignored execution-context
destruction and clearing. Replaying a parsed WASM event followed by destruction
of its context leaves the old record marked bytecode-available and eligible in
the Worker script registry. `context-before.log` records that reproduction
against the predecessor handler, without running a browser.

`tools/native-software-gate.cjs` supplies the driver's current page script/context
registry and uncached source-response transport. The integrated handler removes
retired Worker records, ignores late scripts from dead contexts, and registers
Worker runtime contexts before enabling their debugger. Late byte responses
cannot restore removed records. The adapter closes with sticky UNKNOWN when
an installed page or Worker context retires, including when equal numeric
context/script IDs and URLs reappear before an in-flight probe finishes.

`driver-context.test.cjs` exercises the **actual integrated native handler**:
destroyed and cleared Worker records disappear, late script events are refused,
and page JavaScript contexts disappear on retirement. Its first invocation had
an incorrect test import path; that failure is retained in
`context-after-initial.log`, alongside the corrected passing result.

## Actual driver wiring and unchanged contracts

The owned native driver uses this adapter's transport for source requests,
retaining complete response JSON, including malformed responses and transport
refusals, before returning anything to an attestor. Phase and source evidence
sinks fsync their records. Its `menuAction` invokes the Software gate through
`confirmLiving`; the existing compound's independent mouse/key releases and
Escape deadlines remain unchanged. Direct ordinary M commands are refused;
M proceeds through the qualified compound path. `softwareArm` installs the
passive observer once, allowing natural software copies before baseline probing.

Installation requires the separately produced clock/process proof matching
the current Node/Chrome PID/start identities, boot, namespace, owned listener
and profile. Original decoder/compositor pins are checked before installation:

| Role | UTF-8 bytes | SHA256 |
| --- | ---: | --- |
| Decoder | 204938 | `f468ffce84da0f517df009682c111bbcb955b67f8b5a122350abbe5abc49e1d8` |
| Compositor | 227919 | `cb21daaf7c0ce2b2cf80436c192bda4ed78930b1b07eaf21a20eb9adb7ce7b51` |

These derive from the exact original providers, cross-checked by the retained
original HTTP receipts; generated wrapper hashes are not substituted. The
explicit Software gate itself is unchanged: guest WASM plus actual decoder
and compositor JavaScript, six complete uncached responses per probe,
allSettled drain, current owners/contexts/epochs, final colocated owner/PNG,
250ms freshness including decode/save, changed timer pair, immutable maximum
5s transition, host/link/guest scopedRetiring fences through final save, and
sticky UNKNOWN/no replay. The hardware gate is unchanged.

## Startup closure and validation

The 854-pin successor manifest is retained byte-for-byte as the prefix of the
new manifest, preserving every inherited851 provider. The new manifest extends
to **886** entries:29 relocated physical startup helpers and three integration
or barrier/helper tools. This preserves the inherited29 helpers as well as
declaring all29 actual successor upload targets; it does not silently relabel
the inherited854 as the modified runtime. Exact providers/media were reread
and hashed, all29 successor helpers passed physical dependency/syntax checks,
and the actual gate and HUD decoder imported under the exact hermetic loader.

The actual provisioner joins every individual upload before publishing the
content-verified staging proof. The actual queue and custodian require the
same proof before request creation and atomic consumption respectively. The
remote custodian retains its startup/runtime lock. The launcher invokes the
accepted kernel ptrace supervisor with the remaining immutable runtime window
and timeout; it does not take the local heavy-runtime lock for remote work.
Kernel custody retains its documented CLONE_UNTRACED scope limit.

Validation passed:

- 13 new adapter rejection cases, including source refusal/sink failure,
  in-flight context replacement, allSettled drain and no replay; the successful
  mock-CDP path retains18 complete responses across three probes.
- Actual native-handler regression and the actual driver's Software compound
  connection checks.
- Actual provisioner/queue/parent staging controls: upload join before publish,
  absent proof, partial upload, complete queue, and mutation before consumption.
- Exact886-provider /29-physical-helper preflight and hermetic import.
- `flock /tmp/wine-build.lock bash tools/build.sh`.

The accepted19 lifecycle,46 gate,28 owner,41 actual HTTP and197 kernel-task
controls, plus reviewed-point/custodian controls, were independently reread and
hash-verified without rerunning or changing their fixtures. New source-response
tests use mock CDP; they do not constitute new actual browser responses.

Recovery records the checkout Git SHA, small owned new-file patches, all29
helper deltas, inherited source/media provider paths and hashes, and independent
artifact verification. No source/media archive, peer WIP, old-box operation,
deployment or subworker was used. No local runtime lock was needed or held.

New box ID/state/expiry/stop receipt: **N/A — none created**. No watchdog was
needed for these local non-runtime checks. Existing archived boxes were untouched.

Next work is the separately assigned single fresh original run after completing
its launch-specific lifecycle/watchdog setup and physical staging verification:
personally review CURRENT Resume, qualify the Software before/after transition,
review ordinary M's consequence, then bounded movement toward power control.
Loading, MENU and active time remain separate; health/time limits and independent
releases remain required. Full27, parity, audio and FPS remain open.

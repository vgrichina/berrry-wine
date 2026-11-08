# Darkstone helmet restore: native browser startup wait repaired

The first fresh launch failed before CDP connected: the actual driver read
`DevToolsActivePort` after its fixed ten-second polling loop, while Chrome was
still starting under kernel custody. Replaced that assumption with bounded
endpoint readiness and tested the actual old and repaired driver sections against
the same delayed child. No original was replayed. Native loadFiles, VFS, Load
preview, current game pixels, onward gameplay and incremental save remain open.

Evidence: `scratch/runs/20261108-darkstone-helmet-native/` (R).
Predecessor: [integrated custody](darkstone-custody-ready-20261108.md),
`0696e8112`. Checkout at preparation: `2419615b470742297e85c0855821ff6745f45116`.

## Actual launch and first defect

Both selected source files from Level One's `new-save-recovery.json`, and both
staged copies, were verified before allocation and again after shutdown:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,204 | `70fcfbe302a9ff1f1b7452223e67e800371086812d679ba04c03d4adffca036a` |
| `game641d_6af08808.sav` | 3,204,341 | `a4ecb215f5ffab7524cc0524c419c46498eb7ef14a0e3f404c880f72a769f45d` |

The actual `provision.bytes` manifest was derived before allocation: 1,238 bytes,
SHA-256 `1eae58509019b8551f46fdbd5a54da5c3a28d29c811df349645c08b5be5a8946`.
Both the local production HTTP handler and the fresh remote runtime returned
those exact bytes. Remote `served.jsonl` records status 200 at 15:45:31.670 UTC.
This was the driver's manifest verification fetch, before page navigation;
it does **not** establish production loadFiles or VFS restoration.

All 547 actual selected providers passed cheap preflight and remote verification.
The unchanged shared content receipt was published after joined uploads, required
before queue creation, and required again by the parent before consumption.
The five-input bootstrap, kernel supervisor and custodian remote lock preceded
provisioning. Original source `90c1fcfee91c4680877083e80498afcb73c9384d` and ignored
module `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`
were preserved; shared peer WIP was excluded by exact provider fallback.

The browser driver began at **15:45:31.257**, then failed at **15:45:42.298** with
`ENOENT` reading `chrome-profile/DevToolsActivePort`, line 77. The initial driver
and failure are retained in `initial-harness.patch` and recovered runtime output.
The kernel trace records Chrome startup progressing beyond this wait. No CDP
endpoint was recorded, no page navigation followed, and the command directory
stayed empty. No game input, screenshot, target interaction or native save is
claimed. The inherited 9+0, LIFE19/35, MANA25, Gold1532, Food49, AC12 helmet/red-vial
baseline was not re-observed.

## Focused repair and validation

[`tools/native-browser-endpoint.cjs`](../../tools/native-browser-endpoint.cjs)
waits for a complete valid port/browser-path pair, checks child exit, and reports
an explicit readiness timeout. Its default two-minute startup allowance is capped
by the existing immutable browser deadline; it cannot extend that deadline.
The run-local actual `browser.cjs` calls this helper. `prepare.py` now includes
the helper in future provider generation. The failed launch's 547-provider plan
remains frozen; `runtime-pins-repaired-plan.json` extends it to 548 providers and
passes the unchanged exact-call/physical closure gate, with 42 required helpers.
The repaired plan was not uploaded or launched.

Four focused tests pass: late/partial publication without child restart, early
child exit, malformed endpoint bounded by caller deadline, and expired-deadline
refusal. `test-actual-startup-wait.cjs` executes the actual predecessor startup
section: it fails after 10.030 seconds while its child remains alive. The actual
repaired driver section then succeeds on that **same child**, whose endpoint
arrives after 11.540 seconds total. This is a delayed endpoint fixture, not an
additional Chrome/game launch. `actual-startup-wait-regression.json` retains it.
Final focused tests, helper syntax and locked full build pass. Seven accepted
controls, hover, kernel evidence and eleven barrier tests were hash-checked and
reused without rerunning unchanged fixtures.

## Failure retirement and normal box stop

The driver's ordinary terminal cleanup did not finish descendant drain. Exact
registered runtime identities received TERM, with KILL escalation for the Node
controller. The first drain failure is retained. The trace then exposed a second
condition: autoattached Chrome thread **6624**, TGID **6483**, remained at an exit
stop while its registration still awaited lineage. Its leader and descendants
therefore could not fully reap. No supervisor/reaper change or further defect
repair was attempted under this task's one-defect scope.

The exact owned outer supervisor received TERM; its existing EXITKILL policy
retired the tracees. This was **failure retirement**, not a successful normal
kernel drain. Independent observations subsequently verified all **74 recorded
PID/start identities** absent, including supervisor and 73 kernel tasks. The
runtime port was closed, profile/writer absent, no Chrome/crashpad/Node live,
remote lock free and no other process FD referenced the run. No inputs were sent.
The 547 staged providers remained unchanged. Ptrace lineage scope is unchanged:
no adversarial CLONE_UNTRACED syscall audit or earlier-history reconstruction is
claimed; unsupported nonleader exec remains outside the accepted scope.

All **29 remote references / 26,955,252 bytes** were uniquely retrieved and
independently reread/hash-verified before requesting delegated normal API stop.
The observable independent watchdog was armed before allocation. Immutable
deadlines were browser **16:07:22.069**, independent stop **16:09:22.069**, initial
expiry **16:10:22.303 UTC**. Local normal/watchdog roles exited zero, their
supervisor has no children, and all three exact identities are absent. No local
heavy runtime or local runtime lock was used.

Fresh box **bx_qrycbp4p** is **archived**, final expiry **null**. Normal API stop
**stop_6b521006bd998781** completed **15:50:29.421 UTC**, forced false, error null;
`stop-receipt.json` independently confirms it. No resume, deletion, deployment,
private guest write, clock/config/seed change, second original or subworker occurred.

Recovery uses exact Git SHA, relevant binary diff, small owned patches, initial
driver patch, provider recovery mapping and existing media path/hash references;
no source archive or repeated media bundle. Next: address the retained parked
exit-stop drain condition before another original, then regenerate the full
repaired plan and perform native helmet restore/current pixels, reviewed passage
beyond the second opening, and early incremental NewSave recovery. Full27,
parity, audio and FPS remain open. Single-task worker stops after publication.

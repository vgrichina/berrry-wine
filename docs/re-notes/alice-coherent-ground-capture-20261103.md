# Alice coherent ground capture: first host observer error, 2026-11-03

**The ground observer remains unqualified (`usableForFooting=false`).** This
attempt stopped during original startup after a host receipt-reader error.
There is no authentic Player/ground sample, supported/airborne comparison,
plank footing, thermal crossing, knife ownership or target-effect claim.
New Game and Easy were never selected; the natural story opening did not begin.
No engine failure or native control RPC failure was observed.

The input was exact committed main
`88374ba3bbf43d298a420847d188941ca55b8290`. Ignored evidence and executable
reproduction are in `scratch/runs/20261103-alice-coherent-ground-capture/`.
Only this note is committed. No production code, game asset/configuration,
guest memory, saved game or map was changed. No other worker, browser or
predecessor boat was used.

## Exact first failure and stopping behavior

At **15:19:51.602 UTC**, read command `cmd_pq204znuj27x` ran the pending branch
of task-local `get-local.py` for `startup_more`. The second startup step was
still in flight. Its final receipt did not yet exist, so the reader attempted:

```python
(r / (label + '-request.log')).read_text()[-1200:]
```

That log is written by `commands-local.py` **after** the request completes.
The read raised `FileNotFoundError`. This was my host observation-helper
mistake, not a rejected native input or a game/decoder failure. Under the
assignment's first-observer-error rule, I stopped without repairing the reader
and continuing the attempt. No further execution credits or gameplay inputs
were submitted, and no restart/retry occurred.

The already-submitted 800-credit step ran **15:19:23.889889–15:20:07.480303**,
finishing at batch **1200**. Its pre-submitted command sequence then retained
a read-only snapshot and PNG. Those later captures do not describe the exact
instant of the earlier reader failure. The original supervisor received its
ordinary-stop marker at **15:20:21.506642** and the guest exited **0** at
**15:20:21.597739**, after **128.375903 seconds**. All native control replies,
including quit, succeeded.

The complete ledger has **8 commands**, numbered 1–8 without gaps: initial
snapshot, step400, snapshot/PNG, step800, snapshot/PNG, quit. There were zero
keydown, keyup, mouse or eval requests; therefore there were no held keys to
release. No breakpoint was armed. Native movement tracing recorded zero hits;
this is absence of movement evidence, not proof of movement-loop failure.

Both retained images were personally inspected. `startup.png` at400 is a gray
canvas. `menu.png` at1200 shows the **EA Games startup logo**; its filename is
an inherited helper label, not a claim that a menu was reached. Neither image
shows a player or support surface.

Host-only executable reproduction, with no boat, guest or RPC:

```sh
python3 scratch/runs/20261103-alice-coherent-ground-capture/reproduce-first-error.py
```

It reproduces the missing completion-log read while a pending receipt exists.
`reproduction.json`, `first-observer-error.json`, the unchanged reader and
writer helpers, and the actual pending/completed receipts retain the basis.

## Prepared capture and remaining qualification boundary

The accepted [engine selector](alice-engine-selection-20261103.md) and
[ground decoder](alice-ground-observer-20261103.md) were reused unchanged,
including their accepted 24/17 offline-test proofs. Their synthetic fixtures
were not used as runtime evidence. This task did not rerun or reinterpret
those fixtures, change the selector, relax decoder checks or promote its output.

Task-local `capture-readonly.cjs` prepares a synchronous existing CLI
`action:eval` observation. Its proposed phase anchor is original engine
`00452f63`, immediately after `call [storedAPI+24]` at `00452f60`. It requires
the actual EIP, breakpoint halt reason5, first caller inside original movement
callback `10097a30..10097acf`, preferred measured module bases, and the native
stack's record argument matching the derived local client. It gathers the
channel/qport, engine roots/count/selected record, stored API/callback,
record/Player/state/contact, PE headers and accepted engine/DLL code windows
in one synchronous read. Runtime PID, startup UUID, clock/monotonic time,
registers and before/after execution anchors are included. Debugger arming
would be separate from that read; no guest-call or guest-write facility is
used by the capture function.

**This helper was prepared and syntax-checked, but never invoked against the
guest.** Its native phase/identity assumptions have not been demonstrated by
execution. No runtime capture digest, module-base comparison, local index,
origin/yaw/contact value, allocation-continuity proof or neutral/airborne
comparison exists from this attempt. One observation could only establish
structural consistency; reused addresses and identical backlinks would not
prove an allocation generation. The helper and accepted decoder retain false
footing authority. Preparing an expression is not qualification.

The next prerequisite is to repair and test asynchronous pending-receipt
observation before a separately authorized original run. Then the proposed
native return-boundary capture itself must be proven, with authentic neutral
supported and ordinary unsupported comparisons, before using it for plank
footing. There is no supported onward navigation decision from these images.

## Staging, checks and custody

One fresh finite-TTL boat, **`bx_n87rcq58`**, was created with original expiry
**2026-11-03T16:42:35.643Z**. ID, expiry and delegated shutdown owner
`alice-coherent-ground-capture` were recorded before first use. The stopped
predecessor `bx_9vpsvd62` was never operated. Disk checks remained above2GB.

The source streamed directly from exact Git blobs, excluding foreign WIP.
All **5850** sealed build inputs passed hashes before and after the build.
Original15 files and exact14 manifest mappings were preserved. The inherited
17-file binary/support set and the pinned native-input Minesweeper fixture
were verified. Original engine SHA256 is
`61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72`;
DLL SHA256 is
`42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c`.

The boat-side `flock /tmp/wine-build.lock bash tools/build.sh` passed.
`test-keyboard-message-lparam`, `test-control-stdin-frozen-cli` and
`test-cli-di-mouse-control` passed, with **no focused-test skips**. The build
reports its existing limits explicitly: API append-only comparison has no Git
HEAD in the streamed tree (index check only), and Big5 uses its offline
header/invariant check because upstream source caches are absent.

A fresh committed-source AST dependency closure found119 files,243 edges and
three reviewed dynamic requires. The final no-guest preflight passed strict
imports and the intended absent-EXE CLI boundary; it executed no guest/Wasm.
All **237** final source/helper/module/input pins passed again before launch
and after shutdown. Before launch, helper staging was corrected for an omitted
inherited-pin manifest and a self-referential hash manifest. Both initial
failures and the corrected final seals are retained; they were not native RPC
errors. The manifest excludes its own final bytes; every payload remains pinned.

Actual compiled **and instantiated** Wasm: **2088037 bytes**, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
Original supervisor/game PIDs were **10172/10173**, session
`4073022e-ad48-4125-807a-4a3ff0e79cbf`. The ready log and PID-owned LISTEN8123
were verified before the first RPC. `/proc` start ticks, parent, command line
and boot ID independently anchor process identity. Start was
**15:18:13.221834 UTC**; immutable guest/outer deadlines were
**15:48:13.221834/15:49:13.221834 UTC**, with400 commands and ordinary100000
host budget from startup. These limits never changed.

The full recovery archive is **86822955 bytes**, SHA256
`527306bb65b6128037776ab6294874c7c65dc42b57764348d96ce6973c283ed9`.
All **284 payloads** passed local full-SHA verification before boat cleanup,
including final runtime sources/inputs, locked build/test logs, source seal,
commands, captures, module identity and original exit receipts. The run's
`RECOVERY.md`, `archive-verification.json` and `SHA256SUMS` retain recovery and
honest limits. Scoped process/port checks found the original supervisor, guest
and request helpers absent, with8123 closed, before delegated normal stop.

Normal stop **`stop_1841d7793fedf77f`** completed **15:22:50.555 UTC**, with
`error:null`, `forced:false`. The final explicit boat query confirms
**STOPPED**, a completed available snapshot and a verification timestamp.
Original expiry remains recorded above; the stopped API clears `archiveAfter`.
An initial read-only stop-status query omitted the required box argument and
returned a CLI usage error; its output is retained separately from the
successful explicit-ID status query. No second stop mutation or force was used.
Custody is returned to the coordinator. This single-task worker is finished
and must not be reused for the next attempt.

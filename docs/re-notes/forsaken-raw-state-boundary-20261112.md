# Forsaken raw-state observer startup blocker, 2026-11-12

The requested original first-white boundary remains unresolved. The new
observation-only helper passed focused local regressions, but its first worker
injection in the actual original browser run timed out before readiness or any
game capture. `Runtime.evaluate` had an unknown outcome; it was not replayed.
No original execute-store/enqueue/replay/describe witness was obtained, no
runtime defect was proved, and no runtime repair was made. Stop at this concrete
startup-observer blocker; do not infer a blend, clear or texture fix.

Read the [previous original first-white result](forsaken-final-pinned-first-white-20261112.md)
at `a04a489fc` for the retained GPU21645 white transition and subsequent
additive GPU21660 despite CPU opaque restores. That evidence and its limits
are unchanged. Prior root review remains pending; this task adds no acceptance
or broad compatibility claim.

## Scope and tested observation

Evidence is in these two local runs:

- `scratch/runs/20261112-forsaken-raw-state-boundary-1625/`
- `scratch/runs/20261112-forsaken-raw-state-boundary-1625-attempt2/`

Only run-local helpers and this note changed. Git remains the source archive:
each run records its exact main SHA, relevant tracked/untracked binary patches
and owned-helper patches as lossless gzip, with raw hashes in
`patch-recovery.json`. The second source base is
`42b48e0814b0e7221c6bb75866e9ffae81bbccfd`. Existing original media paths and
SHA-256 values were checked without source-tree or media archives.

The helper observes changed-state pre-store hooks and raw memory at the next
natural import boundary, live state at encoder entry, owned packet bytes after
copy and before publication, source packets at replay, replay workspace, and
raw state before/after description. A next-boundary read is an interval witness,
not an immediate hook after the store. It records device/state addresses, raw
RS1/7/14/15/19/20/21/27, a full render-state-region FNV checksum, buffer/offset,
sequence and ordinal. The checksum is auxiliary, not a cryptographic proof or
a substitute for retained raw fields. Original methods retain arguments, return
values and error identity. CPU post-store and replay address reads use the
existing pure JS translator. The enqueue observer additionally queries the
encoder's existing `guestToWasm` translator, which can call its pure translation
export. It invokes no guest setter or application API.

Focused tests passed before the second allocation:

- The real built-module x86 Device2/3 fixture emitted 1,701 CPU rows with zero
  drops; all 22 observed next-boundary state readbacks matched requested values,
  and its independent rendered-pixel oracle passed.
- The production encoder preserved exact command messages and packet bytes
  across opaque/additive/opaque snapshots followed by live-state mutation.
  Adapter return and original error identity, high guest pointers, packed sparse
  translation, and avoiding a duplicate guest bootstrap library load passed.
  The adapter tests reject additional Wasm export calls; this assertion does
  not cover the encoder's additional pure translation query.
- The changed browser capture/drain functions passed the combined real-emitted
  trace/offline-CDP control: 21-second drain, ACK before drain, serialized next
  publication, known drop and terminal unknown without replay. The second
  browser file is identical to that tested file. This is a control test, not an
  original browser worker-bootstrap test.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed. Both modules retained
  the prior hashes: normal
  `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`,
  compat `29722b7f115faa0807b8a8543ab4ed221e9c820d699a7d6e10a025aa29487ed4`.

Each attempt froze all remote helper/data pins and passed the actual local
`Transport.provision` whole-input seam, a stale-final-pin rejection, syntax and
transitive import preflight before allocation. Lifecycle rechecked current bytes
immediately before creating the box. Provisioning verified all 1,560 remote
paths including final pin/deadline metadata; remote import preflight passed
before the second Chrome launch. No RAM gate was used; sampled actual `/home`
free space remained above 1.5 GB.

The original CPU/GPU caps, 24 MiB drain payload bound and 32 MiB compressed
retention bound remain; the new observer has a separate 32,768-row cap and
explicit drop/error counts. No actual original diagnostic drain completed, so
there is no original zero-drop or state-preservation result from this task.

## Actual blocker and shutdown

The first attempt was stopped before Chrome after noticing that the observer
checked the guest pointer against the translated direct-window bound. The
regression had not covered the previous original's high device pointer
`0x08222048`. Its one unique remote output was independently downloaded twice
and hash-verified before normal stop. The final helper instead uses the existing
JS direct/DIB/sparse translator and tests the high-pointer case.

The second browser navigated to the original threaded WebGL route at
`2026-11-12T16:34:50.797Z`. Its HTTP build checks passed and the recovered page
module matches the normal hash above. That does not establish guest/renderer
instantiation or an actual WebGL owner. Ordinary blank-page native preflight
passed before navigation; no game input command was published.

In `recovered/webgl/protocol-timing.jsonl`, worker session
`571C6A8AA104ED87EC20D66441D1C832` completed `Debugger.enable` and
`Runtime.enable` at 16:34:51.698–.699Z. The new boundary script is the next
evaluation in the frozen attach handler, before the old observer and
`Runtime.runIfWaitingForDebugger`. At 16:35:11.705Z,
`worker-errors.jsonl` records `CDP UNKNOWN Runtime.evaluate; no replay`;
`first-browser-failure.json` records the terminal failure at 16:35:11.903Z.
There is no successful resume/readiness, startup PNG or raw diagnostic drain.
The exact internal reason for the evaluation timeout is unproved. Loading a
library or touching worker startup globals before resume is a hypothesis, not
a demonstrated runtime defect; the retained target URL is insufficient to
establish a renderer-specific cause.

The browser's existing terminal-failure path closed Chrome (its failure branch
uses SIGTERM). No game normal-quit or successful `Browser.close` command was
observed. Chrome's actual parent wait is code 0 with both EOFs. The browser runner's actual parent wait is status
1 for the observer failure, with both EOFs. A later owning-PID semantic-stop
command failed before sending a signal because `/proc/7910/cmdline` no longer
existed; `semantic-stop-outcome-readonly.json` retains the known exit-1 cause.
That command made API custody terminal, so no later runtime commands were sent.

All 26 unique remote outputs were downloaded twice independently and rehashed,
including the module and actual parent/EOF records. An outer API-command status
GET attempted after archival returned HTTP409; its final status/EOF is therefore
unobserved and is not inferred from the nested parent wait. No box was resumed
to fill that gap. Local lifecycle client, adopted owner and independent watchdog
all have actual zero waits and EOF evidence.

Both independent two-hour watchdogs were observed alive before allocation.
Delegated normal stop followed unique recovery, with these final states:

| Box | Initial expiry UTC | Final state / expiry | Normal stop |
| --- | --- | --- | --- |
| `bx_kmv8ha2n` | 18:26:47.802 | archived / null | `stop_4755503a04689102`, completed 16:30:15.420Z |
| `bx_3czfgkvx` | 18:31:55.842 | archived / null | `stop_bab4a866501599b2`, completed 16:36:32.224Z |

Both receipts have forced=false and error=null. Do not resume or delete either
box. Large closed local logs/traces are losslessly compressed with raw hash
recovery records; runtime input pins remain intact.

Next work must first prove the actual paused-worker injection/resume seam using
the final observer, without an unknown command or replay, before allocating for
another original menu/combat trace. Only then can these raw state witnesses
locate or exclude a first divergent boundary. No blend/clear/texture workaround,
guest change, workers, public deployment, source/media archive, full-27, parity,
FPS, audio, enemy-defeat or level-completion claim was made.

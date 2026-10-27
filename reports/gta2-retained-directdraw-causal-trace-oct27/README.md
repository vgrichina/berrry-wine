# GTA2 retained DirectDraw causal trace: stopped before runtime

Status: **BLOCKED_LOCAL_ESTIMATE_RSS**. The first attempted staging estimate hit
its 128 MiB aggregate physical RSS guard. The supervisor observed 134,397,952
bytes against 134,217,728 bytes (180,224 bytes over), terminated the owned tree,
and verified cleanup. Exit -15 and the original failing operation are preserved.
This attempt was not replayed and no resource limit was raised.

There were **zero guest invocations, zero compiler invocations and zero Boat API
requests** in this task. No causal HRESULT, actual loaded DLL base, API return,
input bytes or Vid_SetMode final EAX was captured. No fullscreen repair or
playability claim is made. Emulator, runner, game files and main are unchanged.
The displayed historical 2 remains a requested mode ID, not an HRESULT.

## Exact boundary and useful retained work

The report-only sparse checkout is based on production source
`1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`, read through immutable donor Git
objects. The canonical runner matched its actual pinned Git blob. The existing
runner resolves COM ordinal API names before filtering, reads zero-based argument
memory at entry, and installs its API exit hook. Relevant exact API table entries
and source excerpts are retained, including untyped metadata; these static checks
are not proof of guest trace output or raw-return completeness at runtime.

The exact actual invocation route was to use `--app=gta2_demo` and its registered
requiredFiles closure, with no additional filename-bearing mount argv. The
canonical parser check passed under supervised local Node v24.18.1 before the
sparse checkout. Remote executable resolution/startup and staged filename
availability were never reached and are explicitly unverified.

The estimate recipe enumerates 3,726 pinned source files, 71 registered game
files, the retained required font closure and both retained compiled modules.
It reads source blobs through bounded Git cat-file and groups at most 40 files
per gzip archive without materializing a full local source tree. Both compiled
module hashes were verified and no new binary copy was made. The estimate was
terminated while measuring archive groups; no complete plan or throughput receipt
exists. Therefore no staging feasibility, aggregate capture arithmetic or launch
readiness is claimed. Source/game/module byte counts are supplied input pins,
not newly transferred bytes.

The retained `prepare.py` is the exact failed diagnostic preparation recipe.
Do not execute it or the controller without a fresh assignment and new owned paths.
Its BytesIO gzip estimation holds archive data while Git and two Python wrapper
processes contribute to the same physical bound. The observed aggregate cap is
binding; reducing estimator/wrapper memory is a possible next prerequisite, not a
fix tested here. A larger Git-only DATA ceiling is not a Python/Node RSS budget.
All historical predecessor attempts, manifests and spent controls remain intact.

## Handback

Assigned Boat `bx_cqss3x42` was untouched: no remote staging, Node startup, guest,
control request or lifecycle mutation. No owned remote PID or pending API/control
request exists. The supplied coordinator preflight is the last observation; this
worker did not requery state. Leave the allocated box running for coordinator
handback and shutdown. Cutoff 14:08 UTC, handback 14:12, coordinator snapshot-stop
14:15, expiry 2026-10-27T14:27:50.265Z remain unchanged. Coordinator may stop early.

Only this report and evidence are published on
`task/gta2-retained-directdraw-causal-trace-oct27`; no main integration or public
deployment. The canonical manifest binds input receipts, failed estimate,
production metadata, cleanup, recipe, and publication-receipt location. Exact
commit and remote-ref verification live in the owned ops publication receipt and
append-only root messageboard after pushing. No ignored binaries are committed.

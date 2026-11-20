# Main host callback lifetime repair, 2026-11-20

Evidence: `scratch/runs/20261120-main-callback-lifetime-hex-context-finish/`.
All six original producer files were committed and clean. Their exact reviewed
baselines were recovered in memory from Git blobs plus retained patches and
SHA-256 verified; `baselines.json` records recovery inputs and the six reviewed
versus current diffs. No census dump or inventory weakening was used.

The host and render-worker differences removed substantive cleanup protections.
Throwing subscribers could suppress sibling retirement, stop callbacks could
reenter before the shutdown promise existed, and CPU exit could certify writer
quiescence before the renderer joined. Startup and bootstrap rejection metadata
could also throw before cleanup. Existing production-class controls reproduced
host cleanup failure and render recursive shutdown on the committed sources.

Restore the reviewed cleanup implementations in these two files: cache promises
before external callbacks, fence admission, collect independent failures, retain
failed owners for explicit retry, notify subscribers once, and join both physical
writers before certifying quiescence. Preserve loader retirement receipts and
arbitrary startup rejection causes. These changes restore the reviewed hashes;
they introduce no new guest callback admission.

The other four deltas require no behavioral changes. DLL loader and guest-worker
lose optional timer diagnostics only. NE bridge removes unreachable duplicate
inspection after native FT delegation; definite missing LS32 companions settle
absent only through the native validated request. Async source preflight retains
owner/token checks after I/O and unwinds temporary scopes before awaiting.
NE lifecycle loses an unused scoped copy-only data inspection method; live
notification, invocation restoration, cancellation and failed-WEP retention are
unchanged. The anchored feature review records these bounded conclusions.

Focused lifecycle controls pass: WorkerLink 25, host fanout 15, main startup 29,
thread bootstrap 51, render manager 32, and existing render lifecycle controls.
Actual compiled DLL reader interleavings, production Worker nested DLL unload,
Worker NE success/parked/error/cancellation, and PE/NE lifecycle controls pass.
Static LS32/FT fixture checks pass but do not qualify native FT execution.
Broader callback ownership remains pending; nonlocal APIs remain disabled.

The full guarded build passed after root regenerated its owned local region
mirror; held WAT and region-map files were never changed by this author. The
host/render review is self-contained against the tracked inventory: those two
rows were moved out of the inherited untracked coordinator metadata, preserving
its remaining NE/WAT rows exactly. A read-only prospective committed-tree census
also passes with all foreign WIP replaced in memory by HEAD, without any
untracked overlays. The separate four local review reversions remain WIP with
their inherited metadata dependencies; foreign timer metadata stays untouched.

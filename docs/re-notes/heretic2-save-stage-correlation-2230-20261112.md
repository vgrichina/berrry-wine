# Heretic II: exact save closure and composed observer repair

2026-11-12. Evidence: `scratch/runs/20261112-heretic2-save-stage-correlation-2230/`.
**The actual save closure is repaired: one fresh original mounted all four
exact saves, executed ordinary `load crate0400` once, and called ExitProcess(8).
Its cause remains UNKNOWN.** The ordinary-name decoder repair restores named
import correlation, but the original exposes additional classifier/recorder
blockers. This run did not meet every requested observation restriction.

The [2205 parent](heretic2-observed-original-load-2205-20261112.md) stopped
before console load because its preparation filter omitted all four save
sources. Its archived box and terminal command chain were left untouched.
This worker executed that **actual parent prepare.py**, recording its hash,
under the new run path. `old-builder-pins.json` preserves its emitted closure:
all four required sources are absent. The new `stage.py` filters unrelated run
artifacts, then explicitly retains exactly the original four source paths,
sizes, SHA-256 values, mount URLs and guest VFS names. It also retains the
frozen run helpers and existing regular inside-root Git renderer provider.

Validation applies to the emitted runtime/upload manifest used by provisioning,
not a separate proposed list. The actual unchanged `provision_chunked_files`
hashes every candidate source before reaching deliberate cancellation with
zero remote effects. Missing-one, wrong-SHA, duplicate-provider, wrong-VFS,
duplicate-VFS, wrong-URL and outside-root mutations fail before allocation.
Wrong-SHA, duplicate and outside-root cases also fail in the actual provider.
The existing staged-import check passes against the final emitted pin/provider
bytes. Allocation and provisioning both require exact save closure; allocation
and original launch also check actual local free disk.

The [2140 observer](heretic2-park-completion-2140-20261112.md) alone did not
exercise the failing browser ordinary-name path: its real-dispatcher fixture
used an ordinal thunk. Native Chromium rejects `TextDecoder.decode` on a view
backed by SharedArrayBuffer. Ordinal markers bypass that decode. Copying only
the API-name view with `.slice()` fixes this run-local observation seam.
This reads names, not save payloads; no runtime or guest patch is involved.

`test-composed.cjs` evaluates the parent API installer, park installer and full
Git owning-Worker startup in their actual order, then runs the frozen dispatcher
and real lazy VFS against four synthetic bytes. Old named entry fails while
the ordinal control passes. Fixed named park/retry retains the same call with
a new attempt and retryOf, and distinguishes internal park from completed
handler frame. Cancellation-status and identical thrown-object cases pass;
sink failure preserves runtime outcome and import count. A browser-compatible
decoder adapter is explicit in that Node fixture.

`test-browser-composed.cjs` additionally runs the actual browser Worker startup,
native Chromium TextDecoder and same synthetic runtime module. Its synthetic
filesystem import returns 997 then 0; this separate test is not a real-provider
or original-game result. It reproduces old named correlation failure and fixed
park/retry success without the Node decoder adapter. Chromium exits 0 with
both EOFs. The inherited forwarding/missing-state tests run through the composed
API installer too. Its wrappers now forward the exact receiver and argument
list with Reflect.apply; return/throw identity and once-only underlying calls
pass. Missing state remains UNKNOWN.

Persisted park trace is bounded to 12,000 selected non-GL/filesystem records.
Seen, selected, emitted, suppressed, dropped and sink-error counters are explicit;
per-observer errors and ring eviction are captured separately. No handler hook
is labeled guest return. Optional caller-continuation proof remains separate.
The 54 historical observations and historical Exit8 cause remain UNKNOWN.
This cap does **not** bound the inherited legacy API console sink, discussed
below; the complete original trace cannot be called wholly bounded/non-GL.

The locked build passes and still emits original module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Runtime baseline is `8a834a3dc7affc8c6e53245beab56e87a32b81e8`; renderer provider
is `4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`.
Unchanged identity, capture, freshness, input-release and lifecycle proofs are
reused by SHA; no setup matrix is repeated. Git commit/diff and owned-helper
patches provide recovery; save media remain existing path/hash references.
No source archive, guest RE, extraction, substitute DLL, added GL/GetLastError
query, cache/reserve change, child worker or public deployment was performed.

The initial actual disk check was below 1,500,000,000 bytes, with zero remote
effects during the local hold. A separate worker's completed cold-file recovery
then provided actual headroom. This task did not alter that recovery or any
cache/reserve file. Allocation, original launch and admitted native actions
passed direct actual-free-space checks. No continuous-floor claim is made.

A fresh private two-hour independent watchdog was observed alive before
creating **bx_3q43nb98** at **22:12:24Z**, initial expiry
**2026-11-13T00:12:24.457Z**. Chunked provisioning joined **0 with both EOFs**;
all **2,459** remote file hashes, the final manifest and staged imports passed
before original launch. The full CPU/owning-WebGL identities retain module04.
Eleven complete PNGs were reviewed, including native Main → Game → Easy, upright
docks HUD100, whole-four mount/readback, blank console, exactly the authorized
typed command, its ordinary loading messages, and console-close settling.
The mounted source files' sizes/hashes exactly match the expected manifest.
Save source files were not modified. No other console command was entered.

After Enter once, the native console showed Loading game/player, Server
restarted and Map demodocks. The black world initially showed Paused. The
single console-close input eventually produced a black world without that
banner, so no NumLock/pause toggle or movement was justified or sent.
At **22:20:32.797Z**, the page logged native **ExitProcess(8)**; the owning
worker's API entry and host-exit tail independently record argument 8.
The next read-only capture at **22:20:46.819Z** rejected an absent registered
app. It was not replayed. No loaded living world is established.

The newly retained park stream contains **1,595 named ReadFile entries and
1,595 correlated filesystem imports**: **537 status997** and **1,058 status0**.
The status0 observations qualify as completed handler frames; all still label
guestReturn UNKNOWN. No actual caller-continuation boundary was attached.
Every retained status997 observation has yield12/flag1 and the same stack
frame, but its entry EIP differs from the post-handler reentry-thunk EIP.
The frozen classifier requires equal EIP, so all 537 remain **UNKNOWN**, and
their retries receive new call identities. The synthetic tests entered a
thunk directly; they did not qualify this actual caller-to-thunk transition.
`observer-boundary-blockers.json` preserves examples without weakening the
matcher or retroactively relabeling these observations as classified parks.

The park cap was already exhausted before load execution. At the last valid
capture it reported **12,000 emitted / 6,619 dropped**, zero sink errors and
zero observer errors; final counters are UNKNOWN because disposal stalled.
The legacy API sink persisted **27,176 rows**, despite its in-memory ring cap,
and retained a 512-call exit tail containing GL calls. Its last recorded
ReadFile attempt has EAX0/transferred0, followed by EAX1/transferred2064,
CloseHandle success, native GetLastError returning 0, and ExitProcess(8).
The missing actual yield/correlation records at that time prevent interpreting
the first EAX0 as a terminal failure or assigning a new concrete exit cause.
The legacy event label `return` is a post-handler observation, not proof that
the guest returned to its caller. No production defect or patch follows.

**I missed the inherited WriteFile text decoder before freezing.** It retained
decoded text from writes to `C:/user/save/current/server.ssv` (2,752 requested
bytes, 30 retained characters) and two other current-save writes (empty text).
Only path/length metadata was examined afterward; payload contents were not
inspected further. This violates the requested no-save-decode boundary and
must not be represented as compliant. Frozen helpers and raw evidence remain
unchanged. No second original or live recorder patch was attempted.

Chrome exited **0**, but the browser host's retained-observation disposal did
not finish after a separate bounded read. Only the verified task-owned Node
host was sent SIGTERM after Chrome was absent. Its parent then actually joined
**−15 with both EOFs**; the Chrome profile was removed. This is host cleanup,
not a guest exit result. The failed capture has no ACK and remains terminal.

Closed recovery retained **127 unique blobs / 152 paths**, **6,352,025 gzip
bytes**, checking remote raw SHA and complete local gzip roundtrips before
normal delegated stop. The box was **archived at 22:23:00.595Z**, expiry **null**,
receipt **stop_bec6ec12c565cf53**, completed/unforced/error null. Stop, manager
and independent-watchdog actual waits are **0 with both EOFs**. No inherited
box was resumed, deleted or stopped; no task box remains running.

The [2055 final owning frame](heretic2-exit-witness-2055-20261112.md) remains
prior qualified evidence and was not a repeated objective. Existing SoftwareGL
HUD31 evidence is referenced by its retained manifest SHA, not a new pair.
There is no full27, parity, FPS, audio or general crash claim.

Next work requires a focused synthetic reproduction of the actual
caller-to-thunk transition before changing the classifier, plus integration
checks that prevent payload decoding, bound the legacy sink, preserve selected
exit evidence after the startup cap, and close retained reads within the
required observation cap. These are concrete remaining blockers, not an
authorization to replay this original or a speculative runtime/guest repair.

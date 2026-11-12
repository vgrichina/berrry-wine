# Heretic II fresh observer run: save-media staging failure before load

2026-11-12. Evidence: `scratch/runs/20261112-heretic2-observed-original-load-2205/`.
**One fresh original reached ordinary Game → Easy docks, then stopped on a
run-local staging error before `load crate0400`. There is no new ordinary-load
result or ExitProcess(8) cause.** The request remains blocked; the terminal
mount request was not replayed and no replacement original was started.

The [passive park/completion observer](heretic2-park-completion-2140-20261112.md)
from `02d148b8a` was attached before the guest worker resumed. Its emitted script
is byte-identical to the tested script. Existing synthetic cases and locked-build
evidence were reused by SHA, not rerun or promoted to original classification.
The driver additionally omitted named drawing events from persisted console
output; it did not change the observer, runtime, return values or timing policy.
Unnamed post-handler events were retained, accounting for substantial output.

## Concrete blocker

My new preparation filter removed all ancestor `scratch/runs/` paths while
removing old run helpers. This also removed the four required existing save-media
references, which the parent manifest included. The complete remote hash check
therefore verified an **incomplete requested closure**: 2,455 files including
the manifest and deadline. Provisioning actually joined 0 with both EOFs, but
that success did not establish coverage of the separate crate manifest.

The original followed native Main → Game → Easy. Eight complete bound PNGs were
reviewed, ending with the upright docks/player view. The HUD was not yet visible
in that last capture. All admitted native input used the inherited full22
identity/freshness checks and prearmed independent release; no wait exceeded
30 seconds. Enter's first immediate frame still showed Main; a subsequent
capture showed Game, without repeating the Enter pulse.

At 21:50:29.701Z the authorized mount failed opening the first file:
`scratch/runs/20261112-heretic2-north-opening-health-crate-0400/save-inputs/crate0400/server.ssv`.
The browser recorded ENOENT and closed. The retained mount operation exited 1,
untruncated, without signal or OOM. The separate browser parent actually joined
**1 with both EOFs**; Chrome exited **0** and its profile was removed. No whole-four
VFS readback completed, no console command was typed or executed, and no new
native exit code 8 was observed.

`check-media-closure.py` is a focused failing check of this exact frozen manifest.
All four local originals still match their SHA/size, while all four are missing
from both `files` and `uploadFiles`. Its expected exit 1, JSON and assertion are
retained in `media-closure-failing-regression.json`. The actual remote ENOENT and
manifest omission establish a staging defect, not a guest or runtime defect.
The frozen failed manifest is preserved, not repaired and relabeled successful.

## Scope of actual runtime observations

Hash-verified original startup console output contains 707,785 observer records:
705,176 post-handler events, 414 handler-entry events and 2,195 filesystem-import
events. The imports record **703 status997 and 1,492 status0** outcomes. All 2,195
import events have null call correlation, and no retained handler-entry or
post-handler event is named ReadFile. Consequently these actual reads remain
**UNKNOWN**, rather than being classified from import status alone. The 414
identified entries cover 16 socket/DirectSound names; `entry-coverage.json`
retains the exact counts. This run does not establish why ordinary named entry
coverage is absent, and recorded absence of observer-error log messages does
not establish a zero internal observer-error counter.

No caller-continuation boundary was invoked. Post-handler observation does not
prove guest completion. The prior 54 historical zero-EAX states remain UNKNOWN;
this new startup trace cannot supply their missing actual yield/call evidence.
Exit8 cause remains UNKNOWN. The [2055 final owning 640×480 frame](heretic2-exit-witness-2055-20261112.md)
was already achieved and was not a repeated objective. Existing [SoftwareGL
HUD31 evidence](heretic2-runtime-boundary-20261112.md) is referenced by its prior
manifest SHA, not presented as a new pair.

## Identity, recovery and shutdown

Controls retained baseline `8a834a3dc7affc8c6e53245beab56e87a32b81e8`, regular
inside-root renderer provider
`4235d20d7fc2404b38f6e4f7f80c92d5f94f1513b4d6d7dcf04be34162a4b087`,
and actual CPU/owning renderer module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Source recovery uses Git commit/diff and owned-helper patches; media remain
existing path/SHA references. No source or media archive was created.

The capacity dependency had actually recovered 197,320,704 bytes through its
verified old-binary compression. Its files were untouched. Actual `/home`
available space was above 1,500,000,000 bytes at allocation, original launch and
admitted native input; no RAM gate, resource arithmetic or reserve/cache change
was used. This task was not stopped by the disk floor.

A fresh independent two-hour watchdog was observed alive before creating
**bx_jyqmt5jq** at 21:42:31Z, initial expiry **2026-11-12T23:42:31.112Z**.
Read-only closed-output recovery retained **95 unique blobs / 115 paths**,
10,710,439 gzip bytes, with remote raw hashes and local full gzip roundtrip
verification before stop. Normal delegated stop archived the box at
**21:53:12.854Z**, expiry **null**, receipt **stop_bfcc2ae046e781c7**,
completed/unforced/error null. Stop, manager and watchdog actual waits were
0 with both EOFs. No inherited box was resumed, deleted or stopped.

Validation comprised exact observer/control SHA reuse, driver syntax and
attachment checks, actual remote closure verification and joins, complete PNG
reviews, unique evidence hash checks, the focused expected-failing media-closure
check, documentation links and diff checks. There is no production change,
new build/repair claim, guest RE/disassembly/private-structure examination,
extraction, guest patch, substitute DLL, new save, added GL/GetLastError query,
state write, child worker or public deployment. No general crash, FPS, audio,
full27 or parity claim follows.

Next, before any separately authorized fresh attempt, preserve all four explicit
save references in the provision closure and require their coverage before
allocation; resolve the demonstrated missing ordinary-entry correlation with
actual contract evidence and a focused regression. The ordinary-load trace and
distinct Exit8 cause are still outstanding.

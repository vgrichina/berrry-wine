# Q3 native input service repair — 2026-11-09 21:15 UTC

The Q3-only custody repair is published on main at `c367007f7` (preceded by
`5540b6d33` and `aeb7cc8a4`). One changed native fixture passed the unchanged
100ms hold guard. The conditional original reached a visibly clear main menu;
its third command delivered both mouse edges, then failed while awaiting the
returned screenshot. Arena, fire, displacement and guest application of that
last click remain UNKNOWN. No second fixture, original, box or replay ran.

Evidence is in `scratch/runs/20261109-q3-native-input-service-repair-2115/`.
`runtime-code-commit.txt`, `gitbase.txt`, the small binary diffs and sealed
manifests identify source. Git holds the source archive; no source/media archive
was made. Shared `native_kernel_custody.py`, Nox and Redline files were read-only.

## Repair and causal controls

`tools/q3-startup-custody.py` authenticates the pinned shared provider and applies
Q3-only changes. Its output pump checks real WNOWAIT stops before each read and
before output flush, retaining ordered bounded bytes and final durable closure.
A ready stop preempts command-output disk service. The existing batching barrier
now flushes the complete custody prefix at the common `trace_task(CONT)` entry,
**outside** the ptrace exception handler. This includes ordinary CONT, both EXIT
paths and first-observed unlinked irreversible EXIT. A sync failure cannot be
mistaken for ESRCH or a successfully accepted run. Existing bounds and sticky
failures remain active; neither the 100ms input guard nor 20s CDP guard changed.

`q3-native-input-service.test.py` executes real Node children under actual
ptrace. An injected real pending stop caused the published pump to write output
before stop service; the repaired pump wrote none ahead of that stop. Both
retained exactly 73,728 output bytes and reaped every child. Complete durable
prefix equality was checked at all eight ordinary actual CONTs, including two
EXITs, and six first-observed unlinked-EXIT CONTs, including two EXITs. Actual
unlinked children never executed userspace. Saturation, oversize admission,
sticky sync failure and final-sync failure controls also passed.

The complete generated native caller/parent/prelaunch/runtime test exercised the
installed Q3 hook, actual Node request 6 and deliberate pre-navigation refusal,
then joined all children with separate EOF. Its stronger final pressure control
measured 115 versus 65 fsyncs, 1.726 versus 1.001 seconds with injected slow
storage, 13/13 reaped. This establishes the service improvement under controlled
conditions. The one successful native fixture does **not** establish why the
previous native attempt failed: reviewed pre-input scheduling also changed.
No guessed fsync, browser or process-role explanation is asserted.

## Recoverable staging and input-phase evidence

`q3-native-phase-inputs.py` generates the phase helpers from tracked
`tools/q3-native-inputs/` inputs. Both staging and generated-caller tests use this
instead of importing the ignored historical startup run. Missing logical source
inputs and the exact historical gzip manifest are reproducible; existing drift
is never overwritten or silently repinned. The cold recovery control generated
21 missing canonical inputs plus four helpers, checked exact bytes and preserved
an existing drift refusal. Media/build providers remain existing path/hash
references. Phase-local staging remains intact.

Before allocation, all five local/check-only sealed manifests and every one of
944 pins in each were independently reread. Both remote phase prelaunch checks
passed. Manifest raw SHA256:
`9d611ceee450890bf783f49036bf38decdacc742587b58844908620d588c51c1`.

`q3-input-phase-service.cjs` pauses the changed fixture after its existing startup
capture for separate model review, requiring exact capture hash and identity.
Only after clear review does it arm the bounded service observer at actual input.
Wrong SHA, identity, ambiguous review and terminal refusal controls reject before
input. Its 60s pre-input review gate changes neither runtime input/CDP guard.
The observer retains exact PID/start/TGID/cmdline/comm/wchan with waitpid, CONT
and fsync intervals (including overlapping fsync starts), bounded to 512 records
and five seconds after arm. Startup consumes no record budget.

## One native fixture and one conditional original

Separate image review found clear red stepped fixture geometry on black canvas,
SHA256 `69ebb61ccc6f16cd1c1f44c6d29bbe9b91f99189ca8b1ebba753647a80b275e2`.
Guest and renderer module SHA256 both matched
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`, with
exact owner identities. The fixture's Enter DOWN matched within 6.636ms of the
hold origin, UP was attempted at 100.345ms and matched at 104.676ms. Wire requests
124/128 each had exactly one matching raw reply, no protocol error, observer
drop, sink failure or late reply. Held physical key13 was 32768; released was 0.
The full negative fixture and physical gate passed before planned cancellation.
The service observer retained 22 records, zero drops/errors: four waitpid,
four CONT entry/return pairs and five fsync entry/return pairs. Recorded roles
included AudioService and renderer threads; these are current identities, not
an inferred identity for the prior run's task7532. Full details and clock domains
are in `native-analysis.json`. The fixture drained 166/166 actual owned reaps.

Conditional original startup and each of the first two returned captures received
separate image-model review: clear Q3 main menu, no arena transition. The first
ordinary click and Enter command both ACKed; all wire edges matched. The third
bounded production relative-pointer click used [0,-75] counts and 100ms hold.
Its mouse requests373/374 both matched raw replies; its retained receipt reports
DOWN at 21:34:18.700, UP at .801, replies .707/.809 and ok=true. Trusted DOM
mouse edges and state were retained. Guest application remains UNKNOWN.

The first unexpected failure was command work deadline at
**21:34:38.381Z**. The active await was `binding.screenshot`,
`Page.captureScreenshot` request388, pending about18.037 seconds inside the
unchanged command deadline. There is no returned third image or capture binding.
This is a discriminating boundary after successful input service, not a blank
image or proven guest death. No subsequent controller input/capture/retry/quit
was submitted. **The existing generated cleanup nevertheless automatically sent
Browser.close request396 after terminal at 21:34:38.400Z.** Therefore the original
cannot claim strict no-post-terminal-quit conformance; this retained cleanup
behavior needs repair before another native attempt. It was not hidden or
reclassified as an owner-issued ordinary quit. Original drained 352/352; parent,
prelaunch, runtime and controller actual waits had separate stdout/stderr EOF.
The controller exited1, forced=false. No arena/fire/displacement claim follows.

## Validation and lifecycle

Focused controls passed: real-consumer service and every-CONT tests; whole
actual generated caller; review gate five controls; phase manifest actual two
prelaunches and five mutation refusals; cold recovery; capture boundary actual
20s absent-reply consumer and source identity; GL current/foreign closure27;
interactive controller. An early capture regression exposed unconditional gate
composition; it was corrected to explicit fixture opt-in and the full capture
regression then passed. Logs retain both outcomes. Final code passed
`flock /tmp/wine-build.lock bash tools/build.sh` (`build-every-cont.log`).

Only box: **bx_bun9s6rz**, UUID
**8c72c5a6-2d1d-4d7e-b127-6023043494df**. Before allocation its independent
immutable 25min watchdog was observably running with heartbeat/config hash.
Initial expiry **2026-11-09T21:52:27.924Z**; watchdog deadline epoch
1794261148.5837045 (~21:52:28.584Z).

A separate verifier independently reread all 85 fixture and90 original retrieved
artifacts, SHA/size/gzip CRC and four PNG CRCs, **before** exactly one delegated
normal unforced stop. Receipt **stop_6227bb3c44cb2646**, completed unforced
**2026-11-09T21:37:08.257Z**; independent state **archived**, archiveAfter=null,
API did not return a new expiry. Actual watchdog PID2792237 wait0 with separate
stdout/stderr EOF; allocator actual session joined0. No own live box remains.

Next: repair terminal cleanup admission, then investigate the returned-screenshot
service boundary without extending guards or guessing guest failure. A new
runtime attempt requires separate assignment. This worker releases STOP.

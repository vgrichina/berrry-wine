# MDK2 original comic controls — 2026-11-04

**The original opening comic supports a normal balanced Escape. Loading is a
different state and receives no input.** Escape ends the comic through its
original completion callback and starts the in-engine intro, rather than
directly entering the tutorial. This investigation and all new helper tests
were offline. No browser, game, box, build or production code was touched.
No gameplay or runtime success is claimed from the synthetic peer.

The published handoff read was `5a6307e99`,
`docs/re-notes/mdk2-opening-observation-20261104.md`. Its original run ended on
comic panels at 15,920 steps after New Game and Medium, with tutorial unreached.
I personally viewed its retained `review/loading-4912.png` and
`review/comic-final-15920.png`: the former has the HECTIC cover and large
LOADING label; the latter has enlarged story panels and no LOADING label.
They are historical references, never approvals for another session.

All new evidence and executable helpers are local, ignored files under
`scratch/runs/20261104-mdk2-original-comic-controls/` (called RUN below).
`dependencies.json` records full hashes of the predecessor modules, tests,
reference JSON, original executable and inspected images. No images or media
were copied into RUN.

The actual original archives were read and DCL-decoded in memory, with selected
lines and decoded hashes retained in `RUN/original-comic-references.json` and
`RUN/original-media-references.json`. The previous
`scratch/runs/20261104-mdk2-native-menu-cause/original-menu-references.json`
was read and its matching decoded hashes checked against actual bytes.

| Existing original path | SHA-256 |
| --- | --- |
| `test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/scripts.zip` | `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8` |
| `test/binaries/candidates/mdk2-demo/installed/mdk2demo/data/base.zip` | `a8f3da86e66f4271bc9d876053ef04ec46b29a74f5397bf59f72fff90843216c` |
| `test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe` | `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1` |

The decoded scripts are identified by these hashes:

| Entry in scripts.zip | Decoded SHA-256 |
| --- | --- |
| `defaultkeys.lua` | `c831ac9c5b961be545d2012ef9e89f0cbe3dafab3b699bba7964c0291b44a517` |
| `menuinit.lua` | `7dd82e7ddba774da6b318acac7fc14a6603aaf8d83e34d4618ea7fe7d5bd2398` |
| `script.lua` | `920c95c670224ca7e036fe02f9542a2ae963da08d16c895ff06d722561e503df` |
| `level1.lua` | `7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe` |
| `mdk2.lua` | `ac6c5e1705f48fee4d32c5420e51bfe6ea5639adaa5159d869310aaeef65e1dc` |
| `level0.lua` | `f5166d801b6aaf2d0c5cee17bc5d5b615b46f1b76c21641a70c89930b1871175` |

The normal control chain is explicit in the original code:

1. `defaultkeys.lua:53` binds `COM_PAUSE` to scan code 1. `menuinit.lua:5`
   defines that command as ESC with `CON_BUTTON_FALL`: the release edge matters.
   `mdk2.lua:145–149` dispatches commands through the current control scheme;
   level loading sets both schemes to `game` at 375–376.
2. `menuinit.lua:51–71` handles game pause. When pause is enabled and death is
   inactive, `Save.movietocancel` with no minigame calls
   `StopScript(Save.movietocancel)` at 56–57. Otherwise Escape may pause or
   cancel death; those alternatives are why arbitrary scenes cannot authorize it.
3. `script.lua:160–169` makes a movie cancellable when its script has `Done`.
   The comic calls `StartMovie(l0a, ...)` at `level1.lua:4403`, with
   `Done = Level.IntroMovieADone` at 4500. It has no MiniGameStart task.
   It exits `l0a` from stasis at 4398. The normal cancel route therefore has
   both the registered completion function and the non-stasis movie object.
4. `script.lua:182–228` stops an active movie, scans for any minigame marker,
   clears the cancel target and invokes `Done` at 215. The comic completion
   destroys dialogue and calls `Level.PlayIntroMovie()` at 4506–4508.
   `ContinueMovieHack` is for the separate movie-player path; this route is
   New Game. Natural playback reaches the same completion through ScriptUpdate.

This supports one Escape down/release action on the identified comic. It does
not establish Enter, Space, mouse click or the debug abort binding as comic
controls. The helper offers none of those. Original runtime flags are not
read or written by the helper: readiness is a named human classification of
fresh frozen pixels, supported by the script contract, rather than a claim
that the screenshot directly reveals Lua flags or customized bindings.

The first dependency after Medium is initial level resource loading.
`level0.lua:342` starts level 1 checkpoint 9; `level1.lua:95–103` maps that to
sectionD. `mdk2.lua:477` calls `doloadingscreen` before object creation and
scenegraph application. That function queues preloaded/section resources and
sound banks, then calls `mdkShowLoadingScreen(Level.loadscreen, memsize)` at
628. `level1.lua:4` names `loadscreen1`; sectionD includes `l0a.mod`,
`l0a_animgob.mod`, panel speech and the lounge/camera models (1011–1039).
Only afterward does checkpoint initialization load `ml1a_movie`, `l0a`, and
call `PlayIntroMovieA` (1436–1441). The actual decoded base.zip `l0a.lua`
registers the comic and child animation objects at lines 5–6.

The base.zip metadata distinguishes `loadscreen1.tex` (decoded SHA
`1445d3e8416162200f61c2675aa1cb16153071d25473f92c434c826b381d15a3`)
from `L0a_AnimGOB.mod` (decoded SHA
`5105ed6e2991f93c7c1c4d7038958f8d10d9f1d4e53dac4e24ed8170752f9109`)
and the page/panel textures. Full decoded hashes and sizes of six relevant
entries are in the media references. No bitmap extraction was staged.

The original PE further identifies the loading gate, without executing it.
Registration at VA `0x434d5d` maps the `mdkShowLoadingScreen` name to wrapper
`0x438be0`, which calls `0x42b320`. Its loop at `0x42b3a3` reads the count
at `0x5ce0c0` through `0x4515b0`; a positive count continues. Once that count
is nonpositive, the local fade value must also reach at most zero before exit
at `0x42b5eb`. The ordinary two-argument call has optional string id -1, so
the extra message-completion gate is bypassed. The loop pumps resources at
`0x42b446 -> 0x44f930`; the separate original `chIsLoadingResources` wrapper
`0x41d600` calls `0x44f8e0`, which reports loading while the active pointer
`0x4b7d14` is nonzero or queue count is positive. These are static addresses
in this exact executable, not observed live values. Selected disassemblies
and registration chains are retained as `RUN/native-*.txt`.

There is no established normal loading skip in this chain. The loading loop
also has resource-error UI, which is not permission to abort resource loading.
The safe route waits for original loading completion and fresh comic pixels;
it never sends Escape just because the loading artwork resembles a comic.
Neither loading time nor a step count proves completion.

The later original route is also finite in structure: comic Done starts the
lounge intro; its Done (`level1.lua:4387–4389`) starts checkpoint 12;
IntroMovieB Done (1571–1573) starts checkpoint 1, the tutorial initialization
branch (1413 onward). Each later movie also has its own Done, but the helper
deliberately accepts only the opening comic. Lounge, falling sequence, title
cards, tutorial, black transitions and unknown scenes require a new review
and are outside its input policy. No automatic repeated Escape chain exists.

`RUN/comic-control.cjs` integrates the retained `native-menu.cjs` Spool and
the actual `inspection-guard.cjs`. It uses the selector's exclusive lock,
requires recorded successful New Game and Medium phases, the original source
identity `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, canonical module identity,
and the registered isolated MDK2 WebGL selector. It rejects a latched selector
or continuation error. Before any command it verifies the latest capture's
bytes/steps, matching semantic approval, session, contiguous successful ACKs,
empty input queue, inactive input, zero mouse mask and balanced trusted history.
It checks a fresh state again before advancing.

| Helper action | Mandatory fresh human scene classification | Commands |
| --- | --- | --- |
| `observe-loading` | `screen:comic-loading`, `originalScene:level1-initial-loading`, loading visible, panels absent | state, eight individually acknowledged 64-step requests, shot; no tick or input |
| `skip-comic` | `screen:opening-comic`, `originalScene:level1-intro-a-comic`, panels visible, loading absent | state, tick 20 ms, Escape down, 16 steps, Escape up, 32 steps, shot |

Both require `selection:none`, `transitioning:false`, `tutorialVisible:false`
and `unsupportedSceneVisible:false`, plus the exact personally inspected
capture SHA, steps and named inspector. The review must first be approved
with the retained barrier CLI. Every resulting capture invalidates approval.
The helper returns STOP, with movie completion and tutorial explicitly unproved.
It validates exact appended trusted Escape events, their matching ACKs, final
balanced history, drained native state and exact step total. Any failure
latches; there is no retry. An interrupted failure can leave a held key and
requires the browser owner's closure/recovery policy, not another input attempt.

The persistent continuation ledger allows at most 24 loading observations
(12,288 steps), one comic skip (48 steps), 247 commands and 540 seconds total,
with each invocation capped at 60 seconds and a three-minute recovery reserve
relative to the driver's deadline. Loading batches each end in inspection;
this replaces a blind wait with finite observed progress. Limits are caps,
not predictions that loading finishes within them. The menu's original
512-step/64-command/240-second limits remain unchanged and separate.

Validation: **50 new helper tests passed**, using an independent command/ACK
and event peer with the actual barrier. They include the real selector's
New Game → Medium → new approval → comic helper integration; exact balanced
Escape; input-free loading; unknown/tutorial/loading/unsupported input
rejection; stale/uninspected/changed/session-mismatched approvals; pending,
wrong, failed and missing ACKs; command gaps/future ACKs; active/held/queued
input; partial/timed-out steps; finite budgets/deadlines/reserve; and refusal
to repeat a skip even with a new valid approval. The unchanged **42 selector
tests and six inspection-barrier tests passed**. The barrier suite executes
the actual retained driver's command function offline with a mocked page.
No test launches a browser. The first suite run had 49 passes and one test
harness error: a command-gap constructor threw before assert.rejects received
its callback. The corrected assertion now tests that rejection; the first
failure log is preserved separately. No production defect was inferred.

Reproduce from the repository root:

```sh
node scratch/runs/20261104-mdk2-original-comic-controls/inspect-original.cjs
node scratch/runs/20261104-mdk2-original-comic-controls/inspect-media.cjs
node --test scratch/runs/20261104-mdk2-original-comic-controls/test-comic-control.cjs
node --test scratch/runs/20261104-mdk2-opening-observation/test-native-menu.cjs
node --test scratch/runs/20261104-mdk2-opening-observation/test-inspection-guard.cjs
```

`RUN/checkout-head.txt`, `relevant-uncommitted.patch`, `owned-new-files.patch`,
`dependency-helper-recovery.patch` and `artifact-sha256.json` preserve exact
Git provenance, relevant changes, ignored helper/test recovery and hashes.
Only this note is committed. Patches contain small run helpers/tests and this
note; Git holds repository source. No source-tree archive or media copy exists.

**Next live prerequisite:** a newly authorized, owner-assigned runtime with
verified original pins, usable retained driver dependencies and enough deadline
for recovery. Use the unchanged inspected selector. While the actual HECTIC
LOADING artwork persists, approve each new capture and run only bounded
`observe-loading`; stop at the aggregate cap. At the first personally viewed
original story-panel capture, approve the explicit opening-comic review and
invoke `skip-comic` once. Personally inspect its new capture to establish
whether the original in-engine intro was reached. Stop on loading, unknown
scene or any control/ACK failure; never infer tutorial from the fixture or
repeat the input to compensate. The precise unresolved live claim is whether
this original-supported balanced Escape reaches beyond the comic in that
new execution.

No box was assigned to this task: ID/state/expiry are N/A. `bx_wnjq4738` was
never accessed; its lifecycle remains coordinator-owned. No workers,
successor, deployment or other game was started. This single task stops here.

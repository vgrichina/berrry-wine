# Original LBreakout pause drawing cost: native CRT copy binding

Evidence: `scratch/runs/20261110-lbreakout-pause-drawing-cost-0222/` (ignored).
Offline only: no box, browser, native retry, guest gameplay input or P handler
invocation. No clock, instruction budget, deadline or game-state shortcut.

## Demonstrated cause and production repair

The retained `0208` progress command entered the original P handler at +26 ms,
returned from its display at +1984 ms, and consumed release at +1986 ms. The
remaining 14 ms failed presentation. This result is unchanged and still does
not confirm score or brick progress.

Original `_display_text` at `0x407a11` calls `surface_gray` at `0x426bb0`
with `[screen,0,0,-1,-1,2]`. Each of 307,200 pixels makes two `memcpy`
calls through the EXE's import wrapper `0x451ae0`, plus original SDL_MapRGB.
Loading the real CRT replaced the existing native memcpy binding with the
authentic x86 export. These 614,400 tiny copies therefore ran in the
interpreter. The 32-bit retained-content control retired 7,682,406 grayscale
blocks, with zero native API calls. Range tracing adds cost; it is not the
whole cause. The previous isolated cost test also omitted the browser's
`set_uop(1)` policy, so it was insufficient for a browser-policy comparison.

The six-line production change adds `memcpy` to the existing CRT-only override
selection in `src/09a6-handlers-crt.wat`. This selection requires a named
MSVCRT/MSVCR70/MSVCR71 import and an authentic export; a full override table
retains the original export. It reuses the existing cdecl, sparse-safe,
code-invalidating native memcpy handler. There is no new pixel transform,
SDL replacement, guest patch, interpreter/JIT variant or experimental switch.
Only this exact provider file was claimed on the messageboard before editing.
Other shared providers, Q3 and Nox were read-only.

## Pixel identity and cost controls

`tools/lbreakout-pause-drawing-cost.test.cjs` loads the actual compiled module,
original EXE, SDL and CRT. It runs original `surface_gray` with the actual
darkening argument, followed by original `stk_surface_blit` at `0x426886`
and SDL's software blitter. It does not invoke the keyboard handler.

Before/after canonical modules:

- Control: `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
- Repair: `4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.

The existing `0208` launched screenshot is referenced in place by path and
SHA-256 `1b540c0d8107c7d634844bef33c68c58d453b0480ec6a337936f7f673da6441f`.
Its `[32,187,640,480]` crop supplies representative color content, not a raw
guest snapshot or restored game state. No capture or media was copied.
All bytes of each resulting surface match before/after for 16/24/32-bit
formats, module-default tier 0 and browser-policy tier 1, and observers off,
targeted and range-traced (54 samples per build). Canary/ABI copy controls
also compare the production import against the authentic export.

An additional five-pair crossover alternates original/native copy binding
only inside the isolated test fixture, restoring its production IAT afterwards.
The preload has no such switch. Same compiled instance, browser tier policy,
input pixels and SDL path; complete output hashes remain identical:

| Observer | Original median ms | Native median ms | Reduction |
|---|---:|---:|---:|
| Off | 394.55 | 319.94 | 18.91% |
| Targeted | 386.85 | 315.95 | 18.33% |

The repair retires 3,074,406 grayscale blocks and reaches the existing native
provider 614,400 times. This is a causal drawing-cost reduction, independent
of observer removal. Node v24.18.1/V8 on local x86-64 measured these numbers;
they exclude browser scheduling, text overlay and final presentation. They
cannot establish the next remote command's completion time.

Initial CPU profiles and named compiled diagnostic module are retained.
Hot samples are original load/store, dispatch and shift handlers. An early
attempt to name indices against combined.wat was rejected: its scanner's
indices disagree with the actual WATX module. The named-module profile is the
accepted name attribution; no conclusion relies on the mismatched index map.

## Validation and next gameplay step

Focused checks include 181 differential cases per authentic CRT version,
sparse REP boundary handling, sparse generated-code invalidation, original
initialization/SDL/level parsing and grayscale controls, 11 inspection tests,
pause and level-start observer ordering, unarmed native identities and tier
guards. Locked build passes. The default-input drawing control also uses
varied seeded bytes without relying on retained screenshots.

Exact Git base, relevant binary diffs (including new owned files), command
logs, input hashes and benchmark JSON are retained. Git is the source archive;
there is no source-tree archive, media copy, local Chrome or nested worker.
No box was created or operated, so box ID/state/expiry/stop receipt are not
applicable; no box watchdog was needed.

Next, under separate native authorization: use the repaired canonical module,
reach the original board, review ordinary P pause and separate P resume,
review ordinary Space launch, then ordinary P to retain gameplay progress and
review the resulting score/brick image within the unchanged two-second
completion/presentation deadline. Reuse the accepted unchanged fixture. A
failure still requires immediate owning cancellation with no later input,
capture, retry, quit or extension. Offline results do not authorize that run.

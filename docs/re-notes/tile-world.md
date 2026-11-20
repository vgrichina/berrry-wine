# Tile World

## October 30 original CLI gameplay replay

Run `20261030T2242Z-tworld-input` used the registered original assets and
retained module `7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`
(compiled source revision unknown). At 100,000-block batches, ordinary focus,
four Down presses and Enter opened `intro-ms.dac` / Level 1, KEYS AND CHIPS.
Root inspected `board.png` showing six chips/time 200 and `final.png` showing
the scrolled board, three remaining chips/time 138 after a Right hold.
Exit 0 after 650 batches, 16,673 API calls and 1.215 seconds; input hashes,
exact command, captures and log are retained. This is bounded CLI gameplay on
SDL's GDI route, not full-level completion, browser replay or GL rendering.

Registry/candidate `tworld`; active lane NEW-GAME-TWORLD-20261004. Live public desktop exclusion and all16 registered files verified in scratch/new-game-tworld-20261004/preparation-receipt.json. No gameplay qualified yet.

Historical run scratch/runs/20261003-tworld-gameplay-restored4 uses d2c module: readable SDL set picker, then black client after Enter/click/Enter. Only3.5seconds observed after final selection; actual selected set, input-consumer focus and owner PC were not captured. No specific trap or missing DLL proven.

INSTALL.txt explicitly says keyboard-only UI. Mouse click can establish focus but cannot select a row. Planned ordinary route: inspect picker, establish focus, visibly navigate with arrows to intro-ms.dac, Enter, then inspect board before ordinary directional input. Intro descriptor selects MS rules and intro.dat; registered font.bmp/tiles.bmp/SDL.dll all present. RC also names27 additional unmounted resources, mostly sounds plus Lynx atiles.bmp; do not blame them absent actual failing requests.

If black persists on current pinned build after bounded5–10seconds, capture actual owning EIP/ESP/thread inventory, input delivery/focus, file errors and live surface/transfer identity. Distinguish event wait, spin/trap and actual black raster; no guessed rendering patch or guest-state writes. Prepared300sec helper requires explicit slot grant; no browser/build performed during preparation.

## Current ordinary route: audio shutdown wait

2026-10-04 attempt1 retains the filename/ruleset picker on its black background after positively selecting intro-ms.dac with four ordinary ArrowDown inputs. Main owner EIP0x66a920 waits INFINITE on thread0xe1000; audio worker EIP0x6689e9 waits INFINITE on0xe0002. Shared DLL_TABLE from owning exports locates SDL.dll at0x63c000,size0x4b000. SDL_WaitThread export runtime0x6449d1 is called by audio shutdown at0x63dc7a; backend wait0x6689e9 reads device+0xbc then+4. WOM_DONE callback0x668a31 handles0x3bd by ReleaseSemaphore on that same field. This is a semaphore-path wait, not proof of an event object.

Immutable source/raw evidence scratch/runs/20261004-tworld-intro-audio-wait:158 hashed artifacts, actual owning stacks/wait globals/DLL table, disassembly, ordinary input receipts and screenshots. Browser94002 exit0; cleanup06:11:24.851Z bothclosed, ps clear. No gameplay/FPS.

Next investigate waveOut completion/callback delivery versus SDL shutdown ordering; exact cause remains unproven because no header/notification history was captured. Raw stack words are not a complete unwind: do not attribute the Tile caller from coincidental words. No graphics patch or forced wakeup justified. A narrowly bounded passive audio callback/header census may be needed after source review.

Passive attempt2 confirms stalled legitimate callback delivery: same two WAVEHDRs (flags3 DONE|PREPARED, no INQUEUE) remain in CALLBACK_FUNCTION queue before and after Enter. AudioContext runs and advances10.159→13.444seconds during the stalled picker captures; SDL device enabled1→0, main joins audio thread e1000, worker waits semaphoree0002. ExactSDLfile/DLLtable/callbackprefix checks pass. No forced callback/signal; no gameplay. Why selection triggers audio shutdown and later game behavior remain separate unknowns. Immutable scratch/runs/20261004-tworld-callback-census; browser39764exit0, cleanup17:55:18.203Z bothclosed. Shared owning-callback repair proposal in callback-file-review.md.

2026-10-04 root visual correction: attempt2/after-5.png retains filename/ruleset picker text on black, not a blank client. Published result summary corrected with prior result SHA and image-bound review correction; original result preserved in scratch/new-game-tworld-20261004/repair/published-result-before-scene-correction.json. Raw analysis wording is historical; no gameplay was reached.

2026-10-04 private repair evidence: actual integrated host completion queue → owning Worker callback → real semaphore release → audio Worker natural exit → main join resolution passed; unchanged host-queue control remained parked. Reset/header reuse/non-function callbacks and lost-ack/close were exercised. Production and canonical module are unchanged; root review, one suspended-owner guard regression, compatibility/build and fresh ordinary gameplay remain pending. Exact handoff: ops/handoffs/tworld-owning-wave-callback-20261004.md; frozen receipt: scratch/new-game-tworld-20261004/repair/integrated-validation/receipt.json.

### 2026-10-05 private owning-callback candidate: ordinary gameplay reached

The frozen callback candidate (`repair/final-validation-20261005/snapshot-v2`) was compiled as a full private module without test exports: SHA256 `faa06e701111c00486fe6580b898cf1c0762c9e7a287dc05b2d837c3ad2f9ec2`. A private server overlaid those exact JS files and module, leaving canonical sources/build untouched. Actual served module and122 pinned responses were verified.

Ordinary focus, four Down presses and Enter on `intro-ms.dac` now leave the formerly stalled picker and open **Level1 KEYS AND CHIPS**. Two500ms Right holds move/scroll the board and reduce remaining chips **6→5→3**. A300ms Left hold reverses movement/facing; final timer177. Images and exact inputs: `scratch/new-game-tworld-20261004/attempt3/{after-enter,right,right2,left}.png`, `inputs.json`, `scene-review.json`. Browser96683 exited0 with browser/server closed04:47:11.569Z; no resources retained.

The callback queues are empty and the prior audio Worker has naturally exited. The old SDL device/header addresses used by the earlier passive helper are stale allocations after shutdown; their contents must not be treated as current sound state. This establishes a narrow private-candidate ordinary gameplay route, not whole-game correctness, audible quality, FPS, release readiness or production integration. Independent/root screenshot review and immutable run publication follow separately.

### 2026-10-10: CLI gameplay and a qualified frame counter (claude:90024109)

Run the CLI at **100,000-block batches**. At the default 1,000 the first move
makes SDL RLE-encode the tile surface (`SDL+0xc0c1` loop) and the event loop
starves for thousands of batches, so input looks dead. At 100,000: picker by
batch 100, focus click, Down x4 to `intro-ms.dac`, Enter, Level 1 by 245; Right
walks Chip, the board scrolls, chips 6 -> 3, the timer starts. This SDL build
uses GDI `windib`; frames = `SDL_UpdateRects` calls (export `0x6c31c830`): 91
between batches 245 and 600, equal to host surface uploads, ~7.8 `BitBlt`
rectangles each. Tile World redraws on change (clock 200 -> 137 over the window
= ~63 once-per-second redraws + moves/pickups). Evidence:
`scratch/runs/20261010T0700Z-tworld-cli-frames`.

### 2026-11-20: startup path-buffer allocations, CRT route matters

Run `20261120-tileworld-fileio-allocation-causal-repair-gameplay` traces the
registered 1.3.1 PE's retained `fileio.c:348` dialog to `0x410df0`:
`malloc(260)` via `0x41df10` / IAT `0x4383e0`, return `0x410dfe`;
the zero-result branch sets the file/line and calls the fatal wrapper.
The earlier native dialog arguments and whole frame are retained in that run.
This identifies the allocation site, not the underlying failure cause.

The same retained a600 module with Git f696 CLI dependencies and explicit
SDL.dll (built-in CRT, matching the browser's DLL choice) repeatedly makes
successful 260-byte allocations at that return address. The CLI comparison
with automatic DLL discovery loads a real msvcrt.dll and reaches SDL window
creation instead. These are different CRT contracts; the real-CRT run is not
an old-fail/new-pass repair. No new failing malloc return, errno or heap OOM
reason was captured. Upstream BR903/tworld master identifies itself as 1.3.2;
its getpathbuffer/memerrexit shape agrees, but its line numbers are not the
1.3.1 binary's source mapping.

The repeated trace exceeded the disk floor; both supervised runs had already
ended and their tracked processes were joined when the breach was observed.
The 105,499,260-byte trace was gzip-compressed, restored through a streaming
SHA-256 check, and only then unlinked. No further runtime query or replay,
source fix, chip/level progress or Quit is claimed.

Next causal test: retain a bounded first/last allocation and API ring, counts,
the first heap_oom_trace(size, reason), and the actual native call stack at
`0x410dfe` and its caller. Include the two intervening imports (their names
are absent from this filtered trace), their arguments/returns, cdecl ESP and
nonvolatile-register preservation, and any file/directory failure/error.
Determine why startup re-enters getpathbuffer before choosing a handler to
change. Do not increase heap capacity, add media, force wakes or bypass the
fatal branch on the evidence currently retained.

### 2026-11-20: bounded built-in CRT history identifies argument-handler loop

Run `20261120-tileworld-bounded-crt-fileio-causal-repair` retains the a600
module and f696 CLI dependencies with explicit SDL.dll and built-in CRT.
A read-only import observer keeps first32/last64 API records, bounded stack
words and file-call history in TMPFS, counts all API entries, and stops at
50,000 completed calls. Offline controls cover finite bound, NULL allocation,
first OOM reason and nonvolatile-register violation detection. The original
reaches the bound in four batches; its normal CLI error handler labels the
authored diagnostic stop `CRASH`. This is not an observed guest fault or OOM.

The missing intervening imports are **sprintf** (thunk `0x41df60`, IAT
`0x438418`, return `0x4047a4`) and **strtol** (thunk `0x41df58`, IAT
`0x43843c`, return `0x404567`). Retained late sprintf calls have format
`%.*s`, precision259, return1; late strtol calls use base10, return0 and
eventually NULL input. Both and malloc retain ESP delta4 and EBX/ESI/EDI/EBP
in the retained samples. Counts: malloc16646, sprintf16641, strtol16642;
no NULL allocation or heap_oom_trace occurred before the finite bound.
The observer did not retain a separate first32 path-allocation ring, parser
argc/argv outputs, strtol end-pointer output, or a live errno cell.

Native stack words plus exact PE disassembly tie getpathbuffer re-entry to
the argument callback: `0x404770 -> 0x410df0`, sprintf at `0x40479f`, return
through `0x410504` into parser `0x410490`. It is not a proven file-enumeration
loop: _findfirst/_findnext/_fullpath/_stat/_mkdir were never observed. The
only file calls are missing DDRAW.DLL attributes (-1; exact last-error not
retained) and successful stdout/stderr file creation. Do not infer more-media
need from the optional DLL probe.

Next source/test remedy: first retain GetCommandLineA's returned string,
__getmainargs argc/argv outputs, SDL's resulting argc/argv and the parser's
four arguments at `0x410490`, then its loop index/argc comparison and callback
return at `0x410504`. Keep separate first/last path-allocation records and
strtol end-pointer/sprintf output bytes. Audit `src/10-helpers.wat`
store_fake_argv_a, `src/09a-handlers2-runtime.wat` __getmainargs and the exact
native parser compare/branch before choosing a patch. The shared formatter
in `src/12-wsprintf.wat` lacks dynamic `.*` precision, but that independently
visible defect is not proven to cause this argument loop; changing it alone
would not establish a startup repair. A focused native reproducer must first
show the actual bad argc/index transition or ABI/output corruption, then
old-fail/new-pass and negative API controls. No product patch, browser replay,
chip, level completion or Quit is claimed. All supervised processes joined;
no remote box was created.

### 2026-11-20: native argument-loop cause repaired; browser owner still hidden

Run `20261120-tileworld-native-argv-loop-causal-repair` first compared the
actual f696 CRT handlers with the shared tree (the argument, strtol and
sprintf handlers are identical), then retained bounded first/last API and
native block rings. GetCommandLineA is terminated `C:\tworld.exe`;
__getmainargs returns argc1 and argv[1]=NULL. SDL's splitter also produces
one argument. The PE parser nevertheless receives argc **0x41922a**, with a
correctly increasing index. Its callback returns zero and the next signed
comparison continues past argv's terminator. strtol returns zero with its
end-pointer output captured; sprintf `%.*s` returns the independently wrong
literal `s`. Neither is the cause of the invalid argc.

The loader binds MSVCRT's **_iob data array** to thunk 0x7500110. Original
startup code at 0x418d65 copies eight FILE dwords into imported stdout at
_iob+32, overwriting the adjacent **atexit** descriptor at 0x7500138 from
`{0x387b8,2477}` to `{0x589188,6}`. The observer's historical field names
`onexitIat`/`onexitThunk` refer to this atexit import, not _onexit. Two native
calls via 0x401000 now dispatch the wrong handler and pop20 bytes each.
ESP rises32 bytes; the return at 0x41922a overwrites argc saved at EBP-0x1c.
This proves a FILE-data/import-binding corruption, not heap exhaustion or a
file-enumeration problem.

The narrow source fix extends the existing CRTDLL/MSVCR70 `_iob` data
resolver to exactly MSVCRT.DLL, case insensitive. Unrelated modules and
symbol/module suffixes remain rejected; authentic DLL exports retain
precedence. The frozen control recompiles byte-identically to a600. Replacing
only this function produces module
`9fad60add0e7bc86dbcb957709450df5833024e0ba735c7f5bd5db22d856e022`.
With the same original PE, SDL and media, atexit preserves its descriptor,
returns with cdecl ESP delta4 and preserved nonvolatile registers, parser
argc is1 and the native branch takes 0x410738 (completion). No strtol,
formatter, heap-size, media, callback-wake or input-guard changes were made.
The focused data-import/native-cdecl regression and stdio regression pass;
the literal locked build passed. Evidence retains old-fail/new-pass API and
native observations, exact source/module recovery and foreign diffs.

One fresh coherent browser original actually reads back the repaired module
in the page and CPU Worker (305 imports each), accepted f696 JS, accepted
bridge and16 registered media files. Normal browser focus was admitted.
At the first native observation, Tile World's live HWND65537 is **hidden**,
with client rect23,43,-6,-27, focus0 and a healthy but not-ready software
scene. The existing startup observer throws `sampled native owner
missing/hidden` while the launch overlay remains visible; the scope closes
without binding, input or later endpoint requests. No picker/board capture,
chip, level or ordinary Quit was earned. The reviewed screenshot is only the
prelaunch desktop; the WebGL toolbar selector earns no renderer credit.

The next remedy is a bounded native window-creation/show/size history that
distinguishes SDL's initial hidden window from a failed later ShowWindow or
size publication, with native HWND/generation/thread ownership recorded at
each boundary. The retained hidden observation alone does not justify
changing the input guard, forcing visibility or replaying this closed scope.
All local supervised processes and the independent watchdog joined; private
profile/display/socket/auth were removed, and no remote box was created.

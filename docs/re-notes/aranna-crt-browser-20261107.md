# Aranna: complete CRT closure and browser demangling passed; EULA input harness boundary

The runtime dependency setup now passes complete remote hash verification,
including the existing CRT and all 55 media parts. A generated browser guest
passes ordinary LoadLibraryA/GetProcAddress and real CRT/dbghelp demangling.
The single original guest reaches its ordinary EULA, but the retained input
harness terminates on a pointer mapping assertion before accepting it. Menu,
world, and registration survival remain untested. No emulator semantic defect
was demonstrated and no production implementation changed.

Evidence: `scratch/runs/20261107-aranna-crt-browser/` (`R`). This follows
[the interrupted setup](aranna-complete-crt-20261107.md) and
[the missing-demangler finding](aranna-registration-table-20261107.md).

## Completed dependency and browser admission

Fresh box execution and upload/download health passed before runtime staging
(`preflight-exec-remote-result.json`, `transfer-health.json`). One persisted UUID
Idempotency-Key created `bx_af62tnvv`; no creation retry, second box, stopped-box
resume, public deployment, or source/media archive was used.

The recovered manifest has 2,190 inherited inputs plus 24 small generated and
harness inputs. All 2,214 pass full remote size/SHA-256 checks before and after
the original (`closure-preflight.json`, `closure-terminal-remote-result.json`).
The manifest retains exact Git revisions or existing input paths and hashes.
The supported registry path `binaries/dlls/msvcrt.dll` contains the existing
278,581-byte DLL, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`.
No guest bytes, configuration, callbacks, or exports were forced.

`restore-media-parts.log` records all 55 independently verified parts and
successful whole-file reconstruction. The unchanged existing media source is
`scratch/game-media/aranna-demo-20261105/extracted/DSLOA/Expansion.dsres`,
226,873,456 bytes, SHA-256
`3ed0688349f33b2dd7b9458c18cfbbc00490353c5888a93cd02c10da7f3c3b10`.
Remote temporary parts were deleted after whole-hash verification. The authentic
DSLOA.exe remains pinned by the inherited manifest.

Chrome 151.0.7922.108 prerequisites passed. Personally inspected matching
1001×800 `smoke-before.png` and `smoke-after.png` show an empty teal desktop and
then the open Start menu. `smoke-result.json` records the balanced mouse down/up.

`generated-browser-result.json` records exit 0 from the retained generated PE.
It checks exact `int __cdecl Example(int)` through native CRT `__unDName` with
flags 0800, plus full-signature and name-only results through unchanged dbghelp
UnDecorateSymbolName, including its lazy CRT lookup. The actual browser loader
fetches `/binaries/dlls/msvcrt.dll` with HTTP 200 after the normal app-directory
404. `generated-browser.png` was personally inspected and shows ExitProcess 0.
The generated module is 2,206,837 bytes, SHA-256
`e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`.
Its log reports the main guest running in a Worker; the optional endpoint field
was not populated by this harness. No CLI CPU controls or registration traces
were repeated.

## Exact first new boundary

Reversible prelaunch setup failures were preserved: missing supervisor.py,
then the existing exclusive supervisor log; after staging the supervisor, a
missing observer metadata JSON stopped run-session before spawning its browser
driver. `preserve-prelaunch-failure-remote-result.json` verifies no child process
record and an empty command directory. These failures launched no original.
Distinct logs and `prelaunch-*` artifacts preserve them. Supplying the existing
metadata allowed one actual original browser/guest launch.

`original/startup.png` and `original/response-00.png` were personally inspected:
the ordinary English EULA appears, with Accept, Decline, and Print License.
One balanced ArrowLeft completes with command ACK 0; the EULA remains visible.
`original/action-00.json` and the console retain its key down/up. Acceptance
was never sent.

The next separately reviewed action is pointer movement toward Accept,
`move:164,428`. The ordinary window's canvas geometry is 661×602 at page
(10,160); its renderer viewport and transform are null. The retained
`point-mapping.cjs` requires both and asserts
`v && g.transform && [x,y].every(Number.isInteger)` before the mouse move.
`original/action-01.json` records `rejected-terminal`, `effectsAttempted: 0`,
and the assertion stack through input-adapter and web-input-probe. There is no
command-1 completion ACK or response-01 capture. The waiting step times out;
the original browser driver exits 1 after its terminal drain. No action replay,
second original, synthetic callback, or emulator patch followed.

The original's actual module, checked through CDP worker slot 0 / endpoint 1,
is 2,221,881 bytes, SHA-256
`88ff2708a2dec89af430fac2ba778f39857c2716e851299c3ecbfa62fd5e7d1f`.
This matches the retained passive observer, not merely the current build file.
The EULA is an ordinary window on the canvas. Actual GL renderer/backend and
provider were not recorded at this stage; the UI's WebGL selection proves
neither. `original/terminal.png` was personally inspected: the empty shell after
cleanup, with Ready displayed. It does not show title doors or gameplay.

Next work is a generated browser control for ordinary-window point mapping
with null exclusive-renderer transform, alongside the existing exclusive
mapping controls. Repair the harness before another bounded original attempt.
Only after normal EULA acceptance and native initialization can the retained
passive observer test registration signature/table survival. This run provides
no new CPU, registration, title, menu, world, audio, FPS, or parity conclusion.

## Recovery and publication

`retrieval-verified.json` verifies 59 remote artifacts, 2,856,604 bytes including
the unchanged instantiated module. That module's hash matches its existing
retained registration-table recovery input; it was not duplicated. All other
unique logs/captures were downloaded or matched already recovered bytes.
`cleanup-final.json` verifies all 18 recorded PIDs absent, six ports closed,
the original browser profile removed, and four runtime/build locks available.
Its process census contains no remaining test Chrome or Node runtime.

After evidence recovery, explicitly delegated normal stop completed nonforced
at 07:28:21.021Z. `boat-terminal-final.json` confirms archived state,
stoppedAt 07:28:21.003Z, expiry null. The original expiry was 07:52:38.349Z.
No local heavy runtime or board watcher was started. Local /home remained
above 2 GB.

`checkout-sha.txt` identifies the local checkout; `runtime-dirty.patch` records
relevant tracked hunks and `untracked-wininit.patch` the retained boot helper.
`runtime-pins.json` identifies the older tested runtime closure separately.
`owned-inputs.patch` preserves small run-specific scripts; transport source
payloads were removed with command/input hashes retained in
`source-payload-removal.json`. Git remains the source archive.

This is a documentation-only publication; no production build was required.
The global evidence checker reports unrelated existing records; the pending
owned result is checked separately for schema and contained existing artifacts.
Publication details and final validation are retained in R; `result.json` is
published last.

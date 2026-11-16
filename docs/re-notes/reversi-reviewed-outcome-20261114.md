# Original Reversi: completed natural loss and native Exit

The single native game completed with **“You Lost by 25”**. The computer had
25 blue discs, the human had zero red discs, and 39 squares were empty. The
game ended after the native **“You must Pass”** banner and an ordinary
**Game → Pass** selection. **Game → Exit** then closed the native application:
actual exit zero after 315.685 seconds, with both output streams at EOF.

Evidence: `scratch/runs/20261114-reversi-reviewed-outcome/result.json`.
This uses the existing registered `reversi` app; there is no separate candidate
corpus row. No alternate package, download, second deal, New Game, guest state
write, rule/AI/configuration change, or emulator fix was used.

## Original, route and visual evidence

`test/binaries/entertainment-pack/reversi.exe` was verified before and after:
28,944 bytes, SHA-256
`62c4fa62b8bd5c8912b0659e420e370d75c575ca31675fa0afe6546eabcfdcd6`.
The file is a Win32 PE. Static inspection found USER32, GDI32, KERNEL32 and
MSVCRT imports; the existing registered MSVCRT image imports only KERNEL32.
Both original executable and CRT are pinned in `dependency-pins.json`.

The run used `node test/run.js --app=reversi`, the ordinary native Win32
USER/GDI desktop renderer, an 800×600 canvas, default 1000-block batches,
real ticks, cooperative threads, and `--no-close`. There were no startup input
sequences or injected fixture modules in the original. The actual native
window was **400×480 at (20,20)**. Clicks came from the current full-scene
pixels and window snapshot: the eight-cell grid spanned approximately
x=65…377, y=124…436, at 39 pixels per cell. The registry's differently sized
geometry comment was not used to determine clicks.

Selected images, all personally inspected and named by `result.json`:

- `original/baseline.png`: normal four-disc opening.
- `original/m3.png`: native rejection of my first D3 attempt. I initially
  assumed the human was blue; the human is red. The board remained unchanged,
  and the visible OK button dismissed the message. This was not a legal move.
- `original/s5.png`: settled board after legal red E3 and computer blue F3;
  the reviewed next choice was red F4, which brackets blue E4 against red D4.
- `original/m5.png`: after release, F4 is red and **E4 visibly changed from
  blue to red**. The computer has added **blue D3**, with D4 and E3 blue.
  These observations establish placement, flipping and opponent response
  from actual rendered discs, independently of input ACKs.
- `original/m15.png` and `original/passmenu.png`: required Pass banner and
  the native Game menu's Pass item.
- `original/pass1.png`: completed **You Lost by 25** result. Manual visual
  blue counts by row are 5, 4, 5, 8, 3, 0, 0, 0; no red discs remain.
- `original/quitmenu.png`: reviewed native Exit item after the completed loss.
- `original/final.png`: empty desktop after native Exit.

Ten legal human placements were chosen individually from native scenes. Each
computer response settled before the next review. Four stale precision intents
were positively rejected locally before arming/DOWN; each subsequent attempt
used a new scene and new intent. No UNKNOWN input occurred, no input was
replayed, and the permanent PID/start-token/window/owner binding was not renewed.
The maximum consumed placement scene age was 4.697 seconds.

## Controller, checks and closure

`tools/reversi-controller.py` adds a single-click manual policy over the
released, unchanged `tools/barrage-guard.py` transport. It has no board reader,
move generator, solver, gameplay loop or score manipulation. Binding requires
a submitted, personally reviewed native board. A placement requires a personal
legal-bracket explanation, settled opponent, and exact click center from the
current full scene. Precision/menu bounds are five/thirty seconds. Pulses are
at most 1500ms, with the transport's independent prearmed 1750ms UP margin.
Mixed or UNKNOWN receipts close input; only matching all-unsent refusals allow
a new scene and intent.

The original had a fixed 1200-second runtime and independent 1220-second
watchdog, armed observably before process launch. The mechanical gameplay
cutoff reserved 180 seconds for irreversible Quit. Quit began 307.772 seconds
after launch, well before the 1020-second cutoff. The native Game menu and
Exit selection were separately reviewed. Every nonterminal gesture had a
release ACK; their largest DOWN-to-release-completion upper bound was 433.778ms.
The final Exit retired the native process before physical UP could be ACKed:
`exit-up.json` accurately records **OWNER_EXITED**, actual normal wait and both
EOFs, with `physicalUpACK:false`. Port closure alone was not used as proof.

Native, watchdog, supervisor/outer-child and outer waits all completed with
exit zero and both EOFs. The watchdog observed actual native termination and
did not fire. The heavy lock was released, the native PID was absent and
control port 8593 was closed. No host shutdown was needed. No remote box was
created: box ID/expiry are null, state **NOT_CREATED**, stop receipt not
applicable.

Before the original, checks passed under the shared heavy lock:

- Eight final manual-policy tests, including exact pixels/identity, submitted
  board before binding, finite pulses, five-second endpoint deadline,
  irreversible cutoff and separately reviewed Exit confirmation.
- Twelve HTTP/terminal controls, including matching all-unsent recovery,
  mixed/UNKNOWN and wrong identity refusal, and real waits versus port closure.
- Ten actual CLI/renderer controls on isolated Solitaire fixtures, including
  the complete reviewed-bind/manual-click policy path, late/dropped ACK,
  independent child/EOF release, parent death, 1500ms pulse and native pointer
  delivery. Fixture instrumentation was never loaded in Reversi.
- `flock /tmp/wine-build.lock bash tools/build.sh`, actual exit zero/both EOFs.

The first policy-test draft incorrectly reused a Quit review for a menu
assertion; the test was corrected to use a fresh menu review. The runtime
policy was not relaxed. Final production tests started after the final
controller change. No causal public runtime fault was observed.

The tested WASM was 2,200,987 bytes, SHA-256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
`launch-pins.json` records the exact Git base and 2923 source/media/module
hashes; postflight found zero drift. Git plus binary dirty/new-file patches
preserves source provenance. Evidence contains no source-tree archive, media
copy or WASM copy. Unselected transient PNGs were removed after review; nine
semantic captures remain, all named by `result.json`.

The game/outcome/Exit goal is complete. This run makes no full-27, FPS, audio,
browser parity or general compatibility claim. No further original is needed.

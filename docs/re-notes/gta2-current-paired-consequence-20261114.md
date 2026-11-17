# GTA2 current paired consequence — 2026-11-14

The first current original failed during DLL initialization, before the game
menu, gameplay input or an owning renderer could be established. COMCTL32's
DllMain reached the NE thunk companion service and failed with **`Missing NE
image COMMCTRL`**. The fatal browser launch report was personally reviewed.
The software arm was closed; the WebGL arm was explicitly withheld under the
first-causal-failure stop rule. There was no retry or extension.

This supplies a current startup failure, not paired gameplay. Current walking,
native vehicle entry, manual driving/steering, a further mission/pickup/score
consequence, software draw completion, owning WebGL draw/readback and native
Quit are all **unproved**. Historical accepted gameplay remains intact:
software `9d8ebf6e9380fe8e5e29d6b6a989d2b645cbaf16` and the separate browser
WebGL result in `gta2-current-driving-20261107.md`. Earlier staging-only
software reports do not supersede those accepted results.

Evidence: `scratch/runs/20261114-gta2-current-paired-consequence/`. The selected
image is `software/startup-failure.png`; its JSON records the exact browser
PID/start identity, page target, passive page state, capture time and PNG hash.
It shows the fatal `gta2_demo` launch report. The Notepad dropdown and Software
selector are visible but establish neither app launch identity nor renderer
ownership. The production direct URL, actual GTA2 data/import loading and
DllMain failure are recorded separately in the HTTP and console logs.

## Current original and causal limit

Exactly one original software-route run began at **19:23:07.321 UTC**.
The original failed at **19:23:08.704 UTC**. It mounted all 69 registered data
files, loaded app-local Miles at `0x7fb000` and COMCTL32 at `0x951000`, and
patched the EXE imports to those real DLLs. Miles initialization returned
EAX=1. COMCTL32 DllMain `0x96b1cd` trapped at EIP `0x97d5d2`, ESP `0x074fffcc`,
halt=3, yield=18. The retained error chain is:

```text
DLL initializer did not return: module=0x951000
  NeLoadError: Missing NE image COMMCTRL
  prepareNeSources -> inspectThunkCompanion -> serviceNeGuestYieldSync
```

The effective NE lookup did not supply the requested companion. The local
DLL inventory has `comctl32.dll` and no `commctrl.dll`. The actual path includes
uncommitted shared `lib/ne-guest-bridge.js` changes, preserved in the exact
source patch. Static inspection also shows that the current LS relay path
deliberately rejects publication until native connection ownership and FT
prolog support exist. Supplying a companion alone is therefore **not** a
demonstrated repair. No clean-versus-dirty A/B was performed, so this report
does not attribute the failure to a particular commit or hunk.

The controller's separate terminal error is `bounded original startup
readiness`: the failed app had already been removed from `runningApps`, and
the startup observer reached its fixed sixty-second limit. This does not
replace the earlier causal DLL error. No menu gesture, driving attempt,
input UNKNOWN or renderer failure occurred. No public render/input violation
was demonstrated. No production runtime fix, substituted DLL, forced DllMain
success, renderer-counter change or guest edit was made.

## Controller and validation

The new `tools/gta2-paired-controller.cjs` uses local Chrome, native CDP input
and the existing read-only owner-chain helper. Every finite gesture requires
a new personally reviewed full scene and permanent page/guest/renderer and
module identities. Gameplay freshness is five seconds; menu/Quit freshness
is thirty seconds. Gestures are limited to 50–1500 ms. A separate process is
armed before DOWN, with an immutable 1750 ms fallback for UP; a scheduled
release can only shorten it. Ambiguous transport is terminal and is never
replayed. Quit is irreversible and restricted to reviewed native Quit routes.

Each permitted original has a fixed 900-second deadline, an independent
920-second watchdog, and an immutable final 180-second Quit reserve. The
software launch record fixes deadline **19:38:07.300 UTC** and gameplay cutoff
**19:35:07.300 UTC**. No original gesture was admitted, so the reserve was
unused and native Quit could not be reviewed. The second-arm launcher requires
an explicitly reviewed software result, no first-arm failure, actual completed
waits and heavy release. No WebGL original was launched.

The focused suite passed under the heavy lock. It covers finite/manual keys,
irreversible reserve and Quit selection, production renderer down/up state,
all permanent identity fields, real independent child releases on scheduled,
two-key and parent-EOF paths, PID/owner replacement refusal, and one-shot
UNKNOWN UP failure with actual child waits and both EOFs. These are controls,
not gameplay or guest-poll timing evidence.

`flock /tmp/wine-build.lock bash tools/build.sh` passed, including the standard
and compatibility modules. A separate blank-page Chrome control then passed
twenty trusted down/up events for the ten admitted keys, using the same
independent release executable. It launched no game. Its browser exited 0
with both streams drained. The original started only after Airstrike and
SuperTux actual terminal/EOF and heavy-release records; their gate records
and hashes are retained. No shared helper was edited.

## Identity and shutdown

Both preparations pinned **654 files** at source HEAD
`3115c772587003b3d34f5b065838ba26b1247a42`, with relevant dirty/new-file binary
patches. Chrome was **151.0.7922.108**, V8 **15.1.206.16**, on the actual local
browser route with normal realclock and production default slices. No native
CLI GL route was substituted.

All 71 registered game/media files match the accepted software inventory.
The EXE is 2,893,824 bytes, SHA-256
`97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3`.
Miles is 331,776 bytes, SHA-256
`0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc`.
Its actual app-local URL and COMCTL32 both returned pinned HTTP 200 bytes
before launch. COMCTL32 is 577,808 bytes, SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
Game media, configuration, saves, AI and physics were unchanged.

Postflight found zero drift across the 654 pinned files and all 71 media
files. Of 182 successful original HTTP responses, 181 match prelaunch pins.
The remaining response, `test/binaries/tlbs/stdole2.tlb`, was not in that
initial inventory; its recorded response hash matches the current local file,
which is weaker than a prelaunch pin. This limitation is retained.

The full standard module served to the original was 2,200,987 bytes, SHA-256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`,
matching the locked build and HTTP body audit. Executing Worker bytecode was
not separately retrieved before the startup failure; served bytes must not be
promoted into a retrieved executing-module or owning-renderer claim.

At **19:24:08 UTC**, actual waits recorded controller exit **1**, Chrome exit
**0**, watchdog exit **0** and drained stdout/stderr. The supervisor, its outer
child and the additional outer process exited **0** with both EOFs; these
supervision successes do not override controller failure. The watchdog did not
fire. Browser closure was host cleanup, **not native GTA2 Quit**. Heavy work was
released. Final checks found all nine recorded process IDs absent, all four
control/original HTTP/debug ports closed and both profiles absent.

Only the selected result-named failure PNG is retained, with CRC/inflate/hash
checks. Git SHA plus patches are the source archive; there are no source-tree,
media, Wasm or frame-series copies. No remote box was created: box ID **none**,
state **NOT_CREATED**, expiry **null**, stop receipt **not applicable**. Free
space remained above 1.5 GB.

The next prerequisite is an authentic companion/native thunk-connection
solution with focused public-API evidence and a newly authorized original.
This task stops here. Pixel parity, FPS, audio and full27 remain unproved.

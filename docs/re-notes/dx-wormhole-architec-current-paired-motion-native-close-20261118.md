# Wormhole and Architecture current motion and native close, 18 November 2026

Architecture visibly animates on actual software and WebGL browser executors,
then ordinary Escape dismissal reaches native `ExitProcess(123)` before host
stop and guest/render retirement. Wormhole visibly animates under both renderer
selectors and ordinary Escape reaches native exit 0 before host stop. Its actual
route is native DirectDraw/Canvas2D under both selectors: neither scope creates
a D3D bridge, render Worker or WebGL executor. The requested four actual
software/WebGL executor passes are therefore **not complete**. No media,
configuration or backend substitution is used to hide that remaining cause.

Evidence: `scratch/runs/20261118-wormhole-architec-current-paired-motion-native-close/`.

| Original / selector | Actual completed route | Early → later | Native exit / close latency |
|---|---|---|---|
| Wormhole / software | DirectDraw Canvas2D | 258 → 342 completed DirectDraw surface attachments | 0 / 188 ms |
| Wormhole / WebGL | DirectDraw Canvas2D; no WebGL executor | 274 → 418 attachments | 0 / 75 ms |
| Architecture / software | GpuStreamSoftware | DRAW_UP 448 → 823; PRESENT 17 → 32 | 123 / 331 ms |
| Architecture / WebGL | GpuStreamWebGL, live WebGL 1 context | DRAW_UP 4,044 → 5,149; PRESENT 128 → 169 | 123 / 132 ms |

These are completed-call observations, not FPS. Software reports native draws
and no GL context. WebGL reports an actual `WebGLRenderingContext`, `webgl1`,
attributes, a 640×480 drawing buffer and no context loss. Its renderer/vendor
string is not used as physical hardware evidence. Both Architecture pairs use
completed PRESENT; READBACK is zero and is not required. Endpoint ID/epoch stay
fixed and presenter counts advance. Wormhole's completed DirectDraw attachment
receipts identify `OffscreenCanvasRenderingContext2D`, 640×480 canonical surfaces,
advancing versions and flush counts; active D3D executor inventories are empty.

All eight selected successful images were personally inspected as whole,
lossless 1280×1024 private-display XGetImage captures. Wormhole's tunnel rings
change spacing and curvature and its convergence moves. Architecture's green
cog assembly rotates and its outer pieces move against fixed textured masonry.
Both frames in every pair already contain the settled scene. Black startup is
not used as motion. The browser viewport stays 800×600 with no resize events;
backing/window geometry and guest inputs stay unchanged across each pair and
through pre-close. Wormhole's composed backing is 640×480. Architecture's
composed desktop backing is 800×566 in the successful scopes, while its native
guest surface and WebGL buffer are 640×480. Nothing is resized for inspection.
Scene-only changed pixels are 101,944 / 103,376 / 74,521 / 129,317 in table order;
these support personal review without a parity claim.

Both originals show fullscreen native windows without a visible title/menu.
Wormhole's original handler at 0x40115a accepts Escape/F12 and calls
`SendMessage(WM_CLOSE)` at 0x401173. Retained native disassembly supports choosing
Escape after review. Native traces show `DefWindowProcA(WM_CLOSE)`,
`PostQuitMessage(0)`, WM_QUIT through Peek/GetMessage, then the native exit import
with code 0. The host's exact `h.exit` implementation logs `[ExitProcess] code: 0`
before invoking stop; this is not a process-object bookkeeping inference and is
not falsely labeled a kernel32 ExitProcess API entry. This ordinary keyboard
close is verified; a title/menu close is not available or claimed.

The visible Architecture saver receives ordinary Escape only after review, with
no dismissing focus click beforehand. Native traces show WM_CLOSE,
`PostQuitMessage(0)` and a real `ExitProcess` API entry whose stack argument is
123. Exact native exit code 123 precedes the native host-exit log and host stop.
Guest and render retirement are observed separately. Neither a nonzero guest
code nor later browser cleanup is silently substituted for native exit.

All four successful scopes have actual native-driver exit 0, no supervisor
termination or tracked leak, and separate successful supervisor/driver-output,
Chrome, Xvfb and openbox waits with null signals and both EOFs. The driver's
inherited output pipes drain in its supervising parent; its actual child exit
is recorded separately by `native-supervise.cjs`. Detached finite launchers also
record actual invoker waits and separate EOFs. Independent native supervision
and Chrome deadlines are armed before execution; successful scopes do not hit
them. All successful tracked PIDs are absent and private displays are retired.
Wormhole never creates a render runtime, so retirement correctly records absence
rather than waiting for a nonexistent manager's flag.

Four earlier preparation scopes remain permanently UNKNOWN, with no endpoint
request after closure. The first Wormhole software driver rejects the reviewed
Escape action because it allowed only title clicks; no close input is sent.
The next observes real native close/exit but times out requiring retirement of a
render Worker that never existed. The first Architecture software driver
observes native exit 123 and full retirement but its assertion incorrectly
requires code 0. The first Architecture WebGL invoker actually exits 143 after
the reviewed Escape input, before native exit evidence; its sender is UNKNOWN.
Its driver/Chrome/display waits are unavailable, not fabricated. Only its exact
owned orphan processes are terminated without endpoint queries. Its unique
selected evidence is retrieved and verified before owned tmpfs removal.

Bounded fresh scopes materially correct those run-local contracts: native
keyboard WM_CLOSE, valid absent-runtime retirement, actual native exit status,
and a detached finite launcher. The unlaunched Wormhole WebGL scope receives the
corrections before its first launch. No old UNKNOWN is replayed or upgraded.
Focused offline preparation checks use the retained native counterexamples and
reject host-STOP-only/generic-exit text. The successful originals are the focused
browser checks of the corrected contracts. No defect in product code or tracked
helpers is proved, and none changes; there is no blind recompile, locked build
or broad unchanged campaign to claim.

The served in-memory graph reuses base Git
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37`, renderer
`06f27181f9c977cd1aed99270040efddca00ed75`, and owning-Worker unload repair
`1ad9afd9201b40a3985421906436bd0023c73ba4`. The unique existing module is
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
Verification reconstructs source pins, native diagnostics and passive observer
suffixes, every successful HTTP response hash, registered original/DLL/media
hashes before and after, native close ordering, geometry, executor identity and
process receipts. Foreign relevant WIP is captured as binary diffs for provenance
and excluded from served bytes. Git remains the source archive; no source-tree
snapshot, media copy, replacement config or Wine reference is used.

All growing runtime outputs use owned tmpfs. Selected unique evidence is retrieved
and round-trip SHA-256 verified before removal. Successful runtime minimum
/home samples exceed 1.5 GB; finalization disk samples and limits are retained
without an unsampled continuous-floor assertion. Foreign WIP, security holds and
laptop ownership are preserved. No workers, boxes, public deployment, hardware,
FPS or Windows parity claim. Box ID/state/expiry/stop receipt:
null / NOT_CREATED / null / null. Artifacts precede final `result.json`.
Release and stop; Wormhole's absent WebGL executor remains explicit.

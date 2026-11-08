# TR2 native predecode boundary — 2026-11-08

The sole fresh original run of published `2666626f9` still had zero qualified
canonical/DX display joins. It exposed a further integration gap: a completed
main guest slice did not imply that the shared command/render writers had
finished. Native decoding and compositor scratch queries nevertheless ran.
The generic presentation boundary now defers both until those writers drain.
The exact Git baseline fails the new regression; the repair retains the same
pending source and subsequently produces one qualified red display pixel.
This new repair has **not** had another original run. No movement, weapon
consequence or FPS result is claimed.

Evidence: `scratch/runs/20261108-tr2-predecode-native/`.

## Admission and the original

Before allocation, one fail-fast shell completed the exact source, media,
helper and syntax closure: **612 pins, 209 retained evidence references and
23 existing media references**. CommonJS `.cjs` files were checked as CommonJS;
browser `.js` files used `node --input-type=module --check` through stdin.
The completed gate precedes the UUID creation attempt in `exact-closure.json`.
No shell continued allocation after a failed admission check.

Runtime source HEAD was `65153148ef792a15cddc0b85cf6b2afea8827f3b`.
The preceding accepted runtime closure was retained, advancing only
`lib/host-imports.js` to its exact published `2666626f9` blob. Published
`4003f6502` composition admission, `f4fc82774` menu metadata, `9c93a0f13`
queries and `2483eec51` ancestry were verified. Peer WIP was excluded.
The nonempty native WAT client-rect baseline0/fixed1/red/29 guards, placement,
Worker ordering, locked build and composition-local token proof were reused
by hash before allocation, without unchanged fixture reruns.

Actual CDP-retrieved CPU and owning render-worker modules matched
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
The owning endpoint reported actual WebGL2, Intel UHD 620 through ANGLE.
One blank-page preflight checked the accepted six native 500 ms key holds
with independent UP. Personally reviewed Graphics Hardware/Full Screen/
640x480 High Color/OK admission was **9300 ms** old. Ordinary Enter held
500 ms and released independently. The world was personally reviewed.

Observation then armed the bounded **4096-record** journal. Pre-arm raw
remains null. Final accounting is **113 raw = 0 qualified + 113 discarded**:
52 source-version-overwritten and 61 coalesced-before-publication. All sources
sealed under a sole stable unpoisoned writer across beforeSwap/sealEntry/
sealExit. No GDI substitute was counted. Up, Space and Control were not sent
to the game because the required DX joins were absent.

## First new branch and generic repair

`predecode-branch.json` shows the repaired decoder taking `directLayer=true`,
matching exclusive HWND, no windowed device or clipping, and matching 640x480
extents. It reaches `beginRead` with shared epoch `[1,6415,0,602]`: one active
writer. The latest recorded source was already superseded, with hostVersion
601. The former unused `getWindowCanvas` preparation is absent on this path.

`native-all-writers.json` retains passive production stacks showing
`_presentAtBoundary -> _presentNow -> flushRepaint -> _repaintOnce ->
_syncWindowStyle -> wnd_get_style_export`, followed by actual native client
and window geometry exports and nested `get_window_rect` scratch writes.
These compositor calls advanced hostVersion while an observed writer was
still active. Writer identity is not inferred from its count: the evidence
establishes an outstanding shared writer, not which command owned it.

`Win98Renderer._workerPublicationHeld` previously checked only main guest
slice depth. It now also checks active, unpoisoned writers in live publication
observations. Retired or poisoned observations do not permanently lock the
ordinary display; the existing qualification guards still reject their proofs.
`WineAssembly._presentNow` checks that hold **before** native decoding, keeps
damage pending, drops the redundant renderer rAF and uses the existing
`_dxLockDeferred` retry path. The non-DOM boundary has the same early check.
The renderer's ordinary scheduling and direct repaint entry share the hold.
No guest entry, input, clock, configuration, seed or scene was changed.

The new native-WAT regression drives the real host presentation method,
actual native dispatcher/swap/page watches, observed export facade, nonempty
client geometry, RGB565 decoder and compositor. Two independent writer
tickets keep main slice depth zero. While either remains active there is no
DX layer decode, no native scratch callback, no source host-version change
and no display join. After both drain, the **same** source produces one
qualified join and a red display pixel, with the real compositor scratch
callbacks still conservatively observed. The exact Git host/renderer baseline
fails at `pending writers defer before decoding` (`1 !== 0`).

Focused native-client 29 guards, browser Worker upload ordering, DX placement,
host rAF/Worker retry behavior, transient writer/scene, source lifetime and
callback-census checks pass. The transient-writer test now explicitly exercises
the lower-level direct GDI cache and join refusal, since the renderer correctly
no longer reaches that path while held. Unqualified cached pixels still cannot
qualify without a new safe read. `flock /tmp/wine-build.lock bash tools/build.sh`
passes. Both native/compat module hashes remain unchanged. Holding publication
can defer visible frames until a safe writer boundary; native progress and its
performance impact remain unmeasured by this fixture.

## Lifecycle, retained failures and recovery

A detached observable independent **25-minute watchdog** was armed before the
single UUID-idempotent box creation. Overall/browser/cleanup deadlines were
immutable. Free launch disk exceeded 5 GB. Accepted parent startup queue,
subreaper and WNOHANG reaper were reused. The owning remote runtime lock was
held before provisioning through runtime and descendant drain. The local
runtime lock was used only for focused local execution and released before
remote work, retrieval or analysis. No second original, old-box resume/delete,
public deployment or subworker occurred.

All five commands ACKed. Capture responses used small immutable manifests;
unique files were retrieved and hash-checked separately. Earlier handoff
truncated-response UNKNOWN remains unchanged and was never replayed. One
new diagnostic logpoint referenced `readStamp` before initialization, causing
a retained observer TDZ exception; the bounded logpoints were removed. The
successful pre-read and actual-writer observations remain usable. No input or
capture was replayed. A mistyped placement-test filename and the initial
expected callback-census build rejection are retained; corrected focused checks
and the reviewed two-entry census update passed. The initial transient-writer
test assumption failure is also retained and its changed-path coverage is
explained above.

Before delegated normal shutdown, **96 artifact references / 55,928,814 bytes**
were retrieved and independently hash-reread, including five CRC-validated PNGs,
exact modules, journal, ACKs and custody histories. All **24 registered native
PID/start identities**, including adopted descendants, were absent/reaped;
seven adopted child reaps were retained. Bootstrap and custodian were absent,
remote lock released, ports/endpoints/profile/writers and held input drained.
Read-only observer helpers were synchronously parent-awaited with structured
zero-exit transport receipts. Local normal/watchdog children exited zero and
the owning supervisor ended empty. `final-audit.json` records these checks.

New box **`bx_bryqb7fr` is archived**, expiry null. Normal stop
**`stop_c632b48c26c551c7`** completed **12:50:16.982 UTC**, forced=false,
error=null. The box was stopped before local repair work continued.

Recovery uses `source-head.txt`, exact published blob pins, existing media
path/hash references, `relevant.diff` (peer WIP excluded from runtime), final
owned-file diff and small run-input patches. Git is the source archive; no
source/media archives were created. Prior original534raw0qualified and the
actual predecoder client-geometry cause remain retained. The next authorized
native run must test this new boundary repair and obtain qualified DX joins
before reviewed Up/Space/Control. Full27, parity, audio and FPS remain open.

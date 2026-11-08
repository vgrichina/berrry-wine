# TR2 full compositor facade lifetime repair — 2026-11-08

The full observed production facade now qualifies one actual red RGB565 display
frame in the cheap integration fixture. The exact preceding production API
qualifies zero with the same fixture and module. This repairs the remaining
compositor self-invalidation seen after the earlier isolated no-menu repair;
it does not claim native-game validation or gameplay progress.

Evidence: `scratch/runs/20261108-tr2-full-compositor-facade/`.

## Reproduction and audit

Initial checkout: `8c1f78518060536da77f2c27085b0b1be9b9b992` on main. The
production baseline `lib/render-worker.js` has SHA-256
`8a9b0a995221d311e8361a4804d98e3c2ae562a629a3d26a3f8b859f9fb95197`,
identical to the prior `f4fc82774` repair. Read that handoff and its retained
`baseline-compositor-exports.log` before editing production code.

`baseline-full-host-facade.log` preserves the first pre-repair reproduction.
`exact-baseline.cjs` subsequently loads that exact Git blob into memory and
runs the final fixture unchanged; `exact-baseline-full-facade.log` retains its
expected assertion failure, qualified0 and source-version-overwritten ledger.
The complete observed facade is shared by the decoder, renderer and window,
including its normal conservative export wrappers. No compositor branch is
replaced with an unobserved getter. The production dispatcher, WAT swap/page
watches, native RGB565 decoder, real canvas transfers and compositor run.

The fixture now also routes native `get_window_rect` imports through the real
host-window implementation and `observeHostWrite`, rather than a no-op import.
Both X/Y calls write the four scratch rectangle words `[0,0,2,2]` under writer
exclusion. Baseline and fixed runs both show host versions advancing 0→1 at
`wnd_get_style_export`, 1→3 and 3→5 at the coordinate exports with their nested
host callbacks, then 5→6 at `menu_open_hwnd`. These writers remain observed.

Audit: `wnd_get_style_export` calls `wnd_get_style`, whose window lookup may
update instance-local hint globals. It remains conservatively classified.
`wnd_window_screen_x/y` walk the native window tree; their top-level branch
calls `host_get_window_rect` with `WINDOW_RECT_SCRATCH`, then reads the written
coordinate. `lib/host-window.js` writes all four rectangle fields, with bounded
child geometry reentry/fallback. Those exports and callbacks cannot safely be
blanket-classified as getters. No classification or host callback was changed.

## Production change

`SurfacePublicationJoin.startComposition` now synchronously admits the exact
already-decoded DirectX layer/cache token before compositor queries. Admission
requires the owning window/memory, exact layer/canvas/token identity and size,
current source host version, unchanged watched pages and an unchanged valid
writer epoch around these checks. Its WeakMap is replaced every composition.

Publication uses that admission only for that exact layer version. The decoded
canvas owns its pixels; subsequent compositor scratch writes cannot change an
already-completed source read. Host freshness is still checked at composition
entry, and at publication for any version lacking this admission. A later
source decode cannot borrow it. Publication still checks source pages, live
writer exclusion/poison, actual transfer path, layer identity/size, owning
memory, supported scene and blocked-cache serial. The native source/request,
owner/generation, page and decoder checks are unchanged. Admission epoch and
host version are recorded in the qualified row's canonical-read evidence.

This is a lifetime/order repair for complete native DirectX layers, independent
of the game or the queried scratch helper. GDI publication keeps its existing
rule. The callback census records this review; broader invocation ownership
remains pending.

## Validation and recovery

`directx-layer.json` records full-facade baseline0/fixed1 and the actual display
pixel `[255,0,0,255]`. All 29 full-facade refusal variants pass: the prior 20
owner/request/layer/source/page/host/exclusion/poison/scene/format guards, six
mutations injected during the real native scratch callback (poison, live
writer, owner replacement, watched page write, missing token and resize), plus
forged token, missing token before entry and an entry writer released during
the compositor. In particular, host/page mutations after decode but before
composition still refuse. The decoder-only and isolated-menu suites also pass.

All seven focused tests pass: directx-layer, source-lifetime,
clear-observation, transient-writer, transient-scene,
producer-publication-identity and command-wait-handoff. The source-lifetime
suite retains its two positive earlier-writer cases and all 15 negatives.
The locked full build passes (`build-reviewed.log`). The initial build's
callback-census hash rejection is retained in `build.log`; review and the
owned census update resolved it. An early test assertion expected a host
version field on an epoch-only stamp; the admission now explicitly records
both fields, and subsequent suites pass.

The unchanged WAT module is SHA-256
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
It remains fixture-validated only; the prior original used `6cf120d0…` and
observed 69 raw/0 qualified. No new native fix validation is claimed.

190 retained control/evidence references and 23 existing media providers were
independently size/SHA-256 verified and reused, without standalone control
reruns. 78 original paths were absent or mutable aliases; the exact retained
retrieval copies were located by expected size/hash and explicitly recorded
in `accepted-controls-reused.json`. The initial missing-path failure and the
old-module/current-build mismatch were retained, not accepted as matching.

Recovery uses `source-head.txt`, the exact Git baseline harness,
`final-relevant.diff` (`git diff --binary` for only owned relevant files),
small per-file input patches and existing media references. No source tree,
media, peer WIP or binary archive was copied. The build reproduces the module.
Local runtime locking covered only focused local execution, and was released
before analysis. No original, remote allocation, old-box resume, public
deployment or subworker was used. New box ID/state/expiry/stop receipt: none.
The inherited box remains unmodified: `bx_rbx878gk`, archived, expiry null,
stop `stop_bb68018e16c68f7f`, completed 11:48:31.484 UTC, forced=false/error=null.

Next: a separately authorized native run can test actual qualified canonical
and DX display joins with this production facade before reviewed movement or
weapon input. Full27, parity, audio and game/simulation FPS remain open.

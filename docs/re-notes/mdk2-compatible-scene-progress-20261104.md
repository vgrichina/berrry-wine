# MDK2 compatible scene progress, 2026-11-04

**Original New Game/Medium reached native level1 construction/loading. Comic, tutorial and player control remain unproved.** The corrected observer ran successfully through the actual menu and construction controllers. The single browser ended voluntarily at step 3552 after measured native progress, with no live controller rejection, guest exception or second browser.

Started from published `e89404f0ad58f08438afd3debab23ffa54204e99` and the FINAL corrected helpers in [the post-Medium handoff](mdk2-post-medium-scene-20261104.md). Evidence is in `scratch/runs/20261104-mdk2-compatible-scene-progress/`. Only this note is committed; helpers and evidence remain ignored. No production file changed or production fix is claimed.

## Compatibility and preflight

The staged `native-opening.cjs` preserves outer `mdk2-original-selection-v2`, with additive `mdk2-scene-transition-v1`. Its bytes match the predecessor's corrected final helper, not its executed v3 helper. `native-readiness.cjs` is unchanged. Actual serialized observer output passes unchanged `nativeReady`; the historical v3 mismatch still rejects. Three added tests feed serialized actual observer output through the actual opening-completion, New Game/Medium and construction controllers. All **177 local tests pass**, including the existing 174, original script/PE identities and negative cases. Live opening completion went directly from opening animation to a highlighted New Game capture, so the additional opening-completion controller was tested offline but not needed live.

Only small run inputs were staged, once. All **28 staged inputs** passed exact size/SHA-256 verification before launch and remained unchanged afterward. The retained **432 pins**, actual CommonJS Puppeteer **24.31.0** import, registered original MDK2/WebGL selector, isolated HTTP and both full module hashes passed before launch. The package and exact lock match the retained dependency directory; lock SHA-256 is `6244fdfa21eed2369547f97ecc11734967b30a6133543120f8579914abcebc33`.

The first remote suite passed the actual controller integrations but failed the source-only regression because the hydrated runtime lacks `tools/mpq`. The complete source regression passed locally against original archive SHA-256 `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`. An attempted negative name filter did not exclude that test; both failed command outputs are retained. The explicit skip filter then passed **175 remote tests**, with one historical replay skipped and the source-only case excluded. A command-sequencing mistake launched Chrome before that corrected filtered suite returned; it remained frozen at step zero, with no driver gameplay commands before the passing result. The actual serialized controller tests had already passed in the initial prebrowser suite. No source module was copied to satisfy the missing remote decoder.

## Measured native route

Every dependent capture was personally viewed before the next action, and the original selector retained its queue/mask, ownership, freeze, balanced trusted-event history, fresh unchanged-state and contiguous ACK checks. No arbitrary delay, guest write, forced Lua, native invocation or scene skip was used.

| Step | Fresh capture and native measurement |
| --- | --- |
| 0–3072 | Input-free startup, original BioWare splash, then original title/legal screen. |
| 3088 / 3120 | One original Escape FALL4 press/release: native positive consumption, button-timer effect and native rest. |
| 3136–3184 | Separately reviewed opening animation quanta; no Enter while unhighlighted/frozen. |
| 3200 | New Game label visible, controller ring red/highlighted, legal overlay absent; native freeze nil, title applied, pending nil, Enter at rest. |
| 3216 / 3248 | One original Enter RISE2 press/release for New Game; positive consumption before ONE release, callback effects and native rest afterward. Fresh difficulty dialog shows Medium highlighted; applied menu scheme, current diff, showmenu 1. |
| 3264 / 3296 | One Enter RISE2 press/release for Medium, with callback effects and native rest. Fresh capture shows original title fade, showmenu 0 and native freeze 1. |
| 3312 / 3328 | Reviewed original Medium fade, with the original startscreen table still present. Black pixels did not qualify as a loading/comic scene. |
| 3344 | Actual nil Level; levelnumber 1, checkpoint 9, section -1, applied/pending game, empty native input list, both native commands at rest. Resource queue 1, active pointer 6174784. This qualifies only as destruction/construction. |
| 3360–3424 | Separate guarded 16-step construction quanta; nil Level persists. Active resource pointer becomes zero at 3408. |
| 3440 | Actual Level table appears: file l1, loadscreen loadscreen1, doscenegraph 1, levelnumber 1/checkpoint 9. Original level1 construction/loading identity is measured. |
| 3456–3552 | Resource queue becomes 105, active pointer 6122816. Original l1/loadscreen1/checkpoint9 and applied/pending game persist. Fresh pixels remain black; no loading artwork, comic panels or tutorial is identified. |

The nil-Level and l1 transitions match the original decoded `mdk2.lua` and `level1.lua` identities retained in the predecessor note. Nil Level was never treated as a comic or playable scene. Thirteen construction quanta advanced **208 steps**, each exactly state → 16-step → fresh capture, with no input. The finite controller permits up to 32 quanta; this run stopped after the requested measured native progress, without claiming budget exhaustion or a game failure. The unchanged queue/pointer at the end is an unresolved boundary, not a diagnosed deadlock.

## Closure, evidence and handback

`validation.json` verifies **146 contiguous successful ACKs**, **75 step commands totaling 3552**, maximum step 64, exactly one Escape pair and two Enter pairs, clean renderer input at every capture, outer v2/additive scene v1 observations and no live first-error latch. All **200 served pins** match. Canonical module SHA-256 remains `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`; actual execution source remains `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`.

Chrome closed normally at **06:41:06.251Z**, before the absolute **06:46Z** limit and below 15 minutes. All **487 closed remote artifacts (10,072,764 bytes)** were recovered with full size/SHA-256 verification and checked stable by **06:41:19Z**, before **06:50Z**. Chrome and driver identities are absent; private port **41643** is closed. All 432 runtime pins remain unchanged. Existing modules are referenced by their existing paths and verified hashes. Recovery retained unique logs/PNGs without source archives, media copies or repeated module copies. Exact checkout SHA, relevant binary diff and owned new helper/note patches preserve source provenance.

Next work, if separately assigned: inspect the original resource loader boundary at queue 105/active 6122816 and qualify any further finite continuation against fresh native state and pixels. Loading artwork, comic completion, tutorial and ordinary player ownership still require evidence. No second browser, reload, local heavy run, subworker, allocation/resume, lifecycle change or deployment occurred.

**Handback:** `bx_9yhx9auy` remains **RUNNING / API idle**, healthy and hydrated, expiry **2026-11-04T06:55:13.764Z**. Browser/server are closed. Shutdown ownership returns to the coordinator. This single task stops here.

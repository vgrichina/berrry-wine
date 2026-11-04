# MDK2 post-Medium scene observer, 2026-11-04

**The nil-`Level` observer repair is tested offline; post-Medium progress is not proved.** The single browser stopped at step 3184, before New Game, on the first unexpected readiness-version rejection. No Enter, loading/comic input, tutorial input or ordinary player control occurred. The corrected helper was not used in another browser.

Started from published `2d97e23c4d91fc0ff7f8a9f6fa22ac46cdb66324` and [the original Escape-edge handoff](mdk2-original-escape-edge-20261104.md). Evidence and recovery recipes are in `scratch/runs/20261104-mdk2-post-medium-scene/`. This note and ignored run helpers change; no production defect is claimed and no production file is edited.

## Original source and offline repair

Read-only in-memory decoding of the existing original `data/scripts.zip` reconfirmed archive SHA-256 `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`. `inspect-original.cjs`, `original-scene-references.json` and the actual-source regression preserve selected lines and decoded identities without copying the archive or extracted scripts:

* `mdk2.lua`, decoded SHA-256 `ac6c5e1705f48fee4d32c5420e51bfe6ea5639adaa5159d869310aaeef65e1dc`: `level()` sets applied and pending schemes to `game` at 375–376; explicitly clears `Level` and `Save` at 385–386; collects garbage; then assigns checkpoint, level number and section at 392–394 before loading the level script. An absent `Level` can therefore precede the new checkpoint values. It does not identify loading artwork or player ownership.
* `level1.lua`, decoded SHA-256 `7d7de7b115b6fb1deb6290791c222e59c2726c607324095d3ba4c6136d9c08fe`: lines 1–4 construct `Level`, set `doscenegraph=1`, `file=l1` and `loadscreen=loadscreen1`; checkpoint 9 identifies Intro Movie A/sectionD at 96–103. `mdk2.lua:477` invokes resource loading before object creation and scenegraph application. These are construction/loading identities, not comic or tutorial readiness.

The run-only mapped observer now distinguishes an actual nil `Level` from an invalid tag or unmapped table. It retains native command, scheme, input-list and effective showmenu measurements while level fields are nil. It also measures level number/checkpoint/section, loadscreen/scenegraph fields and the original resource queue/active pointer. Legitimately empty intern buckets are accepted; corrupt bounds, duplicate identities and invalid mappings still fail.

`scene-transition.cjs` requires a single frozen host, original FALL4 Escape and RISE2 Enter identities, both commands at native rest, an empty native input list, effective showmenu zero and applied/pending `game` schemes. Nil `Level` means destruction/construction only. A table requires the specific level1/checkpoint9/l1/loadscreen1 identities. The controller additionally requires the original module/selector, completed New Game/Medium ledger, fresh matching personal pixel review, clean renderer input, trusted balanced history, successful contiguous ACKs and unchanged state before one 16-step input-free quantum. Black pixels alone never qualify. Construction continuation was never used live.

The final observer preserves the existing `mdk2-original-selection-v2` selection contract and versions its additive scene fields as `mdk2-scene-transition-v1`. The original readiness guard and native callback/ownership requirements are unchanged. Nil construction still fails selection readiness.

## Live result and first failure

The retained box reused all **432 pins**, canonical/compatibility modules and Puppeteer **24.31.0** with its existing exact lock. Actual CommonJS/ESM imports, registered MDK2/WebGL selection, isolated HTTP responses and full module hashes passed before launch. Only small run inputs were staged; no media, module or source-tree archive was copied into evidence.

The one browser ran **06:22:19.526–06:26:18.458Z**, below its 15-minute deadline of 06:37:19.526Z and the absolute 06:42Z close limit. I personally viewed every dependent capture:

| Step | Observation |
| --- | --- |
| 0–2560 | Original startup/window creation, BioWare splash and resource progression, without input. |
| 3072 | Original title/legal screen; freeze one, applied title/pending nil, original callback identities, native commands at rest. |
| 3088 / 3120 | One Escape pair; original positive cancel consumption and subsequent native rest, with `mumbotime` effect. Fresh 3120 pixels show apertures opening and legal fade. |
| 3136–3168 | Separate reviewed 16-step observations show button rotation, legal removal and emerging control icons. Freeze remains one through 3168. |
| 3184 | New Game text is visible; controller icon is white rather than highlighted. Native freeze is nil and schemes are title/pending nil. No Enter is authorized. |

The retained selector cannot represent the last visual intermediate state for selection. Original `level0.lua:443–446` starts the enabled animation, sets the message, then clears freeze. I added a narrow input-free opening-completion observer and tested nine positive/negative cases locally and remotely before attempting it.

**That attempt failed before submitting any state, step or input command:** the executed updated observer reported selection version `v3`, while the unchanged `nativeReady()` requires `v2`. My synthetic opening-completion fixtures still reported `v2`; they missed this actual-observer integration. This was my compatibility error. It is not evidence of a game failure, missing Lua state or failed native callback. The actual capture has `available=true` and the expected native values. The controller latched `comic-control-first-error.json`; I issued only quit afterward, with no retry, reload or second browser.

Executed helper bytes are preserved separately in `executed-helper-inputs.patch` and `executed-helper-hashes.json`. After closure I reproduced the exact version rejection, preserved the outer v2 contract, added the separately versioned scene extension and tested the serialized real observer directly against unchanged native readiness. The corrected files are offline-only follow-up work, not the live executed inputs. Initial offline empty-intern-bucket fixture failures are also retained; they were fixed before the browser.

## Validation and handback

The existing **136/136** tests passed locally after the observer change. Prebrowser expanded tests passed **151 with one historical-capture replay skipped remotely**; that replay passed locally. Construction controller tests passed **11/11**, and the opening-completion controller passed **9/9** locally/remotely before its failed live invocation. Final offline suite passes **174/174**, including actual original source, serialized nil-Level/no-write behavior, actual-observer readiness compatibility, the live v3 rejection, native flags/rest, wrong schemes/checkpoints/loading identity, missing observations, held inputs and pre-submission inspection/ACK failures. No production build was required for documentation and run-only helpers.

`validation.json` verifies **77 contiguous successful driver ACKs**, **54 step commands totaling 3184**, maximum step 64, exactly one Escape pair, zero Enter and zero guest commands after the controller failure. All **200 served pins** match. All **261 closed remote artifacts (5,364,907 bytes)** were recovered with full size/SHA-256 verification and checked stable. Chrome exited zero; Chrome/driver identities were absent and private port **40705** was closed. All 432 pins remained unchanged. Existing local canonical modules are referenced by path/hash rather than copied. Duplicate local review downloads were verified against recovery and removed.

Git is the source archive: runtime execution source remains `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`; initial checkout is the published handoff above. Relevant binary diff and owned new helper/note patches accompany the run. No source archive, game-media copy, forced Lua, guest write, native invocation, scene skip, arbitrary delay, allocation/resume, subworker, deployment or other game run occurred.

**Next prerequisite:** a separately authorized attempt using the corrected observer contract and actual-observer/controller integration, then fresh native selection and post-Medium construction measurements. Neither the predecessor's step3328 nil-Level state nor this run establishes live loading, comic, tutorial or player ownership. This single task stops at the preserved first failure.

**Handback:** `bx_9yhx9auy` remains **RUNNING**, API idle, healthy and hydrated, expiry **2026-11-04T06:55:13.764Z**. Actual identity inventory at **06:27:37Z** was empty. Browser/server are closed; shutdown ownership returns to the coordinator. No lifecycle operation was issued.

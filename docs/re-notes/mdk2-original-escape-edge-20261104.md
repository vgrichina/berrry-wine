# MDK2 original Escape and Enter edges, 2026-11-04

**Original New Game and Medium now activate through their measured native edges. Tutorial entry is not proved.** The only browser stopped at step 3328 after the post-Medium fade reached black and the read-only observer could no longer read a `Level` table. No loading scene, comic, tutorial, player ownership, left-dummy action or grenade progress was approved or attempted after that boundary.

Evidence is `scratch/runs/20261104-mdk2-original-escape-edge/`. Predecessors are [eefc41146, title-opening cause](mdk2-title-opening-cause-20261104.md) and [08c34f782, native callback selection](mdk2-native-callback-selection-20261104.md). This changes run-only helpers and this note; no production defect is proved or production file changed.

## Integrated edge ordering

The retained original PE has SHA-256 `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`. Byte checks reconfirm native `CON_BUTTON_FALL=4` uses the positive transition mask 5, while `CON_BUTTON_RISE=2` uses release mask 2. Browser event receipts remain separate from those original command observations.

The run-only selector now waits for **positive native Enter consumption, sends exactly one release, then checks native rest and original callback effects**. New Game also requires the applied `menu` scheme with pending scheme nil. It no longer waits for a release-triggered callback while holding Enter. Its synthetic native peers now use original bit 2 and withhold callback effects until after release. Native Enter readiness also rejects a bit-4 substitute.

The mapped, read-only observer from eefc41146 is installed in the actual page driver with opening observations enabled. It adds original cancel command 84, the bounded native input list, `mumbotime`, and `Level.Cancel`, `ButtonOnTimer` and title cancel-handler identities. Preflight requires the original frozen title, cancel at rest, valid function identities and an available input list before Escape. Single-host frozen-state, trusted-event history, clean queue, personal capture review, ACK, identity, recovery and first-error checks remain. No Lua evaluation, guest write, forced callback or native function invocation was introduced.

The original limits remain: startup 4096 steps/180 seconds; menu 512 steps/64 commands/240 seconds; individual steps at most 64; existing continuation limits unchanged. The browser deadline is the earlier of 15 minutes and 06:38Z, with full recovery due by 06:43Z. Actual browser identity was 06:00:37.155Z and normal close was 06:06:45.842Z.

## Measured original progress

| Step | Personally inspected scene and native evidence |
| --- | --- |
| 3072 | Original title/legal screen; `freeze=1`, applied `title`, pending nil, cancel raw/previous/active zero; all three original function identities available. |
| 3088 | After the one Escape press: cancel binding 1, flags 4, phase 4, raw/previous/active all one; input list contains binding 1/value 1. `mumbotime` changes from nil to approximately 0.9. |
| 3120 | After the one Escape release: cancel raw/previous/active zero, input list empty, `mumbotime≈0.538`, freeze one. Fresh pixels show opened apertures and fading legal text. |
| 3136–3184 | Separate reviewed 16-step observations show button rotation and legal fade, followed by legal removal; `mumbotime` decreases and becomes nil. These are measured changing pixels, not approvals of static legal artwork. |
| 3200 | Red-highlighted controller and readable New Game; original freeze nil, applied title, pending nil, native Enter at rest. |
| 3216 → 3248 | First Enter: positive native consumption captured before release; callback effects are absent while held. After one release, native rest, effective showmenu one, `menu.current=diff`, applied menu and pending nil. Fresh Select Difficulty dialog visibly highlights Medium. |
| 3264 → 3296 | Second Enter: positive consumption precedes one release. After release, native rest, freeze one and effective showmenu zero; applied menu and pending nil remain measured. The difficulty dialog closes and the menu fades. |
| 3312 → 3328 | Reviewed no-input fade observation reaches black. At 3328 the observer reports `available=false`, `table required: mumbotime`; no original loading/comic/tutorial scene or player ownership is established. This capture remains unapproved. STOP. |

All original title function identities stayed unchanged across Escape and opening samples. The native positive dispatch and `ButtonOnTimer` effects are observed. Those effects alone do not uniquely attribute execution to Escape because the original timer reaches the same function; no instruction-level callback execution trace is claimed. Freeze release and both subsequent native selection results are independently measured.

At 3296 the existing selector could not represent the source-defined Medium fade. Before advancing it, I added and tested a narrow `medium-transition` review: visibly fading menu, no difficulty dialog/selection/legal overlay, completed Medium ledger and native callback effects/rest. It permits only the existing 16-step input-free observation under the same aggregate caps and deadline. Original `menu.diff.Go` calls `omSceneFade`; the fresh 3296 capture visibly darkens the menu. Two added local and remote tests passed before this continuation was used. The unmeasurable black-frame construction state at 3328 was not reclassified as loading or approved for more steps.

## Checks, recovery and limitations

Before the browser, unchanged predecessor tests passed **123/123**. Integrated original-edge/controller/negative tests passed **134/134 locally** and **133 remotely**, with one retained historical-capture replay deliberately skipped remotely because it had already passed locally. Exact original PE masks, serialized observer/no writes, cancel samples and callback identity changes, Enter press/release ordering, absent callback after native rest, wrong flags, missing observer/function, held input, inspection barriers and original deadline failures are covered. The two fade cases were added and passed before fade use. Final local suite: **136/136**. No production full build was required for these run-only helpers and documentation.

Preparation staged the existing pinned recipe once onto the assigned fresh box: 29 MDK2 inputs plus the shared type library, retained canonical modules and the Git-pinned browser inputs, **432 pins** total. Puppeteer 24.31.0 was installed with its retained exact lock using `npm ci`; actual import, registered selector/WebGL choice, isolated HTTP headers and module response hashes passed before launch. No source archive or local game-media copy was made. Initial pre-transfer file-count assertion and a remote historical-fixture selection failure are preserved; both were resolved before any browser. The first startup approval inherited the predecessor's inspector label, although this worker personally viewed it; later approvals name this worker. No historical approval log was rewritten.

`validation.json` checks **104 contiguous successful ACKs**, **61 step commands totaling 3328**, maximum step 64, one Escape pair and two Enter pairs, plus **200 matching served pins**. Actual state artifacts verify that each Enter's positive sample lacks its result and that its post-release sample contains the original result and applied scheme. The final unavailable native observation has no input approval. There was one browser, no reload, no repeated Escape, no extra guest step after the missing measure and no tutorial input.

All **346 unique closed remote artifacts, 7,625,745 bytes**, were recovered with full size/SHA-256 verification and checked stable. Normal Chrome exit zero, Chrome/driver identity absence, private port 35697 closed, and all 432 runtime pins unchanged were verified. Canonical and compatibility modules are referenced by existing retained local paths and hashes, without duplicate binary/media copies. Git is the source archive: execution source is `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, initial checkout is `d60154c8702e5e56ae1d5802d938915cd25a02c0`; exact relevant binary diff and owned new helper/note patches accompany the run.

The next boundary to investigate is **original post-Medium scene construction/loading identity while the title `Level` table is unavailable**, then native callback and player ownership before tutorial input. The successful menu sequence does not establish a general timer fix, tutorial readiness or playability. This task stops here; no second browser or additional runtime work was launched.

**Handback:** `bx_9yhx9auy` remains RUNNING (API idle, healthy, hydrated), expiry **2026-11-04T06:55:13.764Z**. Browser and private server are closed. Shutdown ownership returns to the coordinator. No allocation, resume, stop/delete, subworker, successor, public deployment or other game run occurred.

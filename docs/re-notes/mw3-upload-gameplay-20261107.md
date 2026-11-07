# MW3 original buffered input and visible gameplay — 2026-11-07

One fresh original run reached the reviewed menu, default setup, operation map
and cockpit. Ordinary Digit5, Left Arrow and Space each produced a consumed
press/release pair in MW3's normal **GetDeviceData caller 0x4f76c8**. Reviewed
screenshots show displacement, a heading change, and laser cooldown/heat
effects. A beam, impact, damage, kill, audio or sustained playability is not
established. No emulator defect or production-source repair is claimed.

Evidence is in `scratch/runs/20261107-mw3-upload-gameplay/`. Preparation used
main `1c42d2302333e901c9528e03e4d1ff4800159dd0`, including published allocator
commit `ef2709a76ff57f7b4cccf5e60286f4fd9b01a7c7`. The canonical executing module
was 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

## Staging repair and retained controls

The run-specific `provision.py` records every submitted path with its pinned
size/hash and uploaded, failed or skipped outcome. The first failure inhibits
queued work; all futures, including successful in-flight peers, are drained
and recorded before returning failure. Exception records retain type and HTTP
status without signed URLs or credentials. Upload failures cannot reach boot.

The focused regression simulates PUT 502 with concurrent successful peers:
20 submitted, 20 drained, 3 uploaded, 1 failed, 16 skipped. It also checks the
all-success case, signed-URL exclusion, executable remote hash-verification
code and rejection of a changed staged file. Final results are in
`upload-regression-final.json`.

Actual staging uploaded **314/314** paths without retries or failures, then
verified every remote size and SHA-256 before boot. This comprises 312 pinned
runtime/helper inputs plus the manifest and boot helper. The first read-only
verification command failed with a confirmed Python indentation error, before
executing any verification or runtime code. The corrected read-only command
passed; both command results are preserved. The reusable generator now
compiles its generated verification program before submission, with a local
execution regression. The failed inventory was not an input UNKNOWN.

The predecessor's passed input, owner/module/epoch, 120-second freshness,
native-motion, binding, independent-UP and sticky-UNKNOWN controls were
retained instead of repeating broad qualification. `retained-controls.json`
hash-references those results. The static executable Node closure check passed
for **66 files**, and all 312 pins passed. No private renderer handler,
guest-memory write, altered binding/profile, clock change or synthetic guest
replaced the original.

The locked build passed with `WINE_WAT_NAMES=1`. Named and canonical code bodies
were compared byte-for-byte. The installed GetDeviceData body and **all proof
fields except the complete module hash** match the qualified predecessor:
function 5962, body `[888196,889324)`, entry 888199, keyboard completion 888442.
The observer still recovers executing CDP module bytes, verifies the complete
hash/body and exact executable locations, pairs real requests/completions and
distinguishes normal caller from startup flush/drain. GetDeviceState was not
used as the keyboard observer.

The explicit allocator adoption is retained as `incorporated-gl-allocator.patch`.
Relative to the predecessor's pinned runtime, only the canonical module hash
changed. Published `fece02eca` frontend completeness behavior remains included.
MW3 used the legacy D3D WebGL backend; this run does not attribute its gameplay
result to the GL CPU-storage allocator repair.

## Reviewed original route and effects

The browser was Chrome 151.0.7922.108 / V8 15.1.206.16 on the separate box,
with production guest/render Workers, cross-origin isolation, native viewport,
640×480 guest canvas and WebGL2 on Intel UHD 620 / Mesa 23.2.1. The owning
legacy render endpoint reported ready, error 0 and zero software draw fallback.
The actual browser-recovered canonical module is retained under
`retrieved/original/module-f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121.wasm`.

The reviewed main menu led through ordinary pointer-lock acquisition, bounded
trusted native mouse motion, pilot `a` via ordinary `a`/Enter, and unchanged
Bushwacker / Operation 1A / Battle Progression / Wave 1 defaults. Software
cursor and tracked physical coordinates were kept separate. At Launch the
software cursor was (575,432), physical point (554,584); the highlighted
lower-right deployment control matched the established Launch control. A
readable tooltip is not claimed. The first post-click capture still showed
the map; a passive wait reached the cockpit without another click.

Each screenshot below was retrieved with a size/hash check and personally
reviewed. Full PNGs and capture receipts are in `reviewed/`.

| Capture | Visible observation |
| --- | --- |
| `cockpit.png` | Cockpit framing, terrain, HUD, OP Able 449 m, clock 00:00:01; ER Laser selected; ammunition 100/100/24/24/20. |
| `armed.png` | OP Able 449 m, clock 00:00:02; stationary baseline before Digit5. |
| `after-throttle.png` | Clock 00:00:03, OP Able still 449 m; this immediate capture alone did not prove movement. |
| `after-left.png` | Clock 00:00:05, OP Able 441 m; terrain alignment and compass strip begin changing. |
| `after-fire.png` | Clock 00:00:06, OP Able 428 m; heading strip shifted right, consistent with left turn; ER Laser indicator red and heat bar raised. |
| `unobserved.png` | After observer removal and passive wait, clock 00:00:07, OP Able 410 m; changed terrain alignment, retained changed heading, raised heat/red laser indicator. |

The **449→441→428→410 m** objective-distance progression and changed terrain
support real displacement. The shifted compass strip supports a left turn;
no numerical turn angle is asserted. The Space consumption followed by laser
indicator/heat changes supports firing behavior. A transient beam/impact was
not captured. Unchanged ballistic/missile ammunition is expected for the
selected energy weapon and is not ammunition-consumption evidence. This
instrumented run is not an FPS or uninstrumented timing measurement.

Three command review strings contain stale/transcribed clock or distance
values: cockpit was **449 m/00:00:01**, armed **449 m/00:00:02**, and after-left
**441 m/00:00:05**. Those original receipts are preserved. The PNG pixels and
this final review correct them; the earlier strings are not independent
measurement evidence.

## Actual original consumption

The observer retained **39** paired successful normal completions, no drops,
pairing errors or diagnostic errors. Passive acquired standard-keyboard polls
preceded input: type 7, device type 1, format 256, stride 16, request 128,
flags 0 and HRESULT 0. `original-consumption-verified.json` validates the normal
records and these ordered consuming pairs:

| Ordinary input | Hold | DIK | Data | Sequences |
| --- | --- | --- | --- | --- |
| Digit5, VK 53 | 150 ms | 6 | 128, 0 | 5, 6 |
| Left Arrow, VK 37 | 2,000 ms | 203 | 128, 0 | 7, 8 |
| Space, VK 32 | 2,000 ms | 57 | 128, 0 | 9, 10 |

The first two pairs arrived together within their respective successful
normal completion; Space's two edges arrived in separate successful normal
completions. Every DOWN and independently prearmed UP received its native ACK.
There was no input UNKNOWN, replay, alternate throttle or repeat pulse. Both
breakpoints and diagnostic globals were restored before the final passive
capture. The closure and original records verify the current module rather
than borrowing the predecessor's fixture-consumption result.

## Custody and shutdown

Normal shutdown was explicitly delegated to a separate OS process. The
independent 1,500-second watchdog was armed and alive before allocation;
deadline **21:56:42.260Z**. The sole UUID-idempotent box was **bx_t39baaa2**,
created **21:31:42Z**, initial expiry **22:31:42.110Z**. No second box was
allocated. `/home` had 9.3 GB free at preparation; allocation required >5 GB.

After ordinary quit, Chromium exited code 0, signal null. Both runtime PIDs
were absent, both owned ports closed, profile and writer lock absent, and
native events left no held key/button. All 312 remote pins were unchanged.
**234 remote artifacts / 9,975,293 bytes** were retrieved and size/SHA-256
verified before requesting stop, reusing already retrieved exact screenshot
copies rather than downloading duplicates. These are unique run outputs and
the executing module, not source/media archives.

Normal stop `stop_e22ba4964d6880a6` completed **21:38:42.898Z**, `forced:false`.
Final state is **archived**, `archiveAfter:null`; retained-data expiry is
unknown. The watchdog was verified alive immediately before and after normal
stop; both lifecycle processes then exited normally. No runtime/lifecycle
ownership remains with this worker.

Recovery uses the exact Git SHA, relevant tracked/new-source binary patches,
owned helper patch, manifest, executing module and 36 existing media/system
paths with sizes/hashes. Media were referenced in place, not copied into run
evidence. No source-tree archive or public deployment was made. Further work,
if separately requested, can investigate rendering quality or capture a beam
and impact; this bounded attempt needs no gameplay-input replay.

Final verification passed the focused uploader/stage-hash regression, static
Node closure, original consuming-pair/native-UP/restoration checks, all remote
retrieval hashes and documentation whitespace. The evidence checker reports
zero containment, missing-file or schema errors for this run's 52 references;
unrelated global Alice and Tunnel/Twist errors remain in the saved output.

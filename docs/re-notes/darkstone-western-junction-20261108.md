# Darkstone: western junction to a red-flask pickup, 2026-11-08

One fresh original restored the untouched native **six-victory** slot, followed
**12 individually reviewed ground moves** through the western junction and
southern clearings, and picked up a visible red vial beside a stump and pale
birches. The vial disappeared from the ground and a red flask appeared in the
previously empty first quickslot. Native **New Save** preserved that result.
Actual final counters were **6+0 / LIFE 24/35 / Gold 1532 / Food 78**.
No attack, NPC, area transition or exact native item-name claim is made.
Production code was unchanged.

Evidence is ignored `scratch/runs/20261108-darkstone-western-junction/` (R).
Predecessor: [onward route](darkstone-onward-route-20261108.md), `0b246a154`.

## Counter discrepancy retained

The coordinator explicitly corrected the predecessor's MANA transcription to
**35/35**, after personally reviewing its `saved-onward-counters.png`, and
instructed this worker to preserve that correction. That correction remains
recorded here and in R/counter-discrepancy.json.

This worker personally reads **25/25** in the fresh
R/review/restored-counters-settled.png, R/review/pickup-inventory.png and
R/review/saved-live-counters.png. The fresh evidence and coordinator correction
are both retained; neither is silently substituted for the other. The fresh
restored panel also establishes **6+0 / LIFE 24/35 / Gold 1532 / Food 82**.
Food subsequently fell to **78**. No MANA change or expenditure is inferred.

## Exact restore and reviewed onward consequence

Read the predecessor note, `new-save-recovery.json` and its
`recovered/original/native-vfs-saves.json`. Both untouched inputs passed exact
length/SHA-256 checks:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,108 | `831e55267057ae86a6a912f4b3d0cdf13acbc3043c7bb6a8143345d30c3a8897` |
| `game641d_6af04b03.sav` | 3,204,264 | `813fe884e6cb27d9065fb28cb48945fbf78494d9d366c298b3df598cc5850bdc` |

Run-local manifest composition appended only these files at their original
`c:\dsave` paths, `loadMode:required`, `httpRange:false`. Ordinary HTTP
resolution, production manifest merge/normalization, `WineAssembly.loadFiles`,
mounted hashes and native `*.sav` enumeration passed before allocation.
Read-only mounted recovery independently matched both hashes in the original.
Native **Load a Game → sole selected slot → OK** restored the western junction.
Only the settled live world/panel established restore success; the preview and
loading captures were not counted as live-counter evidence.

The western arm reached a narrow sandy end against dense forest. Ordinary Tab
opened a native parchment map with a small explored patch and no destination
label. After closing it and reviewing the world again, the warrior returned to
the fork and took its southern arm. This led along a sandy corridor to a broad
grassy clearing, then across its southeast sandy opening to a wider sandy area
with pale/yellow-leaved birches, a stump and a rock beyond the grass.

Each move followed personal inspection of its retained current PNG. Eleven
ground holds were 2,000 ms and the last return toward the vial was 1,200 ms.
UP was independently armed before DOWN. Panels were never treated as pause.
R/western-junction-review.json records the exact commands, points and reviews.

R/review/east-past-birches-after.png first shows the red ground vial. The first
500 ms object click received an exact successful ACK, but the world continued
the earlier route movement and the vial remained on the ground. No pickup was
credited. Passive settling, a reviewed return move and another passive capture
put the vial close to the warrior in R/review/vial-approach-settled.png.
A distinct 500 ms click targeted that freshly reviewed position. In
R/review/current-red-vial-pickup-after.png the ground vial is gone and a red
flask occupies the previously empty first quickslot. The inventory panel and
post-save world retain it. The flask was not consumed. No UNKNOWN was retried.

Selected PNG hashes (relative to R):

| PNG | SHA-256 |
| --- | --- |
| `review/restored-counters-settled.png` | `b7acc353302aa40656873905e6948893eb35de668cf4fd5d5e46dad95c611a2d` |
| `review/east-past-birches-after.png` | `210f9565ab728975d9f92c178f50ee0b08de3f1a00e0ef193cc0fa0b5a1446cb` |
| `review/current-red-vial-pickup-after.png` | `3dfd621485c4f92577aadd1981043287f3bdc329f99ddcdb3820c5504743878a` |
| `review/saved-live-counters.png` | `9727cea813a6a2a4222d3581efab4576718a9e8f1145c0c3574dfeda0d3127c5` |

## Preserved new native save

Native **Escape → Save a Game → New Save** returned to the same clearing with
the flask retained. Read-only VFS recovery at **10:39:37.169 UTC** preserved:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,116 | `83214aa067f44b09bccfa2e819970b98bf73591e7ab1bae5ca4e00631374f5b4` |
| `game641d_6af0512b.sav` | 3,204,264 | `97228afbfa8dff1408e1272b7e1f8cd35df9e279e720c9be717fbb465abcfe4c` |

R/new-save-recovery.json gives exact local artifacts, sizes, original native
paths, hashes and the recovery recipe. R/recovered/original/native-vfs-saves.json
maps the hash-named `.bin` files. Verify the new pair, append them through the
ordinary composed manifest/HTTP/loadFiles/VFS path, then native Load a Game →
new slot → OK. Inspect live counters and the flask quickslot after loading.
This newest slot has **not** been reloaded. The loaded six-victory `.sav`
remains byte-identical, and both original input artifacts remain unchanged.

## Runtime, evidence and delegated shutdown

Runtime source was published main
`90c1fcfee91c4680877083e80498afcb73c9384d`. All **432 tracked runtime inputs**
matched that commit; all **525 staged pins** matched before and after execution.
Peer WIP was excluded. The executing guest/render module was
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
R/source-recovery.json records exact Git, relevant binary diff and small owned
helper patches; R/media-refs.json references 16 existing media paths/hashes.
No source tree or media archive was made.

Accepted actual-Worker readiness, native input, exact identity/staleness,
independent release, sticky UNKNOWN and lifecycle/observer controls were reused
after cheap exact source/helper checks; R/accepted-controls-reuse.json records
the accepted sources and hashes. No heavy local runtime was launched, and the
local `/tmp/wine-runtime.lock` was never held. The sole remote original was
wrapped in its own `flock -n /tmp/wine-runtime.lock`; the exact launch command
is retained in R/launch-single-original-remote-attempt.json.

R/final-audit.json passes **33 exact command ACKs**, **zero UNKNOWN commands**,
**26 independently released pulses**, **70 trusted events** (18 balanced mouse
pairs, eight balanced key pairs and 18 moves), and **33 PNG CRC/scanline decodes**.
No original guest-process exit, trapped terminal slice, Runtime exception or
target crash was observed. Explicit finish-run requested ordinary Browser.close;
Chrome exited **0 / no signal at 10:39:55.763 UTC**. No historical exit cause is
inferred. Own PIDs, ports, profile, writer and held inputs drained before stop.

All **374 remote references / 28,754,328 bytes**, comprising **308 unique
contents / 28,738,585 bytes**, were retrieved and independently SHA-256 verified
before normal stop. Evidence and new native saves remain in R, outside Git.
Own evidence containment, missing-artifact and schema checks pass. The global
checker retains seven unrelated preexisting containment errors. Darkstone is
unregistered in the candidate corpus; R/investigation-result.json attaches to
no unrelated candidate.

Sole fresh UUID-idempotent box **bx_sz33fmx4** had original expiry
**10:46:20.405 UTC**. Observable independent 25-minute watchdog and normal-stop
children were armed before allocation. The watchdog deadline was
**10:45:20.558**, browser deadline **10:43:20.207**. Normal stop receipt
**stop_02e80d5004ff831c** completed **10:40:49.996**, `forced:false`, error null.
Final state is **archived**, stopped **10:40:49.979**, expiry null.
R/stop-receipt.json retains the receipt. Both lifecycle children exited 0 and
the supervisor has no remaining children. Launch disk exceeded 5 GB.
No old-box resume/delete, public deployment, subworker, guest-memory write,
private handler, forced scene, configuration, clock or seed edit was used.

Only this note is committed. Next useful work is restoring the new pickup slot
and following the open grass/sandy route beyond the rock toward another named
feature. Full27, parity, audio and FPS remain open.

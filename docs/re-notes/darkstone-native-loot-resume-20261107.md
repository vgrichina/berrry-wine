# Darkstone native loot resume: missing observer in staging manifest

Loot pickup, a visible inventory consequence and native save/reload remain
unproved. The one fresh original run stopped before gameplay input because
the successor's `worker-observe.js` was omitted from its upload manifest.
This is a demonstrated harness staging error, not an emulator mismatch.
No production code was changed.

Evidence is in ignored `scratch/runs/20261107-darkstone-native-loot-resume/`
(R). The [November 4 skeleton victory](darkstone-webgl-ardyl-combat-20261104.md)
remains the latest personally reviewed original gameplay consequence.

## Qualification and original launch

All 469 predecessor pins matched SHA-256 and size, including the fifteen
original registered demo inputs and the current runtime. Eight retained
helper/control records were also hash-verified. Passing release, identity
and negative ACK controls were reused without repeating them.

The remaining local qualification completed with the actual production guest
Worker and owning legacy WebGL renderer. I personally inspected the generated
fixture's full startup and after-click captures, showing its caption and
white canvas. A click, ordinary H key and quit each received an exact matching
ACK; the four native button/key events were balanced. The instantiated module
was `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). This is control-path evidence, not Darkstone gameplay.
The local browser exited normally and its PID, ports and profile cleared.

One UUID-idempotent 40-minute box, `bx_wx25hs3m`, was created at
12:10:25 UTC, with original expiry **2026-11-07T12:50:25.209Z**. Its browser
deadline was fixed at **2026-11-07T12:35:24.827Z** before allocation and never
extended. All 485 listed files were serial-uploaded through the supported API
route and verified remotely before launch. No SSH, SCP, old-box resume or
second original launch was attempted. Sampled local free disk stayed above
2 GB; it was 3,242,483,712 bytes during evidence closure.

The original startup capture at **12:11:33.364Z** was personally inspected.
It shows “Starting Darkstone Demo”, fourteen downloaded files, and waiting
for the program's first window. The guest Worker had instantiated the same
module; its render endpoint was still `none`. No ordinary input followed
this loading capture. The only original command requested a passive capture
after five seconds.

## Concrete blocker and closure

At **12:11:52.906Z**, attaching the production renderer tried to read:

`scratch/runs/20261107-darkstone-native-loot-resume/worker-observe.js`

The read failed with `ENOENT`. The file existed locally, but `prepare.py`
added owned `*.cjs` and `*.py` helpers while omitting owned `*.js`. The
predecessor's observer was staged at its old path. The local import trace
did not exercise the renderer event's deferred `fs.readFileSync`, so the
claim of complete closure before allocation was incorrect. Remote pin
verification established the listed manifest, not completeness of that
manifest. R/closure-blocker.json records the missing file's size and hash.

The command became UNKNOWN and admission closed. It was never replayed;
there was no relaxed guard, guest code/configuration/save/memory edit or
clock forcing. No original native input events were recorded, and no save
was created. The renderer had not completed observer startup, so an
instantiated original renderer module is not claimed.

Chrome exited **0**, without a signal, at **12:11:52.965Z**. All **35 unique
terminal artifacts / 2,378,607 bytes**, including the instantiated guest
module, were retrieved and SHA-verified before the explicitly delegated
normal nonforced stop. Remote verification found both owned PIDs absent,
both private ports closed, and profile, writer and held input clear. All
485 staged pins still matched. Local qualification PIDs/ports/profile were
also clear; the board watcher was already absent at closure.

The stop completed with `forced:false`; the box was verified **archived**,
stopped at **2026-11-07T12:13:00.044Z**, with expiry cleared (`archiveAfter:null`).
There is no running box custody to hand back.

R/checkout-head.txt records checkout
`651e789e04953b0ca4f012a525fbf466dd0433bd`; runtime pins retain their source
commit and byte identities. R/relevant-tracked.patch, R/owned-harness.patch
and R/source-recovery.json preserve recovery instructions. Git is the source
archive; no source/media archive was created. R/evidence-inventory.json
hashes retained artifacts, and R/result.json is published last.

Next: include and hash-check deferred file reads, especially the successor's
observer, in staging closure before any newly authorized original attempt.
Reuse the passing controls where their hashes match, then pursue the original
loot/inventory route and native save/reload. No FPS, audio or parity claim is
made.

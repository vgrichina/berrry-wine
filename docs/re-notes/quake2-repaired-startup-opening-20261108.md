# Quake II repaired startup and native opening attempt, 2026-11-08

The fresh remote Chrome startup succeeded with kernel repair
`bcf8c7bd788f2c63668406b11f72652006cde8dc`, SHA-256
`5371233b12d3a63e13a9768529af43e5a61b7ff1682b2d3c09e4db6a976e12d0`.
The one original Quake II game reached visible gameplay and the broken northern
window. The attempt ended with health falling from 100 to 54 and then zero,
with a rolled death view. **Upper-opening threshold passage and onward progress
remain unqualified.** No respawn, second allocation, late attachment, replay or
deadline extension occurred. This is a concrete gameplay blocker after actual
startup, rather than a preparation-only result.

Evidence: `scratch/runs/20261108-quake2-repaired-startup-opening-2052/`.
The most useful reviewed captures are `remote/original/world-first.png`,
`remote/original/window-slide-right.png`,
`remote/original/missing-section-forward.png`,
`remote/original/lip-angle-left.png` and `remote/original/onward-right.png`.
The final image is death evidence, not a successful onward screenshot.

## Exact selection and startup

The 2025 consumer selection was regenerated before allocation: 706 providers,
109,893,505 bytes, with the new kernel replacing its predecessor. The original
2025 selection commit is `0ce4835928398cb56003fc93221aae136e122db7`;
this task's source reference is `0b12ac15352dd9289814289215fffaa00c139ebc`.
Run-relative consumers were copied as small inputs without rewriting the browser
consumer, flags, caps, backend or bindings. Readiness `9ba9ae8b…`, close
`1f4fe08b…` and logger `979b3a8b…` remain unchanged.

Concurrent peer work had changed both local build outputs and two source files.
The exact original CPU and compat modules were selected by existing path/hash
from `20261108-tr2-startup-control-1810/retrieved/build/`, without local module
copies or overwriting peer outputs. The two source providers came directly from
Git at the recorded 2025 commit. `provider-map.json` records these resolutions.
The actual driver's preflight ran with a file-provider hook for those four paths,
validated all 706 selected bytes and started no Chrome. All 707 uploads joined
before the remote hash barrier and the sole launch. The production remote
consumer read its normal paths; no hook or source rewriting was used there.

DevTools was published after **10,646 ms**, within the unchanged 60-second cap.
The driver connected and launched the original at the production route. The
native keyboard/type/combo preflights passed. Fresh startup and gameplay
captures identify both executing CPU and renderer modules as
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
This is actual executing-module evidence, not merely a provider hash. One
successful remote startup does not establish an exclusive historical root cause
or general startup reliability.

The accepted 33 focused causal tests, eight-thread control and locked build,
plus the predecessor consumer proofs, were checked by retained hashes rather
than rerun. `accepted-reuse.json` records 155 proof references. The causal run's
self-inventory entry is excluded from self-hash comparison explicitly. Initial
selection failed because its selected consumer-test input had not yet been
staged; that failure and the dependent preflight failure are retained in gzip.
After staging that small exact input, selection and final preflight passed
before allocation. No failed remote command was replayed.

## Fresh native progress and blocker

All 35 captured images were actually reviewed. Every one of the 34 native input
commands used the immediately preceding reviewed capture, its SHA and the bound
live identity; every command received an exact ACK. Holds were independently
released, lasted 50–400 ms, and were followed by displacement review before the
next input. The two menu Enter inputs started easy gameplay. Subsequent turns,
forward steps and ordinary strafes approached the broken window around the
foreground crate. No inherited timed movement sequence, private guest call,
guest write or static-coordinate shot was used; no attack was issued.

At the pane, several short forward attempts showed little displacement. The
missing right section was visibly exposed after lateral movement; even a
400 ms forward test there did not establish a drop or crossing. A separate
ordinary jump showed no clear vertical change in its immediate capture.
`lip-angle-left` subsequently shows the pane overlay absent with health **54**
and a red damage flash. That change could be compatible with movement beyond
the pane, but it does not prove a swept player-hull crossing. The next reviewed
right-turn capture shows health **0** and the rolled death view. Damage source,
exact player location and the timing of any possible crossing are unknown.
No living attacker was unambiguously identified. No successful onward view,
kill, threshold passage, or level completion is claimed. Death ended this sole
original attempt; only normal quit followed.

The 187 static sightline controls, assumed start `(128,-320,32)` and bearing
near 92 degrees remain preparation only. Full27, parity, audio, FPS and
Intel/SystemInfo renderer qualification remain open. The next useful work is to
resolve the native sill/hull alignment and survivable traversal from this fresh
visual evidence; this run does not authorize a retry.

## Terminal custody, evidence and stop

Normal quit received command ACK 34. Chrome close was acknowledged and its
actual terminal result was code 0, no signal, after **17,212 ms**, within the
unchanged 30-second close cap. Compressed pipe drain completed before profile
removal and cleanup publication. The supervisor **5972/10541** has its parent's
actual exit-zero wait. Kernel custody has **362 owned identities and 362 matching
actual terminal reaps**, complete lineage, empty remaining/unreaped/unresolved
sets, command-pipe EOF and `complete: true`. No cancellation or escalation was
needed. Historical Q2's 132 reaps and unresolved 8107/30705 remain unchanged
with `complete: false`; historical supervisor 143 remains UNKNOWN.

The command stream's original 807 bytes hash to
`f208265dcbfc16031446ac432d5c199573e382561c85455531dab9323215e0a5`;
the custody stream's original 605,182 bytes hash to
`4edc5409f4718318fecd6c29b214115bc8e7a9fc40ed7c22c7c9ab00f27fe796`.
All unique explicit command/browser/Chrome/kernel/provisioning/watchdog logs
were gzip from their first stored bytes. All **453 regular remote artifacts /
12,410,756 bytes** were recovered without an extension filter, with remote
SHA/size pins, independent local SHA checks and independent `gzip -dc` original
SHA/size and CRC verification for all 44 remote gzip streams. Filesystem links
were recorded without following them; this normally cleaned profile left none.
Selected sources were omitted only after their matching hashes were checked.

Cleanup census found ports **40805/37581** closed, the heavy lock free, no
retained profile and no observed profile FD writers. There were 48 unreadable
process FD directories, limiting the global writer census. Input release ACKs
and passive physical-state evidence are retained; absence is not a wait.
CLONE_UNTRACED and nonleader-exec coverage are not claimed. The detached remote
terminal parent's exit and detached local lifecycle supervisor's exit are not
promoted to external terminal-wait receipts.

A durable UUID preceded create; ID and finite expiry preceded runtime. Independent
observable watchdog/normal-stop roles were prearmed before allocation with an
immutable 25-minute cap at **21:17:11 UTC**. Both roles have their supervisor's
actual exit-zero waits and no remaining supervisor children. After independent
retrieval verification, delegated normal stop completed for **bx_bqb7yay4**:
**ARCHIVED**, expiry **NULL**, stopped **21:08:32.019 UTC**. Receipt
**stop_c582f7f82c38bbe7** completed **21:08:32.040 UTC**, `forced: false`,
`error: null`.

Recovery uses Git SHA, relevant small binary diff, owned-input patches with
reverse checks, the inherited untracked boot-provider recovery patch, and
existing media/module path/hash references. There is no source archive,
media/module duplication, old-run deletion, peer-WIP edit, local Chrome, old-box
operation, public deployment, subworker, RAM gate, config/backend/binding/clock/
seed change or guest write. Sampled `/home` free space remained above
1,500,000,000 bytes; continuous-floor enforcement is not claimed. This worker
publishes the concrete blocker and stops.

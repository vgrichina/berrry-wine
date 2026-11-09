# SuperTux review-client first-exit attempt

The sole fresh original completed **24 individually reviewed right-100 ms
actions**, moving from the opening floor toward the first two ice pillars.
The first-level exit remains unverified. The next choice reached sticky UNKNOWN;
gameplay stopped immediately without refresh, replay, another life or another
box. No death was observed. No production client defect was established and no
production code changed.

Evidence: `scratch/runs/20261108-supertux-client-first-exit-2356/`.
The personally reviewed final capture is `review/approach-08.png.gz`, captured
at **2026-11-09T00:04:26.719Z**, SHA-256
`d7350fbebb2916eaf59461c440362b281e996ca6533e71bc972d8b22ee3a5153`.
It shows native Pause, Tux grounded before the first pillar, a snowball beyond
that pillar, four lives and timer **268**. Score **150** and **six coins** were
already visible on map entry; they are not gains attributed to these actions.
Historical 2330 pillar and 2301 stomp images supplied guidance only.

## Actual command path and boundary

The published `tools/supertux-review-client.cjs` from **e78cb70d2** ran on the
same remote host as the native driver, listening on `127.0.0.1:8787`. No browser
review UI or port forward was used. Each explicit choice was an authenticated
HTTP POST issued through `boat exec`, with the exact single-use capture token,
native Pause/ground attestations and a description of the personally viewed
PNG. The numbered retained transport and unchanged controller performed input.
The response included original capture metadata and PNG bytes; the local helper
checked the SHA before rendering the fresh PNG for review. No automatic route,
image approval or preselected gameplay action was used. Menu, slot, story, map
and initial Escape were likewise explicit choices after fresh image review.

Successful controller admissions had capture ages **5,277–10,446 ms**. The
final choice entered at **11,777 ms**, still within the unchanged 12-second
limit. Its native-resume Escape DOWN/UP completed. The next phase rechecked the
same original observation at **12,100 ms** and refused it as stale **before
directional DOWN**. This is not a zero-input refusal: Escape had already resumed
the game. There was no final directional action or succeeding capture. The
controller correctly propagated sticky UNKNOWN, and the browser closed. The
existing request helper reported its missing-ACK deadline after approximately
30 seconds; no further input was sent during that wait.

`control-summary.json.gz` records 25 admissions, 24 completed directional
actions, and **73 fulfilled DOWN / 73 fulfilled UP** operations, including the
last resume. `original/pause-composition.jsonl.gz` is recoverable through the
remote inventory and content-addressed transports. This run demonstrates actual
reviewed movement through the HTTP client, not a completed pillar jump, stomp,
exit, unlock, audio or FPS result. A later separately authorized attempt needs
enough review-time margin for the controller's subsequent phase checks.

## Preparation and lifecycle

Q3's explicit **HEAVY_RELEASE NO_FIXTURE at 23:56:46Z** preceded allocation.
Q2 and Q3 remained offline during this original. The full local canonical
startup fingerprint checked **1,392 providers / 61,335,130 bytes**, including
the published client in the startup graph. Published providers were read from
their exact Git blobs through a local byte resolver, and retained inputs from
their existing paths; no second checkout or source snapshot was materialized.
The unchanged canonical remote barrier checked the identical manifest immediately
before the parent launched. Manifest SHA-256:
`08a614e1273710ed7b9c611ac1495aaa481c8a957a92482c93243cb481e315dd`.
Existing runtime/media/module selections, controller limits and ACK caps stayed
unchanged. Accepted client tests, controller/composition controls and locked
build evidence were read and referenced by PATH+HASH rather than rerun.

A run-only orchestration wrapper initially lacked an import during watchdog
preparation. This happened before allocation or a runtime claim. Its first
supervision tree was terminated and actually awaited; the wrapper was corrected
and the full affected local graph check repeated. The replacement independent
watchdog retained the **same original immutable deadline**,
**2026-11-09T00:22:48.185Z**, and was visibly armed before the only create.
The durable create UUID and returned box ID were retained before provisioning.

Box **bx_ja383wf2** was created at **23:58:52Z**, TTL **1,436 seconds**, with
returned `archiveAfter=2026-11-09T00:22:48.130Z`; `expiresAt` was not returned.
The browser execution window started at **23:59:29.186Z**. Local launch
PID **640326**, start **222957809**, was recorded before waiting; its actual
wait returned **0**, with separate stdout and stderr EOF. The supervised remote
parent returned **1** for the controller failure; its outer parent returned
**0**, both actually waited with stdio EOF. This supplies this run's local
launch evidence without changing historical 2330's status-143 cause UNKNOWN.

Chrome closed normally: Browser.close ACK, exit **0**, signal null, no escalation,
terminal and stdio drained in **293 ms**. The review client also exited **0**
with both streams at EOF. The custody journal recorded **3,894 events**,
**362 owned PID/start identities** and **362 actual reaps**; before-reap witnesses
were checked. Physical pending input was zero. Runtime/browser/client ports
**40901 / 43611 / 8787**, writable run FDs, active profile, input lock, runtime
lock and client lock were drained. Existing CLONE_UNTRACED, nonleader-exec and
external-signal coverage limits remain explicit.

All **452 remote regular files** were accounted for: **447 evidence files** and
**five pinned source references**, recovered using **367 unique gzip transports /
10,293,308 stored bytes**. Independent reopens verified original/stored SHA-256,
sizes and nested gzip CRC before the delegated normal stop. The box was
**archived at 00:06:08.317Z**. Stop receipt **stop_2c760072c1e1318b** completed
at **00:06:08.336Z**, `forced=false`, `error=null`; final `archiveAfter=null`,
`expiresAt` not returned. The independent watchdog actually waited **0**, its
board-tail child **-15**, with all streams at EOF and supervision awaited.

New command logs, review transports and recovery transports are gzip from their
first stored byte with distinct names. The unchanged native driver originally
writes PNGs and the custody kernel writes two raw metadata receipts; those exact
bytes are retained through compressed recovery, not claimed to have originated
compressed. Source recovery records exact Git SHA plus small owned patches and
retained recipe references, without source archives or repeated media/module
copies. The final inventory independently checks the exact local regular-file
set and records original/stored hashes, sizes and CRC. Free-/home samples stayed
above **1,500,000,000 bytes**; no continuous-floor claim or peer/old deletion.

The task ends after publishing this note. No heavy runtime remains.

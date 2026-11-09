# SuperTux: native level entry, reviewed jumps and neutral landings

The one authorized original entered **Welcome to Antarctica**, stomped the
first enemy, and completed 33 personally reviewed gameplay choices: 27
`right-100`, two `jump-right-200`, and four explicit airborne
`neutral-settle-200` choices. The fresh resulting images show native Pause,
the jumps, score 50 after the stomp, and returns to the snowy floor. An elevated
first-pillar landing, onward traversal, and the level exit remain **unverified**.
This task did not achieve its full goal and did not establish a runtime defect
that warrants a production change. No production code changed.

Evidence: `scratch/runs/20261109-supertux-prompt-choice-gameplay-0229/`.
Selected exact reviewed images are `level-visible.png`, `initial-pause.png`,
`pillar-jump.png`, `settle03.png`, `pillar-jump02.png`, and `settle04.png`.
The complete captured frames, commands, input logs, original timestamps,
module identities, reviews and failure output are retained locally and in the
hash-addressed recovery set. No later game input or screenshot followed the
first owned command failure.

The final successful settle produced capture
`review-3f89b244-6229-43f7-8da4-116dfa5f4f5c` at
**02:39:37.029Z**, SHA-256
`df380bd626a56149b4c095ea84848af096ab8bfc058897cecc2073b30e0d6552`.
I inspected it: Tux had returned to floor height in front of the pillar, rather
than landing on its visible top. I deliberated too long over that geometry.
The attempted `onward01` helper began at **02:39:52.035Z**, already
**15,006 ms** after the supporting capture, and failed at **02:39:52.142Z**
with `review choice disabled`. The page refused before `click()`, HTTP command
submission, a numbered game command, or input. No frame was refreshed to evade
this refusal. Only the ordinary no-input cleanup quit followed; it closes the
browser and does not resume the game or dispatch keys.

`choice-timing-audit.json.gz` reads recovered choice metadata, not pixels.
All 33 accepted choices were within the unchanged 12-second bound, at
**4,941–9,135 ms**. Twenty-eight met the 8-second aim; five did not. The failed
following choice was outside 12 seconds. Each resulting native image was
personally displayed and reviewed before the next selected action; there was
no diagnostic/tool roundtrip between image review and that choice. Every
airborne review used only empty keys and fixed 200 ms neutral settle, followed
by a fresh native Pause review. There was no route, detector, replay,
retimestamp, limit extension, or freshness workaround.

After the run stopped, a static check of the original level file identified
a material geometry distinction. At world columns 24–25 (x768–831), the first
visible snowy pillar uses tile IDs **122/123** in background row 11 and
**124/125** below it. The corresponding interactive-layer cells above floor
row 13 are zero; floor tiles are 8. The second early pillar at columns 28–29
has the same layer placement. The tile definitions name `snowbg1.png` through
`snowbg4.png` and include `solid #t`, so the layer distinction matters; tile
flags alone do not prove a collision surface. This supports a scenery
interpretation of the apparent pillars, consistent with the observed descent
to the floor. It does **not** establish an emulator collision failure.
`static-pillar-layer-check.json.gz` records the exact original file paths,
sizes, SHA-256 values and relevant cells without copying media or generating
gameplay decisions. A future task should distinguish the requested scenery
checkpoint from a real interactive landing surface before claiming success.

Offline preparation read the 0212/0124/0116/0046 notes and included published
**df0932c1c** terminal-failure replies. The run's canonical Git was
**9944ddf9227cc5062ed0604b45687bbc3826bb99**. Local/remote barriers matched
**1,462 providers / 61,453,389 bytes**, manifest SHA-256
`a865214924efc8fe75624f942c6720a341a3a8fae27b12105376d513db3a7d0a`.
The loaded CPU SHA-256 stayed
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
native observation stayed OFF. The exact singular physical-key Enter,
ArrowDown and Escape payloads passed the actual composed executor offline
before capture. Accepted unchanged controller/client/composition controls and
the 0212 focused failure-reply test and locked build were verified and reused
by PATH+HASH. No new build or unchanged-test rerun is claimed. Preparation
initially referenced a missing historical test path, then detected a stale
provider fingerprint after that correction; both failed checks and the
corrected final barrier are retained. Both happened before allocation.

The exact Warcraft0224 `bx_gsub82ym ARCHIVED PHYSICAL_DRAINED` release was
posted at **02:32:00Z**; the interruptible watcher actually waited 0 and awaited
its tail. No peer box was accessed. The independent immutable watchdog was
prearmed at **02:33:00Z**, UUID
`cf9c2687-ab72-4115-ba9c-e30d8388a6ae`, PID **865281**, start **223878940**,
deadline **02:58:00.114Z**. The sole fresh box **bx_3zcmeteb** was created at
**02:33:08.903Z** with TTL **1,491 seconds** and initial
`archiveAfter=02:57:59.745Z`; `expiresAt` was not returned. The original began
at **02:33:44.490Z**. There was no second original.

Cleanup Browser.close received ACK and completed normally in **207 ms**,
browser exit 0, signal null, no escalation, with terminal streams drained.
The client exited 0 with separate stdout/stderr EOF. Custody verified
**373 owned identities / 373 actual reaps / 3,960 events**, including the
before-wait PID/start witnesses. Kernel parent **6303/start8530** and outer
parent **6300/start8519** actually waited 0 with separate stdout/stderr EOF.
Ports **38843, 41041 and 8787**, writable run FDs, profile, input/client locks
and runtime lock were drained. Both physical-drain records show pending 0.
The watchdog actually waited 0 and its tail -15, with stream EOF.

The local runtime and watchdog-supervision tool terminals returned **143**.
Their wrapper exit receipts and the local Boat launch's actual-wait receipt
are missing and remain **UNKNOWN**, even though the remote waits are complete
and all locally recorded PID/start identities were later absent. The release
tail's start identity was not recorded. One truncated local stdout gzip and
five empty local gzip paths are retained verbatim with SHA/size and UNKNOWN
CRC in `local-gzip-audit.json.gz`; no footer or wait was fabricated. Historical
untraced-clone, nonleader-exec and external-signal limits remain UNKNOWN.

All **662 remote regular files** were accounted for, including pinned input
references. **544 unique transports / 13,375,920 stored bytes** passed original
and stored SHA-256, size, independent reopen, GNU gzip CRC and exact-set checks
**before** delegated normal stop. The box was archived at
**02:41:43.213Z**; receipt **stop_64e3904c896da4ae** completed at
**02:41:43.231Z**, `forced=false`, `error=null`, final `archiveAfter=null`,
`expiresAt` not returned. Physical release was posted at **02:42:22Z**.
Free `/home` stayed above 1.5 GB at recorded checks, with narrow headroom
reported to the coordinator. Git SHA plus small owned input patches preserve
source recovery. No source/media/module archive, peer cleanup, local browser,
local heavy execution, parallel runtime, agents, RAM gate or deployment was
used. Next work requires a separately authorized original, an accurate landing
checkpoint, and decisions submitted before the unchanged freshness deadline.

# SuperTux: terminal menu failure must notify its waiting sender

The one authorized original reached the Slot 1 menu. First-pillar landing,
onward gameplay, and the first-level exit remain unverified. The run reproduced
a command-lifecycle defect: the composed driver recorded terminal failure and
closed normally, while the numbered sender continued waiting for its absent
success reply until its entire 30-second ACK deadline. The production
composition now publishes an exact-ID `ok:false`, `noReplay:true` reply after
the consumer records terminal failure, then rethrows the original error to the
existing close handler. There is no success or refresh authorization. Existing
replies are preserved; notification failure preserves the original cause.

Evidence: `scratch/runs/20261109-supertux-early-landing-progress-0212/`.
The actual original used canonical Git **3b8958347d7ca5cd09fb9817b0e0932bdfb797bb**,
including d1893e28 sticky menu failure and 82d028903 explicit airborne settle.
Local and remote barriers matched **1,441 providers / 61,415,602 bytes**,
manifest SHA-256 `4a6327cb204138a8fabac9f67d16f414759cb26fa7c2f53abd8bfc45d0c86072`.
CPU SHA-256 was `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
native observation stayed OFF. Unchanged 0116/0046 accepted controls and the
0124 locked build/menu tests were verified and reused by PATH+HASH. The current
singular menu payload additionally passed actual composed offline execution.
An initial provider-source mistake and an offline fixture missing `root` failed
before allocation, were corrected, and remain recorded.

I personally inspected the native menu and resulting Slot 1 image. The menu
capture was at **02:18:46.482Z**; Start Game's Enter was admitted at age
**9,441 ms**, inside 12 seconds but missing the 8-second aim. The Slot 1 image
was captured at **02:18:56.397Z**, SHA-256
`a96d9137e93ce5baa87466b11741e0c5df7761e3f6589caee1689c2d45b40294`.
The next action reached terminal menu admission failure at **02:19:08.498Z**,
12,101 ms after that original capture. This is consistent with stale admission;
the serialized wrapper does not retain the underlying cause, so its exact
internal guard timestamp/cause remain UNKNOWN. Only the successful Start Game
Enter DOWN/UP appears in recovered native input. No Slot 1 Enter, later game
input, or fresh capture followed failure. No grounded/airborne gameplay review
or neutral settle was reached. The earlier Slot 1 image was displayed again
while polling the pending command; that was a local read, not a new capture.

The failure record is command **2**, at **02:19:08.498Z**. Its real sender
**PID 6764 / start 17900** had started at **02:19:08.254Z**, but did not exit
until **02:19:38.309Z**, status 1, after `UNKNOWN command ACK deadline`.
Its actual wait and both stream EOFs are retained, as are those of the two
successful remote menu helpers. The repair was made after runtime shutdown and
was not loaded into this original. No second original was attempted.

`menu-failure-focused-final` passed offline with a real Node sender and the
exact consumer call extracted from the actual composed production loop. The
stale action caused zero effects; the sender received failure and exited 1 in
**24 ms**, with stdout/stderr EOF. A later request was refused before producing
another numbered command. Normal ArrowDown retained its DOWN/UP plus capture
and exact success reply. Missing terminal records and existing replies did not
produce fabricated notifications. The generic retained transport, 12-second
freshness limit, runtime/ACK caps, controller, choice set and independent UP
remain unchanged. `flock /tmp/wine-build.lock bash tools/build.sh` passed; CPU
SHA-256 stayed a320. No browser or game ran in the repair tests.

Renderer0146's exact `bx_9g93pmg4 ARCHIVED PHYSICAL_DRAINED` board release was
posted at **02:15:35Z**. Its release watcher actually waited 0 and awaited its
tail. No peer box was accessed. An independent immutable UUID watchdog was
prearmed at **02:16:54Z**, UUID `4585f131-191f-4f91-8ee4-713ae86fba67`, deadline
**02:41:54.659Z**. The single box **bx_g7xyqr9c** was created at **02:17:08Z**,
TTL **1,486 seconds**, initial `archiveAfter=02:41:54.248Z`; `expiresAt` was not
returned. The original began at **02:17:54.346Z**.

Browser.close ACKed and completed normally in **11,788 ms**, browser exit 0,
signal null, with no escalation. Client exit 0 and both stream EOFs are retained.
Kernel custody verified **189 identities / 189 actual reaps / 1,746 events**,
including before-wait witnesses. Kernel-parent wait was 1, outer wait 0, and
local Boat original wait 0, with EOF. Ports **41895, 35443, 8787**, writable run
FDs, active profile, input/client locks and runtime lock were drained. Physical
pending input was zero. The 20 locally recorded command PID/start identities
were absent; the watchdog waited 0, its tail -15, and supervision waited 0 with
EOF. Historical unrecorded/nonleader-exec, untraced-clone and external-signal
limits remain UNKNOWN; these receipts do not repair earlier missing history.

All **96 remote regular files** were accounted for: **79 evidence files** and
**17 pinned references**, **72 unique transports / 1,035,171 stored bytes**.
Stored/original SHA-256, sizes, independent reopen, GNU gzip CRC and exact set
passed before normal archive. No inactive profile/cache exclusions were
actually needed; the normal close had removed the profile. Free `/home` stayed
above 1.5 GB at recorded checks. Git SHA plus small owned patches preserve the
source; no source/media/module archive, peer deletion, agents, parallel runtime,
local heavy execution, RAM gate or public deployment was used.

The box was **archived at 02:20:28.756Z**. Stop receipt
**stop_5af07274747100b7** completed at **02:20:28.779Z**, `forced=false`,
`error=null`, final `archiveAfter=null`, `expiresAt` not returned. Physical
release was posted after recovery and watchdog drain. Next gameplay needs a
separately authorized original, fresh canonical composition including this
repair, and personal frame decisions submitted early enough for the unchanged
12-second bound.

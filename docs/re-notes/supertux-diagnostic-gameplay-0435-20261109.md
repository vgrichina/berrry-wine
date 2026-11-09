# SuperTux 0435: offline preparation, NO_BOX STOP

The requested fresh level progress was **not achieved**. No SuperTux box,
Chrome, original execution, runtime input or gameplay capture was created.
Evidence: `scratch/runs/20261109-supertux-diagnostic-gameplay-0435/`.

The required exact `warcraft-actual-close-0435 ARCHIVED PHYSICAL_DRAINED`
board release never arrived. At **04:34:43Z**, that worker instead posted
`RUNTIME_RELEASE NOT_CREATED PHYSICAL_DRAINED NO_ARCHIVE_NEEDED` and
`RELEASE STOP NOT_ACHIEVED`: its offline preflight invocation used
`BROWSER_DEADLINE1900000000000` and failed the existing 30-minute assertion.
This is the upstream worker's reported failure; no Warcraft runtime result
was independently established here. Its suggestion that the runtime slot was
free does not satisfy this task's exact release requirement. The owner's
explicit upstream-failure rule therefore requires **NO_BOX STOP**.
`no-box-stop.json.gz` preserves the exact board lines and zero create attempts.
No allocation watchdog was armed because allocation was never reached.
Box ID/state/expiry/stop receipt: **null / NOT_CREATED / null / null**.

Before that failure, offline preparation passed:

- The exact setup helper ran eleven actual Node children through published
  `requestReady`, real numbered transport and the production composed executor.
  Capture, Enter, Escape and map ArrowDown calls passed, with six balanced
  DOWN/UP pairs, readiness before first admission, separate stdout/stderr EOF,
  and unsupported `Return` rejected before command admission. Pixels and
  identity effects were offline fixtures; this is no native gameplay evidence.
- The nine production diagnostic cases passed, covering fresh/stale admission,
  delayed input, asynchronous expiry, storage/browser/disconnection errors,
  and delayed/rejected DOWN with independently scheduled UP. Exact cause and
  timing preservation remains the published 0415 implementation.
- The exact launch branch passed against an offline child with its own parent's
  incoming stdin already at EOF. A separate pipe was armed before spawning;
  its writer stayed open through the child's actual wait. Both output streams
  drained. This validates the prepared caller, not a real browser lifetime.
- The production preflight verified all 1,531 selected providers using
  published Git blobs in memory where needed. Strict Chrome flags and CPU
  `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`
  were unchanged. Composition SHA-256 is
  `3793f2757d4189fed48a5f8ec898e25722cb9c9787429db1387d09345c03a48d`.
  SuperTux is pinned to published
  `fddc9322aa42497bedeebfeef6447a47ff0df6e6`; custody is pinned to
  `4341b87723a7d56bc98223215cca4cdc878fcae2`, SHA-256
  `d38f2092c7fc0d5b1e4caabf2bd21040167d4f147c55186fd6e4a39cd00a4636`.
  Peer-owned custody changes were neither edited nor adopted.
- Original verification passed: 787 originals, authentic CRT and 786 manifest
  mappings. Ten prior focused/build logs were independently reopened and matched
  to their recorded SHA-256 and size, including the accepted 0415 build and
  0420 custody build/suite. `exact-hash-check-reuse.json.gz` records this reuse;
  no new production code or build was required.

I read the 0415 and 0400 notes and the original recovery/control recipe, and
personally inspected 0400's retained `current.png`, SHA-256
`76611a395c2714a2b8541735021cc2f52cb3f12e5aea79c38ee4045e090c19f8`.
It shows the world map with score 75 and three coins, which is not new progress.
The historical 0400 cause remains **UNKNOWN**. No native Pause, client prompt
choice, first-level exit or new visible consequence was reached in this task.
The 12-second freshness cap, 8-second aim and other caps were not changed.

Recovery uses the recorded Git base, provider references and small binary
patches for run-specific inputs. There are no source/media/module archives.
Local evidence SHA-256, sizes and gzip CRC are retained. The board watcher
actually waited -15 with separate stdout/stderr EOF. Free /home remained above
1.5 GB; no agents, workers, peer-box operations or public deployment occurred.

Only this note is published. Next requires separate authorization with an
explicit valid upstream release or an owner change to that prerequisite.
This single task stops after publication.

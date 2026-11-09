# Nox open-lane staff attempt: terminal native fixture startup failure

Run: `scratch/runs/20261109-nox-open-lane-staff-target-2020/` (ignored evidence).
Tested source: `6f1600a7402815b8c0b519581b111430e96110df`.
Only this note is a tracked change. No production provider, startup diagnostic,
media, input guard or deadline was changed.

## Concrete blocker and limits

The one native fixture failed before app selection. At **20:40:59.114Z**,
the unchanged 100 × 100 ms startup readiness loop ended with `ENOENT` reading
`chrome-profile/DevToolsActivePort`. The existing `d5a984cc4` diagnostic recorded
100 polls, 10,144.656 ms elapsed, no port file, and Chrome PID 6661 still present
with no exit code or signal. Its failure-time stderr was 573 bytes of DBus
errors. These observations do **not** establish a DBus, ptrace or other causal
explanation. The final recovered stderr additionally contains a DevTools
listening line absent from that failure-time snapshot; it was never used for
admission and does not establish when the port file became ready.

This first native failure was terminal. The conditional original was **not
started**. No original gameplay input, capture, retry or quit was issued, and
no guard or deadline was relaxed. There are zero native PNGs. Alive HUD,
equipment, aim, visible target, safe onward movement and target consequence
are consequently **unproved in this run**. No causal repair was selected.

The earlier `649da4d08` run remains the evidence for Force of Nature Staff of
Recharge pickup, inventory equipment, charge 3 → 2 and subsequent self-defeat.
Its enclosed-door firing position was not repeated. The exact damage mechanism
and an enemy hit remain unknown; no ricochet is inferred.

## Source and authorization

Preparation initially remained offline under the RF1940 release/stop gate.
The coordinator's authored **20:36:03Z** board amendment expressly superseded
that gate and the pending direct-delivery requirement, solely for an unchanged,
independently reverified 776-input candidate on this worker's separate fresh
box. `coordinator-amendment.json` retains the exact entry. Before the native
fixture, RF1940 had also published its release and a separate API read confirmed
its box archived with completed unforced stop `stop_9910b2da9d460023`.

All 776 input SHA/size identities were independently compared with the published
1925 closure: **zero differences**, including all 126 media inputs and both
freshly recompiled modules. Actual tracked provider source differences to
`649da4d08b974ed8cffc7056cd61734e050198f7` were empty. The three Q3-only proposed
paths were independently excluded from this closure. Startup diagnostics were
unchanged. Primary staged module: 2,186,068 bytes,
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
compat: 2,188,714 bytes,
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
Neither is claimed as an actually loaded game module in this failed fixture.

An offline final comparison asserted that HEAD still equalled the tested plan
after RF1940's documentation commit advanced main. The shell continued to arm
the watchdog and create the sole box. Before staging or native work, the routine
metadata error was corrected by verifying the actual provider source diff from
the tested commit to new HEAD was empty. The tested plan and pins were retained;
there was no regeneration or blind repin. Git SHA plus relevant patches preserve
source identity; no source-tree or media archives were made.

## Validation and lifecycle

- `node --test ops/browser-native-input.test.cjs`: **3 passed**.
- Fresh generated `tools/nox-current-driver.test.cjs`: **13 passed**, including
  source/module/media/repin refusals, missing-port diagnostics, early death,
  malformed port, ordinary input and drag cleanup. These used offline Node peers.
- `flock /tmp/wine-build.lock bash tools/build.sh`: **passed**, actual exit 0.
- Small operational scripts parsed; request/phase terminal markers, disk floor,
  authored release predicates and independent watchdog actual-wait/EOF tests passed.
  An offline substring release-check bug was corrected to an exact authored-entry
  predicate before any pins or runtime; quoted and duplicate entries were tested.

One fresh box **`bx_yhe3qyay`**, immutable watchdog UUID
**`843ab430-174a-41d3-b620-67b6e7b4bd1e`**, was created after the independent
watchdog was armed and observed. Watchdog deadline: **21:04:49.313Z**;
initial box expiry: **21:04:50.282Z**. The browser deadline was two minutes
earlier. No other box was controlled, and no local Chrome or nested worker ran.

Automatic terminal cleanup ended Chrome with **SIGKILL**; normal Chrome exit
is not claimed. The fixture custody parent actually waited **1** with separate
stdout/stderr EOFs. Kernel custody reaped **133** processes with no remaining
or unreaped processes. Independent cleanup verified all four recorded parent,
custodian, driver and Chrome PIDs absent, both ports closed, then removed the
stale owned profile. No additional browser command was sent.

All **26 remote artifact references** were recovered or matched to existing
local bytes, then independently reread for SHA-256 and size, including gzip CRC
validation, before the sole delegated unforced normal-stop request. The native
PNG set was verified empty; offline peer sentinel images were excluded.

Final independent API state: **ARCHIVED**, archiveAfter **null**, expiresAt
not returned. Stop **`stop_9ea76962587cd8f5`** completed with **forced:false**
at **20:41:55.397Z**; stoppedAt **20:41:55.380Z**. The watchdog separately
actually waited **0**, with stdout and stderr EOFs and its child reaped. No
second stop, resume or delete was issued.

Next work requires a separately assigned startup-cause investigation under the
same terminal boundary. Safe staff exploration remains outstanding; the failed
fixture does not justify another native attempt in this task.

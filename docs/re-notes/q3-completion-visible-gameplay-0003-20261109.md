# Q3 composition provider prelaunch repair — 2026-11-09

The actual Q3 prelaunch wrapper accepted a canonical 913-provider manifest
without `tools/q3-screenshot-completion.cjs`, even though the published
`dd6a445e0` composition requires it. This was reproduced offline with the real
wrapper: checkOnly:true, importsBound:true, spawn:false. A successful local
barrier therefore did not guarantee the driver dependencies would be uploaded.
The earlier noncanonical 931-provider input correctly failed on duplicate
providers; both results are retained separately.

`tools/q3-native-prelaunch.py` now reads the owning composition's exact literal
provider map and requires its composition file, each dependency and each expected
SHA in the startup manifest before publishing the barrier. It rejects an
unsupported declaration or entry instead of silently skipping it. The existing
content barrier then validates actual sizes and SHA, and the actual runtime's
Python imports still bind before any original claim. The same wrapper enforces
this requirement locally and remotely. No browser or guest is executed to inspect
the graph, and the provider map is not copied into a second maintained list.

The refreshed canonical graph has 914 providers, including the new screenshot
helper. The actual full local --check-only passed and actual composition source
compilation passed. The retained runtime's composition-before-execution preload
order is verified by path and SHA. The marker-clock source is unchanged from
7227918eb. The new screenshot observer already instruments actual send,
receive-before-routing and CDP deadline boundaries; this task changes no observer,
capture options, cap, ACK, input or frame timestamp behavior.

Focused controls exercise the actual wrapper with audit hooks refusing process,
network and native startup. Missing screenshot helper, missing composition and
stale helper pin now fail before barrier publication; valid startup, bad provider,
changed barrier generation, missing Python provider, bad import and refused spawn
controls pass. The first focused invocation lacked its output parent directory;
that harness error is retained, and the corrected invocation passed. Previously
accepted unchanged checks are reused through verified PATH/SHA references.

Evidence is in `scratch/runs/20261109-q3-completion-visible-gameplay-0003/`:
Git SHA, small owned patches, canonical pins and barrier, reproduced pre-repair
acceptance, focused/compile/build logs and inventory. No source tree archive,
repeated media/module copy, peer edit/deletion or agent launch occurred. The
canonical manifest is an offline preparation record; refresh it again against
final committed providers and rerun the actual check immediately before any
future allocation. Peer CPU/guest-import work remains under its owner's control.

No runtime was allocated or accessed. SuperTux client-first-exit-2356 retains the
sole heavy slot pending its explicit archived/drained RUNTIME_RELEASE. Box ID,
state, expiry and stop receipt: NONE / NOT CREATED / N/A / N/A. Historical local143,
untraced-clone and nonleader UNKNOWN remain unchanged. This repair supplies no
new gameplay screenshot and does not assign a screenshot/GPU/emulator root cause.

Next: after explicit SuperTux release, use this complete provider graph with a
fresh final local check, independent UUID/25-minute watchdog, finite TTL and
identical remote barrier. One bounded original may then recover the new
screenshot-completion log at first UNKNOWN, preserving no replay/no extra capture,
and perform verified recovery and delegated normal shutdown. This task stops
with the reproduced startup defect repaired and published.
